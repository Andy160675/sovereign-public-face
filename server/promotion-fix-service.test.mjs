import test from 'node:test';
import assert from 'node:assert/strict';
import { createPromotionService } from './promotion-fix-service.mjs';

function setup(options={}) {
  const orders=new Map(); let generated=0, checked=0, checkouts=0, rate=0;
  const env={PROMOTION_PUBLIC_ORIGIN:'https://example.test',PROMOTION_RATE_LIMIT_SALT:'s'.repeat(40),VERCEL_ENV:'preview',PROMOTION_REHEARSAL_KEY:'r'.repeat(40)};
  const store={
    async consumeRate(){return ++rate<=10;},
    async create(o){orders.set(o.id,structuredClone(o)); return o;},
    async get(id){return structuredClone(orders.get(id));},
    async setCheckout(id,session,mode){const o=orders.get(id);o.checkout_session_id=session;o.stripe_mode=mode;return structuredClone(o);},
    async markPaid(id,kind,receipt){const o=orders.get(id); if(o.status!=='PAID'){o.status='PAID';o.payment_kind=kind;o.payment_receipt=receipt;o.paid_at=receipt.paidAt;} return structuredClone(o);},
  };
  const model={
    async generate(){generated++;return {data:{eligible:true,text:options.text??'Lunch is £15 this Friday.',changes:['Made the offer clearer.'],human:['No personal data added.'],environment:['No environmental claim supplied.']},usage:{provider:'fixture',inputTokens:12,outputTokens:20}};},
    async check(){checked++;return {data:{accepted:options.accepted??true,eligible:true,notes:['Price and date retained.'],human:['Customer reviews before publication.'],environment:['No environmental claim added.']},usage:{provider:'fixture',inputTokens:15,outputTokens:20}};},
  };
  let paid=false, unavailable=false, retrieves=0;
  const sessions=new Map();
  const stripe={mode:'test',async createCheckout(order,urls){checkouts++;assert.equal(order.status,'READY_UNPAID');assert.ok(orders.has(order.id));assert.equal(checked,1);const s={id:'cs_test_'+order.id,url:'https://checkout.stripe.com/test',amount_total:1500,currency:'gbp',metadata:{order_id:order.id,product:'promotion_fix_v1'},client_reference_id:order.id,livemode:false,status:'open',payment_status:'unpaid'};sessions.set(s.id,s);return s;},async retrieve(id){retrieves++;if(unavailable)throw Error('Stripe is unavailable');return {...sessions.get(id),...(paid?{status:'complete',payment_status:'paid'}:{}),...(options.stripeOverride??{})};}};
  Object.assign(env,options.env??{});
  const service=createPromotionService({store,model,stripe,env,now:()=>new Date('2026-09-23T00:00:00Z')});
  return {service,orders,env,paid:()=>paid=true,outage:()=>unavailable=true,retrieves:()=>retrieves,counts:()=>({generated,checked,checkouts}),input:{promotion:'Lunch £15 this Friday.',language:'en',factsConfirmed:true},context:{ip:'203.0.113.1'}};
}

