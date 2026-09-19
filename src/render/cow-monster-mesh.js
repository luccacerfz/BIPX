// Cow / BloodCow procedural mesh with shoulder-grip hierarchy.
// Handle and blade are attached to the limb that holds them (Object3D.attach keeps rest world pose).
// BloodCow must call createCowMonsterMesh first (pivots), then scale 1.45.

export const COW_ARM_REST_X = -0.42;

export const cowPalettes = {
  cowWalker: { skin: 0xf2efe0, cloth: 0x402019, eye: 0xffd36d },
  cowCharger: { skin: 0xffffff, cloth: 0x251715, eye: 0xff4b4b },
  cowBrute: { skin: 0x9b5a47, cloth: 0x3a1414, eye: 0xff7a28 },
};

export function getCommonMonsterBodySpec(type) {
  const bodyRadius = type === 'runner' || type === 'cowCharger' ? 0.44 : type === 'brute' || type === 'cowBrute' ? 0.9 : 0.62;
  const bodyHeight = type === 'brute' || type === 'cowBrute' ? 1.72 : type === 'runner' || type === 'cowCharger' ? 1.32 : 1.45;
  return { bodyRadius, bodyHeight };
}

function attachGrip(THREE, group, arm, weapons, name) {
  const half = arm.geometry.parameters.height / 2;
  const localTop = new THREE.Vector3(0, half, 0).applyEuler(arm.rotation);
  const grip = new THREE.Group();
  grip.name = name;
  grip.position.copy(arm.position).add(localTop);
  group.add(grip);
  grip.attach(arm);
  for (const weapon of weapons) if (weapon) grip.attach(weapon);
  return grip;
}

export function createCowMonsterMesh(THREE, type = 'cowWalker', { afterBuild } = {}) {
  const group = new THREE.Group();
  group.userData.lodState = 'detail';
  const palette = cowPalettes[type] ?? cowPalettes.cowWalker;
  const skin = new THREE.MeshStandardMaterial({ color: palette.skin, roughness: 0.78 });
  const dark = new THREE.MeshStandardMaterial({ color: palette.cloth, roughness: 0.82 });
  const horn = new THREE.MeshStandardMaterial({ color: 0xf7e8b8, roughness: 0.62 });
  const metal = new THREE.MeshStandardMaterial({ color: 0xb7c2c9, roughness: 0.42, metalness: 0.35 });
  const eye = new THREE.MeshStandardMaterial({ color: palette.eye, emissive: palette.eye, emissiveIntensity: 1.25 });
  const { bodyRadius, bodyHeight } = getCommonMonsterBodySpec(type);
  const brute = type === 'cowBrute';
  const charger = type === 'cowCharger';

  const body = new THREE.Mesh(new THREE.CylinderGeometry(bodyRadius * 0.78, bodyRadius, bodyHeight, 9), skin);
  body.position.y = brute ? 1.08 : 0.92;
  body.castShadow = true;
  group.add(body);

  const belly = new THREE.Mesh(new THREE.BoxGeometry(bodyRadius * 1.25, bodyHeight * 0.42, 0.12), dark);
  belly.position.set(0, body.position.y + 0.06, -bodyRadius * 0.74);
  belly.castShadow = true;
  group.add(belly);

  const head = new THREE.Mesh(new THREE.SphereGeometry(brute ? 0.58 : 0.44, 16, 11), skin);
  head.position.set(0, brute ? 2.08 : charger ? 1.72 : 1.82, -0.18);
  head.scale.set(1.05, 0.9, 1.15);
  head.castShadow = true;
  group.add(head);

  const snout = new THREE.Mesh(new THREE.BoxGeometry(brute ? 0.66 : 0.5, 0.22, 0.34), dark);
  snout.position.set(0, head.position.y - 0.06, -0.55);
  group.add(snout);

  let leftArm, rightArm, leftHandle, leftBlade, rightHandle, rightBlade;
  for (const side of [-1, 1]) {
    const hornMesh = new THREE.Mesh(new THREE.ConeGeometry(0.11, brute ? 0.72 : 0.48, 8), horn);
    hornMesh.position.set(side * (brute ? 0.36 : 0.28), head.position.y + 0.36, -0.1);
    hornMesh.rotation.z = side * -0.72;
    hornMesh.castShadow = true;
    group.add(hornMesh);

    const eyeMesh = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), eye);
    eyeMesh.position.set(side * 0.16, head.position.y + 0.06, -0.56);
    group.add(eyeMesh);

    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.24, brute ? 1.25 : 1.02, 0.26), skin);
    arm.name = side < 0 ? 'CowLeftArm' : 'CowRightArm';
    arm.position.set(side * (brute ? 0.86 : 0.66), brute ? 1.14 : 1.0, -0.22);
    arm.rotation.z = side * 0.18;
    arm.rotation.x = COW_ARM_REST_X;
    arm.castShadow = true;
    group.add(arm);
    if (side < 0) leftArm = arm; else rightArm = arm;

    const leg = new THREE.Mesh(new THREE.BoxGeometry(brute ? 0.32 : 0.24, 0.78, 0.28), dark);
    leg.position.set(side * (brute ? 0.36 : 0.24), 0.26, 0.08);
    leg.castShadow = true;
    group.add(leg);

    if (side > 0 || brute) {
      const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.065, brute ? 1.7 : 1.25, 8), dark);
      handle.name = side < 0 ? 'CowLeftHandle' : 'CowRightHandle';
      handle.position.set(side * (brute ? 1.18 : 0.88), brute ? 1.08 : 0.94, -0.62);
      handle.rotation.z = side * 0.34;
      handle.rotation.x = Math.PI * 0.5;
      group.add(handle);

      const blade = new THREE.Mesh(new THREE.BoxGeometry(brute ? 0.58 : 0.42, brute ? 0.48 : 0.34, 0.11), metal);
      blade.name = side < 0 ? 'CowLeftBlade' : 'CowRightBlade';
      blade.position.set(side * (brute ? 1.38 : 1.02), brute ? 1.5 : 1.22, -1.08);
      blade.rotation.z = side * -0.2;
      group.add(blade);

      if (side < 0) { leftHandle = handle; leftBlade = blade; }
      else { rightHandle = handle; rightBlade = blade; }
    }
  }

  const leftGrip = attachGrip(THREE, group, leftArm, [leftHandle, leftBlade], 'CowLeftGrip');
  const rightGrip = attachGrip(THREE, group, rightArm, [rightHandle, rightBlade], 'CowRightGrip');

  group.userData.animatedParts = {
    leftArm: leftGrip,
    rightArm: rightGrip,
    leftGrip,
    rightGrip,
    leftArmMesh: leftArm,
    rightArmMesh: rightArm,
    leftHandle,
    leftBlade,
    rightHandle,
    rightBlade,
    head,
    gripHierarchy: true,
    armRestX: COW_ARM_REST_X,
  };

  afterBuild?.(group, { type, palette, bodyRadius, bodyHeight });
  return group;
}

