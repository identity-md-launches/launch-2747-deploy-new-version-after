// Production smoke check. Uses a disposable wallet, signs a message only,
// and never submits a score or creates a transaction.
import assert from 'node:assert/strict';
import {Agent, request} from 'node:https';
import {isIP} from 'node:net';
import {generatePrivateKey, privateKeyToAccount} from 'viem/accounts';

const origin=new URL('https://wheelkeepers.dpdns.org');
const ip=process.argv[2];
if(ip&&!isIP(ip))throw new Error('Optional argument must be a resolved IP address.');
// Explicit DNS lookup keeps the normal TLS hostname/certificate verification.
const agent=new Agent(ip?{lookup:(_host,options,done)=>options.all
  ?done(null,[{address:ip,family:isIP(ip)}]):done(null,ip,isIP(ip))}:{});
const wallet=privateKeyToAccount(generatePrivateKey());
let cookie='';
function call(path,{method='GET',data,headers={}}={}){
  return new Promise((resolve,reject)=>{
    const body=data===undefined?undefined:JSON.stringify(data);
    const req=request(new URL(path,origin),{method,agent,headers:{
      ...(body?{'content-type':'application/json','content-length':Buffer.byteLength(body)}:{}),
      ...(cookie?{cookie}:{}),...headers,
    }},res=>{
      let text='';res.setEncoding('utf8');res.on('data',part=>text+=part);
      res.on('error',reject);res.on('end',()=>{
        let json;try{json=JSON.parse(text);}catch{}
        resolve({status:res.statusCode,headers:res.headers,text,json});
      });
    });
    req.setTimeout(15000,()=>req.destroy(new Error('HTTPS request timed out.')));
    req.on('error',reject);req.end(body);
  });
}
try{
  const home=await call('/');assert.equal(home.status,200);
  assert.match(home.text,/Wheelkeepers/);assert.doesNotMatch(home.text,/@vite\/client/);
  for(const pattern of [/<script[^>]+src="([^"]+)"/,/href="([^"]+\.css[^"]*)"/]){
    const asset=home.text.match(pattern)?.[1];assert.ok(asset?.startsWith('/'));
    assert.equal((await call(asset)).status,200);
  }
  const pulse=await call('/api/pulse');assert.equal(pulse.status,200);
  assert.equal(typeof pulse.json.available,'boolean');
  const before=await call('/api/leaderboard');assert.equal(before.status,200);
  assert.ok(Array.isArray(before.json.rows));
  assert.equal((await call('/api/auth/session')).json.address,null);
  assert.equal((await call('/api/runs',{method:'POST',data:{action:'start'}})).status,401);
  const cross=await call('/api/auth/nonce',{method:'POST',data:{address:wallet.address},headers:{origin:'https://foreign.invalid'}});
  assert.equal(cross.status,400);
  console.log('PASS: HTTPS, static HTML/JS/CSS, live feed, leaderboard, guest and origin protection');

  const nonce=await call('/api/auth/nonce',{method:'POST',data:{address:wallet.address}});
  assert.equal(nonce.status,200,nonce.text);assert.ok(nonce.json.message.startsWith(origin.host));
  const signature=await wallet.signMessage({message:nonce.json.message});
  const payload={id:nonce.json.id,signature};
  const verified=await call('/api/auth/verify',{method:'POST',data:payload});
  assert.equal(verified.status,200,verified.text);
  const setCookie=verified.headers['set-cookie']?.[0];
  assert.ok(setCookie);cookie=setCookie.split(';')[0];
  assert.match(setCookie,/; Secure/i);assert.match(setCookie,/; HttpOnly/i);assert.match(setCookie,/; SameSite=Lax/i);
  assert.equal((await call('/api/auth/session')).json.address,wallet.address.toLowerCase());
  assert.equal((await call('/api/auth/verify',{method:'POST',data:payload})).status,401);
  const after=await call('/api/leaderboard');assert.equal(after.json.total,before.json.total);
  assert.equal(after.json.me,null);
  console.log('PASS: disposable wallet signature, secure session and nonce replay protection; no score submitted');
}finally{
  if(cookie){
    assert.equal((await call('/api/auth/session',{method:'DELETE'})).status,200);
    assert.equal((await call('/api/auth/session')).json.address,null);
    console.log('PASS: sign-out and session revocation');
  }
  agent.destroy();
}
