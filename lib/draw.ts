import { TAU, type Game } from './game';
const patterns=new WeakMap<CanvasRenderingContext2D,CanvasPattern>();
const runnerFrames:Array<HTMLCanvasElement|undefined>=new Array(24);
function dot(ctx:CanvasRenderingContext2D,x:number,y:number,r:number,color:string){ctx.fillStyle=color;ctx.beginPath();ctx.arc(x,y,r,0,TAU);ctx.fill();}
function lineDistance(x:number,y:number,ax:number,ay:number,bx:number,by:number){const dx=bx-ax,dy=by-ay;const t=Math.max(0,Math.min(1,((x-ax)*dx+(y-ay)*dy)/(dx*dx+dy*dy||1)));return Math.hypot(x-ax-t*dx,y-ay-t*dy);}
function ellipse(x:number,y:number,cx:number,cy:number,rx:number,ry:number){return ((x-cx)/rx)**2+((y-cy)/ry)**2<=1;}

// Original code-drawn dot-matrix sprite. Four independently phased legs land on
// the inside of the wheel; the body, head and ears bob over the foot cycle.
function paintRunner(ctx:CanvasRenderingContext2D,s:number,clock:number){
  const cycle=(clock/560)%1,bob=Math.sin(cycle*TAU*2)*0.8;
  // Roots are INSIDE the silhouette. Stance paws follow the inner tread;
  // during recovery each paw lifts, moves forward, then lands again.
  // Four-beat gait: each foot begins its recovery a quarter cycle after the last.
  // The far pair is shaded, so it reads as depth rather than a second moving outline.
  const legs=[{x:-21,y:49,offset:.5,near:false},{x:9,y:49,offset:.25,near:false},
    {x:-32,y:49,offset:0,near:true},{x:20,y:48,offset:.75,near:true}].map(l=>{
      const t=(cycle+l.offset)%1,stance=.64,recovery=Math.max(0,(t-stance)/(1-stance));
      const ease=recovery*recovery*(3-2*recovery),stride=t<stance?10-20*t/stance:-10+20*ease;
      const lift=t<stance?0:Math.sin(recovery*Math.PI)*11,footX=l.x+stride;
      return {...l,footX,footY:Math.sqrt(87*87-footX*footX)-lift,kneeX:l.x+stride*.4,kneeY:65-lift*.45};
    });
  ctx.save();ctx.scale(s,s);
  for(let y=-4;y<=90;y+=3.2)for(let x=-58;x<=60;x+=3.2){
    let color='';
    for(let i=0;i<legs.length;i++){
      const l=legs[i];
      if(lineDistance(x,y,l.x,l.y+bob,l.kneeX,l.kneeY)<3.7||lineDistance(x,y,l.kneeX,l.kneeY,l.footX,l.footY)<3.1||ellipse(x,y,l.footX,l.footY,4.8,2.6))color=l.near?'#e8b04a':'#8f6a2e';
    }
    if(ellipse(x,y,-51,47+bob,5,3))color='#bb8d40';
    if(ellipse(x,y,-12,40+bob,38,27))color=y<38?'#f7d273':'#dba43f';
    if(ellipse(x,y,-27,45+bob,23,24))color=y<42?'#f2ce5c':'#dba43f';
    if(ellipse(x,y,-4,55+bob,25,11))color='#f7e7a0';
    if(ellipse(x,y,25,31+bob,23,22))color=x>24?'#f5dc7e':'#efbe45';
    if(ellipse(x,y,19,10+bob,9,10))color='#e8b04a';
    if(ellipse(x,y,20,10+bob,4.5,6))color='#c07e72';
    if(ellipse(x,y,31,12+bob,7,9))color='#f5dc7e';
    if(ellipse(x,y,31,12+bob,3.3,5.5))color='#c07e72';
    if(ellipse(x,y,31,42+bob,13,11))color='#f7e7a0';
    if(ellipse(x,y,47,37+bob,8,7))color='#f7e7a0';
    if(ellipse(x,y,36,29+bob,3.4,3.8))color='#0b0b0d';
    if(ellipse(x,y,53,35+bob,2.8,2.6))color='#c07e72';
    if(!color||color==='#0b0b0d')continue;
    dot(ctx,x,y,1.29,color);
  }
  // One lit eye and short LED whiskers preserve the profile at small sizes.
  dot(ctx,36,29+bob,2.6,'#0b0b0d');dot(ctx,36.6,28.1+bob,.65,'#fdfbc8');
  for(const [x,y] of [[48,42],[52,43],[49,46]])dot(ctx,x,y+bob,.7,'#fdfbc8');
  ctx.restore();
}
function runner(ctx:CanvasRenderingContext2D,s:number,clock:number){
  // Cache the dot-matrix poses so touch input does not compete with thousands
  // of repeated limb and silhouette calculations on every animation frame.
  const index=Math.floor(((clock%560+560)%560)/560*24);
  let frame=runnerFrames[index];
  if(!frame){
    frame=document.createElement('canvas');frame.width=248;frame.height=200;
    const sprite=frame.getContext('2d')!;sprite.scale(2,2);sprite.translate(60,4);
    paintRunner(sprite,1,index*560/24);runnerFrames[index]=frame;
  }
  ctx.drawImage(frame,-60*s,-4*s,124*s,100*s);
}
export function sceneLayout(w:number,h:number,running:boolean){
  const s=Math.min(w/(running&&w<520?470:680),h/460);
  return {s,radius:166*s,cx:running?w/2:w*.68,cy:h/2-7*s};
}
export function draw(ctx:CanvasRenderingContext2D,w:number,h:number,g:Game,running:boolean,clock:number,rpm:number,target?:number|null){
  const {s,radius,cx,cy}=sceneLayout(w,h,running);
  ctx.fillStyle='#070709';ctx.fillRect(0,0,w,h);
  let pattern=patterns.get(ctx);
  if(!pattern){const tile=document.createElement('canvas');tile.width=7;tile.height=7;const p=tile.getContext('2d')!;dot(p,3.5,3.5,1.02,'#202027');pattern=ctx.createPattern(tile,'repeat')!;patterns.set(ctx,pattern);}
  ctx.fillStyle=pattern;ctx.fillRect(0,0,w,h);
  ctx.save();ctx.translate(cx,cy);
  // The outer track and its tiny tick LEDs echo the Squeekchain public console.
  for(let i=0;i<144;i++){const a=i*TAU/144;dot(ctx,Math.cos(a)*radius,Math.sin(a)*radius,1.25*s,'#363641');if(i%4===0)dot(ctx,Math.cos(a)*(radius+13*s),Math.sin(a)*(radius+13*s),1*s,'#454550');}
  ctx.strokeStyle='#22222c';ctx.lineWidth=s;ctx.beginPath();ctx.arc(0,0,radius+23*s,0,TAU);ctx.stroke();
  if(running&&target!=null){const x=Math.cos(target)*radius,y=Math.sin(target)*radius;ctx.strokeStyle='#a8baff';ctx.lineWidth=1.2*s;ctx.beginPath();ctx.arc(x,y,5*s,0,TAU);ctx.stroke();}
  const packets=running?g.packets:Array.from({length:6},(_,i)=>({id:i,angle:i*1.06+.3,born:0,travelSteps:95,kind:i===4?'glitch':'seed',resolved:false}));
  for(const p of packets){
    if(p.resolved)continue;const age=running?(g.step-p.born)/p.travelSteps:.35+((clock/11000+p.id*.12)%.6);if(age<0)continue;
    const r=103*s+(radius-103*s)*age,x=Math.cos(p.angle)*r,y=Math.sin(p.angle)*r;
    ctx.save();ctx.translate(x,y);ctx.rotate(p.angle+Math.PI/2);
    if(p.kind==='seed'){ctx.shadowColor='#ffc048';ctx.shadowBlur=7*s;for(let j=-2;j<=2;j++)for(let i=-1;i<=1;i++){if(Math.abs(j)===2&&i!==0)continue;dot(ctx,i*3*s,j*3*s,1.2*s,j<0?'#ffe28a':'#ffc048');}}
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
  const wheel=91*s,turn=clock/1630;ctx.save();ctx.rotate(turn);
  for(let i=0;i<120;i++){const a=i*TAU/120;ctx.fillStyle=i%5===0?'#a8baff':'#5b7cfa';const x=Math.cos(a)*wheel,y=Math.sin(a)*wheel;ctx.fillRect(x-1.3*s,y-1.3*s,2.6*s,2.6*s);}
  for(let spoke=0;spoke<8;spoke++){const a=spoke*TAU/8;for(let r=12;r<88;r+=7)dot(ctx,Math.cos(a)*r*s,Math.sin(a)*r*s,1.1*s,'#2c3c76');}
  ctx.restore();
  // Back feet and front feet alternate, with a subtle body bounce.
  runner(ctx,s,clock);
  for(let i=-6;i<=6;i++){dot(ctx,i*5*s,103*s,1.15*s,'#444451');}
  for(let i=0;i<4;i++){dot(ctx,-51*s+i*4*s,95*s-i*4*s,1.2*s,'#444451');dot(ctx,51*s-i*4*s,95*s-i*4*s,1.2*s,'#444451');}
  ctx.restore();
  ctx.fillStyle='#6e6e7a';ctx.font=`${9*Math.max(s,.65)}px 'IBM Plex Mono',monospace`;ctx.textAlign='left';ctx.fillText('WHEELY / 9000',20*s,h-19*s);ctx.textAlign='right';ctx.fillText(running?'KEEPER AVATAR / RUNNING':'KEEPER AVATAR / READY',w-20*s,h-19*s);
}
