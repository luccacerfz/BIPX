import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
const lock='/tmp/bipx-arpg-gpu.lock',token=crypto.randomUUID();
try{fs.mkdirSync(lock);}catch{console.log('GPU occupied; command was not launched');process.exit(75)}
fs.writeFileSync(path.join(lock,'owner.json'),JSON.stringify({owner:'combat-validation',pid:process.pid,token,created:new Date().toISOString()}));
try{
 const [command,...args]=process.argv.slice(2);if(!command)throw Error('Usage: node tools/arpg-gpu-run.mjs command args...');
 const child=spawn(command,args,{stdio:'inherit',env:process.env});
 process.on('SIGTERM',()=>child.kill('SIGTERM'));
 process.exitCode=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',code=>resolve(code??1))});
}finally{if(JSON.parse(fs.readFileSync(path.join(lock,'owner.json'))).token===token)fs.rmSync(lock,{recursive:true});}
