import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { assessCommercial, analyseCommercial } from '../../tools/diagnostic/commercial-controls.mjs';
const sorted = x => Array.isArray(x) ? x.map(sorted) : x && typeof x==='object' ? Object.fromEntries(Object.keys(x).sort().map(k=>[k,sorted(x[k])])) : x;
const digest = x => createHash('sha256').update(JSON.stringify(sorted(x))).digest('hex');
const clone = x => JSON.parse(JSON.stringify(x));
function fixture() {
  const d = {schemaVersion:'1.0.0', asOf:'2026-10-06', currency:'EUR', evidence:[],
    distribution:{partners:[],owned:[]}, capabilities:[],jobs:[],
    treasury:{reconciled:true,clearedMinor:100000,essentialMinor:10000,otherRefundReserveMinor:0,
      otherCommitmentsMinor:0,protectedRunwayMinor:20000,refundReservedMinor:0,
      authorisedLossLimitMinor:20000,authorisedRefundLimitMinor:20000,lossSpentMinor:0,recordRef:null,budgetRef:null},
    experiment:{permissionBreach:false,misleadingClaim:false,dataExposure:false,brokenFulfilment:false,
      guaranteeBreach:false,unspentAdCapMinor:0,spendLimitReached:false,trackingComplete:true,
      windowClosed:true,contacts:10,replies:0,baselineReplyProbability:0.05,
      repeatedFindingRef:null}};
  return seal(d);
}
function record(d, id, purpose, subjectId, payload, kind='observed_result', status='recorded', on=d.asOf) {
  d.evidence = d.evidence.filter(e => e.id!==id);
  d.evidence.push({id,kind,status,purpose,subjectId,payloadHash:digest(payload),recordedOn:on,validUntil:'2027-01-01'});
  return id;
}
function seal(d) {
  const {recordRef,budgetRef,...cash}=d.treasury;
  d.treasury.recordRef=record(d,'cash','reconciled_risk_budget','treasury',{currency:d.currency,...cash});
  d.treasury.budgetRef=record(d,'budget','risk_budget','treasury',{currency:d.currency,lossLimitMinor:cash.authorisedLossLimitMinor,refundLimitMinor:cash.authorisedRefundLimitMinor},'contractual_commitment','accepted');
  return d;
}
function capable(d) {
  const c={id:'worker1',artifactHash:'a'.repeat(64),producerId:'producer1',verifierId:'verifier1',
    routineHumanMinutes:0,founderMinutes:0,capacity:2,inFlight:0,proofRef:null};
  c.proofRef=record(d,'cap','qualified_capacity',c.id,without(c,'proofRef'));
  d.capabilities.push(c); return c;
}
function without(x,...keys) {return Object.fromEntries(Object.entries(x).filter(([k])=>!keys.includes(k)));}
function job(d) {
  capable(d);
  const j={id:'job1',capabilityId:'worker1',acceptedOn:'2026-10-06',terms:{version:'1',currency:'EUR',
    feeMinor:10000,thirdPartyMinor:1000,customerCostMinor:0,metric:'cost_saved',baselineId:'base1',methodId:'method1',
    measurementDays:14,cureWorkingDays:5,maxPauseDays:7,decisionDays:7,remedyCapMinor:10000,
    thirdPartyCostsDisclosed:true,customerObligationsAgreed:true,mandatoryRightsPreserved:true,
    paymentMode:'pay_after_value',calendarTimeZone:'Atlantic/Canary',holidays:[]},termsRef:null,
    activation:null,pauses:[],result:null,collectedMinor:0,refundedMinor:0,unspentWorstCaseMinor:2000};
  j.termsRef=record(d,'terms','job_terms',j.id,j.terms,'contractual_commitment','accepted');
  d.jobs.push(j);return j;
}
function activate(d,j) {
  const a={on:'2026-10-06',inputsReady:true,accessReady:true,baselineReady:true,proofRef:null};
  a.proofRef=record(d,'activation','verified_activation',j.id,{termsHash:digest(j.terms),...without(a,'proofRef')});
  j.activation=a;return j;
}
function result(d,j,benefit=11001) {
  const r={on:d.asOf,amountMinor:benefit,metric:j.terms.metric,baselineId:'base1',methodId:'method1',
    resultHash:'b'.repeat(64),qualityPassed:true,producerId:'p1',verifierId:'v1',evidenceRef:null};
  r.evidenceRef=record(d,'result','measured_checked_value',j.id,{termsHash:digest(j.terms),...without(r,'evidenceRef')});
  j.result=r;return j;
}
function partner(d) {
  const p={id:'partner1',namedContact:true,reachable:true,permissionRef:null,agreementRef:null};
  const payload=without(p,'permissionRef','agreementRef');
  p.permissionRef=record(d,'permission','contact_permission',p.id,payload);
  p.agreementRef=record(d,'agreement','distribution_agreement',p.id,payload,'contractual_commitment','accepted');
  d.distribution.partners.push(p);return p;
}
function owned(d,reach=null) {
  const o={id:'channel1',connected:true,relevantReach:reach,permissionRef:null,reachRef:null};
  const payload=without(o,'permissionRef','reachRef');
  o.permissionRef=record(d,'publish','publishing_permission',o.id,payload);
  if(reach!==null)o.reachRef=record(d,'reach','audience_reach',o.id,payload);
  d.distribution.owned.push(o);return o;
}
function pause(d,j,start,end=null,cause='customer') {
  const p={start,end,cause,dependencyId:'input1',noticeRef:null};
  p.noticeRef=record(d,'notice'+j.pauses.length,'dependency_notice',j.id,{termsHash:digest(j.terms),...without(p,'noticeRef')},'observed_result','recorded',start);
  j.pauses.push(p);return p;
}
test('empty distribution is building, not fictional activation or zero reach',()=>{
 const r=assessCommercial(fixture());assert.equal(r.distribution.stage,'BUILD_DISTRIBUTION');
 assert.equal(r.distribution.relevantReach,null);assert.equal(r.authority,'NONE');assert.deepEqual(r.founderTasks,[]);
});
test('connected account is not measured business reach',()=>{const d=fixture();owned(d);assert.equal(assessCommercial(d).distribution.relevantReach,null);});
test('zero measured reach remains zero',()=>{const d=fixture();owned(d,0);assert.equal(assessCommercial(d).distribution.relevantReach,0);assert.equal(assessCommercial(d).distribution.stage,'BUILD_DISTRIBUTION');});
test('permission and accepted agreement admit a partner to planning',()=>{const d=fixture();partner(d);assert.equal(assessCommercial(d).distribution.eligiblePartnerCount,1);});
for(const change of ['draft','missing_permission','wrong_purpose','wrong_hash','future','expired'])test('partner refuses '+change,()=>{
 const d=fixture();const p=partner(d);const e=d.evidence.find(e=>e.id==='agreement');
 if(change==='draft')e.status='draft';if(change==='missing_permission')p.permissionRef=null;
 if(change==='wrong_purpose')e.purpose='something_else';if(change==='wrong_hash')e.payloadHash='f'.repeat(64);
 if(change==='future')e.recordedOn='2026-10-07';if(change==='expired'){e.recordedOn='2026-10-05';e.validUntil=d.asOf;}
 assert.equal(assessCommercial(d).distribution.eligiblePartnerCount,0);
});
test('qualified automation yields capacity without founder assignment',()=>{const d=fixture();capable(d);const r=assessCommercial(d);assert.equal(r.capacity.availableSlots,2);assert.deepEqual(r.founderTasks,[]);});
for(const change of ['founder','human','same_identity','stale_proof','full'])test('capacity refuses '+change,()=>{
 const d=fixture(),c=capable(d);if(change==='founder')c.founderMinutes=1;
 if(change==='human')c.routineHumanMinutes=1;if(change==='same_identity')c.verifierId=c.producerId;
 if(change==='full')c.inFlight=c.capacity;if(change==='stale_proof')c.artifactHash='f'.repeat(64);
 // Rebind evidence except for deliberate stale-proof case; the policy must still refuse.
 if(change!=='stale_proof')record(d,'cap','qualified_capacity',c.id,without(c,'proofRef'));
 assert.equal(assessCommercial(d).capacity.availableSlots,0);
});
test('accepted but unactivated job earns nothing',()=>{const d=fixture();job(d);assert.equal(assessCommercial(d).jobs[0].status,'AWAITING_INPUTS');});
test('fee has no 750 floor and equal benefit is not positive ROI',()=>{
 const d=fixture(),j=activate(d,job(d));result(d,j,11000);assert.equal(assessCommercial(d).jobs[0].feeEarnedMinor,0);
 result(d,j,11001);assert.equal(assessCommercial(d).jobs[0].feeEarnedMinor,10000);
});
test('third-party costs are in the investment but not work-fee refund',()=>{
 const d=fixture(),j=activate(d,job(d));j.terms.paymentMode='prepaid';record(d,'terms','job_terms',j.id,j.terms,'contractual_commitment','accepted');activate(d,j);
 j.collectedMinor=10000;d.asOf='2026-10-20';seal(d);const r=assessCommercial(d).jobs[0];
 assert.equal(r.refundDueMinor,10000);assert.equal(r.totalInvestmentMinor,11000);
});
test('waiver is not a payment or cash event',()=>{const d=fixture();activate(d,job(d));d.asOf='2026-10-20';seal(d);
 const r=assessCommercial(d);assert.equal(r.jobs[0].status,'WAIVE_FEE');assert.equal(r.jobs[0].feeEarnedMinor,0);assert.equal(r.cashChanged,false);});
