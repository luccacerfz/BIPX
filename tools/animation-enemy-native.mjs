import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';
const out=path.resolve('output/playwright/arpg-animation-enemy-v2');await fs.mkdir(out,{recursive:true});
const files=['src/render/animated-enemies.js','src/render/visual-motion.js','src/assets/enemy-library.js','src/assets/monster-library.js','src/assets/enemy-control-state.js','src/assets/enemy-death-cut.js','src/assets/enemy-foot-contacts.js','src/assets/load-glb.js','src/assets/vendor/GLTFLoader.js','src/assets/vendor/SkeletonUtils.js','src/assets/vendor/BufferGeometryUtils.js','vendor/three/three.module.js','assets/models/orc-peon-locomotion-v1.glb','assets/models/monsters/zombie.glb','assets/models/monsters/brute.glb','assets/models/monsters/lich.glb','assets/models/monsters/ground-probes.json','tools/animation-enemy-preview.html','tools/animation-enemy-native.mjs'];
const hashes=async()=>Object.fromEntries(await Promise.all(files.map(async f=>[f,createHash('sha256').update(await fs.readFile(f)).digest('hex')])));
const report={scope:'Native Chrome Metal asset fixture: four real rigs, authoritative status-shaped inputs and death-only two-plane clipping. Not gameplay.',before:await hashes(),errors:[],captures:[]};
const server=http.createServer(async(req,res)=>{try{const url=decodeURIComponent(new URL(req.url,'http://localhost').pathname);if(!/^\/(tools|src|vendor|assets)\//.test(url)||url.includes('..'))throw Error('Invalid');const bytes=await fs.readFile(path.join(process.cwd(),url));res.setHeader('Content-Type',({'.js':'application/javascript','.html':'text/html','.json':'application/json','.glb':'model/gltf-binary'})[path.extname(url)]||'application/octet-stream');res.end(bytes);}catch{res.writeHead(404);res.end();}});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
let browser;
try{
 browser=await chromium.launch({headless:true,channel:'chrome',args:['--use-gl=angle','--use-angle=metal']});const context=await browser.newContext({viewport:{width:1100,height:820},recordVideo:{dir:out,size:{width:1100,height:820}}}),page=await context.newPage();page.on('pageerror',e=>report.errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});page.on('response',r=>{if(r.status()>=400)report.errors.push(`${r.status()} ${r.url()}`);});
 await page.goto(`http://127.0.0.1:${server.address().port}/tools/animation-enemy-preview.html`);await page.waitForFunction(()=>window.enemySkillFixture?.ready);
 const capture=async(name)=>{const file=`${name}.png`;await page.screenshot({path:path.join(out,file)});const snapshot=await page.evaluate(()=>window.enemySkillFixture.snapshot());report.captures.push({file,...snapshot});return snapshot;};
 for(const type of ['orcPeon','zombie','brute','caster']){
  await page.evaluate(type=>window.enemySkillFixture.configure(type),type);await page.waitForTimeout(700);await capture(`${type}-moving`);
  await page.evaluate(()=>window.enemySkillFixture.control('freeze'));await page.waitForTimeout(250);const first=await capture(`${type}-freeze-first`);await page.waitForTimeout(500);const second=await capture(`${type}-freeze-later`);
  if(first.stats.actors[0].animationTime!==second.stats.actors[0].animationTime)throw Error(`${type} freeze animation advanced`);
  await page.evaluate(()=>window.enemySkillFixture.control('stun'));await page.waitForTimeout(350);await capture(`${type}-stun`);
  await page.evaluate(()=>window.enemySkillFixture.control(''));await page.waitForTimeout(400);await capture(`${type}-thawed`);
  await page.evaluate(()=>window.enemySkillFixture.cut());await page.waitForTimeout(450);await page.evaluate(()=>window.enemySkillFixture.play(0));const cut=await capture(`${type}-cut`);if(cut.stats.cutCorpses!==1)throw Error('Missing cut corpse');
  await page.waitForTimeout(500);await page.evaluate(()=>window.enemySkillFixture.play(1));await page.waitForTimeout(1400);const end=await capture(`${type}-expired`);if(end.stats.cutCorpses!==0)throw Error('Cut did not expire');
 }
 const video=page.video();await context.close();await video.saveAs(path.join(out,'control-and-cuts.webm'));
}catch(e){report.errors.push(String(e));process.exitCode=1;}
finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
report.after=await hashes();report.sourceStable=JSON.stringify(report.before)===JSON.stringify(report.after);report.nativeRenderPassed=report.sourceStable&&!report.errors.length&&report.captures.length===28&&report.captures.every(c=>c.glError===0);await fs.writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({out,sourceStable:report.sourceStable,nativeRenderPassed:report.nativeRenderPassed,errors:report.errors}));
