import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {chromium,browserLaunchOptions,attachQualityTelemetry,evidenceDir} from './quality-browser.mjs';
import {localServer} from './quality-isolated-server.mjs';
const root=path.resolve(process.argv[2]||'.'),lock='/tmp/bipx-arpg-gpu.lock';fs.mkdirSync(lock);fs.writeFileSync(`${lock}/owner.json`,JSON.stringify({owner:'environment-fixture',pid:process.pid}));
let server,browser;
try{
 fs.copyFileSync(new URL('./environment-preview.html',import.meta.url),path.join(root,'src/environment-preview.html'));
 process.chdir(root);server=await localServer();browser=await chromium.launch(browserLaunchOptions);
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),telemetry=attachQualityTelemetry(page,'environment-fixture');telemetry.markFixture();
 try{
  await page.goto(`${server.origin}/src/environment-preview.html`);await page.waitForFunction(()=>window.environmentReview?.ready,null,{timeout:60000});
  for(const view of ['overview','court','north','east'])for(const bounds of [false,true]){await page.evaluate(({view,bounds})=>window.environmentReview.render(view,bounds),{view,bounds});await telemetry.capture(`${view}-${bounds?'bounds':'native'}`)}
  const measurements=await page.evaluate(()=>{
   const {world,THREE,renderer,scene,camera}=window.environmentReview;
   const nearby=world.stats.visibleDetailBatches;
   world.update(new THREE.Vector3(200,0,200),true);const far=world.stats.visibleDetailBatches;
   const solidsVisible=world.group.children.filter(c=>c.visible).length;
   world.update(new THREE.Vector3(),true,[{health:1,radius:1,mesh:{position:new THREE.Vector3(8,0,-12)}}]);renderer.render(scene,camera);
   return {world:world.stats,nearby,far,solidsVisible,memory:renderer.info.memory,render:renderer.info.render};
  });
  assert(measurements.far===0&&measurements.nearby>0,'Distance detail culling failed');
  assert(measurements.solidsVisible>0,'Culling removed physical solids');
  assert(measurements.world.placements.every(p=>[...p.min,...p.max].every(Number.isFinite)),'Nonfinite world bounds');
  assert(measurements.world.placements.every(p=>p.min[1]>=-.01),'Unexpected buried derivative');
  const {getEnvironmentColliders}=await import('../src/render/environment-layout.js');
  for(const p of measurements.world.placements.filter(p=>p.solid)){
   const c=getEnvironmentColliders().find(c=>c.id===p.id);assert(c,`${p.id} lacks contact`);
   assert(c.minY>=p.min[1]-.01&&c.maxY<=p.max[1]+.01,`${p.id} vertical collision exceeds visible model`);
  }
  telemetry.report.measurements=measurements;telemetry.assertClean();
 }catch(e){telemetry.fail(e);process.exitCode=1}finally{await telemetry.save()}
 console.log(JSON.stringify({assertions:telemetry.report.assertions,sourceChanged:telemetry.report.sourceChangedDuringRun,error:telemetry.report.failure,evidenceDir}));
}finally{await browser?.close();await server?.stop();if(JSON.parse(fs.readFileSync(`${lock}/owner.json`)).pid===process.pid)fs.rmSync(lock,{recursive:true})}
