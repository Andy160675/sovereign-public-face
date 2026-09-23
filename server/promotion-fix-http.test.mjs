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