test('hypothesis evidence cannot demonstrate return',()=>{const d=fixture(),j=activate(d,job(d));result(d,j);d.evidence.find(e=>e.id==='result').kind='hypothesis';assert.equal(assessCommercial(d).jobs[0].feeEarnedMinor,0);});
test('quality pass alone cannot earn fee',()=>{const d=fixture(),j=activate(d,job(d));result(d,j,0);assert.equal(assessCommercial(d).jobs[0].feeEarnedMinor,0);});
test('financial benefit without independent quality cannot earn fee',()=>{const d=fixture(),j=activate(d,job(d));result(d,j);j.result.verifierId=j.result.producerId;record(d,'result','measured_checked_value',j.id,{termsHash:digest(j.terms),...without(j.result,'evidenceRef')});assert.equal(assessCommercial(d).jobs[0].feeEarnedMinor,0);});
test('expired present capacity does not erase accepted historical guarantee',()=>{
 const d=fixture(),j=activate(d,job(d));result(d,j);d.evidence.find(e=>e.id==='terms').validUntil='2026-10-07';
 d.evidence.find(e=>e.id==='cap').validUntil='2026-10-07';d.asOf='2026-10-08';seal(d);
 const r=assessCommercial(d);assert.equal(r.jobs[0].feeEarnedMinor,10000);assert.equal(r.capacity.availableSlots,0);
});
test('customer interruption cures or ends; never auto-earns',()=>{
 const d=fixture(),j=activate(d,job(d));pause(d,j,'2026-10-07');d.asOf='2026-10-10';seal(d);
 assert.equal(assessCommercial(d).jobs[0].status,'AWAITING_CUSTOMER');d.asOf='2026-10-14';seal(d);
 const r=assessCommercial(d).jobs[0];assert.equal(r.status,'WAIVE_FEE');assert.equal(r.feeEarnedMinor,0);assert.equal(r.decisionDueOn,'2026-10-21');
});
test('supplier failure does not extend the guarantee',()=>{const d=fixture(),j=activate(d,job(d));pause(d,j,'2026-10-07',null,'vipfish');d.asOf='2026-10-20';seal(d);assert.equal(assessCommercial(d).jobs[0].measurementEndsOn,'2026-10-20');});
test('resolved customer pause extends only actual elapsed days',()=>{const d=fixture(),j=activate(d,job(d));pause(d,j,'2026-10-07','2026-10-09');d.asOf='2026-10-10';seal(d);assert.equal(assessCommercial(d).jobs[0].measurementEndsOn,'2026-10-22');});
test('repeated pauses share a seven-day cap',()=>{const d=fixture(),j=activate(d,job(d));pause(d,j,'2026-10-07','2026-10-11');pause(d,j,'2026-10-12');d.asOf='2026-10-16';seal(d);assert.equal(assessCommercial(d).jobs[0].status,'WAIVE_FEE');assert.equal(assessCommercial(d).jobs[0].measurementEndsOn,'2026-10-27');});
test('holiday calendar does not extend seven-day maximum',()=>{const d=fixture(),j=job(d);j.terms.holidays=['2026-10-08','2026-10-09'];record(d,'terms','job_terms',j.id,j.terms,'contractual_commitment','accepted');activate(d,j);pause(d,j,'2026-10-07');d.asOf='2026-10-14';seal(d);assert.equal(assessCommercial(d).jobs[0].status,'WAIVE_FEE');});
test('post-payment terms reject early collections',()=>{const d=fixture(),j=activate(d,job(d));j.collectedMinor=100;assert.equal(assessCommercial(d).decision.class,'STOP');});
test('accepted contract does not silently become draft or vanish',()=>{const d=fixture();job(d);d.evidence.find(e=>e.id==='terms').status='draft';assert.equal(assessCommercial(d).jobs[0].status,'CONTRACT_UNVERIFIED');assert.equal(assessCommercial(d).risk.refundExposureMinor,0);});
test('all-fail budget includes prepaid and unpaid work plus ad cap',()=>{const d=fixture();job(d);d.experiment.unspentAdCapMinor=3000;const r=assessCommercial(d);assert.equal(r.risk.unspentWorstCaseMinor,5000);assert.equal(r.risk.additionalLossCapacityMinor,15000);});
test('refund reserve cannot also fund losses',()=>{const d=fixture();d.treasury.clearedMinor=40000;d.treasury.refundReservedMinor=10000;seal(d);assert.equal(assessCommercial(d).risk.freeCashMinor,0);});
test('refund exposure survives an unverified contract',()=>{const d=fixture(),j=job(d);j.collectedMinor=10000;d.evidence.find(e=>e.id==='terms').status='draft';assert.equal(assessCommercial(d).risk.refundExposureMinor,10000);assert.equal(assessCommercial(d).decision.class,'STOP');});
for(const field of ['clearedMinor','essentialMinor','authorisedLossLimitMinor','refundReservedMinor'])test('unknown treasury '+field+' does not become zero',()=>{const d=fixture();d.treasury[field]=null;seal(d);const r=assessCommercial(d);assert.equal(r.risk.additionalLossCapacityMinor,0);assert.equal(r.risk.status,'UNVERIFIED');});
test('unverified cash cannot fund zero-risk-labelled paid ads',()=>{const d=fixture();d.treasury.recordRef=null;d.experiment.unspentAdCapMinor=100;assert.equal(assessCommercial(d).decision.class,'PAUSE');});
test('zero replies remains directional, not automatic pivot',()=>{const d=fixture();capable(d);const r=assessCommercial(d);assert.equal(r.experiment.zeroReplyProbability,0.95**10);assert.equal(r.experiment.interpretation,'DIRECTIONAL_ONLY');assert.notEqual(r.decision.class,'CHANGE_HYPOTHESIS');});
test('stop takes precedence over pause',()=>{const d=fixture();d.experiment.permissionBreach=true;d.experiment.spendLimitReached=true;assert.equal(assessCommercial(d).decision.class,'STOP');});
test('cost ceiling reached pauses, not market rejection',()=>{const d=fixture();capable(d);d.experiment.spendLimitReached=true;assert.equal(assessCommercial(d).decision.class,'PAUSE');});
test('verified repeated finding permits hypothesis change only with closed tracking window',()=>{const d=fixture();capable(d);d.experiment.repeatedFindingRef=record(d,'finding','repeated_commercial_finding','experiment',without(d.experiment,'repeatedFindingRef'));assert.equal(assessCommercial(d).decision.class,'CHANGE_HYPOTHESIS');d.experiment.windowClosed=false;assert.notEqual(assessCommercial(d).decision.class,'CHANGE_HYPOTHESIS');});
for(const edit of [d=>d.secret='leak',d=>d.currency='BTC',d=>d.asOf='2026-02-30',d=>d.treasury.clearedMinor=-1,d=>d.treasury.clearedMinor=Number.MAX_SAFE_INTEGER,d=>d.evidence.push({...d.evidence[0]}),d=>d.treasury.reconciled='true'])test('strict schema rejects invalid input without echoing it',()=>{const d=fixture();edit(d);assert.throws(()=>assessCommercial(d),{message:'Invalid commercial controls input.'});});
test('guarantee amount/currency cannot be changed behind accepted terms',()=>{const d=fixture(),j=job(d);j.terms.feeMinor=20000;assert.throws(()=>assessCommercial(d));});
test('output does not mutate input or leak evidence registry',()=>{const d=fixture();partner(d);const before=clone(d),r=assessCommercial(d);assert.deepEqual(d,before);assert.equal(r.evidence,undefined);assert.equal(r.executionAuthorised,false);});
test('combined API accepts no-acquisition control-only input',async()=>{const r=await analyseCommercial({acquisition:null,controls:fixture()});assert.equal(r.acquisition,null);assert.equal(r.controls.authority,'NONE');});
export { fixture, capable, job, activate, result, partner, owned, seal, record, without };

