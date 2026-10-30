import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,tick,replayChunk,steerDirection,difficultyAt,boostRhythm,verifyRunTiming,BOOST_STEPS,ORBIT_SEEDS,ORBIT_BONUS,CHECKPOINT_STEPS,MAX_CHUNK_STEPS,distance} from '../lib/game.ts';

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

test('Boost inputs replay identically across checkpoints, waves and golden orbits',()=>{
  const config={rpm:18,eventId:'same-hardware-event'},g=createGame(2026,config);
  let server=createGame(2026,config),moves=[],direction=0;
  while(!g.ended){
    const target=g.packets.filter(p=>!p.resolved&&p.kind!=='glitch').sort((a,b)=>(a.born+a.travelSteps)-(b.born+b.travelSteps))[0];
    const next=target?steerDirection(g.angle,target.angle):0;
    if(next!==direction){moves.push({step:g.step,direction:next});direction=next;}
    g.direction=next;tick(g);
    assert.ok(g.packets.length<40,'The live packet count stays bounded');
    if(g.ended||g.step%CHECKPOINT_STEPS===0){server=replayChunk(server,moves,g.step,g.ended);moves=[];assert.deepEqual(server,g);}
  }
  assert.equal(g.step,BOOST_STEPS);
  assert.ok(g.boost.orbits>0,'A player following the seeds can complete an orbit');
  assert.ok(g.score>0);
});

test('Boost ends at 75 seconds or earlier when hearts are lost; ordinary arcade stays endless',()=>{
  const g=createGame(4,{rpm:8,eventId:null});g.step=BOOST_STEPS-1;tick(g);
  assert.equal(g.ended,true);assert.equal(g.step,BOOST_STEPS);
  const early=createGame(4,{rpm:8,eventId:null});early.lives=0;tick(early);assert.equal(early.ended,true);
  const ordinary=createGame(4);ordinary.step=BOOST_STEPS;ordinary.next=BOOST_STEPS+50;tick(ordinary);assert.equal(ordinary.ended,false);
});

test('the golden orbit awards its bonus exactly once, and one missed seed breaks the bonus',()=>{
  function orbit(miss=-1){
    const g=createGame(51,{rpm:12,eventId:null});g.step=599;tick(g);
    for(let i=0;i<ORBIT_SEEDS;i++){
      const p=g.packets.find(p=>p.kind==='gold'&&p.id===i);
      while(g.step<p.born+p.travelSteps){g.angle=p.angle+(i===miss?Math.PI:0);tick(g);}
    }
    return g;
  }
  const perfect=orbit();assert.equal(perfect.boost.orbits,1);assert.equal(perfect.score,ORBIT_SEEDS*100+ORBIT_BONUS);
  tick(perfect);assert.equal(perfect.score,ORBIT_SEEDS*100+ORBIT_BONUS);
  const broken=orbit(5);assert.equal(broken.boost.orbits,0);assert.equal(broken.score,(ORBIT_SEEDS-1)*100);
});

test('starting RPM selects the shared wave profile and stays fixed for the whole run',()=>{
  assert.equal(boostRhythm(4).spiral,false);assert.equal(boostRhythm(24).spiral,true);
  assert.ok(boostRhythm(4).spawnInterval>boostRhythm(24).spawnInterval);
  const config={rpm:4,eventId:'one-event'},a=createGame(8,config),b=createGame(8,config);
  config.rpm=100;
  for(let i=0;i<300;i++){tick(a);tick(b);}
  assert.deepEqual(a,b);assert.equal(a.boost.rpm,4);
  assert.equal(createGame(1).boost,undefined);
});

test('charging preserves in-flight seeds and glitches, then lets them resolve before the golden chain',()=>{
  const g=createGame(51,{rpm:12,eventId:null});g.step=599;g.serial=2;
  g.packets=[
    {id:0,angle:0,born:560,travelSteps:100,kind:'seed',resolved:false},
    {id:1,angle:Math.PI,born:590,travelSteps:110,kind:'glitch',resolved:false},
  ];
  const before=structuredClone(g),packets=structuredClone(g.packets);
  tick(g);
  assert.deepEqual(g.packets.find(p=>p.id===0),packets[0]);
  assert.deepEqual(g.packets.find(p=>p.id===1),packets[1]);
  assert.deepEqual(replayChunk(before,[],600,false),g);
  const firstGold=g.packets.find(p=>p.kind==='gold');
  const lastNormalArrival=Math.max(...packets.map(p=>p.born+p.travelSteps));
  assert.ok(firstGold.born+firstGold.travelSteps>=lastNormalArrival+60,'There is time to steer from the old packets to the golden chain');
  while(g.step<lastNormalArrival){g.angle=0;tick(g);}
  assert.equal(g.catches,1,'The original seed remains collectable');
  assert.equal(g.lives,3,'The original glitch follows its original angle');
  while(g.step<lastNormalArrival+20)tick(g);
  assert.ok(!g.packets.some(p=>p.id<2),'Old packets are removed only after their flights finish');
  assert.ok(g.packets.some(p=>p.kind==='gold'));
});
