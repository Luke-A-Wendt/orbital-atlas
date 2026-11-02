import { SpectrumRenderer } from './spectrum-renderer.js';
import { densityPalette, phasePalette } from './renderer.js';
import { getSpectralLines, getSubshellPairs, getChannels, transitionStrength } from './transitions.js';

/** Complete electric-dipole channel explorer, sharing one lazily created GPU view. */
export function initSpectrum(){
 const root=document.getElementById('spectrum');
 if(!root)return null;
 const element=id=>document.getElementById('spectrum-'+id);
 const seriesNames={1:'Lyman',2:'Balmer',3:'Paschen',4:'Brackett',5:'Pfund'};
 const families=['s','p','d','f','g','h'];
 const energyScale=13.605693;
 const ranges={0:[90,8000,[90,200,500,1000,3000,8000]],1:[90,130,[90,100,110,120,130]],2:[390,700,[390,450,550,650,700]],3:[1000,2000,[1000,1250,1500,1750,2000]],4:[2400,4300,[2400,3000,3600,4300]],5:[7000,8000,[7000,7250,7500,7750,8000]]};
 const lines=getSpectralLines();
 const channelsByLine=new Map(lines.map(line=>[line.lowerN+'-'+line.upperN,getChannels(line.lowerN,line.upperN)]));
 let series=0,cycle=0,playing=true,visible=false,previousTime=null,raf=0,renderer=null;
 let currentLine=null,currentSubshell=null,currentChannel=null,stateFilter=null,qFilter='all',lastUiTime=0,engineFailed=false;
 const view={basis:'complex',mode:'density',renderStyle:'cloud',cut:'none',cutAngle:0,cutOffset:0,density:1,particleAmount:.65,speed:.5,animate:true,autoRotate:false,quality:'auto',axes:false};
 const viewIntensity={cloud:1,sculpted:1.35};
 let lastTracerAmount=.65;
 const viewGradient=palette=>'linear-gradient(90deg,'+Array.from({length:33},(_,i)=>'rgb('+palette(i/32).map(v=>Math.round(v*255)).join(',')+') '+i/32*100+'%').join(',')+')';
 const viewDensityGradient=viewGradient(densityPalette),viewPhaseGradient=viewGradient(phasePalette);
 const spectrumNav=document.querySelector('[data-open-spectrum]');
 const sameState=(a,b)=>a.n===b.n&&a.l===b.l&&a.m===b.m;
 const includesState=channel=>!stateFilter||sameState(channel.lower,stateFilter)||sameState(channel.upper,stateFilter);
 const orbitalName=state=>state.n+families[state.l];
 const signed=value=>value>0?'+'+value:String(value).replace('-','−');
 const fragment=(key,fallback)=>window.OrbitalMathFragments?.[key]||fallback;
 const mMath=value=>fragment('m_'+value,`<math xmlns="http://www.w3.org/1998/Math/MathML"><mi>m</mi><mo>=</mo><mn>${signed(value)}</mn></math>`);
 const qMath=value=>fragment('spectrum_q_'+value,`<math xmlns="http://www.w3.org/1998/Math/MathML"><mi>q</mi><mo>=</mo><mn>${signed(value)}</mn></math>`);
 const allChannels=line=>(channelsByLine.get(line.lowerN+'-'+line.upperN)||[]).filter(includesState);
 const shapeChannels=()=>allChannels(currentLine).filter(channel=>channel.subshellKey===currentSubshell.key);
 const matchesMagnetic=channel=>channel.lower.m===currentChannel.lower.m&&channel.upper.m===currentChannel.upper.m;
 const visibleChannels=()=>{const map=new Map();for(const channel of allChannels(currentLine)){if(qFilter!=='all'&&channel.q!==qFilter)continue;const key=channel.lower.m+','+channel.upper.m;if(!map.has(key)||channel.subshellKey===currentSubshell.key)map.set(key,channel);}return [...map.values()].sort((a,b)=>a.lower.m-b.lower.m||a.upper.m-b.upper.m);};
 const availableLines=()=>lines.filter(line=>(series===0||line.lowerN===series)&&allChannels(line).length);
 const channelMarkup=channel=>`<span>${mMath(channel.lower.m)}</span><span class="spectrum-channel-arrow" aria-hidden="true">↔</span><span>${mMath(channel.upper.m)}</span>`;
 function wavelengthColor(wavelength){
  if(wavelength<380||wavelength>780)return '#a9cfff';
  let r=0,g=0,b=0;
  if(wavelength<440){r=(440-wavelength)/60;b=1;}
  else if(wavelength<490){g=(wavelength-440)/50;b=1;}
  else if(wavelength<510){g=1;b=(510-wavelength)/20;}
  else if(wavelength<580){r=(wavelength-510)/70;g=1;}
  else if(wavelength<645){r=1;g=(645-wavelength)/65;}
  else r=1;
  const scale=wavelength<420?.5+.5*(wavelength-380)/40:wavelength>700?.5+.5*(780-wavelength)/80:1;
  return `rgb(${[r,g,b].map(v=>Math.round(255*Math.pow(Math.max(0,v*scale),.7))).join(',')})`;
 }
 function position(wavelength){const [min,max]=ranges[series];return series===0?Math.log(wavelength/min)/Math.log(max/min):(wavelength-min)/(max-min);}
 function syncView(){
  for(const [attribute,key] of [['basis','basis'],['mode','mode'],['render-style','renderStyle'],['cut','cut']]){
   root.querySelectorAll('[data-spectrum-view-'+attribute+']').forEach(button=>{
    const selected=button.getAttribute('data-spectrum-view-'+attribute)===view[key];
    button.classList.toggle('selected',selected);button.setAttribute('aria-pressed',String(selected));
   });
  }
  const phase=view.mode==='phase',sculpted=view.renderStyle==='sculpted',real=view.basis==='real';
  const stationary=real||!currentChannel||(!currentChannel.lower.m&&!currentChannel.upper.m);
  element('view-label').textContent=(real?'REAL-BASIS PREVIEW':'COMPLEX')+' · '+(phase?'COMPONENT PHASE':sculpted?'SCULPTED DENSITY':'DENSITY CLOUD');
  element('view-summary').textContent=(real?'Real orbitals':'Complex')+' · '+(phase?'Phase color':'Density')+' · '+(sculpted?'Sculpted':'Cloud')+' · '+({none:'Whole',half:'Half',wedge:'Wedge',slice:'Slice'}[view.cut]);
  element('basis-note').hidden=!real;
  element('stage-basis-note').hidden=!real;
  element('phase-note').hidden=!phase;
  element('render-note').textContent=sculpted?'Luminous spheres with soft highlights and bright, dense cores.':'A luminous volume with moving current tracers.';
  element('density').value=view.density;element('density-value').value=view.density.toFixed(2).replace(/\.?0+$/,'')+'×';
  element('cut-settings').hidden=view.cut==='none';element('cut-offset-wrap').hidden=view.cut==='wedge';
  element('cut-angle').value=view.cutAngle;element('cut-angle-value').value=view.cutAngle+'°';
  element('cut-offset').value=view.cutOffset;element('cut-offset-value').value=Math.abs(view.cutOffset)<.01?'center':(view.cutOffset>0?'+':'')+Math.round(view.cutOffset*100)+'%';
  element('particles-toggle').checked=view.particleAmount>0;
  element('particle-amount').value=view.particleAmount;element('particle-amount-value').value=Math.round(view.particleAmount*100)+'%';
  element('speed').value=view.speed;element('speed-value').value=view.speed.toFixed(1).replace('.0','')+'×';
  element('flow-play').textContent=view.animate?'Pause flow':'Play flow';element('flow-play').setAttribute('aria-label',view.animate?'Pause transition flow':'Play transition flow');element('flow-play').setAttribute('aria-pressed',String(!view.animate));
  element('flow-status').textContent=!view.animate?'Flow paused':stationary?'Stationary · zero current':view.particleAmount===0?'Flow playing · tracers hidden':'Flow playing';
  element('flow-state').dataset.active=String(view.animate&&!stationary&&view.particleAmount>0);
  element('current-note').textContent=view.particleAmount===0?'Current tracers are hidden.':stationary?'These component shapes have zero stationary circulation.':'Tracers show each state’s circulation, weighted by its population.';
  element('auto-rotate').checked=view.autoRotate;element('show-axes').checked=view.axes;element('quality').value=view.quality;
  element('legend-title').textContent=phase?'COMPONENT PHASE':'PROBABILITY DENSITY';
  element('legend-gradient').style.background=phase?viewPhaseGradient:viewDensityGradient;
  element('legend-gradient').title=phase?'Cyclic colors show the component phases, blended by local population-weighted density. The colors at minus pi and plus pi match.':'Dark blue to white shows increasing probability density.';
  element('legend-low').innerHTML=phase?fragment('phase_low','−π'):'low';element('legend-high').innerHTML=phase?fragment('phase_high','+π'):'high';
 }
 function setView(partial){
  if(!partial||typeof partial!=='object')return false;
  const next={};
  for(const [key,values] of Object.entries({basis:['complex','real'],mode:['density','phase'],renderStyle:['cloud','sculpted'],cut:['none','half','wedge','slice'],quality:['auto','low','medium','high','ultra']}))if(values.includes(partial[key]))next[key]=partial[key];
  for(const [key,range] of Object.entries({density:[.2,3],cutAngle:[0,360],cutOffset:[-.8,.8],particleAmount:[0,1],speed:[.1,2]}))if(typeof partial[key]==='number'&&Number.isFinite(partial[key]))next[key]=Math.max(range[0],Math.min(range[1],partial[key]));
  if('cutAngle' in next)next.cutAngle=Math.round(next.cutAngle);
  for(const key of ['animate','autoRotate','axes'])if(typeof partial[key]==='boolean')next[key]=partial[key];
  if(next.renderStyle&&next.renderStyle!==view.renderStyle){viewIntensity[view.renderStyle]=view.density;if(!('density' in next))next.density=viewIntensity[next.renderStyle];}
  if('density' in next)viewIntensity[next.renderStyle||view.renderStyle]=next.density;
  if(next.particleAmount>0)lastTracerAmount=next.particleAmount;
  Object.assign(view,next);renderer?.setState({...view});syncView();return {...view};
 }
 function reportViewStats(info={}){
  element('status').hidden=true;
  const quality=String(info.quality||'Adaptive');
  element('render-status').textContent=(info.idle?'IDLE':Number.isFinite(info.fps)?Math.round(info.fps)+' FPS':'GPU')+' · '+quality.toUpperCase()+(info.adaptive?' AUTO':'');
  if(info.resolution)element('render-status').title=info.resolution.join(' × ')+' pixels · '+(info.steps||0)+' samples per ray · '+(info.particles||0).toLocaleString()+' particles';
 }
 function showViewNotice(message){element('view-notice').textContent=message;element('view-notice').hidden=!message;}
 function updatePopulation(){
  const population=Math.sin(Math.PI*cycle)**2;
  const lowerPercent=Math.round((1-population)*100),upperPercent=100-lowerPercent;
  element('lower-population').value=lowerPercent+'%';element('upper-population').value=upperPercent+'%';
  element('lower-fill').style.setProperty('--population',lowerPercent+'%');element('upper-fill').style.setProperty('--population',upperPercent+'%');
  element('progress').value=String(cycle);
  element('progress').setAttribute('aria-valuetext',`Lower state: ${lowerPercent}%; upper state: ${upperPercent}%`);
  element('direction').textContent=!playing?'Transition paused':cycle<.5?'Absorbing energy':'Stimulated emission';
  element('play').textContent=playing?'Pause':'Play';element('play').setAttribute('aria-label',playing?'Pause transition':'Play transition');element('play').setAttribute('aria-pressed',String(!playing));
  renderer?.setPopulation(population);
 }
 function ensureRenderer(){
  if(renderer||engineFailed)return;
  try{
   renderer=new SpectrumRenderer(element('canvas'),{
    onError(message){element('status').hidden=!message;element('status').dataset.error=String(!!message);if(message)element('status').textContent=message;},
    onStats:reportViewStats
   });
   renderer.setState({...view});renderer.setPair(currentChannel.lower,currentChannel.upper);renderer.setPopulation(Math.sin(Math.PI*cycle)**2);renderer.setVisible(visible&&!document.hidden);
  }catch(error){engineFailed=true;element('status').hidden=false;element('status').dataset.error='true';element('status').textContent='The orbital view needs WebGL 2. Spectral lines, energies, allowed pairs and state populations remain available.';}
 }
 function drawBand(){
  const [min,max,ticks]=ranges[series],track=element('track'),axis=element('axis');
  const focusedLine=document.activeElement?.dataset?.spectrumLine;
  track.replaceChildren();axis.replaceChildren();
  const stops=Array.from({length:25},(_,i)=>`${wavelengthColor(min+(max-min)*i/24)} ${i/24*100}%`);
  track.style.setProperty('--spectrum-band',series===2?`linear-gradient(90deg,${stops.join(',')})`:'linear-gradient(90deg,#4272a3,#92b7e4)');
  element('scale-note').textContent='Vacuum wavelength · '+(series===0?'logarithmic scale':'linear scale');
  ticks.forEach(value=>{const label=document.createElement('span');label.style.left=position(value)*100+'%';label.textContent=value+(value===max?' nm':'');axis.append(label);});
  const filtered=availableLines();
  for(const line of filtered){
   const selected=line===currentLine,color=wavelengthColor(line.wavelength);
   const accessible=`${line.name}, ${line.wavelength.toFixed(1)} nanometers, shells ${line.lowerN} and ${line.upperN}`;
   const tick=document.createElement('button');tick.type='button';tick.className='spectrum-line'+(selected?' selected':'');tick.dataset.spectrumLine=line.lowerN+'-'+line.upperN;tick.style.left=position(line.wavelength)*100+'%';tick.style.setProperty('--line-color',color);tick.setAttribute('aria-label',accessible);tick.setAttribute('aria-pressed',String(selected));tick.title=accessible;tick.addEventListener('click',event=>{event.stopPropagation();selectLine(line.lowerN,line.upperN);});
   track.append(tick);
  }
  if(focusedLine){const destination=track;Array.from(destination.children).find(button=>button.dataset.spectrumLine===focusedLine)?.focus({preventScroll:true});}
  root.querySelectorAll('[data-spectrum-series]').forEach(button=>{
   const value=+button.dataset.spectrumSeries,selected=value===series;
   button.classList.toggle('selected',selected);button.setAttribute('aria-pressed',String(selected));
   button.disabled=!lines.some(line=>(value===0||line.lowerN===value)&&allChannels(line).length);
   button.title=button.disabled?'No dipole-allowed transitions from the selected orbital in this series':'';
  });
 }
 function drawLevels(){
  const ys={1:122,2:98,3:75,4:54,5:35,6:18};
  const level=element('levels');
  let markup='<title>Hydrogen energy levels. Vertical spacing is expanded for clarity.</title>';
  for(let n=1;n<=6;n++){
   const selected=n===currentLine.lowerN||n===currentLine.upperN;
   markup+=`<g class="${selected?'selected':''}"><text x="8" y="${ys[n]+4}"><tspan font-family="Georgia,serif" font-style="italic">n</tspan> = ${n}</text><line x1="58" y1="${ys[n]}" x2="192" y2="${ys[n]}"/><text x="214" y="${ys[n]+4}">−${(energyScale/(n*n)).toFixed(3)} eV</text></g>`;
  }
  const bottom=ys[currentLine.lowerN],top=ys[currentLine.upperN];
  markup+=`<path class="spectrum-energy-arrow" d="M150 ${bottom}V${top}m-4 6 4-6 4 6 M146 ${bottom-6}l4 6 4-6"/>`;
  level.innerHTML=markup;
  level.setAttribute('aria-label',`Shell ${currentLine.lowerN} at minus ${(energyScale/currentLine.lowerN**2).toFixed(3)} electron volts and shell ${currentLine.upperN} at minus ${(energyScale/currentLine.upperN**2).toFixed(3)} electron volts. Level spacing expanded for clarity.`);
 }
 function pairsForLine(){return getSubshellPairs(currentLine.lowerN,currentLine.upperN).filter(pair=>allChannels(currentLine).some(channel=>channel.subshellKey===pair.key&&matchesMagnetic(channel)));}
 function drawShapes(){
  const container=element('shapes');container.replaceChildren();
  const channels=allChannels(currentLine).filter(c=>c.q===currentChannel.q);
  const seen=new Set();
  element('shape-note').textContent='All allowed state pairs for the selected polarization';
  for(const channel of channels){
   const key=channel.id;if(seen.has(key))continue;seen.add(key);
   const button=document.createElement('button');button.type='button';button.className='spectrum-shape'+(channel.id===currentChannel.id?' selected':'');button.dataset.spectrumChannel=channel.id;button.setAttribute('aria-pressed',String(channel.id===currentChannel.id));
   button.setAttribute('aria-label',`${orbitalName(channel.lower)}, m ${channel.lower.m}, and ${orbitalName(channel.upper)}, m ${channel.upper.m}`);
   const pictures=document.createElement('span');pictures.className='spectrum-shape-pictures';pictures.setAttribute('aria-hidden','true');
   for(const [i,state] of [channel.lower,channel.upper].entries()){if(i){const arrow=document.createElement('span');arrow.textContent='↔';pictures.append(arrow);}const img=document.createElement('img');img.width=62;img.height=62;img.alt='';img.src=window.orbitalApp?.thumbnail(state.n,state.l,state.m)||'';pictures.append(img);}
   const name=document.createElement('strong');name.textContent=orbitalName(channel.lower)+' ↔ '+orbitalName(channel.upper);
   const magnetic=document.createElement('small');magnetic.innerHTML=channelMarkup(channel);
   button.append(pictures,name,magnetic);button.addEventListener('click',()=>{selectChannel(channel.id);Array.from(container.children).find(b=>b.dataset.spectrumChannel===channel.id)?.focus({preventScroll:true});});container.append(button);
  }
  element('line-counts').textContent=seen.size+' allowed transitions';
 }
 function drawChannels(){
  root.querySelectorAll('[data-spectrum-q]').forEach(button=>{const q=+button.dataset.spectrumQ;button.hidden=button.dataset.spectrumQ==='all';button.disabled=!allChannels(currentLine).some(c=>c.q===q);button.classList.toggle('selected',q===currentChannel.q);button.setAttribute('aria-pressed',String(q===currentChannel.q));});
 }
 function updateStrength(){
  const strength=transitionStrength(currentChannel),relative=strength.relative*100;
  element('strength-value').textContent=strength.strength.toPrecision(4)+' ';
  element('strength-preview').textContent=relative.toFixed(1)+'% of line maximum';
  element('strength-fill').style.width=relative+'%';element('strength-meter').setAttribute('aria-valuenow',relative.toFixed(2));
  element('strength-relative').textContent=relative.toFixed(2)+'% of the strongest state pair on this line.';
  element('polarization').innerHTML=qMath(currentChannel.q);
  element('polarization-description').textContent=currentChannel.q===0?'Linear electric-field component along the quantization axis.':'Circular spherical component about the quantization axis. The sign follows the lower-to-upper absorption convention.';
  element('strength-factors').innerHTML='Radial overlap: '+strength.radial.toPrecision(5)+' '+fragment('a0','<math xmlns="http://www.w3.org/1998/Math/MathML"><msub><mi>a</mi><mn>0</mn></msub></math>')+'. Squared angular factor: '+strength.angular.toPrecision(5)+'.';
 }
 function applyChannel(){
  cycle=0;previousTime=null;
  element('lower-name').textContent=orbitalName(currentChannel.lower);element('upper-name').textContent=orbitalName(currentChannel.upper);
  element('lower-m').innerHTML=mMath(currentChannel.lower.m);element('upper-m').innerHTML=mMath(currentChannel.upper.m);
  element('pair').innerHTML=orbitalName(currentChannel.lower)+' <span>↔</span> '+orbitalName(currentChannel.upper);
  element('stage-state').innerHTML=mMath(currentChannel.lower.m)+' <span aria-hidden="true">↔</span> '+mMath(currentChannel.upper.m)+'<br>Same spatial scale throughout the cycle.';
  element('lower-energy').textContent='−'+(energyScale/currentLine.lowerN**2).toFixed(3)+' eV';element('upper-energy').textContent='−'+(energyScale/currentLine.upperN**2).toFixed(3)+' eV';
  element('canvas').setAttribute('aria-label',`Three-dimensional population transfer between ${orbitalName(currentChannel.lower)}, magnetic number ${currentChannel.lower.m}, and ${orbitalName(currentChannel.upper)}, magnetic number ${currentChannel.upper.m}. Drag or use arrow keys to rotate; pinch or use plus and minus to zoom. Space pauses flow.`);
  element('explore-lower').setAttribute('aria-label',`Explore ${orbitalName(currentChannel.lower)}, magnetic number ${currentChannel.lower.m}, in the orbital atlas`);element('explore-upper').setAttribute('aria-label',`Explore ${orbitalName(currentChannel.upper)}, magnetic number ${currentChannel.upper.m}, in the orbital atlas`);
  renderer?.setPair(currentChannel.lower,currentChannel.upper);drawShapes();drawChannels();updateStrength();updatePopulation();syncView();if(visible)startFrame();
 }
 function selectChannel(id){
  const channel=allChannels(currentLine).find(item=>item.id===id);if(!channel)return false;
  currentChannel=channel;currentSubshell=getSubshellPairs(currentLine.lowerN,currentLine.upperN).find(pair=>pair.key===channel.subshellKey);
  qFilter=channel.q;
  applyChannel();return true;
 }
 function selectSubshell(key){
  const pair=pairsForLine().find(item=>item.key===key);if(!pair)return false;
  currentSubshell=pair;let channels=shapeChannels();
  if(qFilter!=='all'&&!channels.some(channel=>channel.q===qFilter))qFilter='all';
  currentChannel=channels.find(matchesMagnetic);applyChannel();return true;
 }
 function selectLine(lowerN,upperN,preferredChannel){
  const line=lines.find(item=>item.lowerN===lowerN&&item.upperN===upperN);if(!line||!allChannels(line).length)return false;
  currentLine=line;if(series!==0)series=lowerN;
  root.style.setProperty('--selected-line-color',wavelengthColor(line.wavelength));
  element('wavelength').textContent=line.wavelength.toFixed(1);element('line-name').textContent=`${line.name} · ${lowerN} ↔ ${upperN}`;element('energy').textContent=line.gap.toFixed(3)+' eV';
  element('region').textContent=line.wavelength<380?'Ultraviolet':line.wavelength>780?'Infrared':'Visible light';
  drawBand();drawLevels();
  const channels=allChannels(line);qFilter='all';
  const preferred=preferredChannel&&channels.find(channel=>channel.id===preferredChannel);
  const selected=preferred||channels.find(channel=>channel.lower.l===lowerN-1&&channel.upper.l===lowerN&&channel.lower.m===0&&channel.upper.m===0)||channels.find(channel=>channel.lower.m===0&&channel.upper.m===0)||channels[0];
  selectChannel(selected.id);return true;
 }
 function setSeries(value){
  if(!Number.isInteger(value)||value<0||value>5)return false;
  const candidates=lines.filter(line=>(value===0||line.lowerN===value)&&allChannels(line).length);if(!candidates.length)return false;
  series=value;const line=candidates.includes(currentLine)?currentLine:candidates[0];return selectLine(line.lowerN,line.upperN);
 }
 function setPolarization(value){
  const q=Number(value);if(![-1,0,1].includes(q))return false;
  const channels=allChannels(currentLine).filter(c=>c.q===q);if(!channels.length)return false;
  return selectChannel((channels.find(c=>c.id===currentChannel.id)||channels.find(c=>c.subshellKey===currentSubshell.key)||channels[0]).id);
 }
 function movePair(offset){const qs=[-1,0,1].filter(q=>allChannels(currentLine).some(c=>c.q===q));return setPolarization(qs[(qs.indexOf(currentChannel.q)+offset+qs.length)%qs.length]);}
 function frame(now){
  raf=0;if(!visible||document.hidden){previousTime=null;return;}
  if(playing){
   if(previousTime!==null){
    const dt=Math.min((now-previousTime)/1000,.1);
    cycle=(cycle+dt/10)%1;
   }
   previousTime=now;renderer?.setPopulation(Math.sin(Math.PI*cycle)**2);
   if(now-lastUiTime>=50){updatePopulation();lastUiTime=now;}
   // A channel change can schedule a frame too; retain a single animation loop.
   if(!raf)raf=requestAnimationFrame(frame);
  }else{previousTime=null;updatePopulation();}
 }
 function startFrame(){if(!raf&&visible&&!document.hidden&&playing)raf=requestAnimationFrame(frame);}
 function setPlaying(value){playing=!!value;previousTime=null;if(!playing){cancelAnimationFrame(raf);raf=0;}updatePopulation();startFrame();}
 function updateStateFilter(){
  element('state-filter').hidden=!stateFilter;
  if(stateFilter)element('filter-label').innerHTML='From selected orbital <strong>'+orbitalName(stateFilter)+'</strong> '+mMath(stateFilter.m);
 }
 function exploreState(state){
  const candidate={n:Number(state.n),l:Number(state.l),m:Number(state.m)};
  if(!Number.isInteger(candidate.n)||candidate.n<1||candidate.n>6||!Number.isInteger(candidate.l)||candidate.l<0||candidate.l>=candidate.n||!Number.isInteger(candidate.m)||Math.abs(candidate.m)>candidate.l)return false;
  stateFilter=candidate;series=0;updateStateFilter();
  const available=lines.filter(line=>allChannels(line).length),line=available.includes(currentLine)?currentLine:available.find(item=>item.lowerN===2)||available[0];
  selectLine(line.lowerN,line.upperN);root.scrollIntoView({behavior:'smooth',block:'start'});element('title').focus({preventScroll:true});return true;
 }
 function clearStateFilter(){stateFilter=null;updateStateFilter();selectLine(currentLine.lowerN,currentLine.upperN,currentChannel.id);}
 for(const [attribute,key] of [['basis','basis'],['mode','mode'],['render-style','renderStyle'],['cut','cut']])root.querySelectorAll('[data-spectrum-view-'+attribute+']').forEach(button=>button.addEventListener('click',()=>setView({[key]:button.getAttribute('data-spectrum-view-'+attribute)})));
 for(const [id,key] of [['density','density'],['speed','speed'],['cut-angle','cutAngle'],['cut-offset','cutOffset'],['particle-amount','particleAmount']])element(id).addEventListener('input',event=>setView({[key]:+event.target.value}));
 element('particles-toggle').addEventListener('change',event=>setView({particleAmount:event.target.checked?lastTracerAmount:0}));
 element('flow-play').addEventListener('click',()=>setView({animate:!view.animate}));
 element('canvas').addEventListener('keydown',event=>{if(event.key===' '){event.preventDefault();setView({animate:!view.animate});}});
 element('auto-rotate').addEventListener('change',event=>setView({autoRotate:event.target.checked}));
 element('show-axes').addEventListener('change',event=>setView({axes:event.target.checked}));
 element('quality').addEventListener('change',event=>setView({quality:event.target.value}));
 element('fullscreen').addEventListener('click',async()=>{
  try{
   if(document.fullscreenElement===element('stage'))await document.exitFullscreen();
   else if(element('stage').requestFullscreen)await element('stage').requestFullscreen();
   else{showViewNotice('Fullscreen is unavailable in this browser. Pinch or use the zoom controls to inspect the transition.');return;}
   showViewNotice('');
  }catch{showViewNotice('Fullscreen is unavailable in this browser. Pinch or use the zoom controls to inspect the transition.');}
 });
 document.addEventListener('fullscreenchange',()=>{
  const full=document.fullscreenElement===element('stage');element('fullscreen').setAttribute('aria-label',full?'Exit transition fullscreen':'Enter transition fullscreen');element('fullscreen').title=full?'Exit fullscreen':'Fullscreen';
 });
 root.querySelectorAll('[data-spectrum-series]').forEach(button=>button.addEventListener('click',()=>setSeries(+button.dataset.spectrumSeries)));
 root.querySelectorAll('[data-spectrum-q]').forEach(button=>button.addEventListener('click',()=>setPolarization(button.dataset.spectrumQ)));
 element('track').addEventListener('click',event=>{
  const bounds=element('track').getBoundingClientRect(),fraction=Math.max(0,Math.min(1,(event.clientX-bounds.left)/bounds.width));
  const nearest=availableLines().reduce((best,line)=>!best||Math.abs(position(line.wavelength)-fraction)<Math.abs(position(best.wavelength)-fraction)?line:best,null);
  if(nearest)selectLine(nearest.lowerN,nearest.upperN);
 });
 element('clear-filter').addEventListener('click',clearStateFilter);
 element('play').addEventListener('click',()=>setPlaying(!playing));element('restart').addEventListener('click',()=>{cycle=0;setPlaying(true);});
 element('progress').addEventListener('input',event=>{cycle=Math.max(0,Math.min(1,+event.target.value));setPlaying(false);});
 element('zoom-in').addEventListener('click',()=>renderer?.zoomBy(.86));element('zoom-out').addEventListener('click',()=>renderer?.zoomBy(1.16));element('reset').addEventListener('click',()=>renderer?.resetView());
 element('explore-lower').addEventListener('click',()=>window.orbitalApp?.exploreState({...currentChannel.lower}));element('explore-upper').addEventListener('click',()=>window.orbitalApp?.exploreState({...currentChannel.upper}));
 document.querySelectorAll('[data-open-spectrum]').forEach(button=>button.addEventListener('click',()=>{root.scrollIntoView({behavior:'smooth',block:'start'});element('title').focus({preventScroll:true});}));
 document.addEventListener('visibilitychange',()=>{previousTime=null;renderer?.setVisible(visible&&!document.hidden);if(document.hidden){cancelAnimationFrame(raf);raf=0;}else startFrame();});
 if(matchMedia('(pointer: coarse)').matches)element('gesture').textContent='Drag to rotate · Pinch to zoom';
 selectLine(2,3,getChannels(2,3,1,2).find(channel=>channel.lower.m===1&&channel.upper.m===1).id);
 if('IntersectionObserver' in window){
  const observer=new IntersectionObserver(entries=>{
   visible=entries[0].isIntersecting;previousTime=null;
   if(visible){ensureRenderer();renderer?.setVisible(!document.hidden);startFrame();}
   else{renderer?.setVisible(false);cancelAnimationFrame(raf);raf=0;}
  },{threshold:0});observer.observe(root.querySelector('.spectrum-stage'));
  const navigationObserver=new IntersectionObserver(entries=>{
   const active=entries[0].isIntersecting;
   spectrumNav?.classList.toggle('active',active);document.getElementById('explorer-nav')?.classList.toggle('active',!active);
   if(active)spectrumNav?.setAttribute('aria-current','location');else spectrumNav?.removeAttribute('aria-current');
  },{rootMargin:'-15% 0px -35% 0px',threshold:0});navigationObserver.observe(root);
 }else{visible=true;ensureRenderer();startFrame();}
 const api={get view(){return {...view};},setView,get state(){return {view:{...view},series,lower:currentLine.lowerN,upper:currentLine.upperN,cycle,population:Math.sin(Math.PI*cycle)**2,playing,visible,wavelength:currentLine.wavelength,energy:currentLine.gap,line:{...currentLine},subshell:{...currentSubshell},channel:{...currentChannel,lower:{...currentChannel.lower},upper:{...currentChannel.upper}},qFilter,stateFilter:stateFilter?{...stateFilter}:null,availableChannelIds:visibleChannels().map(channel=>channel.id)};},selectLine,selectSubshell,selectChannel,setSeries,setPolarization,setPlaying,exploreState,clearStateFilter,nextPair:()=>movePair(1),previousPair:()=>movePair(-1),get renderer(){return renderer;}};
 window.spectrumApp=api;return api;
}
