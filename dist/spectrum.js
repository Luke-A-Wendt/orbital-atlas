import { bindSliceHeightControls } from './renderer.js';
import { SpectrumRenderer } from './spectrum-renderer.js';
import { cutDegrees, colorScale, colorMetrics, colorMetricIndex, densityPalette, phasePalette, colorMaps, colorMapIndex } from './renderer.js';
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
 // Smooth display easing prolongs both endpoints without changing cycle length.
 function displayPopulation(cycle){
  const p=Math.sin(Math.PI*cycle)**2;
  return p*p*p*(10+p*(-15+6*p));
 }
 function populationRate(){const p=Math.sin(Math.PI*cycle)**2;return playing?30*p*p*(1-p)*(1-p)*Math.PI*Math.sin(2*Math.PI*cycle)*transitionRate/transitionCycleSeconds:0;}
 function maximumPopulationRate(){return 1.875*Math.PI*transitionRate/transitionCycleSeconds;}
 const transitionCycleSeconds=2.5;
 let transitionRate=1,sigma=1,filterOrbital=null;
 let series=0,cycle=0,playing=true,visible=false,previousTime=null,raf=0,renderer=null;
 let currentLine=null,currentSubshell=null,currentChannel=null,stateFilter=null,qFilter='all',lastUiTime=0,engineFailed=false;
 const view={basis:'complex',mode:'density',logScale:false,colorMap:'atlas',renderStyle:'granular',cut:'custom',cutDegrees:180,wedgePolar:90,cutView:'front',frontView:true,cutAngle:0,cutOffset:0,density:2,particleAmount:4,speed:.25,animate:true,autoRotate:false,randomRotate:false,axes:false};
 // Basis and color mode are shared; Cloud and Granular retain their other presets.
 const modeSettingKeys=['cut','cutView','cutDegrees','sliceThickness','sliceHeight','sliceAxis','wedgePolar','sliceAzimuth','slicePolar','radiusLimit','planeAzimuth','planePolar','density','particleAmount','speed','autoRotate','randomRotate','axes'];
 const defaultModeSettings={cut:'none',cutAngle:0,cutOffset:0,density:1,particleAmount:0,speed:.5,animate:true,autoRotate:false,randomRotate:false,axes:false};
 const modeSettings={cloud:{...defaultModeSettings},granular:{...defaultModeSettings,cut:'custom',cutDegrees:180,wedgePolar:90,cutView:'front',frontView:true,density:2,particleAmount:4,speed:.25}};
 const lastPositiveTracers={cloud:.02,granular:4};
 const flowSpeeds=[.25,.5,1,2,4],flowSpeedLabels=['¼×','½×','1×','2×','4×'];
 const nearestFlowSpeed=value=>flowSpeeds.reduce((best,speed)=>Math.abs(speed-value)<Math.abs(best-value)?speed:best,flowSpeeds[0]);
 const basisStyles={real:'granular',complex:'granular'};
 const initializedBases=new Set([view.basis]);
 let cloudBasis=view.basis;
 let lastPerformance=null;
 const viewGradient=palette=>'linear-gradient(90deg,'+Array.from({length:409},(_,i)=>'rgb('+palette(i/408).map(v=>Math.round(v*255)).join(',')+') '+i/408*100+'%').join(',')+')';
 const spectrumNav=document.querySelector('[data-open-spectrum]');
 const sameState=(a,b)=>a.n===b.n&&a.l===b.l&&a.m===b.m;
 const includesState=channel=>!stateFilter||[channel.lower,channel.upper].some(endpoint=>['n','l','m'].every(key=>stateFilter[key]==null||endpoint[key]===stateFilter[key]));
 const orbitalName=state=>state.n+families[state.l];
 const signed=value=>value>0?'+'+value:String(value).replace('-','−');
 const fragment=(key,fallback)=>window.OrbitalMathFragments?.[key]||fallback;
 const mMath=value=>fragment('m_'+value,`<math xmlns="http://www.w3.org/1998/Math/MathML"><mi>m</mi><mo>=</mo><mn>${signed(value)}</mn></math>`);
 const qMath=value=>fragment('spectrum_q_'+value,`<math xmlns="http://www.w3.org/1998/Math/MathML"><mi>q</mi><mo>=</mo><mn>${signed(value)}</mn></math>`);
 const allChannels=line=>(channelsByLine.get(line.lowerN+'-'+line.upperN)||[]).filter(includesState);
 const shapeChannels=()=>allChannels(currentLine).filter(channel=>channel.subshellKey===currentSubshell.key);
 const matchesMagnetic=channel=>channel.lower.m===currentChannel.lower.m&&channel.upper.m===currentChannel.upper.m;
 const signChannels=(sign=sigma)=>allChannels(currentLine).filter(c=>c.q*sign>0||(c.q===0&&c.lower.m*sign>=0));
 const visibleChannels=()=>signChannels();
 const availableLines=()=>lines.filter(line=>(series===0||line.lowerN===series)&&allChannels(line).length);
 const orderedLines=()=>availableLines().sort((a,b)=>a.wavelength-b.wavelength);
 // Keep the handle mounted while changing lines, including throughout pointer capture.
 const spectrumTrack=element('track'),lineLayer=document.createElement('span'),selectionHandle=document.createElement('button'),dragReadout=document.createElement('span');
 lineLayer.id='spectrum-lines';lineLayer.className='spectrum-lines';
 selectionHandle.id='spectrum-selection-handle';selectionHandle.className='spectrum-selection-handle';selectionHandle.type='button';
 selectionHandle.setAttribute('role','slider');selectionHandle.setAttribute('aria-label','Selected spectral line');selectionHandle.setAttribute('aria-orientation','horizontal');
 selectionHandle.setAttribute('aria-describedby','spectrum-drag-hint');selectionHandle.title='Drag to step through spectral lines. Use arrow keys for one line at a time.';
 dragReadout.id='spectrum-drag-readout';dragReadout.className='spectrum-drag-readout';dragReadout.setAttribute('aria-hidden','true');dragReadout.hidden=true;
 spectrumTrack.append(lineLayer,selectionHandle,dragReadout);
 let lineDrag=null,suppressTrackClickUntil=0;
 function updateSelectionHandle(){
  const candidates=orderedLines(),index=candidates.indexOf(currentLine),left=position(currentLine.wavelength)*100+'%';
  selectionHandle.style.left=left;dragReadout.style.left=left;
  selectionHandle.setAttribute('aria-valuemin','1');selectionHandle.setAttribute('aria-valuemax',String(candidates.length));selectionHandle.setAttribute('aria-valuenow',String(index+1));
  selectionHandle.setAttribute('aria-valuetext',`${currentLine.wavelength.toFixed(1)} nanometers, ${currentLine.name}, shells ${currentLine.lowerN} and ${currentLine.upperN}`);
  dragReadout.textContent=currentLine.wavelength.toFixed(1)+' nm';selectionHandle.disabled=candidates.length<2;
 }
 function selectIndexedLine(candidates,index){
  const line=candidates[Math.max(0,Math.min(candidates.length-1,index))];
  if(line&&line!==currentLine)selectLine(line.lowerN,line.upperN);
 }
 function finishLineDrag(restore=false){
  if(!lineDrag)return;
  const drag=lineDrag;lineDrag=null;
  spectrumTrack.classList.remove('is-dragging');selectionHandle.classList.remove('is-dragging');dragReadout.hidden=true;
  if(drag.moved)suppressTrackClickUntil=performance.now()+400;
  if(selectionHandle.hasPointerCapture?.(drag.pointerId))selectionHandle.releasePointerCapture(drag.pointerId);
  if(restore)selectLine(drag.initialLine.lowerN,drag.initialLine.upperN,drag.initialChannel);
 }
 function moveLineDrag(event){
  if(!lineDrag||event.pointerId!==lineDrag.pointerId)return;
  event.preventDefault();
  const distance=event.clientX-lineDrag.startX;
  if(Math.abs(distance)>3)lineDrag.moved=true;
  // Equal travel per line makes even the tightly clustered All-series lines selectable.
  selectIndexedLine(lineDrag.candidates,lineDrag.startIndex+Math.round(distance/lineDrag.pixelsPerLine));
 }
 selectionHandle.addEventListener('pointerdown',event=>{
  if(lineDrag||event.isPrimary===false||(event.button!==undefined&&event.button!==0))return;
  event.preventDefault();event.stopPropagation();selectionHandle.focus({preventScroll:true});
  const candidates=orderedLines(),bounds=spectrumTrack.getBoundingClientRect();
  lineDrag={pointerId:event.pointerId,startX:event.clientX,startIndex:candidates.indexOf(currentLine),candidates,pixelsPerLine:Math.max(24,bounds.width/Math.max(1,candidates.length-1)),initialLine:currentLine,initialChannel:currentChannel.id,moved:false};
  selectionHandle.setPointerCapture?.(event.pointerId);spectrumTrack.classList.add('is-dragging');selectionHandle.classList.add('is-dragging');dragReadout.hidden=false;
 });
 selectionHandle.addEventListener('pointermove',moveLineDrag);
 selectionHandle.addEventListener('pointerup',event=>{if(lineDrag?.pointerId===event.pointerId){event.preventDefault();finishLineDrag();}});
 selectionHandle.addEventListener('pointercancel',event=>{if(lineDrag?.pointerId===event.pointerId)finishLineDrag();});
 selectionHandle.addEventListener('lostpointercapture',()=>finishLineDrag());
 // Document listeners also cover browsers without element pointer capture.
 document.addEventListener('pointermove',event=>{if(event.target!==selectionHandle)moveLineDrag(event);});
 document.addEventListener('pointerup',event=>{if(lineDrag?.pointerId===event.pointerId)finishLineDrag();});
 document.addEventListener('pointercancel',event=>{if(lineDrag?.pointerId===event.pointerId)finishLineDrag();});
 selectionHandle.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();});
 selectionHandle.addEventListener('keydown',event=>{
  if(event.key==='Escape'&&lineDrag){event.preventDefault();finishLineDrag(true);return;}
  const candidates=orderedLines(),index=candidates.indexOf(currentLine);
  const destination={ArrowLeft:index-1,ArrowDown:index-1,ArrowRight:index+1,ArrowUp:index+1,Home:0,End:candidates.length-1}[event.key];
  if(destination===undefined)return;
  event.preventDefault();finishLineDrag();selectIndexedLine(candidates,destination);
 });
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
 function syncPerformance(){
 element('tracers-enabled').checked=view.particleAmount>0;
 element('particle-amount').disabled=view.particleAmount===0;
 element('particle-amount').nextElementSibling.querySelectorAll('span').forEach((tick,index)=>tick.hidden=false);

  element('particle-amount').min=0;element('particle-amount').max=4;element('particle-amount').step=1;element('particle-amount').value=Math.max(0,flowSpeeds.indexOf((view.particleAmount||lastPositiveTracers[view.renderStyle])*(view.renderStyle==='cloud'?50:1)));element('particle-amount-value').value=flowSpeedLabels[flowSpeeds.indexOf((view.particleAmount||lastPositiveTracers[view.renderStyle])*(view.renderStyle==='cloud'?50:1))];
  element('particle-amount').setAttribute('aria-valuetext',Math.round(view.particleAmount*200000*(view.cut==='slab'?(view.renderStyle==='granular'?1.5:2):1)).toLocaleString()+' tracers');
  const requested=Math.round(view.particleAmount*200000*(view.cut==='slab'?(view.renderStyle==='granular'?1.5:2):1)),active=Number.isFinite(lastPerformance?.particles)?Math.min(requested,lastPerformance.particles):requested;
  const targetFps=view.renderStyle==='granular'?30:60;
  element('tracer-status').hidden=!lastPerformance?.limited;
  element('tracer-status').textContent=lastPerformance?.limited?`${active.toLocaleString()} active · limited to protect ${targetFps} FPS`:`Up to ${requested.toLocaleString()} tracers`;
 }
 function syncView(){
  window.syncColorMapPickers?.(view.colorMap);
  for(const [attribute,key] of [['basis','basis'],['mode','mode'],['render-style','renderStyle'],['cut','cut']]){
   root.querySelectorAll('[data-spectrum-view-'+attribute+']').forEach(button=>{
    const selected=button.getAttribute('data-spectrum-view-'+attribute)===view[key];
    button.classList.toggle('selected',selected);button.setAttribute('aria-pressed',String(selected));
   });
  }
  const phase=view.mode==='phase',granular=view.renderStyle==='granular',real=view.basis==='real';
  element('view-label').textContent=(real?'REAL-BASIS PREVIEW':'COMPLEX')+' · '+(phase?'COMPONENT PHASE':granular?'GRANULAR DENSITY':'DENSITY CLOUD');
  element('density').min=0;element('density').max=4;element('density').step=1;element('density').value=flowSpeeds.indexOf(view.density);element('density').setAttribute('aria-valuetext',view.density+'×');element('density-value').value=flowSpeedLabels[flowSpeeds.indexOf(view.density)];
  element('look-inside').hidden=false;
 view.syncSliceHeight?.();
 const isWhole=view.cut==='none',isSlice=view.cut==='slab',isTop=view.cutView==='top';
 for(const [id,active] of [['whole-mode',isWhole],['hemisphere-mode',!isSlice&&!isWhole],['slice-mode',isSlice],['view-front',!isTop&&view.cutView!=='angled'],['view-angled',view.cutView==='angled'],['view-top',isTop]]){element(id).classList.toggle('selected',active);element(id).setAttribute('aria-pressed',String(active));}

  syncPerformance();
  element('flow-control').hidden=real;element('flow-control').parentElement.dataset.flowVisible=String(!real);
  const speedIndex=flowSpeeds.indexOf(view.speed);
  element('speed').min=0;element('speed').max=4;element('speed').step=1;element('speed').value=speedIndex;element('speed-value').value=flowSpeedLabels[speedIndex];
  element('speed').setAttribute('aria-valuetext',view.speed+' times speed');
  element('random-rotate').checked=!!view.randomRotate;element('show-axes').checked=view.axes;
  const metric=colorMetrics[colorMetricIndex(view.mode)];
  element('log-scale').disabled=['phase','contribution','density-change'].includes(view.mode);element('log-scale').checked=!!view.logScale&&!['phase','contribution','density-change'].includes(view.mode);element('color-metric').value=metric.id;
  element('legend-title').textContent=metric.name.toUpperCase()+((view.logScale&&!['phase','contribution','density-change'].includes(view.mode))?' · LOG':'');element('legend-low').textContent=metric.id==='phase'?metric.low:'1% mass';element('legend-high').textContent=metric.id==='phase'?metric.high:'99% mass';
  element('legend-gradient').style.background=viewGradient(v=>densityPalette(v,view.colorMap));element('legend-gradient').title=metric.description;
  if(metric.spectraOnly){element('legend-low').textContent=metric.low;element('legend-high').textContent=metric.high;}
  if(view.mode==='density-change')element('legend-title').textContent='DENSITY CHANGE · ZERO AT CENTER';
  element('view-label').textContent=(real?'REAL':'COMPLEX')+' · '+metric.name.toUpperCase()+((view.logScale&&!['phase','contribution','density-change'].includes(view.mode))?' · LOG':'');
 }
 function setView(partial){
  if(!partial||typeof partial!=='object')return false;
  const next={};
  if(['front','angled','top'].includes(partial.cutView))next.cutView=partial.cutView;
  if(['side','top'].includes(partial.sliceAxis))next.sliceAxis=partial.sliceAxis;
  if('colorMap' in partial)next.colorMap=colorMaps[colorMapIndex(partial.colorMap)].id;
  const paletteChanged=('logScale' in partial&&partial.logScale!==view.logScale)||('mode' in partial&&partial.mode!==view.mode)||('colorMap' in next&&next.colorMap!==view.colorMap);
  for(const [key,values] of Object.entries({basis:['complex','real'],mode:colorMetrics.map(m=>m.id),renderStyle:['cloud','granular'],cut:['none','half','wedge','slice','sector15','custom','slab','radius']}))if(values.includes(partial[key]))next[key]=partial[key];
  if(typeof partial.sliceSweep==='boolean')next.sliceSweep=partial.sliceSweep;
  for(const [key,range] of Object.entries({density:[.25,4],sliceThickness:[.01,1],sliceHeight:[-1,1],radiusLimit:[0,1],planeAzimuth:[0,360],planePolar:[0,90],wedgePolar:[0,90],slicePolar:[0,90],sliceAzimuth:[0,360],cutDegrees:[0,345],cutAngle:[0,360],cutOffset:[-.8,.8],particleAmount:[0,4],speed:[.25,4]}))if(typeof partial[key]==='number'&&Number.isFinite(partial[key]))next[key]=Math.max(range[0],Math.min(range[1],partial[key]));
  if('speed' in next)next.speed=nearestFlowSpeed(next.speed);
  if('cutAngle' in next)next.cutAngle=Math.round(next.cutAngle);
  for(const key of ['logScale','autoRotate','randomRotate','axes','frontView'])if(typeof partial[key]==='boolean')next[key]=partial[key];
  const nextStyle=next.renderStyle||view.renderStyle;
   if(nextStyle!==view.renderStyle){
   for(const key of modeSettingKeys)modeSettings[view.renderStyle][key]=view[key];
   for(const key of modeSettingKeys)if(!(key in next))next[key]=modeSettings[nextStyle][key];
   lastPerformance=null;
  }
  const nextBasis=next.basis||view.basis;
  if(Number.isFinite(next.particleAmount)){
   next.particleAmount=Math.max(0,Math.min(nextStyle==='cloud'?.08:4,next.particleAmount));
   if(next.particleAmount>0)lastPositiveTracers[nextStyle]=next.particleAmount;
   lastPerformance=null;
  }
  if(Number.isFinite(next.density))next.density=Math.max(.2,Math.min(4,next.density));
 Object.assign(view,next,{animate:true});view.cutView=['top','angled'].includes(view.cutView)?view.cutView:'front';view.cut=['none','slab'].includes(view.cut)?view.cut:'custom';view.cutDegrees=180;view.sliceThickness=.01;view.sliceHeight=Math.max(-1,Math.min(1,view.sliceHeight||0));if(view.cut!=='slab')view.sliceSweep=false;view.cutAngle=0;view.wedgePolar=view.cutView==='front'?90:0;view.slicePolar=view.wedgePolar;view.sliceAzimuth=90;view.planePolar=Math.max(0,Math.min(90,Number.isFinite(view.planePolar)?view.planePolar:90));basisStyles[view.basis]=view.renderStyle;renderer?.setState({...view});syncView();if(paletteChanged&&currentChannel)drawShapes();window.orbitalSharedSettings?.publish('spectra',view);return {...view};
 }
 function reportViewStats(info={}){
  element('status').hidden=true;
  lastPerformance=info;syncPerformance();
  element('render-status').textContent=(info.idle?'IDLE':Number.isFinite(info.fps)?Math.round(info.fps)+' FPS':'GPU')+(info.limited?' · LIMITED':'');
  if(info.resolution)element('render-status').title=info.resolution.join(' × ')+' pixels · '+(info.steps||0)+' samples per ray · '+(info.particles||0).toLocaleString()+' particles';
 }
 function showViewNotice(message){element('view-notice').textContent=message;element('view-notice').hidden=!message;}
 function updatePopulation(){
  const population=displayPopulation(cycle);
  // Drive both outlines from the same population used by the renderer.
  for(const [side,weight] of [['lower',1-population],['upper',population]]){
   const card=element(side+'-card');
   card.style.setProperty('--state-population',String(weight));
   card.setAttribute('aria-label',side+' state, '+Math.round(weight*100)+'% population');
  }
  element('direction').textContent=!playing?'Transition paused':cycle<.5?'Absorbing energy':'Stimulated emission';
  renderer?.setPopulation(population,populationRate(),maximumPopulationRate());
 }
 let pendingCamera=null;
 function setCamera(camera){pendingCamera={...camera};if(renderer){Object.assign(renderer.camera,pendingCamera);renderer.requestDraw();}}
 function ensureRenderer(){
  if(renderer||engineFailed)return;
  try{
   renderer=new SpectrumRenderer(element('canvas'),{
    onError(message){element('status').hidden=!message;element('status').dataset.error=String(!!message);if(message)element('status').textContent=message;},
    onStats:reportViewStats
   });
   renderer.setState({...view});renderer.setPair(currentChannel.lower,currentChannel.upper);renderer.setPopulation(displayPopulation(cycle),populationRate(),maximumPopulationRate());renderer.setVisible(visible&&!document.hidden);if(pendingCamera)setCamera(pendingCamera);
  }catch(error){engineFailed=true;element('status').hidden=false;element('status').dataset.error='true';element('status').textContent='The orbital view needs WebGL 2. Spectral lines, energies, allowed pairs and state populations remain available.';}
 }
 function drawBand(){
  const [min,max,ticks]=ranges[series],track=element('track'),axis=element('axis');
  const focusedLine=document.activeElement?.dataset?.spectrumLine;
  lineLayer.replaceChildren();axis.replaceChildren();
  const stops=Array.from({length:25},(_,i)=>`${wavelengthColor(min+(max-min)*i/24)} ${i/24*100}%`);
  track.style.setProperty('--spectrum-band',series===2?`linear-gradient(90deg,${stops.join(',')})`:'linear-gradient(90deg,#4272a3,#92b7e4)');
  ticks.forEach(value=>{const label=document.createElement('span');label.style.left=position(value)*100+'%';label.textContent=value+(value===max?' nm':'');axis.append(label);});
  const filtered=availableLines();
  for(const line of filtered){
   const selected=line===currentLine,color=wavelengthColor(line.wavelength);
   const accessible=`${line.name}, ${line.wavelength.toFixed(1)} nanometers, shells ${line.lowerN} and ${line.upperN}`;
   const tick=document.createElement('button');tick.type='button';tick.className='spectrum-line'+(selected?' selected':'');tick.dataset.spectrumLine=line.lowerN+'-'+line.upperN;tick.style.left=position(line.wavelength)*100+'%';tick.style.setProperty('--line-color',color);tick.setAttribute('aria-label',accessible);tick.setAttribute('aria-pressed',String(selected));tick.title=accessible;tick.addEventListener('click',event=>{event.stopPropagation();if(performance.now()>=suppressTrackClickUntil)selectLine(line.lowerN,line.upperN);});
   lineLayer.append(tick);
  }
  updateSelectionHandle();
  if(focusedLine)Array.from(lineLayer.children).find(button=>button.dataset.spectrumLine===focusedLine)?.focus({preventScroll:true});
  root.querySelectorAll('[data-spectrum-series]').forEach(button=>{
   const value=+button.dataset.spectrumSeries,selected=value===series;
   button.classList.toggle('selected',selected);button.setAttribute('aria-pressed',String(selected));
   button.disabled=false;
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
 const signedChannel=c=>allChannels(currentLine).find(a=>a.subshellKey===c.subshellKey&&a.lower.m===c.lower.m*sigma&&a.upper.m===c.upper.m*sigma);
 function drawShapes(){
  const container=element('shapes');container.replaceChildren();
  const channels=signChannels().sort((a,b)=>transitionStrength(a).strength-transitionStrength(b).strength);
  const seen=new Set();
  for(const channel of channels){
   const actual=channel;const key=channel.id;if(seen.has(key))continue;seen.add(key);
   const button=document.createElement('button');button.type='button';button.className='spectrum-shape'+(actual.id===currentChannel.id?' selected':'');button.dataset.spectrumChannel=channel.id;button.setAttribute('aria-pressed',String(actual.id===currentChannel.id));
   button.setAttribute('aria-label',`${orbitalName(actual.lower)}, m ${actual.lower.m}, and ${orbitalName(actual.upper)}, m ${actual.upper.m}.`);
   const layout=document.createElement('span');layout.className='transition-pair-layout';
   for(const [i,state] of [actual.lower,actual.upper].entries()){
    if(i){const arrow=document.createElement('span');arrow.className='transition-pair-divider';arrow.setAttribute('aria-hidden','true');layout.append(arrow);}
    const endpoint=document.createElement('span');endpoint.className='transition-endpoint';
    const img=document.createElement('img');img.width=62;img.height=62;img.alt='';img.src=window.orbitalApp?.thumbnail(state.n,state.l,state.m,view.colorMap,colorMetrics[colorMetricIndex(view.mode)].spectraOnly?'density':view.mode,view.logScale)||'';
    const name=document.createElement('strong');name.textContent=orbitalName(state);
    const magnetic=document.createElement('small');magnetic.innerHTML=mMath(state.m);
    endpoint.append(img,name,magnetic);layout.append(endpoint);
   }
   button.append(layout);button.addEventListener('click',()=>{selectChannel(actual.id);Array.from(container.children).find(b=>b.dataset.spectrumChannel===channel.id)?.focus({preventScroll:true});window.orbitalPages?.revealViewer('spectra');});container.append(button);
  }
  element('line-counts').textContent=seen.size+(stateFilter?' orbital pairs':' symmetry-grouped pairs');
 }
 function drawChannels(){
  element('sign-control').hidden=false;
  root.querySelectorAll('[data-spectrum-sigma]').forEach(b=>{b.disabled=!signChannels(+b.dataset.spectrumSigma).length;b.title=b.disabled?'No matches for this sign with the selected orbital filters':'';b.classList.toggle('selected',+b.dataset.spectrumSigma===sigma);b.setAttribute('aria-pressed',String(+b.dataset.spectrumSigma===sigma));});
  root.querySelectorAll('[data-spectrum-q]').forEach(button=>{const q=+button.dataset.spectrumQ;button.hidden=!!stateFilter||button.dataset.spectrumQ==='all';button.disabled=!allChannels(currentLine).some(c=>Math.abs(c.q)===q);button.classList.toggle('selected',q===Math.abs(currentChannel.q));button.setAttribute('aria-pressed',String(q===Math.abs(currentChannel.q)));});
 }
 function updateStrength(){
  const strength=transitionStrength(currentChannel),relative=strength.relative*100;
  element('strength-value').textContent=strength.strength.toPrecision(4)+' ';
  element('strength-relative').textContent=Number(relative.toPrecision(2)).toString()+'% strength';
 }
 function applyChannel(){
  syncStateEditors();element('state-edit-status').hidden=true;
  cycle=0;previousTime=null;
  element('lower-name').textContent=orbitalName(currentChannel.lower);element('upper-name').textContent=orbitalName(currentChannel.upper);
  element('lower-m').innerHTML=mMath(currentChannel.lower.m);element('upper-m').innerHTML=mMath(currentChannel.upper.m);
  element('lower-energy').textContent='−'+(energyScale/currentLine.lowerN**2).toFixed(3)+' eV';element('upper-energy').textContent='−'+(energyScale/currentLine.upperN**2).toFixed(3)+' eV';
  element('canvas').setAttribute('aria-label',`Three-dimensional population transfer between ${orbitalName(currentChannel.lower)}, magnetic number ${currentChannel.lower.m}, and ${orbitalName(currentChannel.upper)}, magnetic number ${currentChannel.upper.m}. Drag or use arrow keys to rotate; pinch or use plus and minus to zoom. Space pauses flow.`);
  renderer?.setPair(currentChannel.lower,currentChannel.upper);drawShapes();drawChannels();updateStrength();updatePopulation();syncView();if(visible)startFrame();
 }

 function syncStateEditors(){
  const channels=[...channelsByLine.values()].flat();
  for(const side of ['lower','upper']){
   const state=currentChannel[side];
   for(const key of ['n','l','m']){
    const compatible=channels.filter(c=>(key==='n'||c[side].n===state.n)&&(key!=='m'||c[side].l===state.l));
    const values=[...new Set(compatible.map(c=>c[side][key]))].sort((a,b)=>a-b);
    const select=element(side+'-'+key+'-select');select.replaceChildren();
    for(const value of values){
     const option=document.createElement('option');option.value=value;
     option.textContent=key==='l'?value+' · '+families[value]:key==='m'&&value>0?'+'+value:String(value);
     select.append(option);
    }
    select.value=state[key];
   }
  }
 }
 function editState(side,key,value){
  const other=side==='lower'?'upper':'lower',previous=currentChannel,desired={...previous[side],[key]:value};
  const candidates=[...channelsByLine.values()].flat().filter(c=>c[side][key]===value&&(key==='n'||c[side].n===desired.n)&&(key!=='m'||c[side].l===desired.l));
  const distance=(a,b)=>Math.abs(a.n-b.n)*100+Math.abs(a.l-b.l)*10+Math.abs(a.m-b.m);
  // Preserve the edited state first, then retain its partner wherever possible.
  candidates.sort((a,b)=>distance(a[side],desired)*10000+distance(a[other],previous[other])-distance(b[side],desired)*10000-distance(b[other],previous[other])||transitionStrength(b).relative-transitionStrength(a).relative);
  const chosen=candidates[0];if(!chosen)return;
  stateFilter=null;filterOrbital=null;series=0;updateStateFilter();
  selectLine(chosen.lower.n,chosen.upper.n,chosen.id);
  const status=element('state-edit-status');status.hidden=sameState(chosen[other],previous[other]);
  status.textContent=status.hidden?'':(other==='lower'?'Lower':'Upper')+' state adjusted to an allowed transition.';
 }
 for(const side of ['lower','upper'])for(const key of ['n','l','m']){
  element(side+'-'+key+'-select').addEventListener('change',event=>editState(side,key,Number(event.target.value)));
 }
 function selectChannel(id){
  const channel=allChannels(currentLine).find(item=>item.id===id);if(!channel)return false;
  currentChannel=channel;if(channel.q!==0)sigma=Math.sign(channel.q);if(channel.q===0&&channel.lower.m!==0)sigma=Math.sign(channel.lower.m);currentSubshell=getSubshellPairs(currentLine.lowerN,currentLine.upperN).find(pair=>pair.key===channel.subshellKey);
  qFilter=channel.q;
  applyChannel();return true;
 }
 function setSigma(value){

  const next=Number(value);if(![-1,1].includes(next)||next===sigma)return;
  const partner=allChannels(currentLine).find(c=>c.subshellKey===currentChannel.subshellKey&&c.lower.m===-currentChannel.lower.m&&c.upper.m===-currentChannel.upper.m);
  const choice=partner||signChannels(next)[0];if(choice){sigma=next;selectChannel(choice.id);}
 }
 root.querySelectorAll('[data-spectrum-sigma]').forEach(b=>b.addEventListener('click',()=>setSigma(b.dataset.spectrumSigma)));
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
  element('animation-wavelength-value').textContent=line.wavelength.toFixed(1);element('wavelength').textContent=line.wavelength.toFixed(1);element('line-name').textContent=`${line.name} · ${lowerN} ↔ ${upperN}`;element('energy').textContent=line.gap.toFixed(3)+' eV';
  element('region').textContent=line.wavelength<380?'Ultraviolet':line.wavelength>780?'Infrared':'Visible light';
  drawBand();drawLevels();
  const channels=allChannels(line);qFilter='all';
  const preferred=preferredChannel&&channels.find(channel=>channel.id===preferredChannel);
  const selected=preferred||channels.find(channel=>channel.lower.l===lowerN-1&&channel.upper.l===lowerN&&channel.lower.m===0&&channel.upper.m===0)||channels.find(channel=>channel.lower.m===0&&channel.upper.m===0)||channels[0];
  selectChannel(selected.id);return true;
 }
 function setSeries(value){
  if(!Number.isInteger(value)||value<0||value>5)return false;
  stateFilter=null;filterOrbital=null;
  const candidates=lines.filter(line=>(value===0||line.lowerN===value)&&allChannels(line).length);if(!candidates.length)return false;
  finishLineDrag();
  series=value;updateStateFilter();const line=candidates.includes(currentLine)?currentLine:candidates[0];return selectLine(line.lowerN,line.upperN);
 }
 function setPolarization(value){
  const magnitude=Math.abs(Number(value));if(![0,1].includes(magnitude))return false;
  const q=magnitude*sigma;
  let channels=allChannels(currentLine).filter(c=>c.q===q&&(q!==0||c.lower.m*sigma>=0));
  if(!channels.length&&stateFilter)channels=allChannels(currentLine).filter(c=>Math.abs(c.q)===magnitude);
  if(!channels.length)return false;
  return selectChannel((channels.find(c=>c.id===currentChannel.id)||channels.find(c=>c.subshellKey===currentSubshell.key)||channels[0]).id);
 }
 function movePair(offset){const qs=[0,1].filter(q=>allChannels(currentLine).some(c=>Math.abs(c.q)===q));return setPolarization(qs[(qs.indexOf(Math.abs(currentChannel.q))+offset+qs.length)%qs.length]);}
 function frame(now){
  raf=0;if(!visible||document.hidden){previousTime=null;return;}
  if(playing){
   if(previousTime!==null){
    const dt=Math.min((now-previousTime)/1000,.1);
    cycle=(cycle+dt*transitionRate/transitionCycleSeconds)%1;
   }
   previousTime=now;renderer?.setPopulation(displayPopulation(cycle),populationRate(),maximumPopulationRate());
   if(now-lastUiTime>=50){updatePopulation();lastUiTime=now;}
   // A channel change can schedule a frame too; retain a single animation loop.
   if(!raf)raf=requestAnimationFrame(frame);
  }else{previousTime=null;updatePopulation();}
 }
 function startFrame(){if(!raf&&visible&&!document.hidden&&playing)raf=requestAnimationFrame(frame);}
 const transitionRates=[.25,.5,1,2,4];
 const transitionRateLabels=['1/4','1/2','1','2','4'];
 function setTransitionRate(value){
  if(!Number.isFinite(+value))return;
  const index=transitionRates.reduce((best,rate,i)=>Math.abs(rate-value)<Math.abs(transitionRates[best]-value)?i:best,0);
  transitionRate=transitionRates[index];
  element('rate').value=String(index);
  element('rate').setAttribute('aria-valuetext',transitionRateLabels[index]+' times speed');
  element('rate-value').textContent=transitionRateLabels[index]+'×';
  element('rate-period').textContent=transitionCycleSeconds/transitionRate+' seconds per cycle';
 }
 element('rate').addEventListener('input',event=>setTransitionRate(transitionRates[+event.target.value]));
 setTransitionRate(1);
 function setPlaying(value){playing=!!value;previousTime=null;if(!playing){cancelAnimationFrame(raf);raf=0;}updatePopulation();startFrame();}
 const filterStates=Array.from({length:6},(_,i)=>i+1).flatMap(n=>Array.from({length:n},(_,l)=>l).flatMap(l=>Array.from({length:2*l+1},(_,i)=>({n,l,m:i-l}))));
 const eligibleFilterStates=()=>lines.filter(line=>series===0||line.lowerN===series).flatMap(line=>(channelsByLine.get(line.lowerN+'-'+line.upperN)||[]).flatMap(c=>[c.lower,c.upper]));
 function syncFilterInputs(){
  const v=stateFilter||{n:null,l:null,m:null};
  for(const [id,min,max] of [['n',1,6],['l',0,5],['m',-5,5]]){
   const select=element('filter-'+id);select.innerHTML='';
   const any=document.createElement('option');any.value='';any.textContent='All';select.appendChild(any);
   for(let i=min;i<=max;i++){
    const option=document.createElement('option');option.value=String(i);option.textContent=id==='l'?families[i]:id==='m'?signed(i):String(i);
    option.disabled=!eligibleFilterStates().some(st=>st[id]===i&&['n','l','m'].every(k=>k===id||v[k]==null||st[k]===v[k]));select.appendChild(option);
   }
   select.value=v[id]==null?'':String(v[id]);
  }
 }
 function applyOrbitalFilter(){
  stateFilter=['n','l','m'].every(k=>filterOrbital[k]==null)?null:{...filterOrbital};finishLineDrag();updateStateFilter();
  const candidates=availableLines();const line=candidates.find(item=>item===currentLine)||candidates[0];
  if(line)selectLine(line.lowerN,line.upperN,currentChannel.id);
 }
 for(const key of ['n','l','m'])element('filter-'+key).addEventListener('change',event=>{
  const next={...stateFilter,[key]:event.target.value===''?null:+event.target.value};
  if(!eligibleFilterStates().some(st=>['n','l','m'].every(k=>next[k]==null||st[k]===next[k]))){syncFilterInputs();return;}
  filterOrbital=next;applyOrbitalFilter();
 });
 function updateStateFilter(){
  element('state-filter').hidden=false;syncFilterInputs();
  element('filter-target').textContent='';
  element('filter-label').textContent='Matching orbitals on either side of each pair';
 }
 function exploreState(state){
  const candidate={n:Number(state.n),l:Number(state.l),m:Number(state.m)};
  if(!Number.isInteger(candidate.n)||candidate.n<1||candidate.n>6||!Number.isInteger(candidate.l)||candidate.l<0||candidate.l>=candidate.n||!Number.isInteger(candidate.m)||Math.abs(candidate.m)>candidate.l)return false;
  finishLineDrag();
  filterOrbital=candidate;stateFilter=null;series=0;updateStateFilter();
  const examples=lines.flatMap(line=>allChannels(line).filter(channel=>sameState(channel.lower,candidate)||sameState(channel.upper,candidate)).map(channel=>({line,channel})));
  examples.sort((a,b)=>Number(sameState(b.channel.lower,candidate))-Number(sameState(a.channel.lower,candidate))||(Math.abs(b.channel.lower.m)+Math.abs(b.channel.upper.m))-(Math.abs(a.channel.lower.m)+Math.abs(a.channel.upper.m))||a.line.upperN-b.line.upperN);
  const chosen=examples[0];if(!chosen)return false;
  window.orbitalPages?.go('spectra',{scroll:false});selectLine(chosen.line.lowerN,chosen.line.upperN,chosen.channel.id);window.orbitalPages?.revealViewer('spectra');return true;
 }
 function clearStateFilter(){finishLineDrag();stateFilter=null;updateStateFilter();selectLine(currentLine.lowerN,currentLine.upperN,currentChannel.id);}
const syncSliceHeight=bindSliceHeightControls(element,()=>view,setView,()=>visible,false);
view.syncSliceHeight=syncSliceHeight;syncSliceHeight();
function chooseCutView(shape,direction){
 const top=direction!=='front',polar=top?0:90;
 setView({cut:shape==='whole'?'none':shape==='slice'?'slab':'custom',cutDegrees:180,cutView:direction,cutAngle:0,wedgePolar:polar,sliceAxis:top?'top':'side',sliceAzimuth:90,slicePolar:polar,frontView:true});
 renderer?.alignCutView();
}
element('whole-mode').addEventListener('click',()=>chooseCutView('whole',view.cutView||'front'));
element('hemisphere-mode').addEventListener('click',()=>chooseCutView('hemisphere',view.cutView||'front'));
element('slice-mode').addEventListener('click',()=>chooseCutView('slice',view.cutView||'front'));
element('view-front').addEventListener('click',()=>chooseCutView(view.cut==='none'?'whole':view.cut==='slab'?'slice':'hemisphere','front'));
element('view-angled').addEventListener('click',()=>chooseCutView(view.cut==='none'?'whole':view.cut==='slab'?'slice':'hemisphere','angled'));
element('view-top').addEventListener('click',()=>chooseCutView(view.cut==='none'?'whole':view.cut==='slab'?'slice':'hemisphere','top'));
element('log-scale').addEventListener('change',event=>setView({logScale:event.target.checked}));
element('color-metric').addEventListener('change',event=>setView({mode:event.target.value}));
 for(const [attribute,key] of [['basis','basis'],['mode','mode'],['render-style','renderStyle'],['cut','cut']])root.querySelectorAll('[data-spectrum-view-'+attribute+']').forEach(button=>button.addEventListener('click',()=>setView({[key]:button.getAttribute('data-spectrum-view-'+attribute)})));
 for(const [id,key] of [['density','density']])element(id).addEventListener('input',event=>setView({[key]:key==='density'?flowSpeeds[+event.target.value]:+event.target.value}));
 element('speed').addEventListener('input',event=>setView({speed:flowSpeeds[+event.target.value]}));
 element('tracers-enabled').addEventListener('change',event=>setView({particleAmount:event.target.checked?lastPositiveTracers[view.renderStyle]:0}));
element('particle-amount').addEventListener('input',event=>setView({particleAmount:flowSpeeds[+event.target.value]/(view.renderStyle==='cloud'?50:1)}));
element('random-rotate').addEventListener('change',e=>setView({randomRotate:e.target.checked,autoRotate:false}));
 element('show-axes').addEventListener('change',event=>setView({axes:event.target.checked}));
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
  if(lineDrag||performance.now()<suppressTrackClickUntil||event.target===selectionHandle)return;
  const bounds=element('track').getBoundingClientRect(),fraction=Math.max(0,Math.min(1,(event.clientX-bounds.left)/bounds.width));
  const nearest=availableLines().reduce((best,line)=>!best||Math.abs(position(line.wavelength)-fraction)<Math.abs(position(best.wavelength)-fraction)?line:best,null);
  if(nearest)selectLine(nearest.lowerN,nearest.upperN);
 });
 element('clear-filter').addEventListener('click',clearStateFilter);
 element('zoom-in').addEventListener('click',()=>renderer?.zoomBy(.86));element('zoom-out').addEventListener('click',()=>renderer?.zoomBy(1.16));element('reset').addEventListener('click',()=>{const granular=view.renderStyle==='granular';setView({density:granular?2:1,particleAmount:granular?4:view.basis==='real'?0:.02,speed:granular?2:.5,cutAngle:0,cutOffset:0});setTransitionRate(1);renderer?.resetView();});
 document.querySelectorAll('[data-open-spectrum]').forEach(button=>button.addEventListener('click',()=>{window.orbitalPages?.go('spectra',{scroll:false});root.scrollIntoView({behavior:'smooth',block:'start'});element('title').focus({preventScroll:true});}));
 document.addEventListener('visibilitychange',()=>{previousTime=null;renderer?.setVisible(visible&&!document.hidden);if(document.hidden){cancelAnimationFrame(raf);raf=0;}else startFrame();});
 if(matchMedia('(pointer: coarse)').matches)element('gesture').textContent='Drag to rotate · Pinch to zoom';
 selectLine(2,3,getChannels(2,3,1,2).find(channel=>channel.lower.m===0&&channel.upper.m===0).id);updateStateFilter();
 if('IntersectionObserver' in window){
  const observer=new IntersectionObserver(entries=>{
   visible=document.body.dataset.page==='spectra'&&entries[0].isIntersecting;previousTime=null;
   if(visible){ensureRenderer();renderer?.setVisible(!document.hidden);startFrame();}
   else{renderer?.setVisible(false);cancelAnimationFrame(raf);raf=0;}
  },{threshold:0});observer.observe(root.querySelector('.spectrum-stage'));
 }else{visible=document.body.dataset.page==='spectra';if(visible){ensureRenderer();startFrame();}}
 function setPageActive(active){
  previousTime=null;
  if(!active){stateFilter=null;filterOrbital=null;updateStateFilter();selectLine(currentLine.lowerN,currentLine.upperN,currentChannel.id);finishLineDrag();visible=false;renderer?.setVisible(false);cancelAnimationFrame(raf);raf=0;}
  else if(typeof IntersectionObserver==='undefined'){visible=true;ensureRenderer();renderer?.setVisible(!document.hidden);startFrame();}
 }
 element('see-orbit').addEventListener('click',()=>window.orbitalApp?.exploreState({...currentChannel.lower,m:(currentChannel.lower.m<0?-1:1)*currentChannel.lower.l}));
 const pulse=(target,cls='jump-highlight')=>{if(!target)return;target.classList.remove(cls);void target.offsetWidth;target.classList.add(cls);setTimeout(()=>target.classList.remove(cls),2400);};
 const showAllForCurrent=()=>{const id=currentChannel.id;finishLineDrag();series=0;stateFilter=null;updateStateFilter();selectLine(currentLine.lowerN,currentLine.upperN,id);};
 element('see-pair').addEventListener('click',()=>{showAllForCurrent();const card=element('shapes').querySelector('.selected');if(card){card.scrollIntoView({behavior:'smooth',block:'center'});pulse(card);}});
 element('see-line')?.addEventListener('click',()=>{showAllForCurrent();element('track').scrollIntoView({behavior:'smooth',block:'center'});pulse(selectionHandle,'dot-pulse');pulse(element('shapes').querySelector('.selected'));});
 const api={setPageActive,setCamera,get view(){return {...view};},setView,get state(){return {view:{...view},sigma,transitionRate,series,lower:currentLine.lowerN,upper:currentLine.upperN,cycle,population:displayPopulation(cycle),playing,visible,wavelength:currentLine.wavelength,energy:currentLine.gap,line:{...currentLine},subshell:{...currentSubshell},channel:{...currentChannel,lower:{...currentChannel.lower},upper:{...currentChannel.upper}},qFilter,stateFilter:stateFilter?{...stateFilter}:null,availableChannelIds:visibleChannels().map(channel=>channel.id)};},setSigma,setTransitionRate,selectLine,selectSubshell,selectChannel,setSeries,setPolarization,setPlaying,exploreState,clearStateFilter,nextPair:()=>movePair(1),previousPair:()=>movePair(-1),get renderer(){return renderer;}};
 window.spectrumApp=api;return api;
}
