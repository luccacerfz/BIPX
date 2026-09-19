/**
 * HandCast / Linear shader adaptations; exact pins and paths in
 * docs/vfx-elemental-integration.md. MIT, copyright 2026 mohamedachrefelouafi.
 * See ELEMENTAL-LICENSE.txt. No scene textures, extra render passes or lights.
 */
import { latticeGLSL, etchGLSL } from './elemental-source-glsl.js';

const common = /* glsl */ `
#define TAU 6.28318530718
float hash11(float p) { p=fract(p*.1031); p*=p+33.33; p*=p+p; return fract(p); }
vec2 hash21(float p) { vec3 p3=fract(vec3(p)*vec3(.1031,.1030,.0973)); p3+=dot(p3,p3.yzx+33.33); return fract((p3.xx+p3.yz)*p3.zy); }
float noise2(vec2 p) {
  vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
  float n=dot(i,vec2(7.13,113.17));
  return mix(mix(hash11(n),hash11(n+7.13),f.x),mix(hash11(n+113.17),hash11(n+120.30),f.x),f.y);
}
vec3 turnQ(vec3 v, vec4 q) { return v+2.*cross(q.xyz,cross(q.xyz,v)+q.w*v); }
mat2 rot2(float a) { return mat2(cos(a),sin(a),-sin(a),cos(a)); }
`;

