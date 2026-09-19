import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { chromium, waitForRuntimeAssets } from './quality-browser.mjs';
import { localServer } from './quality-isolated-server.mjs';
import { gpuReservation, sha256 } from './class-skill-vfx-support.mjs';

// Bounded real-input check on a private snapshot. The appended observer has no
// setters for gameplay; only the existing renderer call is timed transparently.
const root=process.cwd(), stamp=new Date().toISOString().replace(/[:.]/g,'-');
const out=path.join(root,'output/vfx-warcry-art-v1/art2-follow',`native-${stamp}`);
fs.mkdirSync(out,{recursive:true});
const manifest=JSON.parse(fs.readFileSync(path.join(root,'output/vfx-warcry-art-v1/art2-follow/integration-manifest.json')));
const snapshot=path.join(out,'snapshot');
fs.cpSync(path.join(root,'output/warcry-moving-integration-v1/candidate'),snapshot,{recursive:true});
assert.equal(sha256(fs.readFileSync(path.join(snapshot,'src/main.js'))),manifest.mainOwnedByCombat.sha256);
for(const file of manifest.files){const data=fs.readFileSync(path.join(root,file.source));assert.equal(sha256(data),file.sha256);fs.copyFileSync(path.join(root,file.source),path.join(snapshot,file.target));}
function hashes(base){const result={};function visit(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())visit(p);else result[path.relative(base,p)]=sha256(fs.readFileSync(p));}}visit(base);return result;}
const before=hashes(snapshot),liveBefore=hashes(path.join(root,'src/vfx'));
fs.writeFileSync(path.join(out,'source-manifest.json'),JSON.stringify({snapshot:before,liveVfx:liveBefore,manifest},null,2));
const observer=String.raw`
;(() => {
 const frames=[],queries=[],gpu=[],seen=new Map();let recording=false,depthCalls=0;
 const gl=renderer.getContext(),ext=gl.getExtension('EXT_disjoint_timer_query_webgl2');
 const originalRender=renderer.render;
 renderer.render=function(...args){
  const depth=renderer.getRenderTarget()?.texture?.name==='BIPX shared RGBA-packed scene depth';
  const measure=recording&&depth&&depthCalls++<16&&ext;
  const q=measure?gl.createQuery():null;
  if(q)gl.beginQuery(ext.TIME_ELAPSED_EXT,q);
  try{return originalRender.apply(this,args);}finally{if(q){gl.endQuery(ext.TIME_ELAPSED_EXT);queries.push({q,index:depthCalls});}}
 };
 function sample(){
  for(let i=queries.length-1;i>=0;i--){const p=queries[i];if(gl.getQueryParameter(p.q,gl.QUERY_RESULT_AVAILABLE)){gpu.push({index:p.index,ms:gl.getQueryParameter(p.q,gl.QUERY_RESULT)/1e6,disjoint:!!gl.getParameter(ext.GPU_DISJOINT_EXT)});gl.deleteQuery(p.q);queries.splice(i,1);}}
  if(recording){
   const d=window.__zombieNightDebug,root=player.mesh.getWorldPosition(new THREE.Vector3()).toArray();
   const socket=heroVisual?.weapon||heroVisual?.muzzle;
   const emitter=socket?.getWorldPosition(new THREE.Vector3()).toArray()??null;
   for(const e of d.getSkillEvents())seen.set([e.castId,e.phase,e.contactId,e.time].join(':'),e);
   frames.push({wall:performance.now(),state:d.getState(),skills:d.getSkillState(),root,emitter,registry:[...preparingWarCries.keys()],warcry:classSkillVfx?.getStats().warcry,depth:cinematicPipeline?.getStats().depth});
  }
  requestAnimationFrame(sample);
 }
 requestAnimationFrame(sample);
 window.__warcryFollowProbe={start(){recording=true;},stop(){recording=false;},read(){return {frames,events:[...seen.values()],gpu,gpuTimer:!!ext,depthWarmup:4,depthSamples:12,glError:gl.getError()};},materials(){const rows=[];player.mesh.traverse(o=>{if(o.isSkinnedMesh)for(const m of Array.isArray(o.material)?o.material:[o.material])rows.push({mesh:o.name,material:m.name,transparent:m.transparent,depthWrite:m.depthWrite,opacity:m.opacity});});return rows;}};
})();`;
fs.writeFileSync(path.join(out,'observer.js'),observer);
const report={at:new Date().toISOString(),scope:'Private Combat main + selected 9 VFX. Real keyboard/menu input, actual animated Aldric/socket/world/camera; no gameplay setters.',sourceMain:manifest.mainOwnedByCombat,results:[],passed:false};
let browser,server,release;
try{
 release=await gpuReservation();
 fs.writeFileSync(path.join(out,'gpu-window.json'),JSON.stringify({at:new Date().toISOString(),pid:process.pid,owner:'VFX warcry anchors',state:'active'}));
 process.chdir(snapshot);server=await localServer();
 browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-gl=angle','--use-angle=metal']});
 for(const [mode,quality,reduced] of [['standing','high',false],['moving','high',false],['moving-reduced','low',true]]){
  const item={mode,quality,reduced,passed:false,errors:[],served:{}};report.results.push(item);
  const context=await browser.newContext({viewport:{width:1440,height:900},recordVideo:{dir:out,size:{width:1440,height:900}}});
  const page=await context.newPage();page.on('pageerror',e=>item.errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')item.errors.push(m.text());});
  await page.route('**/src/main.js',async route=>{const res=await route.fetch();const data=await res.body();assert.equal(sha256(data),manifest.mainOwnedByCombat.sha256);await route.fulfill({response:res,body:Buffer.concat([data,Buffer.from(observer)])});});
  try{
   for(const f of manifest.files){const response=await context.request.get(server.origin+'/'+f.target);assert.equal(response.status(),200);const hash=sha256(await response.body());assert.equal(hash,f.sha256);item.served[f.target]=hash;}
   await page.goto(server.origin+'/?offline=1');await waitForRuntimeAssets(page);
   await page.locator('#menu-settings-button').click();await page.locator('#quality-select').selectOption(quality);await page.locator('#motion-toggle').setChecked(reduced);await page.locator('#dialog-done').click();
   await page.locator('#open-login-button').click();await page.locator('label[for="character-warrior"]').click();await waitForRuntimeAssets(page);await page.locator('#player-name').fill('VFX '+mode);await page.locator('#play-button').click();
   await page.waitForFunction(()=>window.__zombieNightDebug.getState().state==='playing');await page.locator('#game-canvas').focus();
   item.materials=await page.evaluate(()=>window.__warcryFollowProbe.materials());
   await page.evaluate(()=>window.__warcryFollowProbe.start());
   if(mode!=='standing'){await page.keyboard.down('d');await page.waitForTimeout(100);}
   await page.keyboard.press('1');
   await page.waitForFunction(()=>window.__zombieNightDebug.getClassSkillVfxStats().warcry.records.some(r=>r.releaseAt<0&&r.castAt>=0));
   await page.waitForTimeout(130);await page.screenshot({path:path.join(out,mode+'-prepare.png')});
   await page.waitForFunction(()=>window.__zombieNightDebug.getClassSkillVfxStats().warcry.records.some(r=>r.releaseAt>=0));
   await page.waitForTimeout(90);await page.screenshot({path:path.join(out,mode+'-release.png')});
   await page.waitForTimeout(500);if(mode!=='standing')await page.keyboard.up('d');
   await page.screenshot({path:path.join(out,mode+'-buff.png')});
   await page.locator('#pause-button').click();await page.waitForFunction(()=>window.__zombieNightDebug.getState().paused);
   const getPause=()=>page.evaluate(()=>({time:window.__zombieNightDebug.getState().survivalTime,clock:window.__zombieNightDebug.getClassSkillVfxStats().warcry.clock,buffs:window.__zombieNightDebug.getClassSkillVfxStats().warcry.buffs}));
   const pausedBefore=await getPause();await page.waitForTimeout(250);const pausedAfter=await getPause();item.pause={before:pausedBefore,after:pausedAfter};assert.equal(pausedBefore.buffs,1);assert.deepEqual(pausedAfter,pausedBefore);
   await page.locator('#dialog-done').click();await page.waitForFunction(()=>!window.__zombieNightDebug.getState().paused);
   await page.waitForFunction(()=>window.__zombieNightDebug.getClassSkillVfxStats().warcry.active===0,null,{timeout:15000});
   await page.evaluate(()=>window.__warcryFollowProbe.stop());item.observation=await page.evaluate(()=>window.__warcryFollowProbe.read());
   const obs=item.observation,cast=obs.events.filter(e=>e.skillId==='warrior_war_cry'&&e.phase==='cast');assert.equal(cast.length,1);const id=cast[0].castId;
   const releases=obs.events.filter(e=>e.castId===id&&e.phase==='release');assert.equal(releases.length,1);assert.equal(obs.events.filter(e=>e.castId===id&&e.phase==='impact').length,0);
   const prep=obs.frames.filter(f=>f.warcry?.records.some(r=>r.id===id&&r.releaseAt<0));assert.ok(prep.length>=3);
   const dist=(a,b)=>Math.hypot(...a.map((x,i)=>x-b[i]));
   const rootLag=Math.max(...prep.map(f=>dist(f.root,f.warcry.records.find(r=>r.id===id).position)));
   const socketLag=Math.max(...prep.map(f=>dist(f.emitter,f.warcry.records.find(r=>r.id===id).emitter)));
   const moved=dist(prep[0].root,prep.at(-1).root);
   const post=obs.frames.flatMap(f=>f.warcry?.records.filter(r=>r.id===id&&r.releaseAt>=0)??[]);assert.ok(post.length>3);
   const waveDrift=Math.max(...post.map(r=>dist(r.releaseOrigin,post[0].releaseOrigin)));
   item.anchors={castId:id,prepareFrames:prep.length,rootLag,socketLag,movedDuringPrepare:moved,waveDrift};
   assert.ok(rootLag<1e-5,`root lag ${rootLag}`);assert.ok(socketLag<1e-5,`socket lag ${socketLag}`);assert.equal(waveDrift,0);if(mode!=='standing')assert.ok(moved>.5,`Insufficient movement: ${moved}`);
   const visible=obs.frames.filter(f=>f.warcry?.visibleActors>0);assert.ok(visible.length>0);assert.ok(visible.every(f=>f.warcry.depthValid&&f.depth?.passes===1));
   item.depth={visibleFrames:visible.length,onePass:true,timerAvailable:obs.gpuTimer,warmup:4,samples:obs.gpu.filter(s=>s.index>4)};
   assert.equal(obs.glError,0);assert.equal(item.errors.length,0);item.passed=true;
  }catch(error){item.failure=error.stack;item.observation??=await page.evaluate(()=>{window.__warcryFollowProbe?.stop();return window.__warcryFollowProbe?.read()}).catch(()=>null);await page.screenshot({path:path.join(out,mode+'-failure.png')}).catch(()=>{});}
  finally{const video=page.video();await context.close();if(video)await video.saveAs(path.join(out,mode+'.webm'));fs.writeFileSync(path.join(out,mode+'.json'),JSON.stringify(item,null,2));delete item.observation;}
 }
 report.sourceStable=JSON.stringify(hashes(snapshot))===JSON.stringify(before);
 report.liveVfxUnchanged=JSON.stringify(hashes(path.join(root,'src/vfx')))===JSON.stringify(liveBefore);
 report.passed=report.results.every(r=>r.passed)&&report.sourceStable&&report.liveVfxUnchanged;
}catch(error){report.failure=error.stack;}
finally{await browser?.close();await server?.stop();if(release)await release();process.chdir(root);report.closedAt=new Date().toISOString();report.resourcesReleased=true;fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));fs.writeFileSync(path.join(out,'gpu-window.json'),JSON.stringify({at:report.closedAt,state:'completed',resourcesReleased:true}));console.log(JSON.stringify({out,passed:report.passed,results:report.results.map(({mode,passed,failure,anchors,depth})=>({mode,passed,failure,anchors,depth})),failure:report.failure},null,2));}
if(!report.passed)process.exitCode=1;
