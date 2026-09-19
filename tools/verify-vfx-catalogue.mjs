import { suiteUrl } from './quality-target.mjs';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { chromium, browserLaunchOptions, attachQualityTelemetry, evidenceDir } from './quality-browser.mjs';

const browser = await chromium.launch(browserLaunchOptions);
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const telemetry = attachQualityTelemetry(page, 'vfx-catalogue');
telemetry.markFixture();
telemetry.report.scope = 'Synthetic standalone renderer fixture; does not make catalogue abilities available to gameplay characters or prove natural combat readability.';
try {
  const url = new URL('/quality-vfx-catalogue', await suiteUrl('/'));
  await page.route(url.toString(), route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><head><link rel="icon" href="data:,"><style>body{margin:0;background:#101921;color:#eeddb4;font:16px system-ui}header{position:absolute;top:12px;left:20px;z-index:2}canvas{display:block}</style></head><body><header>VFX catalogue — synthetic fixture, not gameplay</header><canvas id="game-canvas"></canvas></body></html>' }));
  await page.goto(url.toString());
  const catalogue = await page.evaluate(async () => {
    const THREE = await import('/vendor/three/three.module.js');
    const { createCombatVfx } = await import('/src/vfx/combat-vfx.js');
    const { loadHeroVisual } = await import('/src/assets/character-library.js');
    const scene = new THREE.Scene(); scene.background = new THREE.Color(0x101921);
    const renderer = new THREE.WebGLRenderer({ canvas: document.querySelector('canvas'), antialias: true });
    renderer.setSize(innerWidth, innerHeight); renderer.setPixelRatio(1);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, .1, 150);
    camera.position.set(0, 27, 29); camera.lookAt(0, 0, 0);
    scene.add(new THREE.HemisphereLight(0xd9edff, 0x27322b, 2));
    const light = new THREE.DirectionalLight(0xffefcf, 3); light.position.set(-5, 12, 8); scene.add(light);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(42, 28), new THREE.MeshStandardMaterial({ color: 0x263839, roughness: .9 })); ground.rotation.x = -Math.PI / 2; ground.position.y = -.03; scene.add(ground);
    const blade = new THREE.Mesh(new THREE.BoxGeometry(.13, 2.4, .28), new THREE.MeshStandardMaterial({ color: 0x989a9d, metalness: .8, roughness: .3 })); blade.position.set(-11, 1.4, 10); scene.add(blade);
    const parent = new THREE.Group(); parent.position.set(8, 0, 9); scene.add(parent);
    const hero = await loadHeroVisual({ THREE, parent, height: 2.7 });
    renderer.render(scene, camera);
    const baseline = { ...renderer.info.memory };
    const originalMaterial = blade.material;
    const vfx = createCombatVfx({ THREE, scene, quality: 'high', ambient: true });
    const emitter = vfx.attachWeapon(blade);
    const types = ['impact','blood','muzzle','slash','fire','ember','frost','lightning','shockwave','dust','smoke','heal','levelUp','death','teleport','ambient','seal','target','judgement','bladeStorm','shadow'];
    const samples = [];
    for (let i = 0; i < types.length; i++) {
      const position = new THREE.Vector3((i % 7 - 3) * 4.2, 0.2, (Math.floor(i / 7) - 1) * 5.5);
      const accepted = vfx.emit(types[i], position, { direction: new THREE.Vector3(1, 0, 0), target: position.clone().add(new THREE.Vector3(2, 2, 0)), intensity: .8, radius: 1.2 });
      samples.push({ type: types[i], accepted });
    }
    vfx.setTargets([{ id: 'fixture-target', position: new THREE.Vector3(0, 0, 10), locked: true }]);
    vfx.setSoulSource(hero.root);
    hero.attack({ heavy: true });
    for (let i = 0; i < 4; i++) hero.update(.1);
    hero.root.updateWorldMatrix(true, true);
    vfx.summonEcho(new THREE.Vector3(3, 0, 9), { direction: new THREE.Vector3(0, 0, 1), duration: 2 });
    for (let i = 0; i < 4; i++) { vfx.update(1 / 60, { playerPosition: new THREE.Vector3() }); renderer.render(scene, camera); }
    window.__fixture = { THREE, renderer, scene, camera, vfx, blade, originalMaterial, emitter, hero, baseline };
    return { samples, stats: vfx.getStats(), programs: renderer.info.programs.length, glError: renderer.getContext().getError(), baseline };
  });
  assert.equal(catalogue.samples.length, 21);
  assert.ok(catalogue.samples.every(sample => sample.accepted && catalogue.stats.events[sample.type] >= 1));
  assert.equal(catalogue.stats.rejected, 0);
  assert.equal(catalogue.stats.attachedWeapons, 1);
  assert.ok(catalogue.stats.targetMarkers > 0 && catalogue.stats.soulEchoes > 0);
  assert.ok(catalogue.programs > 0);
  assert.equal(catalogue.glError, 0);
  await telemetry.capture('all-families');
  const lifecycle = await page.evaluate(() => {
    const f = window.__fixture;
    const beforePause = f.vfx.getStats().time;
    for (let i = 0; i < 30; i++) f.vfx.update(0, { playerPosition: new f.THREE.Vector3() });
    const afterPause = f.vfx.getStats().time;
    f.vfx.setQuality('low');
    for (let i = 0; i < 1000; i++) f.vfx.emit('fire', new f.THREE.Vector3(), { intensity: 2 });
    f.vfx.update(.02); f.renderer.render(f.scene, f.camera);
    const overload = f.vfx.getStats();
    f.vfx.setReducedMotion(true); f.vfx.update(.02); f.renderer.render(f.scene, f.camera);
    const reduced = f.vfx.getStats();
    f.emitter.dispose(); f.emitter.dispose();
    const materialRestored = f.blade.material === f.originalMaterial;
    f.vfx.dispose(); f.vfx.dispose();
    f.renderer.render(f.scene, f.camera);
    return { beforePause, afterPause, overload, reduced, materialRestored, disposed: f.vfx.getStats(), resources: { ...f.renderer.info.memory }, baseline: f.baseline, glError: f.renderer.getContext().getError() };
  });
  assert.equal(lifecycle.beforePause, lifecycle.afterPause);
  assert.ok(lifecycle.overload.overwritten > 0);
  assert.ok(lifecycle.overload.activeParticles <= lifecycle.overload.particleCapacity);
  assert.ok(lifecycle.overload.activeGlyphs <= lifecycle.overload.glyphCapacity);
  assert.ok(lifecycle.overload.activeBeamSegments <= lifecycle.overload.beamCapacity);
  assert.equal(lifecycle.reduced.reducedMotion, true);
  assert.equal(lifecycle.materialRestored, true);
  assert.equal(lifecycle.disposed.disposed, true);
  assert.equal(lifecycle.disposed.attachedWeapons, 0);
  assert.equal(lifecycle.resources.geometries, lifecycle.baseline.geometries);
  assert.equal(lifecycle.resources.textures, lifecycle.baseline.textures);
  assert.equal(lifecycle.glError, 0);
  telemetry.report.measurements = { catalogue, lifecycle };
  telemetry.assertClean();
  console.log(JSON.stringify({ passed: true, evidenceDirectory: evidenceDir }));
} catch (error) { telemetry.fail(error); process.exitCode = 1; console.error(error.message); }
finally { await telemetry.save(); await browser.close(); }
