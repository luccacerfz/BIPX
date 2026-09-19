import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {chromium,waitForRuntimeAssets,sourceFingerprint} from './quality-browser.mjs';
import {launchProtocolServer} from './quality-protocol.mjs';
import {spawnFixture} from './player-spawn-fixture.mjs';
import {localServer} from './quality-isolated-server.mjs';
const base='output/gui-compact-recovery-v1',candidate=fs.readFileSync(base+'/candidate.css','utf8');
const lock='/tmp/bipx-arpg-gpu.lock',token=crypto.randomUUID();
try{fs.mkdirSync(lock);}catch(e){if(e.code==='EEXIST'){console.log('GPU occupied; compact staging deferred.');process.exit(75);}throw e;}
fs.writeFileSync(path.join(lock,'owner.json'),JSON.stringify({owner:'gui-compact-recovery-v1',pid:process.pid,token,created:new Date().toISOString()}));
const output=path.resolve(base,'evidence',new Date().toISOString().replace(/[:.]/g,'-'));fs.mkdirSync(output,{recursive:true});
fs.copyFileSync(new URL(import.meta.url),path.join(output,'verifier.mjs'));fs.writeFileSync(path.join(output,'candidate.css'),candidate);
const baseline=sourceFingerprint(),candidateHash=crypto.createHash('sha256').update(candidate).digest('hex');
const report={scope:'Real current client/server rejection with private synthetic blocked spawn; CSS candidate injected only in QA browser. Touch emulation, not physical device.',runtimePromoted:false,source:baseline,candidateHash,checks:[],variants:[],errors:[]};
const check=(n,v)=>{assert.ok(v,n);report.checks.push(n);};
const overlap=(a,b)=>a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;
const within=(r,b)=>r.top>=b.top-.5&&r.bottom<=b.bottom+.5&&r.left>=b.left-.5&&r.right<=b.right+.5;
const read=page=>page.evaluate(()=>{
 const rect=e=>{const r=e.getBoundingClientRect();return{left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height};};
 const menu=document.querySelector('#message'),copy=document.querySelector('#message-copy'),retry=document.querySelector('#play-button'),form=document.querySelector('.main-menu__login'),sound=document.querySelector('#audio-toggle');
 const m=rect(menu),f=rect(form),view={left:0,top:0,right:innerWidth,bottom:innerHeight};
 const clip={left:Math.max(m.left,0),right:Math.min(m.right,innerWidth),top:Math.max(m.top,0),bottom:Math.min(m.bottom,innerHeight)};
 const visibleForm={left:Math.max(f.left,clip.left),right:Math.min(f.right,clip.right),top:Math.max(f.top,clip.top),bottom:Math.min(f.bottom,clip.bottom)};
 const focusSurface=document.activeElement.matches('.character-option input')?document.activeElement.nextElementSibling:document.activeElement;
 return{menu:m,form:f,visibleForm,view,clip,copy:rect(copy),retry:rect(retry),sound:rect(sound),copyText:copy.textContent,copyPosition:getComputedStyle(copy).position,overflow:getComputedStyle(menu).overflowY,scrollTop:menu.scrollTop,scrollHeight:menu.scrollHeight,clientHeight:menu.clientHeight,scrollWidth:menu.scrollWidth,clientWidth:menu.clientWidth,focused:document.activeElement.id,focusedRect:rect(document.activeElement),focusSurface:rect(focusSurface),name:document.querySelector('#player-name').value,selected:document.querySelector('[name="character"]:checked').value,sameLabel:window.compactLabel===document.querySelector('#play-button-label'),sameIcon:window.compactIcon===retry.querySelector('svg'),marker:menu.dataset.runStartRejected||null,soundText:sound.textContent,soundPressed:sound.getAttribute('aria-pressed')};
});
let browser,server,protocol;
try{
 server=await localServer();protocol=await launchProtocolServer('compact-recovery',spawnFixture);
 browser=await chromium.launch({channel:'chrome',headless:false});
 for(const variant of ['before','candidate']){
  const context=await browser.newContext({viewport:{width:320,height:568},hasTouch:true,isMobile:true,deviceScaleFactor:1});
  await context.addInitScript(()=>localStorage.setItem('bipx-controls-seen','true'));
  const page=await context.newPage(),messages=[],result={variant,views:[],focus:[]};
  page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});page.on('response',r=>{if(r.status()>=400)report.errors.push(`${r.status()} ${r.url()}`);});
  page.on('websocket',ws=>ws.on('framereceived',({payload})=>{try{messages.push(JSON.parse(String(payload)));}catch{}}));
  try{
   const room='gui-compact-'+variant,url=new URL(server.origin+'/');url.searchParams.set('room',room);url.searchParams.set('ws',protocol.wsUrl);
   await page.goto(url.href,{waitUntil:'domcontentloaded'});await waitForRuntimeAssets(page);
   if(variant==='candidate')await page.addStyleTag({content:candidate});
   await page.waitForFunction(()=>window.__zombieNightDebug.getState().multiplayer.connected);
   const welcome=messages.find(m=>m.type==='welcome');assert.ok(welcome);
   await protocol.requestFixture('qa-spawn-config',{room,actors:[{x:0,z:welcome.selfState.z,radius:30}]});
   await page.locator('#open-login-button').click();await page.locator('#player-name').fill('Compact QA');
   await page.evaluate(()=>{window.compactLabel=document.querySelector('#play-button-label');window.compactIcon=document.querySelector('#play-button svg');});
   await page.locator('#play-button').click();await page.waitForFunction(()=>document.querySelector('#message').dataset.runStartRejected==='true');
   check(`${variant}: real matching server rejection observed`,messages.some(m=>m.type==='runStartRejected')&&!messages.some(m=>m.type==='runStarted'));
   for(const size of [{width:320,height:568},{width:393,height:852},{width:1280,height:800},{width:852,height:393}]){
    await page.setViewportSize(size);await page.locator('#player-name').focus();await page.locator('#play-button').focus();await page.waitForTimeout(100);
    const view=await read(page);view.size=size;result.views.push(view);
    await page.screenshot({path:path.join(output,`${variant}-${size.width}x${size.height}.png`)});
    check(`${variant} ${size.width}: label/icon/name/class retained`,view.sameLabel&&view.sameIcon&&view.name==='Compact QA'&&view.selected==='warrior');
    check(`${variant} ${size.width}: retry focused and visible with horizontal bounds intact`,view.focused==='play-button'&&within(view.retry,view.clip)&&view.scrollWidth<=view.clientWidth);
    if(variant==='candidate'){
     check(`candidate ${size.width}: recovery reason and action visible together`,within(view.copy,view.clip)&&within(view.retry,view.clip));
     if(size.width===320)check('candidate 320: fixed sound does not cover visible form',!overlap(view.sound,view.visibleForm));
    }
   }
   if(variant==='candidate'){
    await page.setViewportSize({width:320,height:568});await page.locator('#player-name').focus();await page.locator('#play-button').focus();
    for(const expected of ['player-name','character-warrior','login-back-button']){
     await page.keyboard.press('Shift+Tab');const state=await read(page);result.focus.push(state);
     await page.screenshot({path:path.join(output,`candidate-focus-${expected}-320x568.png`)});
     check(`compact keyboard ${expected}: native tab order and focus remain unobscured`,state.focused===expected&&within(state.focusSurface,state.clip)&&!overlap(state.focusSurface,state.copy)&&!overlap(state.focusSurface,state.sound));
    }
    await page.screenshot({path:path.join(output,'candidate-back-focus-320x568.png')});
    await page.keyboard.press('Enter');check('Back removes candidate marker through actual main',await page.locator('#message').getAttribute('data-run-start-rejected')===null);
    await page.locator('#open-login-button').click();const reopened=await read(page);result.reopened=reopened;
    check('Reopened normal login retains name/class/DOM',reopened.name==='Compact QA'&&reopened.selected==='warrior'&&reopened.sameLabel&&reopened.sameIcon&&reopened.copyPosition==='static');
    await page.locator('#play-button').click();await page.waitForFunction(()=>document.querySelector('#message').dataset.runStartRejected==='true');
    await protocol.requestFixture('qa-spawn-config',{room,actors:[]});
    await page.locator('#play-button').click();await page.waitForFunction(()=>window.__zombieNightDebug.getState().state==='playing');
    for(let i=0;i<80&&!messages.some(m=>m.type==='runStarted');i++)await page.waitForTimeout(25);
    result.afterRetry=await page.evaluate(()=>({marker:document.querySelector('#message').dataset.runStartRejected||null,state:window.__zombieNightDebug.getState().state,orbs:document.querySelectorAll('.arpg-orb').length}));
    await page.screenshot({path:path.join(output,'candidate-retry-playing-320x568.png')});
    check('Actual retry accepts and clears marker without touching HUD',messages.some(m=>m.type==='runStarted')&&await page.locator('#message').getAttribute('data-run-start-rejected')===null&&await page.locator('.arpg-orb').count()===2);
   }
  }finally{result.responses=messages.filter(m=>['runStartRejected','runStarted'].includes(m.type)).map(m=>m.type);report.variants.push(result);await context.close();}
 }
 const a=report.variants[0],b=report.variants[1];
 check('Baseline reproduces missing recovery reason and fixed-control overlap at320',!within(a.views[0].copy,a.views[0].clip)&&overlap(a.views[0].sound,a.views[0].visibleForm));
 for(let i=1;i<4;i++){
  const fields=['menu','form','copy','retry','sound','copyPosition'];
  check(`Outside compact breakpoint ${a.views[i].size.width}: existing geometry preserved`,fields.every(k=>JSON.stringify(a.views[i][k])===JSON.stringify(b.views[i][k])));
 }
 check('No page/console/HTTP errors',report.errors.length===0);
 report.sourceChanged=JSON.stringify(baseline)!==JSON.stringify(sourceFingerprint());check('Runtime source stable throughout A/B',!report.sourceChanged);
 report.passed=true;
}catch(e){report.failure=e.stack;process.exitCode=1;}
finally{
 await browser?.close();await protocol?.stop();await server?.stop();
 if(fs.existsSync(path.join(lock,'owner.json'))&&JSON.parse(fs.readFileSync(path.join(lock,'owner.json'))).token===token)fs.rmSync(lock,{recursive:true});
 fs.writeFileSync(path.join(output,'compact-recovery.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({output,passed:report.passed,checks:report.checks.length,failure:report.failure,sourceChanged:report.sourceChanged}));
}
