import {THREE,v} from './brute-motion-review-v6-utils.mjs';
function triangles(mesh,ids){const selected=ids&&new Set(ids),list=[];for(let i=0;i<mesh.indices.length;i+=3){const ii=mesh.indices.slice(i,i+3);if(selected&&!ii.some(j=>selected.has(j)))continue;const p=ii.map(j=>mesh.points[j]),tri=new THREE.Triangle(...p);list.push({tri,points:p,indices:ii,index:i/3,box:new THREE.Box3().setFromPoints(p)});}return list;}
function tree(ts){const box=new THREE.Box3();ts.forEach(t=>box.union(t.box));if(ts.length<=8)return {box,ts,count:ts.length};const s=box.getSize(v()),axis=s.x>=s.y&&s.x>=s.z?'x':s.y>=s.z?'y':'z';ts.sort((a,b)=>(a.box.min[axis]+a.box.max[axis])-(b.box.min[axis]+b.box.max[axis]));const m=ts.length>>1;return {box,count:ts.length,left:tree(ts.slice(0,m)),right:tree(ts.slice(m))};}
function gap2(a,b){let d=0;for(const k of ['x','y','z'])d+=Math.max(0,a.min[k]-b.max[k],b.min[k]-a.max[k])**2;return d;}
function segment(a,b,c,d){const u=b.clone().sub(a),w=d.clone().sub(c),r=a.clone().sub(c),A=u.dot(u),E=w.dot(w),F=w.dot(r);let s=0,t=0;if(A<1e-15&&E<1e-15)return [a,c];if(A<1e-15)t=THREE.MathUtils.clamp(F/E,0,1);else{const C=u.dot(r);if(E<1e-15)s=THREE.MathUtils.clamp(-C/A,0,1);else{const B=u.dot(w),den=A*E-B*B;s=den>1e-15?THREE.MathUtils.clamp((B*F-C*E)/den,0,1):0;t=(B*s+F)/E;if(t<0){t=0;s=THREE.MathUtils.clamp(-C/A,0,1);}else if(t>1){t=1;s=THREE.MathUtils.clamp((B-C)/A,0,1);}}}return [a.clone().addScaledVector(u,s),c.clone().addScaledVector(w,t)];}
function triDistance(a,b,best){
 function accept(p,q){const d=p.distanceToSquared(q);if(d<best.d){best.d=d;best.a=p.clone();best.b=q.clone();best.ta=a.index;best.tb=b.index;}}
 for(const p of a.points)accept(p,b.tri.closestPointToPoint(p,v()));for(const p of b.points)accept(a.tri.closestPointToPoint(p,v()),p);
 for(let i=0;i<3;i++)for(let j=0;j<3;j++){const[p,q]=segment(a.points[i],a.points[(i+1)%3],b.points[j],b.points[(j+1)%3]);accept(p,q);}
 for(const [first,other,flip]of [[a,b,false],[b,a,true]])for(let i=0;i<3;i++){const p=first.points[i],delta=first.points[(i+1)%3].clone().sub(p),length=delta.length();if(length<1e-12)continue;const hit=new THREE.Ray(p,delta.divideScalar(length)).intersectTriangle(...other.points,false,v());if(hit&&hit.distanceTo(p)<=length+1e-10)accept(hit,hit);}
}
function nearest(A,B){const best={d:Infinity};function visit(a,b){if(gap2(a.box,b.box)>=best.d)return;if(a.ts&&b.ts){for(const ta of a.ts)for(const tb of b.ts)if(gap2(ta.box,tb.box)<best.d)triDistance(ta,tb,best);return;}const pairs=(!a.ts&&(b.ts||a.count>b.count))?[[a.left,b],[a.right,b]]:[[a,b.left],[a,b.right]];pairs.sort((x,y)=>gap2(x[0].box,x[1].box)-gap2(y[0].box,y[1].box));for(const [x,y]of pairs)visit(x,y);}visit(A,B);return {gap:Math.sqrt(best.d),brutePoint:best.a.toArray(),targetPoint:best.b.toArray(),bruteTriangle:best.ta,targetTriangle:best.tb};}

// Proper non-coplanar crossings only. Shared rest-position edges/vertices are excluded.
// This is a bounded deforming-mesh diagnostic, not a watertight self-collision proof.
function crossings(A,B,restPoints){
 const hits=[],seen=new Set();
 function proper(a,b){
  if(a.index===b.index)return false;
  const key=[a.index,b.index].sort((x,y)=>x-y).join(':');if(seen.has(key))return false;seen.add(key);
  if(restPoints&&a.indices.some(i=>b.indices.some(j=>restPoints[i].distanceToSquared(restPoints[j])<1e-10)))return false;
  for(const [s,t]of [[a,b],[b,a]]){
   const normal=t.tri.getNormal(v());if(normal.lengthSq()<.5)continue;
   for(let i=0;i<3;i++){
    const p=s.points[i],end=s.points[(i+1)%3],d0=normal.dot(p.clone().sub(t.points[0])),d1=normal.dot(end.clone().sub(t.points[0]));
    if(d0*d1>=-1e-12)continue;
    const delta=end.clone().sub(p),len=delta.length(),hit=new THREE.Ray(p,delta.divideScalar(len)).intersectTriangle(...t.points,false,v());
    if(hit&&hit.distanceTo(p)>1e-6&&hit.distanceTo(p)<len-1e-6)return true;
   }
  }return false;
 }
 function visit(a,b){if(!a.box.intersectsBox(b.box))return;if(a.ts&&b.ts){for(const x of a.ts)for(const y of b.ts)if(x.box.intersectsBox(y.box)&&proper(x,y))hits.push([x.index,y.index]);return;}
  const pairs=(!a.ts&&(b.ts||a.count>b.count))?[[a.left,b],[a.right,b]]:[[a,b.left],[a,b.right]];for(const [x,y]of pairs)visit(x,y);
 }visit(A,B);return hits;
}
export {triangles,tree,nearest,triDistance,crossings};
