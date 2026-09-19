import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const base = new URL(process.argv[2] || "http://127.0.0.1:5173/");
if (base.protocol !== "http:" || !["127.0.0.1", "localhost", "[::1]"].includes(base.hostname)) {
  throw new Error("HTTP security verification runs only against an isolated localhost server");
}
const scenarios = [
  { path: "/", status: [200], contentType: "text/html" },
  { path: "/src/main.js", status: [200], contentType: "javascript" },
  { path: "/assets/ui/arpg/icons.svg", status: [200], contentType: "image/svg+xml" },
  { path: "/styles.css", status: [200], contentType: "text/css" },
  { path: "/assets/models/aldric-hero.glb", status: [200], contentType: "model/gltf-binary", completeBody: true },
  { path: "/assets/models/aldric-hero.glb", method: "HEAD", status: [200], contentType: "model/gltf-binary", headOnly: true },
  ...["/.env", "/.env.local", "/.git/config", "/.data/leaderboard.json", "/server.mjs", "/package.json", "/package-lock.json", "/tools/verify-canvas.mjs", "/docs/quality-gates.md", "/output/playwright/jev-pending.json", "/%2eenv", "/assets/%2e%2e/.env", "/src/../.env"].map((value) => ({ path: value, status: [403, 404] })),
  { path: "/%ZZ", status: [400] },
  { path: "/%00", status: [400, 403, 404] },
  { path: "/", method: "POST", status: [405] },
  { path: "/", method: "HEAD", status: [200], contentType: "text/html" },
];
const results = [];
for (const scenario of scenarios) {
  const result = await probe(scenario);
  result.passed = scenario.status.includes(result.status) && (!scenario.contentType || result.contentType.includes(scenario.contentType)) && (!scenario.completeBody || (result.declaredBytes > 0 && result.receivedBytes === result.declaredBytes)) && (!scenario.headOnly || (result.declaredBytes > 0 && result.receivedBytes === 0));
  results.push(result);
}
const report = { checkedAt: new Date().toISOString(), target: base.origin, ok: results.every((result) => result.passed), bodyPolicy: "Response bodies are discarded and never printed or persisted", results };
const directory = process.env.BIPX_EVIDENCE_DIR || `output/playwright/${new Date().toISOString().replace(/[:.]/g, "-")}-verify-http`;
fs.mkdirSync(directory, { recursive: true });
fs.writeFileSync(path.join(directory, "http.json"), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
if (!report.ok) process.exitCode = 1;

function probe(scenario) {
  return new Promise((resolve, reject) => {
    const request = http.request({ hostname: base.hostname, port: base.port, path: scenario.path, method: scenario.method || "GET", timeout: 5000 }, (response) => {
      const result = { path: scenario.path, method: scenario.method || "GET", status: response.statusCode, contentType: response.headers["content-type"] || "", declaredBytes: Number(response.headers["content-length"]) || null, receivedBytes: 0 };
      response.on("data", bytes => { result.receivedBytes += bytes.length; });
      response.resume();
      response.on("end", () => resolve(result));
      response.on("error", reject);
    });
    request.on("error", reject);
    request.on("timeout", () => request.destroy(new Error("HTTP probe timed out")));
    request.end();
  });
}
