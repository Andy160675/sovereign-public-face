/** Offline descriptive reporting from a deliberately de-identified, single-cohort export. */
import { openSync, closeSync, readSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const MAX_RECORDS = 5000;
const MAX_BYTES = 2 * 1024 * 1024;
const MAX_VALUE = 1_000_000_000;
const STAGES = ['delivered', 'visited', 'service_selected', 'checkout_started'];
const CATEGORIES = ['page_creation', 'distribution', 'selling', 'delivery', 'processing', 'support'];
const ACQUISITION_COSTS = ['page_creation', 'distribution', 'selling'];
const BENCHMARKS = ['cpmMinor', 'ctr', 'cpcMinor', 'paidOrderRatePerClick', 'adCpaMinor', 'netRoas'];
const MINIMUMS = ['minimumImpressions', 'minimumClicks', 'minimumPaidOrders'];

function fail() { throw new TypeError('Invalid de-identified acquisition schema.'); }
function exactKeys(value, fields) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
      || ![Object.prototype, null].includes(Object.getPrototypeOf(value))
      || Reflect.ownKeys(value).length !== fields.length
      || !fields.every(key => Object.hasOwn(value, key))) fail();
}
function identifier(value) {
  if (typeof value !== 'string' || !/^[a-z0-9_-]{1,64}$/i.test(value)) fail();
}
function integer(value, nullable = false) {
  if (nullable && value === null) return;
  if (!Number.isSafeInteger(value) || value < 0 || value > MAX_VALUE) fail();
}
function bool(value) { if (typeof value !== 'boolean') fail(); }
function oneOf(value, values) { if (!values.includes(value)) fail(); }
function timestamp(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) fail();
  const millis = Date.parse(value);
  if (!Number.isFinite(millis) || new Date(millis).toISOString() !== value) fail();
  return millis;
}
function unique(value, seen) {
  identifier(value);
  if (seen.has(value)) fail();
  seen.add(value);
}
function ratio(numerator, denominator) {
  return numerator !== null && denominator !== null && denominator > 0 ? numerator / denominator : null;
}
function validate(document) {
  exactKeys(document, ['schemaVersion', 'cohort', 'traffic', 'pages', 'payments', 'costs',
    'costsComplete', 'cashEntries', 'cashComplete', 'comparison']);
  if (document.schemaVersion !== '1.0.0') fail();
  const { cohort: c, traffic: t, comparison: b } = document;
  exactKeys(c, ['cohortId', 'campaignId', 'channel', 'currency', 'periodStart', 'periodEnd',
    'asOf', 'trackingComplete', 'attributionWindowClosed']);
  identifier(c.cohortId); identifier(c.campaignId);
  oneOf(c.channel, ['paid_ads', 'email', 'organic']);
  oneOf(c.currency, ['GBP', 'EUR', 'USD']);
  bool(c.trackingComplete); bool(c.attributionWindowClosed);
  const start = timestamp(c.periodStart), end = timestamp(c.periodEnd), asOf = timestamp(c.asOf);
  if (start > end || end > asOf) fail();
  exactKeys(t, ['impressions', 'clicks', 'adSpendMinor']);
  for (const value of Object.values(t)) integer(value, true);
  if (c.channel !== 'paid_ads' && t.adSpendMinor !== 0) fail();
  bool(document.costsComplete); bool(document.cashComplete);
  exactKeys(b, [...MINIMUMS, ...BENCHMARKS]);
  for (const key of MINIMUMS) { integer(b[key]); if (b[key] === 0) fail(); }
  for (const key of BENCHMARKS) {
    const value = b[key];
    if (value !== null && (typeof value !== 'number' || !Number.isFinite(value)
      || value < 0 || value > (key === 'ctr' ? 1 : MAX_VALUE))) fail();
  }
  const ledgers = [document.pages, document.payments, document.costs, document.cashEntries];
  if (!ledgers.every(Array.isArray) || ledgers.reduce((sum, rows) => sum + rows.length, 0) > MAX_RECORDS) fail();
  const pageIds = new Set();
  for (const page of document.pages) {
    exactKeys(page, ['pageId', 'businessId', 'stage', 'freeAccepted']);
    unique(page.pageId, pageIds); identifier(page.businessId);
    oneOf(page.stage, STAGES); bool(page.freeAccepted);
  }
  const currency = row => { if (row.currency !== c.currency) fail(); };
  const linkedPage = value => { if (!pageIds.has(value)) fail(); };
  const occurred = value => { const time = timestamp(value); if (time < start || time > asOf) fail(); };
  const paymentIds = new Set(), paymentRefs = new Set();
  for (const payment of document.payments) {
    exactKeys(payment, ['paymentId', 'pageId', 'currency', 'status', 'evidenceKind', 'evidenceRef',
      'amountMinor', 'refundMinor', 'occurredAt']);
    unique(payment.paymentId, paymentIds); unique(payment.evidenceRef, paymentRefs);
    linkedPage(payment.pageId); currency(payment); occurred(payment.occurredAt);
    oneOf(payment.status, ['succeeded', 'pending', 'failed']);
    oneOf(payment.evidenceKind, ['provider_export', 'webhook_observation']);
    integer(payment.amountMinor); integer(payment.refundMinor);
    if (payment.refundMinor > payment.amountMinor
      || (payment.status !== 'succeeded' && (payment.amountMinor !== 0 || payment.refundMinor !== 0))) fail();
  }
  const costIds = new Set();
  for (const cost of document.costs) {
    exactKeys(cost, ['costId', 'pageId', 'category', 'currency', 'amountMinor']);
    unique(cost.costId, costIds);
    if (cost.pageId !== null) linkedPage(cost.pageId);
    currency(cost); oneOf(cost.category, CATEGORIES); integer(cost.amountMinor);
  }
  const entryIds = new Set(), bankRefs = new Set();
  for (const entry of document.cashEntries) {
    exactKeys(entry, ['entryId', 'evidenceRef', 'currency', 'direction', 'amountMinor', 'occurredAt']);
    unique(entry.entryId, entryIds); unique(entry.evidenceRef, bankRefs);
    currency(entry); oneOf(entry.direction, ['in', 'out']); integer(entry.amountMinor); occurred(entry.occurredAt);
  }
}

