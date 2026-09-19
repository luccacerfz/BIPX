import fs from 'node:fs/promises';
import { GLTFLoader } from '../src/assets/vendor/GLTFLoader.js';
export function unpack(bytes) {
  const length=bytes.readUInt32LE(12);
  return { json:JSON.parse(bytes.subarray(20,20+length)), bin:bytes.subarray(28+length,28+length+bytes.readUInt32LE(20+length)) };
}
export function pack(json,bin) {
  let text=Buffer.from(JSON.stringify(json));text=Buffer.concat([text,Buffer.alloc((-text.length)&3,32)]);bin=Buffer.concat([bin,Buffer.alloc((-bin.length)&3)]);
  const head=Buffer.alloc(20);head.writeUInt32LE(0x46546c67);head.writeUInt32LE(2,4);head.writeUInt32LE(28+text.length+bin.length,8);head.writeUInt32LE(text.length,12);head.writeUInt32LE(0x4e4f534a,16);
  const bh=Buffer.alloc(8);bh.writeUInt32LE(bin.length);bh.writeUInt32LE(0x004e4942,4);return Buffer.concat([head,text,bh,bin]);
}
export function withoutTextures(bytes) {
  const {json,bin}=unpack(bytes);
  for(const m of json.materials||[]){delete m.normalTexture;delete m.occlusionTexture;delete m.emissiveTexture;if(m.pbrMetallicRoughness){delete m.pbrMetallicRoughness.baseColorTexture;delete m.pbrMetallicRoughness.metallicRoughnessTexture;}}
  delete json.images;delete json.textures;delete json.samplers;return pack(json,bin);
}
export async function loadCPU(file) {const bytes=withoutTextures(await fs.readFile(file));return new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');}
export function installCPUFetch() {
  const native=globalThis.fetch;
  globalThis.fetch=async url=>{const location=new URL(url);if(location.protocol!=='file:')return native(url);let bytes=await fs.readFile(location);if(location.pathname.endsWith('.glb'))bytes=withoutTextures(bytes);return new Response(bytes,{status:200,headers:{'Content-Length':String(bytes.length)}});};
  globalThis.ProgressEvent??=class ProgressEvent extends Event{constructor(type,options={}){super(type);Object.assign(this,options);}};
}
