import { createSceneDepthPass } from './scene-depth.js';
import { verifyAndReflectShaderPrograms } from './shader-program-readiness.mjs';

/** Exercise Three's real WebGLShadowMap path on a temporary staging scene. */
export function renderShaderWarmupShadowScene({ THREE, renderer, scene, camera, target }) {
  if (!THREE || !renderer || !scene || !camera || !target) throw new TypeError('shadow warmup needs renderer, scene, camera and target');
  const output = renderer.getRenderTarget(), face = renderer.getActiveCubeFace(), mip = renderer.getActiveMipmapLevel();
  const viewport = renderer.getCurrentViewport(new THREE.Vector4());
  const gl = renderer.getContext();
  const scissor = new THREE.Vector4().fromArray(gl.getParameter(gl.SCISSOR_BOX));
  const scissorTest = gl.isEnabled(gl.SCISSOR_TEST);
  const outputViewport = output?.viewport?.clone();
  const clearColor = renderer.getClearColor(new THREE.Color()), clearAlpha = renderer.getClearAlpha();
  const autoClear = renderer.autoClear;
  const shadowState = {
    enabled: renderer.shadowMap.enabled,
    autoUpdate: renderer.shadowMap.autoUpdate,
    needsUpdate: renderer.shadowMap.needsUpdate,
  };
  const autoReset = renderer.info.autoReset;
  const renderInfo = { ...renderer.info.render };
  try {
    renderer.setRenderTarget(target);
    renderer.autoClear = true;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.autoUpdate = true;
    renderer.shadowMap.needsUpdate = true;
    renderer.render(scene, camera);
  } finally {
    renderer.shadowMap.enabled = shadowState.enabled;
    renderer.shadowMap.autoUpdate = shadowState.autoUpdate;
    renderer.shadowMap.needsUpdate = shadowState.needsUpdate;
    renderer.autoClear = autoClear;
    renderer.info.autoReset = autoReset;
    for (const key of Object.keys(renderInfo)) renderer.info.render[key] = renderInfo[key];
    renderer.setClearColor(clearColor, clearAlpha);
    if (output) output.viewport.copy(viewport);
    renderer.setRenderTarget(output, face, mip);
    if (output && outputViewport) output.viewport.copy(outputViewport);
    renderer.state.viewport(viewport);
    renderer.state.scissor(scissor);
    renderer.state.setScissorTest(scissorTest);
  }
}

/** Build a disposable shadow-only scene from the actual configured shadow light and product caster. */
export function createShaderWarmupShadowStage({ THREE, shadowLight, camera, caster, lightingScene = null }) {
  if (!THREE?.Scene || !shadowLight?.castShadow || !shadowLight.target?.clone || !shadowLight.shadow?.mapSize ||
      !camera?.clone || !camera?.layers?.test || !caster?.position?.set) throw new TypeError('shadow warmup stage needs the production light, camera and caster');
  const stage = new THREE.Scene();
  stage.name = 'shader-warmup-shadow-map-thunderstaff';
  const light = shadowLight.clone(false);
  light.target = shadowLight.target.clone(false);
  const retainedLighting = [];
  const copyWorldTransform = (source, target) => {
    if (!source?.matrixWorld?.decompose || !target?.position || !target?.quaternion || !target?.scale) return;
    source.updateWorldMatrix?.(true, false);
    source.matrixWorld.decompose(target.position, target.quaternion, target.scale);
    target.updateMatrix?.();
  };
  const retainLightShape = source => {
    if (!source?.isLight || source === shadowLight || source.visible === false || !source.layers?.test?.(camera.layers)) return;
    const clone = source.clone(false);
    // The staging pass needs the published scene's exact light-count cache key,
    // while only the cloned moon should contribute a shadow caster pass.
    clone.castShadow = false;
    copyWorldTransform(source, clone);
    const target = source.target && clone.target ? clone.target : null;
    if (target) copyWorldTransform(source.target, target);
    retainedLighting.push(clone);
    if (target) retainedLighting.push(target);
  };
  if (typeof lightingScene?.traverseVisible === 'function') lightingScene.traverseVisible(retainLightShape);
  else lightingScene?.traverse?.(retainLightShape);
  stage.add(...retainedLighting, light, light.target, caster);
  caster.position.set(0, 0, 0);
  caster.visible = true;
  let disposed = false;
  return { scene: stage, camera: camera.clone(), light, caster,
    shadowMapSize: { width: light.shadow.mapSize.x, height: light.shadow.mapSize.y },
    dispose() {
      if (disposed) return false;
      disposed = true;
      // The caster is borrowed from the product warmup roots. Only detach it;
      // the root owner disposes its geometry/material exactly once.
      stage.remove(caster);
      stage.remove(...retainedLighting);
      retainedLighting.length = 0;
      stage.remove(light, light.target);
      // DirectionalLight.dispose() delegates to its shadow and releases cloned targets at this stage boundary.
      light.dispose();
      return true;
    } };
}

