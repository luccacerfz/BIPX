import { GLTFLoader } from './vendor/GLTFLoader.js';

// These local assets are consumed as complete binary files. Reading the response
// directly avoids FileLoader's extra progress stream and its Chrome cancellation
// diagnostic while retaining explicit network and binary-integrity failures.
export async function loadGlb(url) {
  const absolute = new URL(url, import.meta.url);
  const response = await fetch(absolute.href);
  if (!response.ok) throw new Error(`GLB request failed (${response.status}): ${absolute.pathname}`);
  const bytes = await response.arrayBuffer();
  const contentLength = Number(response.headers.get('Content-Length'));
  if (!response.headers.get('Content-Encoding') && contentLength > 0 && bytes.byteLength !== contentLength) {
    throw new Error(`Incomplete GLB response: ${absolute.pathname}`);
  }
  if (bytes.byteLength < 12) throw new Error(`Empty GLB: ${absolute.pathname}`);
  const header = new DataView(bytes);
  if (header.getUint32(0, true) !== 0x46546c67 || header.getUint32(4, true) !== 2 || header.getUint32(8, true) !== bytes.byteLength) {
    throw new Error(`Invalid GLB header or length: ${absolute.pathname}`);
  }
  return new GLTFLoader().parseAsync(bytes, new URL('.', absolute).href);
}
