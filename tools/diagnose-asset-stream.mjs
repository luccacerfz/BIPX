import { suiteUrl } from './quality-target.mjs';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { chromium, browserLaunchOptions, evidenceDir } from './quality-browser.mjs';

const report = { kind: 'diagnostic_fixture_not_acceptance', scope: 'Controlled Three FileLoader array-buffer downloads without WebGL. The direct-response variant is intercepted only inside this isolated test context and does not modify production files.', cases: [] };
const browser = await chromium.launch(browserLaunchOptions);
try {
  for (const direct of [false, true]) {
    const context = await browser.newContext();
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    const requests = new Map();
    cdp.on('Network.requestWillBeSent', data => { if (data.request.url.includes('.glb')) requests.set(data.requestId, { url: data.request.url, initiator: data.initiator.type, dataBytes: 0 }); });
    cdp.on('Network.responseReceived', data => { const request = requests.get(data.requestId); if (request) request.response = { status: data.response.status, mimeType: data.response.mimeType, headers: data.response.headers }; });
    cdp.on('Network.dataReceived', data => { const request = requests.get(data.requestId); if (request) request.dataBytes += data.dataLength; });
    cdp.on('Network.loadingFailed', data => { const request = requests.get(data.requestId); if (request) request.failure = data; });
    cdp.on('Network.loadingFinished', data => { const request = requests.get(data.requestId); if (request) request.finished = data; });
    await cdp.send('Network.enable');
    await page.route('**/quality-stream-diagnostic', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><link rel="icon" href="data:,">Asset stream diagnostic; no renderer.' }));
    if (direct) {
      const original = fs.readFileSync('vendor/three/three.module.js', 'utf8');
      const patched = original.replace('// Workaround: Checking if response.body === undefined', "if ( responseType === 'arraybuffer' ) return response;\n\n\t\t\t\t\t// Workaround: Checking if response.body === undefined");
      if (original === patched) throw new Error('Diagnostic patch point missing');
      await page.route('**/vendor/three/three.module.js', route => route.fulfill({ contentType: 'application/javascript', body: patched }));
    }
    await page.goto(await suiteUrl('/quality-stream-diagnostic'));
    const downloads = await page.evaluate(async () => {
      const { FileLoader } = await import('/vendor/three/three.module.js');
      const results = [];
      for (let index = 0; index < 10; index++) {
        const name = index % 2 ? 'orc-peon' : 'aldric-hero';
        const url = `/assets/models/${name}.glb?diagnostic=${index}`;
        try {
          const data = await new FileLoader().setResponseType('arraybuffer').loadAsync(url);
          const digest = [...new Uint8Array(await crypto.subtle.digest('SHA-256', data))].map(value => value.toString(16).padStart(2, '0')).join('');
          results.push({ name, url, bytes: data.byteLength, sha256: digest, resolved: true });
        } catch (error) { results.push({ name, url, resolved: false, error: error.message }); }
      }
      return results;
    });
    await page.waitForTimeout(100);
    for (const result of downloads) {
      const bytes = fs.readFileSync(`assets/models/${result.name}.glb`);
      result.expectedBytes = bytes.length;
      result.expectedSha256 = crypto.createHash('sha256').update(bytes).digest('hex');
      result.exactFile = result.bytes === result.expectedBytes && result.sha256 === result.expectedSha256;
    }
    report.cases.push({ variant: direct ? 'diagnostic_direct_response_no_progress_wrapper' : 'unmodified_production_stream_wrapper', downloads, requests: [...requests.values()] });
    await context.close();
  }
} finally {
  await browser.close();
  fs.writeFileSync(path.join(evidenceDir, 'asset-stream-diagnostic.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ evidenceDirectory: evidenceDir, cases: report.cases.map(item => ({ variant: item.variant, exactFiles: item.downloads.filter(item => item.exactFile).length, failedRequests: item.requests.filter(item => item.failure).length, total: item.downloads.length })) }));
}
