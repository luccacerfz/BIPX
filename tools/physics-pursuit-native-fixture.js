// Appended to the snapshot response only. Starts are fixtures; live simulation/input remain real.
const pursuitNativeQa={active:false,samples:[],hits:[],plans:[],calls:[],elapsed:0,mode:'idle',marks:[]};
const pursuitNativeUpdate=updateZombies;
const pursuitNativeDamage=damagePlayerTarget;
const pursuitNativeBody=z=>({id:z.id,x:z.mesh.position.x,z:z.mesh.position.z,y:0,radius:z.radius,height:2});
function getPursuitDirection(...args) {
  const at=performance.now(),result=(pursuitNativeQa.navOverride ?? physicsQaOriginalPursuit)(...args),ms=performance.now()-at;
  if(pursuitNativeQa.active) {
    pursuitNativeQa.calls.push({ms,planned:result.state.planned,visited:result.state.visited,mode:result.mode,terminal:result.state.terminal??null});
    if(result.state.planned)pursuitNativeQa.plans.push({at:pursuitNativeQa.elapsed,body:{x:args[1].x,z:args[1].z},target:{x:args[2].x,z:args[2].z},previousTarget:args[3]?.target??null,previousWaypoints:args[3]?.waypoints??[],waypoints:result.state.waypoints,visited:result.state.visited,terminal:result.state.terminal??null,ms});
  }
  return result;
}
damagePlayerTarget=function(target,amount) {
  const before=player.health;
  const result=pursuitNativeDamage(target,amount);
  if(pursuitNativeQa.active) pursuitNativeQa.hits.push({at:pursuitNativeQa.elapsed,amount,before,after:player.health,player:{x:player.position.x,z:player.position.z},bosses:zombies.map(z=>({...pursuitNativeBody(z),distance:z.mesh.position.distanceTo(player.position),clearLos:clearEnemyMelee(z.mesh.position,player.position)}))});
  return result;
};
updateZombies=function(dt) {
  if(pursuitNativeQa.mode==='cost')return;
  if(!pursuitNativeQa.active)return pursuitNativeUpdate(dt);
  pursuitNativeQa.calls=[];
  const before=zombies.map(pursuitNativeBody),playerBefore={x:player.position.x,z:player.position.z};
  const at=performance.now();
  const result=pursuitNativeUpdate(dt);
  const ms=performance.now()-at;
  pursuitNativeQa.elapsed+=dt;
  pursuitNativeQa.samples.push({at,dt,ms,time:pursuitNativeQa.elapsed,plans:4-zombieNavigationBudget,calls:pursuitNativeQa.calls,before,bodies:zombies.map(pursuitNativeBody),player:playerBefore,health:player.health,frameMs:perfStats.frameMs});
  return result;
};
window.__physicsPursuitNative={
  prepare(start) {
    pursuitNativeQa.active=false;clearEntities();clearPlayerInput();game.shooting=false;
    game.perfStressImmortal=false;game.survivalTime=0;game.zombiesToSpawn=0;game.nextWaveDelay=1000000;game.trapTimer=1000000;
    player.position.set(18.933,0,14.268);player.mesh.position.copy(player.position);player.wave=1;
    // Health/radius/speed/damage/attack cooldown are untouched: standard selected character + real spawn.
    let seed=20260919;const random=Math.random;Math.random=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);
    let boss;try{boss=spawnZombie(start.x,start.z,'bloodCow');}finally{Math.random=random;}
    if(!boss)throw Error('BloodCow spawn rejected');
    if(Math.hypot(boss.mesh.position.x-start.x,boss.mesh.position.z-start.z)>1e-6)throw Error('Known effective start relocated');
    refreshLivingPlayerTargets();rebuildSpatialGrid();
    Object.assign(pursuitNativeQa,{active:true,samples:[],hits:[],plans:[],calls:[],elapsed:0,mode:'fixture',marks:[]});
    return {body:pursuitNativeBody(boss),speed:boss.speed,damage:boss.damage,health:boss.health,maxHealth:boss.maxHealth,reachBonus:boss.reachBonus,player:{x:player.position.x,z:player.position.z,radius:livingPlayerTargets.find(t=>t.isLocal).radius,health:player.health,maxHealth:player.maxHealth,speed:player.speed},profile:monsterProfiles.bloodCow};
  },
  status(){return {time:pursuitNativeQa.elapsed,hits:pursuitNativeQa.hits.length,plans:pursuitNativeQa.plans.length,player:{x:player.position.x,z:player.position.z,health:player.health},bosses:zombies.map(pursuitNativeBody),state:game.state};},
  mark(label){pursuitNativeQa.marks.push({label,time:pursuitNativeQa.elapsed,player:{x:player.position.x,z:player.position.z}});},
  finish(){pursuitNativeQa.active=false;return {samples:pursuitNativeQa.samples,hits:pursuitNativeQa.hits,plans:pursuitNativeQa.plans,marks:pursuitNativeQa.marks,state:this.status(),indexCleared:zombieActorIndex===null,perfStressImmortal:game.perfStressImmortal};}
};

