import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {localServer} from './quality-isolated-server.mjs';
import {connectProtocolClient,protocolMessage,startProtocolRun,closeProtocolClient} from './quality-protocol.mjs';
import {serverDependencyHashes} from './quality-server-source.mjs';
import {evidenceDir} from './quality-browser.mjs';
const report={startedAt:new Date().toISOString(),scope:'Unmodified production server process, isolated HTTP/WS port and disposable ledger. Malformed application messages followed by legitimate startRun commands. No public or private test hook invoked.',serverDependencies:serverDependencyHashes(),checks:[],passed:false};
const clients=[];let server;
try{
  server=await localServer();
  const client=await connectProtocolClient(server.origin.replace(/^http/,'ws')+'/ws?room=malformed&character=warrior',clients);
  const cases=[['null','null'],['array','[]'],['number','42'],['string','"hello"'],['boolean','true'],['missing type','{}'],['null type','{"type":null}'],['numeric type','{"type":12}'],['object type','{"type":{}}'],['broken JSON','{"type":'],['empty text','']];
  for(const [name,payload] of cases){
    client.socket.send(payload);
    const state=await startProtocolRun(client,'warrior');
    assert.equal(state.state,'playing');assert.equal(state.character,'warrior');assert.equal(state.weapon,'katana');
    report.checks.push({name,legitimateStartAcknowledged:true});
  }
  assert.equal(client.socket.readyState,WebSocket.OPEN);
  assert.equal(server.stderr(),'','Malformed message caused a server exception');
  assert.deepEqual(serverDependencyHashes(),report.serverDependencies,'Server dependencies changed during robustness verification');
  report.passed=true;
}catch(error){report.error=error.stack;process.exitCode=1;}
finally{await Promise.allSettled(clients.map(closeProtocolClient));await server?.stop();report.finishedAt=new Date().toISOString();fs.writeFileSync(path.join(evidenceDir,'protocol-robustness.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,checks:report.checks.length,error:report.error,evidenceDirectory:evidenceDir}));}
