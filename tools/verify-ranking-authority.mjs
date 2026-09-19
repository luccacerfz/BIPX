import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {localServer} from './quality-isolated-server.mjs';
import {evidenceDir} from './quality-browser.mjs';
import {serverDependencyHashes} from './quality-server-source.mjs';
const report={startedAt:new Date().toISOString(),scope:'HTTP requests only to a fresh isolated server with disposable ledger; fabricated input is an explicit rejection fixture, not a gameplay score.',sourceHashes:serverDependencyHashes(),checks:[],passed:false};
let server;
try {
  server=await localServer();
  const snapshot=async()=>{const response=await fetch(server.origin+'/api/leaderboard');assert.equal(response.status,200);return response.json();};
  const before=await snapshot();
  const forged={id:'fixture-replay',name:'RejectedFixture',score:123456,kills:654,wave:99,level:999,durationMs:1000,state:'playing',health:600,maxHealth:600};
  for(const endpoint of ['/api/leaderboard/session','/api/leaderboard/live']) {
    for(let repeat=0;repeat<2;repeat++) {
      const response=await fetch(server.origin+endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(forged)});
      assert.ok([403,404,405,410].includes(response.status),`${endpoint} accepted untrusted client score (${response.status})`);
      report.checks.push({endpoint,repeat,status:response.status});
    }
  }
  const after=await snapshot();
  assert.ok(!JSON.stringify(after).includes('RejectedFixture'),'Rejected submission reached shared ranking');
  for(const key of ['players','sessions','recentSessions','entries','leaderboard']) if(key in before) assert.deepEqual(after[key],before[key],`Shared ${key} changed after rejected score submission`);
  assert.equal(server.stderr(),'');
  report.sourceChangedDuringRun=JSON.stringify(report.sourceHashes)!==JSON.stringify(serverDependencyHashes());
  assert.equal(report.sourceChangedDuringRun,false);
  report.passed=true;
} catch(error){report.error=error.stack;process.exitCode=1;}
finally {await server?.stop();report.finishedAt=new Date().toISOString();fs.writeFileSync(path.join(evidenceDir,'ranking-authority.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,evidenceDirectory:evidenceDir,error:report.error}));}
