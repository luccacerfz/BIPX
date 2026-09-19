import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import assert from 'node:assert/strict';
import { chromium, attachQualityTelemetry, waitForRuntimeAssets, evidenceDir } from './quality-browser.mjs';
import { localServer } from './quality-isolated-server.mjs';

// Appended only to the temporary browser response. Production functions stay intact.
// This is explicitly a synthetic horde fixture, not natural gameplay.
const fixture = `
const crowdQa = { active:false, samples:[] };
const originalCrowdUpdate = updateZombies;
updateZombies = function(dt) {
  const started = performance.now();
  const result = originalCrowdUpdate(dt);
  if (crowdQa.active) crowdQa.samples.push({at:started, dt, ms:performance.now()-started, count:zombies.length});
  return result;
};
window.__crowdQa = {
  prepare(count) {
    clearEntities(); game.perfStressImmortal=false;
    player.maxHealth=player.health=1000000;
    game.zombiesToSpawn=0; game.nextWaveDelay=1000000; game.trapTimer=1000000;
    player.shotCooldown=1000000; game.shooting=false;
    const origins=[];
    for(let i=0;i<count;i++) {
      const angle=i*2.399963229728653, radius=12+i%34;
      const z=spawnZombie(Math.cos(angle)*radius,Math.sin(angle)*radius,'zombie');
      if(!z)throw Error('Fixture spawn failed at '+i);
      z.health=z.maxHealth=100000; z.speed=3.3;
      z.freezeTimer=i%7===0?6:0;z.stunTimer=i%11===0?6:0;
      origins.push({id:z.id,x:z.mesh.position.x,z:z.mesh.position.z,radius:z.radius,controlled:z.freezeTimer>0||z.stunTimer>0});
    }
    crowdQa.samples=[];crowdQa.active=true;
    return origins;
  },
  finish() {
    crowdQa.active=false;
    return {samples:crowdQa.samples, bodies:zombies.map(z=>({id:z.id,x:z.mesh.position.x,z:z.mesh.position.z,radius:z.radius,freeze:z.freezeTimer,stun:z.stunTimer})),indexCleared:zombieActorIndex===null};
  }
};`;

