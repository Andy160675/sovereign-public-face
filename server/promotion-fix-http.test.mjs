import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createHandler } from '../api/promotion-fix.js';

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