/** Prime the renderer's cached light state for this exact shadow stage without compiling caster color materials. */
export function primeShaderWarmupShadowLighting({ THREE, renderer, scene, camera }) {
  if (!THREE?.Scene || typeof renderer?.compile !== 'function' || !scene || !camera) {
    throw new TypeError('shadow warmup lighting prime needs Three, renderer, stage scene and camera');
  }
  renderer.compile(new THREE.Scene(), camera, scene);
}

/** Prime, render the real shadow pass once, then release its large temporary map on every path. */
export function runShaderWarmupShadowStage(stage, prime, render) {
  if (!stage?.scene || !stage?.camera || typeof stage.dispose !== 'function' || typeof prime !== 'function' || typeof render !== 'function') {
    throw new TypeError('shadow warmup runner needs an owned stage, lighting prime and render callback');
  }
  let result, stageError = null, disposeError = null;
  try {
    prime(stage.scene, stage.camera);
    result = render(stage.scene, stage.camera);
  } catch (error) { stageError = error; }
  try { stage.dispose(); } catch (error) { disposeError = error; }
  if (stageError && disposeError) throw new AggregateError([stageError, disposeError], 'shadow warmup preparation/render and stage cleanup both failed');
  if (stageError) throw stageError;
  if (disposeError) throw disposeError;
  return result;
}

