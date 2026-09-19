import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import path from 'node:path';
import crypto from 'node:crypto';
import {evidenceDir} from './quality-browser.mjs';
const A = await import('../src/progression/authority.mjs');
const U = await import('../src/progression/skill-upgrades.mjs');
const K = await import('../src/combat/class-skills.mjs');
const checks=[];const check=(name,details={})=>{checks.push({name,...details});console.log(name)};
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} != ${b}`);
const source=await fs.readFile('src/main.js','utf8');
const definitionText=source.slice(source.indexOf('const upgradeDefinitions = ['),source.indexOf('\nconst upgradeById'));
const fn=name=>{const start=source.indexOf(`function ${name}(`);return source.slice(start,source.indexOf('\nfunction ',start+1));};
const basePlayer=()=>({character:'dwarf',health:100,maxHealth:200,upgradeStacks:{},perks:{},upgradeStats:{damageMultiplier:2,cooldownMultiplier:1,areaMultiplier:1,speedMultiplier:1,pickupRadius:2.35,projectileBonus:0},damageReduction:0,critChance:0,critMultiplier:1.8,revives:0,bossKills:0,position:{},perkCooldowns:{prismStorm:0},autoWeapons:{},level:1,rarityPity:0,score:0});
// Upgrades 2.0: the client appends the shared skill cards and mirrors the offer/fallback rules, so the VM also gets
// the production offer functions. Presentation hooks are inert stubs; every rule below is the shipped source text.
const rarityText=source.slice(source.indexOf('const rarityStyles = {'),source.indexOf('\nconst bossAiProfiles'));
const announced=[];
const context=vm.createContext({player:basePlayer(),multiplayer:{enabled:false},triggerPerkAnimation(){},tryEvolveWeapons(){},Math,combatVfx:undefined,
  SKILL_UPGRADES:U.SKILL_UPGRADES,SKILL_UPGRADE_WEIGHTS:U.SKILL_UPGRADE_WEIGHTS,EXHAUSTED_REWARD:U.EXHAUSTED_REWARD,isUpgradeForClass:U.isUpgradeForClass,
  announceExhaustedReward:count=>announced.push(count),getAutoWeaponDisplayLabel:id=>id});
vm.runInContext(rarityText+'\n'+definitionText+'\nconst upgradeById = new Map(upgradeDefinitions.map((upgrade) => [upgrade.id, upgrade]));\n'+['applyUpgrade','applyPerkEffect','getXpToNext','getSlayerPactMultiplier','hasPerk','applyDamagePerks','rollUpgradeChoices','pickWeightedUpgrade','getUpgradeRollWeight','isUpgradeAvailable','normalizeRarity','getRarityStyle','getRarityRank','grantExhaustedReward','getPlayerBuildSummary'].map(fn).join('\n')+'\nglobalThis.defs=upgradeDefinitions;globalThis.roll=rollUpgradeChoices;globalThis.exhausted=grantExhaustedReward;globalThis.build=getPlayerBuildSummary;',context);
assert.deepEqual(A.DEFINITIONS.map(d=>d.id),[...context.defs].map(d=>d.id)); // spread: VM arrays belong to another realm
for(const d of A.DEFINITIONS){const live=context.defs.find(x=>x.id===d.id);for(const key of ['label','rarity','kind','maxStacks'])assert.equal(d[key],live[key]);assert.equal(d.minLevel,live.minLevel??1);assert.equal(d.classId??null,live.classId??null)}
assert.equal(A.DEFINITIONS.length,18+U.SKILL_UPGRADES.length);assert.equal(U.SKILL_UPGRADES.length,18);
check('All36 definitions (18 generic + 18 class skill cards) match live client order, labels, rarities, kinds, class, level gates and stack caps');
const fresh=(character='dwarf')=>{const s={runId:`test-${character}`,character,health:100,maxHealth:200,bestLevel:1,stateVersion:0,state:'playing',x:0,z:0,wave:1};return [s,A.createProgression(s,{random:()=>0})]};
let [s,p]=fresh();
for(let l=1;l<100;l++) assert.equal(A.xpToNext(l),context.getXpToNext(l));
let total=0;for(let l=1;l<30;l++){const before=A.levelFromXp(total);assert.equal(before.level,l);assert.equal(before.xp,0);total+=A.xpToNext(l);const edge=A.levelFromXp(total-1);assert.equal(edge.level,l);assert.equal(edge.xp,A.xpToNext(l)-1)}
check('XP thresholds and edge remainders match client formula through level99');
A.grantXp(s,p,Array.from({length:99},(_,i)=>A.xpToNext(i+1)).reduce((a,b)=>a+b,0));
let grants=0;const seen=new Set();
const levelUps=p.level-1,lyraPlayer=context.player;
// The last grant exhausts every stack: the server then pays the fallback for the surplus level-ups, so the
// health mirror is compared while an offer remains and the fallback itself is asserted right after the loop.
const classCards=[];
while(p.offer){const offer=p.offer;const id=offer.upgradeIds[0];const def=context.defs.find(x=>x.id===id);const msg={runId:p.runId,offerId:offer.id,upgradeId:id,requestId:`grant-${++grants}`};
  if(U.getClassSkillUpgrades('dwarf').some(card=>A.available(p,card,'level')))assert.ok(offer.upgradeIds.some(x=>A.DEFINITIONS.find(d=>d.id===x).kind==='skill'),`offer ${grants} lacks a class card`);
  assert.ok(offer.upgradeIds.every(x=>U.isUpgradeForClass(A.DEFINITIONS.find(d=>d.id===x),'dwarf')));classCards.push(offer.upgradeIds.filter(x=>A.DEFINITIONS.find(d=>d.id===x).kind==='skill').length);
  assert.equal(A.chooseUpgrade(s,p,msg).ok,true);context.applyUpgrade(def);seen.add(id);const snapshot=A.snapshot(p);for(const [k,v]of Object.entries(context.player.upgradeStats))near(snapshot.upgradeStats[k],v);for(const key of ['damageReduction','critChance','critMultiplier','revives'])near(snapshot[key],context.player[key]);near(s.maxHealth,context.player.maxHealth);if(p.offer)near(s.health,context.player.health);
  assert.deepEqual(A.skillMods(p),U.getSkillMods(context.player.upgradeStacks,'dwarf'));assert.deepEqual(K.sanitizeSkillMods(A.skillMods(p)),A.skillMods(p));assert.equal(A.chooseUpgrade(s,p,msg).duplicate,true);}
assert.equal(seen.size,26);assert.equal(grants,71);assert.equal(s.maxHealth,272);assert.equal(p.pendingLevelUps,0);assert.ok(classCards[0]>=1&&classCards.at(-1)===0);
check('All26 currently eligible Lyra upgrades (16 generic + 6 skill + 4 resource cards) granted via offers through caps; every offer held a class card while one was available; formulas and skillMods match actual client functions',{grants,maxHealth:s.maxHealth});
// Fallback: 99 level-ups, 71 stacks. The surplus ones pay 25% life + 250 score each instead of vanishing.
const surplus=levelUps-grants;assert.equal(levelUps,99);assert.equal(p.exhaustedRewards,surplus);assert.equal(A.snapshot(p).exhaustedRewards,surplus);assert.equal(s.score,U.EXHAUSTED_REWARD.score*surplus);assert.equal(s.health,s.maxHealth);
context.player.score=0;context.exhausted(surplus);assert.equal(context.player.score,s.score);assert.equal(context.player.health,s.health);assert.deepEqual(announced,[surplus]);
let [ex,exp]=fresh();for(const d of A.DEFINITIONS)if(A.available({...exp,level:99},d,'level'))exp.stacks[d.id]=d.maxStacks; // isolated internal fixture only
A.syncProgression(ex,exp);assert.equal(ex.maxHealth,272);ex.health=40;A.grantXp(ex,exp,A.xpToNext(1));assert.equal(exp.offer,null);assert.equal(exp.pendingLevelUps,0);assert.equal(ex.health,40+272*U.EXHAUSTED_REWARD.healFraction);assert.equal(ex.score,U.EXHAUSTED_REWARD.score);assert.equal(exp.exhaustedRewards,1);
const chest=A.createDrop(exp,'bossChest',{x:0,z:0});assert.equal(A.collectDrop(ex,exp,{runId:exp.runId,dropId:chest.id,requestId:'spent-chest'}).ok,true);assert.equal(exp.exhaustedRewards,2);assert.equal(ex.health,40+2*272*U.EXHAUSTED_REWARD.healFraction);assert.ok(!exp.drops.has(chest.id));
context.player=Object.assign(basePlayer(),{health:40,score:0,level:2});announced.length=0;context.exhausted(1);assert.equal(context.player.health,40+200*U.EXHAUSTED_REWARD.healFraction);assert.equal(context.player.score,U.EXHAUSTED_REWARD.score);assert.deepEqual(announced,[1]);
check('Exhausted progression pays the fallback (25% life + 250 score per surplus level-up or boss chest) on server and in the production client function, never a silent discard',{surplus});
let [warrior,wp]=fresh('warrior');A.grantXp(warrior,wp,200000);const seenWarrior=new Set();while(wp.offer){const id=wp.offer.upgradeIds[0];for(const x of wp.offer.upgradeIds)assert.ok(U.isUpgradeForClass(A.DEFINITIONS.find(d=>d.id===x),'warrior'),`Aldric offered ${x}`);seenWarrior.add(id);assert.equal(A.chooseUpgrade(warrior,wp,{runId:wp.runId,offerId:wp.offer.id,upgradeId:id,requestId:`w${wp.offerSerial}`}).ok,true)}assert.equal(seenWarrior.size,26);for(const id of ['projectile','prismStorm','autoWeapon','sealRitual',...U.SKILL_UPGRADES.filter(c=>c.classId==='dwarf').map(c=>c.id)])assert.ok(!seenWarrior.has(id));assert.equal(A.attackStats(wp).projectileBonus,0);
for(const card of U.SKILL_UPGRADES.filter(c=>c.classId==='warrior'))assert.ok(!seen.has(card.id),`Lyra received ${card.id}`);
let [thief,tp]=fresh('warrior');A.grantXp(thief,tp,18);assert.equal(A.chooseUpgrade(thief,tp,{runId:tp.runId,offerId:tp.offer.id,upgradeId:'cannonPowder',requestId:'steal'}).code,'not-offered');tp.offer.upgradeIds[0]='cannonPowder';assert.equal(A.chooseUpgrade(thief,tp,{runId:tp.runId,offerId:tp.offer.id,upgradeId:'cannonPowder',requestId:'steal-2'}).code,'unavailable');assert.equal(tp.stacks.cannonPowder,undefined);
const w=A.skillMods(wp),l=A.skillMods(p);assert.equal(w.cannonDamage,1);assert.equal(w.frostHop,0);assert.equal(l.dashRange,0);assert.equal(l.chargeBastion,0);assert.equal(w.dashRange,3);assert.equal(l.frostHop,4);near(l.cooldownMultiplier,.7*.85);near(w.costMultiplier,.76);assert.equal(w.resourceMax,145);
check('Aldric keeps sword-only26 eligible upgrades and never sees Lyra cards (offer, forged choice and derived mods); Lyra retains projectile/Prism availability and never sees Aldric cards');
// Same RNG stream → the production client roll and the server roll pick the same three cards, level by level.
{let seed=12345;const next=()=>(seed=(seed*1664525+1013904223)%4294967296)/4294967296;
 for(const character of ['warrior','dwarf']){const [ms,mp]=fresh(character),stream=[];let pick=0;mp.random=()=>{const value=next();stream.push(value);return value};
  const mirror=Object.assign(basePlayer(),{character,level:1,rarityPity:0});context.player=mirror;const mirrorMath=Object.create(Math);let cursor=0;mirrorMath.random=()=>stream[cursor++];context.Math=mirrorMath;
  for(let level=1;level<60;level++){A.grantXp(ms,mp,A.xpToNext(level));if(!mp.offer)break;mirror.level=mp.level;
   const local=[...context.roll('level')].map(u=>u.id);assert.deepEqual(local,mp.offer.upgradeIds,`${character} level ${mp.level}`);assert.equal(mirror.rarityPity,mp.rarityPity);assert.equal(cursor,stream.length);
   const id=mp.offer.upgradeIds[pick++%mp.offer.upgradeIds.length];assert.equal(A.chooseUpgrade(ms,mp,{runId:mp.runId,offerId:mp.offer.id,upgradeId:id,requestId:`mirror-${level}`}).ok,true);context.applyUpgrade(context.defs.find(d=>d.id===id));}
  assert.deepEqual([...context.build()],ms.build);assert.ok(ms.build.length===8&&ms.build.some(entry=>U.SKILL_UPGRADES.some(card=>entry.startsWith(card.label))),JSON.stringify(ms.build));}
 context.Math=Math;context.player=lyraPlayer;}
check('Seeded RNG: production client rollUpgradeChoices and the server offer pick identical cards, pity and build summary (rarest first, class cards included) for both classes through level 60');
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
// The class slot now takes the first pick, so a constant roll that lands ironBlood in slots 2-3 is searched instead of assumed.
const ironRoll=Array.from({length:1000},(_,i)=>i/1000).find(r=>{const [ts,tp2]=fresh();tp2.random=()=>r;A.grantXp(ts,tp2,18);return tp2.offer.upgradeIds.includes('ironBlood')});assert.ok(ironRoll!==undefined);
let [race,rp]=fresh();rp.random=()=>ironRoll;A.grantXp(race,rp,18);assert.ok(rp.offer.upgradeIds.includes('ironBlood'));const staleOffer=rp.offer.id;for(let i=0;i<3;i++){const d=A.createDrop(rp,'perk',{x:0,z:0},{perkId:'ironBlood'});assert.equal(A.collectDrop(race,rp,{runId:rp.runId,dropId:d.id,requestId:`perk-${i}`}).ok,true)}assert.equal(rp.stacks.ironBlood,3);assert.equal(rp.pendingLevelUps,1);assert.notEqual(rp.offer.id,staleOffer);assert.ok(!rp.offer.upgradeIds.includes('ironBlood'));assert.equal(A.chooseUpgrade(race,rp,{runId:rp.runId,offerId:staleOffer,upgradeId:'ironBlood',requestId:'stale-perk'}).code,'not-offered');assert.equal(A.chooseUpgrade(race,rp,{runId:rp.runId,offerId:rp.offer.id,upgradeId:rp.offer.upgradeIds[0],requestId:'fresh-perk'}).ok,true);assert.equal(rp.pendingLevelUps,0);
check('Perk pickup capping a visible option refreshes offer ID without spending or stranding level credit');
const isolated=A.snapshot(bp);isolated.upgradeStacks.damage=999;isolated.drops.push({id:'fake'});assert.notEqual(bp.stacks.damage,999);assert.ok(!bp.drops.has('fake'));
check('Public progression snapshots do not expose mutable grant/receipt state');
assert.equal(source,await fs.readFile('src/main.js','utf8'),'Client changed during parity test');
await fs.writeFile(path.join(evidenceDir,'progression-parity.json'),JSON.stringify({passed:true,scope:'Pure module cases plus extracted production client upgrade formulas in VM; no browser/network proof.',clientSha256:crypto.createHash('sha256').update(source).digest('hex'),checks},null,2));