test('nominal refund reserve larger than real protected cash is not coverage',()=>{
 const d=fixture(),j=job(d);j.collectedMinor=10000;
 d.treasury.clearedMinor=35000;d.treasury.refundReservedMinor=10000;seal(d);
 const r=assessCommercial(d);assert.equal(r.risk.refundCovered,false);assert.equal(r.decision.class,'STOP');
});
test('unverified accepted terms are not a usable acquisition job',()=>{
 const d=fixture();job(d);d.evidence.find(e=>e.id==='terms').status='offered';
 assert.equal(assessCommercial(d).decision.class,'PAUSE');
});
test('ready unrelated worker cannot cover unavailable requested capability',()=>{
 const d=fixture(),j=job(d);j.capabilityId='missing';
 assert.equal(assessCommercial(d).decision.class,'PAUSE');
});
test('accepted unactivated jobs cannot overbook remaining capacity',()=>{
 const d=fixture(),j=job(d);d.capabilities[0].capacity=1;
 record(d,'cap','qualified_capacity','worker1',without(d.capabilities[0],'proofRef'));
 const j2=clone(j);j2.id='job2';j2.termsRef=record(d,'terms2','job_terms',j2.id,j2.terms,'contractual_commitment','accepted');d.jobs.push(j2);
 assert.equal(assessCommercial(d).decision.class,'PAUSE');
});
test('late benefit cannot retrospectively erase the expired guarantee remedy',()=>{
 const d=fixture(),j=activate(d,job(d));d.asOf='2026-10-21';seal(d);result(d,j,50000);
 assert.equal(assessCommercial(d).jobs[0].status,'WAIVE_FEE');
});
test('metric and baseline mismatch cannot earn payment',()=>{
 const d=fixture(),j=activate(d,job(d));result(d,j,50000);j.result.baselineId='other';
 record(d,'result','measured_checked_value',j.id,{termsHash:digest(j.terms),...without(j.result,'evidenceRef')});
 assert.equal(assessCommercial(d).jobs[0].feeEarnedMinor,0);
});
test('noncash time-value result is explicitly labelled',()=>{
 const d=fixture(),j=job(d);j.terms.metric='time_value';record(d,'terms','job_terms',j.id,j.terms,'contractual_commitment','accepted');
 activate(d,j);result(d,j,50000);assert.equal(assessCommercial(d).jobs[0].noncashValue,true);
});
test('risk budget must itself be an accepted commitment',()=>{
 const d=fixture();d.evidence.find(e=>e.id==='budget').status='draft';assert.equal(assessCommercial(d).risk.status,'UNVERIFIED');
});
test('zero fee is permitted but remains no paid revenue',()=>{
 const d=fixture(),j=job(d);j.terms.feeMinor=0;j.terms.remedyCapMinor=0;
 record(d,'terms','job_terms',j.id,j.terms,'contractual_commitment','accepted');activate(d,j);result(d,j,50000);
 assert.equal(assessCommercial(d).jobs[0].feeEarnedMinor,0);assert.equal(assessCommercial(d).cashChanged,false);
});
test('closed interruption receipt can be recorded when resolution is observed',()=>{
 const d=fixture(),j=activate(d,job(d));pause(d,j,'2026-10-07','2026-10-09');
 d.evidence.find(e=>e.id==='notice0').recordedOn='2026-10-09';d.asOf='2026-10-10';seal(d);
 assert.equal(assessCommercial(d).jobs[0].measurementEndsOn,'2026-10-22');
});
