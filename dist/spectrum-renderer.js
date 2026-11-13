import { cloudTracerViewportScale, cloudTracerGLSL, sliceSamplingGLSL, sliceRandomSeeds, bindSliceSampling, clearSliceSampling, advanceCameraTour, sliceColorBounds, sliceParticleSamples, planeCutNormal, cutDegrees, startingViewOrientation, orbitalColorBounds, colorMetricIndex, colorMetrics, metricGLSL, bindColorMapTexture, colorMapGLSL, colorMapIndex, orbitalDisplayReference, orbitalExtent } from './renderer.js';
/** Two-state hydrogen renderer. Optical-cycle-averaged densities share one scale.
 * Phase color and tracers display the individual components, not a phase or
 * electron trajectory assigned to the mixed density. All distances are in a0.
 */
const spectrumVertex=`#version 300 es
in vec2 aPosition;out vec2 vUv;void main(){vUv=aPosition*.5+.5;gl_Position=vec4(aPosition,0.,1.);}`;
const spectrumCommon=`
precision highp float;
precision highp int;
${colorMapGLSL}
uniform sampler2D uRadial;
uniform ivec2 uAngular,uMagnetic,uShells;
uniform vec2 uAngularNorm,uComponentScale;
uniform float uCloudScale;
uniform float uPopulation,uExposure,uTime,uExtent,uDensity,uCutAngle,uCutOffset;
uniform int uTableSize,uBasis,uMode,uCut;
uniform float uWedgePolar;
uniform vec3 uSliceNormal;
uniform float uCutDegrees,uSliceThickness,uSliceHeight,uRadiusLimit;
uniform vec3 uPlaneNormal;
uniform int uSliceAxis;
${metricGLSL}
uniform bool uSeparateColors;
float associatedLegendre(int l,int m,float x){
 float p=1.,root=sqrt(max(0.,1.-x*x));
 for(int j=1;j<=5;j++){if(j>m)break;p*=-float(2*j-1)*root;}
 if(l==m)return p;float q=float(2*m+1)*x*p;
 for(int j=2;j<=5;j++){int k=m+j;if(k>l)break;float v=(float(2*k-1)*x*q-float(k+m-1)*p)/float(k-m);p=q;q=v;}
 return q;
}
vec2 amplitudes(vec3 p){
 float r=length(p),c=r>1.e-7?clamp(p.z/r,-1.,1.):1.;
 float index=clamp(r,0.,1.)*float(uTableSize-1);int i=min(int(index),uTableSize-2);
 vec2 radial=mix(texelFetch(uRadial,ivec2(i,0),0).rg,texelFetch(uRadial,ivec2(i+1,0),0).rg,index-float(i));
 vec2 a=radial*vec2(associatedLegendre(uAngular.x,abs(uMagnetic.x),c),associatedLegendre(uAngular.y,abs(uMagnetic.y),c))*uAngularNorm;
 if(uBasis==1){float ph=atan(p.y,p.x);if(uMagnetic.x!=0)a.x*=1.41421356237*(uMagnetic.x>0?cos(float(uMagnetic.x)*ph):sin(float(-uMagnetic.x)*ph));if(uMagnetic.y!=0)a.y*=1.41421356237*(uMagnetic.y>0?cos(float(uMagnetic.y)*ph):sin(float(-uMagnetic.y)*ph));}
 return a;
}
float density(vec3 p){vec2 a=amplitudes(p);return mix(a.x*a.x,a.y*a.y,uPopulation)*uExposure;}
vec2 cloudComponents(vec3 p){
 vec2 a=amplitudes(p);
 vec2 fade=vec2(1.)-smoothstep(vec2(.82),vec2(1.),vec2(length(p))/uComponentScale);
 return a*a*fade*uExposure;
}
float cloudDensity(vec3 p){vec2 d=cloudComponents(p);return mix(d.x,d.y,uPopulation);}

bool clipped(vec3 p){
 if(uRadiusLimit>=0.)return dot(p,uPlaneNormal)>uRadiusLimit;
 if(uSliceAxis>0){float distance=dot(p,uSliceNormal);return abs(distance-uSliceHeight)>uSliceThickness;}
 if(uCutDegrees<=0.)return false;
 float ca=cos(uCutAngle),sa=sin(uCutAngle);vec2 q=vec2(ca*p.x+sa*p.y,(-sa*p.x+ca*p.y)*sin(uWedgePolar)+p.z*cos(uWedgePolar));
 return abs(atan(q.x,q.y))<uCutDegrees*.00872664626;
}
float flowMetric(vec3 p){
 vec2 a=amplitudes(p),w=a*a*vec2(1.-uPopulation,uPopulation);
 float m=dot(w,vec2(uMagnetic))/max(1.e-35,w.x+w.y);
 float v=uBasis==1?0.:abs(m)/max(1.e-6,length(p.xy)*uExtent);return v/(1.+v);
}
uniform float uPopulationRate;
float rawMixture(vec3 p){vec2 a=amplitudes(p);return mix(a.x*a.x,a.y*a.y,uPopulation);}
float extraMetric(vec3 p){
 vec2 a=amplitudes(p),rho=a*a,w=rho*vec2(1.-uPopulation,uPopulation);
 float total=w.x+w.y,rp=max(1.e-6,length(p.xy)*uExtent),j=uBasis==1?0.:dot(w,vec2(uMagnetic))/rp;
 if(uMode==7)return abs(j);
 if(uMode==8)return total>1.e-35?abs(j)/(total*rp):0.;
 if(uMode==9){float t=clamp(length(p),0.,1.)*float(uTableSize-1);int i=min(int(t),uTableSize-2);vec2 rad=mix(texelFetch(uRadial,ivec2(i,0),0).rg,texelFetch(uRadial,ivec2(i+1,0),0).rg,t-float(i));return dot(p,p)*uExtent*uExtent*mix(rad.x*rad.x,rad.y*rad.y,uPopulation);}
 if(uMode==10){float h=.002;return length(vec3(rawMixture(p+vec3(h,0,0))-rawMixture(p-vec3(h,0,0)),rawMixture(p+vec3(0,h,0))-rawMixture(p-vec3(0,h,0)),rawMixture(p+vec3(0,0,h))-rawMixture(p-vec3(0,0,h))))/(2.*h*uExtent);}
 if(uMode==11)return total>1.e-35?w.y/total:.5;
 if(uMode==12)return uPopulationRate*(rho.y-rho.x);
 return 0.;
}
vec3 densityColor(float d){
 d=colorScale(d);
 if(uColorMap>0)return mappedDensityColor(d);
 d=clamp(d,0.,1.);vec3 color=mix(vec3(.012,.045,.20),vec3(.07,.32,.76),smoothstep(.001,.09,d));
 color=mix(color,vec3(.48,.76,1.),pow(d,.44));return mix(color,vec3(.93,.98,1.),smoothstep(.5,1.,d));
}
// Component identity is constant; population controls count and extinction.
vec3 componentColor(int component){return component==0?vec3(.25,.55,1.):vec3(1.,.25,.60);}
vec3 rainbowColor(float t){return densityColor(t);}
vec3 componentPhase(vec3 p,float a,int component){
 int m=component==0?uMagnetic.x:uMagnetic.y,n=component==0?uShells.x:uShells.y;
 float ph=uBasis==0?float(m)*atan(p.y,p.x):0.;
 if(uBasis==0&&m<0&&abs(m)%2==1)a=-a;
 if(a<0.)ph+=3.14159265359;
 // A slowed illustrative component phase, matching the atlas convention.
 ph+=uTime*1.5*pow(float(min(uShells.x,uShells.y)),2.)/float(n*n);return rainbowColor(fract(ph/6.28318530718+.5));
}
vec3 phaseColor(vec3 p){
 vec2 a=amplitudes(p),weights=a*a*vec2(1.-uPopulation,uPopulation);
 return (componentPhase(p,a.x,0)*weights.x+componentPhase(p,a.y,1)*weights.y)/max(1.e-35,weights.x+weights.y);
}
`;
const spectrumFragment=`#version 300 es
${spectrumCommon}
in vec2 vUv;out vec4 outColor;
uniform vec2 uResolution;uniform vec3 uCamera,uRight,uUp,uForward;
uniform float uFocal,uVolumeStrength;uniform int uSteps;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
void main(){
 vec2 screen=vUv*2.-1.;screen.x*=uResolution.x/uResolution.y;
 vec3 ray=normalize(uForward*uFocal+screen.x*uRight+screen.y*uUp);
 float b=dot(uCamera,ray),disc=b*b-dot(uCamera,uCamera)+1.;vec3 background=vec3(.009,.012,.019);
 if(disc<=0.){outColor=vec4(background,1.);return;}
 // Exact plane sampling avoids missing a thin slice between ray-march steps.
 if(uSliceAxis>0){
  float denom=dot(ray,uSliceNormal);
  if(abs(denom)<1.e-6){outColor=vec4(background,1.);return;}
  float hit=(uSliceHeight-dot(uCamera,uSliceNormal))/denom;
  vec3 pos=uCamera+ray*hit;
  if(hit<0.||length(pos)>1.){outColor=vec4(background,1.);return;}
  float d=max(0.,cloudDensity(pos));
  float t=pow(d,.38);
  vec3 shade=uMode==1?phaseColor(pos):densityColor(colorMetricValue(uMode==0?t:d,pos));
  float opacity=clamp(t*(850./255.)*sqrt(uDensity),0.,1.);
  outColor=vec4(mix(background,shade,opacity),1.);return;
 }
 float start=max(0.,-b-sqrt(disc)),end=-b+sqrt(disc),stepSize=(end-start)/float(uSteps);
 float t=start+stepSize*hash(gl_FragCoord.xy),transmission=1.;vec3 color=vec3(0.);
 for(int i=0;i<260;i++){
  if(i>=uSteps||transmission<.009)break;vec3 position=uCamera+ray*t;t+=stepSize;if(clipped(position))continue;
  float d=cloudDensity(position);if(d<.000015)continue;
  float opacity=1.-exp(-pow(d,.78)*stepSize*uCloudScale*9.*uDensity);
  vec3 shade=uMode==1?phaseColor(position):densityColor(colorMetricValue(d,position));
  if(uSeparateColors&&uMode==0){
   vec2 componentDensity=cloudComponents(position);
   // Each cloud keeps its own density support and a population-scaled optical
   // depth. Integrate both contributions at the same location without assigning
   // the entire volume a single population-mixed tint.
   vec2 opticalDepth=pow(max(componentDensity,vec2(0.)),vec2(.78))*vec2(1.-uPopulation,uPopulation)*stepSize*uCloudScale*9.*uDensity;
   float totalDepth=opticalDepth.x+opticalDepth.y;
   opacity=1.-exp(-totalDepth);
   shade=(componentColor(0)*opticalDepth.x+componentColor(1)*opticalDepth.y)/max(1.e-35,totalDepth);
  }
  float dl=cloudDensity(position+vec3(-.018,-.023,.028)/uCloudScale);
  shade*=clamp(.85+(d-dl)/max(.045,d)*1.1,.45,1.2);
  color+=transmission*opacity*shade;transmission*=1.-opacity;
 }
 color=pow(vec3(1.)-exp(-color*1.9),vec3(.87))*uVolumeStrength;
 outColor=vec4(color+background*transmission,1.);
}`;
const spectrumCopyFragment=`#version 300 es
precision highp float;in vec2 vUv;uniform sampler2D uTexture;out vec4 outColor;void main(){outColor=texture(uTexture,vUv);}`;
const spectrumParticleCommon=`
uniform int uComponent;
uniform float uCurrent,uVisibleCount;
${sliceSamplingGLSL}
vec3 particlePosition(vec4 seed){
 if(uSliceAxis>0){vec3 pos=uComponent==0?sampledSlicePosition(uSliceSamples0,seed):sampledSlicePosition(uSliceSamples1,seed);vec2 a=amplitudes(pos);float value=uComponent==0?a.x:a.y;if(value*value*uExposure<=1.e-30)return vec3(3.);float rr=length(pos);seed.xyz=vec3(rr,rr>0.?pos.z/rr:0.,atan(pos.y,pos.x));}
 float r=seed.x,c=seed.y,s=sqrt(max(0.,1.-c*c));
 int m=uComponent==0?uMagnetic.x:uMagnetic.y,n=uComponent==0?uShells.x:uShells.y;
 float omega=float(m)*pow(float(max(uShells.x,uShells.y)),4.)*.23/max(.001,pow(r*uExtent*s,2.));
 float turn=uTime*omega*uCurrent;
 // Recycle trajectories through a thin slab; top-down circulation stays continuous.
 if(uSliceAxis>0&&length(uSliceNormal.xy)>1.e-5){
  float span=min(3.14159265,.04/max(.001,r*s*length(uSliceNormal.xy)));
  turn=(fract(turn/span+seed.w)-.5)*span;
  if(abs(omega*uCurrent)<1.e-10)turn=0.;
 }
 float ph=seed.z+turn;vec3 result=vec3(r*s*cos(ph),r*s*sin(ph),r*c);
 if(uSliceAxis>0)result+=uSliceNormal*(uSliceHeight-dot(result,uSliceNormal));
 return result;
}
vec3 particleColor(vec3 p,float d){vec2 a=amplitudes(p);return uMode==1?componentPhase(p,uComponent==0?a.x:a.y,uComponent):(uSeparateColors&&uMode==0?componentColor(uComponent):densityColor(colorMetricValue(d,p)));}
`;
const spectrumParticleVertex=`#version 300 es
${spectrumCommon}
${cloudTracerGLSL}
${spectrumParticleCommon}
in vec4 aParticle;uniform vec3 uCamera,uRight,uUp,uForward;uniform vec2 uResolution;uniform float uFocal,uPointScale;out vec4 vColor;
void main(){
 vec3 p=particlePosition(aParticle);float fraction=clamp(uVisibleCount-float(gl_VertexID),0.,1.);
 if(clipped(p)||fraction<=0.){gl_Position=vec4(2.,2.,2.,1.);gl_PointSize=0.;vColor=vec4(0.);return;}
 vec3 d=p-uCamera;float z=dot(d,uForward);if(z<=.015){gl_Position=vec4(2.,2.,2.,1.);gl_PointSize=0.;vColor=vec4(0.);return;}
 gl_Position=vec4(dot(d,uRight)*uFocal*uResolution.y/uResolution.x,dot(d,uUp)*uFocal,0.,z);
 vec2 footprint=cloudTracerFootprint(clamp((2.3+aParticle.w*1.6)*uPointScale*2.6/z,.9,7.));
 gl_PointSize=footprint.x;
 float den=clamp(density(p),0.,1.);vColor=vec4(particleColor(p,den),(.27+.43*aParticle.w)*fraction*sqrt(uDensity)*footprint.y);
}`;
const spectrumParticleFragment=`#version 300 es
precision highp float;in vec4 vColor;out vec4 outColor;void main(){float r=length(gl_PointCoord*2.-1.);if(r>1.)discard;outColor=vec4(vColor.rgb,vColor.a*exp(-r*r*3.5));}`;
// Granular uses the same analytic sphere intersection for point sprites and
// oversized/near-camera quads. One point vertex normally replaces six quad
// vertices, so orbital amplitudes and phase are evaluated once per sample.
const spectrumSphereCommon=`
${spectrumCommon}
${spectrumParticleCommon}
uniform vec3 uCamera,uRight,uUp,uForward;
uniform vec2 uResolution;
uniform float uFocal,uSphereRadius;
flat out vec3 vCenter,vColor;
flat out float vRadius;
vec3 sphereColor(vec3 p){
 vec2 a=amplitudes(p);
 float d=clamp(mix(a.x*a.x,a.y*a.y,uPopulation)*uExposure,0.,1.);
 return uMode==1?componentPhase(p,uComponent==0?a.x:a.y,uComponent):densityColor(colorMetricValue(d,p));
}
`;
const spectrumSphereVertex=`#version 300 es
${spectrumSphereCommon}
layout(location=0) in vec2 aCorner;layout(location=1) in vec4 aParticle;
void main(){
 vec3 p=particlePosition(aParticle);float fraction=clamp(uVisibleCount-float(gl_InstanceID),0.,1.);
 float radius=uSphereRadius*(uComponent==0?uComponentScale.x:uComponentScale.y)*(.82+.36*aParticle.w)*pow(fraction,1./3.);
 vec3 rel=p-uCamera;vec3 center=vec3(dot(rel,uRight),dot(rel,uUp),dot(rel,uForward));
 if(radius<=0.||clipped(p)||center.z<=radius+.015){gl_Position=vec4(2.,2.,2.,1.);vCenter=vec3(0.);vRadius=0.;vColor=vec3(0.);return;}
 float bound=radius*1.04*(1.+length(center.xy)/max(.015,center.z-radius));vec3 plane=center+vec3(aCorner*bound,0.);
 vCenter=center;vRadius=radius;vColor=sphereColor(p);
 float A=1.000300045,B=-.030004501;gl_Position=vec4(plane.x*uFocal*uResolution.y/uResolution.x,plane.y*uFocal,A*plane.z+B,plane.z);
}`;
const spectrumSpherePointVertex=`#version 300 es
${spectrumSphereCommon}
layout(location=1) in vec4 aParticle;
void main(){
 vec3 p=particlePosition(aParticle);float fraction=clamp(uVisibleCount-float(gl_VertexID),0.,1.);
 float radius=uSphereRadius*(uComponent==0?uComponentScale.x:uComponentScale.y)*(.82+.36*aParticle.w)*pow(fraction,1./3.);
 vec3 rel=p-uCamera;vec3 center=vec3(dot(rel,uRight),dot(rel,uUp),dot(rel,uForward));
 vRadius=0.;vCenter=vec3(0.);vColor=vec3(0.);gl_Position=vec4(2.,2.,2.,1.);gl_PointSize=1.;
 if(radius<=0.||clipped(p)||center.z<=radius+.015)return;
 float bound=radius*1.04*(1.+length(center.xy)/max(.015,center.z-radius));
 float diameter=bound*uFocal*uResolution.y/center.z;
 vec2 screen=vec2(center.x*uResolution.y/uResolution.x,center.y)*uFocal/center.z;
 // OpenGL clips point centers. Keep partially visible spheres at the viewport
 // edges by moving the raster footprint, not the sphere/ray intersection.
 vec2 anchor=clamp(screen,vec2(-1.)+2./uResolution,vec2(1.)-2./uResolution);
 vec2 shift=abs(screen-anchor)*uResolution*.5;
 if(max(shift.x,shift.y)>diameter*.5+1.)return;
 gl_PointSize=max(1.,diameter+2.*max(shift.x,shift.y));
 vCenter=center;vRadius=radius;vColor=sphereColor(p);
 gl_Position=vec4(anchor*center.z,1.000300045*center.z-.030004501,center.z);
}`;
const spectrumSphereFragment=`#version 300 es
precision highp float;
flat in vec3 vCenter,vColor;flat in float vRadius;
uniform bool uSliceDisplay;
uniform vec2 uResolution;uniform float uFocal,uDensity;
out vec4 outColor;
void main(){
 if(vRadius<=0.)discard;
 vec2 screen=gl_FragCoord.xy/uResolution*2.-1.;screen.x*=uResolution.x/uResolution.y;
 vec3 ray=normalize(vec3(screen/uFocal,1.));float b=dot(ray,vCenter);
 vec3 closest=vCenter-ray*b;float h=vRadius*vRadius-dot(closest,closest);if(h<0.)discard;
 vec3 hit=ray*(b-sqrt(h)),normal=normalize(hit-vCenter);
 vec3 light=normalize(vec3(-.5,.7,-.8));
 float diffuse=max(dot(normal,light),0.);
 float softSpec=pow(max(dot(normal,normalize(light-ray)),0.),12.);
 float fill=max(dot(normal,normalize(vec3(.7,-.15,-.5))),0.);
 float facing=max(dot(normal,-ray),0.);
 vec3 linear=vColor*(.26+.62*diffuse+.18*fill+.12*facing)+vec3(1.)*softSpec*.055;
 linear*=pow(uDensity,.55);
 if(uSliceDisplay)linear/=max(1.,max(linear.r,max(linear.g,linear.b)));
 outColor=vec4(clamp(pow(linear,vec3(.90)),0.,1.),1.);
 gl_FragDepth=.5*(1.000300045-.030004501/hit.z)+.5;
}`;
const spectrumAxisVertex=`#version 300 es
precision highp float;in vec3 aPosition;in vec3 aColor;uniform vec3 uCamera,uRight,uUp,uForward;uniform vec2 uResolution;uniform float uFocal;out vec3 vColor;void main(){vec3 d=aPosition-uCamera;float z=dot(d,uForward);gl_Position=vec4(dot(d,uRight)*uFocal*uResolution.y/uResolution.x,dot(d,uUp)*uFocal,0.,z);vColor=aColor;}`;
const spectrumAxisFragment=`#version 300 es
precision highp float;in vec3 vColor;out vec4 outColor;void main(){outColor=vec4(vColor,.42);}`;

