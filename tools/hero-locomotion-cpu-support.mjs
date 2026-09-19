import fs from 'node:fs/promises';
import * as THREE from '../vendor/three/three.module.js';
export { THREE };
// Geometry and animations are parsed unmodified. Only image references are
// stripped from the in-memory fetch response so CPU QA needs no DOM/canvas.
const nativeFetch = globalThis.fetch;
globalThis.fetch = async url => {
  const location = new URL(url);
  if (location.protocol !== 'file:') return nativeFetch(url);
  let bytes = await fs.readFile(location);
  if (location.pathname.endsWith('.glb')) {
    const length = bytes.readUInt32LE(12);
    const json = JSON.parse(bytes.subarray(20, 20 + length));
    const bin = bytes.subarray(28 + length);
    for (const m of json.materials || []) {
      delete m.normalTexture; delete m.occlusionTexture; delete m.emissiveTexture;
      if (m.pbrMetallicRoughness) {
        delete m.pbrMetallicRoughness.baseColorTexture;
        delete m.pbrMetallicRoughness.metallicRoughnessTexture;
      }
    }
    delete json.images; delete json.textures; delete json.samplers;
    let text = Buffer.from(JSON.stringify(json));
    text = Buffer.concat([text, Buffer.alloc((-text.length) & 3, 32)]);
    const head = Buffer.alloc(20);
    head.writeUInt32LE(0x46546c67); head.writeUInt32LE(2, 4);
    head.writeUInt32LE(28 + text.length + bin.length, 8);
    head.writeUInt32LE(text.length, 12); head.writeUInt32LE(0x4e4f534a, 16);
    const bh = Buffer.alloc(8); bh.writeUInt32LE(bin.length); bh.writeUInt32LE(0x004e4942, 4);
    bytes = Buffer.concat([head, text, bh, bin]);
  }
  return new Response(bytes, { status: 200, headers: { 'Content-Length': String(bytes.length) } });
};
globalThis.ProgressEvent ??= class ProgressEvent extends Event {
  constructor(type, options = {}) { super(type); Object.assign(this, options); }
};
export const quantile = (values, q) => values.length ? [...values].sort((a, b) => a - b)[Math.floor((values.length - 1) * q)] : null;
export function bonesOf(model) {
  let bones;
  model.traverse(o => { if (o.isSkinnedMesh && !bones) bones = o.skeleton.bones; });
  return Object.fromEntries(bones.map(b => [b.name.replace(/^mixamorig:?/, ''), b]));
}
