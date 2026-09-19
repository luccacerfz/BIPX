import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {sanitizedChildEnv} from './lib/child-env.mjs';
export async function localServer() {
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'bipx-entry-ledger-'));
  // Never forward secrets (TYPESAFE_API_KEY, any *_KEY/*_SECRET/*_TOKEN, Supabase) to the child server.
  const child=spawn(process.execPath,['server.mjs'],{cwd:process.cwd(),env:sanitizedChildEnv({HOST:'127.0.0.1',PORT:'0',LEADERBOARD_FILE:path.join(directory,'leaderboard.json')}),stdio:['ignore','pipe','pipe']});
  let stderr='';child.stderr.on('data',data=>stderr+=data);
  const closed=new Promise(resolve=>child.once('close',resolve));
  const stop=async()=>{child.kill('SIGTERM');await Promise.race([closed,new Promise(resolve=>setTimeout(resolve,1000))]);if(child.exitCode===null&&!child.signalCode)child.kill('SIGKILL');fs.rmSync(directory,{recursive:true,force:true});};
  try {
    const port=await new Promise((resolve,reject)=>{let output='';const timer=setTimeout(()=>reject(Error('Isolated server startup timeout')),8000);child.stdout.on('data',data=>{output+=data;const match=output.match(/http:\/\/127\.0\.0\.1:(\d+)/);if(match){clearTimeout(timer);resolve(match[1]);}});child.once('error',error=>{clearTimeout(timer);reject(error)});child.once('exit',code=>{clearTimeout(timer);reject(Error(`Server startup exit ${code}`))});});
    return {origin:`http://127.0.0.1:${port}`,stderr:()=>stderr,stop};
  } catch(error){await stop();throw error}
}