function findingsFor(document, total, metrics) {
  const { cohort: c, traffic: t, comparison: b } = document;
  const findings = [];
  const add = (code, possibleChecks) => findings.push({ code, possibleChecks });
  if (!c.trackingComplete) add('incomplete_tracking', 'Investigate measurement completeness before interpreting economics or testing acquisition changes.');
  if (!c.attributionWindowClosed) add('await_conversion_data', 'Await the upstream attribution window closing before drawing conversion conclusions.');
  if (findings.length) return findings;
  const compare = (code, metric, benchmark, enough, direction, checks) => {
    if (enough && metric !== null && benchmark !== null
      && (direction === 'high' ? metric > benchmark : metric < benchmark)) add(code, checks);
  };
  const impressionsEnough = t.impressions !== null && t.impressions >= b.minimumImpressions;
  const clicksEnough = t.clicks !== null && t.clicks >= b.minimumClicks;
  const ordersEnough = total.paidOrders >= b.minimumPaidOrders;
  compare('high_cpm', metrics.cpmMinor, b.cpmMinor, impressionsEnough, 'high',
    'Possible checks: audience, auction conditions, placements and campaign objective.');
  compare('low_ctr', metrics.ctr, b.ctr, impressionsEnough, 'low',
    'Possible checks: hook, creative, relevance and offer.');
  compare('high_cpc', metrics.cpcMinor, b.cpcMinor, clicksEnough, 'high',
    'Possible checks: inspect CPM and CTR together to locate the expensive step.');
  if (clicksEnough && total.paidOrders === 0) add('no_paid_orders',
    'No counted paid orders were observed after the supplied click threshold and closed window. Check intent, message match, page, trust, checkout and tracking.');
  compare('low_paid_order_rate', metrics.paidOrdersPerClick, b.paidOrderRatePerClick, clicksEnough, 'low',
    'Possible checks: intent, message match, page, trust, checkout and tracking.');
  compare('high_ad_cpa', metrics.adCpaMinor, b.adCpaMinor, ordersEnough, 'high',
    'Possible checks: identify the expensive acquisition step using CPM, CTR and click conversion.');
  compare('low_net_roas', metrics.netRoas, b.netRoas, ordersEnough, 'low',
    'Possible checks: conversion, order value and refunds. ROAS alone does not establish contribution.');
  if (!document.costsComplete) add('incomplete_costs', 'Complete costs, including work for nonbuyers, before any profit or scale judgement.');
  else if (total.contributionMinor !== null && total.contributionMinor < 0) add('negative_contribution',
    'Observed contribution is negative after supplied costs. Check acquisition, selling, delivery, processing and support costs.');
  return findings;
}

