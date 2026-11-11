import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createHandler } from '../api/promotion-fix.js';
import * as promotionApi from '../api/promotion-fix.js';
import { createHmac } from 'node:crypto';

async function hosted(env, service, run) {
  const server=createServer(createHandler({env,service}));
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${server.address().port}`;
  try { await run((body,headers={},method='POST')=>fetch(base,{method,headers:{'content-type':'application/json',...headers},...(method==='POST'?{body:typeof body==='string'?body:JSON.stringify(body)}:{})})); }
  finally { await new Promise(resolve=>server.close(resolve)); }
}
const env={PROMOTION_PUBLIC_ORIGIN:'https://example.test',VERCEL_ENV:'preview',VERCEL_URL:'preview-123.vercel.app',VERCEL:'1'};

test('native HTTP guards method, format, size, action and unknown origin before service calls',async()=>{
  let calls=0; const service={async prepare(){calls++;return {};}};
  await hosted(env,service,async request=>{
    assert.equal((await request(undefined,{},'GET')).status,405);
    assert.equal((await request({}, {'content-type':'text/plain'})).status,415);
    assert.equal((await request('{')).status,400);
    assert.equal((await request('x'.repeat(12001))).status,413);
    assert.equal((await request({action:'delete'})).status,400);
    assert.equal((await request({action:'prepare'},{origin:'https://attacker.test'})).status,403);
    assert.equal(calls,0);
  });
});
test('native HTTP accepts only configured or exact platform preview origin and passes trusted IP plus rehearsal header',async()=>{
  const service={async prepare(value,context){assert.equal(value.action,'prepare');assert.equal(context.ip,'203.0.113.9');assert.equal(context.rehearsalKey,'private-fixture');return {status:'READY_UNPAID'};}};
  await hosted(env,service,async request=>{
    for(const origin of ['https://example.test','https://preview-123.vercel.app']){
      const response=await request({action:'prepare'},{origin,'x-vercel-forwarded-for':'203.0.113.9','x-promotion-rehearsal-key':'private-fixture'});
      assert.equal(response.status,200);assert.match(response.headers.get('cache-control'),/no-store/);assert.deepEqual(await response.json(),{status:'READY_UNPAID'});
    }
    assert.equal((await request({action:'prepare'},{origin:'https://another.vercel.app'})).status,403);
  });
});
test('production refuses the preview origin even when VERCEL_URL is supplied',async()=>{
  await hosted({...env,VERCEL_ENV:'production'},{async prepare(){throw Error('must not run');}},async request=>{
    assert.equal((await request({action:'prepare'},{origin:'https://preview-123.vercel.app'})).status,403);
  });
});
test('unexpected provider failure is sanitized at the native HTTP boundary',async()=>{
  await hosted(env,{async result(){throw Error('private-provider-value');}},async request=>{
    const response=await request({action:'result'});assert.equal(response.status,503);const body=await response.text();assert.ok(!body.includes('private-provider-value'));assert.equal(JSON.parse(body).error.code,'SERVICE_UNAVAILABLE');
  });
});

test('signed payment callback reconciles the matching order without a browser request',async()=>{
  const timestamp=1_790_121_600;
  const event=JSON.stringify({id:'evt_fixture',type:'checkout.session.completed',data:{object:{id:'cs_test_fixture',metadata:{order_id:'08e5206b-06bf-4b83-bf83-95c87c06854f',product:'promotion_fix_v1'}}}});
  const secret='whsec_'+'s'.repeat(32);
  const signature=createHmac('sha256',secret).update(`${timestamp}.${event}`).digest('hex');
  const calls=[];
  const handler=promotionApi.createWebhookHandler({env:{PROMOTION_WEBHOOK_SECRET:secret},now:()=>new Date(timestamp*1000),service:{async reconcileSession(value){calls.push(value);return {status:'PAID'};}}});
  const server=createServer(handler);
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try {
    const base=`http://127.0.0.1:${server.address().port}`;
    const request=(body,sig)=>fetch(base,{method:'POST',headers:{'stripe-signature':sig,'content-type':'application/json'},body});
    assert.equal((await request(event,`t=${timestamp},v1=${signature}`)).status,200);
    assert.deepEqual(calls,[{orderId:'08e5206b-06bf-4b83-bf83-95c87c06854f',sessionId:'cs_test_fixture'}]);
    assert.equal((await request(event,`t=${timestamp},v1=${'0'.repeat(64)}`)).status,400);
    const old=timestamp-600;
    const oldSignature=createHmac('sha256',secret).update(`${old}.${event}`).digest('hex');
    assert.equal((await request(event,`t=${old},v1=${oldSignature}`)).status,400);
    assert.equal(calls.length,1);
  } finally { await new Promise(resolve=>server.close(resolve)); }
});
test('webhook returns retryable failure when payment reconciliation fails',async()=>{
  const timestamp=1_790_121_600,secret='whsec_'+'s'.repeat(32);
  const event=JSON.stringify({type:'checkout.session.async_payment_succeeded',data:{object:{id:'cs_test_fixture',metadata:{order_id:'08e5206b-06bf-4b83-bf83-95c87c06854f',product:'promotion_fix_v1'}}}});
  const signature=createHmac('sha256',secret).update(`${timestamp}.${event}`).digest('hex');
  const server=createServer(promotionApi.createWebhookHandler({env:{PROMOTION_WEBHOOK_SECRET:secret},now:()=>new Date(timestamp*1000),service:{async reconcileSession(){throw Error('private-store-detail');}}}));
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try {
    const response=await fetch(`http://127.0.0.1:${server.address().port}`,{method:'POST',headers:{'stripe-signature':`t=${timestamp},v1=${signature}`},body:event});
    assert.equal(response.status,503);
    assert.doesNotMatch(await response.text(),/private-store-detail/);
  } finally { await new Promise(resolve=>server.close(resolve)); }
});

