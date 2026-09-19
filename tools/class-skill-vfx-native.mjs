import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { gpuReservation, sha256, sourceHashes } from './class-skill-vfx-support.mjs';
const release = await gpuReservation();
const out=path.resolve(`output/playwright/${new Date().toISOString().replace(/[:.]/g,'-')}-class-skill-vfx-v2`);
await fs.mkdir(out,{recursive:true});
const tracked=['tools/class-skill-vfx-preview.html','tools/class-skill-vfx-native.mjs','tools/class-skill-vfx-support.mjs'];
const report={scope:'Native isolated synthetic fixture; not gameplay or physical device/JEF acceptance',syntheticFixture:true,sources:await sourceHashes(tracked),captures:[],errors:[]};
const server=http.createServer(async(req,res)=>{try{
 const name=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname).slice(1);
 if(name==='favicon.ico'){res.writeHead(204);res.end();return;}
 if(!Object.hasOwn(report.sources,name))throw new Error('outside fixture');
 const data=await fs.readFile(name);res.writeHead(200,{'Content-Type':name.endsWith('.html')?'text/html':'text/javascript'});res.end(data);
}catch{res.writeHead(404);res.end();}});
let browser;
try{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 browser=await chromium.launch({headless:true,channel:'chrome',args:['--use-gl=angle','--use-angle=metal']});
 const context=await browser.newContext({viewport:{width:1280,height:800},recordVideo:{dir:path.join(out,'video'),size:{width:1280,height:800}}});
 const page=await context.newPage();page.on('pageerror',e=>report.errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
 await page.goto(`http://127.0.0.1:${server.address().port}/tools/class-skill-vfx-preview.html`);await page.waitForFunction(()=>window.classSkillFixture);
 report.graphics=await page.evaluate(()=>{const gl=window.classSkillFixture.renderer.getContext(),e=gl.getExtension('WEBGL_debug_renderer_info');return {version:gl.getParameter(gl.VERSION),renderer:e?gl.getParameter(e.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER)};});
 const ids=['warrior_war_cry','warrior_cleaving_dash','warrior_shield_charge','dwarf_explosive_cannon','dwarf_frost_shot','dwarf_gravity_shot'];
 for(const id of ids)for(const [phase,q,rm] of [['before','high',false],['cast','high',false],['release','high',false],['travel','high',false],['travel','low',true],['impact','high',false],['state','high',false],['impact','medium',false],['impact','low',false],['impact','low',true],['state','low',true]]){
  if(phase==='travel'&&id==='warrior_war_cry')continue;
  if(phase==='state'&&['warrior_cleaving_dash','dwarf_explosive_cannon'].includes(id))continue;
  const label=`${id}-${phase}-${q}${rm?'-reduced':''}`;
  const state=await page.evaluate(({id,phase,q,rm})=>{const f=window.classSkillFixture;const stats=f.sample(id,phase,q,rm);return {stats,pixels:f.pixelAudit(),memory:{...f.renderer.info.memory},render:{...f.renderer.info.render},glError:f.renderer.getContext().getError(),programs:f.renderer.info.programs?.map(p=>({name:p.name,runnable:p.diagnostics?.runnable??null}))};},{id,phase,q,rm});
  const file=`${label}.png`;await page.screenshot({path:path.join(out,file)});report.captures.push({label,file,sha256:sha256(await fs.readFile(path.join(out,file))),...state});
  assert.equal(state.glError,0);assert.ok(state.programs.every(p=>p.runnable!==false));
  if(phase==='travel'&&id.startsWith('dwarf'))assert.equal(state.stats.bodies.active,1,`${label} missing projectile body`);
  if(phase!=='before')assert.ok(state.pixels.changedPixels>30,`${label} invisible`);
  if(phase==='impact'&&id==='dwarf_gravity_shot')assert.ok(state.pixels.preservedTorsoFraction>.65,`${label} covers torso`);
 }
 report.playback=[];
 for(const id of ids){
  const sample=await page.evaluate(async id=>{
   const f=window.classSkillFixture;f.sample(id,'before','high',false);f.play(id);
   const start=performance.now(),frames=[];let previous=start;
   await new Promise(resolve=>{function frame(t){frames.push(t-previous);previous=t;if(t-start<2250)requestAnimationFrame(frame);else resolve();}requestAnimationFrame(frame);});
   f.stop();const sorted=frames.slice(1).sort((a,b)=>a-b);
   return {id,frames:sorted.length,p95:sorted[Math.floor(sorted.length*.95)],maximum:sorted.at(-1),stats:f.stats()};
  },id);report.playback.push(sample);
 }
 report.lifecycle=await page.evaluate(()=>{
  const f=window.classSkillFixture;f.vfx.setQuality('high');f.vfx.setReducedMotion(false);f.reset();f.renderer.render(f.scene,f.camera);const before={...f.renderer.info.memory};
  const retained=[];f.scene.traverse(n=>{if(['SamuraiCombatVFX','ElementalVfx','ClassSkillProjectileBodies','ClassSkillStates'].includes(n.name))n.traverse(m=>{if(m.isMesh)retained.push(m);});});
  for(let i=0;i<800;i++)f.vfx.emit({skillId:'dwarf_frost_shot',phase:'impact',target:{x:3,y:1,z:0},castId:i});
  f.vfx.update(0);f.renderer.render(f.scene,f.camera);const overload=f.vfx.getStats(),after={...f.renderer.info.memory};
  f.vfx.reset();f.renderer.render(f.scene,f.camera);const resetDraws=f.vfx.getStats().combat.drawCalls+f.vfx.getStats().elemental.drawCalls+f.vfx.getStats().bodies.drawCalls+f.vfx.getStats().states.drawCalls;
  f.vfx.dispose();f.vfx.dispose();f.renderer.render(f.scene,f.camera);
  return {before,after,disposed:{...f.renderer.info.memory},overload,resetDraws,detached:retained.every(m=>!m.parent?.parent),glError:f.renderer.getContext().getError()};
 });
 assert.deepEqual(report.lifecycle.before,report.lifecycle.after);assert.equal(report.lifecycle.resetDraws,0);assert.equal(report.lifecycle.glError,0);
 assert.ok(report.lifecycle.disposed.geometries<report.lifecycle.after.geometries);
 assert.equal(report.errors.length,0,JSON.stringify(report.errors));
 report.sourceChanged=JSON.stringify(report.sources)!==JSON.stringify(await sourceHashes(tracked));assert.equal(report.sourceChanged,false);
 report.passed=true;await context.close();
}catch(error){report.passed=false;report.failure=error.stack;process.exitCode=1;}
finally{await browser?.close();if(server.listening)await new Promise(resolve=>server.close(resolve));await release();await fs.writeFile(path.join(out,'verification.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:report.passed,out,captures:report.captures.length,errors:report.errors,failure:report.failure}));}
