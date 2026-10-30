import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,tick,replayChunk,steerDirection,difficultyAt,verifyRunTiming,CHECKPOINT_STEPS,MAX_CHUNK_STEPS,distance} from '../lib/game.ts';

test('continuous browser play and bounded server checkpoints produce identical results',()=>{
  const g=createGame(472491);let server=createGame(472491),moves=[];
  while(!g.ended&&g.step<20000){
    if(g.step%31===0){const direction=g.step%62===0?1:-1;moves.push({step:g.step,direction});g.direction=direction;}
    tick(g);
    if(g.ended||g.step%CHECKPOINT_STEPS===0){
      server=replayChunk(server,moves,g.step,g.ended);moves=[];
      assert.equal(server.score,g.score);assert.equal(server.lives,g.lives);assert.equal(server.catches,g.catches);
    }
  }
  assert.ok(g.ended);
});
test('impossible controls, reordered inputs, oversized chunks and forged endings fail',()=>{
  const s=createGame(1),original=JSON.stringify(s);
  assert.throws(()=>replayChunk(s,[],5,true));
  assert.throws(()=>replayChunk(s,[{step:1,direction:2}],100,false));
  assert.throws(()=>replayChunk(s,[{step:3,direction:1},{step:2,direction:-1}],100,false));
  assert.throws(()=>replayChunk(s,[{step:3,direction:1},{step:3,direction:-1}],100,false));
  assert.throws(()=>replayChunk(s,[],MAX_CHUNK_STEPS+1,false));
  assert.equal(JSON.stringify(s),original);
});
test('the engine has no time-based ending',()=>{
  for(const step of [2249,2250,3000,180000]){
    const g=createGame(2);g.step=step;g.next=step+1000;tick(g);
    assert.equal(g.ended,false);assert.equal(g.lives,3);
  }
});
test('pointer steering takes the short path across zero and stops without jitter',()=>{
  assert.equal(steerDirection(6.25,.02),1);assert.equal(steerDirection(.02,6.25),-1);
  const g=createGame(51),target=2.38;
  for(let i=0;i<100;i++){g.direction=steerDirection(g.angle,target);tick(g);}
  assert.ok(distance(g.angle,target)<=.035);assert.equal(steerDirection(g.angle,target),0);
});
test('mouse movement retains exact replay behavior across checkpoint boundaries',()=>{
  const g=createGame(2026);let server=createGame(2026),moves=[],old=0;
  while(!g.ended&&g.step<20000){
    const dir=steerDirection(g.angle,(g.step/140)%(Math.PI*2));
    if(dir!==old){moves.push({step:g.step,direction:dir});old=dir;}g.direction=dir;tick(g);
    if(g.ended||g.step%CHECKPOINT_STEPS===0){server=replayChunk(server,moves,g.step,g.ended);moves=[];}
  }
  assert.equal(server.score,g.score);assert.equal(server.catches,g.catches);assert.equal(server.lives,g.lives);
});
test('difficulty continues increasing past the former 45-second limit',()=>{
  const a=difficultyAt(0),b=difficultyAt(3000),c=difficultyAt(9000);
  assert.equal(a.multiplier,1);assert.equal(b.multiplier,1.65);assert.equal(c.multiplier,2.95);
  assert.ok(a.travelSteps>b.travelSteps&&b.travelSteps>c.travelSteps);
  assert.ok(a.spawnInterval>b.spawnInterval&&b.spawnInterval>c.spawnInterval);
  assert.ok(a.hazardChance<b.hazardChance&&b.hazardChance<c.hazardChance);
});
test('timing checks allow long active games but reject fast-forward and slow motion',()=>{
  assert.doesNotThrow(()=>verifyRunTiming(1000,122000,6000));
  assert.throws(()=>verifyRunTiming(1000,2000,6000),/too fast/);
  assert.throws(()=>verifyRunTiming(1000,130001,6000),/expired/);
});
