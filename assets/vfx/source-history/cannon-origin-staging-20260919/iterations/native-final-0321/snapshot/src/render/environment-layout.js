// Shared scene/physics contract. Metres; Three Y yaw; no DOM or renderer imports.
export const ENVIRONMENT_GROUND = Object.freeze({ y: 0, minY: 0, maxY: 0, shape: 'circle', x: 0, z: 0, radius: 55 });
export const ENVIRONMENT_VERSION = 'cemetery-composition-v2-candidate';
const box = (id, x, z, halfX, halfZ, maxY, yaw = 0, minY = 0) => ({ id, shape: 'box', x, z, halfX, halfZ, yaw, minY, maxY, blockingActors: true, blockingProjectiles: true });
const circle = (id, x, z, radius, maxY) => ({ id, shape: 'circle', x, z, radius, minY: 0, maxY, blockingActors: true, blockingProjectiles: true });

/** Fresh arrays ensure a physics consumer cannot mutate render transforms. */
export function getEnvironmentLayout() {
  const props = [], tombs = [], fences = [], crosses = [], legacy = [];
  const add = (id, asset, x, z, width, yaw = 0, extra = {}) => props.push({ id, asset, x, y: 0, z, width, yaw, ...extra });
  // Three places, reusing the already optimized Harbor / Tunnel / House derivatives.
  add('shrine-west', 'blue-shrine', -12.8, -15.1, 2.8, .30, { solid: true, tint: 0xb4ada0, saturation: .16 });
  add('crypt-door', 'crypt-door', 0, -46.35, 3.5, 0, { y: .65 });
  add('crypt-entry-wall', 'ruined-wall', 12.3, -16.4, 5.8, 0, { solid: true, verticalScale: 2.1, tint: 0xb8b4a8 });
  add('crypt-entry-door', 'crypt-door', 12.3, -15.7, 2.8, 0, { solid: true, tint: 0xc5bca8, saturation: .4 });
  for (const [i,x,z,width,yaw] of [[0,17.2,-17,3.1,.5],[1,9.2,-17.2,2.3,2.1],[2,-17.6,-13.9,2.2,1.2],[3,22,13,3.4,2.6],[4,24,19,2.7,4.1],[5,20,8.7,2,3.7]]) {
    add(`rocks-${i}`, 'border-rock', x, z, width, yaw, { solid: true });
    add(`root-${i}`, 'root-border', x+.6, z+.8, 2.7+i%3*.35, yaw+.4, { tint: 0x94958a, maxHeight: .10 });
    add(`mushrooms-${i}`, 'mushrooms', x-.9, z+.8, .6+i%2*.2, yaw, { detail: true, maxHeight: .20, tint: 0x738c85, saturation: .25 });
  }
  for (const [i,x,z,width,depth,height,yaw] of [[0,-11.8,-9,2.1,4,1.05,.12],[1,-15,-6.6,1.65,3.25,.85,-.15],[2,-15.3,-12.4,1.9,3.6,1,.27],[3,-14,14,2,3.8,1.05,-.12],[4,-17,-27,2,3.8,1.05,-.12],[5,17,-27,2,3.8,1.05,.12]])
    tombs.push({id:`sarcophagus-${i}`,x,z,width,depth,height,yaw});
  for(const [i,x,z,width,yaw] of [[0,-10.1,-8.6,2.8,.15],[1,-16.5,-7.1,2.1,1.4],[2,-14,-16,3.4,.2],[3,9.1,-15.1,1.3,-.2],[4,15.8,-15.4,1.8,1.5],[5,-15.7,13.3,1.6,1.2]])
    add(`roses-${i}`, 'rose-bush', x,z,width,yaw,{detail:true,tint:0xb7a49b,maxHeight:.42});
  for(const [i,x,z] of [[0,-13.4,-8.3],[1,-16.6,-11.2],[2,-11.8,-14.9]])
    add(`offering-${i}`, 'mushrooms',x,z,.52+i*.12,i,{detail:true,maxHeight:.16,tint:0x88908a,saturation:.25});
  for(const [i,x,z,width,yaw] of [[0,-14,-17.2,7.2,.08],[1,-18,-10.5,7.5,Math.PI/2],[2,-14,19,6,0],[3,18.8,16.7,6,-.1]])
    fences.push({id:`burial-rail-${i}`,x,z,width,yaw,height:1.05});
  for(const [i,x,z,width,yaw] of [[0,19,11.2,2.6,.18],[1,20,10.6,3.1,.2],[2,17.2,10.7,1.8,-.6],[3,19.7,14.3,2.4,1.45]])
    add(`fallen-beam-${i}`,'timber-beam',x,z,width,yaw,{solid:true,maxHeight:.16,tint:0x998876,saturation:.55});
  add('barrel-0','barrel',17.8,12.6,1.2,.1,{solid:true});
  add('barrel-1','barrel',19,13.2,1,-.3,{solid:true});
  add('barrel-2','barrel',17.2,14.6,1.2,.5,{solid:true});
  // Existing main.js headstones/tree trunks. Keep exactly aligned until Combat moves their factory.
  for (let i = 0; i < 52; i++) {
    const angle = i * 2.38, r = 11 + (i % 9) * 4.2;
    const x = Math.cos(angle) * r + ((i % 3) - 1) * 2.1;
    const z = Math.sin(angle) * r + (((i + 1) % 4) - 1.5) * 1.8;
    if (Math.abs(x) < 7 && Math.abs(z) < 7) continue;
    legacy.push(i % 5 === 0 ? circle(`tree-trunk-${i}`, x, z, .42, 2.2) : box(`headstone-${i}`, x, z, .62, .17, 1.9, angle + Math.PI * .5));
  }
  for (let i = 0; i < 40; i++) {
    const yaw = i * 2.39996, r = 13 + (i % 6) * 6.3;
    const x = Math.cos(yaw) * r, z = Math.sin(yaw) * r;
    crosses.push({ id: `cross-${i}`, x, z, yaw });
  }
  const treeHeights=[3.9,5.7,4.6,6.2,3.4,5.2,3.8,5.8,4.7,4.2,4.1];
  const trees=legacy.filter(p=>p.id.startsWith('tree')).map((p,i)=>({id:p.id,x:p.x,z:p.z,height:treeHeights[i%treeHeights.length],yaw:i*2.4+.35,instanceTint:[0xd5c0a1,0xa5bdb2,0xc5c2aa][i%3]}));
  for(const [i,p] of legacy.filter(p=>p.id.startsWith('tree')).entries()) {const ratio=trees[i].height/(5.5+i%3*.6);p.radius*=ratio;p.maxY*=ratio;}
  const grounds=[{id:'funerary-garden',x:-13.4,z:-11,rx:6.5,rz:8,yaw:.1},{id:'crypt-entry',x:12.3,z:-14.3,rx:6,rz:4.8,yaw:0},{id:'maintenance',x:19.3,z:12.8,rx:6,rz:5.8,yaw:.15}];
  return { trees, grounds, version: ENVIRONMENT_VERSION, ground: { ...ENVIRONMENT_GROUND }, props, tombs, fences, crosses, legacy };
}

