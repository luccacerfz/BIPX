import fs from 'node:fs';
import crypto from 'node:crypto';
export async function attachAllocationTrace(page) {
 const source=fs.readFileSync('vendor/three/three.module.js','utf8');
 const hook=(kind,delta,value,owner='null')=>` globalThis.__gpuAllocationTrace?.('${kind}',${delta},${value},${owner});`;
 const replacements=[
  ['info.memory.geometries --;',hook('geometry',-1,'geometry')],
  ['info.memory.geometries ++;',hook('geometry',1,'geometry','object')],
 ];
 let instrumented=source;
 for(const [needle,append]of replacements){if(instrumented.split(needle).length!==2)throw Error('Geometry trace anchor changed');instrumented=instrumented.replace(needle,needle+append)}
 let plus=0,minus=0;
 instrumented=instrumented.replace(/info\.memory\.textures \+\+;/g,needle=>needle+hook('texture',1,++plus===3?'textures[i]':'texture'));
 instrumented=instrumented.replace(/info\.memory\.textures --;/g,needle=>needle+hook('texture',-1,++minus===2?'textures[i]':'texture'));
 if(plus!==3||minus!==2)throw Error('Texture trace anchors changed');
 await page.addInitScript(()=>{
  const events=[],live={geometry:new Map(),texture:new Map()};
  window.__gpuAllocationPhase='loading';
  window.__gpuAllocationTrace=(kind,delta,value,owner)=>{
   const names=[];for(let p=owner;p;p=p.parent)names.push(p.name||p.type);
   const row={kind,delta,uuid:value.uuid,type:value.type||value.constructor.name,name:value.name,owner:names.join('/'),phase:window.__gpuAllocationPhase,at:performance.now(),attributes:value.attributes?Object.keys(value.attributes):undefined,image:value.image?{width:value.image.width,height:value.image.height}:undefined};
   events.push(row);if(delta>0)live[kind].set(value.uuid,row);else live[kind].delete(value.uuid);
  };
  window.__gpuAllocationSnapshot=()=>({phase:window.__gpuAllocationPhase,events:[...events],geometries:[...live.geometry.values()],textures:[...live.texture.values()]});
 });
 await page.route('**/vendor/three/three.module.js',r=>r.fulfill({status:200,contentType:'text/javascript',body:instrumented}));
 const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
 return {scope:'Read-only instrumentation at all Three GPU geometry/texture memory increments/decrements. Same renderer allocation/disposal statements; no product files changed.',sourceSha256:hash(source),servedSha256:hash(instrumented),anchors:{geometryAdd:1,geometryRemove:1,textureAdd:plus,textureRemove:minus}};
}
