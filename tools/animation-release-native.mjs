import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright';
import { HERO_SKILL_MOTIONS } from '../src/assets/hero-skill-motion.js';

const overlay='output/arpg-animation/cut-timing-review-confirmation/candidate/tools/animation-skill-preview.html';
const out=path.resolve(process.env.ANIMATION_OUTPUT||`output/playwright/arpg-animation-release-final-${Date.now()}`);await fs.mkdir(out,{recursive:true});
const files=['src/assets/hero-skill-motion.js','src/assets/hero-locomotion.js','src/assets/hero-foot-probes.js','src/assets/character-library.js','src/assets/dwarf-library.js','src/assets/warrior-locomotion-clips.json','src/assets/dwarf-locomotion-clips.json','src/assets/warrior-skill-clips.json','src/assets/dwarf-skill-clips.json','src/assets/load-glb.js','src/assets/vendor/GLTFLoader.js','src/assets/vendor/SkeletonUtils.js','src/assets/vendor/BufferGeometryUtils.js','vendor/three/three.module.js','assets/models/aldric-hero.glb','assets/models/dwarf-rifleman.glb','tools/animation-skill-preview.html','tools/animation-skill-native.mjs','tools/animation-release-native.mjs',overlay];
const hashes=async()=>Object.fromEntries(await Promise.all(files.map(async f=>[f,createHash('sha256').update(await fs.readFile(f)).digest('hex')])));
const report={scope:'Native Chrome Metal current runtime assets and hero controllers; explicit HTML-only substitution for elapsed/release/duration overlay. Not gameplay or network. Complete quarter-speed moving casts and stationary samples.',overlay,before:await hashes(),errors:[],httpErrors:[],captures:[]};
const server=http.createServer(async(req,res)=>{try{const url=decodeURIComponent(new URL(req.url,'http://localhost').pathname);if(!/^\/(tools|src|vendor|assets)\//.test(url)||url.includes('..')){res.writeHead(404);res.end();return;}const bytes=await fs.readFile(url==='/tools/animation-skill-preview.html'?overlay:path.join(process.cwd(),url));res.setHeader('Content-Type',({'.js':'application/javascript','.html':'text/html','.json':'application/json','.glb':'model/gltf-binary'})[path.extname(url)]||'application/octet-stream');res.end(bytes);}catch{res.writeHead(404);res.end();}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
let browser;
try {
 browser=await chromium.launch({headless:true,channel:'chrome',args:['--use-gl=angle','--use-angle=metal']});
 for(const character of ['warrior','dwarf']){
  const context=await browser.newContext({viewport:{width:1100,height:820},recordVideo:{dir:out,size:{width:1100,height:820}}}),page=await context.newPage();page.on('pageerror',e=>report.errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
  page.on('response',r=>{if(r.status()>=400)report.httpErrors.push({url:r.url(),status:r.status()});});
  await page.goto(`http://127.0.0.1:${server.address().port}/tools/animation-skill-preview.html`);await page.waitForFunction(()=>window.animationFixture?.ready);
  for(const d of Object.values(HERO_SKILL_MOTIONS).filter(d=>d.characterId===character)){
   await page.evaluate(async character=>{await window.animationFixture.configure({character,speed:0,view:'front',playback:0});window.animationFixture.step(120);},character);
   if(!await page.evaluate(id=>window.animationFixture.cast(id),d.skillId))throw new Error(`Cast rejected: ${d.skillId}`);
   let previous=0;
   for(const [label,t] of [['prepare',d.impactAt*.6],['release',d.impactAt],['recovery',d.duration*.88]]){
    await page.evaluate(dt=>window.animationFixture.step(Math.ceil(dt*120),1/120),t-previous);previous=t;
    const file=`${d.skillId}-${label}.png`;await page.screenshot({path:path.join(out,file)});report.captures.push({file,overlayText:await page.locator('#label').innerText(),...await page.evaluate(()=>window.animationFixture.snapshot())});
   }
   await page.evaluate(async ({characterId:character,skillId})=>{await window.animationFixture.configure({character,speed:6.5,direction:0,view:'side',playback:0});window.animationFixture.step(180);if(!window.animationFixture.cast(skillId))throw new Error('Moving cast rejected');await window.animationFixture.configure({playback:.25});},d);
   await page.waitForTimeout((d.duration+.35)*4000);
   const file=`${d.skillId}-moving-recovered.png`;await page.screenshot({path:path.join(out,file)});report.captures.push({file,overlayText:await page.locator('#label').innerText(),...await page.evaluate(()=>window.animationFixture.snapshot())});
  }
  const video=page.video();await context.close();await video.saveAs(path.join(out,`${character}-casts.webm`));
 }
}catch(error){report.errors.push(String(error));process.exitCode=1;}
finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
report.after=await hashes();report.sourceStable=JSON.stringify(report.before)===JSON.stringify(report.after);report.nativeRenderPassed=report.sourceStable&&!report.errors.length&&!report.httpErrors.length&&report.captures.length===24&&report.captures.every(c=>c.glError===0);
await fs.writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({out,sourceStable:report.sourceStable,nativeRenderPassed:report.nativeRenderPassed,errors:report.errors}));
