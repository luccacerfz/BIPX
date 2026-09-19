import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import http from 'node:http';
import {execFileSync} from 'node:child_process';
import {chromium} from 'playwright';

const base='output/brute-motion-v6',gateFile=`${base}/gpu-native-window.json`;
const gate=JSON.parse(fs.readFileSync(gateFile));
assert(gate.vfxPeerHiddenReleased && gate.animationV12Dt0Released && gate.evidence.length>=2,
  'Await actual VFX peer-hidden and Animation v12 dt0 release before reserving');
const hash=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const frozen=JSON.parse(fs.readFileSync(`${base}/delivery-manifest.json`)).files;
for(const[f,h]of Object.entries(frozen))assert.equal(hash(f),h,`Frozen CPU delivery changed: ${f}`);
const profile=JSON.parse(fs.readFileSync(`${base}/handoff-01/attack-profiles.json`));
const poses=JSON.parse(fs.readFileSync(`${base}/handoff-01/poses.json`));
const source=JSON.parse(fs.readFileSync(`${base}/source-manifest.json`));
const walk=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(`${d}/${e.name}`):[`${d}/${e.name}`]);
const files=[...new Set([...Object.keys(frozen),...Object.keys(source.sources),...walk('src'),
  'vendor/three/three.module.js','vendor/three/three.core.js',
  'tools/brute-motion-review-v6-native-scene.mjs','tools/brute-motion-review-v6-native-preflight.mjs',
  'tools/brute-motion-review-v6-native.html','tools/brute-motion-review-v6-native.mjs',
  `${base}/delivery-manifest.json`,`${base}/native-preparation/cpu-preflight.json`])].filter(fs.existsSync);
const hashes=()=>Object.fromEntries(files.map(f=>[f,hash(f)]));
const lock='/tmp/bipx-arpg-gpu.lock',token=crypto.randomUUID();let browser,server,owns=false;
const out=`${base}/native-${new Date().toISOString().replace(/[:.]/g,'-')}`;
const report={at:new Date().toISOString(),scope:'Native isolated fixture: full frozen handoff-01 clips, no gameplay/authority/marker selection',
  gate,profile,errors:[],playbacks:[],captures:[],httpAssets:[],before:hashes(),
  server5173Before:execFileSync('lsof',['-nP','-iTCP:5173','-sTCP:LISTEN'],{encoding:'utf8'}),
  negative182:'Preserved CPU negative; no change to target or range; not replayed in this bounded native capture'};
