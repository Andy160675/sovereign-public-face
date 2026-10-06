import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { analyseAcquisition } from '../../tools/diagnostic/analyse-acquisition.mjs';
import { analyseCommercial } from '../../tools/diagnostic/commercial-controls.mjs';
const read=name=>JSON.parse(readFileSync(new URL('./fixtures/'+name,import.meta.url),'utf8'));
function input(){const d=read('commercial.synthetic.json');d.acquisition=read('acquisition.synthetic.json');
 d.controls.currency=d.acquisition.cohort.currency;d.controls.asOf=d.acquisition.cohort.asOf.slice(0,10);
 d.controls.jobs=[];d.controls.capabilities=[];d.controls.distribution={partners:[],owned:[]};
 d.controls.evidence=[];d.controls.treasury.recordRef=null;d.controls.treasury.budgetRef=null;return d;}
test('composition preserves existing acquisition report byte-for-byte JSON',async()=>{const d=input();const result=await analyseCommercial(d);assert.deepEqual(result.acquisition,analyseAcquisition(d.acquisition));assert.equal(result.controls.risk.status,'UNVERIFIED');assert.equal(result.acquisition.total.contributionMinor,-10000);assert.equal(result.acquisition.total.observedBankNetMovementMinor,9000);assert.equal(result.controls.cashChanged,false);});
test('composition rejects cross-currency treasury',async()=>{const d=input();d.controls.currency='EUR';await assert.rejects(()=>analyseCommercial(d));});
test('composition rejects differing snapshot dates',async()=>{const d=input();d.controls.asOf='2026-02-08';await assert.rejects(()=>analyseCommercial(d));});
test('legacy acquisition unknowns stay unknown, not risk budget',async()=>{const d=input();d.acquisition.cashComplete=false;d.acquisition.costsComplete=false;const r=await analyseCommercial(d);assert.equal(r.acquisition.total.bankNetMovementMinor,null);assert.equal(r.acquisition.total.contributionMinor,null);assert.equal(r.controls.risk.additionalLossCapacityMinor,0);});