const spectrumTiers=[
 {name:'Efficient',scale:.55,steps:64,pixels:220000,radius:.009},
 {name:'Balanced',scale:.82,steps:100,pixels:450000,radius:.0075},
 {name:'High',scale:1.15,steps:160,pixels:900000,radius:.0065},
 {name:'Ultra',scale:1.6,steps:240,pixels:1800000,radius:.006}
];
const spectrumMaxParticles=200000;
const spectrumTableSize=2048;
const spectrumClamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
const spectrumFactorials=[1];
for(let i=1;i<16;i++)spectrumFactorials[i]=spectrumFactorials[i-1]*i;
const spectrumAngularCache=new Map();
function spectrumAssociatedLegendre(l,m,x){
  let p=1;const root=Math.sqrt(Math.max(0,1-x*x));
  for(let j=1;j<=m;j++)p*=-(2*j-1)*root;
  if(l===m)return p;
  let q=(2*m+1)*x*p;
  for(let k=m+2;k<=l;k++){const next=((2*k-1)*x*q-(k+m-1)*p)/(k-m);p=q;q=next;}
  return q;
}
function spectrumAngularParameters(l,m){
  const q=Math.abs(m),key=l*6+q;
  if(spectrumAngularCache.has(key))return spectrumAngularCache.get(key);
  const norm=Math.sqrt((2*l+1)/(4*Math.PI)*spectrumFactorials[l-q]/spectrumFactorials[l+q]);
  let peak=0;
  // Nonzero m vanishes at the poles. Sample the full polar interval instead.
  for(let i=0;i<=1024;i++)peak=Math.max(peak,(norm*spectrumAssociatedLegendre(l,q,2*i/1024-1))**2);
  const parameters={norm,peak};spectrumAngularCache.set(key,parameters);return parameters;
}
function spectrumRadial(n,l,r){
  const x=2*r/n,k=n-l-1,a=2*l+1;
  let p=1,q=1+a-x;
  for(let j=2;j<=k;j++){const next=((2*j-1+a-x)*q-(j-1+a)*p)/j;p=q;q=next;}
  const polynomial=k===0?1:q;
  const norm=Math.sqrt((2/n)**3*spectrumFactorials[n-l-1]/(2*n*spectrumFactorials[n+l]));
  return norm*Math.exp(-x/2)*x**l*polynomial;
}
function spectrumCompile(gl,type,source){
  const shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);
  if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)){
    const message=gl.getShaderInfoLog(shader);gl.deleteShader(shader);throw new Error(message||'Spectrum shader could not compile.');
  }
  return shader;
}

