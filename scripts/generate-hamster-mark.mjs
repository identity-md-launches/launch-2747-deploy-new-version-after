import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Use the same round gold LEDs and square blue LEDs as the title and wheel.
// Coarse cells and dark eye sockets keep the face legible at 24–32 pixels.
const ellipse=(x,y,cx,cy,rx,ry)=>((x-cx)/rx)**2+((y-cy)/ry)**2<=1;
const ear=(x,y,cx,angle,inner=false)=>{
  const dx=x-cx,dy=y-12.5,c=Math.cos(angle),s=Math.sin(angle);
  return ellipse(dx*c+dy*s,-dx*s+dy*c,0,0,inner?1.45:3.1,inner?2.25:4.2);
};
const dot=(x,y,r,fill)=>`<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}"/>`;
const cells=[];
for(let y=7;y<=35;y+=2)for(let x=5;x<=35;x+=2){
  let color='';
  const ears=ear(x,y,12,-.22)||ear(x,y,28,.22);
  const head=ellipse(x,y,20,23,12,10)||ellipse(x,y,12,26,5,5)||ellipse(x,y,28,26,5,5);
  if(ears||head)color='url(#fur-led)';
  if(ear(x,y,12,-.22,true)||ear(x,y,28,.22,true))color='#c4938b';
  if(head&&(ellipse(x,y,15,28,5,5)||ellipse(x,y,25,28,5,5)||ellipse(x,y,20,29,7,4.5)))color='#fff0bd';
  if(ellipse(x,y,13.8,22,2.8,3.4)||ellipse(x,y,26.2,22,2.8,3.4))color='';
  if(ellipse(x,y,20,26,2.2,1.5))color='#d49a98';
  if(ellipse(x,y,20,29,3,1.6))color='';
  if(color)cells.push(dot(x,y,.77,color));
}
cells.push(dot(13,21,.65,'#fff8db'),dot(25,21,.65,'#fff8db'));
for(const x of [19,21])for(const y of [31,33])cells.push(dot(x,y,.77,'#fffaf0'));
for(const [x,y] of [[5,25],[7,25],[5,29],[35,25],[33,25],[35,29]])cells.push(dot(x,y,.55,'#bda674'));
const rim=Array.from({length:32},(_,i)=>{
  const a=i*Math.PI/16,x=20+Math.cos(a)*18.2-.7,y=20+Math.sin(a)*18.2-.7;
  return `<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="1.4" height="1.4" fill="${i%4===0?'#a8baff':'#5b7cfa'}"/>`;
}).join('');
const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40">
  <defs><linearGradient id="fur-led" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#ffe28a"/><stop offset="1" stop-color="#e8a43a"/></linearGradient></defs>
  <rect width="40" height="40" rx="8" fill="#0b0b0d"/>
  ${rim}
  ${cells.join('\n  ')}
</svg>\n`;
for(const name of ['hamster-mark.svg','favicon.svg'])writeFileSync(fileURLToPath(new URL(`../public/${name}`,import.meta.url)),svg);
console.log('Generated the LED hamster face and favicon.');
