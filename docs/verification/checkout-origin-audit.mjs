/** Offline actual-source probes; Node 24+. No dependency installation or sockets.
 * Loads the real resolver, products and router source. Framework builders and
 * Stripe constructor/network are fixtures: this does not qualify tRPC auth,
 * Stripe SDK behavior, full TypeScript compilation or payment delivery.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import vm from 'node:vm';
import test from 'node:test';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const source = path => stripTypeScriptTypes(readFileSync(resolve(root, path), 'utf8'));
const resolverSource = source('server/_core/publicOrigin.ts').replace(/^export /gm, '');
const resolverContext = vm.createContext({ URL, process: { env: {} } });
vm.runInContext(resolverSource + '\nglobalThis.resolveOrigin = resolvePublicOrigin;', resolverContext);
const origin = (value, env) => resolverContext.resolveOrigin(value, env);
const configured = { PUBLIC_BASE_URL: 'https://sovereign.example', NODE_ENV: 'production' };
const good = [
 ['hostile origin', 'https://evil.example', configured, 'https://sovereign.example'],
 ['referer-shaped URL', 'https://evil.example/paid', configured, 'https://sovereign.example'],
 ['hostile prefix', 'https://sovereign.example.evil.test', configured, 'https://sovereign.example'],
 ['hostile query', 'https://evil.test/?x=https://sovereign.example', configured, 'https://sovereign.example'],
 ['configured origin', 'https://sovereign.example', configured, 'https://sovereign.example'],
 ['trailing slash', 'https://sovereign.example/', {...configured,PUBLIC_BASE_URL:'https://sovereign.example/'}, 'https://sovereign.example'],
 ['absent Origin', undefined, configured, 'https://sovereign.example'],
 ['promotion config', 'https://evil.example', {PROMOTION_PUBLIC_ORIGIN:'https://promo.example',NODE_ENV:'production'}, 'https://promo.example'],
 ['preview', 'https://app.vercel.app', {...configured,VERCEL_ENV:'preview',VERCEL_URL:'app.vercel.app'}, 'https://app.vercel.app'],
 ['invalid preview', 'https://evil.test/path', {...configured,VERCEL_ENV:'preview',VERCEL_URL:'evil.test/path'}, 'https://sovereign.example'],
 ['production Vercel URL', 'https://app.vercel.app', {...configured,VERCEL_ENV:'production',VERCEL_URL:'app.vercel.app'}, 'https://sovereign.example'],
 ['localhost development', 'http://localhost:3000', {NODE_ENV:'development'}, 'http://localhost:3000'],
 ['one valid config', 'http://evil.test', {PUBLIC_BASE_URL:'http://evil.test',PROMOTION_PUBLIC_ORIGIN:'https://good.example',NODE_ENV:'production'}, 'https://good.example'],
 ['configured port', undefined, {PUBLIC_BASE_URL:'https://good.example:8443/',NODE_ENV:'production'}, 'https://good.example:8443'],
];
for (const [label,value,env,want] of good) test('resolver: '+label,()=>assert.equal(origin(value,env),want));
for (const invalid of ['http://evil.test','https://a@evil.test','https://a:b@evil.test','https://evil.test/checkout','https://evil.test/?next=x','https://evil.test/#x','evil.test','javascript:alert(1)']) {
 test('resolver rejects config: '+invalid,()=>assert.throws(()=>origin(undefined,{PUBLIC_BASE_URL:invalid,NODE_ENV:'production'}),/return origin is configured/));
}
test('resolver: production without config fails closed',()=>assert.throws(()=>origin('https://evil.test',{NODE_ENV:'production'}),/return origin is configured/));
function handler(env = {}) {
 const requests = [];
 const procedure = {input(){return this;},query(fn){return fn;},mutation(fn){return fn;}};
 class TRPCError extends Error {constructor(options){super(options.message);this.code=options.code;}}
 class Stripe {constructor(){this.checkout={sessions:{create:async params=>{requests.push(params);return {url:'https://checkout.example.test/session'};}}};}}
 const context = vm.createContext({ URL, process:{env:{NODE_ENV:'production',PUBLIC_BASE_URL:'https://shop.example.test',STRIPE_SECRET_KEY:'sk_test_local_fixture',...env}},
  router:value=>value, publicProcedure:procedure,protectedProcedure:procedure,
  z:{object:()=>({}),string:()=>({})},COOKIE_NAME:'test',getSessionCookieOptions:()=>({}),systemRouter:{},TRPCError,Stripe });
 const products = source('server/products.ts').replace(/^export /gm,'');
 const router = source('server/routers.ts').replace(/^import .*;\r?\n/gm,'').replace(/^export \{[^\n]+\r?\n/gm,'').replace(/^export /gm,'');
 vm.runInContext(resolverSource+'\n'+products+'\n'+router+'\nglobalThis.checkoutHandler=appRouter.checkout.createSession;',context);
 return { requests, invoke:(headers={},productId='ai-governance-checklist')=>context.checkoutHandler({input:{productId},ctx:{req:{headers},user:{id:7,email:'checkout@example.test',name:'Checkout Test'}}}) };
}
for (const [name,headers] of [['hostile Origin',{origin:'https://evil.example',referer:'https://evil.example/paid'}],['hostile Referer',{referer:'https://evil.example/paid'}]]) {
 test('actual checkout handler: '+name,async()=>{const h=handler();await h.invoke(headers);assert.equal(h.requests.length,1);assert.equal(h.requests[0].success_url,'https://shop.example.test/checkout/success?session_id={CHECKOUT_SESSION_ID}');assert.equal(h.requests[0].cancel_url,'https://shop.example.test/checkout/cancel');});
}
test('actual checkout handler: missing production origin sends nothing',async()=>{const h=handler({PUBLIC_BASE_URL:undefined});await assert.rejects(h.invoke({origin:'https://evil.example'}),{code:'PRECONDITION_FAILED',message:'Checkout is not configured'});assert.equal(h.requests.length,0);});
for(const [id,mode,price] of [['ai-governance-checklist','payment',1900],['managed-fleet','subscription',200000]]) {
 test('actual checkout handler: preserves '+mode,async()=>{const h=handler();await h.invoke({origin:'https://shop.example.test'},id);const p=h.requests[0];assert.equal(p.mode,mode);assert.equal(p.line_items[0].price_data.unit_amount,price);assert.equal(p.client_reference_id,'7');assert.equal(p.metadata.product_id,id);assert.equal(p.allow_promotion_codes,true);assert.equal(p.line_items[0].price_data.recurring?.interval,mode==='subscription'?'month':undefined);});
}
test('actual checkout handler: missing key sends nothing',async()=>{const h=handler({STRIPE_SECRET_KEY:undefined});await assert.rejects(h.invoke(),/not configured/);assert.equal(h.requests.length,0);});
test('actual checkout handler: unknown product sends nothing',async()=>{const h=handler();await assert.rejects(h.invoke({},'missing-product'),/Product not found/);assert.equal(h.requests.length,0);});
