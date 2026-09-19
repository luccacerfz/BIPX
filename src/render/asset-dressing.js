import { ENVIRONMENT_ACTOR_LIMIT, createEnvironmentActorFocus } from './environment-actor-focus.js';
import { installEnvironmentCutaway } from './environment-cutaway.js';
import { loadEnvironmentLibrary } from '../assets/character-library.js';
import { loadCemeteryLibrary } from './environment-library.js';
import { getEnvironmentLayout, getEnvironmentColliders } from './environment-layout.js';
import { ENVIRONMENT_SKILL_AREA_LIMIT, selectEnvironmentSkillAreas } from './environment-skill-focus.js';

// Static props share geometry, materials and instance batches across the arena.
export async function loadAssetDressing({ THREE, scene, trees, lanterns }) {
  const [library, cemeteryLibrary] = await Promise.all([loadEnvironmentLibrary({ THREE }), loadCemeteryLibrary({ THREE })]);
  const layout = getEnvironmentLayout();
  const placements = [];
  const detailBatches = [];
  const batches = new Map();
  const canopyMaterials = new Set();
  const portalMaterials = new Map();
  const maxThreats = 10;
  const actorFocus = createEnvironmentActorFocus(THREE);
  const skillAreasSelected = [];
  const threatDistances = new Float32Array(maxThreats);
  const canopyUniforms = {
    uCanopyActors: { value: Array.from({ length: ENVIRONMENT_ACTOR_LIMIT }, () => new THREE.Vector4()) },
    uCanopyActorStrengths: { value: new Float32Array(ENVIRONMENT_ACTOR_LIMIT) },
    uCanopyFocus: { value: new THREE.Vector3() }, uCanopyCutaway: { value: 0 },
    uCanopyThreats: { value: Array.from({ length: maxThreats }, () => new THREE.Vector4()) },
    uCanopyThreatCount: { value: 0 },
    uCanopySkillAreas: { value: Array.from({ length: ENVIRONMENT_SKILL_AREA_LIMIT }, () => new THREE.Vector4()) },
    uCanopySkillAreaCount: { value: 0 },
  };
  let count = 0;
  function add(name, position, options = {}, rotation = 0) {
    const isNew = cemeteryLibrary.names.includes(name);
    const root = (isNew ? cemeteryLibrary : library).instantiate(name, options);
    if(options.verticalScale) root.scale.y *= options.verticalScale;
    root.position.copy(position); root.rotation.y = rotation; root.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(root);
    placements.push({ name, id: options.id ?? name, min: bounds.min.toArray(), max: bounds.max.toArray(), solid: Boolean(options.solid) });
    root.traverse(mesh => {
      if (!mesh.isMesh) return;
      if (name === 'rune-portal') for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
        if (!portalMaterials.has(material)) portalMaterials.set(material, material.color.clone());
      }
      const cell = `${Math.floor(position.x / 20)}:${Math.floor(position.z / 20)}`;
      const key = cell + ':' + mesh.geometry.uuid + ':' + (Array.isArray(mesh.material) ? mesh.material.map(m => m.uuid).join(',') : mesh.material.uuid);
      if (!batches.has(key)) batches.set(key, { mesh, matrices: [], colors: [], canopy: name === 'cedar-tree' || name === 'undead-obelisk-v1', tree: ['cedar-tree', 'blue-shrine', 'ruined-wall', 'crypt-root-arch', 'undead-obelisk-v1'].includes(name), detail: Boolean(options.detail), cell });
      batches.get(key).matrices.push(mesh.matrixWorld.clone());
      batches.get(key).colors.push(options.instanceTint ?? 0xffffff);
    });
    count++;
  }
  layout.trees.forEach(t => add('cedar-tree', new THREE.Vector3(t.x,0,t.z), {id:t.id, height:t.height,tint:0x92999e,instanceTint:t.instanceTint}, t.yaw));
  lanterns.forEach(position => add('lantern-post', new THREE.Vector3(position.x, 0, position.z), { height: 2.4 }));
  for (let i = 0; i < 6; i++) {
    const angle = i / 6 * Math.PI * 2 + .3;
    add('ruined-wall', new THREE.Vector3(Math.cos(angle) * 34, 0, Math.sin(angle) * 34), { height: 2.1 }, -angle);
  }
  add('rune-portal', new THREE.Vector3(0, .04, 0), { width: 3.6, tint: 0x708e89, castShadow: false });
  // Staging-only art overrides: the shared layout and every solid stay exact.
  // Low roots/flowers remain traversable and use existing material variants.
  const surfaceDecor={
    'root-2':{x:-17.0,z:-13.0,width:2.65,maxHeight:.055,yaw:1.72,instanceTint:0xb3a77c},
    'root-3':{x:21.1,z:12.0,width:2.30,maxHeight:.05,yaw:2.92,instanceTint:0xa2986c},
    'root-4':{x:23.1,z:17.6,width:2.10,maxHeight:.05,yaw:3.72,instanceTint:0xa49b78},
    'root-5':{x:20.1,z:9.8,width:1.85,maxHeight:.055,yaw:3.15,instanceTint:0xb3a783},
    'mushrooms-2':{x:-17.0,z:-14.9,width:.56,maxHeight:.14,instanceTint:0xb7aa8c},
    'mushrooms-3':{x:22.6,z:12.1,width:.48,maxHeight:.10,instanceTint:0xb5a589},
    'mushrooms-4':{x:23.7,z:17.5,width:.44,maxHeight:.085,instanceTint:0xc2b493},
    'mushrooms-5':{x:19.4,z:9.1,width:.44,maxHeight:.085,instanceTint:0xb6a27f},
    'roses-0':{x:-10.5,z:-9.1,width:2.30,maxHeight:.26,yaw:.34,instanceTint:0xc6b997},
    'roses-1':{x:-16.3,z:-7.6,width:1.95,maxHeight:.30,yaw:1.12,instanceTint:0xb1baa1},
    'roses-2':{x:-14.3,z:-16.0,width:2.70,maxHeight:.24,yaw:.5,instanceTint:0xbcb598},
    'offering-0':{x:-13.1,z:-8.0,width:.48,maxHeight:.09,yaw:.7},
    'offering-1':{x:-16.8,z:-11.5,width:.60,maxHeight:.13,yaw:2.4},
    'offering-2':{x:-11.9,z:-14.7,width:.43,maxHeight:.09,yaw:.2},
  };
  for(const source of layout.props){
    if(source.solid&&surfaceDecor[source.id])throw Error('Surface decor cannot move a solid');
    const prop={...source,...surfaceDecor[source.id]};
    add(prop.asset,new THREE.Vector3(prop.x,prop.y,prop.z),prop,prop.yaw);
  }
  const group = new THREE.Group(); group.name = 'Local library environment — cemetery-v1 + undead-obelisk-v1';
  for (const { mesh, matrices, colors, tree, canopy, detail, cell } of batches.values()) {
    if (tree) for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      if (canopyMaterials.has(material)) continue;
      canopyMaterials.add(material);
      installEnvironmentCutaway(material, canopyUniforms, { threatLimit: maxThreats, skillAreaLimit: ENVIRONMENT_SKILL_AREA_LIMIT, transition: canopy ? 'canopy-lobed-aperture' : 'legacy' });
    }
    const batch = new THREE.InstancedMesh(mesh.geometry, mesh.material, matrices.length);
    matrices.forEach((matrix, i) => { batch.setMatrixAt(i, matrix); if(colors.some(c=>c!==0xffffff))batch.setColorAt(i,new THREE.Color(colors[i])); });
    batch.castShadow = mesh.castShadow; batch.receiveShadow = true;
    batch.instanceMatrix.needsUpdate = true; batch.computeBoundingSphere(); batch.computeBoundingBox();
    batch.name = `environment-cell-${cell}`;
    if (detail) detailBatches.push(batch);
    group.add(batch);
  }
  scene.add(group);
  const resources = { geometries: new Set(), materials: new Set(), textures: new Set(), textureBytesEstimate: 0, triangles: 0 };
  group.traverse(mesh => {
    if (!mesh.isMesh) return;
    resources.geometries.add(mesh.geometry);
    resources.triangles += (mesh.geometry.index?.count ?? mesh.geometry.attributes.position.count) / 3 * (mesh.count ?? 1);
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      resources.materials.add(material);
      for (const key of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap', 'aoMap']) {
        const texture = material[key];
        if (!texture || resources.textures.has(texture)) continue;
        resources.textures.add(texture);
        resources.textureBytesEstimate += (texture.image?.width || 0) * (texture.image?.height || 0) * 4 * 4 / 3;
      }
    }
  });
  const stats = { loaded: true, version: layout.version, props: count, batches: group.children.length, canopyCutaway: true, canopyThreatLimit: maxThreats,
    source: 'Local Assets / Harbor_Map + Tunnel_Map + House_Reconstruction', colliders: getEnvironmentColliders().length, spatialCellMeters: 20,
    skillAreaCutaway: true, skillAreaLimit: ENVIRONMENT_SKILL_AREA_LIMIT, skillAreaFocusCount: 0, skillAreaIds: [], portalTintScale: 1,
    detailCullDistance: 46, visibleDetailBatches: detailBatches.length, uniqueGeometries: resources.geometries.size,
    uniqueMaterials: resources.materials.size, uniqueTextures: resources.textures.size, textureBytesEstimate: Math.round(resources.textureBytesEstimate),
    maxInstancedTriangles: resources.triangles, placements };

  return { group, colliders: getEnvironmentColliders(),
    update(position, playing, threats = [], hazards = [], skillAreas = [], actors = [], camera = null, dt = 0) {
      const actorSlots = actorFocus.update(actors, position, camera, dt, playing && Boolean(camera));
      for (let i = 0; i < ENVIRONMENT_ACTOR_LIMIT; i++) {
        const actor = actorSlots[i];
        canopyUniforms.uCanopyActors.value[i].set(actor.x, actor.y, actor.z, 2.5);
        canopyUniforms.uCanopyActorStrengths.value[i] = actor.strength;
      }
      stats.canopyActorFocus = actorSlots.map(actor => ({ ...actor }));
      for (const batch of detailBatches) {
        const sphere = batch.boundingSphere;
        batch.visible = !playing || Math.hypot(position.x - sphere.center.x, position.z - sphere.center.z) < 46 + sphere.radius;
      }
      stats.visibleDetailBatches = detailBatches.filter(batch => batch.visible).length;
      canopyUniforms.uCanopyFocus.value.copy(position);
      canopyUniforms.uCanopyFocus.value.y += 1.2;
      canopyUniforms.uCanopyCutaway.value = playing ? 1 : 0;
      canopyUniforms.uCanopyThreatCount.value = 0;
      canopyUniforms.uCanopySkillAreaCount.value = 0;
      stats.skillAreaFocusCount = 0;
      stats.skillAreaIds.length = 0;
      stats.portalTintScale = 1;
      for (const [material, baseColor] of portalMaterials) material.color.copy(baseColor);
      if (!playing) return;
      selectEnvironmentSkillAreas(skillAreas, position, skillAreasSelected);
      for (let i = 0; i < skillAreasSelected.length; i++) {
        const area = skillAreasSelected[i];
        canopyUniforms.uCanopySkillAreas.value[i].set(area.position.x, (area.position.y ?? 0) + .12, area.position.z, area.radius);
        stats.skillAreaIds.push(area.id ?? area.castId ?? area.skillId);
      }
      // The decorative spawn disc must not compete with a real fire/ice/gravity area.
      if (skillAreasSelected.some(area => Math.hypot(area.position.x, area.position.z) < area.radius + 1.8)) {
        stats.portalTintScale = .28;
        for (const [material, baseColor] of portalMaterials) material.color.copy(baseColor).multiplyScalar(stats.portalTintScale);
      }
      stats.skillAreaFocusCount = skillAreasSelected.length;
      canopyUniforms.uCanopySkillAreaCount.value = skillAreasSelected.length;
      threatDistances.fill(Infinity);
      // Keep a bounded nearest-threat list without sorting/allocating the horde.
      const points = canopyUniforms.uCanopyThreats.value;
      const consider = (point, radius, height) => {
        if (!point) return;
        const distance = (point.x - position.x) ** 2 + (point.z - position.z) ** 2;
        if (distance > 26 ** 2 || distance >= threatDistances[maxThreats - 1]) return;
        let index = maxThreats - 1;
        while (index > 0 && distance < threatDistances[index - 1]) {
          threatDistances[index] = threatDistances[index - 1];
          points[index].copy(points[index - 1]); index--;
        }
        threatDistances[index] = distance;
        points[index].set(point.x, point.y + height, point.z, radius);
        canopyUniforms.uCanopyThreatCount.value = Math.min(maxThreats, canopyUniforms.uCanopyThreatCount.value + 1);
      };
      for (const threat of threats) if (threat.health > 0) consider(threat.mesh?.position, Math.max(1.2, (threat.radius || .8) + .65), 1.2);
      for (const hazard of hazards) consider(hazard.mesh?.position || hazard.position, Math.max(1.5, hazard.radius || 2.5), .15);
    },
    stats,
  };
}
