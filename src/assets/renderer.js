/** Analytic hydrogen orbitals, in atomic units (a0 = 1). No external runtime. */
const TAU = Math.PI * 2;
const FACT = [1];
for (let i = 1; i < 32; i++) FACT[i] = FACT[i-1] * i;
const clamp = (v,lo,hi) => Math.max(lo,Math.min(hi,v));
export function orbitalExtent(n) { return 2.15 * n * n + 3; }
// Density shading and its legend share this dark-blue → ice-white ramp.
export function densityPalette(value) {
  const d=clamp(value,0,1),smooth=(a,b)=>{const t=clamp((d-a)/(b-a),0,1);return t*t*(3-2*t);};
  const mix=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
  let color=mix([.012,.045,.20],[.07,.32,.76],smooth(.001,.09));
  color=mix(color,[.48,.76,1],d**.44);
  return mix(color,[.93,.98,1],smooth(.5,1));
}
// Cyclic rainbow with smooth hue transitions, identical at every full turn.
export function phasePalette(value) {
  const t=value-Math.floor(value);
  return [0,2/3,1/3].map(offset=>{
    const h=t+offset-Math.floor(t+offset);
    const c=clamp(Math.abs(h*6-3)-1,0,1);
    return .045+.955*c*c*(3-2*c);
  });
}
function laguerre(k,a,x) {
  if (!k) return 1;
  let p = 1, q = 1 + a - x;
  for(let j=2;j<=k;j++) { const z=((2*j-1+a-x)*q-(j-1+a)*p)/j;p=q;q=z; }
  return q;
}
function legendre(l,m,x) {
  let p=1;
  if(m) { const s=Math.sqrt(Math.max(0,1-x*x));for(let j=1;j<=m;j++) p*=-(2*j-1)*s; }
  if(l===m)return p;
  let q=x*(2*m+1)*p;
  for(let j=m+2;j<=l;j++){const z=((2*j-1)*x*q-(j+m-1)*p)/(j-m);p=q;q=z;}
  return q;
}
function radial(n,l,r) {
  const u=2*r/n;
  return Math.sqrt(Math.pow(2/n,3)*FACT[n-l-1]/(2*n*FACT[n+l]))*Math.exp(-u/2)*Math.pow(u,l)*laguerre(n-l-1,2*l+1,u);
}
function angular(l,m,c) { return Math.sqrt((2*l+1)/(4*Math.PI)*FACT[l-Math.abs(m)]/FACT[l+Math.abs(m)])*legendre(l,Math.abs(m),clamp(c,-1,1)); }
export function densityAt(x,y,z,n,l,m,basis='complex') {
  const r=Math.hypot(x,y,z), a=radial(n,l,r)*angular(l,m,r>1e-10?z/r:1);
  if(basis!=='real'||!m) return a*a;
  const phi=Math.atan2(y,x), f=m>0?Math.cos(m*phi):Math.sin(-m*phi);
  return 2*a*a*f*f;
}

