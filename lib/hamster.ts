export const RUN_CYCLE_MS = 560;
// Milliseconds per radian: a quarter turn takes three complete strides.
export const WHEEL_TIME_MS = RUN_CYCLE_MS * 6 / Math.PI;
export const RUNNER_BOUNDS = { left: -66, top: -4, width: 132, height: 104 };
const TAU = Math.PI * 2;
const STANCE = .58;

export type Paw = {
  near: boolean; front: boolean; grounded: boolean; radius: number;
  rootX: number; rootY: number; jointX: number; jointY: number;
  x: number; y: number; angle: number;
};
export function runnerPose(clock: number) {
  const cycle = ((clock % RUN_CYCLE_MS + RUN_CYCLE_MS) % RUN_CYCLE_MS) / RUN_CYCLE_MS;
  const bob = Math.cos(cycle * TAU * 2 - .5) * 1.15;
  const pitch = Math.sin(cycle * TAU) * .026;
  const stretch = 1 + Math.sin(cycle * TAU - .4) * .018;
  function bodyPoint(x: number, y: number) {
    const dx = (x + 10) * stretch, dy = y - 49;
    return { x: -10 + dx * Math.cos(pitch) - dy * Math.sin(pitch),
      y: 49 + bob + dx * Math.sin(pitch) + dy * Math.cos(pitch) };
  }
  const paws: Paw[] = [
    { near: false, front: true, phase: .08, homeX: 31, rootX: 20, rootY: 54 },
    { near: false, front: false, phase: .60, homeX: -41, rootX: -37, rootY: 57 },
    { near: true, front: false, phase: .52, homeX: -46, rootX: -40, rootY: 58 },
    { near: true, front: true, phase: 0, homeX: 38, rootX: 24, rootY: 55 },
  ].map(leg => {
    const t = (cycle + leg.phase) % 1, radius = leg.near ? 88 : 86;
    const home = Math.asin(leg.homeX / radius), sweep = RUN_CYCLE_MS * STANCE / WHEEL_TIME_MS;
    let angle: number, lift = 0;
    if (t < STANCE) {
      // A planted foot travels with one point on the turning wheel, backwards
      // beneath the body. Its angular velocity exactly matches the tread.
      angle = home + sweep * (.5 - t / STANCE);
    } else {
      const u = (t - STANCE) / (1 - STANCE), u2 = u * u, u3 = u2 * u;
      const rear = home - sweep / 2, forward = home + sweep / 2;
      const velocity = -RUN_CYCLE_MS * (1 - STANCE) / WHEEL_TIME_MS;
      // Hermite recovery meets the contact phase with the same velocity at
      // both ends. The paw lifts toward the belly before reaching forward.
      angle = (2*u3-3*u2+1)*rear + (u3-2*u2+u)*velocity +
        (-2*u3+3*u2)*forward + (u3-u2)*velocity;
      lift = Math.sin(Math.PI * u) ** 2 * (leg.front ? 14 : 12);
    }
    const x = Math.sin(angle) * (radius - lift), y = Math.cos(angle) * (radius - lift);
    const root = bodyPoint(leg.rootX, leg.rootY), dx = x - root.x, dy = y - root.y;
    const distance = Math.hypot(dx, dy), upper = leg.front ? 14 : 16, lower = 18;
    const reach = Math.max(.01, Math.min(upper + lower - .01, distance));
    const along = (upper*upper - lower*lower + reach*reach) / (2*reach);
    const bend = Math.sqrt(Math.max(0, upper*upper - along*along)) * (leg.front ? 1 : -1);
    const ux = dx / (distance || 1), uy = dy / (distance || 1);
    return { near: leg.near, front: leg.front, grounded: t < STANCE, radius,
      rootX: root.x, rootY: root.y, jointX: root.x + ux*along - uy*bend,
      jointY: root.y + uy*along + ux*bend, x, y, angle };
  });
  return { cycle, bob, pitch, stretch, paws };
}