const source = fs.readFileSync('src/main.js', 'utf8');
const instrumented = source + fixture;
const hash = text => crypto.createHash('sha256').update(text).digest('hex');
const quantiles = values => {
  const sorted = values.slice().sort((a,b)=>a-b);
  return {samples:sorted.length, median:sorted[Math.floor(sorted.length*.5)],p95:sorted[Math.ceil(sorted.length*.95)-1],max:sorted.at(-1)};
};
const results=[];
let server,browser;
try {
  server=await localServer();
  browser=await chromium.launch({channel:'chrome',headless:false,args:['--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows']});
  for(const count of [120,400]) {
    const context=await browser.newContext({viewport:{width:1280,height:720},recordVideo:{dir:evidenceDir,size:{width:1280,height:720}}});
    const page=await context.newPage(), telemetry=attachQualityTelemetry(page,`crowd-${count}`);
    telemetry.markFixture();telemetry.report.browserLaunch={channel:'chrome',headless:false};
    telemetry.report.scope='Synthetic 120/400 body horde, actual runtime movement/AI/rendering enabled. Appended private setup grants HP, positions and initial controls; timer wraps literal updateZombies. Not natural gameplay, mobile or long soak.';
    telemetry.report.instrumentation={sourceSha256:hash(source),servedSha256:hash(instrumented),fixtureSha256:hash(fixture)};
    const result={count,passed:false,budget:{averageFpsAtLeast:57,p95MsAtMost:20}};
    try {
      await page.route('**/src/main.js',route=>route.fulfill({status:200,contentType:'text/javascript',body:instrumented}));
      await page.goto(server.origin+'/?offline=1&quality=high',{waitUntil:'domcontentloaded'});
      await waitForRuntimeAssets(page,telemetry);
      await page.locator('#open-login-button').click();
      await page.locator('label[for="character-dwarf"]').click();
      await waitForRuntimeAssets(page,telemetry);
      await page.locator('#player-name').fill('Crowd fixture');await page.locator('#play-button').click();
      await page.waitForFunction(()=>window.__zombieNightDebug.getState().state==='playing');
      result.initial=await page.evaluate(n=>window.__crowdQa.prepare(n),count);
      await page.waitForTimeout(1500); // Warm-up includes dynamic contacts, outside measured frames.
      await telemetry.capture('active-horde');
      result.frames=await page.evaluate(()=>new Promise(resolve=>{
        const times=[];function frame(time){times.push(time);if(time-times[0]>=10000)resolve(times);else requestAnimationFrame(frame)}requestAnimationFrame(frame);
      }));
      result.runtime=await page.evaluate(()=>window.__crowdQa.finish());
      result.perf=await page.evaluate(()=>window.__zombieNightDebug.getPerfStats());
      result.integrity=await page.evaluate(()=>window.__zombieNightDebug.getRenderIntegrity());
      const deltas=result.frames.slice(1).map((t,i)=>t-result.frames[i]);
      result.frameMs=quantiles(deltas);result.averageFps=deltas.length*1000/(result.frames.at(-1)-result.frames[0]);
      // Exclude setup, warm-up and screenshots from the timed CPU interval. Raw samples remain in the report.
      const measured=result.runtime.samples.filter(s=>s.at>=result.frames[0]&&s.at<=result.frames.at(-1));
      result.crowdCpuMs=quantiles(measured.map(s=>s.ms));
      result.warmupCpuMs=quantiles(result.runtime.samples.filter(s=>s.at<result.frames[0]).map(s=>s.ms));
      result.counts={min:Math.min(...result.runtime.samples.map(s=>s.count)),max:Math.max(...result.runtime.samples.map(s=>s.count))};
      result.maxFinalOverlap=0;
      for(let i=0;i<result.runtime.bodies.length;i++)for(let j=i+1;j<result.runtime.bodies.length;j++) {
        const a=result.runtime.bodies[i],b=result.runtime.bodies[j];
        result.maxFinalOverlap=Math.max(result.maxFinalOverlap,a.radius+b.radius-Math.hypot(a.x-b.x,a.z-b.z));
      }
      result.performanceBudgetPassed=result.averageFps>=57&&result.frameMs.p95<=20;
      assert.equal(result.initial.length,count);assert.equal(result.counts.min,count);assert.equal(result.counts.max,count);
      assert.ok(result.runtime.samples.length>100,'Simulation must actually tick');
      assert.ok(result.runtime.indexCleared,'Index must be discarded after crowd correction');
      assert.ok(result.runtime.bodies.every(b=>b.freeze===0&&b.stun===0),'Initial controls must expire through actual simulation');
      assert.equal(result.integrity.invisibleZombies,0);assert.equal(result.integrity.invisibleThreats,0);
      await telemetry.capture('after-expiry');telemetry.assertClean();result.passed=true;
    } catch(error) {result.failure=error.stack;telemetry.fail(error);process.exitCode=1;}
    finally {
      await telemetry.save({measurements:result});result.sourceChanged=telemetry.report.sourceChangedDuringRun;
      if(result.sourceChanged){result.passed=false;process.exitCode=1;}
      const video=page.video();await context.close();if(video)await video.saveAs(path.join(evidenceDir,`crowd-${count}.webm`));results.push(result);
    }
  }
} finally {
  await browser?.close();await server?.stop();
  const report={passed:results.length===2&&results.every(r=>r.passed),performanceBudgetPassed:results.length===2&&results.every(r=>r.performanceBudgetPassed),syntheticFixture:true,results};
  fs.writeFileSync(path.join(evidenceDir,'crowd-gameplay.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({evidenceDir,passed:report.passed,performanceBudgetPassed:report.performanceBudgetPassed,results:results.map(({count,passed,averageFps,frameMs,crowdCpuMs,performanceBudgetPassed,failure,sourceChanged})=>({count,passed,averageFps,frameMs,crowdCpuMs,performanceBudgetPassed,failure,sourceChanged}))}));
}