// All renderers evaluate the same normalized wavefunction. Optical transfer is artistic.
const common = `
precision highp float;
precision highp int;
uniform int uN,uL,uM,uBasis,uMode,uCut;
uniform float uExtent,uPeak,uTime,uDensity,uCutAngle,uCutOffset,uDisplayGain;
uniform float uNorm;
float lag(int k,int a,float x){
  if(k==0)return 1.;float p=1.,q=1.+float(a)-x;
  for(int j=2;j<=12;j++){if(j>k)break;float z=((2.*float(j)-1.+float(a)-x)*q-(float(j)-1.+float(a))*p)/float(j);p=q;q=z;}return q;
}
float leg(int l,int m,float x){
  float p=1.,s=sqrt(max(0.,1.-x*x));
  for(int j=1;j<=12;j++){if(j>m)break;p*=-float(2*j-1)*s;}
  if(l==m)return p;float q=x*float(2*m+1)*p;
  for(int j=2;j<=12;j++){if(j<m+2)continue;if(j>l)break;float z=(float(2*j-1)*x*q-float(j+m-1)*p)/float(j-m);p=q;q=z;}return q;
}
float amplitude(vec3 p){float rr=length(p),r=rr*uExtent,u=2.*r/float(uN);float c=rr>0.00001?p.z/rr:1.;return uNorm*exp(-u*.5)*pow(max(u,0.0000001),float(uL))*lag(uN-uL-1,2*uL+1,u)*leg(uL,abs(uM),clamp(c,-1.,1.));}
float dens(vec3 p){float a=amplitude(p);if(uBasis==1&&uM!=0){float ph=atan(p.y,p.x);a*=1.41421356*(uM>0?cos(float(uM)*ph):sin(float(-uM)*ph));}return a*a/uPeak;}
bool clipped(vec3 p){
  if(uCut==0)return false;
  float ca=cos(uCutAngle),sa=sin(uCutAngle);vec2 q=vec2(ca*p.x+sa*p.y,-sa*p.x+ca*p.y);
  if(uCut==1)return q.y>uCutOffset;
  if(uCut==2)return q.y>abs(q.x);
  return uCut==3&&abs(q.y-uCutOffset)>.028;
}
vec3 densityColor(float d){
  d=clamp(d,0.,1.);
  vec3 color=mix(vec3(.012,.045,.20),vec3(.07,.32,.76),smoothstep(.001,.09,d));
  color=mix(color,vec3(.48,.76,1.),pow(d,.44));
  return mix(color,vec3(.93,.98,1.),smoothstep(.5,1.,d));
}
vec3 rainbowColor(float t){vec3 c=clamp(abs(fract(t+vec3(0.,2./3.,1./3.))*6.-3.)-1.,0.,1.);c=c*c*(3.-2.*c);return mix(vec3(.045),vec3(1.),c);}
vec3 phaseColor(vec3 p){float a=amplitude(p);if(uBasis==0&&uM<0&&abs(uM)%2==1)a=-a;float ph=float(uM)*atan(p.y,p.x);if(uBasis==1){if(uM>0)a*=cos(float(uM)*atan(p.y,p.x));if(uM<0)a*=sin(float(-uM)*atan(p.y,p.x));ph=0.;}if(a<0.)ph+=3.14159265;ph+=uTime*.115*float(uN*uN);return rainbowColor(ph/6.28318530+.5);}
vec3 particlePosition(vec4 seed,float current){
  float r=seed.x,c=seed.y,s=sqrt(max(0.,1.-c*c));
  float omega=float(uM)*pow(float(uN),4.)*.23/max(.001,pow(r*uExtent*s,2.));
  float phi=seed.z+uTime*omega*current;
  return vec3(r*s*cos(phi),r*s*sin(phi),r*c);
}
`;
const volumeVertex=`#version 300 es
in vec2 aPosition;out vec2 vUv;void main(){vUv=aPosition*.5+.5;gl_Position=vec4(aPosition,0.,1.);}`;
const volumeFragment=`#version 300 es
${common}
in vec2 vUv;out vec4 outColor;
uniform vec2 uResolution;uniform vec3 uCamera,uRight,uUp,uForward;uniform int uSteps;uniform float uFocal,uVolumeStrength;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
void main(){
  vec2 p=vUv*2.-1.;p.x*=uResolution.x/uResolution.y;
  vec3 ray=normalize(uForward*uFocal+p.x*uRight+p.y*uUp);
  float b=dot(uCamera,ray),c=dot(uCamera,uCamera)-1.01,disc=b*b-c;
  vec3 bg=vec3(.009,.012,.019);
  if(disc<0.){outColor=vec4(bg,1.);return;}
  float nearT=max(0.,-b-sqrt(disc)),farT=-b+sqrt(disc),dt=(farT-nearT)/float(uSteps);
  float t=nearT+dt*hash(gl_FragCoord.xy),trans=1.;vec3 col=vec3(0.);
  for(int i=0;i<260;i++){
    if(i>=uSteps||trans<.009)break;
    vec3 pos=uCamera+ray*t;t+=dt;if(clipped(pos))continue;
    float fade=1.-smoothstep(.82,1.,length(pos));
    float d=dens(pos)*uDisplayGain*fade;if(d<.000015)continue;
    float fog=pow(d,.78),alpha=1.-exp(-fog*dt*uDensity*9.);
    vec3 shade=densityColor(d);
    if(uMode==1)shade=phaseColor(pos);
    float dl=dens(pos+vec3(-.018,-.023,.028))*uDisplayGain*fade;
    shade*=clamp(.85+(d-dl)/max(.045,d)*1.1,.45,1.2);
    col+=trans*alpha*shade;trans*=1.-alpha;
  }
  col=vec3(1.)-exp(-col*1.9);col=pow(col,vec3(.87))*uVolumeStrength;
  outColor=vec4(col+bg*trans,1.);
}`;
const copyVertex=volumeVertex;
const copyFragment=`#version 300 es
precision highp float;in vec2 vUv;uniform sampler2D uTexture;out vec4 outColor;void main(){outColor=texture(uTexture,vUv);}`;
const particleVertex=`#version 300 es
${common}
in vec4 aParticle;uniform vec3 uCamera,uRight,uUp,uForward;uniform vec2 uResolution;uniform float uFocal,uPointScale,uCurrent;out vec4 vColor;
void main(){
  vec3 p=particlePosition(aParticle,uCurrent);
  if(clipped(p)){gl_Position=vec4(2.,2.,2.,1.);gl_PointSize=0.;vColor=vec4(0.);return;}
  vec3 d=p-uCamera;float z=dot(d,uForward),x=dot(d,uRight),y=dot(d,uUp);
  gl_Position=vec4(x*uFocal*uResolution.y/uResolution.x,y*uFocal,0.,z);
  // Size in CSS pixels is preserved when the adaptive framebuffer is downscaled.
  gl_PointSize=clamp((2.3+aParticle.w*1.6)*uPointScale*2.6/z,.9,7.);
  float den=clamp(dens(p)*uDisplayGain,0.,1.);
  vec3 color=uMode==1?phaseColor(p):densityColor(den);
  vColor=vec4(color,.27+.43*aParticle.w);
}`;
const particleFragment=`#version 300 es
precision highp float;in vec4 vColor;out vec4 outColor;void main(){float r=length(gl_PointCoord*2.-1.);if(r>1.)discard;outColor=vec4(vColor.rgb,vColor.a*exp(-r*r*3.5));}`;
// An analytic sphere silhouette gives instanced beads smooth lighting and exact depth.
const sphereVertex=`#version 300 es
${common}
layout(location=0) in vec2 aCorner;layout(location=1) in vec4 aParticle;
uniform vec3 uCamera,uRight,uUp,uForward;uniform vec2 uResolution;
uniform float uFocal,uCurrent,uSphereRadius;
out vec3 vPlane;flat out vec3 vCenter,vColor;flat out float vRadius,vDensity;
void main(){
  vec3 p=particlePosition(aParticle,uCurrent);
  float radius=uSphereRadius*(.82+.36*aParticle.w);
  if(radius<=0.||clipped(p)){gl_Position=vec4(2.,2.,2.,1.);vCenter=vec3(0.);vPlane=vec3(0.);vRadius=0.;vColor=vec3(0.);vDensity=0.;return;}
  vec3 rel=p-uCamera;vec3 center=vec3(dot(rel,uRight),dot(rel,uUp),dot(rel,uForward));
  float bound=radius*1.04*(1.+length(center.xy)/max(.05,center.z-radius));
  vec3 plane=center+vec3(aCorner*bound,0.);
  vPlane=plane;vCenter=center;vRadius=radius;
  float d=clamp(dens(p)*uDisplayGain,0.,1.);vDensity=d;
  vColor=uMode==1?phaseColor(p):densityColor(d);
  float A=1.002002,B=-.1001001;
  gl_Position=vec4(plane.x*uFocal*uResolution.y/uResolution.x,plane.y*uFocal,A*plane.z+B,plane.z);
}`;
const sphereFragment=`#version 300 es
precision highp float;
in vec3 vPlane;flat in vec3 vCenter,vColor;flat in float vRadius,vDensity;
uniform float uDensity,uSculptLight,uCameraDistance,uPolish;
out vec4 outColor;
void main(){
  if(vRadius<=0.)discard;
  vec3 ray=normalize(vPlane);float b=dot(ray,vCenter);
  vec3 closest=vCenter-ray*b;float h=vRadius*vRadius-dot(closest,closest);if(h<0.)discard;
  vec3 hit=ray*(b-sqrt(h)),normal=normalize(hit-vCenter);
  vec3 light=normalize(vec3(-.5,.7,-.8));
  float diffuse=max(dot(normal,light),0.);
  vec3 halfVector=normalize(light-ray);
  float spec=pow(max(dot(normal,halfVector),0.),48.);
  float softSpec=pow(max(dot(normal,halfVector),0.),12.);
  float fill=max(dot(normal,normalize(vec3(.7,-.15,-.5))),0.);
  vec3 central=normalize(vec3(0.,0.,uCameraDistance)-hit);
  float inner=max(dot(normal,central),0.);
  float fresnel=pow(1.-max(dot(normal,-ray),0.),3.);
  float illumination=.23+.71*diffuse+.18*inner+.10*fill;
  vec3 linear=vColor*illumination;
  linear+=vec3(.66,.84,1.)*(spec*.56+softSpec*.055*uPolish)*(.12+.88*sqrt(vDensity));
  linear+=vec3(.18,.48,.95)*fresnel*.15*uPolish*(.3+.7*sqrt(vDensity));
  linear+=vColor*pow(vDensity,1.35)*uSculptLight;
  linear*=pow(uDensity,.55);
  outColor=vec4(clamp(pow(linear,vec3(.90)),0.,1.),1.);
  gl_FragDepth=.5*(1.002002-.1001001/hit.z)+.5;
}`;
const axisVertex=`#version 300 es
precision highp float;in vec3 aPosition;in vec3 aColor;uniform vec3 uCamera,uRight,uUp,uForward;uniform vec2 uResolution;uniform float uFocal;out vec3 vColor;void main(){vec3 d=aPosition-uCamera;float z=dot(d,uForward);gl_Position=vec4(dot(d,uRight)*uFocal*uResolution.y/uResolution.x,dot(d,uUp)*uFocal,0.,z);vColor=aColor;}`;
const axisFragment=`#version 300 es
precision highp float;in vec3 vColor;out vec4 outColor;void main(){outColor=vec4(vColor,.42);}`;

