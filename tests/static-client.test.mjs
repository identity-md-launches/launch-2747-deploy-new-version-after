import test from 'node:test';
import assert from 'node:assert/strict';
import { createApiClient, API_ORIGIN, PUBLISHED_ORIGIN } from '../components/services/api-client.ts';

const address = '0x1234567890123456789012345678901234567890'; // Test fixture, never a recipient.
const token = '12345678-1234-4234-8234-123456789012'.repeat(2);
const message = `${new URL(PUBLISHED_ORIGIN).host} wants you to sign in with your Ethereum account:\n${address}\n\nURI: ${PUBLISHED_ORIGIN}\nVersion: 1`;
function storage() {
  const map = new Map();
  return { getItem: key => map.get(key) || null, setItem: (key,value) => map.set(key,value), removeItem: key => map.delete(key) };
}

test('published static requests use the existing API, tab bearer sessions and no cross-site cookies', async () => {
  const calls=[],saved=storage();
  const client=createApiClient({pageOrigin:PUBLISHED_ORIGIN,storage:saved,fetcher:async(url,options)=>{
    calls.push({url,options});
    return Response.json(url.endsWith('auth/verify')?{address,token}:url.endsWith('auth/session')?{address:null}:{rows:[]});
  }});
  await client.api('leaderboard');
  assert.equal(calls[0].url,`${API_ORIGIN}/api/leaderboard`);
  assert.equal(calls[0].options.credentials,'omit');
  await client.api('auth/verify',{id:'fixture',signature:'fixture'});
  await client.api('runs',{action:'start'});
  assert.equal(calls.at(-1).options.headers.get('authorization'),`Bearer ${token}`);
  const reloaded=createApiClient({pageOrigin:PUBLISHED_ORIGIN,storage:saved,fetcher:async(_,options)=>{
    assert.equal(options.headers.get('authorization'),`Bearer ${token}`);return Response.json({address});
  }});
  await reloaded.api('auth/session');
  await client.api('auth/session',undefined,'DELETE');
  await client.api('leaderboard');
  assert.equal(calls.at(-1).options.headers.has('authorization'),false);
});

test('canonical and Worker development entries retain same-origin cookie authentication',async()=>{
  for(const apiOrigin of [API_ORIGIN,'']){
    const client=createApiClient({pageOrigin:API_ORIGIN,apiOrigin,storage:{getItem(){assert.fail('No bearer storage for same-origin clients');}},fetcher:async(url,options)=>{
      assert.equal(url,'/api/auth/session');assert.equal(options.credentials,'same-origin');assert.equal(options.headers.has('authorization'),false);return Response.json({address:null});
    }});
    await client.api('auth/session');
  }
});

test('HTML failures, malformed payloads, offline errors and incompatible auth never prompt a wallet',async()=>{
  for(const fetcher of [
    async()=>new Response('<html>Bad gateway</html>',{status:502,headers:{'content-type':'text/html'}}),
    async()=>new Response('{broken',{headers:{'content-type':'application/json'}}),
    async()=>Response.json([]),async()=>Response.json(null),
    async()=>{throw new TypeError('Offline');},async()=>Response.json({address:null}),
  ]){
    let prompts=0;const client=createApiClient({pageOrigin:PUBLISHED_ORIGIN,fetcher});
    await assert.rejects(client.connectWallet({request:async()=>{prompts++;return[address];}}),/game server is unavailable/);
    assert.equal(prompts,0);
  }
});

test('healthy sign-in asks for account access and a site-bound message, without a transaction or chain switch',async()=>{
  const steps=[];
  const client=createApiClient({pageOrigin:PUBLISHED_ORIGIN,fetcher:async(url)=>{
    const path=url.split('/api/')[1];steps.push(path);
    if(path==='auth/session')return Response.json({address:null,authMode:'bearer'});
    if(path==='auth/nonce')return Response.json({id:'fixture',message});
    if(path==='auth/verify')return Response.json({address,token});
    assert.fail(path);
  }});
  await client.connectWallet({request:async data=>{
    steps.push(data.method);
    if(data.method==='personal_sign')assert.equal(Buffer.from(data.params[0].slice(2),'hex').toString(),message);
    return data.method==='eth_requestAccounts'?[address]:'fixture-signature';
  }});
  assert.deepEqual(steps,['auth/session','eth_requestAccounts','auth/nonce','personal_sign','auth/verify']);
});

test('a mismatched sign-in domain is rejected before personal_sign',async()=>{
  const methods=[];
  const client=createApiClient({pageOrigin:PUBLISHED_ORIGIN,fetcher:async url=>Response.json(url.endsWith('auth/session')?{authMode:'bearer'}:{id:'fixture',message:message.replaceAll(PUBLISHED_ORIGIN,'https://other.example')})});
  await assert.rejects(client.connectWallet({request:async data=>{methods.push(data.method);return[address];}}),/does not match this site/);
  assert.deepEqual(methods,['eth_requestAccounts']);
});

test('an expired bearer session is discarded, and blocked storage still permits an in-memory session',async()=>{
  let expired=false;
  const client=createApiClient({pageOrigin:PUBLISHED_ORIGIN,storage:{getItem(){throw Error('Blocked');},setItem(){throw Error('Blocked');},removeItem(){throw Error('Blocked');}},fetcher:async(url,options)=>{
    if(url.endsWith('auth/verify'))return Response.json({address,token});
    if(!expired){expired=true;assert.equal(options.headers.get('authorization'),`Bearer ${token}`);return Response.json({error:'Sign in again.'},{status:401});}
    assert.equal(options.headers.has('authorization'),false);return Response.json({rows:[]});
  }});
  await client.api('auth/verify',{signature:'fixture'});
  await assert.rejects(client.api('runs',{action:'start'}),/Sign in again/);
  await client.api('leaderboard');
});