export function createBloodCowMesh(THREE, options) {
  const group = createCowMonsterMesh(THREE, 'cowBrute', options);
  group.scale.setScalar(1.45);
  group.traverse((child) => {
    if (!child.isMesh || child.userData.eliteMarker) return;
    if (child.material?.color) {
      child.material = child.material.clone();
      child.material.color.lerp(new THREE.Color(0x8e1014), 0.45);
      if (child.material.emissive) {
        child.material.emissive.setHex(0x3d0306);
        child.material.emissiveIntensity = 0.35;
      }
    }
  });
  const crown = new THREE.Mesh(
    new THREE.ConeGeometry(0.58, 0.76, 5),
    new THREE.MeshStandardMaterial({ color: 0x2a0606, emissive: 0xff1d1d, emissiveIntensity: 0.28, roughness: 0.5 }),
  );
  crown.name = 'BloodCowCrown';
  crown.position.set(0, 3.0, -0.18);
  crown.rotation.y = Math.PI / 5;
  group.add(crown);
  return group;
}

export function applyCowArmPose(parts, leftX, rightX, headY = 0) {
  if (!parts) return;
  const rest = Number.isFinite(parts.armRestX) ? parts.armRestX : COW_ARM_REST_X;
  if (parts.gripHierarchy) {
    if (parts.leftArm) parts.leftArm.rotation.x = leftX - rest;
    if (parts.rightArm) parts.rightArm.rotation.x = rightX - rest;
  } else {
    if (parts.leftArm) parts.leftArm.rotation.x = leftX;
    if (parts.rightArm) parts.rightArm.rotation.x = rightX;
  }
  if (parts.head) parts.head.rotation.y = headY;
}