export const crystalVertex = /* glsl */ `
${common}
uniform float uTime;
uniform float uMotion;
attribute vec3 aOrigin;
attribute vec3 aVelocity;
attribute vec4 aParams;
attribute vec4 aLook;
attribute vec4 aQuaternion;
attribute vec3 aBary;
attribute float aAxis;
attribute float aFace;
attribute vec3 aPivot;
varying vec3 vBary;
varying vec3 vNormal;
varying vec3 vWorld;
varying float vAxis;
varying float vFade;
varying float vHeat;
void main() {
  float age=uTime-aParams.x, t=clamp(age/max(aParams.y,.001),0.,1.);
  float alive=step(0.,age)*step(age,aParams.y)*step(.001,aParams.y);
  float shatter=aLook.y*smoothstep(.08,.85,t);
  vec3 scale=vec3(aParams.z,aParams.w,aParams.w);
  vec3 p=(position-vec3(.5,0.,0.))*scale;
  vec3 pivot=(aPivot-vec3(.5,0.,0.))*scale;
  vec3 normalLocal=normalize(normal/max(scale,vec3(.001)));
  // HandCast's rigid face pivots keep fragments triangular while separating.
  float seed=aFace*2.31+aLook.x;
  vec3 axis=normalize(vec3(hash21(seed),hash11(seed+9.3))*2.-1.+vec3(.0001));
  float angle=shatter*(hash11(seed+1.7)+.4)*6.28*uMotion;
  p=pivot+(p-pivot)*cos(angle)+cross(axis,p-pivot)*sin(angle)+axis*dot(axis,p-pivot)*(1.-cos(angle));
  normalLocal=normalLocal*cos(angle)+cross(axis,normalLocal)*sin(angle)+axis*dot(axis,normalLocal)*(1.-cos(angle));
  p=mix(p,pivot,shatter*.8);
  p+=normalize(normal+axis*.45)*shatter*aParams.z*.55*uMotion;
  p=turnQ(p,aQuaternion);
  float fall=age*age*2.8*uMotion;
  vec3 world=aOrigin+p+aVelocity*age*uMotion-vec3(0.,fall,0.);
  vWorld=world; vBary=aBary; vAxis=aAxis;
  vNormal=turnQ(normalLocal,aQuaternion);
  vFade=alive*(1.-smoothstep(.5,1.,t))*smoothstep(aLook.z-.08,aLook.z+.12,world.y);
  vHeat=shatter;
  gl_Position=projectionMatrix*viewMatrix*vec4(world,1.);
}
`;
export const crystalFragment = /* glsl */ `
varying vec3 vBary;
varying vec3 vNormal;
varying vec3 vWorld;
varying float vAxis;
varying float vFade;
varying float vHeat;
void main() {
  if(vFade<.012) discard;
  vec3 N=normalize(vNormal)*(gl_FrontFacing?1.:-1.);
  vec3 V=normalize(cameraPosition-vWorld);
  vec3 cameraUp=vec3(viewMatrix[0][1],viewMatrix[1][1],viewMatrix[2][1]);
  vec3 cameraRight=vec3(viewMatrix[0][0],viewMatrix[1][0],viewMatrix[2][0]);
  vec3 L=normalize(-cameraRight*.55+cameraUp*.72+V*.4);
  float ndv=clamp(abs(dot(N,V)),0.,1.);
  float rim=.02+.98*pow(1.-ndv,3.);
  float edge=min(min(vBary.x,vBary.y),vBary.z);
  edge=1.-smoothstep(0.,max(fwidth(edge),.0001)*.75,edge);
  float thick=pow(max(sin(clamp(vAxis,0.,1.)*3.14159),0.),.7);
  float lit=.5+.5*dot(N,L);
  vec3 deep=vec3(.025,.15,.28), ice=vec3(.22,.61,.78), frost=vec3(.68,.91,1.);
  vec3 col=mix(deep,ice,.25+lit*.7);
  col=mix(col,frost,(1.-thick)*.24);
  col+=frost*edge*.20+vec3(.17,.53,.7)*rim*.65;
  col+=frost*pow(max(dot(N,normalize(L+V)),0.),60.)*.7;
  col+=frost*vHeat*.17;
  gl_FragColor=vec4(col,vFade*.92);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

export const surfaceVertex = /* glsl */ `
uniform float uTime;
uniform float uMotion;
attribute vec3 aOrigin;
attribute vec4 aParams;
attribute vec4 aLook;
attribute vec3 aColor;
varying vec2 vLocal;
varying vec3 vWorld;
varying vec4 vState;
varying vec4 vLook;
varying vec3 vColor;
void main() {
  float age=max(0.,uTime-aParams.x);
  float t=clamp(age/max(.001,aParams.y),0.,1.);
  float alive=step(uTime,aParams.x+aParams.y)*step(.001,aParams.y);
  float grow=mix(1.,.45+.55*smoothstep(0.,.2,t),uMotion);
  if(aLook.x>3.5) grow=1.; // Nova reach is gameplay supplied, not an accessibility setting.
  vec2 p=position.xy*aParams.z*grow;
  vec3 world=aOrigin+vec3(p.x,0.,p.y);
  vec4 view=viewMatrix*vec4(aOrigin,1.);
  if(aLook.y>.5) { view.xy+=p; world=aOrigin; }
  vLocal=position.xy;
  vWorld=world;
  vState=vec4(age,t,alive,aParams.z);
  vLook=aLook; vColor=aColor;
  gl_Position=projectionMatrix*(aLook.y>.5?view:viewMatrix*vec4(world,1.));
}
`;

export const surfaceFragment = /* glsl */ `
${common}
${latticeGLSL}
${etchGLSL}
uniform float uTime;
uniform float uMotion;
varying vec2 vLocal;
varying vec3 vWorld;
varying vec4 vState;
varying vec4 vLook;
varying vec3 vColor;
void main() {
  float r=length(vLocal);
  if(r>1. || vState.z<.5) discard;
  float age=vState.x, t=vState.y;
  float fade=(1.-smoothstep(.25,1.,t))*vLook.w;
  float seed=vLook.z;
  vec3 color=vec3(0.); float alpha=0.;
  if(vLook.x<.5) {
    // Exact HandCast sixfold fold, spar, branching dendrites and hex plate.
    float d=snowflakeSDF(vLocal*1.08,seed);
    float edge=max(fwidth(d)*1.2,.012);
    float flake=1.-smoothstep(-edge,edge,d);
    float halo=exp(-r*r*5.)*.13;
    color=mix(vec3(.10,.37,.55),vec3(.60,.91,1.),flake);
    alpha=(flake*.52+halo)*fade;
  } else if(vLook.x<1.5) {
    // Linear's photon ring with energy-preserving antialiasing and sheared halo.
    float R=r*3.6, px=max(fwidth(R),.003);
    float shadow=1.-smoothstep(1.-px,1.+px,R);
    float width=max(.055,px*1.1);
    float d=(R-1.-width*.65)/width;
    float ring=exp(-d*d*2.2)*(.055/width);
    float d2=(R-1.-width*3.4)/(width*1.6);
    ring+=exp(-d2*d2*2.)*.16*(.055/width);
    float ang=atan(vLocal.y,vLocal.x), beam=1.+.52*cos(ang-seed);
    float turn=age*uMotion*2.2+2.6/(.25+R*.85);
    vec2 wound=rot2(turn)*vLocal;
    float filaments=pow(1.-abs(noise2(wound*8.+seed)-.5)*2.,3.);
    float halo=exp(-max(0.,R-1.)*1.9)*smoothstep(1.-px,1.+px*2.,R)*(.25+filaments*.75);
    color=(mix(vColor,vec3(.73,.54,.95),.35)*ring*3.2+vColor*halo*1.3)*beam;
    color*=1.-shadow;
    alpha=clamp(shadow*.85+ring*.8+halo*.45,0.,.92)*fade;
  } else if(vLook.x<2.5) {
    // Linear AcidPool true nearest-bisector network. Physical size is preserved.
    vec2 p=vLocal*vState.w;
    float boundary=.79+noise2(normalize(vLocal+vec2(.0001))*3.+seed)*.16;
    float mask=1.-smoothstep(boundary-.035,boundary+.015,r);
    if(mask<.01) discard;
    vec2 plate=voronoiEtch(p*2.4+seed);
    float seam=1.-smoothstep(.0,.045,plate.x);
    float lip=1.-smoothstep(.03,.12,plate.x);
    float detail=1.-smoothstep(.03,.18,max(fwidth(p.x),fwidth(p.y)));
    vec2 boil=surfaceBoil(p,2.1,1.4,seed,age*uMotion)*detail;
    float wet=clamp(seam+boil.x*.8,0.,1.);
    vec3 crust=mix(vec3(.027,.021,.035),vColor*.12,plate.y);
    color=mix(crust,vColor*(.55+noise2(p+age*.25)*.35),wet);
    color+=vColor*lip*.12+vec3(.9,.55,.42)*boil.x*.19;
    color*=1.-boil.y*.35;
    alpha=(.52+wet*.3)*mask*fade;
    if(vLook.y>.5) {
      // Same etched cell boundaries/bubble rims, without opaque floor coverage.
      // The hollow center preserves the actor; short outward motion reads as splash.
      float hollow=smoothstep(.10,.29,r);
      float rim=1.-smoothstep(.045,.11,abs(r-(.32+t*.34)));
      float broken=step(.22,noise2(vLocal*6.+seed));
      float spray=(seam*.55+boil.x*.8+rim*broken*.65)*hollow;
      color=mix(vColor,vec3(.95,.47,.22),clamp(boil.x+rim*.4,0.,.55))*(.9+seam*.65);
      alpha=clamp(spray,0.,.82)*mask*fade;
    }
  } else if(vLook.x<3.5) {
    // BIPX arcane contact: Linear photon-ring AA, with an open central aperture.
    float px=max(fwidth(r)*1.4,.009);
    float angle=atan(vLocal.y,vLocal.x)+seed+age*uMotion*.7;
    float ring=1.-smoothstep(px,px*2.7,abs(r-(.48+t*.15)));
    float outer=1.-smoothstep(px,px*2.,abs(r-.81));
    float gaps=smoothstep(.16,.32,abs(sin(angle*3.)));
    float runes=pow(max(cos(angle*6.),0.),24.)*(1.-smoothstep(.045,.09,abs(r-.73)));
    float aperture=smoothstep(.26,.35,r);
    color=mix(vColor,vec3(.53,.91,1.),ring*.65)*(1.+ring*.35);
    alpha=(ring*.75+outer*gaps*.38+runes*.65)*aperture*fade;
  } else if(vLook.x<4.5) {
    // Thin final boundary never scales down; the internal wave stops inside it.
    float px=max(fwidth(r)*1.2,.008);
    float boundary=1.-smoothstep(px,px*2.,abs(r-.96));
    float front=mix(.91,.16+.76*(1.-pow(1.-t,3.)),uMotion);
    float wave=1.-smoothstep(.012,.044,abs(r-front));
    float d=snowflakeSDF(vLocal*1.08,seed);
    float flake=(1.-smoothstep(-px,px,d))*smoothstep(.28,.42,r);
    float passed=1.-smoothstep(front-.04,front+.02,r);
    color=mix(vColor,vec3(.71,.96,1.),wave*.6);
    alpha=(boundary*.5+wave*.6+flake*passed*.22)*fade;
  } else {
    // A torn, hollow flame crown: coloured absorption preserves orange at exposure,
    // while the existing Samurai particle pool supplies embers/blackbody cooling.
    vec2 flow=vLocal*vec2(4.,5.)-vec2(0.,age*5.*uMotion)+seed;
    float turbulence=noise2(flow)*.64+noise2(flow*2.1)*.36;
    float angle=atan(vLocal.y,vLocal.x);
    float reach=.60+sin(angle*7.+seed)*.04+(turbulence-.5)*.22;
    float dist=abs(r-reach);
    float flame=1.-smoothstep(.025,.12,dist);
    float tips=(1.-smoothstep(.04,.20,dist))*.5;
    float broken=smoothstep(.18,.52,turbulence);
    float hollow=smoothstep(.30,.43,r);
    float heat=clamp(flame*.85+(1.-t)*.16,0.,1.);
    color=mix(vec3(.52,.035,.004),vec3(1.9,.34,.018),heat);
    color=mix(color,vec3(2.4,1.3,.36),pow(heat,4.)*.6);
    alpha=(flame*.88+tips*.45)*broken*hollow*fade;
  }
  if(alpha<.004) discard;
  gl_FragColor=vec4(color,alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

export const ribbonVertex = /* glsl */ `
${common}
uniform float uTime;
uniform float uMotion;
attribute vec3 aOrigin;
attribute vec3 aEnd;
attribute vec4 aParams;
attribute vec4 aLook;
attribute vec3 aColor;
varying vec2 vStrip;
varying vec3 vColor;
varying float vFade;
vec3 pathAt(float t, vec3 D, vec3 S, vec3 U, float len, float age) {
  float profile=sin(pow(clamp(t,0.,1.),.65)*3.14159);
  float angle=aLook.x+t*aLook.y*TAU-age*2.5*uMotion;
  vec3 p=mix(aOrigin,aEnd,t);
  p+=(S*cos(angle)+U*sin(angle))*profile*aParams.w*uMotion;
  p+=S*(noise2(vec2(t*2.2,age)+aLook.x)-.5)*profile*.10*uMotion;
  return p;
}
void main() {
  float age=max(0.,uTime-aParams.x);
  float life=clamp(age/max(aParams.y,.001),0.,1.);
  float alive=step(uTime,aParams.x+aParams.y)*step(.001,aParams.y);
  vec3 delta=aEnd-aOrigin;
  float len=max(length(delta),.001); vec3 D=delta/len;
  vec3 S=normalize(cross(D,vec3(.001,1.,.003)));
  vec3 U=normalize(cross(S,D));
  float t=position.x;
  vec3 p=pathAt(t,D,S,U,len,age);
  vec3 tangent=pathAt(min(t+.015,1.),D,S,U,len,age)-pathAt(max(t-.015,0.),D,S,U,len,age);
  vec3 eye=normalize(cameraPosition-p);
  vec3 side=cross(normalize(tangent+vec3(.00001)),eye);
  if(dot(side,side)<.00001) side=S;
  side=normalize(side);
  float taper=smoothstep(0.,.08,t)*(1.-smoothstep(.78,1.,t));
  float fade=(1.-life)*alive;
  p+=side*position.y*aParams.z*taper*(.7+.3*fade);
  vStrip=vec2(t,position.y); vColor=aColor; vFade=fade*aLook.z;
  gl_Position=projectionMatrix*viewMatrix*vec4(p,1.);
}
`;
export const ribbonFragment = /* glsl */ `
varying vec2 vStrip;
varying vec3 vColor;
varying float vFade;
void main() {
  float across=clamp(1.-abs(vStrip.y),0.,1.);
  float body=pow(across,2.4), core=pow(across,14.);
  float energy=body*.65+core*.7;
  float alpha=energy*vFade*.60;
  if(alpha<.005) discard;
  vec3 color=mix(vColor,vec3(.76,.89,.94),core*.42)*energy;
  gl_FragColor=vec4(color,alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;
