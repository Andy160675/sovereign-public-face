import { registerHooks, stripTypeScriptTypes } from 'node:module';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
const root=process.argv[2];
globalThis.auditCalls=[];
const mock=url=> 'data:text/javascript,'+encodeURIComponent(url);
registerHooks({
 resolve(specifier, context, nextResolve) {
   if(specifier==='cookie') return {url:mock('export const parse=h=>Object.fromEntries(h.split(";").map(x=>x.trim().split("=")));'),shortCircuit:true};
   if(context.parentURL?.endsWith('/oauth.ts')&&specifier==='../db') return {url:mock('export const upsertUser=async()=>{};'),shortCircuit:true};
   if(context.parentURL?.endsWith('/oauth.ts')&&specifier==='./sdk') return {url:mock('export const sdk={exchangeCodeForToken:async(...a)=>{globalThis.auditCalls.push(a);return {accessToken:"synthetic"}},getUserInfo:async()=>({openId:"synthetic"}),createSessionToken:async()=>"synthetic-session"};'),shortCircuit:true};
   if(specifier==='@shared/const') return {url:pathToFileURL(resolve(root,'shared/const.ts')).href,shortCircuit:true};
   if(specifier.startsWith('.')&&!/\.[a-z]+$/.test(specifier)) return nextResolve(specifier+'.ts',context);
   return nextResolve(specifier,context);
 },
 load(url,context,nextLoad) {if(url.endsWith('.ts')) return {format:'module',source:stripTypeScriptTypes(readFileSync(new URL(url),'utf8')),shortCircuit:true};return nextLoad(url,context);}
});
process.env.NODE_ENV='production';
process.env.PUBLIC_BASE_URL='https://app.audit.test';
process.env.VITE_OAUTH_PORTAL_URL='https://portal.audit.test';
const {registerOAuthRoutes}=await import(pathToFileURL(resolve(root,'server/_core/oauth.ts')));
const {encodeState,createNonce}=await import(pathToFileURL(resolve(root,'server/_core/oauthState.ts')));
const handlers=new Map();
registerOAuthRoutes({get:(path,fn)=>handlers.set(path,fn)});
async function call(path,query={},cookie='',protocol='https') {
 const out={status:200,cookies:[]};
 const res={status(n){out.status=n;return this},json(v){out.body=v;return this},cookie(name,value,options){out.cookies.push({name,value,options});return this},clearCookie(name,options){out.cookies.push({name,value:'',options});return this},redirect(n,to){out.status=n;out.location=to;return this}};
 await handlers.get(path)({query,headers:{cookie},protocol},res);
 return out;
}
const results=[];
async function probe(name,fn){try{await fn();results.push({name,pass:true})}catch(e){results.push({name,pass:false,error:e.message})}}
await probe('production rejects sibling-planted legacy state before exchange',async()=>{
 globalThis.auditCalls=[];
 const nonce=createNonce();
 const out=await call('/api/oauth/callback',{code:'attacker-code',state:encodeState('https://app.audit.test/api/oauth/callback',nonce)},'oauth_state='+nonce);
 assert.equal(out.status,400);assert.equal(globalThis.auditCalls.length,0);
});
await probe('production sets valid host-prefixed nonce cookie',async()=>{
 const out=await call('/api/oauth/start');
 const cookie=out.cookies.find(c=>c.name==='__Host-oauth_state');
 assert.ok(cookie);assert.equal(cookie.options.path,'/');assert.equal(cookie.options.secure,true);assert.equal(cookie.options.httpOnly,true);assert.equal(cookie.options.domain,undefined);
});
await probe('fresh genuine flow succeeds and preserves return origin',async()=>{
 globalThis.auditCalls=[];
 const start=await call('/api/oauth/start');
 const nonceCookie=start.cookies.find(c=>c.value);
 const state=new URL(start.location).searchParams.get('state');
 const end=await call('/api/oauth/callback',{code:'genuine-code',state},nonceCookie.name+'='+nonceCookie.value);
 assert.equal(end.status,302);assert.equal(globalThis.auditCalls.length,1);assert.equal(end.location,'/');
});
await probe('wrong protected nonce refuses before exchange',async()=>{
 globalThis.auditCalls=[];
 const out=await call('/api/oauth/callback',{code:'attacker-code',state:encodeState('https://app.audit.test/api/oauth/callback',createNonce())},'__Host-oauth_state='+createNonce());
 assert.equal(out.status,400);assert.equal(globalThis.auditCalls.length,0);
});
await probe('plain HTTP local development still completes',async()=>{
 process.env.NODE_ENV='development';process.env.PUBLIC_BASE_URL='http://localhost:3000';
 const start=await call('/api/oauth/start',{},'','http');
 const nonceCookie=start.cookies.find(c=>c.value);
 assert.equal(nonceCookie.name,'oauth_state');assert.equal(nonceCookie.options.secure,false);
 const state=new URL(start.location).searchParams.get('state');
 const end=await call('/api/oauth/callback',{code:'local-code',state},nonceCookie.name+'='+nonceCookie.value,'http');
 assert.equal(end.status,302);
 process.env.NODE_ENV='production';
});
console.log(JSON.stringify({node:process.version,results},null,2));
process.exitCode=results.some(r=>!r.pass)?1:0;