test('prepare returns stored checked output token before any checkout',async()=>{const f=setup();const o=await f.service.prepare(f.input,f.context);assert.equal(o.status,'READY_UNPAID');assert.equal(typeof o.accessToken,'string');const row=f.orders.get(o.orderId);assert.notEqual(row.token_hash,o.accessToken);assert.equal(row.result.text,'Lunch is £15 this Friday.');assert.deepEqual(f.counts(),{generated:1,checked:1,checkouts:0});assert.equal('result' in o,false);});
test('rejected independent check creates no checkout and no ready order',async()=>{const f=setup({accepted:false});await assert.rejects(f.service.prepare(f.input,f.context),e=>e.code==='CHECK_FAILED');assert.equal(f.counts().checkouts,0);assert.equal(f.orders.size,0);});
test('overlong input is rejected before model or payment',async()=>{const f=setup();await assert.rejects(f.service.prepare({...f.input,promotion:'word '.repeat(151)},f.context),e=>e.status===400);assert.equal(f.counts().generated,0);assert.equal(f.counts().checkouts,0);});
test('an unconfirmed source is rejected before model or payment',async()=>{const f=setup();await assert.rejects(f.service.prepare({...f.input,factsConfirmed:false},f.context),e=>e.status===400);assert.equal(f.counts().generated,0);});
test('unpaid and fabricated return query cannot unlock output',async()=>{const f=setup();const o=await f.service.prepare(f.input,f.context);await f.service.checkout(o);const r=await f.service.result({...o,sessionId:'cs_test_'+o.orderId});assert.equal(r.status,'READY_UNPAID');assert.equal('result' in r,false);await assert.rejects(f.service.result({...o,sessionId:'cs_fake'}),e=>e.status===400);});
test('wrong token cannot read or create checkout',async()=>{const f=setup();const o=await f.service.prepare(f.input,f.context);await assert.rejects(f.service.result({...o,accessToken:'x'.repeat(43)}),e=>e.status===404);await assert.rejects(f.service.checkout({...o,accessToken:'x'.repeat(43)}),e=>e.status===404);});
test('verified exact paid session unlocks once and supports redelivery',async()=>{const f=setup();const o=await f.service.prepare(f.input,f.context);await f.service.checkout(o);f.paid();const a=await f.service.result(o),b=await f.service.result(o);assert.equal(a.status,'PAID');assert.equal(a.paymentKind,'STRIPE');assert.deepEqual(a.result,b.result);assert.deepEqual(a.receipt,b.receipt);assert.equal(f.counts().checkouts,1);});
for(const [name,override] of Object.entries({amount:{amount_total:1},currency:{currency:'usd'},order:{metadata:{order_id:'wrong',product:'promotion_fix_v1'}},mode:{livemode:true}}))test('paid session with wrong '+name+' does not unlock',async()=>{const f=setup({stripeOverride:override});const o=await f.service.prepare(f.input,f.context);await f.service.checkout(o);f.paid();await assert.rejects(f.service.result(o),e=>e.code==='PAYMENT_MISMATCH');assert.equal(f.orders.get(o.orderId).status,'READY_UNPAID');});
test('preview simulation requires its separate secret and is visibly synthetic',async()=>{const f=setup();const o=await f.service.prepare(f.input,{...f.context,rehearsalKey:f.env.PROMOTION_REHEARSAL_KEY});await assert.rejects(f.service.simulate(o,'wrong'),e=>e.status===404);const r=await f.service.simulate(o,f.env.PROMOTION_REHEARSAL_KEY);assert.equal(r.status,'PAID');assert.equal(r.paymentKind,'SYNTHETIC_TEST');assert.equal(r.receipt.cashReceived,false);});
test('protected rehearsal preparation never creates a Stripe checkout',async()=>{const f=setup();const o=await f.service.prepare(f.input,{...f.context,rehearsalKey:f.env.PROMOTION_REHEARSAL_KEY});assert.equal(f.counts().checkouts,0);assert.equal(o.checkoutUrl,null);await assert.rejects(f.service.checkout(o),e=>e.code==='REHEARSAL_ONLY');});
test('production rejects simulation even with correct secret',async()=>{const f=setup({env:{VERCEL_ENV:'production'}});const o=await f.service.prepare(f.input,f.context);await assert.rejects(f.service.simulate(o,f.env.PROMOTION_REHEARSAL_KEY),e=>e.status===404);assert.equal(f.orders.get(o.orderId).status,'READY_UNPAID');});
test('shared rate counter rejects eleventh preparation before model call',async()=>{const f=setup();for(let i=0;i<10;i++)await f.service.prepare(f.input,f.context);await assert.rejects(f.service.prepare(f.input,f.context),e=>e.status===429);assert.equal(f.counts().generated,10);});

test('verified paid redelivery survives Stripe outage but rejects a forged session',async()=>{const f=setup();const o=await f.service.prepare(f.input,f.context);await f.service.checkout(o);f.paid();const first=await f.service.result(o);f.outage();const repeated=await f.service.result(o);assert.deepEqual(repeated,first);assert.equal(f.retrieves(),1);await assert.rejects(f.service.result({...o,sessionId:'cs_forged'}),e=>e.code==='SESSION_MISMATCH');});

for (const [name, source, revised] of [
  ['guessed currency', 'Coffee and cake ?6 on Friday.', 'Coffee and cake £6 on Friday.'],
  ['removed currency', 'Coffee and cake £6 on Friday.', 'Coffee and cake 6 on Friday.'],
  ['changed currency', 'Coffee and cake £6 on Friday.', 'Coffee and cake €6 on Friday.'],
  ['currency moved to another amount', 'Coffee £6 and cake €8.', 'Coffee €6 and cake £8.'],
]) test('independent approval cannot bypass '+name, async()=>{
  const f=setup({text:revised});
  await assert.rejects(f.service.prepare({...f.input,promotion:source},f.context),e=>e.code==='CHECK_FAILED');
  assert.equal(f.counts().checkouts,0);assert.equal(f.orders.size,0);
});
test('currency and amount preserved in a checked draft are accepted',async()=>{
  const f=setup({text:'Coffee and cake £6 on Friday.'});
  const o=await f.service.prepare({...f.input,promotion:'Coffee and cake £6 Friday.'},f.context);
  assert.equal(o.status,'READY_UNPAID');assert.equal(f.counts().checkouts,0);
});

for (const [name, source, revised] of [
  ['changed time', 'Happy hour from 5pm on Friday.', 'Happy hour from 7pm on Friday.'],
  ['am/pm flipped', 'Brunch from 11am on Sunday.', 'Brunch from 11pm on Sunday.'],
  ['dropped time', 'Tapas from 6pm, drinks £4.', 'Tapas all evening, drinks £4.'],
  ['changed glued number', 'Book the 2nd table for 4.', 'Book the 3rd table for 4.'],
]) test('code check rejects '+name, async()=>{
  const f=setup({text:revised});
  await assert.rejects(f.service.prepare({...f.input,promotion:source},f.context),e=>e.code==='CHECK_FAILED');
  assert.equal(f.counts().checkouts,0);assert.equal(f.orders.size,0);
});
test('time written differently but unchanged is accepted',async()=>{
  const f=setup({text:'Happy hour from 5 p.m. on Friday.'});
  const o=await f.service.prepare({...f.input,promotion:'Happy hour 5pm Friday.'},f.context);
  assert.equal(o.status,'READY_UNPAID');
});
