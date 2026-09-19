import { parentPort } from 'node:worker_threads';
import { prepareDeathCut } from './death-cut-preparation.js';

const transferables = result => [result.surface.capVertices.buffer];
const topologies = new Map();
parentPort.on('message', ({ jobId, payload, type, topology }) => {
  if (type === 'register') { topologies.set(topology.key, topology); parentPort.postMessage({ registerId: jobId, ok: true }); return; }
  try { const expanded = { ...payload, meshes: payload.meshes.map(mesh => ({ ...topologies.get(mesh.topologyKey), ...mesh })) }; const result = prepareDeathCut(expanded); parentPort.postMessage({ jobId, ok: true, result }, transferables(result)); }
  catch (error) { parentPort.postMessage({ jobId, ok: false, error: String(error?.stack || error) }); }
});
