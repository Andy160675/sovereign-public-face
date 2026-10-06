/** Supplied-evidence commercial assessments. Never a sender, banker or authority issuer. */
import { createHash } from 'node:crypto';
import { openSync, closeSync, readSync, fstatSync, constants } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const DAY = 86400000;
const MAX = 1_000_000_000;
const KINDS = Object.freeze(['verified_rule','observed_result','external_benchmark','hypothesis','contractual_commitment']);
const CASH = ['clearedMinor','essentialMinor','otherRefundReserveMinor','otherCommitmentsMinor',
  'protectedRunwayMinor','refundReservedMinor','authorisedLossLimitMinor','authorisedRefundLimitMinor','lossSpentMinor'];
const INCIDENTS = ['permissionBreach','misleadingClaim','dataExposure','brokenFulfilment','guaranteeBreach'];
function invalid() { throw new TypeError('Invalid commercial controls input.'); }
function keys(x, names) {
  if (!x || Array.isArray(x) || ![Object.prototype,null].includes(Object.getPrototypeOf(x))
    || Reflect.ownKeys(x).length !== names.length || !names.every(k=>Object.hasOwn(x,k))) invalid();
}
function choice(x, values) { if(!values.includes(x)) invalid(); }
function id(x) { if(typeof x!=='string'||!/^[a-z0-9_-]{1,64}$/i.test(x)) invalid(); }
function ref(x) { if(x!==null) id(x); }
function bool(x) { if(typeof x!=='boolean') invalid(); }
function money(x, nullable=false) { if(nullable&&x===null)return; if(!Number.isSafeInteger(x)||x<0||x>MAX) invalid(); }
function date(x) {
  if(typeof x!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(x))invalid();
  const n=Date.parse(x+'T00:00:00.000Z');
  if(!Number.isFinite(n)||new Date(n).toISOString().slice(0,10)!==x)invalid();
  return n;
}
function hashValue(x) {if(typeof x!=='string'||!/^[a-f0-9]{64}$/.test(x))invalid();}
function without(x,...exclude) {return Object.fromEntries(Object.entries(x).filter(([k])=>!exclude.includes(k)));}
function sorted(x) {return Array.isArray(x)?x.map(sorted):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,sorted(x[k])])):x;}
export function bindingHash(x) {return createHash('sha256').update(JSON.stringify(sorted(x))).digest('hex');}
function plus(x,n) {return new Date(date(x)+n*DAY).toISOString().slice(0,10);}
function workingDays(start,n,holidays) {
  let result=start;
  for(let count=0;count<n;) {result=plus(result,1);const day=new Date(date(result)).getUTCDay();if(day!==0&&day!==6&&!holidays.includes(result))count++;}
  return result;
}
function rows(x) {if(!Array.isArray(x)||x.length>500)invalid();}
function unique(list) {const set=new Set();for(const x of list){id(x.id);if(set.has(x.id))invalid();set.add(x.id);}}
function validate(d) {
  keys(d,['schemaVersion','asOf','currency','evidence','distribution','capabilities','jobs','treasury','experiment']);
  choice(d.schemaVersion,['1.0.0']);choice(d.currency,['EUR','GBP','USD']);date(d.asOf);
  for(const a of [d.evidence,d.capabilities,d.jobs]){rows(a);unique(a);}
  if(d.evidence.length+d.capabilities.length+d.jobs.length>1000)invalid();
  for(const e of d.evidence){
    keys(e,['id','kind','status','purpose','subjectId','payloadHash','recordedOn','validUntil']);
    choice(e.kind,KINDS);choice(e.status,e.kind==='contractual_commitment'?['draft','offered','accepted']:['recorded']);
    id(e.purpose);id(e.subjectId);hashValue(e.payloadHash);if(date(e.recordedOn)>=date(e.validUntil))invalid();
  }
  keys(d.distribution,['partners','owned']);
  for(const a of Object.values(d.distribution)){rows(a);unique(a);}
  for(const p of d.distribution.partners){keys(p,['id','namedContact','reachable','permissionRef','agreementRef']);bool(p.namedContact);bool(p.reachable);ref(p.permissionRef);ref(p.agreementRef);}
  for(const o of d.distribution.owned){keys(o,['id','connected','relevantReach','permissionRef','reachRef']);bool(o.connected);money(o.relevantReach,true);ref(o.permissionRef);ref(o.reachRef);}
  for(const c of d.capabilities){
    keys(c,['id','artifactHash','producerId','verifierId','routineHumanMinutes','founderMinutes','capacity','inFlight','proofRef']);
    hashValue(c.artifactHash);id(c.producerId);id(c.verifierId);ref(c.proofRef);
    for(const k of ['routineHumanMinutes','founderMinutes','capacity','inFlight'])money(c[k]);
  }
  let nested=0;
  for(const j of d.jobs){
    keys(j,['id','capabilityId','acceptedOn','terms','termsRef','activation','pauses','result','collectedMinor','refundedMinor','unspentWorstCaseMinor']);
    id(j.capabilityId);ref(j.termsRef);if(j.acceptedOn!==null&&date(j.acceptedOn)>date(d.asOf))invalid();
    for(const k of ['collectedMinor','refundedMinor','unspentWorstCaseMinor'])money(j[k]);
    const t=j.terms;
    keys(t,['version','currency','feeMinor','thirdPartyMinor','customerCostMinor','metric','baselineId','methodId',
      'measurementDays','cureWorkingDays','maxPauseDays','decisionDays','remedyCapMinor','thirdPartyCostsDisclosed',
      'customerObligationsAgreed','mandatoryRightsPreserved','paymentMode','calendarTimeZone','holidays']);
    id(t.version);if(t.currency!==d.currency)invalid();
    for(const k of ['feeMinor','thirdPartyMinor','customerCostMinor','remedyCapMinor'])money(t[k]);
    if(t.remedyCapMinor!==t.feeMinor||j.refundedMinor>j.collectedMinor||j.collectedMinor>t.feeMinor)invalid();
    choice(t.metric,['incremental_profit','cost_saved','time_value']);id(t.baselineId);id(t.methodId);
    // v1 models only the agreed short-cycle contract. Other contracts stay outside this evaluator.
    if(t.measurementDays!==14||t.cureWorkingDays!==5||t.maxPauseDays!==7||t.decisionDays!==7)invalid();
    for(const k of ['thirdPartyCostsDisclosed','customerObligationsAgreed','mandatoryRightsPreserved'])bool(t[k]);
    choice(t.paymentMode,['pay_after_value','prepaid']);
    choice(t.calendarTimeZone,['Atlantic/Canary','Europe/London','UTC']);rows(t.holidays);
    for(const day of t.holidays)date(day);if(new Set(t.holidays).size!==t.holidays.length)invalid();
    if(j.activation!==null){
      const a=j.activation;keys(a,['on','inputsReady','accessReady','baselineReady','proofRef']);ref(a.proofRef);
      if(j.acceptedOn===null||date(a.on)<date(j.acceptedOn)||date(a.on)>date(d.asOf))invalid();
      for(const k of ['inputsReady','accessReady','baselineReady'])bool(a[k]);
    }
    rows(j.pauses);nested+=j.pauses.length+t.holidays.length;let last=null;
    for(const p of j.pauses){
      keys(p,['start','end','cause','dependencyId','noticeRef']);choice(p.cause,['customer','vipfish']);id(p.dependencyId);ref(p.noticeRef);
      if(!j.activation||date(p.start)<date(j.activation.on)||date(p.start)>date(d.asOf))invalid();
      if(last!==null&&(last.end===null||p.start<last.end))invalid();
      if(p.end!==null&&(date(p.end)<date(p.start)||date(p.end)>date(d.asOf)))invalid();last=p;
    }
    if(j.result!==null){
      const r=j.result;keys(r,['on','amountMinor','metric','baselineId','methodId','resultHash','qualityPassed','producerId','verifierId','evidenceRef']);
      date(r.on);if(!j.activation||r.on<j.activation.on||r.on>d.asOf)invalid();money(r.amountMinor);bool(r.qualityPassed);
      choice(r.metric,['incremental_profit','cost_saved','time_value']);id(r.baselineId);id(r.methodId);hashValue(r.resultHash);id(r.producerId);id(r.verifierId);ref(r.evidenceRef);
    }
  }
  if(nested>2000)invalid();
  keys(d.treasury,['reconciled',...CASH,'recordRef','budgetRef']);bool(d.treasury.reconciled);
  for(const k of CASH)money(d.treasury[k],true);ref(d.treasury.recordRef);ref(d.treasury.budgetRef);
  keys(d.experiment,[...INCIDENTS,'unspentAdCapMinor','spendLimitReached','trackingComplete','windowClosed','contacts','replies','baselineReplyProbability','repeatedFindingRef']);
  for(const k of [...INCIDENTS,'spendLimitReached','trackingComplete','windowClosed'])bool(d.experiment[k]);
  for(const k of ['unspentAdCapMinor','contacts','replies'])money(d.experiment[k]);
  if(d.experiment.replies>d.experiment.contacts)invalid();ref(d.experiment.repeatedFindingRef);
  const p=d.experiment.baselineReplyProbability;if(p!==null&&(typeof p!=='number'||!Number.isFinite(p)||p<0||p>1))invalid();
}

