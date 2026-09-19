import { Worker } from 'node:worker_threads';
import { fileURLToPath } from 'node:url';

let nextJobId = 1;
const workerEntry = fileURLToPath(new URL('./death-cut-worker-node.mjs', import.meta.url));

export function createDeathCutNodeWorker({ maxPending = 4 } = {}) {
  const worker = new Worker(workerEntry, { type: 'module' }), pending = new Map(), registrations = new Map(), registered = new Set();
  worker.on('message', message => {
    if (message.registerId) { const item = registrations.get(message.registerId); if (item) { registrations.delete(message.registerId); if (message.ok) registered.add(item.key); message.ok ? item.resolve() : item.reject(new Error(message.error)); } return; }
    const item = pending.get(message.jobId); if (!item) return;
    pending.delete(message.jobId); message.ok ? item.resolve(message.result) : item.reject(new Error(message.error));
  });
  worker.on('error', error => { for (const item of pending.values()) item.reject(error); pending.clear(); for (const item of registrations.values()) item.reject(error); registrations.clear(); });
  const registerTopology = topology => {
    if (registered.has(topology.key)) return Promise.resolve();
    for (const item of registrations.values()) if (item.key === topology.key) return item.promise;
    const registerId = `topology-${nextJobId++}`, copy = { ...topology, positions: new Float32Array(topology.positions), faceIndices: new Uint32Array(topology.faceIndices), materialIndex: new Uint16Array(topology.materialIndex), influence: topology.influence ? new Float32Array(topology.influence) : null, skinIndices: topology.skinIndices ? new Uint16Array(topology.skinIndices) : null, skinWeights: topology.skinWeights ? new Float32Array(topology.skinWeights) : null, bindMatrix: topology.bindMatrix ? new Float32Array(topology.bindMatrix) : null };
    const transfer = [copy.positions.buffer, copy.faceIndices.buffer, copy.materialIndex.buffer, copy.influence?.buffer, copy.skinIndices?.buffer, copy.skinWeights?.buffer, copy.bindMatrix?.buffer].filter(Boolean);
    let resolve, reject; const promise = new Promise((ok, fail) => { resolve = ok; reject = fail; }); registrations.set(registerId, { key: topology.key, promise, resolve, reject });
    try { worker.postMessage({ type: 'register', jobId: registerId, topology: copy }, transfer); } catch (error) { registrations.delete(registerId); reject(error); }
    return promise;
  };
  const submit = (payload, transfer = []) => {
    if (pending.size >= maxPending) return Promise.reject(new Error('death-cut worker queue full'));
    const jobId = nextJobId++;
    return new Promise((resolve, reject) => {
      pending.set(jobId, { resolve, reject });
      try { worker.postMessage({ jobId, payload }, transfer); }
      catch (error) { pending.delete(jobId); reject(error); }
    });
  };
  return { submit, registerTopology, pending: () => pending.size, cancelAll({ terminate = true } = {}) { for (const item of pending.values()) item.reject(new Error('worker cancelled')); pending.clear(); for (const item of registrations.values()) item.reject(new Error('worker cancelled')); registrations.clear(); return terminate ? worker.terminate() : undefined; } };
}
