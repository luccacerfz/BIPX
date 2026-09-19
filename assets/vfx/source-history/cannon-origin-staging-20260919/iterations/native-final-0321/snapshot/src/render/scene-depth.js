// Shared, on-demand RGBA depth for volumetric skills. Targets and materials are owned
// here; source meshes, textures, clipping planes and cutaway uniforms remain borrowed.
export function createSceneDepthPass({ THREE, renderer, adaptDepthMaterial }) {
  const materials = new Map();
  const excluded = new THREE.MeshDepthMaterial();
  excluded.visible = false;
  let target = null, disposed = false;
  let stats = { passes: 0, totalPasses: 0, visibleFields: 0, draws: 0, meshes: 0, excluded: 0, adapted: 0 };
  function depthFor(source) {
    if (!source || !source.visible || !source.depthWrite || !source.colorWrite || source.opacity < .99 ||
        source.blending === THREE.AdditiveBlending || source.isShaderMaterial || source.isRawShaderMaterial) return excluded;
    let entry = materials.get(source);
    if (!entry) {
      const depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking,
        blending: THREE.NoBlending, toneMapped: false });
      const release = () => { depth.dispose(); source.removeEventListener('dispose', release); materials.delete(source); };
      entry = { depth, release, adapted: Boolean(adaptDepthMaterial?.(source, depth)), adapter: null };
      materials.set(source, entry);
      source.addEventListener('dispose', release);
    }
    const { depth } = entry;
    // Maps/planes can change during alpha fades or corpse clipping; never freeze them at creation.
    for (const key of ['side', 'map', 'alphaMap', 'alphaTest', 'alphaHash', 'displacementMap', 'displacementScale',
      'displacementBias', 'clippingPlanes', 'clipIntersection', 'clipShadows', 'wireframe']) {
      if (depth[key] !== source[key]) { depth[key] = source[key]; depth.needsUpdate = true; }
    }
    const adapter = source.userData?.bipxDepthAdapter;
    if (adapter && entry.adapter !== adapter) { adapter(depth); entry.adapter = adapter; depth.needsUpdate = true; }
    if (entry.adapter || entry.adapted) stats.adapted++;
    return depth;
  }
  function render(scene, camera, request, width, height) {
    stats = { ...stats, passes: 0, visibleFields: request?.visibleFields ?? 0, draws: 0, meshes: 0, excluded: 0, adapted: 0 };
    if (disposed || !request?.required) return null;
    if (!target) {
      target = new THREE.WebGLRenderTarget(width, height, { type: THREE.UnsignedByteType,
        minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: true, stencilBuffer: false });
      target.texture.name = 'BIPX shared RGBA-packed scene depth';
      target.texture.colorSpace = THREE.NoColorSpace;
      target.texture.generateMipmaps = false;
    } else if (target.width !== width || target.height !== height) target.setSize(width, height);
    const oldTarget = renderer.getRenderTarget(), face = renderer.getActiveCubeFace(), mip = renderer.getActiveMipmapLevel();
    const clearColor = renderer.getClearColor(new THREE.Color()), clearAlpha = renderer.getClearAlpha();
    const viewport = renderer.getCurrentViewport(new THREE.Vector4());
    const gl = renderer.getContext(), scissor = new THREE.Vector4().fromArray(gl.getParameter(gl.SCISSOR_BOX));
    const scissorTest = gl.isEnabled(gl.SCISSOR_TEST);
    const autoClear = renderer.autoClear, shadowEnabled = renderer.shadowMap.enabled;
    const infoAutoReset = renderer.info.autoReset;
    const background = scene.background, override = scene.overrideMaterial;
    const hidden = [], swapped = [];
    const beforeDraws = renderer.info.render.calls;
    try {
      for (const root of request.excludeRoots ?? []) if (root?.visible) { hidden.push(root); root.visible = false; }
      scene.traverseVisible(object => {
        if (!object.isMesh) {
          if (object.isPoints || object.isLine || object.isSprite) { hidden.push(object); object.visible = false; }
          return;
        }
        const source = object.material;
        const depth = Array.isArray(source) ? source.map(depthFor) : depthFor(source);
        stats.meshes++;
        if (Array.isArray(depth) ? depth.every(m => m === excluded) : depth === excluded) stats.excluded++;
        swapped.push([object, source]); object.material = depth;
      });
      scene.background = null; scene.overrideMaterial = null;
      renderer.autoClear = false; renderer.shadowMap.enabled = false;
      renderer.info.autoReset = false;
      renderer.setRenderTarget(target);
      renderer.setClearColor(0xffffff, 1); // unpack(1,1,1,1) is the far plane, including empty pixels.
      renderer.clear(true, true, true);
      renderer.render(scene, camera);
      stats.passes = 1; stats.totalPasses++; stats.draws = renderer.info.render.calls - beforeDraws;
      return { texture: target.texture, encoding: 'rgba-packed', width, height, near: camera.near, far: camera.far,
        viewport: { x: 0, y: 0, width, height } };
    } finally {
      for (const [object, source] of swapped) object.material = source;
      for (const object of hidden) object.visible = true;
      scene.background = background; scene.overrideMaterial = override;
      renderer.autoClear = autoClear; renderer.shadowMap.enabled = shadowEnabled;
      renderer.info.autoReset = infoAutoReset;
      renderer.setClearColor(clearColor, clearAlpha);
      // Public target binding restores Three's cached viewport; restore any explicit GL
      // scissor/viewport override too without changing the caller's logical canvas settings.
      const targetViewport = oldTarget?.viewport.clone();
      if (oldTarget) oldTarget.viewport.copy(viewport);
      renderer.setRenderTarget(oldTarget, face, mip);
      if (oldTarget) oldTarget.viewport.copy(targetViewport);
      renderer.state.viewport(viewport); renderer.state.scissor(scissor); renderer.state.setScissorTest(scissorTest);
    }
  }
  return {
    render,
    getStats: () => ({ ...stats, encoding: 'rgba-packed', allocated: Boolean(target), width: target?.width ?? 0,
      height: target?.height ?? 0, materials: materials.size, disposed }),
    dispose() {
      if (disposed) return;
      disposed = true; target?.dispose(); target = null;
      for (const entry of [...materials.values()]) entry.release();
      excluded.dispose();
    },
  };
}
