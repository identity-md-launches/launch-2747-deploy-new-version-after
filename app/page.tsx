'use client';
import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { ArrowUpRight, ExternalLink, Heart, Loader2, Play, RotateCcw, ShieldCheck, Trophy, Volume2, VolumeX, Wallet, X, Zap } from 'lucide-react';
import { createGame, tick, steerDirection, difficultyAt, CHECKPOINT_STEPS, STEP_MS, type Game, type Move } from '@/lib/game';
import { draw, sceneLayout } from '@/lib/draw';
import type { Pulse } from '@/lib/server';
type Provider = { request: (d: {method: string; params?: unknown[]}) => Promise<any>; on?: (event: string, fn: (...args: any[]) => void) => void; removeListener?: (event: string, fn: (...args: any[]) => void) => void };
type Row = {address: string; score: number; catches: number; played: number};
type RunChannel={id:string;sequence:number;cursor:number;queue:Promise<void>;failed:boolean;error:string};
const short = (s: string) => `${s.slice(0,6)}…${s.slice(-4)}`;
async function api(path: string, data?: unknown, method?: string) {
  const r = await fetch(`/api/${path}`, data || method ? {method: method || 'POST', headers: {'Content-Type':'application/json'}, body: data ? JSON.stringify(data) : undefined} : {cache:'no-store'});
  const d = await r.json() as any; if(!r.ok) throw new Error(d.error || 'Please try again.'); return d;
}
function Hamster({size=38}: {size?:number}) {
  const cells=[];
  for(let y=12;y<56;y+=3)for(let x=7;x<59;x+=3){
    const body=((x-26)/20)**2+((y-35)/13)**2<1,head=((x-45)/12)**2+((y-29)/12)**2<1,ear=((x-42)/6)**2+((y-16)/7)**2<1;
    const paw=y>44&&y<52&&((x>16&&x<23)||(x>40&&x<47));
    if(body||head||ear||paw)cells.push(<circle key={`${x}-${y}`} cx={x} cy={y} r={1.15} fill={x>48&&y<28?'#0b0b0d':y<31?'#ffe28a':'#ffc048'}/>);
  }
  return <svg width={size} height={size} viewBox="0 0 66 66" aria-hidden="true"><g fill="#5b7cfa">{Array.from({length:32},(_,i)=>{const a=i*Math.PI/16;return <rect key={i} x={33+Math.cos(a)*31-1} y={33+Math.sin(a)*31-1} width="2" height="2"/>;})}</g>{cells}</svg>;
}
const letters:Record<string,string[]>={W:['10001','10001','10001','10101','10101','11011','10001'],H:['10001','10001','10001','11111','10001','10001','10001'],E:['11111','10000','10000','11110','10000','10000','11111'],L:['10000','10000','10000','10000','10000','10000','11111'],K:['10001','10010','10100','11000','10100','10010','10001'],P:['11110','10001','10001','11110','10000','10000','10000'],R:['11110','10001','10001','11110','10100','10010','10001'],S:['01111','10000','10000','01110','00001','00001','11110']};
function DotTitle(){return <svg className="dot-title" viewBox="0 0 420 158" role="img" aria-label="Wheelkeepers"><defs><linearGradient id="gold-led" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#ffe28a"/><stop offset="1" stopColor="#e8a43a"/></linearGradient><linearGradient id="blue-led" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#a8baff"/><stop offset="1" stopColor="#4460cf"/></linearGradient></defs>{['WHEEL','KEEPERS'].map((word,row)=><g key={word} fill={`url(#${row?'blue':'gold'}-led)`}>{Array.from(word).flatMap((l,i)=>letters[l].flatMap((r,y)=>Array.from(r).map((v,x)=>v==='1'?<g key={`${i}-${x}-${y}`}>{Array.from({length:9},(_,n)=>row?<rect key={n} x={i*60+x*10+1.5+(n%3)*3.15} y={row*82+y*10+2.5+Math.floor(n/3)*3.15} width="2.5" height="2.5"/>:<circle key={n} cx={i*60+x*10+2.8+(n%3)*3.15} cy={y*10+3.8+Math.floor(n/3)*3.15} r="1.3"/>)}</g>:null)))}</g>)}</svg>;}
export default function Home() {
  const canvas=useRef<HTMLCanvasElement>(null),game=useRef<Game>(createGame(48)),moves=useRef<Move[]>([]),playing=useRef(false),runId=useRef<string|null>(null);
  const pointer=useRef<{angle:number;held:boolean}|null>(null);
  const channel=useRef<RunChannel|null>(null),checkpointRef=useRef<(g:Game,finished:boolean)=>void>(()=>{});
  const [saving,setSaving]=useState(false);
  const liveRef=useRef<Pulse|null>(null),providerRef=useRef<Provider|null>(null),finishRef=useRef<(g:Game)=>void>(()=>{}),soundRef=useRef(false),audio=useRef<AudioContext|null>(null);
  const [phase,setPhase]=useState<'ready'|'playing'|'finished'>('ready'),[hud,setHud]=useState({score:0,lives:3,catches:0,combo:0,pace:1,stage:1});
  const [live,setLive]=useState<Pulse|null>(null),[address,setAddress]=useState<string|null>(null),[rows,setRows]=useState<Row[]>([]),[total,setTotal]=useState(0),[me,setMe]=useState<Row|null>(null);
  const [best,setBest]=useState(0),[busy,setBusy]=useState(false),[walletOpen,setWalletOpen]=useState(false),[wallets,setWallets]=useState<{name:string;provider:Provider}[]>([]);
  const [toast,setToast]=useState(''),[saved,setSaved]=useState(''),[sound,setSound]=useState(false),[help,setHelp]=useState(false),[boardError,setBoardError]=useState(false);
  const note=useCallback((s:string)=>setToast(s),[]);
  useEffect(()=>{
    if(!walletOpen&&!help)return;
    const previous=document.activeElement as HTMLElement|null;
    const dialog=document.querySelector('.modal') as HTMLElement|null;
    const buttons=()=>Array.from(dialog?.querySelectorAll<HTMLElement>('button:not(:disabled),a[href]')||[]);
    buttons()[0]?.focus();
    const key=(e:KeyboardEvent)=>{
      if(e.key==='Escape'){setWalletOpen(false);setHelp(false);}
      if(e.key==='Tab'){const b=buttons(),first=b[0],last=b.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}
    };
    document.addEventListener('keydown',key);return()=>{document.removeEventListener('keydown',key);previous?.focus();};
  },[walletOpen,help]);
  const refreshBoard=useCallback(async()=>{try{const d=await api('leaderboard');setRows(d.rows);setTotal(d.total);setMe(d.me);setBoardError(false);}catch{setBoardError(true);}},[]);
  useEffect(()=>{if(!toast)return;const t=setTimeout(()=>setToast(''),6500);return()=>clearTimeout(t);},[toast]);
  useEffect(()=>{
    try{setBest(Number(localStorage.getItem('wk-best')||0));}catch{}
    api('auth/session').then(d=>setAddress(d.address)).catch(()=>{});refreshBoard();
    async function poll(){try{const d=await api('pulse');setLive(d);liveRef.current=d;}catch{setLive(null);liveRef.current=null;}}
    poll();const interval=setInterval(()=>{if(!document.hidden){poll();refreshBoard();}},12000);
    const discover=(e:Event)=>{const d=(e as CustomEvent).detail;if(d?.info?.name&&d?.provider?.request)setWallets(old=>old.some(w=>w.provider===d.provider)?old:[...old,{name:String(d.info.name),provider:d.provider}]);};
    window.addEventListener('eip6963:announceProvider',discover);window.dispatchEvent(new Event('eip6963:requestProvider'));
    const eth=(window as any).ethereum;if(eth)setWallets(old=>old.length?old:[{name:eth.isMetaMask?'MetaMask':eth.isRabby?'Rabby':'Browser wallet',provider:eth}]);
    return()=>{clearInterval(interval);window.removeEventListener('eip6963:announceProvider',discover);};
  },[refreshBoard]);
  const direction=useCallback((v:-1|0|1)=>{
    if(!playing.current||game.current.direction===v)return;game.current.direction=v;
    const m={step:game.current.step,direction:v};if(moves.current.at(-1)?.step===m.step)moves.current[moves.current.length-1]=m;else moves.current.push(m);
  },[]);
  function aim(e:ReactPointerEvent<HTMLCanvasElement>,held=false){
    if(!playing.current||!e.isPrimary)return;
    if(e.pointerType!=='mouse'&&!held&&!pointer.current?.held)return;
    const r=e.currentTarget.getBoundingClientRect(),layout=sceneLayout(r.width,r.height,true);
    const x=e.clientX-r.left-layout.cx,y=e.clientY-r.top-layout.cy;
    if(Math.hypot(x,y)<20){if(held)pointer.current={angle:game.current.angle,held:true};return;}
    pointer.current={angle:Math.atan2(y,x),held:held||!!pointer.current?.held};
  }
  const releasePointer=useCallback(()=>{pointer.current=null;direction(0);},[direction]);
  useEffect(()=>{
    const held=new Set<string>();
    const keyboardDirection=()=>{const left=['ArrowLeft','a','A'].some(k=>held.has(k)),right=['ArrowRight','d','D'].some(k=>held.has(k));direction(left===right?0:left?-1:1);};
    const down=(e:KeyboardEvent)=>{if(!playing.current)return;if(['ArrowLeft','a','A','ArrowRight','d','D'].includes(e.key)){e.preventDefault();pointer.current=null;held.add(e.key);keyboardDirection();}};
    const up=(e:KeyboardEvent)=>{if(held.delete(e.key)&&!pointer.current)keyboardDirection();};
    const blur=()=>{held.clear();releasePointer();};
    window.addEventListener('keydown',down);window.addEventListener('keyup',up);window.addEventListener('blur',blur);
    const visibility=()=>{if(document.hidden)blur();};document.addEventListener('visibilitychange',visibility);
    return()=>{window.removeEventListener('keydown',down);window.removeEventListener('keyup',up);window.removeEventListener('blur',blur);document.removeEventListener('visibilitychange',visibility);};
  },[direction,releasePointer]);
  function beep(hz:number){if(!soundRef.current)return;try{audio.current||=new AudioContext();const ac=audio.current,o=ac.createOscillator(),gain=ac.createGain();o.frequency.value=hz;gain.gain.setValueAtTime(.045,ac.currentTime);gain.gain.exponentialRampToValueAtTime(.001,ac.currentTime+.1);o.connect(gain);gain.connect(ac.destination);o.start();o.stop(ac.currentTime+.1);}catch{}}
  checkpointRef.current=(g,finished)=>{
    const active=channel.current;
    if(!active||active.failed){
      moves.current=[];
      if(finished)setSaved(active?.error||'Practice result · saved on this device');
      return;
    }
    if(g.step<=active.cursor)return;
    const from=active.cursor,through=g.step;
    const chunk=moves.current.filter(m=>m.step>=from&&m.step<through);
    moves.current=moves.current.filter(m=>m.step>=through);
    const payload={action:'checkpoint',id:active.id,sequence:++active.sequence,throughStep:through,moves:chunk,finished};
    const expected={score:g.score,catches:g.catches,lives:g.lives};active.cursor=through;
    if(finished){setSaving(true);setSaved('Verifying your final checkpoint…');}
    active.queue=active.queue.then(async()=>{
      if(active.failed)return;
      let result:any;
      for(let attempt=0;attempt<2;attempt++){
        try{result=await api('runs',payload);break;}
        catch(e){if(attempt===1)throw e;await new Promise(resolve=>setTimeout(resolve,700));}
      }
      if(result.step!==through||result.score!==expected.score||result.catches!==expected.catches||result.lives!==expected.lives)throw new Error('The server could not verify this run. Practice continues.');
      if(finished&&channel.current===active){setSaving(false);setSaved(`Verified · ${result.score.toLocaleString()} points saved to the board`);refreshBoard();}
    }).catch((e:Error)=>{
      active.failed=true;active.error=e.message||'Run verification was interrupted. This result stays on your device.';
      if(channel.current===active){runId.current=null;setSaving(false);setSaved(active.error);note(active.error);}
    });
  };
  finishRef.current=g=>{
    setPhase('finished');setHud({score:g.score,lives:g.lives,catches:g.catches,combo:g.combo,pace:difficultyAt(g.step).multiplier,stage:difficultyAt(g.step).stage});
    setBest(old=>{const n=Math.max(old,g.score);try{localStorage.setItem('wk-best',String(n));}catch{}return n;});
    checkpointRef.current(g,true);
  };
  useEffect(()=>{
    const el=canvas.current;if(!el)return;const ctx=el.getContext('2d');if(!ctx)return;
    let width=680,height=460,frame=0,last=performance.now(),acc=0,motionClock=0;
    const resize=()=>{width=el.clientWidth;height=el.clientHeight;const ratio=Math.min(window.devicePixelRatio||1,2);el.width=width*ratio;el.height=height*ratio;ctx.setTransform(ratio,0,0,ratio,0,0);};
    const observer=new ResizeObserver(resize);observer.observe(el);resize();
    const animate=(now:number)=>{
      const delta=Math.min(100,now-last);last=now;motionClock+=delta*(playing.current?difficultyAt(game.current.step).multiplier:1);
      if(playing.current){acc+=delta;while(acc>=STEP_MS&&playing.current){const c=game.current.catches,l=game.current.lives;if(pointer.current)direction(steerDirection(game.current.angle,pointer.current.angle));tick(game.current);acc-=STEP_MS;if(game.current.catches>c)beep(680);if(game.current.lives<l)beep(130);
        if(game.current.step%5===0){const g=game.current;setHud({score:g.score,lives:g.lives,catches:g.catches,combo:g.combo,pace:difficultyAt(g.step).multiplier,stage:difficultyAt(g.step).stage});}
        if(!game.current.ended&&game.current.step%CHECKPOINT_STEPS===0)checkpointRef.current(game.current,false);
        if(game.current.ended){playing.current=false;finishRef.current(game.current);}}}else acc=0;
      draw(ctx,width,height,game.current,playing.current,window.matchMedia('(prefers-reduced-motion: reduce)').matches?0:motionClock,liveRef.current?.rpm||0,pointer.current?.angle);frame=requestAnimationFrame(animate);
    };frame=requestAnimationFrame(animate);return()=>{cancelAnimationFrame(frame);observer.disconnect();};
  },[direction]);
  async function connect(provider:Provider){
    setBusy(true);try{
      const accounts=await provider.request({method:'eth_requestAccounts'});if(!accounts?.[0])throw new Error('No wallet selected.');
      const nonce=await api('auth/nonce',{address:accounts[0]});const hex='0x'+Array.from(new TextEncoder().encode(nonce.message),b=>b.toString(16).padStart(2,'0')).join('');
      const signature=await provider.request({method:'personal_sign',params:[hex,accounts[0]]});const session=await api('auth/verify',{id:nonce.id,signature});
      providerRef.current=provider;setAddress(session.address);setWalletOpen(false);refreshBoard();note('Signed in. Your next run counts toward the leaderboard.');
    }catch(e:any){note(e?.code===4001?'Sign-in cancelled. Practice is still open.':e?.message||'Could not connect wallet.');}finally{setBusy(false);}
  }
  async function disconnect(){try{await api('auth/session',undefined,'DELETE');setAddress(null);setMe(null);providerRef.current=null;note('Signed out.');}catch(e){note((e as Error).message);}}
  useEffect(()=>{
    const p=providerRef.current||(window as any).ethereum;if(!p?.on)return;
    const change=()=>{api('auth/session',undefined,'DELETE').catch(()=>{});setAddress(null);setMe(null);note('Wallet changed. Sign in again for ranked runs.');};
    p.on('accountsChanged',change);p.on('disconnect',change);return()=>{p.removeListener?.('accountsChanged',change);p.removeListener?.('disconnect',change);};
  },[address,note]);
  async function start(practice=false){
    if(playing.current||busy||saving)return;setBusy(true);setSaved('');
    try{let seed=live?.seed||Math.floor(Date.now()/86400000),id=null;
      if(address&&!practice){const r=await api('runs',{action:'start'});seed=r.seed;id=r.id;}
      game.current=createGame(seed);moves.current=[];pointer.current=null;runId.current=id;channel.current=id?{id,sequence:0,cursor:0,queue:Promise.resolve(),failed:false,error:''}:null;setHud({score:0,lives:3,catches:0,combo:0,pace:1,stage:1});setPhase('playing');playing.current=true;
      if(soundRef.current){audio.current||=new AudioContext();audio.current.resume().catch(()=>{});}
      if(window.innerWidth<760)document.querySelector('#arcade')?.scrollIntoView({behavior:'smooth',block:'start'});
    }catch(e){note((e as Error).message);}finally{setBusy(false);}
  }
  const isLive=live?.available,label=live?.state==='resting'?'Hamster is resting':live?.state==='running'?'Hamster is running':'Live feed unavailable';
  return <div className="site-shell">
    <header className="topbar"><a href="#" className="brand" aria-label="Wheelkeepers home"><span className="brand-icon"><Hamster size={32}/></span><span>WHEELKEEPERS<span className="brand-sub">SQUEEKCHAIN COMMUNITY ARCADE</span></span></a><nav><a href="#leaderboard">Leaderboard <ArrowUpRight size={14}/></a><button onClick={()=>setHelp(true)}>How to play</button></nav><button className={`wallet-button ${address?'connected':''}`} disabled={busy||phase==='playing'} onClick={()=>address?disconnect():setWalletOpen(true)}><Wallet size={16}/>{address?short(address):'Connect wallet'}{address&&<i className="status-dot"/>}</button></header>
    <main>
      <section className="intro"><div><div className="eyebrow"><i/> ONE HAMSTER. ENDLESS POSSIBILITIES.</div><h1><DotTitle/></h1></div><div className="intro-copy"><h2>KEEP THE WHEEL ALIVE.</h2><p>Catch seeds. Dodge interference.<br/>An arcade powered by a real hamster.</p><div className="intro-tags"><span><Zap size={12}/> Free to play</span><span><ShieldCheck size={12}/> Gasless sign-in</span></div></div></section>
      <div className="workspace"><section className="arcade" id="arcade" aria-label="Wheelkeepers game">
        <div className="arcade-header"><div><span className="tiny-label">01 / ORBITAL HARVEST</span><span className="game-mode">{phase==='playing'?(runId.current?'RANKED RUN':'PRACTICE RUN'):'ENDLESS / 3 LIVES'}</span></div><div className="game-tools"><button aria-label={sound?'Mute game sound':'Enable game sound'} onClick={()=>{setSound(!sound);soundRef.current=!sound;}}>{sound?<Volume2 size={17}/>:<VolumeX size={17}/>}</button><button aria-label="Game instructions" onClick={()=>setHelp(true)}>?</button></div></div>
        <div className="game-hud"><div><span>SCORE</span><strong>{String(hud.score).padStart(4,'0')}</strong></div><div className="harvest"><span>SEEDS</span><strong>{hud.catches}</strong></div><div className="pace"><span>PACE / {String(hud.stage).padStart(2,'0')}</span><strong>{hud.pace.toFixed(2)}<small>×</small></strong></div><div className="lives"><span>WHEEL HEALTH</span><div>{[0,1,2].map(i=><Heart key={i} size={19} fill={i<hud.lives?'currentColor':'transparent'} className={i>=hud.lives?'lost':''}/>)}</div></div></div>
        <div className="canvas-wrap"><canvas ref={canvas}
          aria-label="Aim the collector by moving the mouse. On a phone, hold and drag a finger on the wheel. Left and right arrow keys or A and D also work. Catch gold seeds, avoid blue glitches."
          style={{touchAction:phase==='playing'?'none':'pan-y',cursor:phase==='playing'?'crosshair':'default'}}
          onPointerMove={e=>aim(e)}
          onPointerDown={e=>{if(!playing.current||!e.isPrimary||(e.pointerType==='mouse'&&e.button!==0))return;e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);aim(e,true);}}
          onPointerUp={e=>{if(!e.isPrimary)return;if(e.pointerType==='mouse'&&pointer.current){const r=e.currentTarget.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)releasePointer();else pointer.current.held=false;}else releasePointer();}}
          onPointerCancel={e=>{if(e.isPrimary)releasePointer();}}
          onPointerLeave={e=>{if(e.isPrimary&&!pointer.current?.held)releasePointer();}}
          onLostPointerCapture={e=>{if(!e.isPrimary)return;if(e.pointerType!=='mouse')releasePointer();else if(pointer.current)pointer.current.held=false;}}/>
          {phase==='playing'&&<div className="pointer-hint"><span className="mouse-hint">MOVE THE MOUSE TO AIM</span><span className="finger-hint">HOLD & DRAG TO AIM</span></div>}
          {phase!=='playing'&&<div className={`game-overlay ${phase==='finished'?'result-overlay':''}`}>
            {phase==='ready'?<><span className="overlay-kicker">YOUR SHIFT STARTS HERE</span><h2>Small paws.<br/>Big responsibility.</h2><p>Catch the gold. Dodge the blue.<br/>Keep your orbit going.</p></>:<><span className="overlay-kicker">{hud.lives>0?'SHIFT COMPLETE':'THE WHEEL NEEDS A BREAK'}</span><h2>{hud.score.toLocaleString()}<small> POINTS</small></h2><p>{hud.catches} seeds collected · {hud.score>=best&&hud.score>0?'Personal best!':'One more orbit?'}</p><div className="save-status" role="status">{saved}</div></>}
            <button className="start-button" onClick={()=>start()} disabled={busy||saving}>{busy||saving?<Loader2 size={18} className="spin"/>:phase==='ready'?<Play size={16} fill="currentColor"/>:<RotateCcw size={16}/>} {phase==='ready'?(address?'START RANKED RUN':'PLAY A FREE RUN'):'ANOTHER ROUND'}<ArrowUpRight size={19}/></button>
            {address?<button className="practice-link" onClick={()=>start(true)} disabled={busy||saving}>or play a practice run</button>:<span className="overlay-footnote">No wallet needed to play</span>}
          </div>}{phase==='playing'&&hud.combo>=3&&<div className="combo">{hud.combo} SEED STREAK <Zap size={14}/></div>}
        </div>
        <div className="controls-bar"><span className="input-instructions"><span className="mouse-hint">MOVE MOUSE TO AIM</span><span className="finger-hint">HOLD & DRAG TO AIM</span></span><span className="personal-best">DEVICE BEST <b>{best.toLocaleString()}</b></span></div>
      </section>
      <aside className="side-column"><section className="pulse-card"><div className="card-top"><span className="tiny-label">THE REAL POWER SOURCE</span><span className={`live-badge ${isLive?'':'offline'}`}><i/>{isLive?'LIVE':'OFFLINE'}</span></div><div className="pulse-heading"><Hamster size={53}/><div><h2>Squeektoshi</h2><p>{label}</p></div></div><div className="pulse-metrics"><div><span>WHEEL SPEED</span><strong>{live?.rpm==null?'—':live.rpm.toFixed(1)}<small> RPM</small></strong></div><div><span>SETTLED BLOCK</span><strong>{live?.height?`#${Number(live.height).toLocaleString()}`:'—'}</strong></div></div><div className="waveform" aria-hidden="true">{Array.from({length:42},(_,i)=><i key={i} style={{height:`${isLive&&(live?.rpm||0)>0?8+Math.abs(Math.sin(i*1.7))*24:3}px`,animationDelay:`${i*.06}s`}}/>)}</div><p className="pulse-note">{live?.height?'The hamster sets the base. Every ranked attempt is fresh. Keep your orbit going as the pace climbs.':'The wheel signal is unavailable. Practice stays open; ranked runs wait for fresh data.'}</p><a href={live?.transaction?`https://eth-sepolia.blockscout.com/tx/${live.transaction}`:'https://docs.squeekchain.com/developers/api/'} target="_blank" rel="noopener noreferrer">{live?.transaction?'View source settlement':'About the data source'}<ArrowUpRight size={14}/></a></section>
        <section className="field-guide"><div className="tiny-label">A KEEPER’S FIELD GUIDE</div><div className="guide-row"><span className="seed-icon"/><div><h3>Collect the good stuff.</h3><p>Gold seeds build your score.<br/>Keep a streak for bonus points.</p></div><span className="points">+50</span></div><div className="guide-row"><span className="glitch-icon">×</span><div><h3>Avoid the interference.</h3><p>Blue glitches cost a heart.<br/>Three hits and your shift is over.</p></div></div><div className="guide-divider"/><div className="rank-note"><Trophy size={19}/><p><strong>Make your mark.</strong><br/>Sign in with a wallet to save ranked scores. One message. Zero gas.</p></div>{!address&&<button className="rank-button" onClick={()=>setWalletOpen(true)}>JOIN THE LEADERBOARD <ArrowUpRight size={15}/></button>}</section></aside></div>
      <section className="leaderboard" id="leaderboard"><div className="board-heading"><div><span className="eyebrow">GOOD PAWS. GREAT SCORES.</span><h2>THE KEEPERS’ BOARD<span>↗</span></h2></div><div className="board-filter">ALL TIME<span>{total} {total===1?'KEEPER':'KEEPERS'}</span></div></div><div className="board-table"><div className="board-row table-head"><span>RANK</span><span>KEEPER</span><span>SEEDS</span><span>BEST SCORE</span></div>
        {rows.length?rows.slice(0,7).map((r,i)=><div key={r.address} className={`board-row ${r.address===address?'your-row':''}`}><span className={`rank rank-${i}`}>{i===0?<Trophy size={16}/>:String(i+1).padStart(2,'0')}</span><span className="keeper"><i style={{background:`hsl(${parseInt(r.address.slice(-4),16)%360} 32% 65%)`}}/><b>{short(r.address)}</b>{r.address===address&&<small>YOU</small>}</span><span>{r.catches}</span><strong>{r.score.toLocaleString()}</strong></div>):<div className="empty-board"><Trophy size={25}/><div><h3>{boardError?'The board is taking a breather.':'The first orbit is still up for grabs.'}</h3><p>{boardError?'Scores could not be loaded. Try refreshing the board.':'No ranked scores yet. Connect your wallet and set the pace.'}</p></div><button onClick={boardError?refreshBoard:()=>setWalletOpen(true)}>{boardError?'RETRY':'BE THE FIRST'}<ArrowUpRight size={15}/></button></div>}
        {me&&!rows.slice(0,7).some(r=>r.address===me.address)&&<div className="board-row your-row"><span>—</span><span className="keeper"><b>{short(me.address)}</b><small>YOU</small></span><span>{me.catches}</span><strong>{me.score}</strong></div>}</div><div className="board-bottom"><span><ShieldCheck size={13}/> Ranked runs are replayed and scored on the server.</span><button onClick={refreshBoard}><RotateCcw size={12}/> REFRESH</button></div></section>
      <div className="closing-note"><span>✳</span><p>A tiny game in a hamster-powered universe.<br/><small>Made for the Squeekchain community. Just bring your reflexes.</small></p><a href="https://squeekchain.com/genesis" target="_blank" rel="noopener noreferrer">EXPLORE SQUEEKCHAIN <ArrowUpRight size={16}/></a></div>
    </main><footer><span>© {new Date().getFullYear()} WHEELKEEPERS</span><span>INDEPENDENT COMMUNITY PROJECT · NO WL OR REWARDS GUARANTEED</span><a href="https://docs.squeekchain.com/developers/api/" target="_blank" rel="noopener noreferrer">DATA & DOCS <ExternalLink size={10}/></a></footer>
    {toast&&<div className="toast" role="status"><span>{toast}</span><button onClick={()=>setToast('')} aria-label="Dismiss notification"><X size={17}/></button></div>}
    {(walletOpen||help)&&<div className="modal-backdrop" onClick={()=>{setWalletOpen(false);setHelp(false);}}><section className="modal" role="dialog" aria-modal="true" aria-label={help?'How to play':'Connect wallet'} onClick={e=>e.stopPropagation()}><button className="close-modal" onClick={()=>{setWalletOpen(false);setHelp(false);}} aria-label="Close dialog"><X size={19}/></button><span className="eyebrow">{help?'THE KEEPER’S MANUAL':'YOUR WALLET IS YOUR PLAYER ID'}</span><h2>{help?'FIND YOUR ORBIT.':'HELLO, KEEPER.'}</h2>
      {help?<><p>Move the mouse around the wheel to aim the gold collector. On mobile, hold and drag a finger on the game field. You can also hold <kbd>←</kbd> / <kbd>→</kbd>, <kbd>A</kbd> / <kbd>D</kbd> for keyboard control.</p><ol><li>Catch gold seeds at the outer ring: <b>50 points</b> each.</li><li>Every 3 seeds in a streak adds +10 points per catch, up to +50.</li><li>Avoid blue glitches. Each hit costs a heart.</li><li>Keep going as long as you can. The pace keeps climbing: seeds get faster and glitches more frequent. The run ends when all three hearts are gone.</li></ol><p>Courses use the official Squeekchain API’s latest settled block. Each ranked run adds a fresh server seed. Guest scores stay on your device. Ranked runs require a wallet signature, normal-speed play and server replay verification.</p><p className="fineprint">Replay verification rejects invalid scores and impossible inputs, but cannot eliminate automated play. This independent game does not grant Aura, WL or tokens.</p></>:<><p>Sign one message to save your scores.<br/>No transactions. No token approvals. No gas.</p><div className="wallet-list">{wallets.map((w,i)=><button key={i} disabled={busy} onClick={()=>connect(w.provider)}><Wallet size={20}/>{w.name}{busy?<Loader2 size={17} className="spin"/>:<ArrowUpRight size={18}/>}</button>)}</div>{!wallets.length&&<div className="no-wallet"><Wallet size={25}/><b>No browser wallet detected</b><p>Open this site in your wallet’s built-in browser on mobile, or enable an Ethereum wallet extension on desktop.</p></div>}<p className="fineprint">Supports Ethereum wallets with message signing. Your public wallet address and best score appear on the board. Guest runs do not require a wallet.</p><button className="practice-link" onClick={()=>{setWalletOpen(false);start(true);}}>Continue as a guest →</button></>}
    </section></div>}
  </div>;
}
