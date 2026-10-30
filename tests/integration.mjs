// Disposable local-only wallet: no user wallet, funds or production records.
import assert from 'node:assert/strict';
import {generatePrivateKey,privateKeyToAccount} from 'viem/accounts';
import {createGame,tick,steerDirection,CHECKPOINT_STEPS} from '../lib/game.ts';
const base='http://127.0.0.1:5173/api/',account=privateKeyToAccount(generatePrivateKey());let cookie='';
async function request(path,data,extra={}){
  const r=await fetch(base+path,{method:data?'POST':'GET',headers:{'content-type':'application/json',...(cookie?{cookie}:{}),...extra},body:data?JSON.stringify(data):undefined});
  const raw=await r.text();let parsed;try{parsed=JSON.parse(raw);}catch{parsed={error:raw};}
  return {status:r.status,data:parsed,cookie:r.headers.get('set-cookie')};
}
assert.equal((await request('runs',{action:'start'})).status,401);
assert.ok([400,403].includes((await request('auth/nonce',{address:account.address},{origin:'https://foreign.invalid'})).status));
const nonce=await request('auth/nonce',{address:account.address});assert.equal(nonce.status,200);
const signature=await account.signMessage({message:nonce.data.message});
const verified=await request('auth/verify',{id:nonce.data.id,signature});assert.equal(verified.status,200);cookie=verified.cookie.split(';')[0];
assert.equal((await request('auth/verify',{id:nonce.data.id,signature})).status,401);
console.log('PASS: wallet authentication, nonce replay protection, cross-origin protection');
const abandoned=await request('runs',{action:'start'}),start=await request('runs',{action:'start'}),began=Date.now();
assert.equal(start.status,200,JSON.stringify(start.data));assert.notEqual(start.data.seed,abandoned.data.seed);
const common={action:'checkpoint',id:start.data.id,sequence:1,throughStep:400,moves:[],finished:false};
assert.equal((await request('runs',{...common,id:abandoned.data.id})).status,400);
assert.equal((await request('runs',{...common,sequence:2})).status,400);
assert.equal((await request('runs',{...common,moves:[{step:0,direction:999}]})).status,400);
assert.equal((await request('runs',{...common,throughStep:1000000})).status,400);
console.log('PASS: unique courses, replaced runs, invalid sequence, impossible controls, CPU-work bound');
const g=createGame(start.data.seed);let moves=[],sequence=0,old=0,checkedFast=false;
while(!g.ended&&g.step<6000){
  // Collect initially, then intentionally catch hazards so this check finishes
  // promptly while still exercising multiple real-time checkpoints.
  const kind=g.step<800?'seed':'glitch';
  const target=g.packets.filter(p=>!p.resolved&&p.kind===kind).sort((a,b)=>a.born-b.born)[0];
  const dir=target?steerDirection(g.angle,target.angle):0;
  if(dir!==old){moves.push({step:g.step,direction:dir});old=dir;}g.direction=dir;tick(g);
  if(g.ended||g.step%CHECKPOINT_STEPS===0){
    const payload={action:'checkpoint',id:start.data.id,sequence:++sequence,throughStep:g.step,moves,finished:g.ended,score:999999999,lives:999,timer:0};
    if(!checkedFast){const fast=await request('runs',payload);assert.equal(fast.status,400);assert.match(fast.data.error,/timing/);checkedFast=true;console.log('PASS: accelerated checkpoint rejected');}
    await new Promise(resolve=>setTimeout(resolve,Math.max(0,began+g.step*20+300-Date.now())));
    const saved=await request('runs',payload);assert.equal(saved.status,200,JSON.stringify(saved.data));
    assert.equal(saved.data.score,g.score);assert.equal(saved.data.lives,g.lives);assert.equal(saved.data.finished,g.ended);
    const duplicate=await request('runs',payload);assert.equal(duplicate.status,200);assert.equal(duplicate.data.score,g.score);
    const altered=await request('runs',{...payload,throughStep:g.step+1});assert.equal(altered.status,400);
    console.log('PASS: checkpoint',sequence,'step',g.step,'score',g.score,'lives',g.lives);
    moves=[];
  }
}
assert.ok(g.ended,'Test controller should eventually lose its three hearts');
const board=await request('leaderboard');assert.equal(board.data.me.score,g.score);assert.equal(board.data.me.played,1);
console.log('ALL INTEGRATION CHECKS PASSED: authoritative streamed score, forged stats ignored, idempotent save');
