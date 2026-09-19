import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
// Native Three.js GLB renders. No generated illustration or image retouching.
const browser=await chromium.launch({headless:true,channel:'chrome',args:['--use-gl=angle','--use-angle=metal']});
try{
 const page=await browser.newPage({viewport:{width:384,height:300}});const evidence=[];
 for(const [id,url,model] of [['aldric','/src/assets/asset-preview.html?manual=1','aldric-hero.glb'],['lyra','/tools/assets-dwarf-preview.html?manual=1','dwarf-rifleman.glb']]){
  await page.goto('http://localhost:5276'+url);await page.waitForFunction(()=>window.assetReview?.ready);
  await page.evaluate(id=>{const{scene,camera,renderer}=window.assetReview;document.querySelector('#label').hidden=true;for(const o of scene.children)if(o.isMesh&&o.geometry.type==='PlaneGeometry')o.visible=false;camera.position.set(id==='aldric'?1.4:1.3,1.87,-3.2);camera.lookAt(0,1.64,0);camera.fov=30;camera.updateProjectionMatrix();renderer.render(scene,camera);},id);
  await page.locator('canvas').screenshot({path:`assets/ui/portraits/${id}.png`});
  evidence.push({id,source:`assets/models/${model}`,sourceSha256:createHash('sha256').update(await fs.readFile(`assets/models/${model}`)).digest('hex'),portraitSha256:createHash('sha256').update(await fs.readFile(`assets/ui/portraits/${id}.png`)).digest('hex'),width:384,height:300,method:'Native Three.js render of supplied runtime GLB, idle pose, camera reframed for selection portrait. No pixel editing.'});
 }
 await fs.writeFile('assets/ui/portraits/provenance.json',JSON.stringify(evidence,null,2));
}finally{await browser.close()}
