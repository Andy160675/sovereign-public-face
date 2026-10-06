import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { analyseAcquisition } from '../../tools/diagnostic/analyse-acquisition.mjs';
const fixture = JSON.parse(readFileSync(new URL('./fixtures/acquisition.synthetic.json', import.meta.url)));
const doc = () => structuredClone(fixture);
const codes = report => report.findings.map(finding => finding.code);
const cli = fileURLToPath(new URL('../../tools/diagnostic/analyse-acquisition.mjs', import.meta.url));
function runInput(input) {
  const directory = mkdtempSync(join(tmpdir(), 'acquisition-test-'));
  try {
    const path = join(directory, 'export.json');
    writeFileSync(path, input);
    return spawnSync(process.execPath, [cli, path], {encoding:'utf8',timeout:5000});
  } finally { rmSync(directory, {recursive:true,force:true}); }
}

test('paid ads arithmetic preserves CPM/CTR/CPC/CPA/ROAS identities', () => {
  const {metrics:m,total:t} = analyseAcquisition(doc());
  assert.equal(m.cpmMinor,1000); assert.equal(m.ctr,0.01); assert.equal(m.cpcMinor,100);
  assert.equal(m.paidOrdersPerClick,0.02); assert.equal(m.adCpaMinor,5000);
  assert.equal(m.grossAovMinor,15000); assert.equal(m.grossRoas,3); assert.equal(m.netRoas,3);
  assert.equal(m.cpcMinor,m.cpmMinor/(1000*m.ctr));
  assert.equal(m.adCpaMinor,m.cpcMinor/m.paidOrdersPerClick);
  assert.equal(m.grossRoas,m.grossAovMinor/m.adCpaMinor);
  assert.equal(t.grossRevenueMinor,30000);
});
test('three times ROAS can still lose money and includes nonbuyer acquisition costs', () => {
  const r=analyseAcquisition(doc());
  assert.equal(r.total.contributionMinor,-10000); assert.equal(r.total.acquisitionSpendMinor,15000);
  assert.equal(r.total.suppliedCostsMinor,30000); assert.equal(r.total.commonCostsMinor,3000);
  assert.ok(codes(r).includes('negative_contribution'));
  assert.equal(r.perPage.find(p=>p.pageId==='page_c').directCostsMinor,1000);
  assert.ok(r.perPage.every(p=>!Object.hasOwn(p,'profitMinor')));
});
test('multiple paid pages for one business mean two orders and one customer for CAC', () => {
  const r=analyseAcquisition(doc());
  assert.equal(r.total.paidOrders,2); assert.equal(r.total.payingBusinesses,1);
  assert.equal(r.total.retainedNetPositiveBusinesses,1); assert.equal(r.metrics.cacMinor,15000);
  assert.equal(r.metrics.daysToFirstPaidOrder,2);
});
test('free acceptance and cumulative page stages remain independent of payment', () => {
  const input=doc(); input.payments=[];
  const r=analyseAcquisition(input);
  assert.equal(r.total.freeAcceptedPages,2); assert.equal(r.total.paidOrders,0);
  assert.deepEqual(r.total.stages,{delivered:3,visited:3,service_selected:2,checkout_started:1});
  assert.ok(codes(r).includes('no_paid_orders')); assert.equal(r.metrics.adCpaMinor,null);
});
test('refund snapshots keep paid orders while reducing net revenue and retained businesses', () => {
  const input=doc(); input.payments.forEach(p=>p.refundMinor=p.amountMinor);
  const r=analyseAcquisition(input);
  assert.equal(r.total.paidOrders,2); assert.equal(r.total.netRevenueMinor,0);
  assert.equal(r.total.payingBusinesses,1); assert.equal(r.total.retainedNetPositiveBusinesses,0);
  assert.equal(r.metrics.netRoas,0); assert.equal(r.metrics.grossRoas,3);
});
test('pending failed and record-only webhook observations never count as sales', () => {
  const input=doc();
  input.payments[0]={...input.payments[0],status:'pending',amountMinor:0};
  input.payments[1]={...input.payments[1],status:'failed',amountMinor:0};
  input.payments.push({...fixture.payments[0],paymentId:'observation',evidenceRef:'observation_ref',evidenceKind:'webhook_observation'});
  const r=analyseAcquisition(input);
  assert.equal(r.total.paidOrders,0); assert.equal(r.total.grossRevenueMinor,0);
  assert.equal(r.total.excludedPaymentSnapshots,3);
});
test('bank cash is independent of provider revenue and availability', () => {
  const input=doc(); input.cashEntries.push({...input.cashEntries[0],entryId:'bank_out',evidenceRef:'bank_out_ref',direction:'out',amountMinor:2000});
  const r=analyseAcquisition(input);
  assert.equal(r.total.bankNetMovementMinor,7000); assert.equal(r.total.netRevenueMinor,30000);
});
test('missing expenses or bank completeness cannot imply profit or reconciled cash', () => {
  const input=doc(); input.costsComplete=false; input.cashComplete=false;
  const r=analyseAcquisition(input);
  assert.equal(r.total.contributionMinor,null); assert.equal(r.total.acquisitionSpendMinor,null);
  assert.equal(r.metrics.cacMinor,null); assert.equal(r.total.knownAcquisitionSpendMinor,15000);
  assert.equal(r.total.bankNetMovementMinor,null); assert.equal(r.total.observedBankNetMovementMinor,9000);
  assert.ok(codes(r).includes('incomplete_costs')); assert.ok(!codes(r).includes('negative_contribution'));
});
test('unknown and zero traffic denominators remain null', () => {
  for (const value of [null,0]) {
    const input=doc(); input.traffic={impressions:value,clicks:value,adSpendMinor:null};
    const r=analyseAcquisition(input);
    for (const key of ['cpmMinor','ctr','cpcMinor','paidOrdersPerClick','adCpaMinor','grossRoas','netRoas']) assert.equal(r.metrics[key],null);
    assert.equal(r.total.contributionMinor,null); assert.equal(r.total.acquisitionSpendMinor,null);
  }
});
test('email and organic exports retain click conversion but no ad economics', () => {
  for (const channel of ['email','organic']) {
    const input=doc(); input.cohort.channel=channel; input.traffic.adSpendMinor=0;
    const r=analyseAcquisition(input);
    for (const key of ['cpmMinor','ctr','cpcMinor','adCpaMinor','grossRoas','netRoas']) assert.equal(r.metrics[key],null);
    assert.equal(r.metrics.paidOrdersPerClick,0.02); assert.equal(r.metrics.cacMinor,5000);
    input.traffic.adSpendMinor=1; assert.throws(()=>analyseAcquisition(input));
    input.traffic.adSpendMinor=null; assert.throws(()=>analyseAcquisition(input));
  }
});
test('each currency is supported separately and mixed currency is rejected', () => {
  for (const currency of ['GBP','EUR','USD']) {
    const input=doc(); input.cohort.currency=currency;
    for (const rows of [input.payments,input.costs,input.cashEntries]) rows.forEach(r=>r.currency=currency);
    assert.equal(analyseAcquisition(input).currency,currency);
    input.payments[0].currency=currency==='GBP'?'EUR':'GBP'; assert.throws(()=>analyseAcquisition(input));
  }
});
test('duplicates and unknown foreign keys fail instead of inflating evidence', () => {
  for (const key of ['pages','payments','costs','cashEntries']) {
    const input=doc(); input[key].push({...input[key][0]}); assert.throws(()=>analyseAcquisition(input));
  }
  for (const key of ['payments','cashEntries']) {
    const input=doc(); const row={...input[key][0]}; row[key==='payments'?'paymentId':'entryId']='new_id';
    input[key].push(row); assert.throws(()=>analyseAcquisition(input));
  }
  for (const key of ['payments','costs']) { const input=doc(); input[key][0].pageId='unknown_page'; assert.throws(()=>analyseAcquisition(input)); }
});
test('invalid timestamps and out-of-period monetary observations fail', () => {
  for (const value of ['2026-02-30T00:00:00.000Z','2026-01-03','2026-01-03T00:00:00Z','2026-01-03T00:00:00.000+00:00','2025-12-31T23:59:59.999Z','2026-02-08T00:00:00.000Z']) {
    for (const key of ['payments','cashEntries']) { const input=doc(); input[key][0].occurredAt=value; assert.throws(()=>analyseAcquisition(input)); }
  }
  for (const patch of [{periodEnd:'2025-12-31T00:00:00.000Z'},{asOf:'2026-01-01T00:00:00.000Z'}]) {
    const input=doc(); Object.assign(input.cohort,patch); assert.throws(()=>analyseAcquisition(input));
  }
});
test('inconsistent refund and non-success money states fail', () => {
  for (const patch of [{refundMinor:15001},{status:'pending'},{status:'failed',amountMinor:0,refundMinor:1}]) {
    const input=doc(); Object.assign(input.payments[0],patch); assert.throws(()=>analyseAcquisition(input));
  }
});
test('strict exact-key schema rejects PII and missing fields at every level', () => {
  const selectors=[x=>x,x=>x.cohort,x=>x.traffic,x=>x.pages[0],x=>x.payments[0],x=>x.costs[0],x=>x.cashEntries[0],x=>x.comparison];
  for (const select of selectors) {
    const input=doc(); select(input).email='sensitive@example.invalid'; assert.throws(()=>analyseAcquisition(input));
    const missing=doc(); delete select(missing)[Object.keys(select(missing))[0]]; assert.throws(()=>analyseAcquisition(missing));
  }
});
test('money count identifiers enums booleans and benchmarks have bounded types', () => {
  for (const value of [-1,1.5,Infinity,NaN,'100',null,1000000001]) {
    const input=doc(); input.costs[0].amountMinor=value; assert.throws(()=>analyseAcquisition(input));
  }
  for (const value of ['private@example.invalid','with space','','x'.repeat(65)]) {
    const input=doc(); input.pages[0].businessId=value; assert.throws(()=>analyseAcquisition(input));
  }
  for (const mutate of [x=>x.traffic.clicks=-1,x=>x.traffic.impressions=1.5,x=>x.cohort.trackingComplete='true',x=>x.pages[0].freeAccepted=1,x=>x.pages[0].stage='lead',x=>x.comparison.minimumClicks=0,x=>x.comparison.ctr=1.01,x=>x.comparison.netRoas=-1,x=>x.schemaVersion='2',x=>x.costs[0].category='profit']) {
    const input=doc(); mutate(input); assert.throws(()=>analyseAcquisition(input));
  }
});
test('5000 total records bound applies across all four ledgers', () => {
  const input=doc(); input.costs=Array.from({length:4996},(_,i)=>({...fixture.costs[0],costId:`cost_${i}`}));
  assert.throws(()=>analyseAcquisition(input));
});
test('tracking and open attribution window suppress benchmark conclusions', () => {
  for (const field of ['trackingComplete','attributionWindowClosed']) {
    const input=doc(); input.cohort[field]=false;
    const r=analyseAcquisition(input);
    assert.equal(r.readiness.economicsActionable,false);
    assert.deepEqual(codes(r),[field==='trackingComplete'?'incomplete_tracking':'await_conversion_data']);
  }
});
test('small samples and absent benchmarks suppress ratio findings', () => {
  const input=doc(); Object.assign(input.comparison,{minimumImpressions:20000,minimumClicks:200,minimumPaidOrders:3});
  assert.deepEqual(codes(analyseAcquisition(input)),['negative_contribution']);
  const empty=doc(); for (const key of Object.keys(empty.comparison)) if(!key.startsWith('minimum')) empty.comparison[key]=null;
  assert.deepEqual(codes(analyseAcquisition(empty)),['negative_contribution']);
});
test('each finding follows only its supplied benchmark and relevant sample', () => {
  const r=analyseAcquisition(doc());
  assert.deepEqual(codes(r),['high_cpm','low_ctr','high_cpc','low_paid_order_rate','high_ad_cpa','low_net_roas','negative_contribution']);
  assert.ok(r.findings.every(f=>typeof f.possibleChecks==='string'));
  const input=doc(); input.comparison.minimumPaidOrders=3;
  const result=codes(analyseAcquisition(input));
  assert.ok(!result.includes('high_ad_cpa')); assert.ok(!result.includes('low_net_roas'));
  assert.ok(result.includes('low_paid_order_rate'));
});
test('repeat paid orders permit an orders-per-click benchmark above one', () => {
  const input=doc(); input.traffic.clicks=1;
  input.comparison.minimumClicks=1; input.comparison.paidOrderRatePerClick=1.5;
  const report=analyseAcquisition(input);
  assert.equal(report.metrics.paidOrdersPerClick,2);
  assert.ok(!codes(report).includes('low_paid_order_rate'));
  input.comparison.paidOrderRatePerClick=2.5;
  assert.ok(codes(analyseAcquisition(input)).includes('low_paid_order_rate'));
});
test('deterministic report leaves input untouched and only emits mapping identifiers', () => {
  const input=doc(); const before=JSON.stringify(input); const r=analyseAcquisition(input);
  assert.deepEqual(analyseAcquisition(input),r); assert.equal(JSON.stringify(input),before);
  const output=JSON.stringify(r); assert.doesNotMatch(output,/private_|businessId|paymentId|evidenceRef|costId|entryId/);
  assert.equal(r.cohortId,'cohort_demo'); assert.equal(r.campaignId,'campaign_demo');
  assert.equal(r.status,'descriptive_only'); assert.equal(r.spendChanged,false); assert.equal(r.routingChanged,false);
  assert.equal(r.paymentEvidence,'supplied_not_independently_verified');
  assert.match(r.limitations.join(' '),/one paid order/i); assert.match(r.limitations.join(' '),/causal/i);
});
test('real CLI emits private aggregate report for synthetic export', () => {
  const run=runInput(JSON.stringify(doc())); assert.equal(run.status,0); assert.equal(run.stderr,'');
  assert.equal(JSON.parse(run.stdout).total.paidOrders,2); assert.doesNotMatch(run.stdout,/private_/);
});
test('real CLI malformed truncated schema-invalid and oversized failures never echo input', () => {
  for (const input of ['{"email":"sensitive@example.invalid",BAD}',JSON.stringify(doc()).slice(0,-2),JSON.stringify({...doc(),email:'sensitive@example.invalid'}),'x'.repeat(2*1024*1024+1)]) {
    const run=runInput(input); assert.equal(run.status,1); assert.equal(run.stdout,'');
    assert.doesNotMatch(run.stderr,/sensitive|example.invalid|email|export.json/); assert.match(run.stderr,/analysis failed/);
  }
});
test('real CLI requires exactly one path and hides unreadable paths', () => {
  for (const args of [[],['one','two']]) {
    const run=spawnSync(process.execPath,[cli,...args],{encoding:'utf8'});
    assert.equal(run.status,2); assert.equal(run.stdout,''); assert.match(run.stderr,/Usage:/);
  }
  const run=spawnSync(process.execPath,[cli,'sensitive-missing-path'],{encoding:'utf8'});
  assert.equal(run.status,1); assert.doesNotMatch(run.stderr,/sensitive-missing-path/);
});
