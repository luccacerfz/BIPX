import {chromium} from 'playwright';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const out=path.resolve('output/playwright/monster-phase');await fs.mkdir(out,{recursive:true});
// This asset fixture is served separately; it never changes the game server.
const fixtureRoot=process.cwd();
const server=http.createServer(async(req,res)=>{try{const url=new URL(req.url,'http://127.0.0.1'),file=path.resolve(fixtureRoot,'.'+decodeURIComponent(url.pathname));if(!file.startsWith(fixtureRoot+path.sep))throw new Error('outside fixture root');const bytes=await fs.readFile(file);const type={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.glb':'model/gltf-binary'}[path.extname(file)]||'application/octet-stream';res.writeHead(200,{'Content-Type':type,'Content-Length':bytes.length});res.end(bytes);}catch{res.writeHead(404);res.end();}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({headless:true,channel:'chrome',args:['--use-gl=angle','--use-angle=metal']});
const hash=b=>createHash('sha256').update(b).digest('hex');
const report={scope:'Native isolated controller/phase fixture, not gameplay or artistic score.',syntheticFixture:true,errors:[],frames:[],sourceHash:hash(await fs.readFile('src/assets/monster-library.js'))};
try{const context=await browser.newContext({viewport:{width:1280,height:800},recordVideo:{dir:path.join(out,'video'),size:{width:1280,height:800}}});const page=await context.newPage();page.on('pageerror',e=>report.errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});page.on('response',r=>{if(r.status()>=400)report.errors.push(`${r.status()} ${r.url()}`);});
await page.goto(`${origin}/tools/monster-phase-preview.html`);await page.waitForFunction(()=>window.phaseReview?.ready);
for(const phase of [.1,.25,.523,.7,.9]){await page.evaluate(p=>window.phaseReview.sample(p),phase);const file=`phase-${Math.round(phase*1000)}.png`;await page.screenshot({path:path.join(out,file)});const state=await page.evaluate(()=>{const{THREE,actors,renderer}=window.phaseReview;return{glError:renderer.getContext().getError(),actors:actors.map(a=>{a.root.updateMatrixWorld(true);a.model.traverse(o=>{if(o.isSkinnedMesh)o.skeleton.update();});const box=new THREE.Box3().setFromObject(a.root,true);return{stats:a.stats,minY:box.min.y,size:box.getSize(new THREE.Vector3()).toArray(),bones:['Head','L_Hand','R_Hand','L_Foot','R_Foot'].map(n=>a.model.getObjectByName(n).getWorldPosition(new THREE.Vector3()).sub(a.root.position).toArray())};})};});report.frames.push({phase,file,sha256:hash(await fs.readFile(path.join(out,file))),state});}
await page.evaluate(()=>window.phaseReview.play());await page.waitForTimeout(4300);await page.evaluate(()=>window.phaseReview.play(false));
report.sourceUnchanged=report.sourceHash===hash(await fs.readFile('src/assets/monster-library.js'));report.passed=report.sourceUnchanged&&report.errors.length===0&&report.frames.every(f=>f.state.glError===0&&f.state.actors.every(a=>Math.abs(a.minY)<.025&&a.bones.flat().every(Number.isFinite))&&f.state.actors[0].bones.every((p,i)=>Math.hypot(...p.map((v,k)=>v-f.state.actors[1].bones[i][k]))<.0001));assert(report.passed);await context.close();
}catch(e){report.failure=String(e);process.exitCode=1;}finally{await browser.close();await new Promise(resolve=>server.close(resolve));await fs.writeFile(path.join(out,'verification.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,errors:report.errors,failure:report.failure,out}));}
