import fs from 'node:fs';import path from 'node:path';import http from 'node:http';import crypto from 'node:crypto';import assert from 'node:assert/strict';import {chromium} from 'playwright';
const gpu=process.argv.includes('--gpu'),base=path.resolve('output/lich-cast-v1'),stamp=new Date().toISOString().replace(/[:.]/g,'-'),out=path.join(base,`${gpu?'native':'cpu'}-${stamp}`);
const lock='/tmp/bipx-arpg-gpu.lock',token=crypto.randomUUID();let ownsLock=false,browser,server;
if(gpu){try{fs.mkdirSync(lock);}catch(error){if(error.code==='EEXIST'){console.log('GPU_BUSY');process.exit(2);}throw error;}fs.writeFileSync(path.join(lock,'owner.json'),JSON.stringify({owner:'SFX Lich staging',pid:process.pid,token,at:new Date().toISOString()}));ownsLock=true;}
fs.mkdirSync(out,{recursive:true});
const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const preservation=JSON.parse(fs.readFileSync(path.join(base,'preservation.json')));
const files=[...Object.keys(preservation.originalHashes),'output/lich-cast-v1/monster-library-staged.js','output/lich-cast-v1/lich-cast-profile.js','output/lich-cast-v1/assets/lich.glb','tools/lich-cast-review.html','tools/lich-cast-review-run.mjs'];
const hashes=()=>Object.fromEntries(files.map(f=>[f,hash(f)]));const before=hashes(),report={gpu,scope:'Isolated real Lich asset fixture, not gameplay or projectile/network proof',before,errors:[],captures:[],playbacks:[]};
try{
 for(const[f,h]of Object.entries(preservation.originalHashes))assert.equal(hash(f),h,`Original changed: ${f}`);
 server=http.createServer((req,res)=>{try{const p=decodeURIComponent(new URL(req.url,'http://localhost').pathname);if(p.includes('..')||!(/^\/(src\/assets|vendor|output\/lich-cast-v1)\//.test(p)||p==='/tools/lich-cast-review.html'))throw Error('denied');const f=path.resolve(`.${p}`);const b=fs.readFileSync(f);res.setHeader('content-type',({'.html':'text/html','.js':'application/javascript','.json':'application/json','.glb':'model/gltf-binary'})[path.extname(f)]||'application/octet-stream');res.end(b);}catch{res.writeHead(404).end();}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 browser=await chromium.launch(gpu?{headless:true,channel:'chrome',args:['--use-gl=angle','--use-angle=metal']}:{headless:true,args:['--disable-gpu']});
 const context=await browser.newContext({viewport:{width:1280,height:800},...(gpu?{recordVideo:{dir:path.join(out,'video'),size:{width:1280,height:800}}}:{})}),page=await context.newPage();
 page.on('pageerror',e=>report.errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});page.on('response',r=>{if(r.status()>=400)report.errors.push(`${r.status()} ${r.url()}`);});
 await page.goto(`http://127.0.0.1:${server.address().port}/tools/lich-cast-review.html${gpu?'':'?cpu'}`,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.lichCastReview?.ready);
 if(!gpu){report.cpu=await page.evaluate(()=>window.lichCastReview.cpuChecks());}
 else{
  report.gl=await page.evaluate(()=>window.lichCastReview.glInfo());
  for(const view of ['close','arpg']){
   await page.evaluate(view=>window.lichCastReview.setView(view),view);
   for(const mode of ['full','cancel-before','cancel-after',...(view==='close'?['freeze-before','stun-after']:[])]){
    await page.evaluate(mode=>window.lichCastReview.play(mode),mode);await page.waitForFunction(()=>!window.lichCastReview.playing,null,{timeout:6000});
    report.playbacks.push({view,mode,frames:await page.evaluate(()=>window.lichCastReview.frames)});
   }
   for(const t of [0,.25,.50,.565,1.1*19/35,.63,.8,1.05]){
    const snapshot=await page.evaluate(t=>window.lichCastReview.seek(t),t);const name=`${view}-${t.toFixed(6)}.png`;await page.screenshot({path:path.join(out,name)});report.captures.push({view,t,file:name,sha256:hash(path.join(out,name)),snapshot});
   }
  }
  report.video=await page.video().path();
 }
 await context.close();
 report.after=hashes();report.sourceStable=JSON.stringify(before)===JSON.stringify(report.after);assert(report.sourceStable);assert.deepEqual(report.errors,[]);report.passed=true;
}catch(error){report.errors.push(String(error.stack||error));report.passed=false;process.exitCode=1;}
finally{
 await browser?.close();if(server)await new Promise(r=>server.close(r));
 if(ownsLock&&JSON.parse(fs.readFileSync(path.join(lock,'owner.json'))).token===token){fs.unlinkSync(path.join(lock,'owner.json'));fs.rmdirSync(lock);}
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({out,passed:report.passed,sourceStable:report.sourceStable,checks:report.cpu?.checks.length,captures:report.captures.length,playbacks:report.playbacks.length,errors:report.errors}));
}
