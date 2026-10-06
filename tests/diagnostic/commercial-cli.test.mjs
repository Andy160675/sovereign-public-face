import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync,writeFileSync,rmSync,symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
const cli=fileURLToPath(new URL('../../tools/diagnostic/commercial-controls.mjs',import.meta.url));
const example=fileURLToPath(new URL('./fixtures/commercial.synthetic.json',import.meta.url));
const run=(...args)=>spawnSync(process.execPath,[cli,...args],{encoding:'utf8',timeout:5000});
function temp(fn){const dir=mkdtempSync(join(tmpdir(),'vipfish-controls-'));try{fn(dir);}finally{rmSync(dir,{recursive:true,force:true});}}
test('real CLI runs synthetic example without side effects',()=>{const r=run(example);assert.equal(r.status,0);const x=JSON.parse(r.stdout);assert.equal(x.controls.authority,'NONE');assert.deepEqual(x.controls.founderTasks,[]);assert.equal(x.controls.jobs[0].feeEarnedMinor,10000);});
test('usage exits two',()=>{const r=run();assert.equal(r.status,2);assert.equal(r.stdout,'');});
test('malformed JSON errors do not echo private input',()=>temp(dir=>{const file=join(dir,'private.json');writeFileSync(file,'{"secret":"PRIVATE_CUSTOMER');const r=run(file);assert.equal(r.status,1);assert.equal(r.stdout,'');assert.doesNotMatch(r.stderr,/PRIVATE_CUSTOMER|private\.json/);}));
test('oversized files are rejected',()=>temp(dir=>{const file=join(dir,'large');writeFileSync(file,' '.repeat(2*1024*1024+1));assert.equal(run(file).status,1);}));
test('invalid UTF8 rejected',()=>temp(dir=>{const file=join(dir,'bad');writeFileSync(file,Buffer.from([0xff,0xfe]));assert.equal(run(file).status,1);}));
test('directory is not an input file',()=>temp(dir=>assert.equal(run(dir).status,1)));
test('symlink is not an input file',()=>temp(dir=>{const link=join(dir,'link');symlinkSync(example,link);assert.equal(run(link).status,1);}));
test('module import performs no CLI work',()=>{const r=spawnSync(process.execPath,['--input-type=module','-e',`await import(${JSON.stringify(new URL('../../tools/diagnostic/commercial-controls.mjs',import.meta.url).href)})`],{encoding:'utf8'});assert.equal(r.status,0);assert.equal(r.stdout,'');assert.equal(r.stderr,'');});
