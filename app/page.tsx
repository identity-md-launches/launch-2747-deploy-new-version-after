'use client';
import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { ArrowUpRight, ExternalLink, Heart, Loader2, Play, RotateCcw, Trophy, Volume2, VolumeX, Wallet, X, Zap } from 'lucide-react';
import { createGame, tick, steerDirection, difficultyAt, boostRhythm, BOOST_STEPS, ORBIT_SEEDS, CHECKPOINT_STEPS, STEP_MS, type Game, type Move, type BoostConfig, type WheelEvent } from '@/lib/game';
import { draw, sceneLayout } from '@/lib/draw';
import { hitSamples } from '@/lib/sound';
import { api, gameApi, liveServicesAvailable, ApiError, PUBLISHED_ORIGIN, type Pulse } from '@/components/services/api-client';
type Provider = { request: (d: {method: string; params?: unknown[]}) => Promise<any>; on?: (event: string, fn: (...args: any[]) => void) => void; removeListener?: (event: string, fn: (...args: any[]) => void) => void };
type Row = {address: string; score: number; catches: number; played: number};
type RunChannel={id:string;sequence:number;cursor:number;queue:Promise<void>;failed:boolean;error:string};
const short = (s: string) => `${s.slice(0,6)}…${s.slice(-4)}`;
const time = (seconds: number) => `${Math.floor(Math.max(0,seconds)/60)}:${String(Math.max(0,seconds)%60).padStart(2,'0')}`;
function gameHud(g: Game) {
  const pace = g.boost ? boostRhythm(g.boost.rpm) : difficultyAt(g.step);
  return { score:g.score, lives:g.lives, catches:g.catches, combo:g.combo, pace:pace.multiplier,
    stage:difficultyAt(g.step).stage, step:g.step, boost:g.boost?{...g.boost}:null };
}
function Hamster({size=38}: {size?:number}) {
  return <img src="./hamster-mark.svg" width={size} height={size} alt="" aria-hidden="true"/>;
}
const letters:Record<string,string[]>={W:['10001','10001','10001','10101','10101','11011','10001'],H:['10001','10001','10001','11111','10001','10001','10001'],E:['11111','10000','10000','11110','10000','10000','11111'],L:['10000','10000','10000','10000','10000','10000','11111'],K:['10001','10010','10100','11000','10100','10010','10001'],P:['11110','10001','10001','11110','10000','10000','10000'],R:['11110','10001','10001','11110','10100','10010','10001'],S:['01111','10000','10000','01110','00001','00001','11110']};
function DotTitle(){return <svg className="dot-title" viewBox="0 0 420 158" role="img" aria-label="Wheelkeepers"><defs><linearGradient id="gold-led" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#ffe28a"/><stop offset="1" stopColor="#e8a43a"/></linearGradient><linearGradient id="blue-led" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#a8baff"/><stop offset="1" stopColor="#4460cf"/></linearGradient></defs>{['WHEEL','KEEPERS'].map((word,row)=><g key={word} fill={`url(#${row?'blue':'gold'}-led)`}>{Array.from(word).flatMap((l,i)=>letters[l].flatMap((r,y)=>Array.from(r).map((v,x)=>v==='1'?<g key={`${i}-${x}-${y}`}>{Array.from({length:9},(_,n)=>row?<rect key={n} x={i*60+x*10+1.5+(n%3)*3.15} y={row*82+y*10+2.5+Math.floor(n/3)*3.15} width="2.5" height="2.5"/>:<circle key={n} cx={i*60+x*10+2.8+(n%3)*3.15} cy={y*10+3.8+Math.floor(n/3)*3.15} r="1.3"/>)}</g>:null)))}</g>)}</svg>;}
export default function Home() {
  const canvas=useRef<HTMLCanvasElement>(null),game=useRef<Game>(createGame(48)),moves=useRef<Move[]>([]),playing=useRef(false),runId=useRef<string|null>(null);
  const pointer=useRef<{angle:number;held:boolean}|null>(null);
  const channel=useRef<RunChannel|null>(null),checkpointRef=useRef<(g:Game,finished:boolean)=>void>(()=>{});
  const exitRef=useRef<()=>void>(()=>{}),hitBuffer=useRef<AudioBuffer|null>(null);
  const [saving,setSaving]=useState(false);
  const storageOkay=useRef(true);
  const liveRef=useRef<Pulse|null>(null),providerRef=useRef<Provider|null>(null),finishRef=useRef<(g:Game)=>void>(()=>{}),soundRef=useRef(true),audio=useRef<AudioContext|null>(null);
  const [phase,setPhase]=useState<'ready'|'playing'|'finished'>('ready'),[hud,setHud]=useState(()=>gameHud(game.current));
  const [live,setLive]=useState<Pulse|null>(null),[address,setAddress]=useState<string|null>(null),[rows,setRows]=useState<Row[]>([]),[total,setTotal]=useState(0),[me,setMe]=useState<Row|null>(null);
  const [best,setBest]=useState(0),[busy,setBusy]=useState(false),[walletOpen,setWalletOpen]=useState(false),[wallets,setWallets]=useState<{name:string;provider:Provider;icon?:string}[]>([]);
  const [toast,setToast]=useState(''),[saved,setSaved]=useState(''),[sound,setSound]=useState(true),[help,setHelp]=useState(false),[boardError,setBoardError]=useState(false);
  const [services,setServices]=useState(true),[walletError,setWalletError]=useState(''),[pulseLoading,setPulseLoading]=useState(true);
  const scene=useRef<HTMLDivElement>(null);
  const [boostBest,setBoostBest]=useState(0),[clock,setClock]=useState(0),serverOffset=useRef(0);
  const [boardMode,setBoardMode]=useState<'arcade'|'boost'>('arcade'),[boardEvent,setBoardEvent]=useState<WheelEvent|null>(null),[boardLoading,setBoardLoading]=useState(true);
  const boardSelection=useRef<{mode:'arcade'|'boost';eventId:string|null}>({mode:'arcade',eventId:null});
  const boardRequest=useRef(0);
  const note=useCallback((s:string)=>setToast(s),[]);
  useEffect(()=>{
    if(!walletOpen&&!help)return;
    const previous=document.activeElement as HTMLElement|null;
    const dialog=document.querySelector('.modal') as HTMLElement|null;
    const background=document.querySelector('.page-content') as HTMLElement|null;
    if(background)background.inert=true;
    const overflow=document.body.style.overflow;document.body.style.overflow='hidden';
    const buttons=()=>Array.from(dialog?.querySelectorAll<HTMLElement>('button:not(:disabled),a[href]')||[]);
    buttons()[0]?.focus();
    const key=(e:KeyboardEvent)=>{
      if(e.key==='Escape'){e.preventDefault();e.stopPropagation();setWalletOpen(false);setHelp(false);}
      if(e.key==='Tab'){const b=buttons(),first=b[0],last=b.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}
    };
    document.addEventListener('keydown',key);return()=>{document.removeEventListener('keydown',key);if(background)background.inert=false;document.body.style.overflow=overflow;if(previous?.isConnected)previous.focus();};
  },[walletOpen,help]);
  const refreshBoard=useCallback(async()=>{
    const selection=boardSelection.current,request=++boardRequest.current;
    setBoardLoading(true);
    try{const d=await api(`leaderboard${selection.mode==='boost'?`?event=${encodeURIComponent(selection.eventId||'latest')}`:''}`);
      if(boardSelection.current!==selection||request!==boardRequest.current)return;
      setRows(d.rows);setTotal(d.total);setMe(d.me);setBoardEvent(d.event||null);setBoardError(false);
    }catch{if(boardSelection.current===selection&&request===boardRequest.current)setBoardError(true);}
    finally{if(boardSelection.current===selection&&request===boardRequest.current)setBoardLoading(false);}
  },[]);
  function chooseBoard(mode:'arcade'|'boost',eventId:string|null=null){
    boardSelection.current={mode,eventId};setBoardMode(mode);setRows([]);setMe(null);setTotal(0);setBoardEvent(null);setBoardLoading(services);setBoardError(false);if(services)refreshBoard();
  }
  useEffect(()=>{
    try{const read=(key:string)=>{const n=Number(localStorage.getItem(key));return Number.isSafeInteger(n)&&n>=0?n:0;};setBest(read('wk-best'));setBoostBest(read('wk-boost-best'));}catch{storageOkay.current=false;}
    const available=liveServicesAvailable();setServices(available);
    if(available){api('auth/session').then(d=>setAddress(d.address)).catch(()=>{});refreshBoard();}else setBoardLoading(false);
    async function poll(){try{const d=await api('pulse');serverOffset.current=typeof d.serverNow==='number'?d.serverNow-Date.now():0;setClock(Date.now()+serverOffset.current);setLive(d);liveRef.current=d;}catch{setLive(null);liveRef.current=null;}finally{setPulseLoading(false);}}
    if(available)poll();const interval=setInterval(()=>{if(available&&!document.hidden){poll();refreshBoard();}},12000);
    const timer=setInterval(()=>setClock(Date.now()+serverOffset.current),1000);
    const discover=(e:Event)=>{const d=(e as CustomEvent).detail;if(d?.info?.name&&d?.provider?.request)setWallets(old=>old.some(w=>w.provider===d.provider)?old:[...old.filter(w=>w.name!=='Browser wallet'),{name:String(d.info.name),provider:d.provider,icon:typeof d.info.icon==='string'&&d.info.icon.startsWith('data:image/')?d.info.icon:undefined}]);};
    window.addEventListener('eip6963:announceProvider',discover);window.dispatchEvent(new Event('eip6963:requestProvider'));
    const eth=(window as any).ethereum;if(eth)setWallets(old=>old.length?old:[{name:eth.isMetaMask?'MetaMask':eth.isRabby?'Rabby':'Browser wallet',provider:eth}]);
    return()=>{clearInterval(interval);clearInterval(timer);window.removeEventListener('eip6963:announceProvider',discover);};
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
    const down=(e:KeyboardEvent)=>{if(e.defaultPrevented||!playing.current||document.querySelector('[role="dialog"]'))return;if(e.key==='Escape'){e.preventDefault();held.clear();exitRef.current();return;}if(['ArrowLeft','a','A','ArrowRight','d','D'].includes(e.key)){e.preventDefault();pointer.current=null;held.add(e.key);keyboardDirection();}};
    const up=(e:KeyboardEvent)=>{if(held.delete(e.key)&&!pointer.current)keyboardDirection();};
    const blur=()=>{held.clear();releasePointer();};
    window.addEventListener('keydown',down);window.addEventListener('keyup',up);window.addEventListener('blur',blur);
    const visibility=()=>{if(document.hidden)blur();};document.addEventListener('visibilitychange',visibility);
    return()=>{window.removeEventListener('keydown',down);window.removeEventListener('keyup',up);window.removeEventListener('blur',blur);document.removeEventListener('visibilitychange',visibility);};
  },[direction,releasePointer]);
  function beep(hz:number){if(!soundRef.current)return;try{audio.current||=new AudioContext();const ac=audio.current,o=ac.createOscillator(),gain=ac.createGain();o.frequency.value=hz;gain.gain.setValueAtTime(.045,ac.currentTime);gain.gain.exponentialRampToValueAtTime(.001,ac.currentTime+.1);o.connect(gain);gain.connect(ac.destination);o.start();o.stop(ac.currentTime+.1);}catch{}}
  function hit(){
    if(!soundRef.current)return;
    try{const ac=audio.current||=new AudioContext();
      if(!hitBuffer.current){const samples=hitSamples(ac.sampleRate),buffer=ac.createBuffer(1,samples.length,ac.sampleRate);buffer.getChannelData(0).set(samples);hitBuffer.current=buffer;}
      const source=ac.createBufferSource();source.buffer=hitBuffer.current;source.connect(ac.destination);source.start();
    }catch{}
  }
  function toggleSound(){
    const enabled=!soundRef.current;soundRef.current=enabled;setSound(enabled);
    if(enabled&&!resumeAudio()){soundRef.current=false;setSound(false);}
  }
  function resumeAudio(){
    try{audio.current||=new AudioContext();audio.current.resume().catch(()=>{});return true;}catch{return false;}
  }
  checkpointRef.current=(g,finished)=>{
    const active=channel.current;
    if(!active||active.failed){
      moves.current=[];
      if(finished)setSaved(active?.error||(storageOkay.current?(g.boost?'Boost practice · device best updated':'Practice result · device best updated'):'Storage is unavailable. This best lasts until you close or reload the page.'));
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
    setPhase('finished');setHud(gameHud(g));
    const update=g.boost?setBoostBest:setBest,key=g.boost?'wk-boost-best':'wk-best';
    const n=Math.max(g.boost?boostBest:best,g.score);
    try{localStorage.setItem(key,String(n));}catch{storageOkay.current=false;}
    update(n);
    checkpointRef.current(g,true);
    requestAnimationFrame(()=>document.querySelector<HTMLButtonElement>('.start-button')?.focus({preventScroll:true}));
  };
  useEffect(()=>{
    const el=canvas.current;if(!el)return;const ctx=el.getContext('2d');if(!ctx)return;
    let width=680,height=460,frame=0,last=performance.now(),acc=0,motionClock=0;
    const resize=()=>{width=el.clientWidth;height=el.clientHeight;const ratio=Math.min(window.devicePixelRatio||1,2);el.width=width*ratio;el.height=height*ratio;ctx.setTransform(ratio,0,0,ratio,0,0);};
    const observer=new ResizeObserver(resize);observer.observe(el);resize();
    const animate=(now:number)=>{
      const delta=Math.min(100,now-last);last=now;
      const charged=(liveRef.current?.event?.joinUntil||0)>Date.now()+serverOffset.current;
      const wheelPace=playing.current?(game.current.boost?boostRhythm(game.current.boost.rpm).multiplier:difficultyAt(game.current.step).multiplier):charged?boostRhythm(liveRef.current?.rpm||0).multiplier:1;
      motionClock+=delta*wheelPace;
      if(playing.current){acc+=delta;while(acc>=STEP_MS&&playing.current){const c=game.current.catches,l=game.current.lives;if(pointer.current)direction(steerDirection(game.current.angle,pointer.current.angle));tick(game.current);acc-=STEP_MS;if(game.current.catches>c)beep(680);if(game.current.lives<l)hit();
        if(game.current.step%5===0)setHud(gameHud(game.current));
        if(!game.current.ended&&game.current.step%CHECKPOINT_STEPS===0)checkpointRef.current(game.current,false);
        if(game.current.ended){playing.current=false;finishRef.current(game.current);}}}else acc=0;
      draw(ctx,width,height,game.current,playing.current,window.matchMedia('(prefers-reduced-motion: reduce)').matches?0:motionClock,pointer.current?.angle,charged);frame=requestAnimationFrame(animate);
    };frame=requestAnimationFrame(animate);return()=>{cancelAnimationFrame(frame);observer.disconnect();};
  },[direction]);
  async function connect(provider:Provider){
    if(busy)return;setBusy(true);setWalletError('');try{
      if(!liveServicesAvailable())throw new Error('Wallet sign-in is available on the published site. You can play practice here.');
      const session=await gameApi().connectWallet(provider);
      providerRef.current=provider;setAddress(session.address);setWalletOpen(false);refreshBoard();note('Signed in. Your next run counts toward the leaderboard.');
    }catch(e:any){setWalletError(e?.code===4001?'Sign-in cancelled. Choose a wallet to try again, or play practice.':e?.message||'Could not connect. Choose your wallet to try again.');}finally{setBusy(false);}
  }
  async function disconnect(){try{await api('auth/session',undefined,'DELETE');setAddress(null);setMe(null);providerRef.current=null;note('Signed out.');}catch(e){note((e as Error).message);}}
  useEffect(()=>{
    const p=providerRef.current||(window as any).ethereum;if(!p?.on)return;
    const change=()=>{api('auth/session',undefined,'DELETE').catch(()=>{});setAddress(null);setMe(null);note('Wallet changed. Sign in again for ranked runs.');};
    p.on('accountsChanged',change);p.on('disconnect',change);return()=>{p.removeListener?.('accountsChanged',change);p.removeListener?.('disconnect',change);};
  },[address,note]);
  async function start(practice=false,boostMode=false,demo=false){
    if(playing.current||busy||saving)return;setBusy(true);setSaved('');
    // Unlock during the Play gesture, before a ranked request can delay it.
    if(soundRef.current&&!resumeAudio()){soundRef.current=false;setSound(false);}
    try{let seed=live?.seed||Math.floor(Date.now()/86400000),id=null,boost:BoostConfig|undefined;
      if(boostMode){
        const event=liveRef.current?.event;
        if(demo){seed=(seed^0xb0057)>>>0;boost={rpm:12,eventId:null};}
        else if(event&&event.openedAt<=Date.now()+serverOffset.current&&event.joinUntil>Date.now()+serverOffset.current){seed=event.seed;boost={rpm:event.rpm,eventId:event.id};}
        else throw new Error('This Boost has closed. Try a practice Boost.');
      }
      if(address&&!practice){const r=await api('runs',{action:'start',mode:boostMode?'boost':'arcade',eventId:boost?.eventId});seed=r.seed;id=r.id;boost=r.boost||undefined;}
      game.current=createGame(seed,boost);moves.current=[];pointer.current=null;runId.current=id;channel.current=id?{id,sequence:0,cursor:0,queue:Promise.resolve(),failed:false,error:''}:null;setHud(gameHud(game.current));setPhase('playing');playing.current=true;
      if(boost)chooseBoard('boost',boost.eventId);
      scene.current?.focus({preventScroll:true});
      if(window.innerWidth<760)document.querySelector('#arcade')?.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});
    }catch(e){if(e instanceof ApiError&&e.status===401)setAddress(null);note((e as Error).message);}finally{setBusy(false);}
  }
  function startBoost(demo=false){return start(!address||demo,true,demo);}
  function resetArcade(){game.current=createGame(liveRef.current?.seed||48);setHud(gameHud(game.current));setPhase('ready');setSaved('');requestAnimationFrame(()=>document.querySelector<HTMLButtonElement>('.start-button')?.focus({preventScroll:true}));}
  function exitRun(){
    const active=channel.current,wasBoost=!!game.current.boost;
    playing.current=false;pointer.current=null;channel.current=null;runId.current=null;moves.current=[];setSaving(false);
    resetArcade();if(wasBoost)chooseBoard('arcade');
    if(active){active.failed=true;void api('runs',{action:'abandon',id:active.id}).catch(()=>{});}
  }
  exitRef.current=exitRun;
  const event=live?.event,eventOpen=!!event&&clock>=event.openedAt&&clock<event.joinUntil;
  const activeBest=hud.boost?boostBest:best,golden=!!hud.boost&&hud.step<hud.boost.orbitEnds;
  const charge=hud.boost?(golden?hud.boost.orbitCaught/ORBIT_SEEDS:Math.max(0,1-(hud.boost.nextOrbit-hud.step)/(hud.boost.nextOrbit===600?600:900))):0;
  const isLive=live?.available,label=pulseLoading?'Checking hardware feed…':live?.state==='resting'?'Hamster is resting':live?.state==='running'?'Hamster is running':'Live feed unavailable';
  const displayedRows=rows.slice(0,20);
  const openWallet=()=>{setWalletError('');setWalletOpen(true);};
  const emptyTitle=boardLoading?'Loading scores…':!services?'A shared board, on the live site':boardError?'Scores unavailable':boardMode==='boost'&&!boardEvent?'Waiting for the next Boost':'No ranked scores yet';
  const emptyCopy=!services?'Play practice here, or open the live arcade to compete.':boardError?'The server could not load scores. Try refreshing.':boardMode==='boost'&&!boardEvent?'A real hardware run opens the next event.':address?'Finish a ranked run to set a score.':'Connect a wallet to save a verified score.';
  return <>
    <div className="site-shell page-content">
      <a className="skip-link" href="#arcade">Skip to game</a>
      <header className="topbar">
        <a href="#" className="brand" aria-label="Wheelkeepers home"><Hamster size={36}/><span>Wheelkeepers</span></a>
        <nav aria-label="Main navigation"><a href="#leaderboard">Leaderboard <ArrowUpRight size={16}/></a><button onClick={()=>setHelp(true)}>How to play</button></nav>
        <button className={`wallet-button ${address?'connected':''}`} disabled={busy||phase==='playing'} onClick={()=>address?disconnect():openWallet()} title={address?'Disconnect wallet':'Connect wallet'} aria-label={address?`Disconnect wallet ${short(address)}`:'Connect wallet'}>
          <Wallet size={18}/><span>{address?short(address):'Connect'}</span>{address&&<i className="status-dot"/>}
        </button>
      </header>
      <main>
        <section className="intro" aria-labelledby="page-title">
          <div className="intro-mark" aria-hidden="true"><DotTitle/></div>
          <div><h1 id="page-title">Keep the wheel alive.</h1><p>A Squeekchain arcade powered by a real hamster.</p></div>
        </section>
        <div className="workspace">
          <section className={`arcade ${hud.boost?'boost-active':''}`} id="arcade" aria-label="Wheelkeepers game">
            <div className="arcade-header">
              <div className="mode-label"><span>{hud.boost?'Boost':'Arcade'}</span><span className="game-mode">{phase==='playing'?(runId.current?'Ranked run':'Practice run'):'3 lives · Free to play'}</span></div>
              <div className="game-tools">
                {phase==='playing'&&<button className="exit-run" aria-label="Exit run" title="Exit run (Esc)" onClick={exitRun}><X size={16}/><span>Exit</span></button>}
                <button aria-label={sound?'Mute game sound':'Enable game sound'} title={sound?'Mute game sound':'Enable game sound'} aria-pressed={sound} onClick={toggleSound}>{sound?<Volume2 size={19}/>:<VolumeX size={19}/>}</button>
                <button aria-label="Game instructions" title="How to play" onClick={()=>setHelp(true)}>?</button>
              </div>
            </div>
            <div className="game-hud">
              <div><span>Score</span><strong>{String(hud.score).padStart(4,'0')}</strong></div>
              <div className="harvest"><span>Seeds</span><strong>{hud.catches}</strong></div>
              <div className="pace"><span>{hud.boost?'Time left':`Pace ${String(hud.stage).padStart(2,'0')}`}</span><strong>{hud.boost?time(Math.ceil((BOOST_STEPS-hud.step)*STEP_MS/1000)):<>{hud.pace.toFixed(2)}<small>×</small></>}</strong></div>
              <div className="lives"><span>Lives</span><div role="img" aria-label={`${hud.lives} of 3 lives`}>{[0,1,2].map(i=><Heart aria-hidden="true" key={i} size={18} fill={i<hud.lives?'currentColor':'transparent'} className={i>=hud.lives?'lost':''}/>)}</div></div>
            </div>
            {hud.boost&&phase==='playing'&&<div className={`boost-status ${golden?'golden':''}`}>
              <span>{golden?(hud.boost.orbitMissed?'Chain broken':'Golden orbit'):runId.current?'Live Boost':'Practice Boost'}</span>
              <div className="charge-track" role="progressbar" aria-label={golden?'Golden orbit progress':'Wheel energy'} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(charge*100)}><i style={{width:`${charge*100}%`}}/></div>
              <span>{golden?`${hud.boost.orbitCaught} / ${ORBIT_SEEDS}`:'+500 / orbit'}</span>
            </div>}
            <div className="canvas-wrap" ref={scene} tabIndex={phase==='playing'?0:-1} role="group" aria-label="Game field. Use left and right arrow keys or A and D to aim. Escape exits the run.">
              <canvas ref={canvas} aria-label="Catch gold seeds with the collector. Avoid blue glitches. Move the mouse to aim, or hold and drag a finger on the wheel."
                style={{touchAction:phase==='playing'?'none':'pan-y',cursor:phase==='playing'?'crosshair':'default'}}
                onPointerMove={e=>aim(e)}
                onPointerDown={e=>{if(!playing.current||!e.isPrimary||(e.pointerType==='mouse'&&e.button!==0))return;e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);aim(e,true);}}
                onPointerUp={e=>{if(!e.isPrimary)return;if(e.pointerType==='mouse'&&pointer.current){const r=e.currentTarget.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)releasePointer();else pointer.current.held=false;}else releasePointer();}}
                onPointerCancel={e=>{if(e.isPrimary)releasePointer();}}
                onPointerLeave={e=>{if(e.isPrimary&&!pointer.current?.held)releasePointer();}}
                onLostPointerCapture={e=>{if(!e.isPrimary)return;if(e.pointerType!=='mouse')releasePointer();else if(pointer.current)pointer.current.held=false;}}>
              </canvas>
              {phase!=='playing'&&<div className={`game-overlay ${phase==='finished'?'result-overlay':''}`}>
                {phase==='ready'?<><h2>Ready to roll?</h2><p>Catch gold seeds.<br/>Dodge blue glitches.</p></>:<>
                  <p className="result-label">{hud.boost&&hud.lives>0?'Boost complete':'Game over'}</p>
                  <h2>{hud.score.toLocaleString()}<small> points</small></h2>
                  <p>{hud.catches} seeds{hud.boost?` · ${hud.boost.orbits} perfect orbits`:hud.score>=activeBest&&hud.score>0?' · Personal best!':''}</p>
                  <div className="save-status" role="status">{saved}</div>
                </>}
                <button className="start-button" onClick={()=>hud.boost?startBoost(!hud.boost.eventId||!eventOpen||event?.id!==hud.boost.eventId):start()} disabled={busy||saving}>
                  {busy||saving?<Loader2 size={18} className="spin"/>:phase==='ready'?<Play size={18} fill="currentColor"/>:<RotateCcw size={18}/>}
                  <span>{busy?'Starting…':saving?'Verifying…':phase==='ready'?(address?'Play ranked':'Play'):'Play again'}</span><ArrowUpRight size={18}/>
                </button>
                {!hud.boost&&eventOpen&&<button className="boost-button" onClick={()=>startBoost()} disabled={busy||saving}><Zap size={16}/> Join live Boost <span>{time(Math.ceil(((event?.joinUntil||0)-clock)/1000))}</span></button>}
                {hud.boost?<button className="practice-link" onClick={resetArcade} disabled={busy||saving}>Back to arcade</button>:address&&<button className="practice-link" onClick={()=>start(true)} disabled={busy||saving}>Play practice instead</button>}
              </div>}
              {phase==='playing'&&(hud.boost&&hud.step-hud.boost.bonusAt<90?<div className="combo orbit-bonus">Perfect orbit +500 <Zap size={16}/></div>:hud.combo>=3&&<div className="combo">{hud.combo} seed streak <Zap size={16}/></div>)}
            </div>
            <div className="controls-bar"><span className="input-instructions"><span className="mouse-hint">Mouse or ← → to aim</span><span className="finger-hint">Hold & drag to aim</span></span><span className="personal-best">{hud.boost?'Boost best':'Device best'} <b>{activeBest.toLocaleString()}</b></span></div>
          </section>
          <section className="leaderboard" id="leaderboard" aria-labelledby="board-title">
            <div className="board-heading"><h2 id="board-title">Leaderboard</h2><div className="board-tabs" role="group" aria-label="Leaderboard mode"><button aria-pressed={boardMode==='arcade'} onClick={()=>chooseBoard('arcade')}>All time</button><button aria-pressed={boardMode==='boost'} onClick={()=>chooseBoard('boost')}><Zap size={15}/> Boost</button></div></div>
            <div className="board-caption"><span>{services?`${total.toLocaleString()} ${total===1?'keeper':'keepers'}`:'Shared scores'}{total>20?' · Top 20':''}</span><span>{boardMode==='boost'?(boardEvent?`${clock>=boardEvent.openedAt&&clock<boardEvent.joinUntil?'Live event':'Last event'} · ${boardEvent.rpm.toFixed(1)} RPM`:'Boost events'):'Verified runs'}</span></div>
            {boardError&&rows.length>0&&<p className="inline-warning" role="status">Scores could not refresh. Showing the last loaded scores. Try Refresh.</p>}
            <div className="board-table" aria-busy={boardLoading}>
              <table><caption className="sr-only">{boardMode==='boost'?'Boost event':'All-time'} scores</caption><thead><tr><th scope="col">Rank</th><th scope="col">Keeper</th><th scope="col">Seeds</th><th scope="col">Score</th></tr></thead>
                <tbody>{displayedRows.map((r,i)=><tr key={r.address} className={r.address===address?'your-row':''}>
                  <td className={i===0?'rank-first':''}>{i===0?<><Trophy size={17} aria-hidden="true"/><span className="sr-only">1</span></>:i+1}</td>
                  <td><span className="keeper" title={r.address}><span aria-hidden="true">{short(r.address)}</span><span className="sr-only">{r.address}</span></span>{r.address===address&&<span className="you-label">You</span>}</td><td>{r.catches.toLocaleString()}</td><td className="score-cell">{r.score.toLocaleString()}</td>
                </tr>)}</tbody>
              </table>
              {!rows.length&&<div className="empty-board"><Trophy size={28} aria-hidden="true"/><div><h3>{emptyTitle}</h3>{!boardLoading&&<p>{emptyCopy}</p>}</div>
                {!boardLoading&&<button className="secondary-button" onClick={!services?()=>start(true):boardError?refreshBoard:boardMode==='boost'&&(!boardEvent||clock>=boardEvent.joinUntil)?()=>startBoost(true):address?()=>boardMode==='boost'?startBoost():start():openWallet} disabled={busy||saving||phase==='playing'}>
                  {!services?'Play practice':boardError?'Retry':boardMode==='boost'&&(!boardEvent||clock>=boardEvent.joinUntil)?'Practice Boost':address?'Play':'Connect wallet'}<ArrowUpRight size={16}/>
                </button>}
              </div>}
              {me&&!displayedRows.some(r=>r.address===me.address)&&<div className="your-score"><span title={me.address}>{short(me.address)} · You</span><strong>{me.score.toLocaleString()} points</strong></div>}
            </div>
            <div className="board-bottom">{services?<button onClick={refreshBoard} disabled={boardLoading}><RotateCcw size={15}/> Refresh</button>:<a href={PUBLISHED_ORIGIN} target="_blank" rel="noopener noreferrer">Open live arcade <ArrowUpRight size={16}/></a>}</div>
          </section>
          <aside className="side-column" aria-label="Live hamster status"><section className={`pulse-card ${eventOpen?'charged':''}`}>
            <div className="card-top"><span>Squeekchain</span><span className={`live-badge ${isLive?'':'offline'}`}><i/>{isLive?'Online':services?(pulseLoading?'Checking':'Unavailable'):'Preview'}</span></div>
            <div className="pulse-heading"><Hamster size={52}/><div><h2>Squeektoshi</h2><p>{services?label:'Live feed on published site'}</p></div></div>
            <div className="pulse-metrics"><div><span>Wheel speed</span><strong>{live?.rpm==null?'—':live.rpm.toFixed(1)}<small> RPM</small></strong></div><div><span>Settled block</span><strong>{live?.height?`#${Number(live.height).toLocaleString()}`:'—'}</strong></div></div>
            <p className="boost-explanation">A real hardware run opens Boost entry for 90 seconds. Each run lasts up to 75 seconds. Catch all 12 golden seeds for +500.</p>
            <div className="waveform" aria-hidden="true">{Array.from({length:42},(_,i)=><i key={i} style={{height:`${isLive&&(live?.rpm||0)>0?8+Math.abs(Math.sin(i*1.7))*24:3}px`}}/>)}</div>
            {eventOpen&&<button className="boost-button" onClick={()=>startBoost()} disabled={busy||saving||phase==='playing'}><Zap size={16}/> Join Boost <span>{time(Math.ceil(((event?.joinUntil||0)-clock)/1000))}</span></button>}
            <button className="secondary-button boost-preview" onClick={()=>startBoost(true)} disabled={busy||saving||phase==='playing'}><Zap size={16}/> Practice Boost</button>
            {!isLive&&<p className="pulse-note">{eventOpen?'This Boost stays open on stored energy.':services?'Practice is open. Ranked runs need a fresh feed.':'Practice works here. Live events and shared scores are on the published site.'}</p>}
            <a className="source-link" href={live?.transaction?`https://eth-sepolia.blockscout.com/tx/${live.transaction}`:'https://docs.squeekchain.com/developers/api/'} target="_blank" rel="noopener noreferrer">{live?.transaction?'View settlement':'Data source & docs'}<ArrowUpRight size={16}/></a>
          </section></aside>
        </div>
      </main>
      <footer><span>© {new Date().getFullYear()} Wheelkeepers</span><a href="https://github.com/xqsy/wheelkeepers" target="_blank" rel="noopener noreferrer">View source <ExternalLink size={14}/></a></footer>
    </div>
    <div className="announcer sr-only" role="status">{toast}</div>
    {toast&&<div className="toast"><span>{toast}</span><button onClick={()=>setToast('')} aria-label="Dismiss notification"><X size={18}/></button></div>}
    {(walletOpen||help)&&<div className="modal-backdrop" onClick={()=>{setWalletOpen(false);setHelp(false);}}>
      <section className="modal" role="dialog" aria-modal="true" aria-labelledby="dialog-title" aria-describedby="dialog-description" onClick={e=>e.stopPropagation()}>
        <div className="modal-heading"><h2 id="dialog-title">{help?'How to play':'Connect a wallet'}</h2><button className="close-modal" onClick={()=>{setWalletOpen(false);setHelp(false);}} aria-label="Close dialog"><X size={20}/></button></div>
        {help?<>
          <p id="dialog-description">Aim the gold collector around the wheel. Catch seeds, dodge blue glitches, and keep your three lives.</p>
          <ul className="control-list"><li><b>Mouse:</b> move around the wheel to aim.</li><li><b>Touch:</b> hold and drag on the game field.</li><li><b>Keyboard:</b> hold <kbd>←</kbd> / <kbd>→</kbd> or <kbd>A</kbd> / <kbd>D</kbd>. Press <kbd>Esc</kbd> to exit.</li></ul>
          <h3>Make every seed count</h3><p>Seeds earn 50 points. Every three seeds in a streak adds +10 per catch, up to +50. A glitch costs one life. The pace keeps climbing until all three lives are lost.</p>
          <h3>Follow the golden orbit</h3><p>When Squeektoshi starts running, a 90-second Boost entry window opens. Each run lasts up to 75 seconds. Catch all 12 golden seeds in a sequence for +500. Boost has its own event leaderboard. Practice Boost is always open.</p>
          <h3>Practice or compete</h3><p>Practice bests stay on this device. A wallet message signs you into the shared leaderboard. Ranked scores are replayed and verified by the server; live courses use settled Squeekchain data.</p>
          <p className="fineprint">An independent community game. No tokens, transactions or gas. Verification rejects impossible inputs but cannot rule out automated play. Live services use wheelkeepers.dpdns.org.</p>
        </>:<>
          <p id="dialog-description">Sign one message to save a verified score. No transactions, token approvals or gas. Your public address appears on the leaderboard.</p>
          {!services&&<p className="inline-warning">Wallet sign-in is available on the <a href={PUBLISHED_ORIGIN} target="_blank" rel="noopener noreferrer">published site <ArrowUpRight size={14}/></a>. Practice is open here.</p>}
          <div className="wallet-list">{wallets.map((w,i)=><button key={i} disabled={busy} onClick={()=>connect(w.provider)}>{w.icon?<img src={w.icon} width={28} height={28} alt=""/>:<Wallet size={26}/>}<span>{w.name}</span>{busy?<Loader2 size={18} className="spin"/>:<ArrowUpRight size={18}/>}</button>)}</div>
          {!wallets.length&&<p className="no-wallet">No browser wallet detected. Open this page in your wallet’s browser, or enable an Ethereum wallet extension.</p>}
          <div className="mobile-wallet-links">{[
            ['MetaMask',`https://link.metamask.io/dapp/${typeof window==='undefined'?'':window.location.href.replace(/^https?:\/\//,'')}`],
            ['Coinbase Wallet',`https://go.cb-w.com/dapp?cb_url=${typeof window==='undefined'?'':encodeURIComponent(window.location.href)}`],
            ['Rabby',`https://go.rabby.io/mobile/?dappUrl=${typeof window==='undefined'?'':encodeURIComponent(window.location.href)}`],
            ['Phantom',`https://phantom.app/ul/browse/${typeof window==='undefined'?'':encodeURIComponent(window.location.href)}?ref=${typeof window==='undefined'?'':encodeURIComponent(window.location.origin)}`],
          ].map(([name,href])=><a key={name} href={href}>Open in {name}<ArrowUpRight size={16}/></a>)}</div>
          <p className="wallet-error" role="alert">{walletError}</p>
          <button className="secondary-button" disabled={busy} onClick={()=>{setWalletOpen(false);start(true);}}>Play practice</button>
          <p className="fineprint">Use an Ethereum account with message signing. You can disconnect using the address in the header.</p>
        </>}
      </section>
    </div>}
  </>;
}
