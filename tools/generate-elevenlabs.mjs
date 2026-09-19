import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import path from 'node:path';

// The provider credential lives only in the process environment, never in an asset.
const key = process.env.ELEVENLABS_API_KEY;
if (!key) throw new Error('ELEVENLABS_API_KEY is required in the environment');
const output = path.resolve('assets/audio');
const only = process.argv.find(arg => arg.startsWith('--only='))?.split('=')[1];
const regenerate = process.argv.includes('--regenerate');
const arpgOnly = process.argv.includes('--arpg');
const v2Only = process.argv.includes('--v2');
await fs.mkdir(output, { recursive: true });
const cues = [
  ['pistol', .7, false, 'One isolated heavy fantasy flintlock pistol shot. Immediate sharp mechanical crack and deep tight punch, tiny metallic action, very short outdoor decay. Dry close sound, no voices, no music, no silence at the start.'],
  ['katana', 1.2, false, 'One powerful clearly audible heavy katana sword swing passing very close. Strong wide rushing air whoosh and ringing metal with a tight low body. Start immediately at full strength, decay within half a second. Punchy dry fantasy combat sound. No impact, no voices, no music.'],
  ['hit', .55, false, 'A single close visceral sword impact on a fantasy undead enemy with a tight blunt body thump, dry cloth and subtle bone crack. Clear immediate transient, short decay. No screams, no voices, no music.'],
  ['flamethrower', 2, false, 'A short burst of a fantasy flamethrower igniting. Forceful airy rushing flame, sizzling embers, deep restrained ignition punch. Close dry game sound, immediate attack, no voices, no music.'],
  ['thunderstaff', 1.1, false, 'One powerful magical lightning bolt discharge. Crisp electrical snap, layered crackling arc, short punchy thunder body and quick tail. Immediate attack, cinematic action game, no voices, no music.'],
  ['frostNova', 1.5, false, 'One circular frost magic explosion. Sharp glassy ice crystals crack outward with a deep cold airy rush, sparkling frozen fragments and a short beautiful icy tail. Immediate attack, no voices, no music.'],
  ['talisman', 1.2, false, 'One dark arcane spell cast, a rising reversed spectral breath into a focused low magical pulse and fine ringing particles. Elegant sinister fantasy action game effect, immediate start, no voices, no music.'],
  ['explosion', 1.3, false, 'One compact magical bone cannon explosion. Deep punchy impact, crunchy stone debris, dust and short outdoor reverb. Tight cinematic game effect with immediate attack, no voices, no music.'],
  ['kill', .9, false, 'One undead creature dissolving into ash. Dry bone snap with a low spectral exhale and soft crumbling dust, short close sound. No speech, no screaming, no music, immediate attack.'],
  ['bossSpawn', 2.6, false, 'An ancient crypt gate opening as a huge undead boss awakens. Deep threatening stone grinding and a single resonant low supernatural horn swell, restrained sub bass, clear ending. No speech, no music.'],
  ['levelUp', 1.5, false, 'A single rewarding fantasy level up sound, ascending warm crystalline chimes resolving into a rich luminous resonant chord with a short sparkling tail. Elegant and powerful, no speech, not a melody, immediate attack.'],
  ['uiSelect', .5, false, 'One elegant fantasy game interface confirmation click. Tactile muted metal tick with a tiny warm glass chime, crisp immediate attack and very short soft tail. No speech, no music.'],
  ['nightAmbience', 12, true, 'Seamless quiet haunted cemetery ambience at night. Low soft wind through bare trees, distant restrained raven calls, rustling dry leaves, subtle spacious eerie air. Calm and sparse to sit under combat. No music, no voices, no sudden loud sounds.'],
  ['skillFlameCleave', .8, false, 'One heavy broad steel sword cleave wrapped in fire. Immediate strong close low air swish, bright brief ember flare and tiny metallic blade ring. A single muscular sweeping gesture, dry and punchy with short ending, not an explosion. Fantasy action game. No speech, no music, no silence before attack.'],
  ['skillFrostCharge', .7, false, 'One brief frost spell gathering in a gauntlet. Immediate fine brittle ice ticking, inward cold breath and compact resonant crystalline tension, ending quickly. Delicate high icy texture above a restrained low cold body. Dry close fantasy game preparation cue, no blast, no speech, no music.'],
  ['skillThunderCharge', .7, false, 'One short lightning spell charge in a heavy steel sword. Immediate restrained low electric buzz climbing into a sharp metallic static snap. Tight muscular dry fantasy game windup, distinctly electric, short clean tail, no thunder explosion, no voices, no music.'],
  ['skillIncendiaryShot', .75, false, 'One single heavy dwarven black powder rifle firing an incendiary round. Immediate dry mechanical hammer click and explosive low barrel crack followed by a very short airy fire rush. Strong weight, restrained sub bass, outdoor short decay. No repeated shots, no speech, no music.'],
  ['skillCryoThrow', .6, false, 'One compact metal grenade being primed and thrown by an armored hand. Immediate tactile metal pin click followed by a short rising airy swish with tiny brittle icy crystal rattle. Dry close fantasy action game, short clean ending. No explosion, no voices, no music.'],
  ['skillArcaneShot', .8, false, 'One dwarven enchanted rifle firing a focused violet arcane bolt. Immediate metallic action click with a tight low energy punch, hollow resonant magical zap and a short smooth tonal shimmer. Distinct from crackling lightning and glassy ice, dry close game effect. No laser science fiction beeps, no voices, no music.'],
  ['skillReady', .5, false, 'One clearly audible fantasy ability ready notification, recorded close at a strong healthy level. A single warm rounded glass tick blooming into a clean luminous chime, short clean decay. Distinct immediate attack, restrained high frequencies, no silence at start, no melody, no repeated notes, no speech, no music.'],
  ['skillResourceFail', .5, false, 'One short restrained fantasy game ability unavailable notification. Two very close muted hollow wooden and metal taps descending slightly in pitch, compact dry dull texture. Gentle low midrange, no harsh buzzer, no voice, no music, immediate start and quick ending.'],
  ['skillWarCry', .9, false, 'One powerful human male warrior nonverbal battle shout, a forceful chesty HAA! Single vocal burst with breath and deep natural body, fierce heroic resolve, dry close perspective, immediate attack and short ending. No words, no choir, no crowd, no music, no monster growl.'],
  ['skillWarBuff', 3, true, 'Seamless fantasy warrior empowerment aura sound loop. Low warm resonant air and faint metallic overtones gently flowing with restrained energy. Smooth continuous texture, no discrete impacts, no rhythmic beat, no rising crescendo, no voices, no music, no silence. Clean healthy recording level, volume will be mixed down in a game.'],
  ['skillShieldRush', .9, false, 'A single heavy armored warrior rushing forward with a raised steel shield. Immediate forceful rushing air with close low chainmail and metal armor movement, brief gritty foot push, compact accelerating gesture, clean short end. No shield impact yet, no footsteps loop, no voices, no music.'],
  ['skillShieldImpact', .65, false, 'One massive steel shield slamming into an armored opponent. Immediate solid deep body thud and dry broad low metallic clang, brief gritty rattle then a tight clean decay. Powerful heavy physical fantasy combat hit, no explosion, no voice, no music, no silence at start.'],
  ['skillCannonBlast', 1, false, 'One dwarven heavy hand cannon firing a huge flaming shell. Immediate deep punchy black powder blast, broad fiery roar rushing from the barrel, bright embers and very brief mechanical recoil rattle. Single shot, weighty outdoor dry sound with short tail and restrained sub bass. No voices, no music, no repeated gunfire.'],
  ['skillGravityLoop', 3, true, 'Seamless looping fantasy gravitational vortex sound. Continuous low hollow inward suction with swirling airy pressure and subtle smooth violet arcane resonance. Clearly inward flowing texture with no crackles, no pulsing beat, no separate impacts, no crescendo, no ending. No voices, no music. Clean healthy recorded level for game mixing.'],
  ['skillGravityCollapse', .8, false, 'One dark gravitational energy core collapsing inward. Immediate brief hollow vacuum gulp contracting into a tight low resonant pop, fine airy debris drawn in, rapidly fading tonal tail. Focused short dry magical implosion, not an outward explosion, no voices, no music, no silence before attack.'],
];
const v2Cues = new Set(['skillWarCry', 'skillWarBuff', 'skillShieldRush', 'skillShieldImpact', 'skillCannonBlast', 'skillGravityLoop', 'skillGravityCollapse']);
const selection = only ? new Set(only.split(',')) : null;
if (selection && [...selection].some(id => !cues.some(cue => cue[0] === id))) throw new Error('Unknown --only cue ID');
let manifest;
try { manifest = JSON.parse(await fs.readFile(path.join(output, 'manifest.json'), 'utf8')); }
catch { manifest = { provider: 'ElevenLabs', model: 'eleven_text_to_sound_v2', format: 'mp3_44100_128', source: 'https://elevenlabs.io/docs/api-reference/text-to-sound-effects/convert', cues: {} }; }

