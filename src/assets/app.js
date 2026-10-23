import { OrbitalRenderer, densityAt, orbitalExtent, densityPalette } from './renderer.js?v=4';

const $ = id => document.getElementById(id);
const mathFragments = window.OrbitalMathFragments || {};
const mathHTML = key => mathFragments[key] || key;
document.querySelectorAll('[data-math]').forEach(element => { element.innerHTML = mathHTML(element.dataset.math); });
const family = ['s','p','d','f','g','h'];
const state = {n:6,l:3,m:1,basis:'complex',mode:'density',renderStyle:'cloud',cut:'none',cutAngle:0,cutOffset:0,density:1,particleAmount:.65,speed:1,animate:true,autoRotate:false,quality:'auto',axes:false};
const appearanceIntensity = {cloud:1,sculpted:1.35};
const blueGradient = `linear-gradient(90deg,${Array.from({length:33},(_,i)=>`rgb(${densityPalette(i/32).map(v=>Math.round(v*255)).join(',')}) ${i/32*100}%`).join(',')})`;
const initial = new URLSearchParams(location.hash.slice(1));
if(initial.has('n')){state.n=Math.round(Math.max(1,Math.min(6,+initial.get('n')||6)));state.l=Math.round(Math.max(0,Math.min(state.n-1,+initial.get('l')||0)));state.m=Math.round(Math.max(-state.l,Math.min(state.l,+initial.get('m')||0)));if(initial.get('basis')==='real')state.basis='real';}
let renderer;
let firstFrame=true;
try {
 renderer = new OrbitalRenderer($('orbital-canvas'), {
  onStats(info){
   if(firstFrame){$('loading').hidden=true;firstFrame=false;}
   $('render-status').textContent=`${info.idle?'IDLE':`${info.fps} FPS`} · ${info.quality.toUpperCase()}${info.adaptive?' AUTO':''}`;
   $('render-status').parentElement.title=`WebGL 2 · ${info.resolution.join(' × ')} pixels · ${info.steps} samples per ray · ${info.particles.toLocaleString()} tracers`;
  },
  onError(message){$('loading').hidden=true;$('scene-error').hidden=!message;if(message)$('scene-error').querySelector('p').textContent=message;}
 });
 renderer.setState(state);
} catch(error){$('loading').hidden=true;$('scene-error').hidden=false;console.error(error);}
// Exposed for accessible keyboard control and debugging; state changes use the same path as the UI.
window.orbitalApp={get state(){return {...state};},get renderer(){return renderer;},setState:update};