/** All evidence is supplied and must be independently authenticated by the native host. */
export function assessCommercial(d) {
  validate(d);
  const evidence=new Map(d.evidence.map(e=>[e.id,e]));
  const admitted=(reference,kind,purpose,subject,payload,on=d.asOf)=>{
    const e=evidence.get(reference);
    return Boolean(e&&e.kind===kind&&e.purpose===purpose&&e.subjectId===subject
      &&e.status===(kind==='contractual_commitment'?'accepted':'recorded')
      &&e.recordedOn<=on&&on<e.validUntil&&e.payloadHash===bindingHash(payload));
  };
  const partnerCount=d.distribution.partners.filter(p=>{
    const payload=without(p,'permissionRef','agreementRef');
    return p.namedContact&&p.reachable&&admitted(p.permissionRef,'observed_result','contact_permission',p.id,payload)
      &&admitted(p.agreementRef,'contractual_commitment','distribution_agreement',p.id,payload);
  }).length;
  const owned=d.distribution.owned.map(o=>{
    const payload=without(o,'permissionRef','reachRef');
    const usable=o.connected&&admitted(o.permissionRef,'observed_result','publishing_permission',o.id,payload);
    const reach=usable&&o.relevantReach!==null&&admitted(o.reachRef,'observed_result','audience_reach',o.id,payload)?o.relevantReach:null;
    return {id:o.id,usable,reach};
  });
  const observedReach=owned.filter(o=>o.reach!==null).reduce((n,o)=>n+o.reach,0);
  const distribution={stage:partnerCount>0||observedReach>0?'EVIDENCED_ROUTE':'BUILD_DISTRIBUTION',
    eligiblePartnerCount:partnerCount,usableOwnedChannels:owned.filter(o=>o.usable).length,
    relevantReach:owned.length>0&&owned.every(o=>o.reach!==null)?observedReach:null,
    observedReachSubtotal:observedReach,reachMayOverlap:true,revenueForecastMinor:null};
  const capacityRows=d.capabilities.map(c=>({id:c.id,slots:c.founderMinutes===0&&c.routineHumanMinutes===0
    &&c.producerId!==c.verifierId&&admitted(c.proofRef,'observed_result','qualified_capacity',c.id,without(c,'proofRef'))
    ?Math.max(0,c.capacity-c.inFlight):0}));
  const capacity={availableSlots:capacityRows.reduce((n,c)=>n+c.slots,0),capabilities:capacityRows};
  const jobs=d.jobs.map(j=>{
    const t=j.terms,termsHash=bindingHash(t),investment=t.feeMinor+t.thirdPartyMinor+t.customerCostMinor;
    const report={id:j.id,status:'CONTRACT_UNVERIFIED',feeEarnedMinor:0,feeDueMinor:0,refundDueMinor:0,
      totalInvestmentMinor:investment,demonstratedBenefitMinor:null,noncashValue:t.metric==='time_value',
      measurementEndsOn:null,decisionDueOn:null,contractHash:termsHash,collectionBeforeValue:false};
    if(j.acceptedOn===null){report.status='DRAFT_NOT_OFFERED';return report;}
    // Historical acceptance is checked on its recorded date, not erased by today's evidence expiry.
    if(!admitted(j.termsRef,'contractual_commitment','job_terms',j.id,t,j.acceptedOn)
      ||!t.thirdPartyCostsDisclosed||!t.customerObligationsAgreed||!t.mandatoryRightsPreserved)return report;
    report.status='AWAITING_INPUTS';
    const a=j.activation;
    if(a&&a.inputsReady&&a.accessReady&&a.baselineReady&&admitted(a.proofRef,'observed_result','verified_activation',j.id,
      {termsHash,...without(a,'proofRef')},a.on)){
      let end=plus(a.on,t.measurementDays),extension=0,termination=null,waiting=false,unverifiedPause=false;
      for(const p of j.pauses){
        if(p.start>=end){unverifiedPause=true;break;}
        if(!admitted(p.noticeRef,'observed_result','dependency_notice',j.id,{termsHash,...without(p,'noticeRef')},p.end??p.start)){
          unverifiedPause=true;continue;
        }
        if(p.cause==='vipfish')continue;
        const allowance=Math.max(0,t.maxPauseDays-extension);
        const cureEnd=workingDays(p.start,t.cureWorkingDays,t.holidays);
        const latest=[cureEnd,plus(p.start,allowance)].sort()[0];
        const actualEnd=p.end??d.asOf;
        const used=Math.min(allowance,Math.max(0,(date(actualEnd)-date(p.start))/DAY));
        extension+=used;end=plus(a.on,t.measurementDays+extension);
        if((p.end===null&&d.asOf>=latest)||(p.end!==null&&p.end>latest)){
          termination=latest;break;
        }
        if(p.end===null)waiting=true;
      }
      report.measurementEndsOn=end;report.decisionDueOn=plus(termination??end,t.decisionDays);
      report.status=unverifiedPause?'EVIDENCE_UNVERIFIED':waiting?'AWAITING_CUSTOMER':'MEASURING';
      const r=j.result;
      const resultInsidePause=r&&j.pauses.some(p=>r.on>=p.start&&(p.end===null||r.on<p.end));
      const good=r&&!unverifiedPause&&!resultInsidePause&&r.on<end&&(!termination||r.on<termination)
        &&r.metric===t.metric&&r.baselineId===t.baselineId&&r.methodId===t.methodId
        &&r.qualityPassed&&r.producerId!==r.verifierId
        &&admitted(r.evidenceRef,'observed_result','measured_checked_value',j.id,{termsHash,...without(r,'evidenceRef')},r.on);
      if(good){report.demonstratedBenefitMinor=r.amountMinor;}
      if(good&&r.amountMinor>investment&&j.refundedMinor===0){
        report.status='VALUE_DEMONSTRATED';report.feeEarnedMinor=t.feeMinor;
        report.feeDueMinor=t.feeMinor-j.collectedMinor;report.decisionDueOn=plus(r.on,t.decisionDays);
      }else if(termination||d.asOf>=end){
        report.status=j.collectedMinor>j.refundedMinor?'REFUND_FEE':'WAIVE_FEE';
        report.refundDueMinor=j.collectedMinor-j.refundedMinor;
      }
    }
    report.collectionBeforeValue=t.paymentMode==='pay_after_value'&&j.collectedMinor>0&&report.feeEarnedMinor===0;
    return report;
  });
  const refundExposure=jobs.reduce((n,r,i)=>n+(r.feeEarnedMinor>0?0:d.jobs[i].collectedMinor-d.jobs[i].refundedMinor),0);
  // Retain supplied unspent cost ceilings even on a closed job until the cost ledger clears them.
  const worstCase=d.jobs.reduce((n,j)=>n+j.unspentWorstCaseMinor,d.experiment.unspentAdCapMinor);
  const cash=d.treasury,payload=without(cash,'recordRef','budgetRef');
  const cashKnown=cash.reconciled&&CASH.every(k=>cash[k]!==null)
    &&admitted(cash.recordRef,'observed_result','reconciled_risk_budget','treasury',{currency:d.currency,...payload})
    &&admitted(cash.budgetRef,'contractual_commitment','risk_budget','treasury',
      {currency:d.currency,lossLimitMinor:cash.authorisedLossLimitMinor,refundLimitMinor:cash.authorisedRefundLimitMinor});
  const free=cashKnown?cash.clearedMinor-cash.essentialMinor-cash.otherRefundReserveMinor-cash.otherCommitmentsMinor
    -cash.protectedRunwayMinor-cash.refundReservedMinor:null;
  const lossCapacity=cashKnown?Math.max(0,Math.min(free,cash.authorisedLossLimitMinor-cash.lossSpentMinor)):0;
  const refundCovered=cashKnown&&free>=0&&refundExposure<=cash.refundReservedMinor&&refundExposure<=cash.authorisedRefundLimitMinor;
  const risk={status:!cashKnown?'UNVERIFIED':free<0||!refundCovered||worstCase>lossCapacity?'UNFUNDED':'COVERED',
    freeCashMinor:free,refundExposureMinor:refundExposure,refundCovered,unspentWorstCaseMinor:worstCase,
    additionalLossCapacityMinor:cashKnown&&refundCovered?Math.max(0,lossCapacity-worstCase):0,
    additionalRefundCapacityMinor:cashKnown&&refundCovered?Math.max(0,Math.min(cash.refundReservedMinor,cash.authorisedRefundLimitMinor)-refundExposure):0};
  const ex=d.experiment;
  const repeated=ex.trackingComplete&&ex.windowClosed&&admitted(ex.repeatedFindingRef,'observed_result',
    'repeated_commercial_finding','experiment',without(ex,'repeatedFindingRef'));
  const experiment={contacts:ex.contacts,replies:ex.replies,interpretation:repeated?'REPEATED_EVIDENCE':'DIRECTIONAL_ONLY',
    zeroReplyProbability:ex.baselineReplyProbability===null?null:(1-ex.baselineReplyProbability)**ex.contacts,
    probabilityBasis:'SUPPLIED_HYPOTHESIS_NOT_BENCHMARK'};
  const stop=INCIDENTS.filter(k=>ex[k]);
  if(refundExposure>0&&!refundCovered)stop.push('refund_not_covered');
  if(jobs.some(j=>j.collectionBeforeValue))stop.push('collection_before_demonstrated_value');
  const pauseReasons=[];
  const pendingByCapability=new Map();
  for(let i=0;i<d.jobs.length;i++){
    const j=d.jobs[i],r=jobs[i];
    if(r.status==='CONTRACT_UNVERIFIED'||r.status==='EVIDENCE_UNVERIFIED')pauseReasons.push('job_evidence_unverified');
    if(j.acceptedOn!==null&&j.activation===null){
      pendingByCapability.set(j.capabilityId,(pendingByCapability.get(j.capabilityId)??0)+1);
    }
  }
  for(const [capabilityId,count] of pendingByCapability){
    const row=capacityRows.find(c=>c.id===capabilityId);
    if(!row||row.slots<count)pauseReasons.push('requested_capacity_unavailable');
  }
  if(capacity.availableSlots===0)pauseReasons.push('no_verified_automated_capacity');
  if(risk.status!=='COVERED')pauseReasons.push('risk_budget_not_covered');
  if(ex.spendLimitReached)pauseReasons.push('spend_limit_reached');
  const decision=stop.length?{class:'STOP',reasons:stop}:pauseReasons.length?{class:'PAUSE',reasons:pauseReasons}
    :repeated?{class:'CHANGE_HYPOTHESIS',reasons:['repeated_specific_evidence']}:{class:'OBSERVE',reasons:['no_causal_conclusion']};
  return {schemaVersion:'1.0.0',asOf:d.asOf,currency:d.currency,authority:'NONE',executionAuthorised:false,
    cashChanged:false,termsChanged:false,founderTasks:[],evidenceClasses:[...KINDS],distribution,capacity,jobs,risk,experiment,decision,
    limitations:['Supplied records and distinct actor IDs are not authenticated identity or independent verification.',
      'This assessment neither reserves money/capacity nor sends, charges, refunds, offers, publishes or changes canonical orders.',
      'Run in a trusted native host that rechecks current permissions, admitted evidence, cash and capacity atomically before effects.',
      'Benefit evidence must already account for attribution, increments, agreed time valuation and no double counting; this code does not establish causality.',
      'Calendar dates are business-local dates in the accepted calendar; midnight endpoints are exclusive. Mandatory rights and other liabilities are outside this additional commercial guarantee.',
      'A demonstrated work fee is not cash received. No revenue forecast is inferred from reach or referrals.']};
}

