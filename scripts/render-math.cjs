#!/usr/bin/env node
/** Optional offline math authoring tool. Uses the bundled KaTeX compiler; no npm or network. */
const fs=require('node:fs');
const path=require('node:path');
const katex=require('./vendor/katex.cjs');
const root=path.resolve(__dirname,'..');
const output=fs.existsSync(path.join(root,'src/assets'))?path.join(root,'src/assets'):path.join(root,'dist');
const render=(tex,displayMode=false)=>katex.renderToString(tex,{displayMode,output:'htmlAndMathml',throwOnError:true,strict:'error',trust:false});
let displayCount=0,inlineCount=0;
let guide=fs.readFileSync(path.join(root,'src/math-guide.tex.html'),'utf8');
guide=guide.replace(/\\\[([\s\S]*?)\\\]/g,(_,tex)=>{displayCount++;return render(tex,true);});
guide=guide.replace(/\\\(([\s\S]*?)\\\)/g,(_,tex)=>{inlineCount++;return `<span class="inline-math">${render(tex)}</span>`;});
const source=JSON.parse(fs.readFileSync(path.join(root,'src/math-fragments.tex.json'),'utf8'));
const fragments=Object.fromEntries(Object.entries(source).map(([key,tex])=>[key,render(tex)]));
fs.writeFileSync(path.join(output,'math-guide.html'),guide);
fs.writeFileSync(path.join(output,'math-fragments.json'),JSON.stringify(fragments));
process.stdout.write(`Rendered ${displayCount} display equations, ${inlineCount} inline expressions, and ${Object.keys(fragments).length} UI fragments.\n`);
