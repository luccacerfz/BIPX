import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright';
const output=path.resolve(process.env.HERO_NATIVE_OUTPUT || 'output/playwright/hero-locomotion-first-native');await fs.mkdir(output,{recursive:true});
const files=['src/assets/hero-locomotion.js','src/assets/character-library.js','src/assets/dwarf-library.js','src/assets/warrior-locomotion-clips.json','src/assets/dwarf-locomotion-clips.json','src/assets/hero-foot-probes.js'];
const hashes=async()=>Object.fromEntries(await Promise.all(files.map(async f=>[f,createHash('sha256').update(await fs.readFile(f)).digest('hex')])));
const before=await hashes(),report={scope:'Native Chrome Metal isolated asset fixture, not gameplay. Records current CPU-candidate before true sole correction.',before,errors:[],captures:[]};
const browser=await chromium.launch({headless:true,channel:'chrome',args:['--use-gl=angle','--use-angle=metal']});
try{
 for(const character of ['warrior','dwarf'])for(const version of (process.env.HERO_NATIVE_AFTER_ONLY ? ['after'] : ['before','after'])){
  const context=await browser.newContext({viewport:{width:1200,height:900},recordVideo:{dir:output,size:{width:1200,height:900}}});const page=await context.newPage();page.on('pageerror',e=>report.errors.push(String(e)));await page.goto('http://127.0.0.1:5278/tools/hero-locomotion-preview.html');await page.waitForFunction(()=>window.heroFixture?.ready);await page.evaluate(options=>window.heroFixture.configure(options),{character,version,speed:6.5,playback:.25});
  for(const [name,direction,view,attack]of [['forward',0,'side',false],['strafe',90,'front',false],['backward',180,'side',true]]){
   await page.evaluate(options=>window.heroFixture.configure(options),{direction,view,attack});await page.waitForTimeout(Number(process.env.HERO_NATIVE_PHASE_MS) || 1700);const file=`${character}-${version}-${name}.png`;await page.screenshot({path:path.join(output,file)});report.captures.push({file,snapshot:await page.evaluate(()=>window.heroFixture.snapshot())});
  }
  const video=page.video();await context.close();await video.saveAs(path.join(output,`${character}-${version}.webm`));
 }
}finally{await browser.close();}
report.after=await hashes();report.sourceStable=JSON.stringify(before)===JSON.stringify(report.after);await fs.writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({output,errors:report.errors,sourceStable:report.sourceStable,captures:report.captures.length}));
