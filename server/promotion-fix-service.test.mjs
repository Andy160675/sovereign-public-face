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
for(const state of [undefined,'HOLD','enabled',' ENABLED','TRUE'])test(`production checkout fails closed for state ${String(state)}`,async()=>{
  const f=setup({env:{VERCEL_ENV:'production',PROMOTION_CHECKOUT_STATE:state}});
  const o=await f.service.prepare(f.input,f.context);
  await assert.rejects(f.service.checkout(o),e=>e.status===503&&e.code==='CHECKOUT_ON_HOLD');
  assert.equal(f.counts().checkouts,0);
  assert.equal(f.orders.get(o.orderId).checkout_session_id,null);
});
test('NODE_ENV-only production also fails closed',async()=>{
  const f=setup({env:{VERCEL_ENV:undefined,NODE_ENV:'production'}});
  const o=await f.service.prepare(f.input,f.context);
  await assert.rejects(f.service.checkout(o),e=>e.status===503&&e.code==='CHECKOUT_ON_HOLD');
  assert.equal(f.counts().checkouts,0);
});
test('an explicit Vercel preview remains usable when NODE_ENV is production',async()=>{
  const f=setup({env:{VERCEL_ENV:'preview',NODE_ENV:'production'}});
  const o=await f.service.prepare(f.input,f.context);
  const checkout=await f.service.checkout(o);
  assert.equal(checkout.status,'READY_UNPAID');
  assert.equal(f.counts().checkouts,1);
});
test('production checkout can be explicitly enabled after authority is resolved',async()=>{
  const f=setup({env:{VERCEL_ENV:'production',PROMOTION_CHECKOUT_STATE:'ENABLED'}});
  const o=await f.service.prepare(f.input,f.context);
  const checkout=await f.service.checkout(o);
  assert.equal(checkout.status,'READY_UNPAID');
  assert.equal(f.counts().checkouts,1);
});
test('production hold blocks an existing unpaid checkout before Stripe retrieval',async()=>{
  const f=setup();const o=await f.service.prepare(f.input,f.context);await f.service.checkout(o);
  f.env.VERCEL_ENV='production';f.env.PROMOTION_CHECKOUT_STATE='HOLD';
  await assert.rejects(f.service.checkout(o),e=>e.code==='CHECKOUT_ON_HOLD');
  assert.equal(f.retrieves(),0);
});
test('production hold does not block verified paid-result redelivery',async()=>{
  const f=setup({env:{VERCEL_ENV:'production',PROMOTION_CHECKOUT_STATE:'ENABLED'}});
  const o=await f.service.prepare(f.input,f.context);await f.service.checkout(o);f.paid();
  const paid=await f.service.result(o);f.env.PROMOTION_CHECKOUT_STATE='HOLD';
  assert.deepEqual(await f.service.result(o),paid);
});
test('verified exact paid session unlocks once and supports redelivery',async()=>{const f=setup();const o=await f.service.prepare(f.input,f.context);await f.service.checkout(o);f.paid();const a=await f.service.result(o),b=await f.service.result(o);assert.equal(a.status,'PAID');assert.equal(a.paymentKind,'STRIPE');assert.deepEqual(a.result,b.result);assert.deepEqual(a.receipt,b.receipt);assert.equal(f.counts().checkouts,1);});
test('paid session reconciles from a trusted callback without a browser return or access token',async()=>{
  const f=setup();const o=await f.service.prepare(f.input,f.context);await f.service.checkout(o);f.paid();
  const summary=await f.service.reconcileSession({orderId:o.orderId,sessionId:'cs_test_'+o.orderId});
  assert.equal(summary.status,'PAID');assert.equal(summary.orderId,o.orderId);
  assert.equal('result' in summary,false);assert.equal('accessToken' in summary,false);
  assert.equal(f.orders.get(o.orderId).payment_kind,'STRIPE');
  const repeated=await f.service.reconcileSession({orderId:o.orderId,sessionId:'cs_test_'+o.orderId});
  assert.deepEqual(repeated,summary);
  assert.deepEqual((await f.service.result(o)).result.text,'Lunch is £15 this Friday.');
  assert.deepEqual(f.counts(),{generated:1,checked:1,checkouts:1});
});
test('callback cannot unlock an unpaid, mismatched, or unavailable Stripe session',async()=>{
  const f=setup();const o=await f.service.prepare(f.input,f.context);await f.service.checkout(o);
  const callback={orderId:o.orderId,sessionId:'cs_test_'+o.orderId};
  await assert.rejects(f.service.reconcileSession(callback),e=>e.code==='PAYMENT_PENDING');
  await assert.rejects(f.service.reconcileSession({...callback,sessionId:'cs_test_wrong'}),e=>e.code==='PAYMENT_MISMATCH');
  assert.equal(f.orders.get(o.orderId).status,'READY_UNPAID');
  f.outage();
  await assert.rejects(f.service.reconcileSession(callback));
  assert.equal(f.orders.get(o.orderId).status,'READY_UNPAID');
});
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

