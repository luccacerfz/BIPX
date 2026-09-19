import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';
import http from 'node:http';
const server=http.createServer(async(req,res)=>{try{const pathname=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname);if(!/^\/(tools|src|vendor|assets)\//.test(pathname)||pathname.includes('..'))throw Error('Invalid');const bytes=await fs.readFile(path.join(process.cwd(),pathname));res.setHeader('Content-Type',({'.js':'application/javascript','.html':'text/html','.glb':'model/gltf-binary','.json':'application/json'})[path.extname(pathname)]||'application/octet-stream');res.end(bytes);}catch{res.writeHead(404);res.end();}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin=`http://127.0.0.1:${server.address().port}`;
const out=path.resolve('output/playwright/enemy-locomotion');await fs.mkdir(out,{recursive:true});
const report={scope:'Native Chrome asset fixture; real original/candidate meshes, not gameplay acceptance',errors:[],samples:[]};
const browser=await chromium.launch({headless:true,channel:'chrome',args:['--use-gl=angle','--use-angle=metal']});
try {
 const context=await browser.newContext({viewport:{width:1440,height:900},recordVideo:{dir:path.join(out,'video'),size:{width:1440,height:900}}});const page=await context.newPage();page.on('pageerror',e=>report.errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
 await page.goto(`${origin}/tools/enemy-locomotion-preview.html`);await page.waitForFunction(()=>window.orcLocomotion?.actor);await page.waitForTimeout(1500);
 for(const speed of [1,3.7,5.5]){
  await page.locator('#speed').fill(String(speed));await page.waitForTimeout(1800);
  for(let i=0;i<4;i++){
   const file=`speed-${speed.toFixed(1)}-${i}.png`;await page.screenshot({path:path.join(out,file)});report.samples.push({speed,file,sha256:createHash('sha256').update(await fs.readFile(path.join(out,file))).digest('hex'),...await page.evaluate(()=>({stats:window.orcLocomotion.actor.stats,glError:window.orcLocomotion.renderer.getContext().getError()}))});await page.waitForTimeout(150);
  }
 }
 const video=page.video();await context.close();const videoPath=await video.path();const bytes=await fs.readFile(videoPath);report.video={path:path.relative(process.cwd(),videoPath),sha256:createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length};report.browser=browser.version();
}catch(error){report.errors.push(String(error));}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
for(const f of ['src/assets/enemy-library.js','assets/models/orc-peon-locomotion-v1.glb','assets/models/orc-peon.glb']){report.hashes??={};report.hashes[f]=createHash('sha256').update(await fs.readFile(f)).digest('hex');}
report.nativeRenderPassed=!report.errors.length&&report.samples.every(s=>s.glError===0);await fs.writeFile(path.join(out,'verification.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({out,errors:report.errors,nativeRenderPassed:report.nativeRenderPassed},null,2));
