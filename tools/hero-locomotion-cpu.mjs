import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { THREE, bonesOf, quantile } from './hero-locomotion-cpu-support.mjs';
import { loadHeroVisual } from '../src/assets/character-library.js';
import { loadDwarfVisual } from '../src/assets/dwarf-library.js';
const rootUrl = new URL('../src/assets/', import.meta.url);
async function baseline(file, symbol) {
  let code = await fs.readFile(new URL(`../output/hero-locomotion/baseline/${file}`, import.meta.url), 'utf8');
  code = code.replace(/from '(\.\/[^']+)'/g, (_, url) => `from '${new URL(url, rootUrl)}'`);
  code = code.replaceAll('import.meta.url', JSON.stringify(new URL(file, rootUrl).href));
  return (await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`))[symbol];
}
const before = { warrior: await baseline('character-library.js', 'loadHeroVisual'), dwarf: await baseline('dwarf-library.js','loadDwarfVisual') };
const after = { warrior: loadHeroVisual, dwarf: loadDwarfVisual };
const out = {scope:'CPU transform/contact evidence only. No visual or JEF approval. Sources unchanged; images stripped in-memory only.',gaits:[],transitions:[],checks:{},hashes:{}};
const cases=[{speed:1.5,angle:0,label:'walk'},{speed:6.5,angle:0,label:'forward'},{speed:6.5,angle:Math.PI/2,label:'strafe'},{speed:6.5,angle:Math.PI,label:'backward'},{speed:6.5,angle:-Math.PI/2,label:'strafe-other'},{speed:6.5,angle:Math.PI/4,label:'diagonal'},{speed:6.5,angle:Math.PI*.75,label:'back-diagonal'},{speed:9.1,angle:Math.PI/2,label:'upgraded-strafe'},{speed:9.1,angle:Math.PI,label:'upgraded-backward'},{speed:9.1,angle:0,label:'upgraded'},{speed:11,angle:0,label:'legacy-fast'},{speed:6.5,angle:0,label:'moving-attack',attack:true}];
for(const id of ['warrior','dwarf']) for(const test of cases) for(const [version,loaders] of [['before',before],['after',after]]) {
 const parent=new THREE.Group(); const actor=await loaders[id]({THREE,parent,height:id==='warrior'?2.7:2.55});
 const bones=Object.fromEntries(Object.entries(bonesOf(actor.model)).map(([k,v])=>[k.replace(/_\d+$/,''),v]));
 const dt=1/120,velocity={x:Math.sin(test.angle)*test.speed,z:-Math.cos(test.angle)*test.speed};
 const samples=[],locks=[],reach=[],hand=[],footMin=[],upperErrors=[];
 let previous=null; let clips=new Set();
 for(let i=0;i<600;i++) {
   parent.position.x+=velocity.x*dt;parent.position.z+=velocity.z*dt;parent.updateMatrixWorld(true);
   if(test.attack&&i%60===0)actor.attack({duration:.45});
   actor.update(dt,{speed:test.speed,velocity});parent.updateMatrixWorld(true);
   const feet=['Left','Right'].map(side=>bones[`${side}ToeBase`].getWorldPosition(new THREE.Vector3()));
   if(i>120) {
     clips.add(actor.stats.currentClip);
     for(let f=0;f<feet.length;f++) {
       const p=feet[f],old=previous[f];
       const relativeBackVelocity=(p.z-old.z-velocity.z*dt)/dt;
       // Baseline support proxy excludes returning swing even when it is low.
       if(p.y<.075&&old.y<.075&&relativeBackVelocity>.2)samples.push(Math.hypot(p.x-old.x,p.z-old.z)/dt);
     }
     upperErrors.push(actor.stats.locomotion?.upperBodyPoseError || 0);
     for(const contact of actor.stats.locomotion?.footContacts||[]) {
       if(contact.horizontalDrift!==null&&contact.contact)locks.push(contact.horizontalDrift);
       reach.push(contact.reachError);
     }
     footMin.push(...feet.map(p=>p.y));
     const rightHand=bones.RightHand; const relative=new THREE.Matrix4().copy(rightHand.matrixWorld).invert().multiply(actor.weapon.matrixWorld);
     hand.push(relative.elements.slice());
   }
   previous=feet;
 }
 const gripSpread=Math.max(...hand.map(m=>Math.max(...m.map((v,i)=>Math.abs(v-hand[0][i])))));
 out.gaits.push({id,label:test.label,version,speed:test.speed,angle:test.angle,clips:[...clips],lowToeSamples:samples.length,lowToeDriftMedian:quantile(samples,.5),lowToeDriftP90:quantile(samples,.9),lockedSamples:locks.length,lockedDriftMedian:quantile(locks,.5),lockedDriftP90:quantile(locks,.9),maxReachError:Math.max(0,...reach),minimumToeY:Math.min(...footMin),gripSpread,maxUpperBodyPoseError:Math.max(...upperErrors),locomotion:actor.stats.locomotion});
 actor.dispose();
}
for(const id of ['warrior','dwarf']) {
 const parent=new THREE.Group(),actor=await after[id]({THREE,parent,height:id==='warrior'?2.7:2.55}),dt=1/60;
 let finite=true;const states=new Set();
 for(let i=0;i<540;i++) {
  const speed=i<60?0:i<120?(i-60)/60*6.5:i<360?6.5:i<420?(420-i)/60*6.5:0;
  const angle=i<180?0:(i-180)*dt*.75;
  const velocity={x:Math.sin(angle)*speed,z:-Math.cos(angle)*speed};
  parent.position.x+=velocity.x*dt;parent.position.z+=velocity.z*dt;
  if(i===240)actor.attack({duration:.5});
  if(i===460){parent.position.x+=20;actor.update(0,{speed:0,teleport:true});}
  actor.update(dt,{speed,velocity,dead:i>=470&&i<510});parent.updateMatrixWorld(true);
  actor.model.traverse(o=>{finite&&=o.matrixWorld.elements.every(Number.isFinite);});
  states.add(actor.stats.currentClip);
 }
 out.transitions.push({id,finite,clips:[...states],finalClip:actor.stats.currentClip});actor.dispose();
}
out.checks.upperBodyWorldPosePreserved=out.gaits.filter(g=>g.version==='after').every(g=>g.maxUpperBodyPoseError<.00001);
out.checks.finiteTransitions=out.transitions.every(t=>t.finite);
out.checks.reviveIdle=out.transitions.every(t=>t.finalClip==='Idle');
out.checks.realRun=out.gaits.filter(g=>g.version==='after'&&g.label==='forward').every(g=>g.locomotion.gait==='Run');
out.checks.continuousLegsDuringAttack=out.gaits.filter(g=>g.version==='after'&&g.label==='moving-attack').every(g=>g.lockedSamples>100&&g.locomotion.gait==='Run');
for(const file of ['src/assets/hero-locomotion.js','src/assets/character-library.js','src/assets/dwarf-library.js','assets/models/aldric-hero.glb','assets/models/dwarf-rifleman.glb'])out.hashes[file]=createHash('sha256').update(await fs.readFile(file)).digest('hex');
await fs.writeFile('output/hero-locomotion/controller-cpu.json',JSON.stringify(out,null,2));
console.table(out.gaits.map(({id,label,version,speed,lowToeDriftP90,lockedDriftP90,maxReachError,gripSpread})=>({id,label,version,speed,lowToeDriftP90,lockedDriftP90,maxReachError,gripSpread})));
console.log(out.checks);
if(Object.values(out.checks).some(v=>!v))process.exitCode=1;