// A figure that has traded places with another is invisible to a set of figures:
// the set is identical either way. These cases are the four shapes a price list is
// actually written in, plus the pairs whose only difference is capitalisation, so a
// refusal can never depend on whether the customer used capitals.
for (const [name, source, revised] of [
  ['prices swapped in one sentence', 'Coffee £6, pastry £8.', 'Coffee £8, pastry £6.'],
  ['prices swapped across sentences', 'Coffee is £6. Pastry is £8.', 'Coffee is £8. Pastry is £6.'],
  ['prices swapped across lines', 'Coffee £6\nPastry £8', 'Coffee £8\nPastry £6'],
  ['prices swapped across bullets', '- Adults £10\n- Children £5', '- Adults £5\n- Children £10'],
  ['was and now swapped in one sentence', 'Was £20, now £15.', 'Was £15, now £20.'],
  ['was and now swapped across sentences', 'Was £20. Now £15.', 'Was £15. Now £20.'],
  ['audience prices swapped', 'Adults £10, children £5.', 'Adults £5, children £10.'],
  ['prices swapped in lowercase', 'coffee £6, pastry £8.', 'coffee £8, pastry £6.'],
  ['times swapped', 'Happy hour 5pm, kitchen closes 9pm.', 'Happy hour 9pm, kitchen closes 5pm.'],
  ['currencies swapped between items', 'Coffee £6 or tea €6.', 'Coffee €6 or tea £6.'],
  ['prices swapped behind added copulas', 'Coffee £6, pastry £8.', 'Coffee is £8, pastry is £6.'],
  ['prices swapped inside a for-list', '£10 for adults, £5 for children.', '£5 for adults, £10 for children.'],
  ['prices swapped out of a for-list', '£10 for adults, £5 for children.', 'Adults £5, children £10.'],
  ['three prices rotated', 'Coffee £6, pastry £8, cake £4.', 'Coffee £8, pastry £4, cake £6.'],
  ['prices swapped in a leading-price list', '£6 coffee, £8 pastry.', '£8 coffee, £6 pastry.'],
  ['plain numbers swapped between labels', 'Room 12, floor 3.', 'Room 3, floor 12.'],
]) test('code check rejects '+name, async()=>{
  const f=setup({text:revised});
  await assert.rejects(f.service.prepare({...f.input,promotion:source},f.context),e=>e.code==='CHECK_FAILED');
  assert.equal(f.counts().checkouts,0);assert.equal(f.orders.size,0);
});

// Editing is the product. Every one of these moves a figure's words along with it,
// or rewords around it, and must still be accepted. A1 and A2 differ only by case
// and must get the same verdict.
for (const [name, source, revised] of [
  ['sentences reordered', 'Coffee is £6. Pastry is £8.', 'Pastry is £8. Coffee is £6.'],
  ['sentences reordered in lowercase', 'coffee is £6. pastry is £8.', 'pastry is £8. coffee is £6.'],
  ['one sentence split in two', 'Coffee £6, pastry £8.', 'Coffee is £6. Pastry is £8.'],
  ['lines merged and moved', 'Coffee £6.\nPastry £8.', 'Pastry £8 and coffee £6.'],
  ['clauses reordered with their prices', 'Adults £10, children £5.', 'Children £5, adults £10.'],
  ['restructured onto for-phrases', 'Adults £10, children £5.', 'Entry costs £10 for adults and £5 for children.'],
  ['a single time reworded', 'Happy hour from 5pm on Friday.', 'Happy hour 5pm Friday.'],
  ['reordered where a sentence starts with a digit', 'Doors at 7. 20 seats only.', '20 seats only. Doors at 7.'],
  ['reordered across a comma list', 'Tapas from 6pm, drinks £4.', 'Drinks £4. Tapas from 6pm.'],
  ['text left unchanged', 'Coffee £6, pastry £8.', 'Coffee £6, pastry £8.'],
  ['three pairs rotated together', 'Adults £10, children £5, seniors £7.', 'Seniors £7, adults £10, children £5.'],
  ['a range reworded in the same order', 'Open 9am to 5pm.', 'Open from 9am until 5pm.'],
  ['prices moved in front of their items', 'Coffee £6, pastry £8.', '£6 coffee, £8 pastry.'],
  ['prices moved in front and reordered', 'Coffee £6, pastry £8.', '£8 pastry, £6 coffee.'],
  ['a repeated figure reordered', 'Coffee £6. Tea £6. Cake £8.', 'Cake £8. Coffee £6. Tea £6.'],
  ['items renamed while each keeps its price', 'Adult £10, child £5.', 'Children £5, adults £10.'],
]) test('code check accepts '+name, async()=>{
  const f=setup({text:revised});
  const o=await f.service.prepare({...f.input,promotion:source},f.context);
  assert.equal(o.status,'READY_UNPAID');
});

