import { createSceneDepthPass } from './scene-depth.js';

// HDR scene -> half-resolution bloom -> restrained filmic composite.
// All resources are reused and resized only when the drawing buffer changes.
export function createCinematicPipeline({ THREE, renderer, adaptDepthMaterial }) {
  const size = new THREE.Vector2();
  const sceneDepth = createSceneDepthPass({ THREE, renderer, adaptDepthMaterial });
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
    getStats() { return { hdr: true, bloom: quality === 'high', quality, passes: (quality === 'high' ? 5 : 2) + sceneDepth.getStats().passes, width, height, depth: sceneDepth.getStats(), disposed }; },
    dispose() { if (disposed) return; disposed = true; sceneDepth.dispose(); sceneTarget.dispose(); bloomTargets.forEach(target => target.dispose());
      [extract, blur, composite].forEach(mat => mat.dispose()); quad.geometry.dispose(); },
  };
}