try{fs.mkdirSync(lock);}catch(e){if(e.code==='EEXIST'){console.log('GPU_BUSY; other owner retained');process.exit(2);}throw e;}
try{
  fs.writeFileSync(`${lock}/owner.json`,JSON.stringify({owner:'sfx-brute-v6-handoff-01',pid:process.pid,token,created:new Date().toISOString()}));owns=true;
  fs.mkdirSync(out);report.lockAcquiredAt=new Date().toISOString();report.token=token;
  server=http.createServer((req,res)=>{try{
    const p=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    if(p.includes('..')||!(/^\/tools\/brute-motion-review-v6-native(?:-scene\.mjs|\.html)$/.test(p)
      ||/^\/(vendor|src\/assets|output\/brute-motion-v6)\//.test(p)))throw Error('denied');
    const f=path.resolve(`.${p}`),bytes=fs.readFileSync(f);
    if(p.endsWith('.glb'))report.httpAssets.push({url:p,sha256:hash(f),bytes:bytes.length});
    res.setHeader('Content-Type',({'.html':'text/html','.js':'application/javascript','.mjs':'application/javascript','.json':'application/json','.glb':'model/gltf-binary'})[path.extname(f)]||'application/octet-stream');
    res.end(bytes);
  }catch{res.writeHead(404).end();}});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));report.ownServerPort=server.address().port;
  browser=await chromium.launch({headless:true,channel:'chrome',args:['--use-gl=angle','--use-angle=metal']});
  const context=await browser.newContext({viewport:{width:1440,height:900}}),page=await context.newPage();
  page.on('pageerror',e=>report.errors.push(String(e)));
  page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
  page.on('response',r=>{if(r.status()>=400)report.errors.push(`${r.status()} ${r.url()}`);});
  await page.goto(`http://127.0.0.1:${report.ownServerPort}/tools/brute-motion-review-v6-native.html`);
  await page.waitForFunction(()=>window.bruteReview?.ready,null,{timeout:30000});
  report.gl=await page.evaluate(()=>window.bruteReview.glInfo());
  assert(!/SwiftShader|llvmpipe/i.test(report.gl.renderer),'Hardware native capture required');
  for(const id of ['warrior','dwarf'])for(const view of ['threequarter','arpg']){
    const setup=await page.evaluate(([id,view])=>window.bruteReview.configure(id,view),[id,view]);
    assert.equal(setup.centerDistance,1.89);
    const playback=await page.evaluate(()=>window.bruteReview.play());
    assert.equal(playback.final.time,1.45);assert(playback.frames.filter(f=>f.mode==='attack').length>30);
    for(const f of playback.frames)assert.equal(f.centerDistance,1.89);
    const video=await page.evaluate(()=>window.bruteReview.takeVideo());
    const videoFile=`${id}-${view}-playback-1x.webm`;fs.writeFileSync(`${out}/${videoFile}`,Buffer.from(video.bytes));
    report.playbacks.push({...playback,setup,video:videoFile,videoSHA:hash(`${out}/${videoFile}`)});
    for(const time of [0,.18,.40,.70,.82,1.05,1.45]){
      const snapshot=await page.evaluate(t=>window.bruteReview.seek(t),time);
      const file=`${id}-${view}-sample-${time.toFixed(2)}.png`;await page.screenshot({path:`${out}/${file}`});
      report.captures.push({id,view,time,file,sha256:hash(`${out}/${file}`),snapshot,type:'separately sampled pose; not a playback frame'});
      if(time===.7 && view==='threequarter'){
        const geometry=await page.evaluate(()=>window.bruteReview.geometry());
        const error=(a,b)=>Math.max(...a.map((p,i)=>Math.hypot(...p.map((x,j)=>x-b[i][j]))));
        const brute=error(geometry.brute,poses.variants[id].poses.find(p=>p.time===.7).positions);
        const heroes=poses.heroes[id].map(p=>({mesh:p.name,maxError:error(geometry.heroes[p.name],p.positions)}));
        assert(brute<1e-5);for(const h of heroes)assert(h.maxError<1e-6);
        report.playbacks.at(-1).nativeCpuGeometryParity={time:.7,bruteMaxError:brute,heroes};
      }
    }
  }
  report.finalGL=await page.evaluate(()=>window.bruteReview.glInfo());
  await context.close();
  assert.equal(report.finalGL.error,0);assert.deepEqual(report.errors,[]);
  report.after=hashes();report.sourceStable=JSON.stringify(report.before)===JSON.stringify(report.after);
  assert(report.sourceStable,'Observed source drift');
  report.passed=true;
}catch(e){report.errors.push(e.stack);report.passed=false;process.exitCode=1;}
finally{
  await browser?.close();report.browserClosedAt=new Date().toISOString();
  if(server)await new Promise(r=>server.close(r));report.ownServerClosedAt=new Date().toISOString();
  if(owns&&fs.existsSync(`${lock}/owner.json`)&&JSON.parse(fs.readFileSync(`${lock}/owner.json`)).token===token){
    fs.unlinkSync(`${lock}/owner.json`);fs.rmdirSync(lock);report.ownTokenReleased=true;
  }
  report.releasedAt=new Date().toISOString();
  report.server5173After=execFileSync('lsof',['-nP','-iTCP:5173','-sTCP:LISTEN'],{encoding:'utf8'});
  fs.writeFileSync(`${out}/report.json`,JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({out,passed:report.passed,playbacks:report.playbacks.length,captures:report.captures.length,releasedAt:report.releasedAt,errors:report.errors}));
}