export function getEnvironmentColliders() {
  const layout = getEnvironmentLayout(), colliders = [...layout.legacy];
  for (const t of layout.tombs) colliders.push(box(t.id, t.x, t.z, t.width / 2, t.depth / 2, t.height, t.yaw));
  for (const f of layout.fences) colliders.push(box(f.id, f.x, f.z, f.width / 2, .09, f.height, f.yaw));
  // Width-normalized derivatives; contact core is within their visible footprint.
  for (const p of layout.props) if (p.solid) {
    if (p.asset === 'blue-shrine') colliders.push(circle(p.id, p.x, p.z, p.width * .39, p.width * 1.109));
    else if (p.asset === 'barrel') colliders.push(circle(p.id, p.x, p.z, p.width * .43, p.width * .896));
    else if (p.asset === 'crypt-door') colliders.push(box(p.id,p.x,p.z,p.width*.46,p.width*.10,p.width*.795,p.yaw));
    else if (p.asset === 'ruined-wall') colliders.push(box(p.id,p.x,p.z,p.width*.46,p.width*.10,p.width*.226*(p.verticalScale||1),p.yaw));
    else if (p.asset === 'timber-beam') colliders.push(box(p.id,p.x,p.z,p.width*.46,p.width*.052,p.maxHeight,p.yaw));
    else if (p.asset === 'border-rock') colliders.push(box(p.id, p.x, p.z, p.width * .4, p.width * .28, p.width * .642, p.yaw));
  }
  for (const c of layout.crosses) {
    const x = c.x - Math.sin(c.yaw) * .7, z = c.z - Math.cos(c.yaw) * .7;
    colliders.push(box(c.id, x, z, .19, .17, 2.25, c.yaw));
  }
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * Math.PI * 2 + .3;
    colliders.push(box(`ruined-wall-${i}`, Math.cos(a) * 34, Math.sin(a) * 34, 4.55, 1.08, 2.1, -a));
  }
  for (let i = 0; i < 10; i++) {
    const a = i / 10 * Math.PI * 2, r = i % 2 ? 26 : 10;
    colliders.push(circle(`lantern-${i}`, Math.cos(a) * r, Math.sin(a) * r, .17, 2.4));
  }
  colliders.push(box('mausoleum-foundation', 0, -43, 7, 5, .8));
  colliders.push(box('mausoleum-west', -5.2, -44, 1.25, 3.5, 7.7));
  colliders.push(box('mausoleum-east', 5.2, -44, 1.25, 3.5, 7.7));
  colliders.push(box('mausoleum-rear', 0, -47, 5, .4, 7.5));
  colliders.push(box('mausoleum-door', 0, -46.5, 1.9, .18, 6));
  for (const x of [-6.2,-3.3,3.3,6.2]) colliders.push(box(`mausoleum-column-${x}`, x, -39.8, .3, .35, 7.3));
  return colliders;
}