function setSelected(selector,key){document.querySelectorAll(selector).forEach(b=>{const active=b.dataset[key]===String(state[key]);b.classList.toggle('selected',active);b.setAttribute('aria-pressed',String(active));});}
function update(partial){
 partial={...partial};
 if(partial.renderStyle && partial.renderStyle!==state.renderStyle){
  appearanceIntensity[state.renderStyle]=state.density;
  if(!('density' in partial))partial.density=appearanceIntensity[partial.renderStyle];
 }
 if('density' in partial)appearanceIntensity[partial.renderStyle||state.renderStyle]=partial.density;
 Object.assign(state,partial);state.n=Math.round(Math.max(1,Math.min(6,state.n)));state.l=Math.round(Math.max(0,Math.min(state.n-1,state.l)));state.m=Math.round(Math.max(-state.l,Math.min(state.l,state.m)));
 if(!renderer?.error){renderer?.setState(state);if(renderer?.state)state.quality=renderer.state.quality;}
 sync();
 if(['n','l','m','basis'].some(k=>k in partial)){try{history.replaceState(null,'',`#n=${state.n}&l=${state.l}&m=${state.m}&basis=${state.basis}`);}catch{/* Some file viewers restrict history changes; the explorer still works. */}drawRadial();highlightCards();}
}
function option(value,label){const o=document.createElement('option');o.value=value;o.textContent=label;return o;}
function sync(){
 const {n,l,m,basis}=state;
 $('n-select').replaceChildren(...Array.from({length:6},(_,i)=>option(i+1,i+1)));$('n-select').value=n;
 $('l-select').replaceChildren(...Array.from({length:n},(_,i)=>option(i,`${i} · ${family[i]}`)));$('l-select').value=l;
 $('m-select').replaceChildren(...Array.from({length:2*l+1},(_,i)=>option(i-l,i-l>0?`+${i-l}`:i-l)));$('m-select').value=m;
 $('state-name').textContent=`${n}${family[l]}`;$('state-badge').innerHTML=mathHTML(`m_${m}`);
 $('orbital-family').textContent=`${family[l].toUpperCase()} ORBITAL`;
 $('basis-label').textContent=basis==='complex'?'COMPLEX EIGENSTATE':'REAL STANDING WAVE';
 $('m-select').setAttribute('aria-label',basis==='complex'?'Magnetic quantum number m':'Real orbital basis index m');
 const radial=n-l-1;
 let description;
 if(l===0)description=radial?`Spherical symmetry.<br>${radial} nested ${radial===1?'radial node':'radial nodes'}.`:'The simplest possibility.<br>A cloud with no preferred direction.';
 else if(basis==='real')description='A standing wave in space.<br>Directional lobes. No circulating current.';
 else if(n===6&&l===3&&Math.abs(m)===1)description='Nested shells and flowing rings.<br>Watch probability circle the axis.';
 else if(n===3&&l===2&&Math.abs(m)===1)description='A pair of luminous rings.<br>A current around the nucleus.';
 else description=m?'A wave wrapped around the axis.<br>Probability flows through a steady cloud.':'A standing wave along the axis.<br>A cloud with zero probability current.';
 $('state-description').innerHTML=description;
 $('energy').textContent=`−${(13.605693/(n*n)).toFixed(3)} eV`;$('radial-nodes').textContent=radial;
 $('nodes-caption').textContent=radial?`${radial} spherical ${radial===1?'surface':'surfaces'} with zero probability.`:'No spherical gaps in probability.';
 setSelected('[data-basis]','basis');setSelected('[data-mode]','mode');setSelected('[data-cut]','cut');setSelected('[data-render-style]','renderStyle');
 $('render-note').textContent=state.renderStyle==='sculpted'?'Luminous blue spheres with soft highlights and bright, dense cores.':'A luminous volume with moving current tracers.';
 $('cut-settings').hidden=state.cut==='none';$('cut-offset-wrap').hidden=state.cut==='wedge';
 $('cut-angle').value=state.cutAngle;$('cut-angle-value').value=`${state.cutAngle}°`;$('cut-offset').value=state.cutOffset;$('cut-offset-value').value=Math.abs(state.cutOffset)<.01?'center':`${state.cutOffset>0?'+':''}${Math.round(state.cutOffset*100)}%`;
 $('density').value=state.density;$('density-value').value=`${state.density.toFixed(2).replace(/0$/,'')}×`;
 $('speed').value=state.speed;$('speed-value').value=`${state.speed.toFixed(1).replace('.0','')}×`;
 $('play-pause').textContent=state.animate?'Pause':'Play';$('play-pause').setAttribute('aria-label',state.animate?'Pause animation':'Play animation');$('play-pause').title=state.animate?'Pause animation':'Play animation';$('play-pause').setAttribute('aria-pressed',String(!state.animate));
 $('particles-toggle').checked=state.particleAmount>0;
 $('particle-amount').value=state.particleAmount;$('particle-amount-value').value=`${Math.round(state.particleAmount*100)}%`;
 const stationary=m===0||basis==='real';
 $('motion-status').textContent=!state.animate?'Animation paused':stationary?'Stationary · zero current':state.particleAmount===0?'Flow playing · tracers hidden':'Flow playing';
 $('motion-state').dataset.active=String(state.animate&&!stationary&&state.particleAmount>0);
 $('current-note').textContent=state.particleAmount===0?'Current tracers are hidden.':stationary?'This stationary state has zero current. Tracers stay still.':`Tracers follow ${m>0?'positive':'negative'} circulation around z.`;
 $('auto-rotate').checked=state.autoRotate;$('show-axes').checked=state.axes;$('quality').value=state.quality;
 $('legend-title').textContent=state.mode==='phase'?'WAVEFUNCTION PHASE':'PROBABILITY DENSITY';$('legend-low').innerHTML=state.mode==='phase'?mathHTML('phase_low'):'low';$('legend-high').innerHTML=state.mode==='phase'?mathHTML('phase_high'):'high';
 $('legend-gradient').style.background=blueGradient;
 $('legend-gradient').title=state.mode==='phase'?'Blue to white represents phase angle, from −π to +π. The endpoints meet at the phase wrap.':'Dark blue to white represents increasing probability density.';
}
for(const name of ['n','l','m'])$(name+'-select').addEventListener('change',e=>update({[name]:+e.target.value}));
document.querySelectorAll('[data-render-style]').forEach(b=>b.addEventListener('click',()=>update({renderStyle:b.dataset.renderStyle})));
for(const key of ['basis','mode','cut'])document.querySelectorAll(`[data-${key}]`).forEach(b=>b.addEventListener('click',()=>update({[key]:b.dataset[key]})));
for(const [id,key] of [['density','density'],['speed','speed'],['cut-angle','cutAngle'],['cut-offset','cutOffset'],['particle-amount','particleAmount']])$(id).addEventListener('input',e=>update({[key]:+e.target.value}));
$('particles-toggle').addEventListener('change',e=>update({particleAmount:e.target.checked?.65:0}));
$('play-pause').addEventListener('click',()=>update({animate:!state.animate}));
$('auto-rotate').addEventListener('change',e=>update({autoRotate:e.target.checked}));
$('show-axes').addEventListener('change',e=>update({axes:e.target.checked}));
$('quality').addEventListener('change',e=>update({quality:e.target.value}));
$('zoom-in').addEventListener('click',()=>renderer?.zoomBy(.86));$('zoom-out').addEventListener('click',()=>renderer?.zoomBy(1.16));
$('reset-view').addEventListener('click',()=>{renderer?.resetView();toast('View reset');});
$('explorer-nav').addEventListener('click',()=>{$('scene').scrollIntoView({behavior:'smooth',block:'center'});$('orbital-canvas').focus({preventScroll:true});});
$('orbital-canvas').addEventListener('keydown',e=>{
 if(!renderer?.camera)return;
 const cam=renderer.camera;
 if(e.key==='ArrowLeft')cam.yaw-=.1;else if(e.key==='ArrowRight')cam.yaw+=.1;else if(e.key==='ArrowUp')cam.pitch=Math.min(1.48,cam.pitch+.1);else if(e.key==='ArrowDown')cam.pitch=Math.max(-1.48,cam.pitch-.1);else if(e.key==='+'||e.key==='=')renderer.zoomBy(.9);else if(e.key==='-')renderer.zoomBy(1.1);else if(e.key===' ')update({animate:!state.animate});else if(e.key.toLowerCase()==='r')renderer.resetView();else return;e.preventDefault();
});
$('fullscreen').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else if($('scene').requestFullscreen)await $('scene').requestFullscreen();else toast('Pinch to zoom in this browser.');}catch{toast('Fullscreen is unavailable in this browser.');}});
document.addEventListener('fullscreenchange',()=>{$('fullscreen').setAttribute('aria-label',document.fullscreenElement?'Exit fullscreen':'Enter fullscreen');});
if(matchMedia('(pointer: coarse)').matches)document.querySelector('.gesture-hint').innerHTML='Drag to rotate <b>·</b> Pinch to zoom';
let toastTimeout;function toast(message){$('toast').textContent=message;$('toast').classList.add('visible');clearTimeout(toastTimeout);toastTimeout=setTimeout(()=>$('toast').classList.remove('visible'),3200);}