window.__physicsPursuitNative.planningCost = async function() {
  const baseline=await import('/__physics_baseline/navigation.mjs');
  pursuitNativeQa.active=false;pursuitNativeQa.mode='cost';clearEntities();clearPlayerInput();game.shooting=false;
  game.survivalTime=0;game.zombiesToSpawn=0;game.nextWaveDelay=1000000;game.trapTimer=1000000;
  player.position.set(18.933,0,14.268);player.mesh.position.copy(player.position);player.wave=1;
  let seed=20260919;const random=Math.random;Math.random=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);
  try {for(const [x,z] of [[-30,-30],[-40,0],[-25,30],[0,-40]])if(!spawnZombie(x,z,'bloodCow'))throw Error('Cost spawn failed');}finally{Math.random=random;}
  refreshLivingPlayerTargets();rebuildSpatialGrid();
  const starts=zombies.map(z=>({...pursuitNativeBody(z),speed:z.speed,damage:z.damage,health:z.health}));
  const initial=zombies.map(z=>({position:z.mesh.position.clone(),rotation:z.mesh.rotation.y,speed:z.speed,health:z.health,attackCooldown:z.attackCooldown,bossAiTimer:z.bossAiTimer,bossTargetId:z.bossTargetId,bossStrafeTimer:z.bossStrafeTimer,bossStrafeDirection:z.bossStrafeDirection}));
  const samples=[];
  for(let i=0;i<32;i++) {
    await new Promise(requestAnimationFrame);
    for(const variant of (i%2?['candidate','baseline']:['baseline','candidate'])) {
      for(let j=0;j<zombies.length;j++) {const z=zombies[j],v=initial[j];z.mesh.position.copy(v.position);z.mesh.rotation.y=v.rotation;for(const k of ['speed','health','attackCooldown','bossAiTimer','bossTargetId','bossStrafeTimer','bossStrafeDirection'])z[k]=v[k];z.navigation=null;}
      zombieNavigationTick=0;pursuitNativeQa.calls=[];pursuitNativeQa.plans=[];pursuitNativeQa.navOverride=variant==='baseline'?baseline.getPursuitDirection:null;
      refreshLivingPlayerTargets();rebuildSpatialGrid();seed=20260919;Math.random=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);
      pursuitNativeQa.active=true;
      const at=performance.now();pursuitNativeUpdate(1/60);const ms=performance.now()-at;
      pursuitNativeQa.active=false;Math.random=random;
      samples.push({i,variant,ms,plans:4-zombieNavigationBudget,calls:pursuitNativeQa.calls,final:zombies.map(pursuitNativeBody),indexCleared:zombieActorIndex===null});
    }
  }
  pursuitNativeQa.navOverride=null;
  return {starts,samples,scope:'Paired forced4plans workload in native Chrome; same four real-spawn actors reset between independent trials, real updateZombies at dt1/60 including index/crowd. Alternating order; no trace/JSON/geometry audit inside timer. Not spontaneous gameplay or frame FPS.'};
};
