import test from 'node:test';
import assert from 'node:assert/strict';
import { runnerPose, paintRunner, RUN_CYCLE_MS, WHEEL_TIME_MS, RUNNER_BOUNDS } from '../lib/hamster.ts';

test('planted paws follow the rotating tread at normal and Boost speeds', () => {
  for (const speed of [1, 1.4, 2.4]) for (let time=0; time<RUN_CYCLE_MS; time+=3) {
    const a=runnerPose(time),b=runnerPose(time+speed);
    for (let i=0;i<a.paws.length;i++) {
      const paw=a.paws[i],next=b.paws[i];
      if (!paw.grounded || !next.grounded) continue;
      assert.ok(Math.abs(Math.hypot(paw.x,paw.y)-paw.radius)<1e-8);
      assert.ok(Math.abs((next.angle-paw.angle)+speed/WHEEL_TIME_MS)<1e-8,'A planted paw must move with the wheel, without sliding');
    }
  }
});

test('paws recover inside the wheel, joints stay connected, and the loop has no position jump', () => {
  for (let time=0;time<RUN_CYCLE_MS;time+=2) for (const paw of runnerPose(time).paws) {
    assert.ok(Math.hypot(paw.x,paw.y)<=paw.radius+1e-8);
    assert.ok(Math.abs(Math.hypot(paw.jointX-paw.rootX,paw.jointY-paw.rootY)-(paw.front?14:16))<1e-8);
    assert.ok(Math.abs(Math.hypot(paw.x-paw.jointX,paw.y-paw.jointY)-18)<1e-8);
  }
  assert.deepEqual(runnerPose(0),runnerPose(RUN_CYCLE_MS));
  const before=runnerPose(RUN_CYCLE_MS-.01),after=runnerPose(.01);
  for(let i=0;i<4;i++)assert.ok(Math.hypot(before.paws[i].x-after.paws[i].x,before.paws[i].y-after.paws[i].y)<.1);
  assert.ok(Math.abs(after.pitch-before.pitch)<.001);
});

test('every cached pose fits the sprite canvas, including paws, ears and eye highlights', () => {
  let dots=0;
  const ctx={fillStyle:'',beginPath(){},arc(x,y,r){
    assert.ok(x-r>=RUNNER_BOUNDS.left&&x+r<=RUNNER_BOUNDS.left+RUNNER_BOUNDS.width);
    assert.ok(y-r>=RUNNER_BOUNDS.top&&y+r<=RUNNER_BOUNDS.top+RUNNER_BOUNDS.height);
    dots++;
  },fill(){}};
  for(let i=0;i<24;i++)paintRunner(ctx,i*RUN_CYCLE_MS/24);
  assert.ok(dots>24*300);
});