// HDR scene -> half-resolution bloom -> restrained filmic composite.
// All resources are reused and resized only when the drawing buffer changes.
export function createCinematicPipeline({ THREE, renderer, adaptDepthMaterial, getDepthWarmupIdentity }) {
  const size = new THREE.Vector2();
  const sceneDepth = createSceneDepthPass({ THREE, renderer, adaptDepthMaterial, getDepthWarmupIdentity });
  let disposed = false;
  const sceneTarget = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType });
  sceneTarget.samples = renderer.capabilities.isWebGL2 ? 4 : 0;
  const bloomTargets = Array.from({ length: 2 }, () => new THREE.WebGLRenderTarget(1, 1, {
    type: THREE.HalfFloatType, depthBuffer: false,
  }));
  const screen = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const vertexShader = `varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.,1.); }`;
  const material = (fragmentShader, uniforms) => new THREE.ShaderMaterial({
    vertexShader, fragmentShader, uniforms, depthTest: false, depthWrite: false, toneMapped: false,
  });
  const extract = material(`varying vec2 vUv; uniform sampler2D source;
    void main(){vec3 c=texture2D(source,vUv).rgb; float l=max(c.r,max(c.g,c.b));
      gl_FragColor=vec4(c*max(l-1.05,0.)/max(l,.001),1.);}`,
    { source: { value: sceneTarget.texture } });
  const blur = material(`varying vec2 vUv; uniform sampler2D source; uniform vec2 stepSize;
    void main(){vec3 c=texture2D(source,vUv).rgb*.227027;
      c+=texture2D(source,vUv+stepSize*1.384615).rgb*.316216;
      c+=texture2D(source,vUv-stepSize*1.384615).rgb*.316216;
      c+=texture2D(source,vUv+stepSize*3.230769).rgb*.070270;
      c+=texture2D(source,vUv-stepSize*3.230769).rgb*.070270;
      gl_FragColor=vec4(c,1.);}`,
    { source: { value: null }, stepSize: { value: new THREE.Vector2() } });
  const composite = material(`varying vec2 vUv; uniform sampler2D source; uniform sampler2D glow;
    uniform float bloomStrength; uniform float damage; uniform float exposure; uniform float time; uniform float finish;
    vec3 filmic(vec3 x){return clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14),0.,1.);}
    void main(){vec2 fringe=(vUv-.5)*.00065*finish;
      vec3 c=texture2D(source,vUv).rgb;
      c.r=texture2D(source,vUv+fringe).r; c.b=texture2D(source,vUv-fringe).b;
      c+=texture2D(glow,vUv).rgb*bloomStrength;
      c*=vec3(.98,1.015,1.025);
      c=filmic(c*exposure);
      float edge=1.-smoothstep(.22,.78,length((vUv-.5)*vec2(1.,.85)));
      c*=mix(.78,1.,edge); c=mix(c,vec3(.42,.025,.022),damage*(1.-edge)*.7);
      float grain=fract(sin(dot(gl_FragCoord.xy+floor(time*24.),vec2(12.9898,78.233)))*43758.5453)-.5;
      c+=grain*.003*finish;
      gl_FragColor=vec4(c,1.);
      #include <colorspace_fragment>
    }`, {
    source: { value: sceneTarget.texture }, glow: { value: bloomTargets[0].texture },
    bloomStrength: { value: .22 }, damage: { value: 0 }, exposure: { value: 1 },
    time: { value: 0 }, finish: { value: 1 },
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), composite);
  quad.frustumCulled = false;
  screen.add(quad);
  let quality = 'high';
  let reducedMotion = false;
  let width = 0;
  let height = 0;
  let damage = 0;
  const warmupMaterials = new Map([
    ['cinematic/extract', extract], ['cinematic/blur', blur], ['cinematic/composite', composite],
  ]);
  const verifiedShaderPrograms = new Set();
  function shaderWarmupTarget(pass) {
    if (pass === 'scene') return sceneTarget;
    if (pass === 'bloom') return bloomTargets[0];
    if (pass === 'canvas') return null;
    if (pass === 'depth') {
      renderer.getDrawingBufferSize(size);
      return sceneDepth.getShaderWarmupTarget(Math.max(1, size.x), Math.max(1, size.y));
    }
    throw new RangeError(`unknown shader warmup render target: ${pass}`);
  }
  function compileShaderWarmupScene(sourceScene, sourceCamera, targetScene, { pass = 'scene', shadowEnabled = null } = {}) {
    const target = shaderWarmupTarget(pass);
    const output = renderer.getRenderTarget(), face = renderer.getActiveCubeFace(), mip = renderer.getActiveMipmapLevel();
    const viewport = renderer.getCurrentViewport(new THREE.Vector4());
    const gl = renderer.getContext();
    const scissor = new THREE.Vector4().fromArray(gl.getParameter(gl.SCISSOR_BOX));
    const scissorTest = gl.isEnabled(gl.SCISSOR_TEST);
    const targetViewport = output?.viewport.clone();
    const previousShadowState = renderer.shadowMap.enabled;
    let pending;
    try {
      renderer.setRenderTarget(target);
      if (shadowEnabled !== null) renderer.shadowMap.enabled = shadowEnabled;
      const parallelCompile = gl.getExtension('KHR_parallel_shader_compile');
      pending = parallelCompile
        ? renderer.compileAsync(sourceScene, sourceCamera, targetScene)
        : Promise.resolve(renderer.compile(sourceScene, sourceCamera, targetScene));
    } finally {
      renderer.shadowMap.enabled = previousShadowState;
      if (output) output.viewport.copy(viewport);
      renderer.setRenderTarget(output, face, mip);
      if (output && targetViewport) output.viewport.copy(targetViewport);
      renderer.state.viewport(viewport);
      renderer.state.scissor(scissor);
      renderer.state.setScissorTest(scissorTest);
    }
    return pending;
  }
  async function verifyShaderWarmupPrograms({ yieldControl = () => Promise.resolve(), maxPrograms = 512,
    maxReadinessYields = 120, onReflectionPhase } = {}) {
    return verifyAndReflectShaderPrograms({
      programs: [...(renderer.info.programs ?? [])],
      gl: renderer.getContext(),
      checkShaderErrors: renderer.debug.checkShaderErrors,
      verifiedPrograms: verifiedShaderPrograms,
      yieldControl,
      maxPrograms,
      maxReadinessYields,
      onReflectionPhase,
      onShaderError: typeof renderer.debug.onShaderError === 'function'
        ? renderer.debug.onShaderError.bind(renderer.debug)
        : undefined,
    });
  }
  async function compileShaderWarmupCase(id, targetScene) {
    const material = warmupMaterials.get(id);
    if (!material) throw new RangeError(`unknown cinematic shader warmup case: ${id}`);
    const before = quad.material;
    let pending;
    try {
      quad.material = material;
      // WebGLRenderer.compileAsync visits materials synchronously before it returns
      // its readiness promise, so restore the live quad before yielding to a frame.
      const pass = id === 'cinematic/composite' ? 'canvas' : 'bloom';
      pending = compileShaderWarmupScene(screen, camera, targetScene ?? screen, { pass });
    } finally {
      quad.material = before;
    }
    await pending;
  }
  function warmupShadowMapScene(sourceScene, sourceCamera) {
    return renderShaderWarmupShadowScene({ THREE, renderer, scene: sourceScene, camera: sourceCamera, target: sceneTarget });
  }
  const pass = (mat, target) => { quad.material = mat; renderer.setRenderTarget(target); renderer.render(screen, camera); };
  return {
    setQuality(value) {
      if (quality === value) return;
      quality = value;
      const samples = quality === 'high' && renderer.capabilities.isWebGL2 ? 4 : 0;
      if (sceneTarget.samples !== samples) { sceneTarget.samples = samples; sceneTarget.dispose(); }
    },
    setReducedMotion(value) { reducedMotion = Boolean(value); },
    impact(strength = .3) { if (!reducedMotion) damage = Math.min(.75, damage + strength); },
    render(scene, sceneCamera, dt, depthConsumer = null) {
      if (disposed) return;
      const output = renderer.getRenderTarget();
      const face = renderer.getActiveCubeFace(), mip = renderer.getActiveMipmapLevel();
      const infoAutoReset = renderer.info.autoReset, autoClear = renderer.autoClear;
      const autoClearFlags = [renderer.autoClearColor, renderer.autoClearDepth, renderer.autoClearStencil];
      const viewport = renderer.getCurrentViewport(new THREE.Vector4());
      const gl = renderer.getContext(), scissor = new THREE.Vector4().fromArray(gl.getParameter(gl.SCISSOR_BOX));
      const scissorTest = gl.isEnabled(gl.SCISSOR_TEST);
      if (output) size.set(output.width, output.height);
      else renderer.getDrawingBufferSize(size);
      if (width !== size.x || height !== size.y) {
        width = size.x; height = size.y;
        sceneTarget.setSize(width, height);
        for (const target of bloomTargets) target.setSize(Math.max(1, width >> 1), Math.max(1, height >> 1));
      }
      renderer.info.autoReset = false;
      renderer.info.reset();
      try {
        renderer.autoClear = true;
        renderer.autoClearColor = renderer.autoClearDepth = renderer.autoClearStencil = true;
        const request = depthConsumer?.prepareSceneDepth?.(sceneCamera);
        const depth = sceneDepth.render(scene, sceneCamera, request, width, height);
        depthConsumer?.setSceneDepth?.(depth);
        renderer.setRenderTarget(sceneTarget);
        renderer.render(scene, sceneCamera);
        const bloom = quality === 'high';
        if (bloom) {
          pass(extract, bloomTargets[0]);
          blur.uniforms.source.value = bloomTargets[0].texture;
          blur.uniforms.stepSize.value.set(2 / bloomTargets[0].width, 0);
          pass(blur, bloomTargets[1]);
          blur.uniforms.source.value = bloomTargets[1].texture;
          blur.uniforms.stepSize.value.set(0, 2 / bloomTargets[0].height);
          pass(blur, bloomTargets[0]);
        }
        damage *= Math.exp(-dt * 5);
        composite.uniforms.damage.value = reducedMotion ? 0 : damage;
        composite.uniforms.time.value += dt;
        composite.uniforms.finish.value = bloom && !reducedMotion ? 1 : 0;
        composite.uniforms.bloomStrength.value = bloom ? .24 : 0;
        quad.material = composite;
        renderer.setRenderTarget(output, face, mip);
        renderer.state.viewport(viewport); renderer.state.scissor(scissor); renderer.state.setScissorTest(scissorTest);
        renderer.render(screen, camera);
      } catch (error) {
        depthConsumer?.setSceneDepth?.(null);
        throw error;
      } finally {
        renderer.autoClear = autoClear;
        [renderer.autoClearColor, renderer.autoClearDepth, renderer.autoClearStencil] = autoClearFlags;
        renderer.info.autoReset = infoAutoReset;
        const targetViewport = output?.viewport.clone();
        if (output) output.viewport.copy(viewport);
        renderer.setRenderTarget(output, face, mip);
        if (output) output.viewport.copy(targetViewport);
        renderer.state.viewport(viewport); renderer.state.scissor(scissor); renderer.state.setScissorTest(scissorTest);
      }
    },
    getShaderWarmupCases() { return [...warmupMaterials.keys()]; },
    compileShaderWarmupCase,
    compileShaderWarmupScene,
    warmupShadowMapScene,
    verifyShaderWarmupPrograms,
    getShaderWarmupDepthPairs(roots) { return sceneDepth.getShaderWarmupPairs(roots); },
    getStats() { return { hdr: true, bloom: quality === 'high', quality, passes: (quality === 'high' ? 5 : 2) + sceneDepth.getStats().passes, width, height, depth: sceneDepth.getStats(), disposed }; },
    dispose() { if (disposed) return; disposed = true; sceneDepth.dispose(); sceneTarget.dispose(); bloomTargets.forEach(target => target.dispose());
      [extract, blur, composite].forEach(mat => mat.dispose()); quad.geometry.dispose(); },
  };
}
