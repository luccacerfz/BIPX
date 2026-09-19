import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { chromium, attachQualityTelemetry, waitForRuntimeAssets, sourceFingerprint, evidenceDir as telemetryDir } from './quality-browser.mjs';
import { localServer } from './quality-isolated-server.mjs';
const candidate='output/gui-spawn-rejection';
const evidenceDir=path.resolve(candidate,'evidence',new Date().toISOString().replace(/[:.]/g,'-'));
import {launchProtocolServer} from './quality-protocol.mjs';
import {spawnFixture} from './player-spawn-fixture.mjs';
const lock='/tmp/bipx-arpg-gpu.lock',token=crypto.randomUUID();
try{fs.mkdirSync(lock);}catch(error){if(error.code==='EEXIST'){console.log('GPU occupied; isolated proposal remains staged.');process.exit(75);}throw error;}
fs.writeFileSync(path.join(lock,'owner.json'),JSON.stringify({owner:'gui-spawn-staging',pid:process.pid,token,created:new Date().toISOString()}));
fs.mkdirSync(evidenceDir,{recursive:true});
const baseline=sourceFingerprint(),report={isolated:true,promoted:false,scope:'Unmodified production rejection baseline against existing isolated spawn fixture; proposed styling/state only in a static DOM fixture, not promoted.',checks:[],cases:[],errors:[],source:baseline};
const check=(name,value)=>{assert.ok(value,name);report.checks.push(name);};
const luminance=rgb=>rgb.map(x=>x/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4).reduce((v,x,i)=>v+x*[.2126,.7152,.0722][i],0);
const contrast=(a,b)=>{const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
let browser,server,protocol;
try{
  server=await localServer();browser=await chromium.launch({channel:'chrome',headless:false});
  if(process.env.BIPX_UI_NATIVE_REPORT){
    const reusedPath=path.resolve(process.env.BIPX_UI_NATIVE_REPORT),reused=JSON.parse(fs.readFileSync(reusedPath));
    assert.deepEqual(reused.source,baseline,'Only reuse native diagnostic from exactly the same runtime source');
    assert.ok(reused.nativeBaseline?.diagnostic?.complete&&reused.nativeBaseline.responses.includes('runStartRejected'));
    const nativeReport=JSON.parse(fs.readFileSync(path.join(path.dirname(reusedPath),'native-rejection-baseline.json')));
    assert.equal(nativeReport.assertions,'passed');assert.equal(nativeReport.sourceChangedDuringRun,false);
    report.nativeBaseline={...reused.nativeBaseline,sourceReport:reusedPath};
    for(const file of fs.readdirSync(path.dirname(reusedPath)).filter(f=>f.startsWith('native-rejection-baseline')))fs.copyFileSync(path.join(path.dirname(reusedPath),file),path.join(evidenceDir,file));
    check('Prior native diagnostic reused only with identical runtime and clean native report',true);
  }else{
  // Measure the real current main handler before touching a proposed DOM fixture.
  protocol=await launchProtocolServer('gui-spawn-baseline',spawnFixture);
  const nativeContext=await browser.newContext({viewport:{width:1280,height:800}}),native=await nativeContext.newPage();
  const telemetry=attachQualityTelemetry(native,'native-rejection-baseline');telemetry.markFixture();
  const messages=[];native.on('websocket',ws=>ws.on('framereceived',({payload})=>{try{messages.push(JSON.parse(String(payload)));}catch{}}));
  try{
    const url=new URL(server.origin+'/');url.searchParams.set('room','gui-rejection-ui');url.searchParams.set('ws',protocol.wsUrl);
    await native.goto(url.href,{waitUntil:'domcontentloaded'});await waitForRuntimeAssets(native,telemetry);
    await native.waitForFunction(()=>window.__zombieNightDebug.getState().multiplayer.connected);
    const welcome=messages.find(m=>m.type==='welcome');assert.ok(welcome);
    await protocol.requestFixture('qa-spawn-config',{room:'gui-rejection-ui',actors:[{x:0,z:welcome.selfState.z,radius:30}]});
    await native.locator('#open-login-button').click();await native.locator('#player-name').fill('Spawn browser');
    await native.evaluate(()=>{
      const title=document.querySelector('#message-title'),b=document.querySelector('#play-button'),label=document.querySelector('#play-button-label');
      window.rejectionDiagnostic={samples:[],labelBefore:label?.textContent};
      const observer=new MutationObserver(()=>{
        if(title.textContent!=='Entrada indisponível')return;observer.disconnect();const started=performance.now();
        const sample=targetMs=>{const c=getComputedStyle(b);window.rejectionDiagnostic.samples.push({targetMs,elapsedMs:performance.now()-started,color:c.color,backgroundColor:c.backgroundColor,backgroundImage:c.backgroundImage,opacity:c.opacity,transition:c.transitionProperty,hover:b.matches(':hover'),focused:document.activeElement===b,disabled:b.disabled,labelConnected:label?.isConnected,childCount:b.children.length,text:b.textContent});};
        sample(0);requestAnimationFrame(()=>sample('first-raf'));setTimeout(()=>sample(180),180);setTimeout(()=>{sample(300);window.rejectionDiagnostic.complete=true;},300);
      });observer.observe(title,{childList:true,subtree:true,characterData:true});
    });
    await native.locator('#play-button').click();await native.waitForFunction(()=>window.rejectionDiagnostic?.complete===true);
    report.nativeBaseline=await native.evaluate(()=>({diagnostic:window.rejectionDiagnostic,state:window.__zombieNightDebug.getState().state,name:document.querySelector('#player-name').value,selected:document.querySelector('[name="character"]:checked').value}));
    report.nativeBaseline.responses=messages.filter(m=>['runStartRejected','runStarted'].includes(m.type)).map(m=>m.type);
    check('Native current handler really rejected the isolated blocked spawn',report.nativeBaseline.responses.includes('runStartRejected')&&!report.nativeBaseline.responses.includes('runStarted')&&report.nativeBaseline.state!=='playing');
    check('Native baseline records immediate, first RAF,180ms and300ms styles',report.nativeBaseline.diagnostic.samples.length===4&&report.nativeBaseline.diagnostic.samples.find(s=>s.targetMs===180).elapsedMs>=170&&report.nativeBaseline.diagnostic.samples.find(s=>s.targetMs===300).elapsedMs>=290);
    await native.screenshot({path:path.join(evidenceDir,'native-rejection-baseline-after300ms.png')});telemetry.assertClean();
  }catch(error){telemetry.fail(error);throw error;}
  finally{await telemetry.save({scope:'Existing production handler, original scripts/styles. Radius30 blocker in inactive isolated room only. No candidate applied. Exact timing samples are in combined staging report.'});for(const file of fs.readdirSync(telemetryDir).filter(f=>f.startsWith('native-rejection-baseline')))fs.copyFileSync(path.join(telemetryDir,file),path.join(evidenceDir,file));await nativeContext.close();await protocol.stop();protocol=null;}
  }
  for(const [name,width,height,touch] of [['desktop',1280,800,false],['portrait',393,852,true],['small',320,568,true],['landscape',852,393,true]]){
    const context=await browser.newContext({viewport:{width,height},hasTouch:touch,isMobile:touch});
    const page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));page.on('response',r=>{if(r.status()>=400)report.errors.push(`${r.status()} ${r.url()}`);});
    try{
      // Production intentionally does not serve output/. Serve only this fixture pair in QA.
      await page.route('**/output/gui-spawn-rejection/*',route=>{
        const name=path.basename(new URL(route.request().url()).pathname);
        if(!['fixture.html','candidate.css'].includes(name))return route.abort();
        return route.fulfill({status:200,contentType:name.endsWith('.css')?'text/css':'text/html',body:fs.readFileSync(path.join(candidate,name))});
      });
      for(const variant of (name==='desktop'?['before','proposal']:['proposal'])){
        await page.goto(`${server.origin}/${candidate}/fixture.html?variant=${variant}`,{waitUntil:'load'});
        await page.waitForFunction(()=>window.fixtureReady);
        await page.screenshot({path:path.join(evidenceDir,`${name}-${variant}-top.png`)});
        const layout=await page.evaluate(()=>{
          const rect=e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height};};
          const h=document.querySelector('#message-title'),copy=document.querySelector('#message-copy'),range=document.createRange();range.selectNodeContents(h);
          return{title:rect(h),titleText:rect(range),brand:rect(h.closest('.message__panel')),copy:rect(copy),form:rect(copy.parentElement),copyDisplay:getComputedStyle(copy).display,viewportWidth:innerWidth,documentScrollWidth:document.documentElement.scrollWidth,menuScrollWidth:document.querySelector('#message').scrollWidth,menuClientWidth:document.querySelector('#message').clientWidth};
        });
        const b=page.locator('#play-button');await b.scrollIntoViewIfNeeded();await page.mouse.move(0,0);await page.waitForTimeout(220);
        await b.evaluate(el=>{window.buttonSamples=[];window.buttonTimedSamples=[];el.addEventListener('pointerenter',()=>{const start=performance.now();const timed=targetMs=>{const c=getComputedStyle(el);window.buttonTimedSamples.push({targetMs,elapsedMs:performance.now()-start,color:c.color,backgroundColor:c.backgroundColor,backgroundImage:c.backgroundImage});};timed(0);setTimeout(()=>timed(180),180);setTimeout(()=>timed(300),300);const sample=()=>{const c=getComputedStyle(el);window.buttonSamples.push({t:performance.now()-start,color:c.color,backgroundColor:c.backgroundColor,backgroundImage:c.backgroundImage,transition:c.transitionProperty});if(performance.now()-start<320)requestAnimationFrame(sample);};sample();},{once:true});});
        const r=await b.boundingBox();await page.mouse.move(r.x+r.width/2,r.y+r.height/2);await page.waitForTimeout(350);
        const samples=await page.evaluate(()=>window.buttonSamples),timedSamples=await page.evaluate(()=>window.buttonTimedSamples);
        const state=await b.evaluate(el=>{const c=getComputedStyle(el);return{color:c.color,backgroundColor:c.backgroundColor,disabled:el.disabled,height:el.getBoundingClientRect().height,describedBy:el.getAttribute('aria-describedby')};});
        if(variant==='proposal'){
          check(`${name}: brand title stays inside its column`,layout.titleText.right<=layout.brand.right+.5&&layout.titleText.x>=layout.brand.x-.5);
          check(`${name}: rejection reason visible inside the form`,layout.copyDisplay!=='none'&&layout.copy.width>0&&layout.copy.right<=layout.form.right&&layout.copy.x>=layout.form.x);
          check(`${name}: retry has opaque readable fill throughout hover`,samples.length>2&&samples.every(s=>/^rgb\(/.test(s.backgroundColor)&&contrast(s.color.match(/[\d.]+/g).map(Number),s.backgroundColor.match(/[\d.]+/g).map(Number))>=4.5));
          check(`${name}: existing enabled state and recovery description preserved`,!state.disabled&&state.height>=42&&state.describedBy==='message-copy');
          check(`${name}: no horizontal scroll in document or menu`,layout.documentScrollWidth<=layout.viewportWidth&&layout.menuScrollWidth<=layout.menuClientWidth);
          await page.locator('#player-name').fill('Lua QA');await page.locator('#character-dwarf').check();
          await page.evaluate(()=>{window.spawnProposal.applyRejected();window.spawnProposal.applyRejected();});
          check(`${name}: repeated rejection preserves player input and label/icon nodes`,await page.evaluate(()=>document.querySelector('#player-name').value==='Lua QA'&&document.querySelector('#character-dwarf').checked&&Object.values(window.spawnProposal.identity()).every(Boolean)&&document.querySelector('#play-button-label').textContent==='Tentar novamente'));
          await page.mouse.move(0,0);await page.locator('#player-name').focus();await page.keyboard.press('Tab');
          check(`${name}: keyboard tab exposes visible retry focus`,await b.evaluate(e=>e===document.activeElement&&getComputedStyle(e).outlineStyle==='solid'));
          await page.keyboard.press('Enter');check(`${name}: fixture button receives one native activation`,await page.evaluate(()=>window.fixtureClicks)===1);
          await page.screenshot({path:path.join(evidenceDir,`${name}-proposal-focus.png`)});
          await page.locator('#login-back-button').focus();
          check(`${name}: back has visible keyboard focus`,await page.locator('#login-back-button').evaluate(e=>e===document.activeElement&&getComputedStyle(e).outlineStyle==='solid'));
          await page.keyboard.press('Enter');
          check(`${name}: fixture back restores entry focus and clears rejection description`,await page.evaluate(()=>document.activeElement.id==='open-login-button'&&!document.querySelector('#message').dataset.runStartRejected&&!document.querySelector('#play-button').hasAttribute('aria-describedby')&&!document.querySelector('#message-copy').hasAttribute('role')));
          await page.keyboard.press('Enter');
          check(`${name}: fixture reopening preserves selection/name and focuses name`,await page.evaluate(()=>document.activeElement.id==='player-name'&&document.querySelector('#player-name').value==='Lua QA'&&document.querySelector('#character-dwarf').checked));
          await page.evaluate(()=>window.spawnProposal.applyRejected());
          await page.emulateMedia({reducedMotion:'reduce'});
          check(`${name}: reduced motion removes transitions`,await b.evaluate(e=>getComputedStyle(e).transitionDuration==='0s'));
        }
        report.cases.push({name,variant,width,height,layout,state,samples,timedSamples});
      }
    }finally{await context.close();}
  }
  check('No fixture page/HTTP errors',report.errors.length===0);
  report.sourceChanged=JSON.stringify(baseline)!==JSON.stringify(sourceFingerprint());check('Shared runtime unchanged during fixture capture',!report.sourceChanged);
  report.passed=true;
}catch(error){report.failure=error.stack;process.exitCode=1;}
finally{
  await browser?.close();await protocol?.stop();await server?.stop();
  if(fs.existsSync(path.join(lock,'owner.json'))&&JSON.parse(fs.readFileSync(path.join(lock,'owner.json'))).token===token)fs.rmSync(lock,{recursive:true});
  fs.writeFileSync(path.join(evidenceDir,'spawn-ui-staging.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({evidenceDir,passed:report.passed,checks:report.checks.length,failure:report.failure,sourceChanged:report.sourceChanged}));
}
