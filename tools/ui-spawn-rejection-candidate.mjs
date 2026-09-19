import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { chromium, evidenceDir, sourceFingerprint } from './quality-browser.mjs';
import { localServer } from './quality-isolated-server.mjs';
const candidate='assets/ui/arpg/source-history/spawn-rejection-candidate';
const lock='/tmp/bipx-arpg-gpu.lock',token=crypto.randomUUID();
try{fs.mkdirSync(lock);}catch(error){if(error.code==='EEXIST'){console.log('GPU occupied; isolated proposal remains staged.');process.exit(75);}throw error;}
fs.writeFileSync(path.join(lock,'owner.json'),JSON.stringify({owner:'gui-spawn-proposal',pid:process.pid,token,created:new Date().toISOString()}));
const baseline=sourceFingerprint(),report={isolated:true,promoted:false,scope:'Static DOM fixture; no game, network rejection or recovery proof.',checks:[],cases:[],errors:[],source:baseline};
const check=(name,value)=>{assert.ok(value,name);report.checks.push(name);};
const luminance=rgb=>rgb.map(x=>x/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4).reduce((v,x,i)=>v+x*[.2126,.7152,.0722][i],0);
const contrast=(a,b)=>{const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
let browser,server;
try{
  server=await localServer();browser=await chromium.launch({channel:'chrome',headless:false});
  for(const [name,width,height,touch] of [['desktop',1280,800,false],['portrait',393,852,true],['small',320,568,true],['landscape',852,393,true]]){
    const context=await browser.newContext({viewport:{width,height},hasTouch:touch,isMobile:touch});
    const page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));page.on('response',r=>{if(r.status()>=400)report.errors.push(`${r.status()} ${r.url()}`);});
    try{
      for(const variant of (name==='desktop'?['before','proposal']:['proposal'])){
        await page.goto(`${server.origin}/${candidate}/fixture.html?variant=${variant}`,{waitUntil:'load'});
        await page.waitForFunction(()=>window.fixtureReady);
        await page.screenshot({path:path.join(evidenceDir,`${name}-${variant}-top.png`)});
        const layout=await page.evaluate(()=>{
          const rect=e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height};};
          const h=document.querySelector('#message-title'),copy=document.querySelector('#message-copy'),range=document.createRange();range.selectNodeContents(h);
          return{title:rect(h),titleText:rect(range),brand:rect(h.closest('.message__panel')),copy:rect(copy),form:rect(copy.parentElement),copyDisplay:getComputedStyle(copy).display};
        });
        const b=page.locator('#play-button');await b.scrollIntoViewIfNeeded();await page.mouse.move(0,0);await page.waitForTimeout(220);
        await b.evaluate(el=>{window.buttonSamples=[];el.addEventListener('pointerenter',()=>{const start=performance.now();const sample=()=>{const c=getComputedStyle(el);window.buttonSamples.push({t:performance.now()-start,color:c.color,backgroundColor:c.backgroundColor,backgroundImage:c.backgroundImage,transition:c.transitionProperty});if(performance.now()-start<260)requestAnimationFrame(sample);};sample();},{once:true});});
        const r=await b.boundingBox();await page.mouse.move(r.x+r.width/2,r.y+r.height/2);await page.waitForTimeout(300);
        const samples=await page.evaluate(()=>window.buttonSamples);
        const state=await b.evaluate(el=>{const c=getComputedStyle(el);return{color:c.color,backgroundColor:c.backgroundColor,disabled:el.disabled,height:el.getBoundingClientRect().height,describedBy:el.getAttribute('aria-describedby')};});
        if(variant==='proposal'){
          check(`${name}: brand title stays inside its column`,layout.titleText.right<=layout.brand.right+.5&&layout.titleText.x>=layout.brand.x-.5);
          check(`${name}: rejection reason visible inside the form`,layout.copyDisplay!=='none'&&layout.copy.width>0&&layout.copy.right<=layout.form.right&&layout.copy.x>=layout.form.x);
          check(`${name}: retry has opaque readable fill throughout hover`,samples.length>2&&samples.every(s=>/^rgb\(/.test(s.backgroundColor)&&contrast(s.color.match(/[\d.]+/g).map(Number),s.backgroundColor.match(/[\d.]+/g).map(Number))>=4.5));
          check(`${name}: existing enabled state and recovery description preserved`,!state.disabled&&state.height>=42&&state.describedBy==='message-copy');
          await page.mouse.move(0,0);await page.locator('#player-name').focus();await page.keyboard.press('Tab');
          check(`${name}: keyboard tab exposes visible retry focus`,await b.evaluate(e=>e===document.activeElement&&getComputedStyle(e).outlineStyle==='solid'));
          await page.keyboard.press('Enter');check(`${name}: fixture button receives one native activation`,await page.evaluate(()=>window.fixtureClicks)===1);
          await page.screenshot({path:path.join(evidenceDir,`${name}-proposal-focus.png`)});
          await page.emulateMedia({reducedMotion:'reduce'});
          check(`${name}: reduced motion removes transitions`,await b.evaluate(e=>getComputedStyle(e).transitionDuration==='0s'));
        }
        report.cases.push({name,variant,width,height,layout,state,samples});
      }
    }finally{await context.close();}
  }
  check('No fixture page/HTTP errors',report.errors.length===0);
  report.sourceChanged=JSON.stringify(baseline)!==JSON.stringify(sourceFingerprint());check('Shared runtime unchanged during fixture capture',!report.sourceChanged);
  report.passed=true;
}catch(error){report.failure=error.stack;process.exitCode=1;}
finally{
  await browser?.close();await server?.stop();
  if(fs.existsSync(path.join(lock,'owner.json'))&&JSON.parse(fs.readFileSync(path.join(lock,'owner.json'))).token===token)fs.rmSync(lock,{recursive:true});
  fs.writeFileSync(path.join(evidenceDir,'spawn-ui-proposal.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({evidenceDir,passed:report.passed,checks:report.checks.length,failure:report.failure,sourceChanged:report.sourceChanged}));
}
