import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import assert from 'node:assert/strict';import http from 'node:http';import {chromium} from 'playwright';
const base=path.resolve('output/brute-motion-v4'),gate=path.join(base,'gpu-window.json');
assert(fs.existsSync(gate),'GPU queue is gated: record Combat release evidence before running');
const windowEvidence=JSON.parse(fs.readFileSync(gate));assert(windowEvidence.combinedWindowClosed===true&&windowEvidence.evidence,'No combined-window release');
const lock='/tmp/bipx-arpg-gpu.lock',token=crypto.randomUUID();let browser,server,owns=false;
try{fs.mkdirSync(lock);}catch(e){if(e.code==='EEXIST'){console.log('GPU_BUSY');process.exit(2);}throw e;}
fs.writeFileSync(path.join(lock,'owner.json'),JSON.stringify({owner:'SFX Brute v4 staging',pid:process.pid,token,at:new Date().toISOString()}));owns=true;
const out=path.join(base,`native-${new Date().toISOString().replace(/[:.]/g,'-')}`);fs.mkdirSync(out);
const hash=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const provenance=JSON.parse(fs.readFileSync(path.join(base,'provenance.json')));
const files=[...Object.keys(provenance.preservedHashes),'assets/models/monsters/ground-probes.json','vendor/three/three.module.js','src/assets/vendor/GLTFLoader.js','src/assets/vendor/BufferGeometryUtils.js','output/brute-motion-v4/swipe/brute.glb','output/brute-motion-v4/frontal/brute.glb','output/brute-motion-v4/attack-profiles.json','output/brute-motion-v4/attack-profile-adapter.mjs','tools/brute-motion-review.html','tools/brute-motion-review-native.mjs'];
const hashes=()=>Object.fromEntries(files.map(f=>[f,hash(f)]));const report={scope:'Native isolated frontal fixture at real caller .55s plus source-time reference, not gameplay/artistic approval',windowEvidence,before:hashes(),errors:[],playbacks:[],captures:[]};
try{
 for(const[f,h]of Object.entries(provenance.preservedHashes))assert.equal(hash(f),h,`Preserved source changed: ${f}`);
 server=http.createServer((req,res)=>{try{const p=decodeURIComponent(new URL(req.url,'http://localhost').pathname);if(p.includes('..')||!(p==='/tools/brute-motion-review.html'||p==='/assets/models/monsters/ground-probes.json'||/^\/(vendor|src\/assets|output\/brute-motion-v4)\//.test(p)))throw Error('denied');const f=path.resolve(`.${p}`),b=fs.readFileSync(f);res.setHeader('content-type',({'.html':'text/html','.js':'application/javascript','.mjs':'application/javascript','.json':'application/json','.glb':'model/gltf-binary'})[path.extname(f)]||'application/octet-stream');res.end(b);}catch{res.writeHead(404).end();}});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 browser=await chromium.launch({headless:true,channel:'chrome',args:['--use-gl=angle','--use-angle=metal']});const context=await browser.newContext({viewport:{width:1440,height:900},recordVideo:{dir:path.join(out,'video'),size:{width:1440,height:900}}}),page=await context.newPage();
 page.on('pageerror',e=>report.errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});page.on('response',r=>{if(r.status()>=400)report.errors.push(`${r.status()} ${r.url()}`);});
 await page.goto(`http://127.0.0.1:${server.address().port}/tools/brute-motion-review.html`);await page.waitForFunction(()=>window.bruteReview?.ready);
 report.gl=await page.evaluate(()=>window.bruteReview.glInfo());
 for(const view of ['threequarter','arpg']){
  await page.evaluate(v=>window.bruteReview.setView(v),view);
  for(const timing of ['caller','source']){await page.evaluate(t=>window.bruteReview.play(t),timing);await page.waitForFunction(()=>!window.bruteReview.playing,null,{timeout:7000});const frames=await page.evaluate(()=>window.bruteReview.frames);assert(frames.length>10);assert(Math.abs(frames.at(-1).wallTime-(frames.at(-1).time+.3))<1e-6);report.playbacks.push({view,timing,frames});}
  for(const phase of [0,.15,.3,.6,.8,1,'marker']){
   const snapshot=await page.evaluate(p=>p==='marker'?window.bruteReview.seekMarkers():window.bruteReview.seek(p),phase);const file=`${view}-${phase}.png`;await page.screenshot({path:path.join(out,file)});report.captures.push({view,phase,file,sha256:hash(path.join(out,file)),snapshot});
  }
 }
 report.video=await page.video().path();await context.close();report.after=hashes();report.sourceStable=JSON.stringify(report.before)===JSON.stringify(report.after);assert(report.sourceStable);assert.equal(report.gl.error,0);assert.deepEqual(report.errors,[]);report.passed=true;
}catch(e){report.errors.push(e.stack);report.passed=false;process.exitCode=1;}
finally{await browser?.close();if(server)await new Promise(r=>server.close(r));if(owns&&JSON.parse(fs.readFileSync(path.join(lock,'owner.json'))).token===token){fs.unlinkSync(path.join(lock,'owner.json'));fs.rmdirSync(lock);}fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({out,passed:report.passed,captures:report.captures.length,playbacks:report.playbacks.length,errors:report.errors}));}
