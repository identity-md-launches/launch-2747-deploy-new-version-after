import { TAU, boostRhythm, type Game, type Packet } from './game';
import { paintRunner, RUN_CYCLE_MS, RUNNER_BOUNDS, WHEEL_TIME_MS } from './hamster';
const patterns=new WeakMap<CanvasRenderingContext2D,CanvasPattern>();
const runnerFrames:Array<HTMLCanvasElement|undefined>=new Array(24);
function dot(ctx:CanvasRenderingContext2D,x:number,y:number,r:number,color:string){ctx.fillStyle=color;ctx.beginPath();ctx.arc(x,y,r,0,TAU);ctx.fill();}
function runner(ctx:CanvasRenderingContext2D,s:number,clock:number){
  // Cache the dot-matrix poses so touch input does not compete with thousands
  // of repeated limb and silhouette calculations on every animation frame.
  const index=Math.floor(((clock%RUN_CYCLE_MS+RUN_CYCLE_MS)%RUN_CYCLE_MS)/RUN_CYCLE_MS*24);
  let frame=runnerFrames[index];
  if(!frame){
    frame=document.createElement('canvas');frame.width=RUNNER_BOUNDS.width*2;frame.height=RUNNER_BOUNDS.height*2;
    const sprite=frame.getContext('2d')!;sprite.scale(2,2);sprite.translate(-RUNNER_BOUNDS.left,-RUNNER_BOUNDS.top);
    paintRunner(sprite,index*RUN_CYCLE_MS/24);runnerFrames[index]=frame;
  }
  ctx.drawImage(frame,RUNNER_BOUNDS.left*s,RUNNER_BOUNDS.top*s,RUNNER_BOUNDS.width*s,RUNNER_BOUNDS.height*s);
}
export function sceneLayout(w:number,h:number,running:boolean){
  const s=Math.min(w/(running&&w<520?470:680),h/460);
  return {s,radius:166*s,cx:running?w/2:w*.68,cy:h/2-7*s};
}
export function draw(ctx:CanvasRenderingContext2D,w:number,h:number,g:Game,running:boolean,clock:number,target?:number|null,charged=false){
  const {s,radius,cx,cy}=sceneLayout(w,h,running);
  const boost=running?g.boost:undefined,powered=!!boost||charged,golden=!!boost&&g.step<boost.orbitEnds;
  ctx.fillStyle='#070709';ctx.fillRect(0,0,w,h);
  let pattern=patterns.get(ctx);
  if(!pattern){const tile=document.createElement('canvas');tile.width=7;tile.height=7;const p=tile.getContext('2d')!;dot(p,3.5,3.5,1.02,'#202027');pattern=ctx.createPattern(tile,'repeat')!;patterns.set(ctx,pattern);}
  ctx.fillStyle=pattern;ctx.fillRect(0,0,w,h);
  ctx.save();ctx.translate(cx,cy);
  // The outer track and its tiny tick LEDs echo the Squeekchain public console.
  for(let i=0;i<144;i++){const a=i*TAU/144;dot(ctx,Math.cos(a)*radius,Math.sin(a)*radius,1.25*s,golden?'#b67f27':powered?'#66502c':'#363641');if(i%4===0)dot(ctx,Math.cos(a)*(radius+13*s),Math.sin(a)*(radius+13*s),1*s,golden?'#ffc048':'#454550');}
  ctx.strokeStyle='#22222c';ctx.lineWidth=s;ctx.beginPath();ctx.arc(0,0,radius+23*s,0,TAU);ctx.stroke();
  if(running&&target!=null){const x=Math.cos(target)*radius,y=Math.sin(target)*radius;ctx.strokeStyle='#a8baff';ctx.lineWidth=1.2*s;ctx.beginPath();ctx.arc(x,y,5*s,0,TAU);ctx.stroke();}
  if(boost){
    const wave=(g.step%boostRhythm(boost.rpm).spawnInterval)/boostRhythm(boost.rpm).spawnInterval;
    ctx.strokeStyle=`rgba(255,192,72,${(1-wave)*.22})`;ctx.lineWidth=2*s;
    ctx.beginPath();ctx.arc(0,0,(94+wave*68)*s,0,TAU);ctx.stroke();
    if(golden)for(const p of g.packets.filter(p=>p.kind==='gold')){
      const r=radius+13*s;dot(ctx,Math.cos(p.angle)*r,Math.sin(p.angle)*r,2.8*s,p.resolved?'#fff0b7':'#8f692f');
    }
  }
  const packets:Packet[]=running?g.packets:Array.from({length:6},(_,i)=>({id:i,angle:i*1.06+.3,born:0,travelSteps:95,kind:i===4?'glitch':'seed',resolved:false}));
  for(const p of packets){
    if(p.resolved)continue;const age=running?(g.step-p.born)/p.travelSteps:.35+((clock/11000+p.id*.12)%.6);if(age<0)continue;
    const r=103*s+(radius-103*s)*age,x=Math.cos(p.angle)*r,y=Math.sin(p.angle)*r;
    ctx.save();ctx.translate(x,y);ctx.rotate(p.angle+Math.PI/2);
    if(p.kind==='gold'){ctx.shadowColor='#ffc048';ctx.shadowBlur=14*s;ctx.strokeStyle='#ffe8a0';ctx.lineWidth=1.5*s;ctx.strokeRect(-4*s,-4*s,8*s,8*s);dot(ctx,0,0,2*s,'#fff0b7');}
    else if(p.kind==='seed'){ctx.shadowColor='#ffc048';ctx.shadowBlur=7*s;for(let j=-2;j<=2;j++)for(let i=-1;i<=1;i++){if(Math.abs(j)===2&&i!==0)continue;dot(ctx,i*3*s,j*3*s,1.2*s,j<0?'#ffe28a':'#ffc048');}}
    else{for(let i=-1;i<=1;i++)for(let j=-1;j<=1;j++){ctx.fillStyle=i===0&&j===0?'#a8baff':'#5b7cfa';ctx.fillRect(i*4*s-1.6*s,j*4*s-1.6*s,3.2*s,3.2*s);}}
    ctx.restore();
  }
  const angle=running?g.angle:Math.PI/2+Math.sin(clock/1700)*.3;
  const color=running&&g.step-g.hitAt<15?'#f44a5e':'#ffc048';
  ctx.shadowColor=color;ctx.shadowBlur=7*s;
  for(let lane=0;lane<3;lane++)for(let i=0;i<15;i++){const a=angle-.235+i*.0336,r=radius+(lane-1)*4*s;dot(ctx,Math.cos(a)*r,Math.sin(a)*r,1.55*s,lane===0?'#ffe28a':color);}
  ctx.shadowBlur=0;
  if(running&&g.step-g.caughtAt<22){ctx.globalAlpha=1-(g.step-g.caughtAt)/22;ctx.fillStyle='#35d07f';ctx.font=`${12*s}px 'IBM Plex Mono',monospace`;ctx.textAlign='center';ctx.fillText('+ SEED',Math.cos(g.lastCatchAngle)*(radius-22*s),Math.sin(g.lastCatchAngle)*(radius-22*s));ctx.globalAlpha=1;}
  // Inner running wheel: blue square LEDs, rotating spokes and a fixed chassis.
  const wheel=91*s,turn=clock/WHEEL_TIME_MS;ctx.save();ctx.rotate(turn);
  ctx.strokeStyle=powered?'#6b5029':'#25325b';ctx.lineWidth=.8*s;ctx.beginPath();ctx.arc(0,0,87*s,0,TAU);ctx.stroke();
  for(let i=0;i<120;i++){const a=i*TAU/120;ctx.fillStyle=powered?(i%5===0?'#fff0b7':'#e8a43a'):(i%5===0?'#a8baff':'#5b7cfa');const x=Math.cos(a)*wheel,y=Math.sin(a)*wheel;ctx.fillRect(x-1.3*s,y-1.3*s,2.6*s,2.6*s);}
  for(let spoke=0;spoke<8;spoke++){const a=spoke*TAU/8;for(let r=12;r<88;r+=7)dot(ctx,Math.cos(a)*r*s,Math.sin(a)*r*s,1.1*s,'#2c3c76');}
  ctx.restore();
  // Back feet and front feet alternate, with a subtle body bounce.
  runner(ctx,s,clock);
  for(let i=-6;i<=6;i++){dot(ctx,i*5*s,103*s,1.15*s,'#444451');}
  for(let i=0;i<4;i++){dot(ctx,-51*s+i*4*s,95*s-i*4*s,1.2*s,'#444451');dot(ctx,51*s-i*4*s,95*s-i*4*s,1.2*s,'#444451');}
  ctx.restore();
}