for (const [id, duration, loop, text] of cues) {
  if (selection && !selection.has(id)) continue;
  if (arpgOnly && !id.startsWith('skill')) continue;
  if (v2Only && !v2Cues.has(id)) continue;
  const file = v2Cues.has(id) ? `arpg-v2/${id}.mp3` : id.startsWith('skill') ? `arpg/${id}.mp3` : `${id}.mp3`;
  const target = path.join(output, file);
  await fs.mkdir(path.dirname(target), { recursive: true });
  if (!regenerate && manifest.cues[id] && await fs.stat(target).then(s => s.size > 1000).catch(() => false)) {
    const existingHash = crypto.createHash('sha256').update(await fs.readFile(target)).digest('hex');
    if (existingHash !== manifest.cues[id].sha256) throw new Error(`${id}: existing source hash mismatch`);
    console.log(JSON.stringify({ id, status: 'existing' })); continue;
  }
  const response = await fetch('https://api.elevenlabs.io/v1/sound-generation?output_format=mp3_44100_128', {
    method: 'POST', headers: { 'xi-api-key': key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, duration_seconds: duration, loop, prompt_influence: .45, model_id: manifest.model }),
    signal: AbortSignal.timeout(180000),
  });
  if (!response.ok) {
    let detail = 'provider_request_failed';
    try { const data = await response.json(); detail = data.detail?.status || data.detail?.code || detail; } catch {}
    throw new Error(`ElevenLabs ${response.status}: ${detail} (${id})`);
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length < 1000 || !/audio|octet-stream/.test(response.headers.get('content-type') || '')) {
    throw new Error(`Invalid audio response for ${id}`);
  }
  if (regenerate && await fs.stat(target).then(() => true).catch(() => false)) {
    const history = path.join(output, 'source-history'); await fs.mkdir(history, { recursive: true });
    const prefix = `${id}-${Date.now()}`;
    await fs.copyFile(target, path.join(history, `${prefix}.mp3`));
    if (manifest.cues[id]) await fs.writeFile(path.join(history, `${prefix}.json`), JSON.stringify(manifest.cues[id], null, 2));
  }
  await fs.writeFile(target, bytes);
  manifest.cues[id] = { file, prompt: text, requestedDurationSeconds: duration, loop,
    model: manifest.model, outputFormat: 'mp3_44100_128', promptInfluence: .45,
    requestId: response.headers.get('request-id'), characterCost: response.headers.get('character-cost'), httpStatus: response.status,
    generatedAt: new Date().toISOString(), bytes: bytes.length, sha256: crypto.createHash('sha256').update(bytes).digest('hex') };
  await fs.writeFile(path.join(output, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  console.log(JSON.stringify({ id, status: 'generated', bytes: bytes.length }));
}
