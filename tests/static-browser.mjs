// Production-export interaction checks. Fixtures below never reach the live API.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { createGame, tick, replayChunk } from '../lib/game.ts';

const root=fileURLToPath(new URL('../',import.meta.url));
const args=process.argv.slice(2);
const option=name=>args.includes(name)?args[args.indexOf(name)+1]:undefined;
const {chromium,webkit}=await import(option('--playwright')||'playwright');
const axePath=option('--axe');
const AxeBuilder=axePath?(await import(pathToFileURL(resolve(axePath)).href)).default:null;
const out=resolve(option('--out')||resolve(root,'test/scratch/browser-validation'));
await mkdir(out,{recursive:true});
const result={export:'dist',checks:[],engines:[],limitations:[],screenshots:[]};
const check=(name,details)=>{result.checks.push({name,passed:true,details});console.log(`PASS: ${name}`);};
const child=spawn(process.execPath,[resolve(root,'scripts/preview-static.mjs'),'--port','0'],{stdio:['ignore','pipe','inherit']});
const base=await new Promise((yes,no)=>{let output='';child.stdout.on('data',data=>{output+=data;const m=output.match(/http:\/\/localhost:(\d+)\/preview\//);if(m)yes(`http://127.0.0.1:${m[1]}/preview/`);});child.on('error',no);child.on('exit',code=>no(new Error(`Preview exited: ${code}`)));});
const origin='https://wheelkeepers-a-little-hamster-a.imd.site';
const apiOrigin='https://wheelkeepers.dpdns.org';
const address='0x1234567890123456789012345678901234567890'; // Browser-only fixture.
const token='12345678-1234-4234-8234-123456789012'.repeat(2);
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2'};
const exportsFiles=async route=>{
  const path=new URL(route.request().url()).pathname;
  const file=resolve(root,'dist',path==='/'?'index.html':path.slice(1));
  try{await route.fulfill({status:200,body:await readFile(file),contentType:mime[extname(file)]||'text/plain'});}catch{await route.fulfill({status:404,body:'Not found'});}
};
let quickSeed=0,quickSteps=Infinity;
for(let seed=1;seed<=200;seed++){
  const g=createGame(seed);while(!g.ended&&g.step<5000)tick(g);
  if(g.ended&&g.score>0&&g.step<quickSteps){quickSeed=seed;quickSteps=g.step;}
}
assert.ok(quickSeed>0);
function instrument(){
  window.__walletMethods=[];window.__walletReject=false;window.__audioResumes=0;
  const Native=window.AudioContext||window.webkitAudioContext;
  if(Native){window.AudioContext=function(...args){const ac=new Native(...args),resume=ac.resume.bind(ac);ac.resume=()=>{window.__audioResumes++;return resume();};return ac;};window.AudioContext.prototype=Native.prototype;}
  const raf=window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame=fn=>raf(now=>fn(now*6));
  const provider={request:async data=>{window.__walletMethods.push(data.method);if(window.__walletReject)throw {code:4001,message:'Rejected'};if(data.method==='eth_requestAccounts')return['0x1234567890123456789012345678901234567890'];if(data.method==='personal_sign')return'fixture-signature';throw Error('Unexpected wallet method');},on(){},removeListener(){}};
  addEventListener('eip6963:requestProvider',()=>dispatchEvent(new CustomEvent('eip6963:announceProvider',{detail:{info:{name:'Test browser wallet',uuid:'fixture',icon:'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28"%3E%3Crect width="28" height="28" fill="%23a8baff"/%3E%3C/svg%3E'},provider}})));
}
async function fixtureContext(browser,{offline=false,blockedStorage=false}={}){
  const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true});
  await context.addInitScript(instrument);
  if(blockedStorage)await context.addInitScript(()=>Object.defineProperty(window,'localStorage',{get(){throw Error('Storage blocked by test');}}));
  await context.route(`${origin}/**`,exportsFiles);
  const state={signedIn:false,calls:[],runs:new Map(),rows:[],checkpoints:0,finished:0};
  await context.route(`${apiOrigin}/api/**`,async route=>{
    const request=route.request(),path=new URL(request.url()).pathname.slice(5),method=request.method(),data=request.postDataJSON();
    state.calls.push({path,method,data,authorization:request.headers()['authorization']});
    if(offline){await route.abort('failed');return;}
    const headers={'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'Content-Type, Authorization','Access-Control-Allow-Methods':'GET, POST, DELETE, OPTIONS'};
    const reply=body=>route.fulfill({status:200,headers,contentType:'application/json',body:JSON.stringify(body)});
    if(method==='OPTIONS'){await route.fulfill({status:204,headers});return;}
    if(path==='auth/session'){if(method==='DELETE')state.signedIn=false;await reply({address:state.signedIn?address:null,authMode:'bearer'});return;}
    if(path==='auth/nonce'){await reply({id:'fixture-nonce',message:`${new URL(origin).host} wants you to sign in with your Ethereum account:\n${address}\n\nURI: ${origin}\nVersion: 1`});return;}
    if(path==='auth/verify'){state.signedIn=true;await reply({address,token});return;}
    if(path==='pulse'){await reply({available:true,rpm:0,height:'4135',source:'Browser test fixture',receivedAt:new Date().toISOString(),state:'resting',seed:quickSeed,transaction:null,event:null,serverNow:Date.now()});return;}
    if(path==='leaderboard'){await reply({rows:state.rows,total:state.rows.length,me:state.rows[0]||null,event:null});return;}
    if(path==='runs'){
      assert.equal(request.headers()['authorization'],`Bearer ${token}`);
      if(data.action==='start'){const id=`fixture-${state.runs.size+1}`;state.runs.set(id,createGame(quickSeed));await reply({id,seed:quickSeed,boost:null});return;}
      if(data.action==='abandon'){await reply({ok:true});return;}
      if(data.action==='checkpoint'){
        const game=replayChunk(state.runs.get(data.id),data.moves,data.throughStep,data.finished);state.runs.set(data.id,game);state.checkpoints++;
        if(game.ended){state.finished++;state.rows=[{address,score:game.score,catches:game.catches,played:1}];}
        await reply({score:game.score,catches:game.catches,lives:game.lives,step:game.step,sequence:data.sequence,saved:game.ended,finished:game.ended});return;
      }
    }
    throw Error(`Unhandled fixture request ${method} ${path}`);
  });
  return{context,state};
}
async function audit(page,name){
  if(!AxeBuilder){result.limitations.push('Automated axe scan not run: pass --axe with the installed @axe-core/playwright entry.');return;}
  const audit=await new AxeBuilder({page}).analyze();
  assert.deepEqual(audit.violations.map(v=>({id:v.id,impact:v.impact,targets:v.nodes.map(n=>n.target)})),[],`${name} axe violations`);
  check(`${name}: axe accessibility scan`,`${audit.passes.length} rules passed; no violations. This is not a screen-reader test.`);
}
try{
  for(const[name,engine]of[['chromium',chromium],['webkit',webkit]]){
    const browser=await engine.launch({headless:true});
    result.engines.push(name);
    try{
      const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true});
      const page=await context.newPage(),errors=[],failed=[],remote=[];
      page.on('pageerror',e=>errors.push(e.message));
      page.on('requestfailed',r=>failed.push(r.url()));
      page.on('request',r=>{if(!r.url().startsWith(new URL(base).origin))remote.push(r.url());});
      await page.goto(base,{waitUntil:'networkidle'});
      await page.evaluate(()=>document.fonts.ready);
      for(const[width,height]of[[320,700],[390,844],[768,1024],[940,900],[1120,900],[1440,900]]){
        await page.setViewportSize({width,height});await page.evaluate(()=>new Promise(requestAnimationFrame));
        const layout=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,play:document.querySelector('.start-button').getBoundingClientRect().toJSON(),wheel:document.querySelector('canvas').getBoundingClientRect().toJSON()}));
        assert.ok(layout.scroll<=width+1,`${name} ${width}: horizontal overflow ${layout.scroll}`);
        if(width===390){assert.ok(layout.play.top>=0&&layout.play.bottom<=height,'Play is in the first phone screen');assert.ok(layout.wheel.top<height&&layout.wheel.width>250);result.mobile390=layout;}
        if(width===390||width===1440){const file=`${name}-${width}.png`;await page.screenshot({path:resolve(out,file)});result.screenshots.push(file);}
      }
      check(`${name}: responsive export`, 'No horizontal overflow at 320, 390, 768, 940, 1120 and 1440; product and Play visible at 390 × 844.');
      await page.setViewportSize({width:390,height:844});
      assert.match(await page.title(),/Wheelkeepers/);
      for(const selector of ['link[rel="icon"]','meta[name="description"]','meta[property="og:title"]','meta[property="og:image"]'])assert.ok(await page.locator(selector).getAttribute(selector.startsWith('link')?'href':'content'));
      const resources=await page.evaluate(()=>performance.getEntriesByType('resource').map(r=>r.name));
      assert.ok(resources.some(x=>x.endsWith('.woff2')));assert.equal(remote.length,0);
      check(`${name}: subpath assets and metadata`, 'Export served under /preview/; local fonts loaded; no remote resource requests.');
      await page.keyboard.press('Tab');assert.equal(await page.locator(':focus').textContent(),'Skip to game');await page.keyboard.press('Enter');
      await page.getByRole('button',{name:'Game instructions',exact:true}).click();
      assert.equal(await page.locator('.page-content').evaluate(el=>el.inert),true);
      await page.keyboard.press('Tab');assert.equal(await page.locator(':focus').getAttribute('aria-label'),'Close dialog');
      await audit(page,`${name} instructions`);
      await page.keyboard.press('Escape');assert.equal(await page.locator(':focus').getAttribute('aria-label'),'Game instructions');
      await page.getByRole('button',{name:'Connect wallet',exact:true}).click();
      assert.equal(await page.locator('.mobile-wallet-links a').count(),4);
      for(const a of await page.locator('.mobile-wallet-links a').all())assert.match(await a.getAttribute('href'),/127\.0\.0\.1|127%2E0|127\.0/);
      await audit(page,`${name} wallet sheet`);
      await page.keyboard.press('Escape');assert.equal(await page.locator(':focus').getAttribute('aria-label'),'Connect wallet');
      await page.evaluate(()=>scrollTo(0,0));await audit(page,`${name} ready`);
      await page.emulateMedia({reducedMotion:'reduce'});await page.evaluate(()=>new Promise(requestAnimationFrame));
      const still=await page.locator('canvas').evaluate(el=>el.toDataURL());await page.waitForTimeout(120);
      assert.equal(await page.locator('canvas').evaluate(el=>el.toDataURL()),still);
      assert.equal(await page.evaluate(()=>document.getAnimations().filter(a=>a.playState==='running'&&a.effect?.getTiming().iterations===Infinity).length),0);
      await page.emulateMedia({reducedMotion:'no-preference'});
      check(`${name}: reduced motion`, 'Idle canvas frames are identical and no endless CSS animation remains.');
      await page.locator('.start-button').focus();await page.keyboard.press('Enter');
      assert.equal(await page.locator('.game-mode').textContent(),'Practice run');
      assert.equal(await page.locator(':focus').getAttribute('class'),'canvas-wrap');
      await page.keyboard.down('ArrowRight');await page.evaluate(()=>new Promise(requestAnimationFrame));await page.keyboard.up('ArrowRight');
      await page.waitForTimeout(400);
      const c=await page.locator('canvas').boundingBox();await page.touchscreen.tap(c.x+c.width*.8,c.y+c.height*.35);
      if(name==='chromium'){
        const session=await context.newCDPSession(page);
        await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:c.x+c.width*.8,y:c.y+c.height*.5}]});
        await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:c.x+c.width*.5,y:c.y+c.height*.2}]});
        await page.waitForTimeout(120);
        const target=await page.locator('canvas').evaluate(el=>{
          const w=el.clientWidth,h=el.clientHeight,s=Math.min(w/470,h/460),ratio=el.width/w;
          const x=Math.round(w/2*ratio),y=Math.round((h/2-7*s-166*s)*ratio);
          const data=el.getContext('2d').getImageData(x-6,y-6,12,12).data;
          let blue=0;for(let i=0;i<data.length;i+=4)if(data[i+2]>data[i]*1.2&&data[i+2]>data[i+1]*1.1&&data[i+2]>75)blue++;return blue;
        });
        assert.ok(target>0,'Native touch drag paints the aim marker at the new angle');
        await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await session.detach();
        check('chromium: native touch drag', 'Touch start/move/end moves the rendered aim marker to the requested angle.');
      }
      await page.keyboard.press('Escape');await page.getByRole('heading',{name:'Ready to roll?'}).waitFor();
      await page.getByRole('button',{name:'Mute game sound',exact:true}).click();assert.equal(await page.getByRole('button',{name:'Enable game sound',exact:true}).getAttribute('aria-pressed'),'false');
      await page.getByRole('button',{name:'Practice Boost',exact:true}).click();assert.equal(await page.locator('.boost-status').textContent().then(x=>x.includes('Practice Boost')),true);
      await page.keyboard.press('Escape');await page.getByRole('heading',{name:'Ready to roll?'}).waitFor();
      await page.getByRole('button',{name:'Boost',exact:true}).click();assert.equal(await page.getByRole('button',{name:'Boost',exact:true}).getAttribute('aria-pressed'),'true');
      await page.getByRole('button',{name:'All time',exact:true}).click();
      assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);
      check(`${name}: real controls and dialogs`, 'Keyboard Play, arrow steering, touch tap, Escape exit, sound toggle, Practice Boost, board tabs, focus trap/return; no script or resource failures.');
      await context.close();

      const{context:fixtures,state}=await fixtureContext(browser);
      const gamePage=await fixtures.newPage();const gameErrors=[];gamePage.on('pageerror',e=>gameErrors.push(e.message));
      await gamePage.goto(origin,{waitUntil:'networkidle'});
      await gamePage.locator('.wallet-button[aria-label="Connect wallet"]').click();
      await gamePage.evaluate(()=>window.__walletReject=true);
      await gamePage.getByRole('button',{name:'Test browser wallet',exact:true}).click();await gamePage.getByText(/Sign-in cancelled/).waitFor();
      await gamePage.evaluate(()=>window.__walletReject=false);
      await gamePage.getByRole('button',{name:'Test browser wallet',exact:true}).click();await gamePage.locator('.modal').waitFor({state:'hidden'});
      assert.deepEqual(await gamePage.evaluate(()=>window.__walletMethods),['eth_requestAccounts','eth_requestAccounts','personal_sign']);
      const nonceCall=state.calls.find(x=>x.path==='auth/nonce');assert.equal(nonceCall.data.address,address);
      await gamePage.getByRole('button',{name:'Dismiss notification'}).click();
      await gamePage.locator('.start-button').click();
      await gamePage.waitForFunction(()=>document.querySelector('.save-status')?.textContent.includes('Verified'),null,{timeout:45000});
      assert.ok(state.checkpoints>0);assert.equal(state.finished,1);
      await gamePage.locator('tbody tr').first().waitFor();
      assert.equal(await gamePage.locator('tbody tr').count(),1);
      await audit(gamePage,`${name} populated leaderboard`);
      assert.ok(await gamePage.evaluate(()=>window.__audioResumes)>0);
      assert.equal((await gamePage.locator('.game-hud strong').first().textContent()),String(state.rows[0].score).padStart(4,'0'));
      check(`${name}: wallet and verified completion (fixtures)`, `${state.checkpoints} checkpoints independently replayed; rejection/retry, site-bound sign-in, bearer game requests, final score and shared-board refresh. No production writes.`);
      await gamePage.getByRole('button',{name:/Disconnect wallet/}).click();await gamePage.locator('.wallet-button[aria-label="Connect wallet"]').waitFor();
      await gamePage.getByRole('button',{name:'Dismiss notification'}).click();
      const runStarts=state.calls.filter(x=>x.path==='runs'&&x.data?.action==='start').length;
      const oldBest=await gamePage.evaluate(()=>localStorage.getItem('wk-best'));
      await gamePage.getByRole('button',{name:'Practice Boost',exact:true}).click();
      await gamePage.waitForFunction(()=>document.querySelector('.save-status')?.textContent.includes('Boost practice'),null,{timeout:45000});
      assert.equal(state.calls.filter(x=>x.path==='runs'&&x.data?.action==='start').length,runStarts);
      assert.equal(await gamePage.evaluate(()=>localStorage.getItem('wk-best')),oldBest);
      assert.ok(await gamePage.evaluate(()=>localStorage.getItem('wk-boost-best'))!==null);
      await gamePage.getByRole('button',{name:'Back to arcade',exact:true}).click();await gamePage.locator('.start-button').click();
      await gamePage.waitForFunction(()=>document.querySelector('.save-status')?.textContent.includes('Practice result'),null,{timeout:45000});
      const savedBest=await gamePage.evaluate(()=>localStorage.getItem('wk-best'));
      assert.ok(Number(savedBest)>0);
      await gamePage.reload({waitUntil:'networkidle'});
      assert.equal(await gamePage.locator('.personal-best b').textContent(),Number(savedBest).toLocaleString());
      check(`${name}: device persistence and Boost separation`, 'Guest completion persists best across reload; Practice Boost updates its own best and sends no ranked start request.');
      assert.deepEqual(gameErrors,[]);await fixtures.close();

      const{context:offline,state:offlineState}=await fixtureContext(browser,{offline:true});
      const offlinePage=await offline.newPage();await offlinePage.goto(origin,{waitUntil:'networkidle'});
      await offlinePage.getByRole('heading',{name:'Scores unavailable',exact:true}).waitFor();
      const before=offlineState.calls.length;await offlinePage.getByRole('button',{name:'Retry',exact:true}).click();
      await offlinePage.waitForFunction(()=>document.querySelector('.board-table').getAttribute('aria-busy')==='false');
      assert.ok(offlineState.calls.length>before);
      await offlinePage.locator('.start-button').click();assert.equal(await offlinePage.locator('.game-mode').textContent(),'Practice run');await offlinePage.keyboard.press('Escape');
      check(`${name}: service failure recovery`, 'Failed API requests show Scores unavailable and Retry; practice still starts and exits. Network failures are deliberately induced.');
      await offline.close();

      const{context:blocked}=await fixtureContext(browser,{blockedStorage:true});const storagePage=await blocked.newPage();await storagePage.goto(origin,{waitUntil:'networkidle'});
      await storagePage.locator('.start-button').click();await storagePage.getByText(/Storage is unavailable/).waitFor({timeout:45000});
      check(`${name}: blocked storage`, 'A completed practice run shows that the best lasts only for this page session.');await blocked.close();
    }finally{await browser.close();}
  }
  // Read-only check against the real API, from the already-authorized page origin.
  const liveBrowser=await chromium.launch({headless:true});
  try{
    const context=await liveBrowser.newContext({viewport:{width:390,height:844}});
    await context.route(`${origin}/**`,exportsFiles);
    const page=await context.newPage(),responses=[],errors=[];
    page.on('response',r=>{if(r.url().startsWith(`${apiOrigin}/api/`))responses.push({url:r.url(),status:r.status()});});
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto(origin,{waitUntil:'networkidle'});
    await page.waitForFunction(()=>document.querySelector('.board-table')?.getAttribute('aria-busy')==='false');
    assert.ok(responses.length>=3);
    assert.ok(responses.every(r=>r.status===200));assert.deepEqual(errors,[]);
    assert.equal(await page.getByRole('heading',{name:'Scores unavailable',exact:true}).count(),0);
    check('live production API: read-only browser check',responses);
    await context.close();
  }finally{await liveBrowser.close();}
  result.limitations.push('No real wallet, passkey wallet, physical phone, screen reader, native browser zoom, or production score submission was exercised. Real API requests were read-only. Wallet signatures and score writes were browser fixtures.');
  result.passed=true;
}catch(error){result.passed=false;result.failure=error.stack;console.error(error);process.exitCode=1;}
finally{child.kill('SIGTERM');await writeFile(resolve(out,'results.json'),JSON.stringify(result,null,2)+'\n');console.log(`Evidence: ${out}/results.json`);}