function compile(gl,type,source){const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){const error=gl.getShaderInfoLog(s);gl.deleteShader(s);throw new Error(error);}return s;}
function program(gl,vs,fs){const p=gl.createProgram(),v=compile(gl,gl.VERTEX_SHADER,vs),f=compile(gl,gl.FRAGMENT_SHADER,fs);gl.attachShader(p,v);gl.attachShader(p,f);gl.linkProgram(p);gl.deleteShader(v);gl.deleteShader(f);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(p));return p;}
function inverseCDF(cdf,u){let lo=0,hi=cdf.length-1;while(lo+1<hi){const m=(lo+hi)>>1;if(cdf[m]<u)lo=m;else hi=m;}return (lo+(u-cdf[lo])/Math.max(1e-12,cdf[hi]-cdf[lo]))/(cdf.length-1);}
const MAX_PARTICLES=48000;
const TIERS=[
  {name:'Low',scale:.60,steps:70,particles:3200,spheres:4500,radius:.009},
  {name:'Medium',scale:.85,steps:110,particles:6500,spheres:11000,radius:.0075},
  {name:'High',scale:1.2,steps:160,particles:14000,spheres:26000,radius:.0065},
  {name:'Ultra',scale:1.6,steps:240,particles:28000,spheres:36000,radius:.0060}
];
const INTRO_CAMERA={yaw:.63,pitch:.30,distance:2.80};