/**
 * The envelope rate limit.
 *
 * `prepare` already had an hourly per-IP limit inside the service, enforced
 * against Neon, because it spends two paid model calls. `checkout`, `result` and
 * `simulate` had none — so a caller could drive store reads and Stripe
 * `retrieve` calls without any ceiling. These tests pin the envelope budget that
 * now covers all four, and pin that it fails OPEN, since a limiter that fails
 * closed turns a Redis blip into a site outage.
 *
 * `limit` is injected, so nothing here reaches Upstash.
 */
async function hostedWithLimit(limit, service, run) {
  const server=createServer(createHandler({env,service,limit}));
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${server.address().port}`;
  try { await run((body,headers={})=>fetch(base,{method:'POST',headers:{'content-type':'application/json',...headers},body:JSON.stringify(body)})); }
  finally { await new Promise(resolve=>server.close(resolve)); }
}

test('envelope rate limit refuses over-budget callers on every action, before any service call',async()=>{
  const calls=[];
  const service=new Proxy({},{get:(_,name)=>async()=>{calls.push(name);return {};}});
  const limit=async()=>({allowed:false,retryAfterSeconds:17});
  await hostedWithLimit(limit,service,async request=>{
    for (const action of ['prepare','checkout','result','simulate']) {
      const response=await request({action},{origin:'https://example.test','x-vercel-forwarded-for':'203.0.113.9'});
      assert.equal(response.status,429,`${action} was not limited`);
      assert.equal(response.headers.get('retry-after'),'17');
      assert.equal((await response.json()).error.code,'RATE_LIMITED');
    }
    // The point of an envelope limit is that the expensive work never starts.
    assert.deepEqual(calls,[]);
  });
});

test('envelope rate limit is keyed on the trusted platform address, not a client header',async()=>{
  const keys=[];
  const limit=async(prefix,requests,key)=>{keys.push({prefix,requests,key});return {allowed:true,retryAfterSeconds:0};};
  await hostedWithLimit(limit,{async prepare(){return {status:'READY_UNPAID'};}},async request=>{
    const response=await request({action:'prepare'},{
      origin:'https://example.test',
      'x-vercel-forwarded-for':'203.0.113.9',
      // Forged, and must be ignored: trusting it would let an attacker evade
      // their own budget and exhaust a victim's.
      'x-forwarded-for':'198.51.100.200',
    });
    assert.equal(response.status,200);
  });
  assert.equal(keys.length,1);
  assert.equal(keys[0].prefix,'promotion-fix');
  assert.equal(keys[0].key,'promotion-ip:203.0.113.9');
  assert.ok(keys[0].requests>0);
});

test('envelope rate limit runs only after the cheap guards, so junk never touches the store',async()=>{
  let limitCalls=0;
  const limit=async()=>{limitCalls++;return {allowed:true,retryAfterSeconds:0};};
  await hostedWithLimit(limit,{async prepare(){return {};}},async request=>{
    // Wrong origin and unknown action are rejected without spending a Redis
    // round trip; each one would otherwise be a free way to bill the store.
    assert.equal((await request({action:'prepare'},{origin:'https://attacker.test'})).status,403);
    assert.equal((await request({action:'delete'},{origin:'https://example.test'})).status,400);
    assert.equal(limitCalls,0);
  });
});

test('envelope rate limit failing open keeps the endpoint serving',async()=>{
  // A limiter that fails closed would refuse every customer over a Redis blip,
  // which is worse than a brief unthrottled window. `consume` swallows store
  // errors itself; this pins that an outright BROKEN limiter is survivable too.
  //
  // The first version of this test asserted 503 and called that failing open.
  // It was not: 503 is the customer being refused. The handler now catches the
  // limiter's own throw, so the assertion is 200 — the request is served.
  const errors=[];
  const original=console.error;
  console.error=(...args)=>errors.push(args.join(' '));
  try {
    const limit=async()=>{throw Error('private-store-detail');};
    await hostedWithLimit(limit,{async prepare(){return {status:'READY_UNPAID'};}},async request=>{
      const response=await request({action:'prepare'},{origin:'https://example.test','x-vercel-forwarded-for':'203.0.113.9'});
      assert.equal(response.status,200);
      const body=await response.text();
      assert.deepEqual(JSON.parse(body),{status:'READY_UNPAID'});
      assert.doesNotMatch(body,/private-store-detail/);
    });
  } finally { console.error=original; }
  // Silent degradation would mean nobody learns the limiter stopped working.
  assert.ok(errors.some(line=>/limiter failed/.test(line)),'the failure was not logged');
});