/** Compose, do not rewrite, the established acquisition measurement contract. */
export async function analyseCommercial(document) {
  keys(document,['acquisition','controls']);
  const controls=assessCommercial(document.controls);
  let acquisition=null;
  if(document.acquisition!==null){
    const {analyseAcquisition}=await import('./analyse-acquisition.mjs');
    acquisition=analyseAcquisition(document.acquisition);
    if(acquisition.currency!==controls.currency||acquisition.asOf.slice(0,10)!==controls.asOf)invalid();
  }
  return {schemaVersion:'1.0.0',acquisition,controls};
}
function readJson(path) {
  const fd=openSync(path,constants.O_RDONLY|(constants.O_NOFOLLOW??0)|(constants.O_NONBLOCK??0));
  try{
    if(!fstatSync(fd).isFile())invalid();
    const b=Buffer.alloc(2*1024*1024+1);let n=0;
    while(n<b.length){const r=readSync(fd,b,n,b.length-n,null);if(!r)break;n+=r;}
    if(n===b.length)invalid();return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(b.subarray(0,n)));
  }finally{closeSync(fd);}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  if(process.argv.length!==3){process.stderr.write('Usage: node tools/diagnostic/commercial-controls.mjs export.json\n');process.exitCode=2;}
  else try{const r=await analyseCommercial(readJson(process.argv[2]));process.stdout.write(JSON.stringify(r,null,2)+'\n');}
  catch{process.stderr.write('Commercial assessment failed: invalid or unreadable input.\n');process.exitCode=1;}
}