// Cross-sectional thumbnails use exactly the same analytic density as the volume.
const thumbs=new Map();
function thumbnail(n,l,m){
 const key=`${n}-${l}-${Math.abs(m)}`;if(thumbs.has(key))return thumbs.get(key);
 const canvas=document.createElement('canvas'),size=120;canvas.width=canvas.height=size;const ctx=canvas.getContext('2d'),data=ctx.createImageData(size,size),values=new Float32Array(size*size),extent=orbitalExtent(n)*.84;
 let peak=0;
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){const v=densityAt((x+.5-size/2)/(size/2)*extent,0,(size/2-y-.5)/(size/2)*extent,n,l,Math.abs(m));values[y*size+x]=v;peak=Math.max(peak,v);}
 const stops=[[0,5,10,24],[.19,12,34,80],[.43,35,94,181],[.72,99,167,240],[.9,181,220,255],[1,242,249,255]];
 for(let i=0;i<values.length;i++){
  const raw=values[i]/peak,t=Math.pow(raw,.38);let a=stops[0],b=stops[1];for(let j=1;j<stops.length;j++)if(t<=stops[j][0]){a=stops[j-1];b=stops[j];break;}
  const f=Math.max(0,Math.min(1,(t-a[0])/(b[0]-a[0])));for(let c=1;c<4;c++)data.data[i*4+c-1]=a[c]*(1-f)+b[c]*f;data.data[i*4+3]=Math.min(255,t*850);
 }
 ctx.putImageData(data,0,0);const src=canvas.toDataURL();thumbs.set(key,src);return src;
}
const quickStates=[[1,0,0,'The ground state'],[2,1,0,'Two polar lobes'],[3,2,1,'A circulating cloud'],[6,3,1,'Nested shells in motion'],[5,4,3,'A finer structure'],[6,5,4,'Beyond the familiar']];
for(const [n,l,m,desc] of quickStates){
 const button=document.createElement('button');button.className='orbital-card';button.dataset.state=`${n},${l},${m}`;button.setAttribute('aria-label',`Explore ${n}${family[l]}, m equals ${m}. ${desc}`);
 const img=document.createElement('img');img.alt='';img.src=thumbnail(n,l,m);const text=document.createElement('span');text.innerHTML=`<strong>${n}${family[l]}</strong><small>${mathHTML(`lm_${l}_${m}`)}</small>`;button.append(img,text);button.addEventListener('click',()=>{update({n,l,m,basis:'complex'});renderer?.resetView();if(window.innerWidth<780)$('scene').scrollIntoView({behavior:'smooth',block:'start'});});$('quick-orbitals').append(button);
}
function highlightCards(){document.querySelectorAll('[data-state]').forEach(b=>{const active=state.basis==='complex'&&b.dataset.state===`${state.n},${state.l},${Math.abs(state.m)}`;b.classList.toggle('selected',active);b.setAttribute('aria-pressed',String(active));});}
let atlasFamily='all',atlasGeneration=0;
function renderAtlas(){
 const gen=++atlasGeneration,shell=$('atlas-shell').value,queue=[];$('atlas-grid').replaceChildren();
 let total=0;
 for(let n=1;n<=6;n++){
  if(shell!=='all'&&+shell!==n)continue;
  const states=[];for(let l=0;l<n;l++){if(atlasFamily!=='all'&&+atlasFamily!==l)continue;for(let m=0;m<=l;m++)states.push([n,l,m]);}
  if(!states.length)continue;total+=states.length;
  const section=document.createElement('section');section.className='atlas-shell-group';section.innerHTML=`<h3 class="shell-title"><span class="shell-number">${mathHTML(`n_${n}`)}</span><span>${(13.605693/(n*n)).toFixed(3)} eV binding energy</span></h3>`;const row=document.createElement('div');row.className='atlas-row';
  for(const [n,l,m] of states){const b=document.createElement('button');b.className='atlas-card';b.dataset.state=`${n},${l},${m}`;b.setAttribute('aria-label',`Explore ${n}${family[l]}, n ${n}, l ${l}, absolute m ${m}`);const img=document.createElement('img');img.alt='';img.width=120;img.height=120;b.append(img);const title=document.createElement('strong');title.textContent=`${n}${family[l]}`;const small=document.createElement('small');small.innerHTML=mathHTML(`atlas_${l}_${m}`);b.append(title,small);b.addEventListener('click',()=>{update({n,l,m,basis:'complex'});renderer?.resetView();$('atlas-dialog').close();$('scene').scrollIntoView({behavior:'smooth',block:'center'});});row.append(b);queue.push(()=>{img.src=thumbnail(n,l,m);});}
  section.append(row);$('atlas-grid').append(section);
 }
 if(!total)$('atlas-grid').innerHTML='<p class="atlas-empty">This family starts in a higher shell. Choose another shell to explore it.</p>';
 highlightCards();let i=0;const tick=()=>{if(gen!==atlasGeneration)return;for(let j=0;j<4&&i<queue.length;j++,i++)queue[i]();if(i<queue.length)setTimeout(tick,0);};tick();
}
document.querySelectorAll('[data-family]').forEach(b=>b.addEventListener('click',()=>{atlasFamily=b.dataset.family;document.querySelectorAll('[data-family]').forEach(v=>{v.classList.toggle('selected',v===b);v.setAttribute('aria-pressed',String(v===b));});renderAtlas();}));$('atlas-shell').addEventListener('change',renderAtlas);
function openDialog(id){const d=$(id);if(!d.open)d.showModal();document.body.style.overflow='hidden';}
document.querySelectorAll('[data-open-atlas]').forEach(b=>b.addEventListener('click',()=>{renderAtlas();openDialog('atlas-dialog');}));
document.querySelectorAll('[data-open-math]').forEach(b=>b.addEventListener('click',()=>openDialog('math-dialog')));
document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>$(b.dataset.close).close()));
document.querySelectorAll('dialog').forEach(d=>{d.addEventListener('close',()=>{document.body.style.overflow='';});d.addEventListener('click',e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close();}});});
$('current-info').addEventListener('click',e=>{e.preventDefault();openDialog('math-dialog');const target=$('math-content').querySelectorAll('details')[5];if(target){target.open=true;target.scrollIntoView({behavior:'smooth',block:'start'});}});
// The complete mathematics guide is embedded by the standalone build.

