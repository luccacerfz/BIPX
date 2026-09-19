import { prepareDeathCut } from './death-cut-preparation.js';

const topologies = new Map();
globalThis.onmessage = event => {
  const { jobId, payload, type, topology } = event.data;
  if (type === 'register') { topologies.set(topology.key, topology); globalThis.postMessage({ registerId: jobId, ok: true }); return; }
  try {
    const expanded = { ...payload, meshes: payload.meshes.map(mesh => ({ ...topologies.get(mesh.topologyKey), ...mesh })) };
    const result = prepareDeathCut(expanded);
    const transfers = [result.surface.capVertices.buffer];
    globalThis.postMessage({ jobId, ok: true, result }, transfers);
  } catch (error) {
    globalThis.postMessage({ jobId, ok: false, error: String(error?.stack || error) });
  }
};
