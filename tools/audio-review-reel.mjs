import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const destination = path.resolve(process.argv[2] || 'output/playwright/audio-listening-review');
fs.mkdirSync(destination, { recursive: true });
const manifest = JSON.parse(fs.readFileSync('assets/audio/processed/manifest.json', 'utf8'));
const rate = 44100, channels = 2;
const framesPerSecond = rate * channels * 4;
const chunks = [], timeline = [];
let bytes = 0;
for (const [id, cue] of Object.entries(manifest.cues)) {
  const result = spawnSync('ffmpeg', ['-v', 'error', '-i', `assets/audio/processed/${cue.file}`, '-ar', `${rate}`, '-ac', `${channels}`, '-f', 'f32le', 'pipe:1'], { maxBuffer: 32 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(result.stderr.toString());
  const repeat = cue.loop ? 2 : 1;
  timeline.push({ id, startSeconds: bytes / framesPerSecond, durationSeconds: result.stdout.length * repeat / framesPerSecond,
    kind: cue.loop ? 'two consecutive decoded loop cycles' : 'isolated normalized derivative', sourceSha256: cue.sha256 });
  for (let cycle = 0; cycle < repeat; cycle++) { chunks.push(result.stdout); bytes += result.stdout.length; }
  const silence = Buffer.alloc(Math.round(framesPerSecond * .45)); chunks.push(silence); bytes += silence.length;
}
const wav = path.join(destination, 'processed-cue-audition.wav');
const result = spawnSync('ffmpeg', ['-v', 'error', '-y', '-f', 'f32le', '-ar', `${rate}`, '-ac', `${channels}`, '-i', 'pipe:0', '-c:a', 'pcm_s24le', wav], { input: Buffer.concat(chunks), maxBuffer: 1024 * 1024 });
if (result.status !== 0) throw new Error(result.stderr.toString());
fs.writeFileSync(path.join(destination, 'timeline.json'), `${JSON.stringify({ kind: 'isolated asset listening reel; not gameplay', durationSeconds: bytes / framesPerSecond, source: 'assets/audio/processed/manifest.json', timeline }, null, 2)}\n`);
const rows = timeline.map(cue => `<tr><td>${cue.startSeconds.toFixed(2)} s</td><td>${cue.id}</td><td>${cue.durationSeconds.toFixed(2)} s</td><td>${cue.kind}</td></tr>`).join('');
fs.writeFileSync(path.join(destination, 'index.html'), `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>BIPX · Revisão sonora</title><style>body{max-width:900px;margin:48px auto;padding:0 24px;background:#101718;color:#e8eddf;font:17px/1.6 system-ui}h1{color:#dcc191}audio{width:100%;margin:24px 0}table{border-collapse:collapse;width:100%}td,th{padding:9px;text-align:left;border-bottom:1px solid #344343}small{color:#b7c0ba}</style><h1>Revisão sonora · BIPX</h1><p>${timeline.length} efeitos gerados e processados. A faixa apresenta cada arquivo isoladamente, seguida de dois ciclos da ambiência. Esta faixa não é uma captura de gameplay.</p><audio controls src="processed-cue-audition.wav"></audio><p><strong>Escuta perceptiva pendente.</strong> Avaliar ataque, timbre, distinção, caudas, fechamento do loop e conforto; a mixagem durante combate deve ser julgada na captura do jogo.</p><table><thead><tr><th>Início</th><th>Efeito</th><th>Duração</th><th>Conteúdo</th></tr></thead><tbody>${rows}</tbody></table><p><small>Originais ElevenLabs preservados. Arquivos derivados e hashes: assets/audio/processed/manifest.json.</small></p></html>\n`);
console.log(JSON.stringify({ ok: true, wav, durationSeconds: bytes / framesPerSecond, cues: timeline.length }));
