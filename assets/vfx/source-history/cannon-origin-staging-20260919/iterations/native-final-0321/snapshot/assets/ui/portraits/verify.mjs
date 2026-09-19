import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const out='output/playwright/character-portraits';await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome',args:['--use-gl=angle','--use-angle=metal']});
const results=[];
try{
 for(const [width,height] of [[390,844],[874,402]]){
  const context=await browser.newContext({viewport:{width,height},isMobile:true,hasTouch:true,deviceScaleFactor:1});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(String(e)));
  await page.goto('http://localhost:5173/?offline=1');await page.waitForFunction(()=>window.__bipxCharacters&&!window.__bipxCharacters.getState().loading);await page.locator('#open-login-button').click();await page.locator('#character-dwarf').waitFor();await page.waitForFunction(()=>!document.querySelector('#character-picker').disabled);
  await page.locator('label[for="character-dwarf"]').click();await page.waitForFunction(()=>window.__bipxCharacters.getState().selected==='dwarf'&&!window.__bipxCharacters.getState().loading);await page.evaluate(()=>document.fonts.ready);
  const layout=await page.evaluate(()=>{
   const ids=['character-warrior','character-dwarf','player-name','play-button','multiplayer-button'];
   return{overflow:document.documentElement.scrollWidth>innerWidth,images:[...document.querySelectorAll('.character-option__portrait img')].map(i=>({width:i.naturalWidth,height:i.naturalHeight,complete:i.complete})),rects:Object.fromEntries(ids.map(id=>{const e=document.getElementById(id),r=e.getBoundingClientRect();return[id,{left:r.left,right:r.right,top:r.top,bottom:r.bottom,visible:r.width>0&&r.height>0}]})),state:window.__bipxCharacters.getState(),panelHeight:document.querySelector('.main-menu__login').getBoundingClientRect().height};
  });
  await page.screenshot({path:`${out}/${width}x${height}.png`});
  await page.locator('#character-dwarf').focus();await page.keyboard.press('ArrowLeft');await page.waitForFunction(()=>window.__bipxCharacters.getState().selected==='warrior'&&!window.__bipxCharacters.getState().loading);
  const keyboardSelection=await page.locator('#character-warrior').isChecked();
  results.push({width,height,layout,keyboardSelection,errors});await fs.writeFile(`${out}/verification.json`,JSON.stringify({results},null,2));
  assert.equal(errors.length,0,errors.join('\n'));assert(!layout.overflow);assert(layout.images.every(i=>i.complete&&i.width===384&&i.height===300));assert(Object.values(layout.rects).every(r=>r.visible&&r.left>=0&&r.right<=width+.5&&r.top>=0&&r.bottom<=height+.5),`Controls offscreen ${JSON.stringify(layout.rects)}`);assert(keyboardSelection);
  await context.close();
 }
 const sourceHashes=Object.fromEntries(await Promise.all(['index.html','styles.css','assets/ui/portraits/aldric.png','assets/ui/portraits/lyra.png'].map(async p=>[p,createHash('sha256').update(await fs.readFile(p)).digest('hex')])));await fs.writeFile(`${out}/verification.json`,JSON.stringify({passed:true,results,sourceHashes},null,2));console.log(JSON.stringify({passed:true,results}));
}finally{await browser.close()}