function spectrumProgram(gl,vertex,fragment){
 const vs=spectrumCompile(gl,gl.VERTEX_SHADER,vertex),fs=spectrumCompile(gl,gl.FRAGMENT_SHADER,fragment),program=gl.createProgram();
 gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);gl.deleteShader(vs);gl.deleteShader(fs);
 if(!gl.getProgramParameter(program,gl.LINK_STATUS)){const message=gl.getProgramInfoLog(program);gl.deleteProgram(program);throw new Error(message||'Spectrum shader could not link.');}
 return program;
}
function spectrumInverseCDF(cdf,u){
 let lo=0,hi=cdf.length-1;while(lo+1<hi){const mid=(lo+hi)>>1;if(cdf[mid]<u)lo=mid;else hi=mid;}
 return (lo+(u-cdf[lo])/Math.max(1.e-15,cdf[hi]-cdf[lo]))/(cdf.length-1);
}

export class SpectrumRenderer {
 constructor(canvas,{onError=()=>{},onStats=()=>{}}={}){
  this.canvas=canvas;this.onError=onError;this.onStats=onStats;
  this.state={basis:'complex',mode:'density',renderStyle:'cloud',separateColors:false,cut:'none',cutAngle:0,cutOffset:0,density:1,particleAmount:.02,speed:.5,animate:true,autoRotate:false,axes:false};
  this.activeParticleAmount=this.state.particleAmount;
  this.population=0;this.time=0;this.visible=false;this.dead=false;this.contextLost=false;this.dirty=true;this.raf=0;
  this.camera={yaw:.58,pitch:.34,distance:2.8};this.pointers=new Map();
  const touch=typeof matchMedia==='function'&&matchMedia('(pointer: coarse)').matches;
  this.tier=touch||(typeof navigator!=='undefined'&&navigator.hardwareConcurrency<6)?1:2;
  // Cloud may adapt its raster tier; Granular always returns to this fixed tier.
  this.styleTiers={cloud:this.tier,granular:this.tier};
  this.lower={n:2,l:1,m:0};this.upper={n:3,l:2,m:0};
  this.lastDraw=0;this.lastStats=0;this.reportedFrame=false;this.lastQualityChange=performance.now();this.frames=[];
  this.healthySince=null;this.slowSince=null;this.recoveryUntil=0;this.longFrames=0;this.volumeKey='';
  try{
   this.gl=canvas.getContext('webgl2',{alpha:false,antialias:false,depth:true,powerPreference:'high-performance'});
   if(!this.gl)throw new Error('WebGL 2 is needed for the orbital transition. The spectrum and energy levels remain available.');
   this.initialize();this.bindEvents();this.setPair(this.lower,this.upper);this.resize();
  }catch(error){this.error=error;this.onError(error.message);}
 }
 initialize(){
  const gl=this.gl;
  this.program=spectrumProgram(gl,spectrumVertex,spectrumFragment);
  this.copy=spectrumProgram(gl,spectrumVertex,spectrumCopyFragment);
  this.particle=spectrumProgram(gl,spectrumParticleVertex,spectrumParticleFragment);
  this.sphere=spectrumProgram(gl,spectrumSphereVertex,spectrumSphereFragment);
  this.spherePoint=spectrumProgram(gl,spectrumSpherePointVertex,spectrumSphereFragment);
  const pointRange=gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE);
  this.maxPointSize=Number.isFinite(pointRange?.[1])?pointRange[1]:0;
  this.axis=spectrumProgram(gl,spectrumAxisVertex,spectrumAxisFragment);
  this.buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);
  gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
  const quadVAO=program=>{const vao=gl.createVertexArray();gl.bindVertexArray(vao);gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);const loc=gl.getAttribLocation(program,'aPosition');gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,2,gl.FLOAT,false,0,0);return vao;};
  this.vao=quadVAO(this.program);this.copyVAO=quadVAO(this.copy);
  this.particleBuffers=[];this.particleVAOs=[];this.sphereVAOs=[];this.spherePointVAOs=[];
  for(let component=0;component<2;component++){
   const buffer=gl.createBuffer();this.particleBuffers.push(buffer);
   const points=gl.createVertexArray();gl.bindVertexArray(points);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
   const loc=gl.getAttribLocation(this.particle,'aParticle');gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,4,gl.FLOAT,false,0,0);this.particleVAOs.push(points);
   const spherePoints=gl.createVertexArray();gl.bindVertexArray(spherePoints);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
   gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,4,gl.FLOAT,false,0,0);this.spherePointVAOs.push(spherePoints);
   const spheres=gl.createVertexArray();gl.bindVertexArray(spheres);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
   const seed=gl.getAttribLocation(this.sphere,'aParticle');gl.enableVertexAttribArray(seed);gl.vertexAttribPointer(seed,4,gl.FLOAT,false,0,0);gl.vertexAttribDivisor(seed,1);
   gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);const corner=gl.getAttribLocation(this.sphere,'aCorner');gl.enableVertexAttribArray(corner);gl.vertexAttribPointer(corner,2,gl.FLOAT,false,0,0);this.sphereVAOs.push(spheres);
  }
  this.axisVAO=gl.createVertexArray();gl.bindVertexArray(this.axisVAO);this.axisBuffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,this.axisBuffer);
  gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,0,0,.37,.57,.8,1,0,0,.37,.57,.8,0,-1,0,.37,.57,.8,0,1,0,.37,.57,.8,0,0,-1,.68,.83,1.,0,0,1,.68,.83,1.]),gl.STATIC_DRAW);
  for(const [name,offset] of [['aPosition',0],['aColor',12]]){const loc=gl.getAttribLocation(this.axis,name);gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,3,gl.FLOAT,false,24,offset);}
  gl.bindVertexArray(null);
  this.texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,this.texture);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  this.volumeTexture=gl.createTexture();this.volumeFBO=gl.createFramebuffer();this.uniforms=new Map();this.volumeKey='';this.cacheWidth=0;this.cacheHeight=0;
  this.timerExtension=gl.getExtension?.('EXT_disjoint_timer_query_webgl2')||null;this.gpuQueries=[];this.gpuTimes=[];this.timerFrame=0;
  this.resetTiming();
 }
 bindEvents(){
  const on=(name,handler,options)=>{this.canvas.addEventListener(name,handler,options);this.handlers.push([name,handler]);};
  this.handlers=[];this.canvas.style.touchAction='none';
  on('pointerdown',event=>{this.canvas.setPointerCapture(event.pointerId);this.pointers.set(event.pointerId,[event.clientX,event.clientY]);this.canvas.style.cursor='grabbing';});
  on('pointermove',event=>{
   const old=this.pointers.get(event.pointerId);if(!old)return;const point=[event.clientX,event.clientY];
   if(this.pointers.size===1){this.camera.yaw-=(point[0]-old[0])*.007;this.camera.pitch=spectrumClamp(this.camera.pitch+(point[1]-old[1])*.007,-1.45,1.45);}
   else{const other=[...this.pointers.entries()].find(([id])=>id!==event.pointerId)?.[1];if(other){const before=Math.hypot(old[0]-other[0],old[1]-other[1]),after=Math.hypot(point[0]-other[0],point[1]-other[1]);if(before&&after)this.camera.distance=spectrumClamp(this.camera.distance*before/after,.15,6);}}
   this.pointers.set(event.pointerId,point);this.requestDraw();
  });
  const release=event=>{this.pointers.delete(event.pointerId);if(!this.pointers.size)this.canvas.style.cursor='grab';};
  on('pointerup',release);on('pointercancel',release);on('lostpointercapture',release);
  on('wheel',event=>{event.preventDefault();this.zoomBy(Math.exp(event.deltaY*.001));},{passive:false});on('dblclick',()=>this.resetView());
  on('keydown',event=>{const k=event.key;
   if(k==='ArrowLeft')this.camera.yaw-=.1;else if(k==='ArrowRight')this.camera.yaw+=.1;
   else if(k==='ArrowUp')this.camera.pitch=spectrumClamp(this.camera.pitch+.1,-1.45,1.45);else if(k==='ArrowDown')this.camera.pitch=spectrumClamp(this.camera.pitch-.1,-1.45,1.45);
   else if(k==='+'||k==='=')this.zoomBy(.9);else if(k==='-')this.zoomBy(1.1);else if(k.toLowerCase()==='r')this.resetView();else return;event.preventDefault();this.requestDraw();
  });
  on('webglcontextlost',event=>{event.preventDefault();this.contextLost=true;cancelAnimationFrame(this.raf);this.raf=0;this.onError('The graphics context was interrupted. Restoring the orbital transition…');});
  on('webglcontextrestored',()=>{try{this.contextLost=false;this.error=null;this.initialize();this.uploadPair();this.uploadParticles();this.resize();this.onError('');this.requestDraw();}catch(error){this.error=error;this.onError(error.message);}});
  this.visibilityHandler=()=>{this.resetTiming();if(document.hidden){cancelAnimationFrame(this.raf);this.raf=0;}else this.requestDraw();};document.addEventListener('visibilitychange',this.visibilityHandler);
  this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(this.canvas);
 }
 setState(partial){
  const old=this.state,s={...old,...partial};if(s.randomRotate!==old.randomRotate)this.randomMotion=null;
  if(s.cutView!==old.cutView||!!s.frontView!==!!old.frontView||(['wedge','sector15','custom','slab','radius'].includes(s.cut)&&old.cut!==s.cut)||(s.cut==='slab'&&s.sliceAxis!==old.sliceAxis))Object.assign(this.camera,startingViewOrientation(s,.58,.34));
  s.basis=s.basis==='real'?'real':'complex';s.mode=colorMetrics[colorMetricIndex(s.mode)].id;s.renderStyle=['sculpted','granular'].includes(s.renderStyle)?'granular':'cloud';
  s.separateColors=false;
  s.cut=['none','half','wedge','slice','sector15','custom','slab','radius'].includes(s.cut)?s.cut:'none';delete s.targetFps;delete s.autoTracers;delete s.quality;
  for(const [name,min,max] of [['density',.1,4],['particleAmount',0,4],['speed',.25,4],['cutAngle',0,360],['cutOffset',-.8,.8]])s[name]=spectrumClamp(Number.isFinite(+s[name])?+s[name]:old[name],min,max);
  for(const name of ['animate','autoRotate','randomRotate','axes','separateColors'])s[name]=!!s[name];this.state=s;s.particleAmount=Math.min(s.renderStyle==='cloud'?.08:4,s.particleAmount);this.updateTracerCeiling(old.particleAmount,s.particleAmount);
    // A moving thin slice retains the requested sample population.
    if(s.renderStyle==='granular'&&s.cut==='slab')this.activeParticleAmount=s.particleAmount;
  // Each rendering style keeps its own raster quality and tracer ceiling.
  if(s.renderStyle!==old.renderStyle){
   this.styleTiers[old.renderStyle]=this.tier;
   const nextTier=this.styleTiers[s.renderStyle];
   if(nextTier!==this.tier){this.tier=nextTier;this.resize();}
   this.activeParticleAmount=s.particleAmount;this.lastTracerAdjustment=0;this.limiterRecoveryUntil=0;
  }
  if((s.basis!==old.basis||s.cut!==old.cut||s.cutView!==old.cutView||s.renderStyle!==old.renderStyle)&&this.radialData)this.prepareParticles();
  if(['animate','mode','renderStyle','basis','particleAmount','autoRotate','randomRotate','separateColors'].some(key=>old[key]!==s[key]))this.resetTiming();
  this.requestDraw();
 }
 setPair(lower,upper){
  const valid=state=>state&&Number.isInteger(state.n)&&state.n>=1&&state.n<=6&&Number.isInteger(state.l)&&state.l>=0&&state.l<state.n&&Number.isInteger(state.m??0)&&Math.abs(state.m??0)<=state.l;
  if(!valid(lower)||!valid(upper))throw new Error('Spectrum states require integer quantum numbers with 1 ≤ n ≤ 6, 0 ≤ ℓ < n, and −ℓ ≤ m ≤ ℓ.');
  this.lower={n:lower.n,l:lower.l,m:lower.m??0};this.upper={n:upper.n,l:upper.l,m:upper.m??0};
  this.extent=2.15*Math.max(lower.n,upper.n)**2+3;this.time=0;
  // Fit the shared unit-radius support of both endpoints, with room for particles.
  this.camera.distance=Math.max(3,this.camera.distance);
  this.radialData=new Float32Array(spectrumTableSize*2);this.references=[0,0];this.angularNorm=[0,0];
  for(const [channel,state] of [this.lower,this.upper].entries()){
   const angular=spectrumAngularParameters(state.l,state.m);this.angularNorm[channel]=angular.norm;
   for(let i=0;i<spectrumTableSize;i++){
    const r=this.extent*i/(spectrumTableSize-1),amplitude=spectrumRadial(state.n,state.l,r);
    this.radialData[2*i+channel]=amplitude;
   }
   this.references[channel]=orbitalDisplayReference(state.n,state.l,state.m);
  }
  this.uploadPair();this.prepareParticles();this.volumeKey='';this.resetTiming();this.requestDraw();
 }
 uploadPair(){
  if(!this.gl||this.error||this.contextLost||!this.radialData)return;const gl=this.gl;gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,this.texture);
  // Manual interpolation is portable WebGL 2 and needs no float-filter extension.
  gl.texImage2D(gl.TEXTURE_2D,0,gl.RG32F,spectrumTableSize,1,0,gl.RG,gl.FLOAT,this.radialData);
 }
 prepareParticles(){
  this.particleData=[];this.particleCache??=new Map();
  for(const [component,state] of [this.lower,this.upper].entries()){
   const key=[state.n,state.l,this.state.basis,this.state.basis==='real'?state.m:Math.abs(state.m),this.extent,this.state.cut==='slab'?'slice-seeds':'volume'].join('|');
   const cached=this.particleCache.get(key);if(cached){this.particleData.push(cached);continue;}
   const radialCDF=new Float64Array(spectrumTableSize),angularCDF=new Float64Array(1025),q=Math.abs(state.m);
   let previous=0;
   for(let i=1;i<radialCDF.length;i++){const r=i/(radialCDF.length-1),mass=r*r*this.radialData[2*i+component]**2;radialCDF[i]=radialCDF[i-1]+.5*(previous+mass);previous=mass;}
   previous=spectrumAssociatedLegendre(state.l,q,-1)**2;
   for(let i=1;i<angularCDF.length;i++){const mass=spectrumAssociatedLegendre(state.l,q,2*i/(angularCDF.length-1)-1)**2;angularCDF[i]=angularCDF[i-1]+.5*(previous+mass);previous=mass;}
   for(let i=1;i<radialCDF.length;i++)radialCDF[i]/=radialCDF[radialCDF.length-1];
   for(let i=1;i<angularCDF.length;i++)angularCDF[i]/=angularCDF[angularCDF.length-1];
   let data=new Float32Array(spectrumMaxParticles*8*4);let seed=761+state.n*919+state.l*313+q*51;
   const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)|0;return (seed>>>0)/4294967296;};
   for(let i=0;i<spectrumMaxParticles*8;i++){
    const r=spectrumInverseCDF(radialCDF,random()),c=2*spectrumInverseCDF(angularCDF,random())-1;let phi=random()*Math.PI*2;
    if(this.state.basis==='real'&&state.m){do{phi=random()*Math.PI*2;}while(random()>(state.m>0?Math.cos(state.m*phi):Math.sin(-state.m*phi))**2);}
    const index=i*4;data[index]=r;data[index+1]=c;data[index+2]=phi;data[index+3]=random();
   }
   if(this.state.cut==='slab')data=sliceRandomSeeds(spectrumMaxParticles*8);
   this.particleData.push(data);this.particleCache.set(key,data);if(this.particleCache.size>4)this.particleCache.delete(this.particleCache.keys().next().value);
  }
  this.uploadParticles();
 }
 uploadParticles(){
  if(!this.gl||this.error||this.contextLost||!this.particleData)return;
  const gl=this.gl;for(let i=0;i<2;i++){gl.bindBuffer(gl.ARRAY_BUFFER,this.particleBuffers[i]);gl.bufferData(gl.ARRAY_BUFFER,this.particleData[i],gl.STATIC_DRAW);}
 }
 setPopulation(value,rate=0,maxRate=1){const next=spectrumClamp(Number.isFinite(value)?value:0,0,1);if(Math.abs(next-this.population)<1.e-7&&rate===this.populationRate&&maxRate===this.maxPopulationRate)return;this.population=next;this.populationRate=rate;this.maxPopulationRate=maxRate;this.requestDraw();}

 setVisible(visible){
  if(this.visible===!!visible)return;this.visible=!!visible;this.resetTiming();
  if(this.visible){this.resize();this.requestDraw();}else{cancelAnimationFrame(this.raf);this.raf=0;}
 }
 alignCutView(){
  Object.assign(this.camera,startingViewOrientation(this.state,0,0));
  this.volumeKey='';this.lastCameraSignature='';this.requestDraw();
 }
 resetView(){this.camera={distance:2.8,...startingViewOrientation(this.state,.58,.34)};this.requestDraw();}
 zoomBy(factor){if(Number.isFinite(factor)&&factor>0){this.camera.distance=spectrumClamp(this.camera.distance*factor,.15,6);this.requestDraw();}}
 resetTiming(){
  this.lastDraw=0;this.lastDrawPopulation=null;this.lastCameraSignature=null;this.frames=[];this.gpuTimes=[];this.healthySince=null;this.slowSince=null;this.longFrames=0;this.warmUntil=performance.now()+500;this.decreaseCount=0;this.decreaseBaseline=0;
  for(const query of this.gpuQueries||[])this.gl?.deleteQuery(query);this.gpuQueries=[];
 }
 resize(){
  if(this.dead||!this.gl||this.contextLost)return;const rect=this.canvas.getBoundingClientRect(),tier=spectrumTiers[this.tier];
  const tracerScale=cloudTracerViewportScale(rect.width,rect.height);
  if(tracerScale!==this.tracerViewportScale){this.tracerViewportScale=tracerScale;this.requestDraw();}
  const area=Math.max(1,rect.width*rect.height),scale=Math.min(window.devicePixelRatio||1,tier.scale,Math.sqrt(tier.pixels/area));
  const width=Math.max(1,Math.round(rect.width*scale)),height=Math.max(1,Math.round(rect.height*scale));
  if(this.canvas.width!==width||this.canvas.height!==height){this.canvas.width=width;this.canvas.height=height;}
  if(this.cacheWidth!==width||this.cacheHeight!==height){
   const gl=this.gl;gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,this.volumeTexture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,width,height,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
   gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
   gl.bindFramebuffer(gl.FRAMEBUFFER,this.volumeFBO);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,this.volumeTexture,0);this.canCache=gl.checkFramebufferStatus(gl.FRAMEBUFFER)===gl.FRAMEBUFFER_COMPLETE;gl.bindFramebuffer(gl.FRAMEBUFFER,null);
   this.cacheWidth=width;this.cacheHeight=height;this.volumeKey='';this.requestDraw();
  }
 }
 requestDraw(){this.dirty=true;if(this.raf||this.dead||this.error||this.contextLost||!this.visible||document.hidden)return;this.raf=requestAnimationFrame(now=>{this.raf=0;this.draw(now);});}
 uniform(program,name,kind,...values){
  let map=this.uniforms.get(program);if(!map){map=new Map();this.uniforms.set(program,map);}
  if(!map.has(name))map.set(name,this.gl.getUniformLocation(program,name));const location=map.get(name);if(location!==null)this.gl[kind](location,...values);
 }
 cameraUniforms(program){
  const camera=this.camera,distance=camera.distance*Math.max(1,1/(this.canvas.width/this.canvas.height));
  const ce=Math.cos(camera.pitch),se=Math.sin(camera.pitch),sy=Math.sin(camera.yaw),cy=Math.cos(camera.yaw);
  this.uniform(program,'uCamera','uniform3f',sy*ce*distance,cy*ce*distance,se*distance);this.uniform(program,'uRight','uniform3f',cy,-sy,0);this.uniform(program,'uUp','uniform3f',-sy*se,-cy*se,ce);this.uniform(program,'uForward','uniform3f',-sy*ce,-cy*ce,-se);
  this.uniform(program,'uResolution','uniform2f',this.canvas.width,this.canvas.height);this.uniform(program,'uFocal','uniform1f',2.45);this.uniform(program,'uCameraDistance','uniform1f',distance);
 }
 sharedUniforms(program){
  bindColorMapTexture(this.gl,program);
  if(this.state.cut==='slab')bindSliceSampling(this.gl,program,[this.lower,this.upper],this.state,this.extent);
  const bounds=this.state.cut==='slab'?sliceColorBounds([this.lower,this.upper],this.state.basis,this.state.mode,this.state.slicePolar??90,this.state.renderStyle):orbitalColorBounds([this.lower,this.upper],this.state.basis,this.state.mode);
  this.uniform(program,'uColorBounds','uniform2f',...bounds.map(x=>this.state.mode==='density-change'?x*(this.maxPopulationRate||1):this.state.cut==='slab'&&this.state.renderStyle!=='granular'&&this.state.mode==='density'?Math.pow(Math.max(0,x),.38):x));
  this.uniform(program,'uPopulationRate','uniform1f',this.populationRate||0);
  const gl=this.gl,s=this.state;gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,this.texture);
  this.uniform(program,'uRadial','uniform1i',0);this.uniform(program,'uTableSize','uniform1i',spectrumTableSize);
  this.uniform(program,'uAngular','uniform2i',this.lower.l,this.upper.l);this.uniform(program,'uMagnetic','uniform2i',this.lower.m,this.upper.m);this.uniform(program,'uShells','uniform2i',this.lower.n,this.upper.n);this.uniform(program,'uAngularNorm','uniform2f',...this.angularNorm);
  this.uniform(program,'uPopulation','uniform1f',this.population);
  this.uniform(program,'uSliceDisplay','uniform1i',s.cut==='slab'?1:0);
    this.uniform(program,'uPlaneNormal','uniform3f',...planeCutNormal(s));
    this.uniform(program,'uRadiusLimit','uniform1f',s.cut==='radius'?Math.max(0,Math.min(1,s.radiusLimit??1)):-1);
    this.uniform(program,'uCutDegrees','uniform1f',cutDegrees(s));
  this.uniform(program,'uSliceAxis','uniform1i',s.cut==='slab'?(s.sliceAxis==='top'?2:1):0);
  this.uniform(program,'uSliceThickness','uniform1f',.01);
  this.uniform(program,'uSliceHeight','uniform1f',-(s.sliceHeight||0));
    this.uniform(program,'uWedgePolar','uniform1f',(s.wedgePolar??90)*Math.PI/180);
    this.uniform(program,'uSliceNormal','uniform3f',...planeCutNormal({planeAzimuth:s.sliceAzimuth??90,planePolar:s.slicePolar??(s.sliceAxis==='top'?0:90)}));
  const refs=this.references.map((value,i)=>value*(s.basis==='real'&&[this.lower,this.upper][i].m?2:1));
  // Population-weighted display exposure reaches each standalone endpoint.
  this.uniform(program,'uExposure','uniform1f',1/((1-this.population)*refs[0]+this.population*refs[1]));
  const scales=[orbitalExtent(this.lower.n)/this.extent,orbitalExtent(this.upper.n)/this.extent];
  this.uniform(program,'uComponentScale','uniform2f',...scales);
  this.uniform(program,'uCloudScale','uniform1f',1/((1-this.population)*scales[0]+this.population*scales[1]));
  for(const [key,value] of [['uExtent',this.extent],['uTime',this.time],['uDensity',s.density],['uCutAngle',s.cutAngle*Math.PI/180],['uCutOffset',s.cutOffset],['uCurrent',s.basis==='complex'?1:0]])this.uniform(program,key,'uniform1f',value);
  for(const [key,value] of [['uLogScale',s.logScale?1:0],['uColorMap',colorMapIndex(s.colorMap)],['uBasis',s.basis==='real'?1:0],['uMode',colorMetricIndex(s.mode)],['uSeparateColors',s.separateColors?1:0],['uCut',['none','half','wedge','slice','sector15','custom','slab','radius'].indexOf(s.cut)]])this.uniform(program,key,'uniform1i',value);
  this.cameraUniforms(program);
 }
 volumeSignature(){
  const s=this.state,c=this.camera;return [this.lower.n,this.lower.l,this.lower.m,this.upper.n,this.upper.l,this.upper.m,this.population,this.populationRate,this.maxPopulationRate,s.basis,s.mode,s.logScale,s.colorMap,s.renderStyle,s.separateColors,s.cut,s.radiusLimit,s.planeAzimuth,s.planePolar,s.cutDegrees,s.sliceThickness,s.sliceHeight,s.sliceAxis,s.wedgePolar,s.sliceAzimuth,s.slicePolar,s.cutAngle,s.cutOffset,s.density,c.yaw,c.pitch,c.distance,this.tier,this.canvas.width,this.canvas.height,s.mode==='phase'?this.time:0].join('|');
 }
 drawVolume(){
  const gl=this.gl,s=this.state;
  if(s.renderStyle==='granular'){
   // The old 5.5% volume glow still paid for two orbital ray marches per pixel
   // on every population update. Granular is fully described by its particles.
   gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.disable(gl.BLEND);gl.disable(gl.DEPTH_TEST);gl.depthMask(true);
   gl.clearColor(.009,.012,.019,1.);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);return;
  }
  const key=this.volumeSignature();gl.disable(gl.DEPTH_TEST);gl.disable(gl.BLEND);gl.depthMask(false);
  if(!this.canCache||this.volumeKey!==key){
   gl.bindFramebuffer(gl.FRAMEBUFFER,this.canCache?this.volumeFBO:null);gl.useProgram(this.program);this.sharedUniforms(this.program);
   this.uniform(this.program,'uSteps','uniform1i',spectrumTiers[this.tier].steps);this.uniform(this.program,'uVolumeStrength','uniform1f',1);
   gl.bindVertexArray(this.vao);gl.drawArrays(gl.TRIANGLES,0,6);this.volumeKey=key;this.volumeRenderCount=(this.volumeRenderCount||0)+1;
  }
  if(this.canCache){gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.useProgram(this.copy);gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,this.volumeTexture);this.uniform(this.copy,'uTexture','uniform1i',1);gl.bindVertexArray(this.copyVAO);gl.drawArrays(gl.TRIANGLES,0,6);}
 }
 canUseSpherePoints(){
  // All generated samples lie inside the unit sphere. Bound the largest
  // projected sprite, including doubled footprints at clipped viewport edges.
  const distance=this.camera.distance*Math.max(1,1/(this.canvas.width/this.canvas.height));
  const radius=spectrumTiers[this.tier].radius*.95*1.18,minDepth=distance-1;
  if(minDepth<=radius+.015)return false;
  const bound=radius*1.04*(1.+1/(minDepth-radius));
  const maxDiameter=2*bound*2.45*this.canvas.height/minDepth+2;
  return maxDiameter<=this.maxPointSize;
 }
 hasAnimatedView(){
  const s=this.state;if(!s.animate)return false;
  return s.randomRotate||s.mode==='phase'||(s.particleAmount>0&&s.basis==='complex'&&((this.population<1&&this.lower.m!==0)||(this.population>0&&this.upper.m!==0)));
 }
 draw(now){
  if(this.dead||this.error||this.contextLost||!this.visible||document.hidden||!this.dirty)return;this.dirty=false;
  const elapsed=this.lastDraw?Math.max(0,now-this.lastDraw):0,dt=Math.min(elapsed/1000,.1),s=this.state,gl=this.gl,tier=spectrumTiers[this.tier];
  if(s.animate)this.time+=dt*s.speed;if(s.animate&&!this.pointers.size){if(s.randomRotate)this.randomMotion=advanceCameraTour(this.camera,this.randomMotion,dt);}else this.randomMotion=null;
  const cameraSignature=[this.camera.yaw,this.camera.pitch,this.camera.distance].join('|');
  const cameraMoves=this.lastCameraSignature!==null&&cameraSignature!==this.lastCameraSignature;
  const viewMoves=this.hasAnimatedView(),populationMoves=this.lastDrawPopulation!==null&&this.population!==this.lastDrawPopulation;
  const timer=this.beginGpuTimer();gl.viewport(0,0,this.canvas.width,this.canvas.height);this.drawVolume();
  const granular=s.renderStyle==='granular',sculpted=granular,pointSpheres=granular&&this.canUseSpherePoints(),budget=Math.round(spectrumMaxParticles*this.activeParticleAmount*(s.cut==='slab'?(s.renderStyle==='granular'?1.5:2):1));
  if(budget){
   const program=sculpted?(pointSpheres?this.spherePoint:this.sphere):this.particle;gl.useProgram(program);this.sharedUniforms(program);
   if(sculpted){gl.depthMask(true);gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LESS);gl.disable(gl.BLEND);gl.clear(gl.DEPTH_BUFFER_BIT);this.uniform(program,'uSphereRadius','uniform1f',tier.radius*(granular?.95:1));}
   else{gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE);this.uniform(program,'uPointScale','uniform1f',Math.min(1.7,this.canvas.width/Math.max(1,this.canvas.clientWidth)));this.uniform(program,'uTracerViewportScale','uniform1f',this.tracerViewportScale??1);}
   const lowerCount=Math.round(budget*(1-this.population));
   for(let component=0;component<2;component++){
    const count=granular?(component?budget-lowerCount:lowerCount):budget*(component?this.population:1-this.population);if(count<=0)continue;
    this.uniform(program,'uComponent','uniform1i',component);this.uniform(program,'uVisibleCount','uniform1f',count);
    gl.bindVertexArray(sculpted?(pointSpheres?this.spherePointVAOs[component]:this.sphereVAOs[component]):this.particleVAOs[component]);
    if(sculpted&&!pointSpheres)gl.drawArraysInstanced(gl.TRIANGLES,0,6,Math.ceil(count));else gl.drawArrays(gl.POINTS,0,Math.ceil(count));
   }
   gl.disable(gl.DEPTH_TEST);
  }
  if(s.axes){gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.useProgram(this.axis);this.cameraUniforms(this.axis);gl.bindVertexArray(this.axisVAO);gl.drawArrays(gl.LINES,0,6);}
  gl.bindVertexArray(null);this.endGpuTimer(timer);this.recordPerformance(now,viewMoves||populationMoves||cameraMoves);this.lastDrawPopulation=this.population;this.lastCameraSignature=cameraSignature;
  if(!this.reportedFrame||now-this.lastStats>1000){
   this.lastStats=now;this.reportedFrame=true;const mean=this.frames.reduce((a,b)=>a+b,0)/Math.max(1,this.frames.length);
   this.onStats({fps:mean?Math.round(Math.min(120,1000/mean)):60,targetFps:granular?30:60,adaptiveResolution:!granular,quality:spectrumTiers[this.tier].name,limited:budget<Math.round(spectrumMaxParticles*s.particleAmount*(s.cut==='slab'?(s.renderStyle==='granular'?1.5:2):1)),requestedParticles:Math.round(spectrumMaxParticles*s.particleAmount*(s.cut==='slab'?(s.renderStyle==='granular'?1.5:2):1)),particleAmount:s.particleAmount,activeParticleAmount:this.activeParticleAmount,idle:!viewMoves&&!populationMoves&&!cameraMoves,steps:spectrumTiers[this.tier].steps,particles:budget,resolution:[this.canvas.width,this.canvas.height],renderStyle:s.renderStyle,cachedVolume:!granular&&this.canCache&&s.mode==='density',particlePath:granular?(pointSpheres?'sphere-points':'sphere-quads'):'cloud-points'});
  }
  if(viewMoves)this.requestDraw();
 }
 beginGpuTimer(){
  const gl=this.gl,ext=this.timerExtension;if(!ext)return null;
  try{
   if(gl.getParameter(ext.GPU_DISJOINT_EXT)){for(const query of this.gpuQueries)gl.deleteQuery(query);this.gpuQueries=[];this.gpuTimes=[];return null;}
   while(this.gpuQueries.length&&gl.getQueryParameter(this.gpuQueries[0],gl.QUERY_RESULT_AVAILABLE)){const query=this.gpuQueries.shift(),ms=gl.getQueryParameter(query,gl.QUERY_RESULT)/1e6;gl.deleteQuery(query);if(ms>0&&ms<1000){this.gpuTimes.push(ms);if(this.gpuTimes.length>24)this.gpuTimes.shift();}}
   if(++this.timerFrame%6||this.gpuQueries.length>=4)return null;const query=gl.createQuery();gl.beginQuery(ext.TIME_ELAPSED_EXT,query);return query;
  }catch{this.timerExtension=null;return null;}
 }
 endGpuTimer(query){if(query){try{this.gl.endQuery(this.timerExtension.TIME_ELAPSED_EXT);this.gpuQueries.push(query);}catch{this.timerExtension=null;}}}
 recordPerformance(now,moving){
  const elapsed=this.lastDraw?now-this.lastDraw:0;this.lastDraw=now;
  if(!moving){this.frames=[];this.healthySince=null;this.slowSince=null;this.longFrames=0;return;}
  if(now<this.warmUntil||elapsed<=0)return;
  if(elapsed>250){if(++this.longFrames<2)return;}else this.longFrames=0;
  this.frames.push(Math.min(elapsed,1000));if(this.frames.length>30)this.frames.shift();const total=this.frames.reduce((a,b)=>a+b,0);
  if(this.frames.length<10&&total<400)return;const fps=1000*this.frames.length/total;
  const sorted=[...this.gpuTimes].sort((a,b)=>a-b),gpu90=sorted.length>=5?sorted[Math.floor((sorted.length-1)*.9)]:null;
  this.adaptTracers(now,fps,gpu90);
 }
  updateTracerCeiling(previous,requested){
    const active=this.activeParticleAmount;
    // An unconstrained request takes effect immediately. Once limited, increases
    // are earned by sustained headroom instead of restarting an overload.
    this.activeParticleAmount=active===undefined||active>=previous-1.e-8?requested:Math.min(active,requested);
    if(requested===0)this.activeParticleAmount=0;
  }
  adaptTracers(now,fps,gpu90){
    // Avoid progressively erasing a slice to chase an FPS target. Its conditional
    // sampling cost can remain high even after count reductions, and an idle
    // paused scene provides no recovery measurements.
    if(this.state.renderStyle==='granular'&&this.state.cut==='slab'){
      this.activeParticleAmount=this.state.particleAmount;
      this.healthySince=null;this.slowSince=null;this.limiterRecoveryUntil=0;
      return;
    }
    const ceiling=this.state.particleAmount;
    this.activeParticleAmount=Math.min(ceiling,this.activeParticleAmount??ceiling);
    const granular=this.state.renderStyle==='granular';
    // Granular protects 30 FPS using tracer count only. Cloud retains its 60 FPS policy.
    const slow=fps<(granular?29.5:59)||(gpu90!==null&&gpu90>(granular?32.5:15.8));
    const healthy=fps>=(granular?29.8:59.5)&&(gpu90===null||gpu90<(granular?28:12.5));
    const recoveryDelay=granular?1000:gpu90===null?10000:2500;
    if(slow){this.healthySince=null;if(this.slowSince==null)this.slowSince=now;}
    else if(healthy){this.slowSince=null;if(this.healthySince==null)this.healthySince=now;}
    else{this.healthySince=null;this.slowSince=null;}
    if(now-(this.lastTracerAdjustment||0)<600)return;
    let amount=this.activeParticleAmount,nextTier=this.tier;
    const floor=Math.min(ceiling,.0025);
    if(this.slowSince!=null&&now-this.slowSince>=300){
      if(!granular&&(this.decreaseCount||0)>=2&&fps<this.decreaseBaseline*1.05&&nextTier>0){nextTier--;this.decreaseCount=0;}
      else if(amount>floor){
        if(!this.decreaseCount)this.decreaseBaseline=fps;
        this.decreaseCount=(this.decreaseCount||0)+1;
        amount=Math.max(floor,Math.round(amount*(fps<(granular?22:45)?.60:.78)*200000)/200000);
      }else if(!granular&&nextTier>0){nextTier--;this.decreaseCount=0;}
      this.limiterRecoveryUntil=now+(granular?1500:4000);
    }else if(this.healthySince!=null&&now-this.healthySince>=recoveryDelay&&now>(this.limiterRecoveryUntil||0)){
      this.decreaseCount=0;
      if(amount<ceiling)amount=Math.min(ceiling,amount+(granular?Math.max(.05,amount*.30):Math.max(.005,amount*.035)));
      else if(!granular&&nextTier<3&&now-this.healthySince>=15000)nextTier++;
    }
    if(amount!==this.activeParticleAmount||nextTier!==this.tier){
      this.activeParticleAmount=Math.min(ceiling,Math.round(amount*200000)/200000);this.lastTracerAdjustment=now;
      this.frames=[];this.gpuTimes=[];this.healthySince=null;this.slowSince=null;this.warmUntil=now+200;
      if(nextTier!==this.tier){this.tier=nextTier;this.resize();}
      this.requestDraw();
    }
  }
 destroy(){
  this.dead=true;cancelAnimationFrame(this.raf);this.raf=0;this.resizeObserver?.disconnect();
  for(const [name,handler] of this.handlers||[])this.canvas.removeEventListener(name,handler);if(this.visibilityHandler)document.removeEventListener('visibilitychange',this.visibilityHandler);
  const gl=this.gl;if(gl&&!this.contextLost){
   clearSliceSampling(gl);
   for(const program of [this.program,this.copy,this.particle,this.sphere,this.spherePoint,this.axis])if(program)gl.deleteProgram(program);
   for(const buffer of [this.buffer,this.axisBuffer,...(this.particleBuffers||[])])if(buffer)gl.deleteBuffer(buffer);
   for(const vao of [this.vao,this.copyVAO,this.axisVAO,...(this.particleVAOs||[]),...(this.sphereVAOs||[]),...(this.spherePointVAOs||[])])if(vao)gl.deleteVertexArray(vao);
   for(const texture of [this.texture,this.volumeTexture])if(texture)gl.deleteTexture(texture);if(this.volumeFBO)gl.deleteFramebuffer(this.volumeFBO);for(const query of this.gpuQueries||[])gl.deleteQuery(query);
  }
 }
}
