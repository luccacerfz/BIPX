import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {localServer} from './quality-isolated-server.mjs';
import {chromium,browserLaunchOptions,attachQualityTelemetry,waitForRuntimeAssets,evidenceDir} from './quality-browser.mjs';
const server=await localServer();
const browser=await chromium.launch(browserLaunchOptions);
const results=[];
async function prepare(name){
  const context=await browser.newContext({viewport:{width:1440,height:900}});
  const external=[],posts=[],wire=[];
  await context.route('**/*',async route=>{const url=new URL(route.request().url());if(['http:','https:'].includes(url.protocol)&&url.origin!==server.origin){external.push({kind:'http',origin:url.origin,path:url.pathname});await route.abort('blockedbyclient');return;}if(route.request().method()==='POST')posts.push({origin:url.origin,path:url.pathname});await route.continue();});
  await context.routeWebSocket('**/*',route=>{const url=new URL(route.url());if(url.host!==new URL(server.origin).host){external.push({kind:'ws',origin:url.origin,path:url.pathname});route.close();return;}route.connectToServer();});
  const page=await context.newPage();const telemetry=attachQualityTelemetry(page,name);
  page.on('websocket',socket=>socket.on('framereceived',event=>{try{const m=JSON.parse(event.payload.toString());if(m.type==='welcome')wire.push({type:m.type,id:m.id,state:m.selfState});if(m.type==='runStarted')wire.push({type:m.type,state:m.state});}catch{}}));
  return {context,page,telemetry,external,posts,wire};
}
async function choose(page,character,name){
  if(await page.locator('#open-login-button').isVisible())await page.locator('#open-login-button').click();
  await page.locator(`label[for="character-${character}"]`).click();await waitForRuntimeAssets(page);
  await page.locator('#player-name').fill(name);
}
try {
  for(const character of ['warrior','dwarf']){
    const q=await prepare(`entry-${character}`);const {page,telemetry}=q;
    telemetry.report.scope='Actual menu selection and Multiplayer button navigation into the same local origin and a real isolated WebSocket server. External HTTP/WS is blocked and any attempt fails verification. No debug mutations.';
    try {
      await page.goto(`${server.origin}/?offline=1&room=entry-${character}`,{waitUntil:'networkidle'});await waitForRuntimeAssets(page,telemetry);
      await choose(page,character,`Entry ${character}`);await telemetry.capture('selected-before-navigation');
      await page.locator('#multiplayer-button').click();
      await page.waitForURL(url=>url.origin===server.origin&&url.searchParams.has('ws')&&!url.searchParams.has('offline'),{timeout:10000});
      await waitForRuntimeAssets(page,telemetry);
      assert.equal(new URL(page.url()).origin,server.origin);
      const wsUrl=new URL(new URL(page.url()).searchParams.get('ws'));assert.equal(wsUrl.host,new URL(server.origin).host);
      await page.waitForFunction(()=>window.__zombieNightDebug.getState().multiplayer.connected);
      assert.equal(await page.evaluate(()=>window.__bipxCharacters.getState().selected),character);
      if(await page.locator('#open-login-button').isVisible())await page.locator('#open-login-button').click();
      assert.equal(await page.locator(`#character-${character}`).isChecked(),true);
      assert.equal(await page.locator('#player-name').inputValue(),`Entry ${character}`);
      await page.locator('#play-button').click();
      await page.waitForFunction(()=>window.__zombieNightDebug.getState().state==='playing');
      const state=await page.evaluate(()=>window.__zombieNightDebug.getState());
      assert.equal(state.character,character);assert.equal(state.weapon,character==='warrior'?'katana':'pistol');
      assert.ok(q.wire.some(m=>m.type==='welcome'&&m.state.character===character));
      assert.ok(q.wire.some(m=>m.type==='runStarted'&&m.state.character===character));
      assert.deepEqual(q.external,[]);await telemetry.capture('local-multiplayer-playing');telemetry.assertClean();results.push({name:`entry-${character}`,passed:true});
    }catch(error){telemetry.fail(error);results.push({name:`entry-${character}`,passed:false,error:error.stack});process.exitCode=1;}
    finally{await telemetry.save({navigationEvidence:{externalAttempts:q.external,posts:q.posts,wire:q.wire}});await q.context.close();}
  }
  const q=await prepare('local-solo-ranking');const {page,telemetry}=q;const details={naturalScore:null,postRequests:q.posts,externalAttempts:q.external};
  telemetry.report.scope='Natural-world real keyboard input until a kill, then natural death; UI ranking and reload persistence. No health/XP/score/enemy fixture. Debug state is read only. Ranking must stay device-local and send no shared score POST.';
  const held=new Set();
  async function keys(list){const next=new Set(list);for(const key of held)if(!next.has(key)){await page.keyboard.up(key);held.delete(key)}for(const key of next)if(!held.has(key)){await page.keyboard.down(key);held.add(key)}}
  try{
    await page.goto(server.origin+'/?offline=1',{waitUntil:'networkidle'});await waitForRuntimeAssets(page,telemetry);await choose(page,'dwarf','Local Ledger QA');await page.locator('#play-button').click();await page.waitForFunction(()=>window.__zombieNightDebug.getState().state==='playing');
    const deadline=Date.now()+45000;
    let current;
    while(Date.now()<deadline){
      current=await page.evaluate(()=>({state:window.__zombieNightDebug.getState(),actors:window.__zombieNightDebug.getPresentationStats().assets.enemies.actors}));
      assert.equal(current.state.state,'playing','Natural character died before a ranking-worthy kill');
      if(current.state.kills>0)break;
      const targets=current.actors.filter(a=>a.position).sort((a,b)=>Math.hypot(a.position.x-current.state.player.x,a.position.z-current.state.player.z)-Math.hypot(b.position.x-current.state.player.x,b.position.z-current.state.player.z));
      const next=['Space'];const target=targets[0];
      if(target){const dx=target.position.x-current.state.player.x,dz=target.position.z-current.state.player.z;if(Math.abs(dx)>Math.abs(dz)*.414)next.push(dx>0?'l':'j');if(Math.abs(dz)>Math.abs(dx)*.414)next.push(dz>0?'k':'i');if(Math.hypot(dx,dz)>6){if(Math.abs(dx)>Math.abs(dz)*.414)next.push(dx>0?'d':'a');if(Math.abs(dz)>Math.abs(dx)*.414)next.push(dz>0?'s':'w');}}
      await keys(next);await page.waitForTimeout(150);
    }
    assert.ok(current.state.kills>0&&current.state.score>0,'No natural score earned');await keys([]);
    await page.waitForFunction(()=>window.__zombieNightDebug.getState().state==='dead',null,{timeout:75000});
    details.naturalScore=await page.evaluate(()=>window.__zombieNightDebug.getState());
    await telemetry.capture('natural-death');
    const stored=await page.evaluate(()=>localStorage.getItem('bipx-solo-records-v1'));assert.ok(stored?.includes('Local Ledger QA'),'Natural solo session not persisted locally');details.localLedger=JSON.parse(stored);
    if(await page.locator('#login-back-button').isVisible())await page.locator('#login-back-button').click();
    await page.locator('#menu-ranking-button').click();await page.locator('#menu-leaderboard-list').getByText('Local Ledger QA',{exact:false}).first().waitFor();await telemetry.capture('device-ranking');
    await page.reload({waitUntil:'networkidle'});await waitForRuntimeAssets(page,telemetry);await page.locator('#menu-ranking-button').click();await page.locator('#menu-leaderboard-list').getByText('Local Ledger QA',{exact:false}).first().waitFor();
    const shared=await (await fetch(server.origin+'/api/leaderboard')).json();assert.ok(!JSON.stringify(shared).includes('Local Ledger QA'),'Solo score leaked into shared server ranking');
    assert.ok(!q.posts.some(request=>['/api/leaderboard/session','/api/leaderboard/live'].includes(request.path)),'Solo gameplay posted to shared score endpoint');assert.deepEqual(q.external,[]);assert.equal(server.stderr(),'');await telemetry.capture('device-ranking-after-reload');telemetry.assertClean();results.push({name:'local-solo-ranking',passed:true});
  }catch(error){telemetry.fail(error);results.push({name:'local-solo-ranking',passed:false,error:error.stack});process.exitCode=1;}
  finally{await keys([]).catch(()=>{});await telemetry.save({measurements:details});await q.context.close();}
}finally{await browser.close();await server.stop();fs.writeFileSync(path.join(evidenceDir,'entry-ranking.json'),JSON.stringify({passed:results.every(r=>r.passed),results},null,2));console.log(JSON.stringify({results,evidenceDirectory:evidenceDir}));}
