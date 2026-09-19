import { applyCompositionGround, addCompositionContacts } from './environment-composition-ground.js';
import { getEnvironmentLayout, getEnvironmentColliders } from './environment-layout.js';

// Visible solid transforms share the pure layout consumed by browser/Node physics.
export function createCemetery({ THREE, scene }) {
  const layout = getEnvironmentLayout();
  const group = new THREE.Group();
  group.name = 'Cemetery architecture';
  scene.add(group);
  let seed = 17391;
  const random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  const stone = new THREE.MeshStandardMaterial({ color: 0x53676b, roughness: .94 });
  const paleStone = new THREE.MeshStandardMaterial({ color: 0x718083, roughness: .88 });
  const textureLoader = new THREE.TextureLoader();
  function tiledMap(family, name, repeat = 1) {
    const texture = textureLoader.load(`./assets/textures/${family}/${name}.jpg`);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(repeat, repeat); texture.anisotropy = 4;
    if (name === 'color') texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }
  const stoneColor = tiledMap('stone', 'color');
  const stoneNormal = tiledMap('stone', 'normal');
  const stoneRoughness = tiledMap('stone', 'roughness');
  for (const material of [stone, paleStone]) {
    material.map = stoneColor; material.normalMap = stoneNormal; material.roughnessMap = stoneRoughness;
    material.normalScale.set(.5, .5);
  }
  const iron = new THREE.MeshStandardMaterial({ color: 0x1c292e, roughness: .48, metalness: .7 });
  const glow = new THREE.MeshBasicMaterial({ color: new THREE.Color(3.6, 1.25, .22), toneMapped: false });
  const obj = new THREE.Object3D();
  function instances(geometry, material, transforms, shadows = true) {
    const mesh = new THREE.InstancedMesh(geometry, material, transforms.length);
    transforms.forEach((t, i) => {
      obj.position.set(t[0], t[1], t[2]); obj.rotation.set(t[6] || 0, t[7] || 0, t[8] || 0);
      obj.scale.set(t[3], t[4], t[5]); obj.updateMatrix(); mesh.setMatrixAt(i, obj.matrix);
      if(t[9]!==undefined)mesh.setColorAt(i,new THREE.Color(t[9]));
    });
    mesh.castShadow = shadows; mesh.receiveShadow = true; mesh.computeBoundingSphere(); group.add(mesh); return mesh;
  }
  const slabs = [], shafts = [], bars = [], lights = [], lanterns = [], debris = [];
  for (const { x, z, yaw: angle } of layout.crosses) {
    const crossX = x - Math.sin(angle) * .7, crossZ = z - Math.cos(angle) * .7;
    slabs.push([x, .09, z, 1.8, .18, 2.8, 0, angle, 0]);
    shafts.push([crossX, 1.15, crossZ, .36, 2.2, .32, 0, angle, 0]);
    bars.push([crossX, 1.75, crossZ, 1.3, .29, .32, 0, angle, 0]);
  }
  for (let i = 0; i < 10; i++) {
    const angle = i / 10 * Math.PI * 2;
    const radius = i % 2 ? 26 : 10;
    const x = Math.cos(angle) * radius, z = Math.sin(angle) * radius;
    lanterns.push([x, .16, z, .85, .32, .85], [x, .65, z, .22, 1.2, .22], [x, 1.36, z, .7, .18, .7]);
    lights.push([x, 1.57, z, .32, .42, .32]);
    if (i % 2 === 0) {
      const light = new THREE.PointLight(0xffae58, 5, 7, 2); light.position.set(x, 1.8, z); group.add(light);
    }
  }
  for (let i = 0; i < 110; i++) {
    const angle = random() * Math.PI * 2, radius = 9 + random() * 48;
    const scale = .12 + random() * .5;
    debris.push([Math.cos(angle) * radius, .1, Math.sin(angle) * radius, scale, scale * .5, scale * 1.5, 0, random() * 6.28, .2]);
  }
  instances(new THREE.BoxGeometry(1, 1, 1), stone, slabs);
  instances(new THREE.BoxGeometry(1, 1, 1), paleStone, [...shafts, ...bars]);
  const lanternBody = instances(new THREE.BoxGeometry(1, 1, 1), iron, lanterns);
  const lanternGlow = instances(new THREE.IcosahedronGeometry(1, 0), glow, lights, false);
  instances(new THREE.DodecahedronGeometry(1, 0), stone, debris, false);
  // Burial courts: repeated stonework/ironwork use shared GPU batches.
  const tombBases = [], tombLids = [], tombInlays = [], railBars = [], railSpires = [];
  const localPoint = (p, x, z) => [p.x + Math.cos(p.yaw) * x + Math.sin(p.yaw) * z, p.z - Math.sin(p.yaw) * x + Math.cos(p.yaw) * z];
  for (const t of layout.tombs) {
    tombBases.push([t.x,t.height*.375,t.z,t.width*.88,t.height*.75,t.depth*.92,0,t.yaw,0]);
    tombLids.push([t.x,t.height*.895,t.z,t.width,t.height*.21,t.depth,0,t.yaw,0,[0xb8b3a3,0xadb9b0,0xc5c1b3][layout.tombs.indexOf(t)%3]]);
    const [cx, cz] = localPoint(t, 0, -.2);
    tombInlays.push([cx, t.height+.011, cz, .15, .025, 2.1, 0, t.yaw, 0], [cx, t.height+.014, cz, .85, .025, .15, 0, t.yaw, 0]);
  }
  for (const f of layout.fences) {
    for (let i = 0; i <= 10; i++) {
      const [x, z] = localPoint(f, -f.width / 2 + i * f.width / 10, 0);
      railBars.push([x, .48, z, .06, .96, .06, 0, f.yaw, 0]);
      railSpires.push([x, 1, z, .095, .15, .095, 0, f.yaw, 0]);
    }
    for (const y of [.24, .75]) railBars.push([f.x, y, f.z, f.width, .045, .05, 0, f.yaw, 0]);
  }
  instances(new THREE.BoxGeometry(1, 1, 1), stone, tombBases);
  instances(new THREE.BoxGeometry(1, 1, 1), paleStone, tombLids);
  instances(new THREE.BoxGeometry(1, 1, 1), iron, [...tombInlays, ...railBars]);
  instances(new THREE.ConeGeometry(1, 1, 4), iron, railSpires);
  const cobbles = [];
  for (let row = -30; row <= 30; row++) {
    for (let col = -2; col <= 2; col++) {
      const x = col * 1.12 + (row % 2) * .52;
      const z = row * 1.25;
      const sy = .07 + random() * .035;
      cobbles.push([x, .025, z, .98 + random() * .06, sy, 1.05 + random() * .1, 0, (random() - .5) * .08, 0]);
      if (Math.abs(row) > 3) cobbles.push([z, .024, x, 1.05, sy, 1, 0, (random() - .5) * .07, 0]);
    }
  }
  // Crypt landing uses three irregular Tunnel modules in the shared layout.
  const road = instances(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({
    color: 0x7c9392, map: stoneColor, normalMap: stoneNormal, normalScale: new THREE.Vector2(.45, .45),
    roughnessMap: stoneRoughness, roughness: .85, metalness: .06,
  }), cobbles, false);

  for(let i=0;i<cobbles.length;i++)road.setColorAt(i,new THREE.Color([0xd3d0c4,0xc8cdc0,0xe2d6c3,0xbfc5bc][i%4]));

  // Distant mausoleum establishes orientation without masking the playable center.
  function block(x, y, z, sx, sy, sz, material = stone) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), material);
    mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; group.add(mesh); return mesh;
  }
  block(0, .4, -43, 14, .8, 10);
  block(-5.2, 4, -44, 2.5, 7.4, 7); block(5.2, 4, -44, 2.5, 7.4, 7);
  block(0, 7.6, -44, 13, 1.2, 8, paleStone); block(0, 8.6, -44, 10.6, .8, 7);
  block(0, 4, -47, 10, 7, .8); block(0, 3.2, -46.5, 3.8, 5.6, .1, iron);
  for (const x of [-6.2, -3.3, 3.3, 6.2]) block(x, 3.9, -39.8, .5, 6.8, .6, paleStone);
  // Tiered coping and pinnacles strengthen the north landmark without new lights.
  block(0, 9.2, -44, 8.5, .45, 6, stone);
  for (const x of [-5.2, 5.2]) {
    block(x, 8.4, -41, 1.2, .5, 1.2, paleStone);
    const pinnacle = new THREE.Mesh(new THREE.ConeGeometry(.65, 2.2, 4), stone);
    pinnacle.position.set(x, 9.65, -41); pinnacle.rotation.y = Math.PI / 4;
    pinnacle.castShadow = true; group.add(pinnacle);
  }
  const seal = new THREE.Mesh(new THREE.TorusGeometry(1.2, .045, 6, 48), glow);
  seal.position.set(0, 5.7, -46.35); group.add(seal);

  const terrainMaterial = new THREE.MeshStandardMaterial({
    color: 0x7b9792, map: tiledMap('terrain', 'color', 28), normalMap: tiledMap('terrain', 'normal', 28),
    roughnessMap: tiledMap('terrain', 'roughness', 28), normalScale: new THREE.Vector2(.65, .65), roughness: .9,
  });
  applyCompositionGround(terrainMaterial, layout, { stoneColor });
  addCompositionContacts({THREE, group, layout});
  return { colliders: getEnvironmentColliders(), layoutVersion: layout.version, lanternPlaceholders: [lanternBody, lanternGlow], groundMaterial: terrainMaterial, graveMaterial: paleStone, group, lanternPositions: lights.map(t => ({ x: t[0], y: t[1], z: t[2] })) };
}