export class OrbitalRenderer {
  constructor(canvas,{onStats=()=>{},onError=()=>{}}={}) {
    this.canvas=canvas;this.onStats=onStats;this.onError=onError;
    this.state={n:6,l:3,m:1,basis:'complex',mode:'density',renderStyle:'cloud',cut:'none',cutAngle:0,cutOffset:0,density:1,particleAmount:.5,speed:.5,animate:true,autoRotate:false,quality:'auto',axes:false};
    this.camera={...INTRO_CAMERA};this.time=0;this.dead=false;this.points=new Map();
    this.touchDevice=typeof matchMedia==='function'&&matchMedia('(pointer: coarse)').matches;
    this.tier=this.touchDevice?1:((typeof navigator!=='undefined'&&navigator.hardwareConcurrency<6)?1:2);
    this.frameTimes=[];this.lastQualityChange=performance.now();this.lastStats=0;this.lastFrame=null;this.dragging=false;this.contextLost=false;this.volumeKey='';
    try {
      this.gl=canvas.getContext('webgl2',{alpha:false,antialias:false,depth:true,powerPreference:'high-performance',preserveDrawingBuffer:false});
      if(!this.gl)throw new Error('This browser does not expose WebGL 2. Please enable hardware acceleration or try a current browser.');
      this.init();this.bindEvents();this.prepareOrbital();this.resize(true);this.raf=requestAnimationFrame(t=>this.frame(t));
    }catch(e){this.error=e;onError(e.message);console.error('Orbital renderer:',e);}
  }
  init(){
    const gl=this.gl;this.uniforms=new Map();
    this.volume=program(gl,volumeVertex,volumeFragment);this.copy=program(gl,copyVertex,copyFragment);
    this.particle=program(gl,particleVertex,particleFragment);this.sphere=program(gl,sphereVertex,sphereFragment);this.axis=program(gl,axisVertex,axisFragment);
    this.quadBuffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,this.quadBuffer);
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
    this.quad=gl.createVertexArray();gl.bindVertexArray(this.quad);let loc=gl.getAttribLocation(this.volume,'aPosition');gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,2,gl.FLOAT,false,0,0);
    this.copyVAO=gl.createVertexArray();gl.bindVertexArray(this.copyVAO);loc=gl.getAttribLocation(this.copy,'aPosition');gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,2,gl.FLOAT,false,0,0);
    this.particleBuffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,this.particleBuffer);
    this.particleVAO=gl.createVertexArray();gl.bindVertexArray(this.particleVAO);loc=gl.getAttribLocation(this.particle,'aParticle');gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,4,gl.FLOAT,false,0,0);
    this.sphereVAO=gl.createVertexArray();gl.bindVertexArray(this.sphereVAO);loc=gl.getAttribLocation(this.sphere,'aParticle');gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,4,gl.FLOAT,false,0,0);gl.vertexAttribDivisor(loc,1);
    gl.bindBuffer(gl.ARRAY_BUFFER,this.quadBuffer);loc=gl.getAttribLocation(this.sphere,'aCorner');gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,2,gl.FLOAT,false,0,0);
    this.axisVAO=gl.createVertexArray();gl.bindVertexArray(this.axisVAO);this.axisBuffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,this.axisBuffer);
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,0,0,.37,.57,.8,1,0,0,.37,.57,.8,0,-1,0,.37,.57,.8,0,1,0,.37,.57,.8,0,0,-1,.68,.83,1.,0,0,1,.68,.83,1.]),gl.STATIC_DRAW);
    for(const [name,offset] of [['aPosition',0],['aColor',12]]){loc=gl.getAttribLocation(this.axis,name);gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,3,gl.FLOAT,false,24,offset);}
    gl.bindVertexArray(null);gl.disable(gl.DEPTH_TEST);
    this.volumeTexture=gl.createTexture();this.volumeFBO=gl.createFramebuffer();this.volumeKey='';this.lastDrawSignature='';
    this.timerExtension=gl.getExtension?.('EXT_disjoint_timer_query_webgl2')||null;
    this.gpuQueries=[];this.gpuTimes=[];this.timerFrame=0;
    this.resetPerformance(performance.now());
  }
  bindEvents(){
    this.handlers={};const on=(name,fn,opts)=>{this.handlers[name]=fn;this.canvas.addEventListener(name,fn,opts);};this.canvas.style.touchAction='none';
    on('pointerdown',e=>{this.canvas.setPointerCapture(e.pointerId);this.points.set(e.pointerId,[e.clientX,e.clientY]);this.dragging=true;this.canvas.style.cursor='grabbing';});
    on('pointermove',e=>{if(!this.points.has(e.pointerId))return;const old=this.points.get(e.pointerId),current=[e.clientX,e.clientY];if(this.points.size===1){this.camera.yaw-=(current[0]-old[0])*.007;this.camera.pitch=clamp(this.camera.pitch+(current[1]-old[1])*.007,-1.48,1.48);}else{const other=[...this.points.entries()].find(([id])=>id!==e.pointerId)?.[1];if(other){const d0=Math.hypot(old[0]-other[0],old[1]-other[1]),d1=Math.hypot(current[0]-other[0],current[1]-other[1]);if(d0&&d1)this.zoomBy(d0/d1);}}this.points.set(e.pointerId,current);});
    const end=e=>{this.points.delete(e.pointerId);this.dragging=this.points.size>0;this.canvas.style.cursor='grab';};on('pointerup',end);on('pointercancel',end);on('lostpointercapture',end);
    on('wheel',e=>{e.preventDefault();this.zoomBy(Math.exp(e.deltaY*.001));},{passive:false});on('dblclick',()=>this.resetView());
    on('webglcontextlost',e=>{e.preventDefault();this.contextLost=true;this.onError('The GPU context was interrupted. Restoring the orbital…');});
    on('webglcontextrestored',()=>{try{this.contextLost=false;this.init();this.setState({quality:this.state.quality});this.prepareOrbital();this.resize(true);this.lastFrame=null;this.onError('');}catch(e){this.onError(e.message);}});
    this.visibilityHandler=()=>{this.lastFrame=null;this.resetPerformance(performance.now());this.lastDrawSignature='';};document.addEventListener('visibilitychange',this.visibilityHandler);
    this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(this.canvas);
  }
  resetView(){this.camera={...INTRO_CAMERA};}
  zoomBy(factor){this.camera.distance=clamp(this.camera.distance*factor,1.25,6.5);}
  setState(partial){
    const old=this.state;this.state={...old,...partial};const s=this.state;
    s.n=clamp(Math.round(s.n),1,6);s.l=clamp(Math.round(s.l),0,s.n-1);s.m=clamp(Math.round(s.m),-s.l,s.l);
    s.density=clamp(s.density,.1,4);s.particleAmount=clamp(s.particleAmount,0,1);s.speed=clamp(s.speed,0,3);
    s.renderStyle=s.renderStyle==='sculpted'?'sculpted':'cloud';
    if(old.n!==s.n||old.l!==s.l||old.m!==s.m||old.basis!==s.basis)this.prepareOrbital();
    if(old.animate!==s.animate)this.lastFrame=null;
    if(old.mode!==s.mode||old.renderStyle!==s.renderStyle||old.particleAmount!==s.particleAmount)this.resetPerformance(performance.now());
    if(old.quality!==s.quality){if(s.quality!=='auto')this.tier=Math.max(0,['low','medium','high','ultra'].indexOf(s.quality));this.lastQualityChange=performance.now();this.resetPerformance(this.lastQualityChange);this.resize(true);}
  }
  prepareOrbital(){
    if(!this.gl||this.error)return;
    const {n,l,m,basis}=this.state,q=Math.abs(m),extent=orbitalExtent(n);this.extent=extent;
    this.norm=Math.sqrt(Math.pow(2/n,3)*FACT[n-l-1]/(2*n*FACT[n+l])*(2*l+1)/(4*Math.PI)*FACT[l-q]/FACT[l+q]);
    let peakR=0,peakA=0,radialMassPeak=0,densityAtMassPeak=0;
    for(let i=0;i<1500;i++){const r=extent*i/1499,d=radial(n,l,r)**2;peakR=Math.max(peakR,d);if(r*r*d>radialMassPeak){radialMassPeak=r*r*d;densityAtMassPeak=d;}}
    this.displayGain=Math.max(1,.3*peakR/Math.max(1e-30,densityAtMassPeak));
    for(let i=0;i<600;i++)peakA=Math.max(peakA,angular(l,m,2*i/599-1)**2);
    this.peak=Math.max(1e-20,peakR*peakA*(basis==='real'&&m?2:1));
    const rc=new Float64Array(1500),ac=new Float64Array(800);
    for(let i=1;i<rc.length;i++){const r=extent*i/(rc.length-1);rc[i]=rc[i-1]+r*r*radial(n,l,r)**2;}
    for(let i=1;i<ac.length;i++)ac[i]=ac[i-1]+angular(l,m,2*i/(ac.length-1)-1)**2;
    const radialSum=rc[rc.length-1],angularSum=ac[ac.length-1];
    for(let i=1;i<rc.length;i++)rc[i]/=radialSum;for(let i=1;i<ac.length;i++)ac[i]/=angularSum;
    const data=new Float32Array(MAX_PARTICLES*4);let seed=761+n*919+l*313+q*51;
    const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)|0;return(seed>>>0)/4294967296;};
    for(let i=0;i<MAX_PARTICLES;i++){const r=inverseCDF(rc,random()),c=inverseCDF(ac,random())*2-1;let ph=random()*TAU;if(basis==='real'&&m){for(let k=0;k<80;k++){ph=random()*TAU;const f=m>0?Math.cos(m*ph):Math.sin(-m*ph);if(random()<f*f)break;}}data.set([r,c,ph,random()],i*4);}
    const gl=this.gl;gl.bindBuffer(gl.ARRAY_BUFFER,this.particleBuffer);gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);this.time=0;this.volumeKey='';this.lastDrawSignature='';this.resetPerformance(performance.now());
  }
  resize(force=false){
    if(!this.gl)return;
    const b=this.canvas.getBoundingClientRect(),tier=TIERS[this.tier],dpr=Math.min(window.devicePixelRatio||1,2);
    let scale=Math.min(dpr,tier.scale);const maxPixels=this.tier===3?2400000:this.tier===2?1400000:800000;
    scale=Math.min(scale,Math.sqrt(maxPixels/Math.max(1,b.width*b.height)));
    const w=Math.max(1,Math.round(b.width*scale)),h=Math.max(1,Math.round(b.height*scale));
    if(force||w!==this.canvas.width||h!==this.canvas.height){
      this.canvas.width=w;this.canvas.height=h;const gl=this.gl;gl.viewport(0,0,w,h);
      gl.bindTexture(gl.TEXTURE_2D,this.volumeTexture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,w,h,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
      gl.bindFramebuffer(gl.FRAMEBUFFER,this.volumeFBO);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,this.volumeTexture,0);
      this.canCache=gl.checkFramebufferStatus(gl.FRAMEBUFFER)===gl.FRAMEBUFFER_COMPLETE;
      gl.bindFramebuffer(gl.FRAMEBUFFER,null);this.volumeKey='';this.lastDrawSignature='';
    }
  }
  uniform(p,name,type,...v){const gl=this.gl;let map=this.uniforms.get(p);if(!map){map=new Map();this.uniforms.set(p,map);}if(!map.has(name))map.set(name,gl.getUniformLocation(p,name));const loc=map.get(name);if(loc!==null)gl[type](loc,...v);}
  cameraUniforms(p){
    const {yaw:y,pitch:e}=this.camera;
    const fit=Math.max(1,.95/(this.canvas.width/this.canvas.height));
    const d=this.camera.distance*fit,ce=Math.cos(e),se=Math.sin(e),sy=Math.sin(y),cy=Math.cos(y);
    this.uniform(p,'uCamera','uniform3f',sy*ce*d,cy*ce*d,se*d);this.uniform(p,'uRight','uniform3f',cy,-sy,0);
    this.uniform(p,'uUp','uniform3f',-sy*se,-cy*se,ce);this.uniform(p,'uForward','uniform3f',-sy*ce,-cy*ce,-se);
    this.uniform(p,'uResolution','uniform2f',this.canvas.width,this.canvas.height);this.uniform(p,'uFocal','uniform1f',2.45);
    this.uniform(p,'uCameraDistance','uniform1f',d);
  }
  sharedUniforms(p){
    const s=this.state;
    for(const [k,v] of [['uN',s.n],['uL',s.l],['uM',s.m],['uBasis',s.basis==='real'?1:0],['uMode',s.mode==='phase'?1:0],['uCut',['none','half','wedge','slice'].indexOf(s.cut)]])this.uniform(p,k,'uniform1i',v);
    for(const [k,v] of [['uExtent',this.extent],['uPeak',this.peak],['uDisplayGain',this.displayGain],['uNorm',this.norm],['uTime',this.time],['uDensity',s.density],['uCutAngle',s.cutAngle*Math.PI/180],['uCutOffset',s.cutOffset]])this.uniform(p,k,'uniform1f',v);
    this.cameraUniforms(p);
  }
  volumeSignature(){
    const s=this.state,c=this.camera;
    return [s.n,s.l,s.m,s.basis,s.mode,s.renderStyle,s.cut,s.cutAngle,s.cutOffset,s.density,c.yaw,c.pitch,c.distance,this.tier,this.canvas.width,this.canvas.height,s.mode==='phase'?this.time:0].join('|');
  }
  drawVolume(){
    const gl=this.gl,s=this.state,key=this.volumeSignature();
    gl.disable(gl.DEPTH_TEST);gl.disable(gl.BLEND);gl.depthMask(false);
    if(!this.canCache||this.volumeKey!==key){
      gl.bindFramebuffer(gl.FRAMEBUFFER,this.canCache?this.volumeFBO:null);
      gl.useProgram(this.volume);this.sharedUniforms(this.volume);
      this.uniform(this.volume,'uSteps','uniform1i',TIERS[this.tier].steps);
      this.uniform(this.volume,'uVolumeStrength','uniform1f',s.renderStyle==='sculpted'?(this.tier===3?.30:.22):1.);
      gl.bindVertexArray(this.quad);gl.drawArrays(gl.TRIANGLES,0,6);this.volumeKey=key;this.volumeRenderCount=(this.volumeRenderCount||0)+1;
    }
    if(this.canCache){
      gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.useProgram(this.copy);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,this.volumeTexture);
      this.uniform(this.copy,'uTexture','uniform1i',0);gl.bindVertexArray(this.copyVAO);gl.drawArrays(gl.TRIANGLES,0,6);
    }
  }
  resetPerformance(now){
    this.frameTimes=[];this.gpuTimes=[];this.healthySince=null;this.slowSince=null;this.longFrames=0;this.wasPerformanceIdle=false;
    for(const query of this.gpuQueries||[])this.gl.deleteQuery(query);this.gpuQueries=[];
    this.performanceWarmup=now+1500;this.adaptiveRecoveryUntil=this.adaptiveRecoveryUntil||0;
  }
  beginGpuTimer(){
    const gl=this.gl,extension=this.timerExtension;if(!extension)return null;
    try{
      if(gl.getParameter(extension.GPU_DISJOINT_EXT)){
        for(const query of this.gpuQueries)gl.deleteQuery(query);this.gpuQueries=[];this.gpuTimes=[];return null;
      }
      while(this.gpuQueries.length&&gl.getQueryParameter(this.gpuQueries[0],gl.QUERY_RESULT_AVAILABLE)){
        const query=this.gpuQueries.shift(),milliseconds=gl.getQueryParameter(query,gl.QUERY_RESULT)/1e6;gl.deleteQuery(query);
        if(milliseconds>0&&milliseconds<1000){this.gpuTimes.push(milliseconds);if(this.gpuTimes.length>24)this.gpuTimes.shift();}
      }
      if(++this.timerFrame%6||this.gpuQueries.length>=4)return null;
      const query=gl.createQuery();gl.beginQuery(extension.TIME_ELAPSED_EXT,query);return query;
    }catch(error){this.timerExtension=null;return null;}
  }
  endGpuTimer(query){
    if(!query)return;
    try{this.gl.endQuery(this.timerExtension.TIME_ELAPSED_EXT);this.gpuQueries.push(query);}catch(error){this.timerExtension=null;}
  }
  recordPerformance(now,elapsed,idle){
    // A stationary scene is not evidence that a more expensive quality level is fast.
    if(idle){this.healthySince=null;this.slowSince=null;this.wasPerformanceIdle=true;return;}
    if(this.wasPerformanceIdle)this.resetPerformance(now);
    if(now<this.performanceWarmup||elapsed<=0)return;
    if(elapsed>250){if(++this.longFrames<2)return;}else this.longFrames=0;
    this.frameTimes.push(Math.min(elapsed,1000));if(this.frameTimes.length>90)this.frameTimes.shift();
    const total=this.frameTimes.reduce((a,b)=>a+b,0);
    if(this.frameTimes.length<20&&total<900)return;
    const mean=total/this.frameTimes.length,fps=1000/mean;
    const sorted=[...this.gpuTimes].sort((a,b)=>a-b),gpu90=sorted.length>=5?sorted[Math.floor((sorted.length-1)*.9)]:null;
    const slow=fps<42||(gpu90!==null&&gpu90>27&&fps<54);
    const healthy=fps>=55&&(gpu90===null||gpu90<8.5);
    if(slow){if(this.slowSince===null)this.slowSince=now;this.healthySince=null;}
    else if(healthy){if(this.healthySince===null)this.healthySince=now;this.slowSince=null;}
    else{this.healthySince=null;this.slowSince=null;}
    if(this.state.quality!=='auto')return;
    let next=this.tier;
    if(next>0&&this.slowSince!==null&&now-this.slowSince>=650&&now-this.lastQualityChange>=2000){next--;this.adaptiveRecoveryUntil=now+30000;}
    else if(next<3&&this.healthySince!==null&&now-this.healthySince>=12000&&now-this.lastQualityChange>=12000&&now>=this.adaptiveRecoveryUntil)next++;
    if(next!==this.tier){this.tier=next;this.lastQualityChange=now;this.resetPerformance(now);this.resize(true);}
  }
  visualSignature(){
    const s=this.state;
    const moves=s.mode==='phase'||(s.particleAmount>0&&s.basis==='complex'&&s.m!==0);
    return this.volumeSignature()+'|'+[s.particleAmount,s.axes,s.quality,moves?this.time:0].join('|');
  }
  frame(now){
    if(this.dead)return;this.raf=requestAnimationFrame(t=>this.frame(t));
    if(this.contextLost||document.hidden){this.lastFrame=null;return;}
    const elapsed=this.lastFrame===null?0:Math.max(0,now-this.lastFrame);this.lastFrame=now;
    const dt=elapsed/1000,s=this.state,gl=this.gl;
    if(s.animate)this.time+=dt*s.speed;if(s.animate&&s.autoRotate&&!this.dragging)this.camera.yaw+=dt*.14;
    const tier=TIERS[this.tier],sculpted=s.renderStyle==='sculpted';
    const count=Math.round((sculpted?tier.spheres:tier.particles)*s.particleAmount);
    const visualKey=this.visualSignature(),idle=visualKey===this.lastDrawSignature;
    if(!idle){
      const timer=this.beginGpuTimer();
      this.drawVolume();
      if(count){
        if(sculpted){
          gl.depthMask(true);gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LESS);gl.disable(gl.BLEND);
          gl.useProgram(this.sphere);this.sharedUniforms(this.sphere);
          this.uniform(this.sphere,'uCurrent','uniform1f',s.basis==='complex'?1:0);
          this.uniform(this.sphere,'uSphereRadius','uniform1f',tier.radius);
          this.uniform(this.sphere,'uSculptLight','uniform1f',this.tier===3?.42:.20);
          this.uniform(this.sphere,'uPolish','uniform1f',this.tier===3?1.:.4);
          gl.clear(gl.DEPTH_BUFFER_BIT);gl.bindVertexArray(this.sphereVAO);gl.drawArraysInstanced(gl.TRIANGLES,0,6,count);gl.disable(gl.DEPTH_TEST);
        }else{
          gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE);gl.useProgram(this.particle);this.sharedUniforms(this.particle);
          this.uniform(this.particle,'uCurrent','uniform1f',s.basis==='complex'?1:0);
          this.uniform(this.particle,'uPointScale','uniform1f',Math.min(1.7,this.canvas.width/Math.max(1,this.canvas.clientWidth)));
          gl.bindVertexArray(this.particleVAO);gl.drawArrays(gl.POINTS,0,count);
        }
      }
      if(s.axes){gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.useProgram(this.axis);this.cameraUniforms(this.axis);gl.bindVertexArray(this.axisVAO);gl.drawArrays(gl.LINES,0,6);}
      gl.bindVertexArray(null);this.endGpuTimer(timer);this.lastDrawSignature=visualKey;
    }
    this.recordPerformance(now,elapsed,idle);
    if(now-this.lastStats>1000){
      this.lastStats=now;const mean=this.frameTimes.reduce((a,b)=>a+b,0)/Math.max(1,this.frameTimes.length),fps=mean?Math.min(120,1000/mean):60;
      this.onStats({fps:Math.round(fps),quality:TIERS[this.tier].name,particles:count,resolution:[this.canvas.width,this.canvas.height],steps:TIERS[this.tier].steps,gpu:'WebGL2',adaptive:s.quality==='auto',renderStyle:s.renderStyle,cachedVolume:this.canCache&&s.mode==='density',idle});
    }
  }
  destroy(){
    this.dead=true;cancelAnimationFrame(this.raf);this.resizeObserver?.disconnect();
    for(const [name,fn] of Object.entries(this.handlers||{}))this.canvas.removeEventListener(name,fn);
    document.removeEventListener('visibilitychange',this.visibilityHandler);
    const gl=this.gl;if(gl){
      for(const p of [this.volume,this.copy,this.particle,this.sphere,this.axis])if(p)gl.deleteProgram(p);
      for(const b of [this.quadBuffer,this.particleBuffer,this.axisBuffer])if(b)gl.deleteBuffer(b);
      for(const v of [this.quad,this.copyVAO,this.particleVAO,this.sphereVAO,this.axisVAO])if(v)gl.deleteVertexArray(v);
      if(this.volumeTexture)gl.deleteTexture(this.volumeTexture);if(this.volumeFBO)gl.deleteFramebuffer(this.volumeFBO);for(const query of this.gpuQueries||[])gl.deleteQuery(query);
    }
  }
}
