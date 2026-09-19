import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {chromium,attachQualityTelemetry,waitForRuntimeAssets,evidenceDir} from './quality-browser.mjs';
import {launchProtocolServer,connectProtocolClient,startProtocolRun,closeProtocolClient} from './quality-protocol.mjs';
import {spawnFixture} from './player-spawn-fixture.mjs';
import {localServer} from './quality-isolated-server.mjs';
const clients=[],results=[];let browser,server,appServer;
const cases=process.env.BIPX_SPAWN_UI_ONLY?[true]:[false,true];
try {
  server=await launchProtocolServer('spawn-browser',spawnFixture);
  appServer=await localServer();
  const watcher=await connectProtocolClient(server.wsUrl+'?room=spawn-browser',clients);await startProtocolRun(watcher);
  browser=await chromium.launch({channel:'chrome',headless:false});
  for(const impossible of cases) {
    const context=await browser.newContext({viewport:{width:1280,height:800}}),page=await context.newPage();
    const telemetry=attachQualityTelemetry(page,impossible?'spawn-rejected':'spawn-occupied');telemetry.markFixture();telemetry.report.browserLaunch={channel:'chrome',headless:false};
    telemetry.report.scope='Real browser menu/start against isolated production server; frozen blocker in a living room; impossible radius30 body in an inactive room for rejection UI (avoids the normal crowd recovery relocating a giant synthetic body during form input). Arranged by private IPC. No gameplay functions replaced.';
    const result={impossible,passed:false};const messages=[];
    const roomName=impossible?'spawn-blocked-ui':'spawn-browser';
    page.on('websocket',ws=>ws.on('framereceived',({payload})=>{try{messages.push(JSON.parse(String(payload)))}catch{}}));
    try {
      const url=new URL(appServer.origin+'/');url.searchParams.set('room',roomName);url.searchParams.set('ws',server.wsUrl);
      await page.goto(url.href,{waitUntil:'domcontentloaded'});await waitForRuntimeAssets(page,telemetry);
      await page.waitForFunction(()=>window.__zombieNightDebug.getState().multiplayer.connected);
      const welcome=messages.find(m=>m.type==='welcome');assert.ok(welcome);
      await server.requestFixture('qa-spawn-config',{room:roomName,actors:[{x:impossible?0:welcome.selfState.x,z:welcome.selfState.z,radius:impossible?30:1.72}]});
      await page.locator('#open-login-button').click();await page.locator('#player-name').fill('Spawn browser');
      const normal=await page.evaluate(()=>{
        window.__spawnOriginalLabel=document.querySelector('#play-button-label');
        return {title:document.querySelector('#message-title').textContent,kicker:document.querySelector('#message-kicker').textContent,copy:document.querySelector('#message-copy').textContent,label:window.__spawnOriginalLabel.textContent,description:document.querySelector('#play-button').getAttribute('aria-describedby'),role:document.querySelector('#message-copy').getAttribute('role'),icons:document.querySelectorAll('#play-button svg').length};
      });
      await page.locator('#play-button').click();
      if(impossible) {
        await page.waitForFunction(()=>document.querySelector('#message').dataset.runStartRejected==='true');
        result.state=await page.evaluate(()=>window.__zombieNightDebug.getState());
        assert.notEqual(result.state.state,'playing');
        assert.ok(messages.some(m=>m.type==='runStartRejected'));assert.equal(messages.some(m=>m.type==='runStarted'),false);
        assert.equal((await page.locator('#play-button-label').textContent()).trim(),'Tentar novamente');
        assert.equal(await page.locator('#message-title').textContent(),'BIPX');
        assert.equal(await page.locator('#play-button').getAttribute('aria-describedby'),'message-copy');
        assert.equal(await page.locator('#message-copy').getAttribute('role'),'status');
        assert.ok(await page.evaluate(()=>window.__spawnOriginalLabel===document.querySelector('#play-button-label')),'Retry must preserve original label node');
        assert.equal(await page.locator('#play-button svg').count(),normal.icons);
        result.views=[];
        for(const viewport of [{width:1280,height:800},{width:393,height:852},{width:320,height:568},{width:852,height:393}]){
          await page.setViewportSize(viewport);await page.locator('#player-name').focus();await page.locator('#play-button').focus();await page.waitForTimeout(120);
          const read=()=>page.evaluate(()=>{
            const title=document.querySelector('#message-title'),button=document.querySelector('#play-button'),copy=document.querySelector('#message-copy'),range=document.createRange();range.selectNodeContents(title);
            const t=range.getBoundingClientRect(),b=button.getBoundingClientRect(),style=getComputedStyle(button);
            return {title:{left:t.left,right:t.right},button:{top:b.top,bottom:b.bottom,left:b.left,right:b.right},background:style.backgroundColor,image:style.backgroundImage,copyDisplay:getComputedStyle(copy).display,focused:document.activeElement===button,width:innerWidth,height:innerHeight};
          });
          const view=await read();assert.ok(view.title.left>=-1&&view.title.right<=viewport.width+1,'Title overflows viewport');assert.ok(view.button.left>=-1&&view.button.right<=viewport.width+1);assert.ok(view.button.top>=-1&&view.button.bottom<=viewport.height+1,'Focused retry not reachable in short viewport');assert.notEqual(view.copyDisplay,'none');assert.ok(view.focused);
          await page.locator('#play-button').hover();const hover=await read();assert.match(hover.background,/^rgb\(/,'Hover must remain fully opaque from its first sampled frame');assert.equal(hover.image,'none');
          result.views.push({viewport,view,hover});await telemetry.capture(`no-free-space-${viewport.width}x${viewport.height}`);
        }
        async function assertRestored(){
          const restored=await page.evaluate(()=>({marker:document.querySelector('#message').dataset.runStartRejected||null,title:document.querySelector('#message-title').textContent,kicker:document.querySelector('#message-kicker').textContent,copy:document.querySelector('#message-copy').textContent,label:document.querySelector('#play-button-label').textContent,description:document.querySelector('#play-button').getAttribute('aria-describedby'),role:document.querySelector('#message-copy').getAttribute('role'),sameLabel:window.__spawnOriginalLabel===document.querySelector('#play-button-label')}));
          assert.equal(restored.marker,null);assert.ok(restored.sameLabel);for(const key of ['title','kicker','copy','label','description','role'])assert.equal(restored[key],normal[key],`Transient ${key} leaked`);return restored;
        }
        await page.setViewportSize({width:1280,height:800});await page.locator('#login-back-button').click();result.afterBack=await assertRestored();
        await page.locator('#open-login-button').click();result.afterReopen=await assertRestored();await telemetry.capture('normal-login-restored');
        await page.locator('#play-button').click();await page.waitForFunction(()=>document.querySelector('#message').dataset.runStartRejected==='true');
        assert.equal(messages.filter(m=>m.type==='runStartRejected').length,2);
        await server.requestFixture('qa-spawn-config',{room:roomName,actors:[]});
        await page.locator('#play-button').click();await page.waitForFunction(()=>window.__zombieNightDebug.getState().state==='playing');
        await page.waitForTimeout(150);assert.ok(messages.some(m=>m.type==='runStarted'));
        result.afterRetry=await assertRestored();await telemetry.capture('retry-playing');
      } else {
        await page.waitForFunction(()=>window.__zombieNightDebug.getState().state==='playing');
        await page.waitForTimeout(200);
        const started=messages.find(m=>m.type==='runStarted');assert.ok(started);
        result.state=await page.evaluate(()=>window.__zombieNightDebug.getState());
        assert.ok(Math.hypot(result.state.player.x-started.state.x,result.state.player.z-started.state.z)<.002,'Client must apply actual assigned spawn before sending state');
        const authoritative=await server.requestFixture('qa-spawn-state',{room:roomName,clientId:welcome.id});
        assert.ok(Math.hypot(authoritative.state.x-started.state.x,authoritative.state.z-started.state.z)<.002,'Client must not overwrite spawn with old menu point');
        result.spawn={x:started.state.x,z:started.state.z};await telemetry.capture('occupied-spawn-resolved');
      }
      telemetry.assertClean();result.passed=true;
    }catch(error){result.failure=error.stack;telemetry.fail(error);process.exitCode=1;}
    finally{result.messageTypes=messages.map(m=>m.type);result.startResponses=messages.filter(m=>['runStarted','runStartRejected'].includes(m.type));await telemetry.save({measurements:result});result.sourceChanged=telemetry.report.sourceChangedDuringRun;await context.close();results.push(result);}
  }
  server.assertClean();
}finally{
  await browser?.close();for(const c of clients)await closeProtocolClient(c);await server?.stop();await appServer?.stop();
  const report={passed:results.length===cases.length&&results.every(r=>r.passed&&!r.sourceChanged),requestedCases:cases,syntheticFixture:true,results};
  fs.writeFileSync(path.join(evidenceDir,'player-spawn-browser.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({evidenceDir,...report}));
}