/**
 * The upstream exporter chooses exactly one cohort per page and supplies one latest
 * snapshot per payment. One positive provider-export success is one paid order;
 * use a single order-normalised payment record, not separate retries/installments.
 * Money is integer minor units 0..1e9; <=5000 records keeps all sums exactly safe.
 * Evidence labels are trusted input, not authentication or independent verification.
 */
export function analyseAcquisition(document) {
  validate(document);
  const { cohort: c, traffic: t } = document;
  const pages = new Map(document.pages.map(page => [page.pageId, {
    pageId: page.pageId, stage: page.stage, freeAccepted: page.freeAccepted,
    paidOrders: 0, grossRevenueMinor: 0, refundMinor: 0, netRevenueMinor: 0,
    directCostsMinor: 0, directCostsByCategory: Object.fromEntries(CATEGORIES.map(key => [key, 0])),
  }]));
  const businessByPage = new Map(document.pages.map(page => [page.pageId, page.businessId]));
  const payingBusinesses = new Map();
  let firstPaidAt = null, excludedPaymentSnapshots = 0;
  for (const payment of document.payments) {
    if (payment.evidenceKind !== 'provider_export' || payment.status !== 'succeeded' || payment.amountMinor <= 0) {
      excludedPaymentSnapshots++;
      continue;
    }
    const page = pages.get(payment.pageId), net = payment.amountMinor - payment.refundMinor;
    page.paidOrders++; page.grossRevenueMinor += payment.amountMinor;
    page.refundMinor += payment.refundMinor; page.netRevenueMinor += net;
    const business = businessByPage.get(payment.pageId);
    payingBusinesses.set(business, (payingBusinesses.get(business) ?? 0) + net);
    const occurredAt = Date.parse(payment.occurredAt);
    firstPaidAt = firstPaidAt === null ? occurredAt : Math.min(firstPaidAt, occurredAt);
  }
  const costsByCategory = Object.fromEntries(CATEGORIES.map(key => [key, 0]));
  let commonCostsMinor = 0;
  for (const cost of document.costs) {
    costsByCategory[cost.category] += cost.amountMinor;
    if (cost.pageId === null) commonCostsMinor += cost.amountMinor;
    else {
      const page = pages.get(cost.pageId);
      page.directCostsMinor += cost.amountMinor;
      page.directCostsByCategory[cost.category] += cost.amountMinor;
    }
  }
  const perPage = [...pages.values()].sort((a, b) => a.pageId < b.pageId ? -1 : a.pageId > b.pageId ? 1 : 0);
  const sum = key => perPage.reduce((amount, page) => amount + page[key], 0);
  const suppliedCostsMinor = Object.values(costsByCategory).reduce((a, b) => a + b, 0);
  const acquisitionCostsMinor = ACQUISITION_COSTS.reduce((sum, key) => sum + costsByCategory[key], 0);
  const knownAcquisitionSpendMinor = (t.adSpendMinor ?? 0) + acquisitionCostsMinor;
  const acquisitionSpendMinor = document.costsComplete && t.adSpendMinor !== null ? knownAcquisitionSpendMinor : null;
  const grossRevenueMinor = sum('grossRevenueMinor'), refundMinor = sum('refundMinor');
  const netRevenueMinor = grossRevenueMinor - refundMinor, paidOrders = sum('paidOrders');
  let bankInMinor = 0, bankOutMinor = 0;
  for (const entry of document.cashEntries) {
    if (entry.direction === 'in') bankInMinor += entry.amountMinor;
    else bankOutMinor += entry.amountMinor;
  }
  const stages = Object.fromEntries(STAGES.map((stage, index) => [stage,
    document.pages.filter(page => STAGES.indexOf(page.stage) >= index).length]));
  const total = {
    pages: perPage.length, stages, freeAcceptedPages: document.pages.filter(page => page.freeAccepted).length,
    paidOrders, payingBusinesses: payingBusinesses.size,
    retainedNetPositiveBusinesses: [...payingBusinesses.values()].filter(net => net > 0).length,
    grossRevenueMinor, refundMinor, netRevenueMinor, excludedPaymentSnapshots,
    adSpendMinor: t.adSpendMinor, costsByCategory, suppliedCostsMinor, commonCostsMinor,
    knownCostSubtotalMinor: suppliedCostsMinor + (t.adSpendMinor ?? 0),
    knownCostSubtotalIncomplete: !document.costsComplete || t.adSpendMinor === null,
    knownAcquisitionSpendMinor, acquisitionSpendMinor,
    contributionMinor: document.costsComplete && t.adSpendMinor !== null
      ? netRevenueMinor - t.adSpendMinor - suppliedCostsMinor : null,
    bankInMinor, bankOutMinor, observedBankNetMovementMinor: bankInMinor - bankOutMinor,
    bankNetMovementMinor: document.cashComplete ? bankInMinor - bankOutMinor : null,
  };
  const ad = c.channel === 'paid_ads';
  const metrics = {
    cpmMinor: ad && t.adSpendMinor !== null ? ratio(t.adSpendMinor * 1000, t.impressions) : null,
    ctr: ad ? ratio(t.clicks, t.impressions) : null,
    cpcMinor: ad ? ratio(t.adSpendMinor, t.clicks) : null,
    paidOrdersPerClick: ratio(paidOrders, t.clicks),
    grossAovMinor: ratio(grossRevenueMinor, paidOrders),
    adCpaMinor: ad ? ratio(t.adSpendMinor, paidOrders) : null,
    grossRoas: ad ? ratio(grossRevenueMinor, t.adSpendMinor) : null,
    netRoas: ad ? ratio(netRevenueMinor, t.adSpendMinor) : null,
    cacMinor: ratio(acquisitionSpendMinor, payingBusinesses.size),
    daysToFirstPaidOrder: firstPaidAt === null ? null : (firstPaidAt - Date.parse(c.periodStart)) / 86_400_000,
  };
  return {
    schemaVersion: '1.0.0', status: 'descriptive_only', spendChanged: false, routingChanged: false,
    paymentEvidence: 'supplied_not_independently_verified', cohortId: c.cohortId, campaignId: c.campaignId,
    channel: c.channel, currency: c.currency, periodStart: c.periodStart, periodEnd: c.periodEnd, asOf: c.asOf,
    traffic: { ...t },
    readiness: {
      trackingComplete: c.trackingComplete, attributionWindowClosed: c.attributionWindowClosed,
      costsComplete: document.costsComplete, cashComplete: document.cashComplete,
      metricsBasis: c.trackingComplete ? 'supplied_observations' : 'incomplete_observations',
      economicsActionable: false,
    },
    total, perPage, metrics, findings: findingsFor(document, total, metrics),
    limitations: [
      'Trusted de-identified input is supplied, not independently verified, authenticated or cryptographically verified.',
      'One latest order-normalised payment snapshot is one paid order; positive provider-export successes alone count. Retries or installments must not be separate orders.',
      'Webhook observations, pending/failed snapshots, free acceptance and page stages are not successful payments.',
      'Each page has one upstream-selected cohort attribution. This report makes no multiple-touch or causal claims.',
      'Gross/net revenue records payment success and cumulative refunds; independent bank movements alone describe cash. Provider availability is not bank cash.',
      'Known-cost subtotals are incomplete when supplied costs or ad spend are unknown; CAC includes acquisition work for nonbuyers. Contribution is not company profit.',
      'costsComplete must include committed fulfilment costs for counted orders, not only costs already paid.',
      'cacMinor is acquisition spend per distinct paying business; it is new-customer CAC only if every paying business is newly acquired, which this schema cannot establish.',
      'Per-page costs are direct allocations only; common cohort costs and ad spend are not allocated to pages and no per-page profit is inferred.',
      'Findings compare only supplied benchmarks and thresholds, describe possible checks, and establish no proven cause, winner or scale decision.',
      'Incomplete tracking or an open attribution window suppresses economic findings. No spending, routing, pricing or checkout action is performed.',
      'Only campaign, cohort and page mapping identifiers are emitted; private ledger and business identifiers are omitted.',
    ],
  };
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
    if (size > MAX_BYTES) fail();
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer.subarray(0, size));
  } finally { closeSync(fd); }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length !== 3) {
    process.stderr.write('Usage: node tools/diagnostic/analyse-acquisition.mjs deidentified-export.json\n');
    process.exitCode = 2;
  } else {
    try {
      const report = analyseAcquisition(JSON.parse(readBounded(process.argv[2])));
      process.stdout.write(JSON.stringify(report, null, 2) + '\n');
    } catch {
      // Never echo parser fragments, paths or supplied customer/ledger data.
      process.stderr.write('Acquisition analysis failed: unreadable export, invalid JSON, size limit or de-identified schema mismatch.\n');
      process.exitCode = 1;
    }
  }
}
