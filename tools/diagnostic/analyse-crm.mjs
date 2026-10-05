/** Offline, aggregate-only reporting. Never reads a live CRM or changes routing. */
import { openSync, closeSync, readSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SEGMENTS = ['enquiries', 'admin', 'quality', 'unknown'];
const OUTCOMES = ['improved', 'unchanged', 'worse', 'unknown'];
const MONEY = ['feeMinor', 'refundMinor', 'acquisitionMinor', 'sellingMinor', 'deliveryMinor'];
const FIELDS = ['opportunityId', 'segment', 'sale', ...MONEY, 'customerOutcome'];
const MAX_RECORDS = 5000;
const MAX_BYTES = 2 * 1024 * 1024;

function exactKeys(value, fields) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
      || ![Object.prototype, null].includes(Object.getPrototypeOf(value))
      || Reflect.ownKeys(value).length !== fields.length
      || !fields.every(key => Object.hasOwn(value, key))) {
    throw new TypeError('Unexpected or missing fields in the de-identified schema.');
  }
}
function empty() {
  return { opportunities: 0, won: 0, lost: 0, open: 0, feeMinor: 0, refundMinor: 0,
    acquisitionMinor: 0, sellingMinor: 0, deliveryMinor: 0, refundedOpportunities: 0,
    customerOutcomes: { improved: 0, unchanged: 0, worse: 0, unknown: 0 } };
}
function add(totals, row) {
  totals.opportunities++;
  totals[row.sale]++;
  for (const field of MONEY) totals[field] += row[field];
  if (row.refundMinor > 0) totals.refundedOpportunities++;
  totals.customerOutcomes[row.customerOutcome]++;
}
function finish(totals) {
  const closed = totals.won + totals.lost;
  const netFeeMinor = totals.feeMinor - totals.refundMinor;
  const contributionMinor = netFeeMinor - totals.acquisitionMinor - totals.sellingMinor - totals.deliveryMinor;
  return { ...totals, closed, netFeeMinor, contributionMinor,
    winRateClosed: closed ? totals.won / closed : null,
    contributionPerOpportunityMinor: totals.opportunities ? contributionMinor / totals.opportunities : null };
}

/**
 * Requires one deliberately de-identified row per opportunity, including losses/open work.
 * Money is GBP minor units, integer 0..1e9; 5000-row limit keeps totals exactly representable.
 * A reported win may later be fully refunded; refunds are counted independently.
 */
export function analyseCrm(document) {
  exactKeys(document, ['schemaVersion', 'currency', 'records']);
  if (document.schemaVersion !== '1.0.0' || document.currency !== 'GBP') {
    throw new TypeError('Expected schema version 1.0.0 and GBP currency.');
  }
  if (!Array.isArray(document.records) || document.records.length > MAX_RECORDS) {
    throw new RangeError('Expected an array of at most 5000 records.');
  }
  const ids = new Set();
  const total = empty();
  const segments = Object.fromEntries(SEGMENTS.map(segment => [segment, empty()]));
  for (const row of document.records) {
    exactKeys(row, FIELDS);
    if (typeof row.opportunityId !== 'string' || !/^[a-z0-9_-]{1,64}$/i.test(row.opportunityId)) {
      throw new TypeError('Use a pseudonymous opportunity identifier, not contact details.');
    }
    if (ids.has(row.opportunityId)) throw new RangeError('Duplicate opportunity identifier.');
    ids.add(row.opportunityId);
    if (!SEGMENTS.includes(row.segment) || !['won', 'lost', 'open'].includes(row.sale)
      || !OUTCOMES.includes(row.customerOutcome)) throw new TypeError('Unsupported segment or outcome.');
    for (const field of MONEY) {
      if (!Number.isSafeInteger(row[field]) || row[field] < 0 || row[field] > 1_000_000_000) {
        throw new RangeError('Money must be integer GBP minor units from 0 to 1000000000.');
      }
    }
    if (row.refundMinor > row.feeMinor) throw new RangeError('Refund exceeds the recorded fee.');
    if (row.sale !== 'won' && (row.feeMinor !== 0 || row.refundMinor !== 0 || row.customerOutcome !== 'unknown')) {
      throw new RangeError('Non-won opportunities must have zero fees/refunds and unknown delivery outcome.');
    }
    add(total, row);
    add(segments[row.segment], row);
  }
  return { schemaVersion: '1.0.0', currency: 'GBP', status: 'descriptive_only',
    archetypeStatus: 'provisional_problem_segments', routingChanged: false,
    total: finish(total),
    segments: Object.fromEntries(SEGMENTS.map(segment => [segment, finish(segments[segment])])),
    limitations: [
      'These are observed rates in the supplied export, not calibrated predictions or causal evidence.',
      'Include won, lost and open opportunities; a buyers-only export cannot establish funnel conversion.',
      'Contribution includes supplied acquisition, selling and delivery costs; it is not company profit or cash reconciliation.',
      'Open opportunities have unresolved outcomes. Customer outcome labels are supplied, not independently verified.',
      'No contact data or raw opportunity identifiers are emitted. No routing rules or prices are changed.',
    ] };
}

function readBounded(path) {
  const fd = openSync(path, 'r');
  try {
    const buffer = Buffer.alloc(MAX_BYTES + 1);
    let size = 0;
    while (size < buffer.length) {
      const read = readSync(fd, buffer, size, buffer.length - size, null);
      if (!read) break;
      size += read;
    }
    if (size > MAX_BYTES) throw new RangeError('Export exceeds the 2 MiB limit.');
    return buffer.subarray(0, size).toString('utf8');
  } finally { closeSync(fd); }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length !== 3) {
    process.stderr.write('Usage: node tools/diagnostic/analyse-crm.mjs deidentified-export.json\n');
    process.exitCode = 2;
  } else {
    try {
      const report = analyseCrm(JSON.parse(readBounded(process.argv[2])));
      process.stdout.write(JSON.stringify(report, null, 2) + '\n');
    } catch {
      // Do not echo parser fragments, paths or customer data into logs.
      process.stderr.write('CRM analysis failed: unreadable export, invalid JSON, size limit or de-identified schema mismatch.\n');
      process.exitCode = 1;
    }
  }
}
