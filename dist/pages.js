// Separate addressable pages, with in-place navigation to retain viewer selections.
const pageNames = {orbits:'Orbits',spectra:'Spectra',math:'Math'};
function pageFromLocation(){
 const file=location.pathname.split('/').pop();
 return file==='spectra.html'?'spectra':file==='math.html'?'math':'orbits';
}
function showSitePage(page,{hash='',scroll=true,replace=false,historyUpdate=true,focus=true}={}){
 if(!pageNames[page])return false;
 document.body.dataset.page=page;
 document.querySelectorAll('[data-site-page]').forEach(panel=>{panel.hidden=panel.dataset.sitePage!==page;});
 document.querySelectorAll('[data-page-link]').forEach(link=>{
  if(link.dataset.pageLink===page)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');
 });
 document.title=pageNames[page]+' — Orbital Atlas';
 if(historyUpdate){try{history[replace?'replaceState':'pushState']({page},'',page+'.html'+hash);}catch{/* Local file viewers may restrict history; the page remains usable. */}}
 window.orbitalApp?.setPageActive(page==='orbits');
 window.spectrumApp?.setPageActive(page==='spectra');
 if(scroll)window.scrollTo({top:0,behavior:'instant'});
 if(focus){const heading=document.getElementById(page==='orbits'?'orbits-title':page==='spectra'?'spectrum-title':'math-title');heading?.focus({preventScroll:true});}
 if(page==='math'&&/^#math-topic-\d+$/.test(hash)){
  const topic=document.getElementById(hash.slice(1));
  if(topic){const dive=topic.querySelector('.math-deep-dive');if(dive)dive.open=true;requestAnimationFrame(()=>topic.scrollIntoView({behavior:'smooth',block:'start'}));}
 }
 return true;
}
export function showMathTopic(number){
 showSitePage('math',{hash:Number.isInteger(number)&&number>0?'#math-topic-'+number:''});
}
window.orbitalPages={go:showSitePage,get page(){return document.body.dataset.page;}};
export function initPageNavigation(){
 document.querySelectorAll('[data-page-link]').forEach(link=>link.addEventListener('click',event=>{
  if(event.button>0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
  event.preventDefault();showSitePage(link.dataset.pageLink);
 }));
 window.addEventListener('popstate',()=>showSitePage(pageFromLocation(),{historyUpdate:false,hash:location.hash}));
 window.addEventListener('hashchange',()=>{if(pageFromLocation()==='math')showSitePage('math',{historyUpdate:false,hash:location.hash,scroll:false});});
 showSitePage(pageFromLocation(),{historyUpdate:false,hash:location.hash,scroll:false,focus:false});
}
