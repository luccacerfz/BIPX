export const spawnFixture=`
process.on('message',r=>{
 if(r.type!=='qa-spawn-config'&&r.type!=='qa-spawn-state')return;
 try {
  const room=rooms.get(r.room);if(!room)throw Error('Missing room');
  if(r.type==='qa-spawn-config') {
   room.world.monsters.clear();room.world.projectiles.clear();room.world.zombiesToSpawn=0;room.world.nextWaveDelay=1e9;
   for(const spec of r.actors||[]) {
    const monster=spawnServerMonster(room,spec.x,spec.z,spec.type||'zombie');if(!monster)throw Error('Fixture setup failed');
    Object.assign(monster,{x:spec.x,z:spec.z,radius:spec.radius||monster.radius,health:1000,maxHealth:1000,speed:0,attackCooldown:1e9,freezeTimer:300});
   }
   if(r.clientId) {
    const client=room.clients.get(r.clientId);
    if(r.dead){client.state.health=0;client.state.state='dead';}
    if(r.skillState){client.skills.resource=47;client.skills.cooldowns=[5,4,0];client.skills.sequence=8;client.state.skills=skillSnapshot(client.skills);}
   }
  }
  const c=room.clients.get(r.clientId);
  process.send({id:r.id,result:{bodies:getServerCrowdBodies(room),state:c?structuredClone(c.state):null,skills:c?skillSnapshot(c.skills):null,lastStartRequestId:c?.lastStartRequestId}});
 }catch(error){process.send({id:r.id,error:error.message});}
});`;
