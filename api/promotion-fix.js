import { createPromotionService, fault } from '../server/promotion-fix-service.mjs';
import { createNeonStore, createAnthropicModel, createStripeClient } from '../server/promotion-fix-adapters.mjs';

const LIMIT = 12000;
async function jsonBody(req) {
  let raw;
  if (req.body !== undefined) raw = typeof req.body === 'string' || Buffer.isBuffer(req.body) ? req.body : JSON.stringify(req.body);
  else {
    const chunks=[]; let size=0;
    for await (const chunk of req) {
      size+=Buffer.byteLength(chunk);
      if(size>LIMIT) throw fault(413,'INPUT_TOO_LARGE','The request is too large.');
      chunks.push(Buffer.from(chunk));
    }
    raw=Buffer.concat(chunks);
  }
  if (Buffer.byteLength(raw)>LIMIT) throw fault(413,'INPUT_TOO_LARGE','The request is too large.');
  try { const value=JSON.parse(String(raw)); if(!value || typeof value!=='object' || Array.isArray(value)) throw Error(); return value; }
  catch { throw fault(400,'INVALID_JSON','Send one JSON request.'); }
}

export function createHandler({service,env=process.env}={}) {
  let liveService=service;
  return async function handler(req,res) {
    res.setHeader('Cache-Control','no-store, private');
    res.setHeader('Content-Type','application/json; charset=utf-8');
    res.setHeader('Referrer-Policy','no-referrer');
    res.setHeader('X-Content-Type-Options','nosniff');
    try {
      if (req.method!=='POST') { res.setHeader('Allow','POST'); throw fault(405,'METHOD_NOT_ALLOWED','Use POST.'); }
      if (!String(req.headers['content-type']??'').toLowerCase().startsWith('application/json')) throw fault(415,'CONTENT_TYPE','Use application/json.');
      const origin=req.headers.origin;
      const previewOrigin=env.VERCEL_ENV==='preview' && typeof env.VERCEL_URL==='string' && /^[a-zA-Z0-9.-]+$/.test(env.VERCEL_URL) ? `https://${env.VERCEL_URL}` : null;
      if (origin && origin!==env.PROMOTION_PUBLIC_ORIGIN && origin!==previewOrigin) throw fault(403,'ORIGIN_NOT_ALLOWED','This request origin is not permitted.');
      const value=await jsonBody(req);
      const action=value.action;
      if (!['prepare','checkout','result','simulate'].includes(action)) throw fault(400,'INVALID_ACTION','Unknown action.');
      if (!liveService) liveService=createPromotionService({store:createNeonStore(env),model:createAnthropicModel(env),stripe:createStripeClient(env),env});
      // Vercel overwrites this platform header. Raw addresses are never stored or logged.
      const forwarded=env.VERCEL ? req.headers['x-vercel-forwarded-for'] : null;
      const ip=typeof forwarded==='string' ? forwarded.split(',')[0].trim() : req.socket?.remoteAddress;
      const key=req.headers['x-promotion-rehearsal-key'];
      let output;
      if(action==='prepare') output=await liveService.prepare(value,{ip,rehearsalKey:typeof key==='string'?key:undefined});
      else if(action==='simulate') output=await liveService.simulate(value,typeof key==='string'?key:undefined);
      else output=await liveService[action](value);
      res.statusCode=200;res.end(JSON.stringify(output));
    } catch(error) {
      const status=Number.isInteger(error.status)&&error.status>=400&&error.status<600?error.status:503;
      const code=typeof error.code==='string' && /^[A-Z_]+$/.test(error.code)?error.code:'SERVICE_UNAVAILABLE';
      // Only explicit domain/provider-safe messages are returned; never dump provider bodies.
      const safeMessage=error.status&&typeof error.message==='string'?error.message:'Service temporarily unavailable. Your payment has not been inferred from this error.';
      res.statusCode=status;res.end(JSON.stringify({error:{code,message:safeMessage}}));
    }
  };
}

export default createHandler();
