import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { chromium, attachQualityTelemetry, waitForRuntimeAssets, sourceFingerprint, evidenceDir } from './quality-browser.mjs';
import { localServer } from './quality-isolated-server.mjs';

const candidate = 'assets/ui/arpg/source-history/painted-v3-candidate';
const uiFiles = ['index.html','styles.css','src/ui/arpg-hud.js','src/ui/presentation.js','assets/ui/arpg/icons.svg'];
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const candidateFiles = fs.readdirSync(candidate,{recursive:true}).map(p=>path.join(candidate,p)).filter(p=>fs.statSync(p).isFile());
const baseline = {ui:Object.fromEntries(uiFiles.map(p=>[p,hash(p)])),candidate:Object.fromEntries(candidateFiles.map(p=>[p,hash(p)])),runtime:sourceFingerprint()};
const lock = '/tmp/bipx-arpg-gpu.lock', token=crypto.randomUUID();
try { fs.mkdirSync(lock); } catch(error) { if(error.code==='EEXIST'){console.log('GPU occupied; art candidate capture deferred.');process.exit(75);}throw error; }
fs.writeFileSync(path.join(lock,'owner.json'),JSON.stringify({owner:'gui-art-candidate',pid:process.pid,token,startedAt:new Date().toISOString()}));
const report = {candidate:'painted-v3',isolated:true,promoted:false,checks:[],native:[],errors:[],baseline};
const check=(name,value)=>{assert.ok(value,name);report.checks.push(name);};
let browser,server;
try {
  server=await localServer();
  browser=await chromium.launch({channel:'chrome',headless:false,args:['--disable-background-timer-throttling','--disable-renderer-backgrounding']});
  const board=await browser.newPage({viewport:{width:1220,height:1230},deviceScaleFactor:1});
  board.on('pageerror',e=>report.errors.push(e.message));
  board.on('response',r=>{if(r.status()>=400)report.errors.push(`${r.status()} ${r.url()}`);});
  await board.goto(`${server.origin}/${candidate}/board.html`,{waitUntil:'domcontentloaded'});
  await board.waitForFunction(()=>window.artBoardReady===true);
  check('All six original paintings decoded',await board.locator('.gallery img').evaluateAll(images=>images.length===6&&images.every(img=>img.complete&&img.naturalWidth===1254)));
  check('54 baseline/candidate state-size cells rendered',await board.locator('.matrix .arpg-skill').count()===54);
  report.boardGeometry=await board.locator('.matrix .arpg-skill').evaluateAll(buttons=>buttons.map(button=>{
    const rect=el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom};};
    const timer=button.querySelector('.arpg-skill__timer');
    return {id:button.dataset.skillId,state:button.dataset.state,size:+button.dataset.previewSize,candidate:Boolean(button.closest('.arpg-art-v3')),button:rect(button),cost:rect(button.querySelector('.arpg-skill__cost')),timer:timer.textContent?rect(timer):null,disabled:button.getAttribute('aria-disabled'),artOpacity:getComputedStyle(button.querySelector('.arpg-skill__art')).opacity,mask:getComputedStyle(button.querySelector('.arpg-skill__mask')).backgroundImage};
  }));
  check('All board slots match exact requested 48/64 pixels',report.boardGeometry.every(r=>r.button.width===r.size&&r.button.height===r.size));
  const overlaps=(a,b)=>a.x<b.right&&a.right>b.x&&a.y<b.bottom&&a.bottom>b.y;
  check('Candidate countdown and cost do not overlap',report.boardGeometry.filter(r=>r.candidate&&r.timer).every(r=>!overlaps(r.timer,r.cost)));
  check('Candidate keeps art opacity while retaining disabled semantics',report.boardGeometry.filter(r=>r.candidate&&r.state!=='ready').every(r=>r.artOpacity==='1'&&r.disabled==='true'));
  await board.locator('.arpg-art-v3 .arpg-skill').first().focus();
  check('Candidate keyboard focus outline remains visible',await board.locator('.arpg-art-v3 .arpg-skill').first().evaluate(e=>getComputedStyle(e).outlineStyle==='solid'&&getComputedStyle(e).outlineWidth==='2px'));
  await board.locator('h1').click();
  await board.screenshot({path:path.join(evidenceDir,'art-state-board.png'),fullPage:true});
  await board.close();
  for(const classId of ['warrior','dwarf']){
    const mobile=classId==='dwarf';
    const context=await browser.newContext({viewport:mobile?{width:393,height:852}:{width:1440,height:900},deviceScaleFactor:1,isMobile:mobile,hasTouch:mobile});
    await context.addInitScript(()=>{localStorage.setItem('bipx-controls-seen','true');window.artRequests=[];window.addEventListener('bipx:skill-request',e=>window.artRequests.push(e.detail));});
    const page=await context.newPage();
    const telemetry=attachQualityTelemetry(page,`art-candidate-${classId}`);telemetry.report.browserLaunch={channel:'chrome',headless:false};
    try {
      await page.goto(server.origin+'/?offline=1',{waitUntil:'domcontentloaded'});
      await waitForRuntimeAssets(page,telemetry);
      await page.addStyleTag({url:`${server.origin}/${candidate}/candidate.css`});
      await page.evaluate(()=>document.documentElement.classList.add('arpg-art-v3'));
      await page.locator('#open-login-button').click();
      await page.locator(`label[for="character-${classId}"]`).click();
      await waitForRuntimeAssets(page,telemetry);
      await page.locator('#player-name').fill(`Arte ${classId}`);
      await page.locator('#play-button').click();
      await page.waitForFunction(()=>window.__zombieNightDebug?.getState().state==='playing'&&document.querySelector('#arpg-hud').dataset.connected==='true');
      const loaded=await page.locator('.arpg-skill__art').evaluateAll(async arts=>Promise.all(arts.map(async art=>{
        const url=getComputedStyle(art).backgroundImage.slice(5,-2);const img=new Image();img.src=url;await img.decode();return {url,width:img.naturalWidth};
      })));
      check(`${classId}: all three candidate paintings decode in the actual HUD`,loaded.length===3&&loaded.every(i=>i.width===1254));
      const before=await page.evaluate(()=>window.__zombieNightDebug.getArpgState());
      await telemetry.capture('ready');
      await page.locator('#arpg-hud').screenshot({path:path.join(evidenceDir,`art-candidate-${classId}-hud-ready.png`)});
      if(mobile)await page.locator('[data-arpg-slot="0"]').tap();else await page.locator('[data-arpg-slot="0"]').click();
      await page.waitForFunction(()=>document.querySelector('[data-arpg-slot="0"]').dataset.state==='cooldown');
      const after=await page.evaluate(()=>({hud:window.__zombieNightDebug.getArpgState(),requests:window.artRequests,tooltipVisible:!document.querySelector('#arpg-tooltip').hidden}));
      check(`${classId}: real pointer cast charges authoritative cost and cooldown`,after.hud.resource<before.resource&&after.hud.skills[0].cooldownRemaining>0);
      check(`${classId}: art does not change intent or reopen tooltip`,after.requests.length===1&&after.requests[0].slot===0&&!after.tooltipVisible);
      await page.waitForTimeout(450);
      await telemetry.capture('cooldown');
      await page.locator('#arpg-hud').screenshot({path:path.join(evidenceDir,`art-candidate-${classId}-hud-cooldown.png`)});
      if(mobile){await page.setViewportSize({width:852,height:393});await page.waitForTimeout(120);await telemetry.capture('landscape');}
      await page.locator('[data-arpg-slot="1"]').focus();
      check(`${classId}: intentional focused help remains available`,await page.locator('#arpg-tooltip').isVisible());
      await page.locator('#game-canvas').focus();
      await page.emulateMedia({reducedMotion:'reduce'});
      check(`${classId}: no candidate CSS animation in reduced motion`,await page.locator('.arpg-skill__art').first().evaluate(e=>getComputedStyle(e).animationName==='none'));
      telemetry.assertClean();
      report.native.push({classId,before,after,loaded});
    }catch(error){telemetry.fail(error);throw error;}
    finally {await telemetry.save({candidate:'painted-v3',scope:'Real gameplay with candidate CSS injected only into this QA browser. No source/runtime promotion.',candidateHashes:baseline.candidate});await context.close();}
  }
  check('No page or HTTP errors on comparison board',report.errors.length===0);
  check('Live GUI runtime source untouched',uiFiles.every(p=>hash(p)===baseline.ui[p]));
  check('Candidate assets unchanged throughout capture',candidateFiles.every(p=>hash(p)===baseline.candidate[p]));
  report.runtimeSourceChangedDuringCapture=JSON.stringify(sourceFingerprint())!==JSON.stringify(baseline.runtime);
  report.passed=true;
}catch(error){report.failure=error.stack;process.exitCode=1;}
finally {
  await browser?.close();await server?.stop();
  if(fs.existsSync(path.join(lock,'owner.json'))&&JSON.parse(fs.readFileSync(path.join(lock,'owner.json'))).token===token)fs.rmSync(lock,{recursive:true});
  fs.writeFileSync(path.join(evidenceDir,'art-candidate.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify({evidenceDir,passed:report.passed,checks:report.checks.length,failure:report.failure,runtimeSourceChangedDuringCapture:report.runtimeSourceChangedDuringCapture}));
}