function ellipse(x: number, y: number, cx: number, cy: number, rx: number, ry: number) {
  return ((x-cx)/rx)**2 + ((y-cy)/ry)**2 <= 1;
}
function lineDistance(x: number, y: number, ax: number, ay: number, bx: number, by: number) {
  const dx=bx-ax,dy=by-ay,t=Math.max(0,Math.min(1,((x-ax)*dx+(y-ay)*dy)/(dx*dx+dy*dy||1)));
  return Math.hypot(x-ax-t*dx,y-ay-t*dy);
}

export function paintRunner(ctx: CanvasRenderingContext2D, clock: number) {
  const pose = runnerPose(clock), cos = Math.cos(pose.pitch), sin = Math.sin(pose.pitch);
  for (let y=0; y<=94; y+=2.8) for (let x=-63; x<=64; x+=2.8) {
    let color = '';
    for (const paw of pose.paws) {
      if (lineDistance(x,y,paw.rootX,paw.rootY,paw.jointX,paw.jointY)<3.2 ||
          lineDistance(x,y,paw.jointX,paw.jointY,paw.x,paw.y)<2.5) color=paw.near?'#d39c50':'#896337';
    }
    // Keep the torso low over the paws. Large haunches and the cream belly
    // cover the upper legs instead of exposing four long, dog-like limbs.
    const dx=x+10,dy=y-49-pose.bob;
    const bx=(dx*cos+dy*sin)/pose.stretch-10,by=-dx*sin+dy*cos+49;
    if (ellipse(bx,by,-57,56,5,2.8)) color='#d39964';
    const torso=ellipse(bx,by,-13,49,42,24)||ellipse(bx,by,-35,46,24,25);
    const belly=ellipse(bx,by,-6,61,34,13),haunch=ellipse(bx,by,-38,55,16,18);
    const shoulder=ellipse(bx,by,15,49,25,22),head=ellipse(bx,by,35,39,21,19);
    const muzzle=ellipse(bx,by,44,48,14,10)||ellipse(bx,by,55,44,7,5);
    if (torso) color=by<47?'#f1c86c':'#d79c41';
    if (belly) color='#f7e8af';
    if (haunch) color=by<55?'#e8b555':'#d4a052';
    if (shoulder) color=by<44?'#efbe60':'#e3ad50';
    if (head) color=bx>34?'#f6d77b':'#e9b653';
    if (ellipse(bx,by,29,23,8,9)) color='#b8834e';
    if (ellipse(bx,by,30,24,4.2,5.2)) color='#cc9490';
    if (ellipse(bx,by,38,25,5,7)) color='#efc66b';
    if (ellipse(bx,by,39,26,2.4,4.2)) color='#d8a39a';
    if (muzzle) color='#fff0bd';
    if (ellipse(bx,by,44,35,3.4,4)) color='#151119';
    if (ellipse(bx,by,60,43,2.5,2)) color='#ce8a85';
    // Small pale paws remain visible outside the silhouette; each is aligned
    // to the tangent of the wheel rather than drawn flat against the screen.
    for (const paw of pose.paws) {
      const px=x-paw.x,py=y-paw.y,c=Math.cos(paw.angle),s=Math.sin(paw.angle);
      const covered=torso||belly||haunch||shoulder||head||muzzle;
      if ((!covered || paw.near&&by>71) && ellipse(px*c-py*s,px*s+py*c,0,0,4.1,1.9)) color=paw.near?'#f0c3a0':'#ac8259';
    }
    if (!color || color==='#151119') continue;
    ctx.fillStyle=color;ctx.beginPath();ctx.arc(x,y,1.15,0,TAU);ctx.fill();
  }
  // Resolve the eye at full sprite resolution instead of losing it in the LED grid.
  const dx=(44+10)*pose.stretch,dy=35-49;
  const eyeX=-10+dx*cos-dy*sin,eyeY=49+pose.bob+dx*sin+dy*cos;
  ctx.fillStyle='#151119';ctx.beginPath();ctx.arc(eyeX,eyeY,3,0,TAU);ctx.fill();
  ctx.fillStyle='#fff8db';ctx.beginPath();ctx.arc(eyeX+.7,eyeY-.8,.85,0,TAU);ctx.fill();
}
