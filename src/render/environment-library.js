import { loadGlb } from '../assets/load-glb.js';

const names = ['blue-shrine', 'barrel', 'rose-bush', 'border-rock', 'root-border', 'mushrooms', 'crypt-door', 'timber-beam', 'crypt-root-arch', 'crypt-flagstone'];
let pending;
/** Browser derivatives stay separate from the animation team's character library. */
export async function loadCemeteryLibrary({ THREE }) {
  pending ??= Promise.all(names.map(async name => [name, (await loadGlb(new URL(`../../assets/environment/${['crypt-root-arch','crypt-flagstone'].includes(name)?'crypt-entrance-v1':'cemetery-v1'}/${name}.glb`, import.meta.url).href)).scene]))
    .then(Object.fromEntries).catch(error => { pending = null; throw error; });
  const prototypes = await pending, variants = new Map();
  return {
    names,
    instantiate(name, { width = 1, tint = 0xffffff, saturation = .72, maxHeight } = {}) {
      const model = prototypes[name].clone(true), root = new THREE.Group();
      const box = new THREE.Box3().setFromObject(model), size = box.getSize(new THREE.Vector3());
      model.position.sub(box.getCenter(new THREE.Vector3()));
      model.position.y += size.y / 2;
      root.add(model); root.name = name;
      root.scale.setScalar(width / Math.max(size.x, size.z, .001));
      if (maxHeight) root.scale.y = Math.min(root.scale.y, maxHeight / Math.max(size.y, .001));
      model.traverse(object => {
        if (!object.isMesh) return;
        object.castShadow = true; object.receiveShadow = true;
        const variant = material => {
          const key = material.uuid + ':' + tint + ':' + saturation;
          if (!variants.has(key)) {
            const result = material.clone(); result.color.multiply(new THREE.Color(tint));
            // Weather the source palette in the material; keep original texture pixels intact.
            result.onBeforeCompile = shader => {
              shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
                diffuseColor.rgb = mix(vec3(dot(diffuseColor.rgb, vec3(.2126, .7152, .0722))), diffuseColor.rgb, ${Number(saturation).toFixed(3)});`);
            };
            result.customProgramCacheKey = () => `cemetery-weathered-${saturation}`;
            if (result.map) result.map.anisotropy = 4;
            variants.set(key, result);
          }
          return variants.get(key);
        };
        object.material = Array.isArray(object.material) ? object.material.map(variant) : variant(object.material);
      });
      return root;
    },
  };
}
