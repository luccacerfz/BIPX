import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';
const out=path.resolve('output/playwright/monster-motion-game');await fs.mkdir(out,{recursive:true});
const files=['src/main.js','src/assets/monster-library.js','assets/models/monsters/zombie.glb','src/render/animated-enemies.js'];
async function hashes(){return Object.fromEntries(await Promise.all(files.map(async file=>[file,createHash('sha256').update(await fs.readFile(file)).digest('hex')])));}
const report={scope:'Native Chrome real game simulation with explicitly spawned targets; not natural spawn or performance benchmark.',syntheticFixture:true,errors:[],frames:[],beforeHashes:await hashes()};
const browser=await chromium.launch({headless:true,channel:'chrome',args:['--use-gl=angle','--use-angle=metal']});
try{
 const context=await browser.newContext({viewport:{width:1440,height:900},recordVideo:{dir:path.join(out,'video'),size:{width:1440,height:900}}});
 await context.addInitScript(()=>localStorage.setItem('bipx-character','warrior'));const page=await context.newPage();
 page.on('pageerror',e=>report.errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});page.on('response',r=>{if(r.status()>=400)report.errors.push(`${r.status()} ${r.url()}`);});
 await page.goto('http://127.0.0.1:5173/?offline=1&autoplay=1');
 await page.waitForFunction(()=>{const d=window.__zombieNightDebug,a=d?.getPresentationStats().assets;return d?.getState().state==='playing'&&a.hero.loaded&&a.world.loaded&&a.enemies.libraries.includes('monsters');});
 await page.bringToFront();await page.mouse.move(1030,450);
 const stats=()=>page.evaluate(()=>({state:window.__zombieNightDebug.getState(),enemies:window.__zombieNightDebug.getPresentationStats().assets.enemies}));
 async function capture(label){const file=`${label}.png`;await page.screenshot({path:path.join(out,file)});report.frames.push({label,file,sha256:createHash('sha256').update(await fs.readFile(path.join(out,file))).digest('hex'),stats:await stats()});}
 for(const type of ['zombie','runner']){
  await page.evaluate(t=>{const d=window.__zombieNightDebug;d.clearCombatEntities();d.spawnZombieAhead(9,t);},type);
  await page.waitForFunction(t=>window.__zombieNightDebug.getPresentationStats().assets.enemies.actors.some(a=>a.type===t),type);
  const before=await stats();await page.waitForTimeout(450);const after=await stats();
  const actor=after.enemies.actors.find(a=>a.type===type),previous=before.enemies.actors.find(a=>a.entityId===actor.entityId);
  assert(actor.motion?.retargetedRoles.includes('Run'));assert.equal(actor.currentClip,'Run');assert(actor.animationTimeScale>0&&actor.animationTimeScale<=2);assert(Math.hypot(actor.position.x-previous.position.x,actor.position.z-previous.position.z)>.1);
  await capture(`${type}-approach`);
  await page.waitForFunction(t=>window.__zombieNightDebug.getPresentationStats().assets.enemies.actors.some(a=>a.type===t&&a.currentClip==='Attack'),type,{polling:'raf',timeout:7000});
  await page.evaluate(()=>{window.__walkerTiming=[];const start=performance.now();function tick(){const d=window.__zombieNightDebug;window.__walkerTiming.push({elapsedMs:performance.now()-start,health:d.getState().health,actors:d.getPresentationStats().assets.enemies.actors.map(a=>({type:a.type,clip:a.currentClip,time:a.animationTime,rate:a.animationTimeScale}))});if(performance.now()-start<750)requestAnimationFrame(tick);}tick();});
  await capture(`${type}-attack-start`);await page.waitForTimeout(160);await capture(`${type}-attack-swipe`);await page.waitForTimeout(150);await capture(`${type}-attack-recover`);await page.waitForTimeout(350);(report.attackTiming??={})[type]=await page.evaluate(()=>window.__walkerTiming);
 }
 report.afterHashes=await hashes();report.sourceChanged=JSON.stringify(report.beforeHashes)!==JSON.stringify(report.afterHashes);report.passed=!report.sourceChanged&&report.errors.length===0;assert(report.passed);await context.close();
}catch(e){report.failure=String(e);process.exitCode=1;}finally{await browser.close();await fs.writeFile(path.join(out,'verification.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,errors:report.errors,failure:report.failure,sourceChanged:report.sourceChanged,out}));}
