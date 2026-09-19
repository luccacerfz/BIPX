import fs from 'node:fs';
import {loadBody} from './brute-motion-review-v8-body.mjs';
import {tree,triangles,crossings} from './brute-motion-review-v8-geometry.mjs';
const out=`output/brute-motion-v8/${process.argv[2]||'candidate-02'}`,clips=JSON.parse(fs.readFileSync(`${out}/clips.json`)).results;
const reference=await loadBody(clips[0].sourceV7),geo=reference.body.geometry,pos=geo.attributes.position,parent=Array.from({length:pos.count},(_,i)=>i),map=new Map();
const find=x=>parent[x]===x?x:(parent[x]=find(parent[x])),join=(a,b)=>{parent[find(a)]=find(b);};
for(let i=0;i<pos.count;i++){const key=[pos.getX(i),pos.getY(i),pos.getZ(i)].map(x=>Math.round(x*1e6)).join(':');if(map.has(key))join(i,map.get(key));else map.set(key,i);}
for(let i=0;i<geo.index.count;i+=3){join(geo.index.array[i],geo.index.array[i+1]);join(geo.index.array[i],geo.index.array[i+2]);}
const component=Array.from({length:geo.index.count/3},(_,i)=>find(geo.index.array[3*i]));const componentPair=pair=>pair.map(i=>component[i]).sort((a,b)=>a-b).join(':');
const results=[];
for(const c of clips){const B=await loadBody(c.sourceV7),d=JSON.parse(fs.readFileSync(`${out}/${c.name}-cpu.json`));B.seek(0);const rest=B.points();const rows=[];
 for(const r of d.frames.filter(r=>r.fullSelf)){B.seek(r.t);const T=tree(triangles({points:B.points(),indices:B.indices})),before=crossings(T,T,rest),existing=new Set(before.map(componentPair));
 const addedByComponent={};for(const pair of r.fullSelf.added){const key=componentPair(pair);(addedByComponent[key]??=[]).push(pair);}
 rows.push({t:r.t,addedByComponent,entirelyNewComponents:Object.keys(addedByComponent).filter(k=>!existing.has(k))});}
 results.push({name:c.name,rows});console.log(JSON.stringify({name:c.name,newComponentPairs:[...new Set(rows.flatMap(r=>r.entirelyNewComponents))],componentsInAdded:[...new Set(rows.flatMap(r=>Object.keys(r.addedByComponent)))]}));}
fs.writeFileSync(`${out}/self-components.json`,JSON.stringify({scope:'Welded source topology labels only; does not excuse new triangle pairs or prove deformation acceptable',componentCount:new Set(component).size,componentPerTriangle:component,results},null,2)+'\n');