// A figure's anchors must come from the sentence the figure is written in. When a
// run reached into a neighbouring sentence, moving two whole sentences past each
// other re-anchored both figures and fabricated a trade — and which way it broke
// depended on where the figure sat inside the customer's own sentence: 'Doors at 7.
// 20 seats only.' was refused, the same promotion as 'Only 20 seats.' was accepted.
// Both reaches are covered: backwards (a sentence that begins with a figure) and
// forwards (a sentence that ends with one, followed by more text).
for (const [name, source, revised] of [
  ['a figure-first sentence moved after a lead-in sentence', 'Dogs welcome. Doors at 7. 20 seats only.', 'Dogs welcome. 20 seats only. Doors at 7.'],
  ['a figure-last sentence moved before a closing sentence', 'Doors at 7. 20 seats only. Booking essential.', '20 seats only. Doors at 7. Booking essential.'],
  ['a figure-first sentence moved between lead-in and closing', 'Dogs welcome. Doors at 7. 20 seats only. Booking essential.', 'Dogs welcome. 20 seats only. Doors at 7. Booking essential.'],
  ['a figure-first sentence under a heading', 'Our prices: Doors at 7. 20 seats only.', 'Our prices: 20 seats only. Doors at 7.'],
  ['a figure-first sentence after a lead-in that carries its own number', 'Open 7 days. Doors at 7. 20 seats only.', 'Open 7 days. 20 seats only. Doors at 7.'],
  ['the same promotion with the word order inside the sentence changed', 'Dogs welcome. Doors at 7. Only 20 seats.', 'Dogs welcome. Only 20 seats. Doors at 7.'],
  ['a numbered price list reordered', '1. Coffee £6\n2. Pastry £8', '1. Pastry £8\n2. Coffee £6'],
  ['a bracketed numbered price list reordered', '1) Coffee £6\n2) Pastry £8', '1) Pastry £8\n2) Coffee £6'],
]) test('code check accepts '+name, async()=>{
  const f=setup({text:revised});
  const o=await f.service.prepare({...f.input,promotion:source},f.context);
  assert.equal(o.status,'READY_UNPAID');
});

// Scoping the runs to a sentence must not blind the check to a real trade made
// across those same sentences, nor to one made inside a numbered list.
for (const [name, source, revised] of [
  ['figures traded between sentences beside a lead-in', 'Dogs welcome. Doors at 7. 20 seats only.', 'Dogs welcome. Doors at 20. 7 seats only.'],
  ['figures traded between sentences beside a closing', 'Doors at 7. 20 seats only. Booking essential.', 'Doors at 20. 7 seats only. Booking essential.'],
  ['prices traded inside a numbered list', '1. Coffee £6\n2. Pastry £8', '1. Coffee £8\n2. Pastry £6'],
]) test('code check rejects '+name, async()=>{
  const f=setup({text:revised});
  await assert.rejects(f.service.prepare({...f.input,promotion:source},f.context),e=>e.code==='CHECK_FAILED');
  assert.equal(f.counts().checkouts,0);assert.equal(f.orders.size,0);
});

// A line's leading number counts the line; it does not describe the item. If it
// takes the item's words as anchors, reordering a numbered list renumbers the
// lines and looks exactly like a trade. Every marker shape must behave the same,
// and a numeric RANGE written with a dash must not be mistaken for a marker.
for (const [name, source, revised] of [
  ['a bracketed numbered list reordered', '(1) Coffee £6\n(2) Pastry £8', '(1) Pastry £8\n(2) Coffee £6'],
  ['a colon-marked numbered list reordered', '1: Coffee £6\n2: Pastry £8', '1: Pastry £8\n2: Coffee £6'],
  ['a dash-marked numbered list reordered', '1 - Coffee £6\n2 - Pastry £8', '1 - Pastry £8\n2 - Coffee £6'],
  ['a numbered list inside bullets reordered', '- 1. Coffee £6\n- 2. Pastry £8', '- 1. Pastry £8\n- 2. Coffee £6'],
]) test('code check accepts '+name, async()=>{
  const f=setup({text:revised});
  const o=await f.service.prepare({...f.input,promotion:source},f.context);
  assert.equal(o.status,'READY_UNPAID');
});

for (const [name, source, revised] of [
  ['a dash-written range whose ends are exchanged', '7 - 9pm doors\n10 - 11pm music', '9 - 7pm doors\n11 - 10pm music'],
  ['prices traded inside a bulleted numbered list', '- 1. Coffee £6\n- 2. Pastry £8', '- 1. Coffee £8\n- 2. Pastry £6'],
]) test('code check rejects '+name, async()=>{
  const f=setup({text:revised});
  await assert.rejects(f.service.prepare({...f.input,promotion:source},f.context),e=>e.code==='CHECK_FAILED');
  assert.equal(f.counts().checkouts,0);assert.equal(f.orders.size,0);
});
