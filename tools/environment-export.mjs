import fs from 'node:fs';
import { spawn } from 'node:child_process';
const lock='/tmp/bipx-arpg-gpu.lock';
fs.mkdirSync(lock);
fs.writeFileSync(`${lock}/owner.json`,JSON.stringify({owner:'environment-export',pid:process.pid,startedAt:new Date().toISOString()}));
try {
 const child=spawn('/Applications/Blender.app/Contents/MacOS/Blender',['--background','--threads','3','--python','tools/environment-export.py'],{stdio:'inherit'});
 const code=await new Promise((resolve,reject)=>{child.once('exit',resolve);child.once('error',reject)});
 if(code!==0)process.exitCode=code||1;
} finally {
 if(JSON.parse(fs.readFileSync(`${lock}/owner.json`)).pid===process.pid)fs.rmSync(lock,{recursive:true});
}
