import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { chromium, attachQualityTelemetry, waitForRuntimeAssets, sourceFingerprint, evidenceDir } from './quality-browser.mjs';
import { localServer } from './quality-isolated-server.mjs';

const candidate = 'assets/ui/arpg/source-history/painted-v3-candidate';
const uiFiles = ['index.html','styles.css','src/ui/arpg-hud.js','src/ui/presentation.js','src/ui/arpg-painted.css','assets/ui/arpg/icons.svg',...fs.readdirSync('assets/ui/arpg/painted-v3').map(p=>'assets/ui/arpg/painted-v3/'+p)];
const exportManifest=JSON.parse(fs.readFileSync(candidate+'/optimized-256/export-manifest.json'));
const preservedSources=JSON.parse(fs.readFileSync(candidate+'/optimized-256/pre-promotion-sources.json')); 
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const candidateFiles = fs.readdirSync(candidate,{recursive:true}).map(p=>path.join(candidate,p)).filter(p=>fs.statSync(p).isFile());
const baseline = {ui:Object.fromEntries(uiFiles.map(p=>[p,hash(p)])),candidate:Object.fromEntries(candidateFiles.map(p=>[p,hash(p)])),runtime:sourceFingerprint()};
const lock = '/tmp/bipx-arpg-gpu.lock', token=crypto.randomUUID();
try { fs.mkdirSync(lock); } catch(error) { if(error.code==='EEXIST'){console.log('GPU occupied; art candidate capture deferred.');process.exit(75);}throw error; }
fs.writeFileSync(path.join(lock,'owner.json'),JSON.stringify({owner:'gui-painted-integrated',pid:process.pid,token,startedAt:new Date().toISOString()}));
const report = {candidate:'painted-v3-256',isolated:false,promoted:true,checks:[],native:[],errors:[],baseline};
const check=(name,value)=>{assert.ok(value,name);report.checks.push(name);};
let browser,server;
try {
  server=await localServer();
  browser=await chromium.launch({channel:'chrome',headless:false,args:['--disable-background-timer-throttling','--disable-renderer-backgrounding']});
  const board=await browser.newPage({viewport:{width:1240,height:890},deviceScaleFactor:1});
  board.on('pageerror',e=>report.errors.push(e.message));
  board.on('response',r=>{if(r.status()>=400)report.errors.push(`${r.status()} ${r.url()}`);});
  await board.goto(`${server.origin}/${candidate}/optimized-board.html`,{waitUntil:'domcontentloaded'});
  await board.waitForFunction(()=>window.artBoardReady===true);
  check('All masters and WebP derivatives decoded in 72 comparison cells',await board.locator('.matrix .arpg-skill__art').evaluateAll(arts=>arts.length===72&&arts.every(art=>+art.dataset.decodedWidth===(art.closest('button').dataset.format==='master'?1254:256))));
  check('Master pixels preserved and shipped WebPs exactly match exports',exportManifest.items.every(i=>hash(i.master)===i.masterSha256&&hash('assets/ui/arpg/painted-v3/'+i.id+'.webp')===i.sha256));
  report.boardGeometry=await board.locator('.matrix .arpg-skill').evaluateAll(buttons=>buttons.map(button=>{
    const rect=el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom};};
    const timer=button.querySelector('.arpg-skill__timer');
    return {id:button.dataset.skillId,state:button.dataset.state,size:+button.dataset.previewSize,format:button.dataset.format,candidate:Boolean(button.closest('.arpg-art-v3')),button:rect(button),cost:rect(button.querySelector('.arpg-skill__cost')),timer:timer.textContent?rect(timer):null,disabled:button.getAttribute('aria-disabled'),artOpacity:getComputedStyle(button.querySelector('.arpg-skill__art')).opacity,mask:getComputedStyle(button.querySelector('.arpg-skill__mask')).backgroundImage};
  }));
  check('All board slots match exact requested 48/64 pixels',report.boardGeometry.every(r=>r.button.width===r.size&&r.button.height===r.size));
  const overlaps=(a,b)=>a.x<b.right&&a.right>b.x&&a.y<b.bottom&&a.bottom>b.y;
  check('Candidate countdown and cost do not overlap',report.boardGeometry.filter(r=>r.candidate&&r.timer).every(r=>!overlaps(r.timer,r.cost)));
  check('Candidate keeps art opacity while retaining disabled semantics',report.boardGeometry.filter(r=>r.candidate&&r.state!=='ready').every(r=>r.artOpacity==='1'&&r.disabled==='true'));
  await board.locator('.arpg-art-v3 .arpg-skill').first().focus();
  check('Candidate keyboard focus outline remains visible',await board.locator('.arpg-art-v3 .arpg-skill').first().evaluate(e=>getComputedStyle(e).outlineStyle==='solid'&&getComputedStyle(e).outlineWidth==='2px'));
  await board.locator('h1').click();
  await board.screenshot({path:path.join(evidenceDir,'painted-master-webp-board.png'),fullPage:true});
  await board.close();
  for(const classId of ['warrior','dwarf']){
    const mobile=classId==='dwarf';
    const context=await browser.newContext({viewport:mobile?{width:393,height:852}:{width:1440,height:900},deviceScaleFactor:1,isMobile:mobile,hasTouch:true});
    await context.addInitScript(()=>{localStorage.setItem('bipx-controls-seen','true');window.artRequests=[];window.addEventListener('bipx:skill-request',e=>window.artRequests.push(e.detail));});
    const page=await context.newPage();
    const artResponses=[];page.on('response',r=>{if(r.url().includes('/assets/ui/arpg/painted-v3/'))artResponses.push({url:r.url(),status:r.status(),mime:r.headers()['content-type']});});
    const telemetry=attachQualityTelemetry(page,`painted-integrated-${classId}`);telemetry.report.browserLaunch={channel:'chrome',headless:false};
    try {
      await page.goto(server.origin+'/?offline=1',{waitUntil:'domcontentloaded'});
      await waitForRuntimeAssets(page,telemetry);
      check(`${classId}: painted stylesheet is loaded by the real index`,await page.locator('link[href="./src/ui/arpg-painted.css"]').count()===1&&await page.locator('#arpg-hud.arpg-art-v3').count()===1);
      await page.locator('#open-login-button').click();
      await page.locator(`label[for="character-${classId}"]`).click();
      await waitForRuntimeAssets(page,telemetry);
      await page.locator('#player-name').fill(`Arte ${classId}`);
      await page.locator('#play-button').click();
      await page.waitForFunction(()=>window.__zombieNightDebug?.getState().state==='playing'&&document.querySelector('#arpg-hud').dataset.connected==='true');
      const loaded=await page.locator('.arpg-skill__art').evaluateAll(async arts=>Promise.all(arts.map(async art=>{
        const url=getComputedStyle(art).backgroundImage.slice(5,-2);const img=new Image();img.src=url;await img.decode();return {url,width:img.naturalWidth,height:img.naturalHeight};
      })));
      check(`${classId}: all three optimized paintings decode in the actual HUD`,loaded.length===3&&loaded.every(i=>i.width===256&&i.height===256&&i.url.includes('/painted-v3/')));
      await page.waitForFunction(()=>document.querySelector('[data-arpg-slot="0"]').dataset.state==='ready');
      const initialArtResponseCount=artResponses.length;
      const before=await page.evaluate(()=>window.__zombieNightDebug.getArpgState());
      await telemetry.capture('ready');
      await page.locator('#arpg-hud').screenshot({path:path.join(evidenceDir,`painted-integrated-${classId}-hud-ready.png`)});
      if(mobile)await page.locator('[data-arpg-slot="0"]').tap();else await page.locator('[data-arpg-slot="0"]').click();
      await page.waitForFunction(()=>document.querySelector('[data-arpg-slot="0"]').dataset.state==='cooldown');
      const after=await page.evaluate(()=>({hud:window.__zombieNightDebug.getArpgState(),requests:window.artRequests,tooltipVisible:!document.querySelector('#arpg-tooltip').hidden}));
      check(`${classId}: real pointer cast charges authoritative cost and cooldown`,after.hud.resource<before.resource&&after.hud.skills[0].cooldownRemaining>0);
      check(`${classId}: art does not change intent or reopen tooltip`,after.requests.length===1&&after.requests[0].slot===0&&!after.tooltipVisible);
      await page.waitForTimeout(450);
      await telemetry.capture('cooldown');
      await page.locator('#arpg-hud').screenshot({path:path.join(evidenceDir,`painted-integrated-${classId}-hud-cooldown.png`)});
      // The same real run also demonstrates portrait with a held movement finger.
      if(!mobile) await page.setViewportSize({width:393,height:852});
      await page.waitForTimeout(180);
      await telemetry.capture('portrait');
      const portrait=await page.evaluate(()=>{
        const rect=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height};};
        return {hud:rect(document.querySelector('#arpg-hud')),slots:[...document.querySelectorAll('[data-arpg-slot]')].map(rect),sticks:[...document.querySelectorAll('#touch-stick,#touch-fire')].map(rect),orbs:document.querySelectorAll('.arpg-orb').length};
      });
      check(`${classId}: portrait retains two orbs and touch slots clear of joysticks`,portrait.orbs===2&&portrait.hud.x>=0&&portrait.hud.right<=393&&portrait.hud.bottom<=852&&portrait.slots.every(r=>r.width>=44&&r.height>=44&&portrait.sticks.every(j=>!overlaps(r,j))));
      await page.waitForFunction(()=>document.querySelector('[data-arpg-slot="1"]').dataset.state==='ready');
      const touch=await context.newCDPSession(page),r=await page.locator('#touch-stick').boundingBox(),b=await page.locator('[data-arpg-slot="1"]').boundingBox();
      const secondBefore=await page.evaluate(()=>({requests:window.artRequests.length,game:window.__zombieNightDebug.getState()}));
      const movement={id:1,x:r.x+r.width/2,y:r.y+14},skillTouch={id:2,x:b.x+b.width/2,y:b.y+b.height/2};
      await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...movement,y:r.y+r.height/2}]});
      await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[movement]});
      await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[movement,skillTouch]});
      await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[skillTouch]});
      await page.waitForFunction(()=>document.querySelector('[data-arpg-slot="1"]').dataset.state==='cooldown');
      await page.waitForTimeout(450);
      const secondAfter=await page.evaluate(()=>({requests:window.artRequests,game:window.__zombieNightDebug.getState(),tooltipHidden:document.querySelector('#arpg-tooltip').hidden}));
      await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
      check(`${classId}: second finger casts once with joystick still moving and help dismissed`,secondAfter.requests.length===secondBefore.requests+1&&secondAfter.requests.at(-1).slot===1&&secondAfter.tooltipHidden&&Math.hypot(secondAfter.game.player.x-secondBefore.game.player.x,secondAfter.game.player.z-secondBefore.game.player.z)>.05);
      await telemetry.capture('portrait-second-touch');
      await page.setViewportSize({width:852,height:393});await page.waitForTimeout(120);
      const landscapeLabels=await page.locator('[data-arpg-slot]').evaluateAll(buttons=>buttons.map(button=>{
        const rect=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height};};
        const timer=button.querySelector('.arpg-skill__timer');return {text:timer.textContent,button:rect(button),timer:rect(timer),cost:rect(button.querySelector('.arpg-skill__cost')),font:getComputedStyle(timer).fontSize};
      }));
      check(`${classId}: native landscape timer/cost remain separate at48px`,landscapeLabels.every(r=>r.button.width===48&&r.font==='11px'&&(!r.text||!overlaps(r.timer,r.cost))));
      await telemetry.capture('landscape');
      await page.locator('#pause-button').click();await page.locator('#contrast-toggle').check();await page.locator('#dialog-done').click();
      check(`${classId}: high contrast setting retains opaque panel and readable timer`,await page.locator('.arpg-actions').evaluate(e=>getComputedStyle(e).backgroundColor==='rgb(6, 9, 13)')&&await page.locator('.arpg-skill__timer').first().evaluate(e=>getComputedStyle(e).color==='rgb(255, 248, 233)'));
      await telemetry.capture('high-contrast');
      await page.locator('[data-arpg-slot="1"]').focus();
      check(`${classId}: intentional focused help remains available`,await page.locator('#arpg-tooltip').isVisible());
      await page.locator('#game-canvas').focus();
      await page.emulateMedia({reducedMotion:'reduce'});
      check(`${classId}: no candidate CSS animation in reduced motion`,await page.locator('.arpg-skill__art').first().evaluate(e=>getComputedStyle(e).animationName==='none'));
      check(`${classId}: WebP HTTP MIME valid and no repeat art fetches after initial decode`,artResponses.length===initialArtResponseCount&&artResponses.length>=3&&artResponses.every(r=>r.status===200&&r.mime==='image/webp'));
      check(`${classId}: basic weapon SVG remains visible`,await page.locator('.arpg-basic use').evaluate(e=>e.getBBox().width>10&&getComputedStyle(e.closest('svg')).visibility==='visible'));
      telemetry.assertClean();
      report.native.push({classId,before,after,loaded,artResponses,portrait,landscapeLabels,secondBefore,secondAfter});
    }catch(error){telemetry.fail(error);throw error;}
    finally {await telemetry.save({candidate:'painted-v3-256',scope:'Real gameplay loading promoted GUI through index, no CSS/state injection. Desktop, portrait/landscape and emulated touch; not physical device.',candidateHashes:baseline.candidate});await context.close();}
  }
  check('No page or HTTP errors on comparison board',report.errors.length===0);
  check('Promoted GUI runtime stable during capture',uiFiles.every(p=>hash(p)===baseline.ui[p]));
  check('Candidate assets unchanged throughout capture',candidateFiles.every(p=>hash(p)===baseline.candidate[p]));
  check('Input, presentation, base styles and sprite preserved',Object.entries(preservedSources).filter(([p])=>p!=='index.html').every(([p,h])=>hash(p)===h));
  report.runtimeSourceChangedDuringCapture=JSON.stringify(sourceFingerprint())!==JSON.stringify(baseline.runtime);
  report.passed=true;
}catch(error){report.failure=error.stack;process.exitCode=1;}
finally {
  await browser?.close();await server?.stop();
  if(fs.existsSync(path.join(lock,'owner.json'))&&JSON.parse(fs.readFileSync(path.join(lock,'owner.json'))).token===token)fs.rmSync(lock,{recursive:true});
  fs.writeFileSync(path.join(evidenceDir,'painted-integrated.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify({evidenceDir,passed:report.passed,checks:report.checks.length,failure:report.failure,runtimeSourceChangedDuringCapture:report.runtimeSourceChangedDuringCapture}));
}
