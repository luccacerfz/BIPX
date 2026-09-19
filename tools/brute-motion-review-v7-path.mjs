// STAGING ONLY. Authored right-wrist paths in right/up/forward metres.
// No damage, actor transform, range, timing marker or runtime imports.
export const DURATION=1.45;
export const ARM_TRACKS=['R_Upperarm.quaternion','R_Forearm.quaternion','R_Hand.quaternion'];
export function derivative(fn,t,h=1e-5){return fn(t+h).map((x,i)=>(x-fn(t-h)[i])/(2*h));}
export function hermite(a,b,t){
 const dt=b.t-a.t,u=Math.max(0,Math.min(1,(t-a.t)/dt));
 return a.p.map((x,i)=>(2*u**3-3*u*u+1)*x+(u**3-2*u*u+u)*dt*a.v[i]+(-2*u**3+3*u*u)*b.p[i]+(u**3-u*u)*dt*b.v[i]);
}
export function makeEncounterPath(base,endpoint,surfaceNormal=[0,1,-1],approachLift=0){
 const len=Math.hypot(...surfaceNormal),n=surfaceNormal.map(x=>x/len);
 const keys=[
  {t:.50,p:base(.50),v:derivative(base,.50)},
  {t:.70,p:endpoint.slice(),v:[0,0,0]},
  // Up/back escape before the outward recovery avoids folding across the chest.
  {t:.76,p:[endpoint[0]+Math.max(0,n[0])*.04,endpoint[1]+.07+Math.abs(n[1])*.03,endpoint[2]-.07-Math.abs(n[2])*.025],v:[.2,1.1,-1]},
  {t:.84,p:[endpoint[0]+.26,endpoint[1]+.23,endpoint[2]-.18],v:[1.3,1.2,-1.3]},
  {t:1.05,p:base(1.05),v:derivative(base,1.05)}
 ];
 return t=>{if(t<=.50||t>=1.05)return base(t);const i=keys.findIndex(k=>k.t>=t),p=hermite(keys[i-1],keys[i],t);if(t>.60&&t<.70)p[1]+=approachLift*Math.sin(Math.PI*(t-.60)/.10)**2;return p;};
}
// C1 position/velocity at interruption, then rejoins the unchanged recovery.
// Visual withdrawal cannot undo a collision already present at the switch.
export function makeWithdrawalPath(incoming,base,cancelAt){
 if(!(cancelAt>=.50&&cancelAt<=.70))throw Error('Authored withdrawal window is .50..70 s');
 const p=incoming(cancelAt),v=derivative(incoming,cancelAt),turn=cancelAt+.16;
 const keys=[{t:cancelAt,p,v},
  {t:turn,p:[.95,2.60,p[2]-.22],v:[.5,.1,-.5]},
  {t:1.05,p:base(1.05),v:derivative(base,1.05)}];
 return t=>{if(t<=cancelAt)return incoming(t);if(t>=1.05)return base(t);const i=keys.findIndex(k=>k.t>=t);return hermite(keys[i-1],keys[i],t);};
}
