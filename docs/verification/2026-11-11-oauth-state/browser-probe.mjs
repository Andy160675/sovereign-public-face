import https from 'node:https';
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const dir=mkdtempSync(join(tmpdir(),'oauth-cookie-browser-'));
const cert=join(dir,'cert.pem'), key=join(dir,'key.pem');
const openssl=spawnSync('C:\\Program Files\\Git\\usr\\bin\\openssl.exe',['req','-x509','-newkey','rsa:2048','-nodes','-keyout',key,'-out',cert,'-days','1','-subj','/CN=app.audit.test'],{encoding:'utf8'});
if(openssl.status!==0)throw Error('synthetic certificate generation failed');
const report=[];
const server=https.createServer({key:readFileSync(key),cert:readFileSync(cert)},(req,res)=>{
 res.setHeader('Access-Control-Allow-Origin','https://app.audit.test:18443');
 res.setHeader('Access-Control-Allow-Credentials','true');
 res.setHeader('Cache-Control','no-store');
 if(req.url==='/legacy')res.setHeader('Set-Cookie','oauth_state=attacker; Domain=audit.test; Path=/; Secure; HttpOnly; SameSite=Lax');
 if(req.url==='/forged')res.setHeader('Set-Cookie','__Host-oauth_state=attacker; Domain=audit.test; Path=/; Secure; HttpOnly; SameSite=Lax');
 if(req.url==='/genuine')res.setHeader('Set-Cookie','__Host-oauth_state=genuine; Path=/; Secure; HttpOnly; SameSite=Lax');
 if(req.url?.startsWith('/read')) {report.push({step:req.url,cookie:req.headers.cookie??''});res.end(req.headers.cookie??'');return;}
 if(req.url==='/test'){
  res.setHeader('Content-Type','text/html');res.end(`<!doctype html><body>pending<script>(async()=>{
 const app='https://app.audit.test:18443', other='https://sibling.audit.test:18443';
 const get=url=>fetch(url,{credentials:'include'}).then(r=>r.text());
 await get(other+'/legacy');await get(app+'/read-legacy');
 await get(other+'/forged');await get(app+'/read-forged');
 await get(app+'/genuine');await get(app+'/read-genuine');
 document.body.textContent='completed';
 })().catch(e=>document.body.textContent='error:'+e.message)</script>`);return;
 }res.end('ok');
});
await new Promise((resolve,reject)=>server.listen(18443,'127.0.0.1',resolve).once('error',reject));
const chrome=spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',['--headless=new','--disable-gpu','--no-proxy-server','--disable-background-networking','--disable-component-update','--disable-extensions','--ignore-certificate-errors','--host-resolver-rules=MAP *.audit.test 127.0.0.1','--user-data-dir='+join(dir,'profile'),'--dump-dom','--virtual-time-budget=6000','https://app.audit.test:18443/test'],{stdio:['ignore','pipe','pipe']});
let output='';chrome.stdout.on('data',b=>output+=b);chrome.stderr.resume();
const timeout=setTimeout(()=>chrome.kill(),30000);
const status=await new Promise(resolve=>chrome.on('exit',resolve));
clearTimeout(timeout);await new Promise(resolve=>server.close(resolve));
const result={browser:'installed Chrome on Blade, isolated synthetic profile',status,completed:output.includes('completed'),requests:report};
const pass=report.length===3&&report[0].cookie.includes('oauth_state=attacker')&&!report[1].cookie.includes('__Host-oauth_state=attacker')&&report[2].cookie.includes('__Host-oauth_state=genuine');
console.log(JSON.stringify({...result,pass},null,2));process.exitCode=pass?0:1;
