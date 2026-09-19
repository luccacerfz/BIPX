import { SKILL_SOUND_PROFILES } from './skill-sounds.js';

const MAX_VOICES = 16;
const aliases = {
  axe: 'katana', autoBlade: 'katana', crossbow: 'katana', boneCannon: 'explosion', sealRain: 'talisman',
  orbitOrb: 'talisman', weaponPickup: 'levelUp', perkPickup: 'levelUp', gameStart: 'levelUp', playerDamage: 'hit',
};
// Gain is applied to level-matched derivatives, keeping impacts below spell/weapon transients.
const profiles = {
  pistol: { gain: .38, cooldown: .06, limit: 3 },
  katana: { gain: .38, cooldown: .08, limit: 3 },
  hit: { gain: .25, cooldown: .09, limit: 2 },
  kill: { gain: .23, cooldown: .1, limit: 2 },
  flamethrower: { gain: .29, cooldown: .26, limit: 1, duration: .38 },
  thunderstaff: { gain: .42, cooldown: .16, limit: 2 },
  frostNova: { gain: .46, cooldown: .24, limit: 2 },
  talisman: { gain: .32, cooldown: .13, limit: 2 },
  explosion: { gain: .45, cooldown: .18, limit: 2 },
  bossSpawn: { gain: .59, cooldown: 1, limit: 1, priority: 4, critical: true, duck: .38 },
  levelUp: { gain: .47, cooldown: .25, limit: 2, priority: 3, critical: true, duck: .65 },
  uiSelect: { gain: .36, cooldown: .055, limit: 2, priority: 3, critical: true },
  // Archived provider sources remain available to explicit asset audition only.
  skillFlameCleave: { gain: .43, cooldown: .1, limit: 2 },
  skillThunderCharge: { gain: .30, cooldown: .1, limit: 2 },
};
// Raw audition uses these profiles; gameplay uses the phase-specific envelope below.
for (const phases of Object.values(SKILL_SOUND_PROFILES)) for (const profile of Object.values(phases)) {
  if (profile && !profiles[profile.sample]) profiles[profile.sample] = { gain: profile.gain, cooldown: .08, limit: 2 };
}

