import fs from 'node:fs/promises';import path from 'node:path';import http from 'node:http';import {createHash} from 'node:crypto';import {chromium} from 'playwright';
const candidate=process.env.ANIMATION_CUT_SOURCE||'output/arpg-animation/death-cut-v3/candidate/src/assets/enemy-death-cut.js';
const baseline=process.env.ANIMATION_CUT_BEFORE||'output/arpg-animation/death-cut-v3/before/src/assets/enemy-death-cut.js';
const out=path.resolve(process.env.ANIMATION_OUTPUT||'output/playwright/arpg-animation-cut-v3');await fs.mkdir(out,{recursive:true});
const base=JSON.parse(await fs.readFile('output/playwright/arpg-animation-enemy-v2/report.json','utf8'));
const files=[...new Set([...Object.keys(base.after),candidate,baseline,'tools/animation-cut-preview.html','tools/animation-cut-native.mjs'])];
const hashes=async()=>Object.fromEntries(await Promise.all(files.map(async f=>[f,createHash('sha256').update(await fs.readFile(f)).digest('hex')])));
const report={scope:'Native Chrome Metal isolated corpse fixture; explicit module substitution for before/candidate, no live runtime mutation and not gameplay.',candidate,baseline,before:await hashes(),errors:[],captures:[]};
const server=http.createServer(async(req,res)=>{try{const parsed=new URL(req.url,'http://localhost'),url=decodeURIComponent(parsed.pathname);if(!/^\/(tools|src|vendor|assets)\//.test(url)||url.includes('..'))throw Error('Invalid');const override=url==='/src/assets/enemy-death-cut.js'?(parsed.searchParams.get('variant')==='before'?baseline:candidate):null;const bytes=await fs.readFile(override||path.join(process.cwd(),url));res.setHeader('Content-Type',({'.js':'application/javascript','.html':'text/html','.json':'application/json','.glb':'model/gltf-binary'})[path.extname(url)]||'application/octet-stream');res.end(bytes);}catch(e){res.writeHead(404);res.end();}});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const types=(process.env.ANIMATION_CUT_TYPES||'orcPeon,zombie,brute,lich').split(',');
let browser;
try{browser=await chromium.launch({headless:true,channel:'chrome',args:['--use-gl=angle','--use-angle=metal']});
 for(const type of types){
  const context=await browser.newContext({viewport:{width:1100,height:820},recordVideo:{dir:out,size:{width:1100,height:820}}}),page=await context.newPage();page.on('pageerror',e=>report.errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});page.on('response',r=>{if(r.status()>=400)report.errors.push(`${r.status()} ${r.url()}`);});
  await page.goto(`http://127.0.0.1:${server.address().port}/tools/animation-cut-preview.html`);await page.waitForFunction(()=>window.cutFixture?.ready);
  for(const variant of ['before','candidate']){
   await page.evaluate(options=>window.cutFixture.configure(options),{type,variant});let previous=0;
   for(const t of [.12,.38,.9]){await page.evaluate(dt=>window.cutFixture.step(dt),t-previous);previous=t;const file=`${type}-${variant}-${t}.png`;await page.screenshot({path:path.join(out,file)});report.captures.push({file,...await page.evaluate(()=>window.cutFixture.snapshot())});}
   await page.evaluate(options=>{window.cutFixture.configure(options);window.cutFixture.play(.25);},{type,variant});await page.waitForTimeout(6900);await page.evaluate(()=>window.cutFixture.play(0));
  }
  await page.evaluate(options=>{window.cutFixture.configure(options);window.cutFixture.step(.55);window.cutFixture.side();},{type,variant:'candidate',quality:'low'});const file=`${type}-candidate-low.png`;await page.screenshot({path:path.join(out,file)});report.captures.push({file,...await page.evaluate(()=>window.cutFixture.snapshot())});
  const video=page.video();await context.close();await video.saveAs(path.join(out,`${type}-before-after.webm`));
 }
}catch(e){report.errors.push(String(e));process.exitCode=1;}finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
report.after=await hashes();report.sourceStable=JSON.stringify(report.before)===JSON.stringify(report.after);report.nativeRenderPassed=report.sourceStable&&!report.errors.length&&report.captures.length===types.length*7&&report.captures.every(c=>c.glError===0);await fs.writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({out,sourceStable:report.sourceStable,nativeRenderPassed:report.nativeRenderPassed,errors:report.errors}));