function drawRadial(){
 const {n,l,m}=state,extent=orbitalExtent(n),q=Math.abs(m),theta=.731,phi=.37,values=[];
 let peak=0;for(let i=0;i<=180;i++){const r=i/180*extent,v=r*r*densityAt(r*Math.sin(theta)*Math.cos(phi),r*Math.sin(theta)*Math.sin(phi),r*Math.cos(theta),n,l,q);values.push(v);peak=Math.max(peak,v);}
 const points=values.map((v,i)=>`${(i/180*250+5).toFixed(2)},${(53-v/peak*47).toFixed(2)}`).join(' ');
 $('radial-plot').innerHTML=`<defs><linearGradient id="radial-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#83bbfa" stop-opacity=".2"/><stop offset="100%" stop-color="#83bbfa" stop-opacity="0"/></linearGradient></defs><path d="M5 53H255" stroke="#38414f" stroke-width=".5"/><polygon points="5,53 ${points} 255,53" fill="url(#radial-fill)"/><polyline points="${points}" fill="none" stroke="#a6ceff" stroke-width="1.3"/><text x="5" y="68" font-size="7" fill="#8998ad">0</text><text x="255" y="68" text-anchor="end" font-size="7" fill="#8998ad">${extent.toFixed(1)} Bohr radii</text>`;
}
sync();drawRadial();highlightCards();
