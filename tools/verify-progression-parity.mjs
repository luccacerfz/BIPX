import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import path from 'node:path';
import crypto from 'node:crypto';
import {evidenceDir} from './quality-browser.mjs';
const A = await import('../src/progression/authority.mjs');
const { AUTO_WEAPONS, AUTO_WEAPON_IDS } = await import('../src/combat/arsenal.mjs');
const checks=[];const check=(name,details={})=>{checks.push({name,...details});console.log(name)};
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} != ${b}`);
const source=await fs.readFile('src/main.js','utf8');
const definitionText=source.slice(source.indexOf('const upgradeDefinitions = ['),source.indexOf('\nconst upgradeById'));
const fn=name=>{const start=source.indexOf(`function ${name}(`);return source.slice(start,source.indexOf('\nfunction ',start+1));};
const basePlayer=()=>({character:'dwarf',health:100,maxHealth:200,autoWeapons:Object.fromEntries(AUTO_WEAPON_IDS.map(id=>[id,{level:0,cooldown:0}])),upgradeStacks:{},perks:{},upgradeStats:{damageMultiplier:2,cooldownMultiplier:1,areaMultiplier:1,speedMultiplier:1,pickupRadius:2.35,projectileBonus:0},damageReduction:0,critChance:0,critMultiplier:1.8,revives:0,bossKills:0,position:{},perkCooldowns:{prismStorm:0}});
// The arsenal returned: automatic weapons are unlocked by the real client function; only its VFX pulse is stubbed.
const context=vm.createContext({player:basePlayer(),multiplayer:{enabled:false},triggerPerkAnimation(){},tryEvolveWeapons(){},spawnWeaponPulse(){},autoWeaponProfiles:AUTO_WEAPONS,Math});
vm.runInContext(definitionText+'\n'+fn('getNextUnlockableAutoWeapon')+'\n'+fn('applyUpgrade')+'\n'+fn('applyPerkEffect')+'\n'+fn('getXpToNext')+'\n'+fn('getSlayerPactMultiplier')+'\n'+fn('hasPerk')+'\n'+fn('applyDamagePerks')+'\nglobalThis.defs=upgradeDefinitions;',context);
for(const d of A.DEFINITIONS){const live=context.defs.find(x=>x.id===d.id);for(const key of ['label','rarity','kind','maxStacks'])assert.equal(d[key],live[key]);assert.equal(d.minLevel,live.minLevel??1)}
check('All18 definitions match live client labels, rarities, kinds, level gates and stack caps');
const fresh=(character='dwarf')=>{const s={runId:`test-${character}`,character,health:100,maxHealth:200,bestLevel:1,stateVersion:0,state:'playing',x:0,z:0,wave:1};return [s,A.createProgression(s,{random:()=>0})]};
let [s,p]=fresh();
for(let l=1;l<100;l++) assert.equal(A.xpToNext(l),context.getXpToNext(l));
let total=0;for(let l=1;l<30;l++){const before=A.levelFromXp(total);assert.equal(before.level,l);assert.equal(before.xp,0);total+=A.xpToNext(l);const edge=A.levelFromXp(total-1);assert.equal(edge.level,l);assert.equal(edge.xp,A.xpToNext(l)-1)}
check('XP thresholds and edge remainders match client formula through level99');
A.grantXp(s,p,Array.from({length:99},(_,i)=>A.xpToNext(i+1)).reduce((a,b)=>a+b,0));
let grants=0;const seen=new Set();
while(p.offer){const offer=p.offer;const id=offer.upgradeIds[0];const def=context.defs.find(x=>x.id===id);const msg={runId:p.runId,offerId:offer.id,upgradeId:id,requestId:`grant-${++grants}`};assert.equal(A.chooseUpgrade(s,p,msg).ok,true);context.applyUpgrade(def);seen.add(id);const snapshot=A.snapshot(p);for(const [k,v]of Object.entries(context.player.upgradeStats))near(snapshot.upgradeStats[k],v);for(const key of ['damageReduction','critChance','critMultiplier','revives'])near(snapshot[key],context.player[key]);near(s.maxHealth,context.player.maxHealth);near(s.health,context.player.health);assert.equal(A.chooseUpgrade(s,p,msg).duplicate,true);}
assert.equal(seen.size,18);assert.equal(s.maxHealth,272);assert.equal(s.health,172);assert.equal(p.pendingLevelUps,0);
for(const id of AUTO_WEAPON_IDS)assert.equal(A.snapshot(p).autoWeapons[id].level,context.player.autoWeapons[id].level);assert.deepEqual(AUTO_WEAPON_IDS.map(id=>context.player.autoWeapons[id].level),[1,1,1]);
check('All18 Lyra upgrades (arsenal included) granted via offers through caps; formulas and automatic-weapon unlocks match actual client functions',{grants,maxHealth:s.maxHealth,health:s.health});
let [warrior,wp]=fresh('warrior');A.grantXp(warrior,wp,200000);const seenWarrior=new Set();while(wp.offer){const id=wp.offer.upgradeIds[0];seenWarrior.add(id);assert.equal(A.chooseUpgrade(warrior,wp,{runId:wp.runId,offerId:wp.offer.id,upgradeId:id,requestId:`w${wp.offerSerial}`}).ok,true)}assert.equal(seenWarrior.size,16);for(const id of ['projectile','prismStorm'])assert.ok(!seenWarrior.has(id));for(const id of ['autoWeapon','sealRitual'])assert.ok(seenWarrior.has(id));assert.equal(A.attackStats(wp).projectileBonus,0);
check('Aldric keeps a sword (no projectile/Prism) and gains the automatic-weapon companions: 16 eligible upgrades');
let [b,bp]=fresh();A.createDrop(bp,'bossChest',{x:0,z:0});let drop=[...bp.drops.values()][0];const collect={runId:bp.runId,dropId:drop.id,requestId:'chest'};assert.equal(A.collectDrop(b,bp,collect).ok,true);assert.equal(bp.offer.source,'bossChest');assert.ok(bp.offer.upgradeIds.every(id=>A.DEFINITIONS.find(d=>d.id===id).rarity!=='common'));assert.ok(bp.offer.upgradeIds.every(id=>A.DEFINITIONS.find(d=>d.id===id).rarity!=='legendary'));assert.equal(bp.pendingLevelUps,0);assert.equal(A.collectDrop(b,bp,collect).duplicate,true);assert.equal(A.chooseUpgrade(b,bp,{runId:bp.runId,offerId:bp.offer.id,upgradeId:bp.offer.upgradeIds[0],requestId:'b1'}).ok,true);assert.equal(bp.pendingLevelUps,0);
check('Boss chest offers rare+ below usual level gates, excludes legendary before10 and spends no level credit');
const bad=(patch)=>A.chooseUpgrade(b,bp,{runId:bp.runId,offerId:'invented',upgradeId:'damage',requestId:'bad',...patch});assert.equal(bad({}).ok,false);assert.equal(bad({runId:'stale'}).code,'wrong-run');assert.equal(A.chooseUpgrade(b,bp,{runId:bp.runId,offerId:'invented',upgradeId:'damage',requestId:'b1'}).code,'request-conflict');
check('Invented choices, previous run and reused requestId with altered payload are rejected');
const oldHealth=b.health;drop=A.createDrop(bp,'healthPotion',{x:5,z:0},{amount:10});const pickup={runId:bp.runId,dropId:drop.id,requestId:'pot'};assert.equal(A.collectDrop(b,bp,pickup).code,'out-of-range');b.x=5;assert.equal(A.collectDrop(b,bp,pickup).ok,true);assert.equal(b.health,oldHealth+10);assert.equal(A.collectDrop(b,bp,pickup).duplicate,true);assert.equal(b.health,oldHealth+10);assert.equal(A.collectDrop(b,bp,{...pickup,requestId:'again'}).code,'missing-drop');
drop=A.createDrop(bp,'weapon',{x:5,z:0});A.tickProgression(b,bp,20);assert.equal(A.collectDrop(b,bp,{runId:bp.runId,dropId:drop.id,requestId:'expired'}).code,'missing-drop');
check('Pickup distance,20s expiry and exactly-once+10 potion heal enforced');
drop=A.createDrop(bp,'weapon',{x:5,z:0});assert.equal(A.collectDrop(b,bp,{runId:bp.runId,dropId:drop.id,requestId:'buff'}).ok,true);near(A.attackStats(bp).damageMultiplier,2.8);A.tickProgression(b,bp,15);near(A.attackStats(bp).damageMultiplier,2);
check('Class weapon buff grants1.4x for15 simulation seconds, then expires');
p.bossKills=3;context.player.bossKills=3;const fixedMath=Object.create(Math);fixedMath.random=()=>0;context.Math=fixedMath;p.random=()=>0;const actual=A.resolveDamage(p,10),expected=context.applyDamagePerks({mesh:{position:{}}},10);near(actual.damage,expected.damage);assert.equal(actual.critical,true);assert.equal(actual.echo,true);
check('Server critical/echo/slayer damage matches actual client perk function at controlled RNG');
s.health=50;A.rewardKill(s,p,{type:'brute',xp:0,x:20,z:20},{boss:false});assert.equal(s.health,66);A.rewardKill(s,p,{type:'visor',xp:0,x:20,z:20},{boss:true});assert.equal(s.health,102);
check('Ashen Heart heals8×stacks on brute/caster and18×stacks on boss');
const revivedBefore=p.revives;let result;do{result=A.receiveDamage(s,p,100)}while(!result.revived);assert.equal(s.health,Math.floor(s.maxHealth*.4));assert.equal(p.revives,revivedBefore-1);do{result=A.receiveDamage(s,p,100)}while(s.state!=='dead');assert.equal(A.receiveDamage(s,p,100).damage,0);assert.equal(A.chooseUpgrade(s,p,{runId:p.runId,offerId:'new',upgradeId:'maxHealth',requestId:'dead'}).ok,false);
check('Iron Blood reduces damage; Last Breath revives once at40%, then death stays terminal');
let [e,ep]=fresh();ep.stacks={prismStorm:1,cuttingMoon:1}; // isolated internal fixture only, never a network path
const effects=A.grantXp(e,ep,18);assert.equal(effects.length,1);assert.equal(ep.prismStormRemaining,8);near(effects[0].radius,9.5*1.35);assert.equal(effects[0].damage,24);assert.equal(A.attackStats(ep).projectileBonus,1);A.tickProgression(e,ep,8);assert.equal(A.attackStats(ep).projectileBonus,0);
check('Owned Prism/Cutting Moon trigger on level-up only; no client attack grant needed');
let [race,rp]=fresh();rp.random=()=>.999;A.grantXp(race,rp,18);assert.ok(rp.offer.upgradeIds.includes('ironBlood'));const staleOffer=rp.offer.id;for(let i=0;i<3;i++){const d=A.createDrop(rp,'perk',{x:0,z:0},{perkId:'ironBlood'});assert.equal(A.collectDrop(race,rp,{runId:rp.runId,dropId:d.id,requestId:`perk-${i}`}).ok,true)}assert.equal(rp.stacks.ironBlood,3);assert.equal(rp.pendingLevelUps,1);assert.notEqual(rp.offer.id,staleOffer);assert.ok(!rp.offer.upgradeIds.includes('ironBlood'));assert.equal(A.chooseUpgrade(race,rp,{runId:rp.runId,offerId:staleOffer,upgradeId:'ironBlood',requestId:'stale-perk'}).code,'not-offered');assert.equal(A.chooseUpgrade(race,rp,{runId:rp.runId,offerId:rp.offer.id,upgradeId:rp.offer.upgradeIds[0],requestId:'fresh-perk'}).ok,true);assert.equal(rp.pendingLevelUps,0);
check('Perk pickup capping a visible option refreshes offer ID without spending or stranding level credit');
const isolated=A.snapshot(bp);isolated.upgradeStacks.damage=999;isolated.drops.push({id:'fake'});assert.notEqual(bp.stacks.damage,999);assert.ok(!bp.drops.has('fake'));
check('Public progression snapshots do not expose mutable grant/receipt state');
assert.equal(source,await fs.readFile('src/main.js','utf8'),'Client changed during parity test');
await fs.writeFile(path.join(evidenceDir,'progression-parity.json'),JSON.stringify({passed:true,scope:'Pure module cases plus extracted production client upgrade formulas in VM; no browser/network proof.',clientSha256:crypto.createHash('sha256').update(source).digest('hex'),checks},null,2));