// Buffers are fetched/decoded once after AudioContext unlock, never during a combat event.
export function createSampleBank(context, destination) {
  const buffers = new Map(), voices = new Set(), retiring = new Set(), last = new Map();
  const errors = [], fallbackReasons = [], playedByCue = {}, suppressedByCue = {}, sources = {};
  const skillEvents = new Map(), skillPlayedByPhase = {}, skillSuppressed = {};
  const skillLoops = new Map(), loopStops = {};
  let loopRefreshes = 0;
  const combatBus = context.createGain(), criticalBus = context.createGain(), ambienceBus = context.createGain();
  const combatMute = context.createGain(), criticalMute = context.createGain();
  const skillBus = context.createGain(), skillMute = context.createGain();
  skillBus.connect(skillMute); skillMute.connect(destination);
  combatBus.connect(combatMute); combatMute.connect(destination);
  criticalBus.connect(criticalMute); criticalMute.connect(destination);
  ambienceBus.connect(destination); ambienceBus.gain.value = 0;
  let loaded = false, played = 0, peakVoices = 0, stolenVoices = 0, ambience = null, disposed = false;
  let processed = false, duckUntil = 0, duckAmount = 1, skillDuckUntil = 0;
  let loadSettled = false;
  const pendingFetch = new AbortController();
  let state = { playing: false, paused: false, muted: false };
  let lastCombatTarget = 1, lastCriticalTarget = 1, lastAmbienceTarget = 0;

  async function fetchManifest(url) {
    const response = await fetch(url, { signal: pendingFetch.signal });
    if (!response.ok) throw new Error(`Audio manifest: ${response.status}`);
    return response.json();
  }
  const load = (async () => {
    let manifest, base;
    try {
      manifest = await fetchManifest('./assets/audio/processed/manifest.json');
      base = './assets/audio/processed/'; processed = true;
    } catch (error) {
      if (disposed) return;
      fallbackReasons.push(error.message);
      manifest = await fetchManifest('./assets/audio/manifest.json');
      base = './assets/audio/';
    }
    await Promise.all(Object.entries(manifest.cues).map(async ([id, cue]) => {
      const candidates = [cue.file, cue.fallbackFile].filter(Boolean);
      for (const file of candidates) {
        try {
          const response = await fetch(`${base}${file}`, { signal: pendingFetch.signal });
          if (!response.ok) throw new Error(`${id}: ${response.status}`);
          const buffer = await context.decodeAudioData(await response.arrayBuffer());
          if (!disposed) { buffers.set(id, buffer); sources[id] = file; }
          return;
        } catch (error) {
          if (disposed) return;
          if (file === candidates.at(-1)) errors.push(error.message);
          else fallbackReasons.push(`${file}: ${error.message}`);
        }
      }
    }));
    loaded = !disposed && errors.length === 0;
  })().catch(error => { if (!disposed) errors.push(error.message); }).finally(() => { loadSettled = true; });

  function releaseVoice(voice, now, immediate = false) {
    voices.delete(voice);
    if (voice.loopKey && skillLoops.get(voice.loopKey) === voice) skillLoops.delete(voice.loopKey);
    const stopAt = immediate ? now : now + .012;
    const currentGain = voice.gain.gain.value;
    if (voice.gain.gain.cancelAndHoldAtTime) voice.gain.gain.cancelAndHoldAtTime(now);
    else { voice.gain.gain.cancelScheduledValues(now); voice.gain.gain.setValueAtTime(currentGain, now); }
    if (!immediate) {
      voice.gain.gain.linearRampToValueAtTime(0, stopAt);
    }
    retiring.add(voice);
    voice.stopAt = stopAt;
    try { voice.source.stop(stopAt); } catch { /* A source can have ended between event and update. */ }
    return stopAt;
  }
  function suppress(id) {
    suppressedByCue[id] = (suppressedByCue[id] ?? 0) + 1;
    return true; // The generated cue owns this event; suppress its procedural fallback too.
  }
  function play(type, options = {}) {
    const id = aliases[type] || type;
    return startVoice(id, profiles[id], options, type);
  }
  function startVoice(id, profile, { priority = 1, pan = 0, distance = 0 } = {}, type = id) {
    const buffer = buffers.get(id);
    if (!buffer || !profile || disposed) return false;
    if (state.muted || (state.paused && !profile.critical)) return suppress(id);
    const now = context.currentTime;
    const group = profile.group ?? id;
    if (now - (last.get(group) ?? -10) < profile.cooldown) return suppress(id);
    priority = Number.isFinite(priority) ? Math.max(0, Math.min(4, priority)) : 1;
    priority = Math.max(priority, profile.priority ?? 0, type === 'playerDamage' ? 3 : 0);
    const sameCue = [...voices].filter(voice => voice.group === group);
    let replacement = sameCue.length >= profile.limit ? sameCue.find(voice => voice.priority <= priority) : null;
    if (sameCue.length >= profile.limit && !replacement) return suppress(id);
    if (!replacement && voices.size >= MAX_VOICES) {
      replacement = [...voices].filter(voice => voice.priority < priority).sort((a, b) => a.priority - b.priority || a.startedAt - b.startedAt)[0];
      if (!replacement) return suppress(id);
    }
    let startAt = now;
    if (replacement) {
      // The new source waits for a 12 ms release: stolen voices do not click or briefly exceed the audio cap.
      startAt = releaseVoice(replacement, now); stolenVoices++;
    }
    // Pending sources can be replaced repeatedly in one frame. Wait for all release
    // tails before starting a replacement, keeping the physical voice cap bounded.
    if (voices.size + retiring.size >= MAX_VOICES) startAt = Math.max(startAt, ...[...retiring].map(voice => voice.stopAt));
    last.set(group, now);
    const source = context.createBufferSource(), gain = context.createGain();
    source.buffer = buffer;
    source.playbackRate.value = (profile.rate ?? 1) * (profile.critical || profile.feedback ? 1 : .98 + Math.random() * .04);
    const offset = Math.min(profile.offset ?? 0, Math.max(0, buffer.duration - .02));
    const duration = profile.loop ? profile.duration : Math.min((buffer.duration - offset) / source.playbackRate.value, profile.duration ?? 3.2);
    source.loop = Boolean(profile.loop);
    const safeDistance = Number.isFinite(distance) ? Math.max(0, distance) : 0;
    const volume = profile.gain / (1 + safeDistance * .06);
    const spatial = context.createStereoPanner?.();
    if (spatial) spatial.pan.value = Number.isFinite(pan) ? Math.max(-.85, Math.min(.85, pan)) : 0;
    const release = Math.min(.04, duration * .18);
    gain.gain.setValueAtTime(0, startAt);
    gain.gain.linearRampToValueAtTime(volume, startAt + .002);
    gain.gain.setValueAtTime(volume, startAt + Math.max(.003, duration - release));
    gain.gain.linearRampToValueAtTime(0, startAt + duration);
    const bus = profile.critical || type === 'playerDamage' ? criticalBus : profile.skill ? skillBus : combatBus;
    source.connect(gain);
    if (spatial) { gain.connect(spatial); spatial.connect(bus); } else gain.connect(bus);
    const voice = { id, group, source, gain, spatial, priority, volume, startedAt: startAt, loopKey: profile.loopKey, baseGain: profile.gain, stopAt: startAt + duration + .005 };
    voices.add(voice); peakVoices = Math.max(peakVoices, voices.size);
    if (voice.loopKey) skillLoops.set(voice.loopKey, voice);
    source.onended = () => {
      voices.delete(voice); retiring.delete(voice);
      if (voice.loopKey && skillLoops.get(voice.loopKey) === voice) skillLoops.delete(voice.loopKey);
      source.disconnect(); gain.disconnect(); spatial?.disconnect();
    };
    source.start(startAt, offset); source.stop(startAt + duration + .005);
    played++; playedByCue[id] = (playedByCue[id] ?? 0) + 1;
    if (profile.duck) {
      duckAmount = now < duckUntil ? Math.min(duckAmount, profile.duck) : profile.duck;
      duckUntil = Math.max(duckUntil, now + Math.min(duration, 1.5));
      combatBus.gain.cancelScheduledValues(now);
      combatBus.gain.setTargetAtTime(duckAmount, now, .022);
      if (!profile.skill) {
        skillDuckUntil = Math.max(skillDuckUntil, now + Math.min(duration, 1.5));
        skillBus.gain.setTargetAtTime(profile.duck, now, .022);
      }
    }
    return true;
  }
  function playSkillSound(skillId, phase, options = {}) {
    const phases = Object.hasOwn(SKILL_SOUND_PROFILES, skillId) ? SKILL_SOUND_PROFILES[skillId] : null;
    if (!phases) return false;
    // Both public entry points accept the authoritative Combat status/end contract.
    if (phase === 'status') {
      if (options.status !== 'buff' && options.status !== 'gravity') return true;
      phase = 'sustain';
    }
    if (phase === 'end') {
      if (options.reason && options.reason !== 'expired') phase = 'cancel';
      else if (options.status === 'stun') return true;
    }
    if (!Object.hasOwn(phases, phase)) return false;
    const reject = reason => { skillSuppressed[reason] = (skillSuppressed[reason] ?? 0) + 1; return true; };
    if (disposed) return reject('disposed');
    const now = context.currentTime;
    const castKey = options.castId == null ? null : `${skillId}:${String(options.castId).slice(0, 160)}`;
    for (const [key, time] of skillEvents) if (now - time > 20) skillEvents.delete(key);
    if (phase === 'end' || phase === 'cancel') {
      if (castKey) {
        stopSkillLoop(castKey, phase);
        rememberSkillEvent(`closed:${castKey}`, now);
      }
      if (phase === 'cancel') return true;
    }
    if (state.muted || state.paused || !state.playing) return reject('inactive');
    if (options.local === false && (phase === 'ready' || phase === 'resourcefail')) return reject('privateFeedback');
    if (Number.isFinite(options.ageMs) && options.ageMs > 180) return reject('stale');
    const profile = phases[phase];
    if (!profile) return reject('instantaneous');
    // An unlocked context is managed by audioManager. Never enqueue a suspended cue.
    if (context.state === 'suspended' && typeof context.resume === 'function' && !('startRendering' in context)) return reject('locked');
    if (profile.loop) {
      if (!castKey) return reject('missingCastId');
      if (skillEvents.has(`closed:${castKey}`)) return reject('ended');
      const remaining = Number.isFinite(options.remaining) ? options.remaining
        : Number.isFinite(options.statusDuration) ? options.statusDuration
        : Number.isFinite(options.duration) ? options.duration : profile.duration;
      const duration = Math.min(12, remaining - Math.max(0, Number(options.ageMs) || 0) / 1000);
      if (duration <= .02) { stopSkillLoop(castKey, 'expired'); return reject('expired'); }
      if (!buffers.has(profile.sample)) return reject(loadSettled ? 'unavailable' : 'loading');
      const existing = skillLoops.get(castKey);
      if (existing && existing.stopAt > now) {
        const distance = Number.isFinite(options.distance) ? Math.max(0, options.distance) : 0;
        const volume = profile.gain / (1 + distance * .06);
        const param = existing.gain.gain;
        if (param.cancelAndHoldAtTime) param.cancelAndHoldAtTime(now);
        else { param.cancelScheduledValues(now); param.setValueAtTime(existing.volume, now); }
        param.linearRampToValueAtTime(volume, now + Math.min(.03, duration * .25));
        param.setValueAtTime(volume, now + Math.max(.01, duration - .04));
        param.linearRampToValueAtTime(0, now + duration);
        existing.volume = volume; existing.stopAt = now + duration + .005;
        existing.source.stop(existing.stopAt);
        if (existing.spatial) existing.spatial.pan.setTargetAtTime(Number.isFinite(options.pan) ? Math.max(-.85, Math.min(.85, options.pan)) : 0, now, .03);
        loopRefreshes++;
        return true;
      }
      if (existing) stopSkillLoop(castKey, 'expired');
      if (skillLoops.size >= 3) return reject('loopBudget');
      const before = played;
      startVoice(profile.sample, { ...profile, duration, loopKey: castKey, skill: true, group: `${skillId}:sustain`, cooldown: .06, limit: 2 }, options);
      if (played > before) skillPlayedByPhase[`${skillId}:sustain`] = (skillPlayedByPhase[`${skillId}:sustain`] ?? 0) + 1;
      else reject('budgetOrCooldown');
      return true;
    }
    if (options.castId != null) {
      const key = `${phase}:${castKey}${phase === 'kill' ? `:${String(options.contactId ?? options.targetId ?? '').slice(0, 80)}` : ''}`;
      if (skillEvents.has(key)) return reject('duplicate');
      rememberSkillEvent(key, now);
    }
    if (!buffers.has(profile.sample)) return reject(loadSettled ? 'unavailable' : 'loading');
    const before = played;
    startVoice(profile.sample, { ...profile, skill: true, group: profile.feedback ? phase : `${skillId}:${phase}`,
      cooldown: profile.cooldown ?? (phase === 'impact' ? .10 : .08), limit: profile.feedback ? 1 : 2,
      priority: profile.priority ?? (phase === 'travel' ? 1 : 2),
      duck: (phase === 'cast' || phase === 'release') && options.local !== false ? .72 : undefined,
    }, options);
    if (played > before) skillPlayedByPhase[`${skillId}:${phase}`] = (skillPlayedByPhase[`${skillId}:${phase}`] ?? 0) + 1;
    else reject('budgetOrCooldown');
    return true;
  }
  function rememberSkillEvent(key, now) {
    skillEvents.set(key, now);
    if (skillEvents.size > 512) skillEvents.delete(skillEvents.keys().next().value);
  }
  function playSkillEvent(event, options = {}) {
    if (!event || !Object.hasOwn(SKILL_SOUND_PROFILES, event.skillId)) return false;
    const playback = { castId: event.castId, contactId: event.contactId, targetId: event.targetId,
      status: event.status, reason: event.reason, remaining: event.remaining,
      statusDuration: event.statusDuration, duration: event.duration, ageMs: event.ageMs ?? 0, ...options };
    const recognised = playSkillSound(event.skillId, event.phase, playback);
    if (event.phase === 'impact' && event.killed && event.skillId === 'warrior_cleaving_dash') playSkillSound(event.skillId, 'kill', playback);
    return recognised;
  }
  function stopSkillLoop(key, reason) {
    const voice = skillLoops.get(key);
    if (!voice) return;
    releaseVoice(voice, context.currentTime);
    loopStops[reason] = (loopStops[reason] ?? 0) + 1;
  }
  function update(nextState) {
    if (disposed) return;
    state = { ...state, ...nextState };
    const now = context.currentTime;
    if (!state.playing || state.paused || state.muted) for (const key of [...skillLoops.keys()]) stopSkillLoop(key, state.paused ? 'pause' : state.muted ? 'mute' : 'inactive');
    const buffer = buffers.get('nightAmbience');
    if (buffer && !ambience && !state.muted && !state.paused) {
      const source = context.createBufferSource(); source.buffer = buffer; source.loop = true;
      source.connect(ambienceBus); source.start(); ambience = source;
      playedByCue.nightAmbience = 1;
    }
    if (duckUntil && now >= duckUntil) {
      duckUntil = 0; duckAmount = 1;
      combatBus.gain.setTargetAtTime(1, now, .22);
    }
    if (skillDuckUntil && now >= skillDuckUntil) { skillDuckUntil = 0; skillBus.gain.setTargetAtTime(1, now, .22); }
    const combatTarget = state.paused || state.muted ? 0 : 1;
    const criticalTarget = state.muted ? 0 : 1;
    const ambienceTarget = state.muted || state.paused ? 0 : (state.playing ? .24 : .17) * (duckUntil > now ? .65 : 1);
    // Schedule only on changes; per-frame setTarget calls continually restart long fades.
    if (combatTarget !== lastCombatTarget) {
      combatMute.gain.setTargetAtTime(combatTarget, now, .025);
      skillMute.gain.setTargetAtTime(combatTarget, now, .025); lastCombatTarget = combatTarget;
      if (!combatTarget) for (const voice of [...voices]) if (voice.group !== 'uiSelect') releaseVoice(voice, now);
    }
    if (criticalTarget !== lastCriticalTarget) { criticalMute.gain.setTargetAtTime(criticalTarget, now, .025); lastCriticalTarget = criticalTarget; }
    if (ambienceTarget !== lastAmbienceTarget) { ambienceBus.gain.setTargetAtTime(ambienceTarget, now, .35); lastAmbienceTarget = ambienceTarget; }
  }
  function reset() {
    for (const voice of [...voices, ...retiring]) releaseVoice(voice, context.currentTime, true);
    voices.clear(); retiring.clear(); last.clear(); skillEvents.clear(); skillLoops.clear();
    duckUntil = 0; duckAmount = 1; skillDuckUntil = 0;
    for (const bus of [combatBus, skillBus]) {
      bus.gain.cancelScheduledValues(context.currentTime); bus.gain.setValueAtTime(1, context.currentTime);
    }
  }
  return {
    load, play, playSkillSound, playSkillEvent, update, reset,
    getState: () => ({ provider: 'ElevenLabs', loaded, processed, loadedCues: [...buffers.keys()], sources: { ...sources },
      activeVoices: voices.size, retiringVoices: retiring.size, maxVoices: MAX_VOICES, peakVoices, stolenVoices,
      played, playedByCue: { ...playedByCue }, suppressedByCue: { ...suppressedByCue },
      loadSettled, disposed, skillPlayedByPhase: { ...skillPlayedByPhase }, skillSuppressed: { ...skillSuppressed }, recentSkillEvents: skillEvents.size,
      activeSkillLoops: [...skillLoops.keys()], loopRefreshes, loopStops: { ...loopStops },
      ambienceActive: Boolean(ambience), ambienceGain: ambienceBus.gain.value, combatGain: combatBus.gain.value,
      ducking: duckUntil > context.currentTime, errors: [...errors], fallbackReasons: [...fallbackReasons] }),
    dispose() {
      if (disposed) return;
      disposed = true;
      pendingFetch.abort();
      for (const voice of [...voices, ...retiring]) { voice.source.disconnect(); voice.gain.disconnect(); voice.spatial?.disconnect(); }
      reset();
      if (ambience) { ambience.stop(); ambience.disconnect(); ambience = null; }
      for (const node of [combatBus, criticalBus, ambienceBus, combatMute, criticalMute, skillBus, skillMute]) node.disconnect();
      buffers.clear();
    },
  };
}
