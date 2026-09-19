import { suiteUrl } from './quality-target.mjs';
import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
const root=process.cwd(),out=path.join(root,'output/playwright/monster-motion-comparison');await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome',args:['--use-gl=angle','--use-angle=metal']});
const report={syntheticFixture:true,scope:'Native isolated asset comparison; not gameplay or artistic approval',errors:[],frames:[]};
try{const context=await browser.newContext({viewport:{width:1280,height:800},recordVideo:{dir:path.join(out,'video'),size:{width:1280,height:800}}});const page=await context.newPage();page.on('pageerror',e=>report.errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});page.on('response',r=>{if(r.status()>=400)report.errors.push(`${r.status()} ${r.url()}`);});
 await page.goto(await suiteUrl('/tools/monster-motion-compare.html?manual=1'));await page.waitForFunction(()=>window.motionReview?.ready);
 for(const clip of ['Run']){
  await page.evaluate(c=>window.motionReview.setClip(c),clip);
  for(const phase of [0,.2,.4,.6,.8,.98]){await page.evaluate(p=>window.motionReview.sample(p),phase);const file=`${clip.toLowerCase()}-${Math.round(phase*100)}.png`;await page.screenshot({path:path.join(out,file)});const sample=await page.evaluate(()=>{const{THREE,actors,renderer}=window.motionReview;return{glError:renderer.getContext().getError(),actors:actors.map(a=>{a.root.updateMatrixWorld(true);a.body.skeleton.update();const box=new THREE.Box3().setFromObject(a.root,true);return{size:box.getSize(new THREE.Vector3()).toArray(),minY:box.min.y,head:a.model.getObjectByName('Head').getWorldPosition(new THREE.Vector3()).toArray(),pose:[0,100,1000,5000].map(i=>a.body.getVertexPosition(i,new THREE.Vector3()).applyMatrix4(a.body.matrixWorld).toArray())};})};});report.frames.push({clip,phase,file,sha256:createHash('sha256').update(await fs.readFile(path.join(out,file))).digest('hex'),sample});}
  await page.evaluate(()=>{window.motionReview.sample(0);window.motionReview.play(true);});await page.waitForTimeout(clip==='Walk'?4200:2800);await page.evaluate(()=>window.motionReview.play(false));
 }
 report.browser=browser.version();report.meshHash=createHash('sha256').update(await fs.readFile(path.join(root,'assets/models/monsters/zombie.glb'))).digest('hex');report.passed=report.errors.length===0&&report.frames.every(f=>f.sample.glError===0&&f.sample.actors.every(a=>[...a.size,...a.head,...a.pose.flat()].every(Number.isFinite)&&Math.abs(a.minY)<.01));await context.close();
}finally{await browser.close();await fs.writeFile(path.join(out,'verification.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,errors:report.errors,out,meshHash:report.meshHash}));}
