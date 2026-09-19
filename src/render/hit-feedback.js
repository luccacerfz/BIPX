// Combat feel for the LOCAL view: hit-stop, camera trauma/kick, kill pops, damage-number language, low-health alarm and
// the death beat. Presentation only. Nothing here reads or writes the simulation: main.js steps the world with its own
// `dt` first and then asks `frame(rawDt, dt)` how much ANIMATION time this frame should show. A hit-stop withholds view
// time from the skeletal mixers and pays it back right after (catch-up), so the view never drifts from the simulation
// clock, cooldowns or server messages. The core is pure (no THREE, no DOM) and runs under node: tools/verify-hit-feedback.mjs.
const freeze = value => { for (const child of Object.values(value)) if (child && typeof child === 'object') freeze(child); return Object.freeze(value); };

export const HIT_FEEDBACK = freeze({
  // Milliseconds of frozen animation. Light hits stay at or under one 60 Hz frame and are rate-limited.
  stop: { light: 22, heavy: 48, boss: 58, skill: 52, relicHeavy: 50, finisher: 70, heavyKill: 60, bossKill: 80, multiKill: 60, massKill: 80,
    cap: 80, scale: .04, catchUp: 1.6, maxDebt: .12, lightGap: .17, heavyGap: .11, dutyPerSecond: .2, burst: .26 },
  // Camera trauma (0..1). updateCamera turns it into centimetres; `cap` bounds everything this module adds.
  trauma: { lightMelee: .1, lightRanged: .04, heavy: .17, boss: .22, skill: .22, relicHeavy: .18, finisher: .32, kill: .05, heavyKill: .26, bossKill: .5,
    multiKill: .3, massKill: .38, death: .5, cap: .6, decay: 9 },
  kick: { light: .05, heavy: .12, finisher: .18, decay: 22, cap: .24 },
  multiKill: { window: .14, kills: 3, massKills: 6 },
  flash: { hold: .04, decay: .09, peak: 1.25, streamGain: .4, remoteGain: .7, lodHold: .06, instanceBoost: 3, squash: .12 },
  lowHealth: { enter: .35, exit: .4, criticalEnter: .15, criticalExit: .2 },
  // Death beat: freeze, slow motion, ease out, then main.js opens the summary panel. Reduced motion: a plain fade.
  death: { duration: 1.4, freeze: .12, freezeScale: .03, slowUntil: 1, slowScale: .22, endScale: .7, zoom: .16, zoomSeconds: 1.1, reducedDuration: .5 },
  numbers: { life: .7, rollingLife: .9, rollingWindow: 1.6, mergeWindow: .12, redrawInterval: .09, pop: .09 },
});

// Hit sources. STREAM sources tick the same body over and over (burn, relic streams, automatic weapons): they roll into
// one number per target and never stop time or shake the camera. HEAVY relics are single big blows.
const STREAM = new Set(['burnTick', 'cannonNapalm', 'flamethrower', 'orbitOrb', 'guardianBlade', 'sealRain', 'sealRitual']);
const HEAVY_RELIC = new Set(['axe', 'boneCannon', 'frostNova', 'talisman']);
const RANGED_BASIC = new Set(['pistol', 'crossbow', 'thunderstaff']);
export const isStreamHit = hitEffect => STREAM.has(hitEffect);
export const isSkillHit = hitEffect => typeof hitEffect === 'string' && (hitEffect.startsWith('warrior_') || hitEffect.startsWith('dwarf_'));

const scratchHit = { kind: 'light', stream: false, stopMs: 0, heavyStop: false, trauma: 0, kick: 0, flash: 1, spark: false, pop: 0 };
/** Pure classification. `weight` is hero-power's monsterWeight ('swarm' | 'heavy' | 'boss'). Returns a reused object. */
export function classifyHit({ hitEffect = null, weight = 'swarm', killed = false, crit = false, local = true, repeat = false } = {}) {
  const out = scratchHit, S = HIT_FEEDBACK.stop, T = HIT_FEEDBACK.trauma, K = HIT_FEEDBACK.kick;
  const stream = STREAM.has(hitEffect) || repeat;
  out.stream = stream; out.stopMs = 0; out.heavyStop = false; out.trauma = 0; out.kick = 0;
  out.flash = stream ? HIT_FEEDBACK.flash.streamGain : local ? 1 : HIT_FEEDBACK.flash.remoteGain;
  out.spark = crit && !stream; out.pop = killed ? (weight === 'boss' ? 2.4 : weight === 'heavy' ? 1.6 : 1) : 0;
  out.kind = stream ? 'stream' : 'light';
  if (!local) return out;
  if (stream) { if (killed) out.trauma = weight === 'boss' ? T.bossKill : weight === 'heavy' ? T.heavyKill : 0; return out; }
  const skill = isSkillHit(hitEffect), relicHeavy = HEAVY_RELIC.has(hitEffect), ranged = RANGED_BASIC.has(hitEffect);
  // A rifle round that merely lands never freezes the view (it fires every 0.3 s); the blow that fells a brute or a boss does.
  if (weight === 'boss') { out.kind = 'boss'; out.stopMs = killed ? S.bossKill : ranged ? 0 : S.boss; out.trauma = killed ? T.bossKill : ranged ? T.lightRanged * 2 : T.boss; out.kick = ranged && !killed ? 0 : K.heavy; out.heavyStop = true; }
  else if (weight === 'heavy') { out.kind = 'heavy'; out.stopMs = killed ? S.heavyKill : ranged ? 0 : S.heavy; out.trauma = killed ? T.heavyKill : ranged ? T.lightRanged * 2 : T.heavy; out.kick = ranged && !killed ? 0 : K.heavy; out.heavyStop = true; }
  else if (skill) { out.kind = 'skill'; out.stopMs = S.skill; out.trauma = T.skill; out.kick = K.heavy; out.heavyStop = true; }
  else if (relicHeavy) { out.kind = 'relicHeavy'; out.stopMs = S.relicHeavy; out.trauma = T.relicHeavy; out.kick = K.light; out.heavyStop = true; }
  else if (ranged) { out.trauma = T.lightRanged; }
  else { out.stopMs = S.light; out.trauma = T.lightMelee; out.kick = K.light; }
  if (killed && weight === 'swarm') out.trauma += T.kill;
  return out;
}

export function createHitFeedback({ reducedMotion = false } = {}) {
  const S = HIT_FEEDBACK.stop, T = HIT_FEEDBACK.trauma, D = HIT_FEEDBACK.death, L = HIT_FEEDBACK.lowHealth;
  let reduced = Boolean(reducedMotion), wall = 0, stopRemaining = 0, stopTotal = 0, stopHeavy = false, lastStopEndedAt = -Infinity, debt = 0, load = 0;
  let trauma = 0, kickX = 0, kickZ = 0, burstKills = 0, burstUntil = -Infinity, health = 'ok';
  const death = { active: false, finished: false, elapsed: 0, duration: D.duration };
  // `mixer`: seconds of skeletal animation to show; `fx`: seconds for effects (only the death beat slows them).
  const view = { mixer: 0, fx: 0, trauma: 0, kickX: 0, kickZ: 0, deathZoom: 0, stopped: false };
  const stats = { stops: 0, skipped: 0, extended: 0, heldMs: 0, longestMs: 0, simSeconds: 0, mixerSeconds: 0, debtMs: 0, maxDebtMs: 0, kills: 0, multiKills: 0, deaths: 0, lastKind: null };
  const smooth = t => { const x = Math.max(0, Math.min(1, t)); return x * x * (3 - 2 * x); };

  function requestStop(ms, heavy, kind) {
    if (reduced || death.elapsed > 0 || !(ms > 0)) return false; // from the killing blow until the next run nothing else stops time
    const seconds = Math.min(ms, S.cap) / 1000;
    if (stopRemaining > 0) { // a heavier beat may lengthen the running stop, never stack on it
      if (seconds > stopTotal) { stopRemaining += seconds - stopTotal; load += seconds - stopTotal; stopTotal = seconds; stopHeavy ||= heavy; stats.extended += 1; stats.lastKind = kind; stats.longestMs = Math.max(stats.longestMs, seconds * 1000); }
      return true;
    }
    const since = wall - lastStopEndedAt, upgrade = heavy && !stopHeavy;
    if ((since < (heavy ? S.heavyGap : S.lightGap) && !upgrade) || load + seconds > S.burst) { stats.skipped += 1; return false; }
    stopRemaining = stopTotal = seconds; stopHeavy = heavy; load += seconds;
    stats.stops += 1; stats.lastKind = kind; stats.longestMs = Math.max(stats.longestMs, seconds * 1000);
    return true;
  }
  function addTrauma(amount) { if (!reduced && amount > 0) trauma = Math.min(T.cap, Math.max(trauma, amount) + (trauma > amount ? amount * .25 : 0)); }
  function addKick(dx, dz, metres) {
    const length = Math.hypot(dx, dz); if (reduced || !(metres > 0) || !(length > 1e-6)) return;
    kickX += dx / length * metres; kickZ += dz / length * metres;
    const size = Math.hypot(kickX, kickZ), cap = HIT_FEEDBACK.kick.cap; if (size > cap) { kickX *= cap / size; kickZ *= cap / size; }
  }

  return {
    view, stats, death,
    setReducedMotion(value) { reduced = Boolean(value); if (reduced) { stopRemaining = 0; debt = 0; trauma = 0; kickX = kickZ = 0; } },
    /** One confirmed hit of the local player (or a remote one with local:false). Returns the reused classification. */
    hit(event, dx = 0, dz = 0) {
      const hit = classifyHit(event);
      if (event?.local === false || death.elapsed > 0) return hit;
      if (hit.stopMs > 0) requestStop(hit.stopMs, hit.heavyStop, hit.kind);
      addTrauma(hit.trauma); addKick(dx, dz, hit.kick);
      if (event?.killed) {
        stats.kills += 1;
        if (wall > burstUntil) burstKills = 0;
        burstKills += 1; burstUntil = wall + HIT_FEEDBACK.multiKill.window;
        if (burstKills === HIT_FEEDBACK.multiKill.kills) { stats.multiKills += 1; requestStop(S.multiKill, true, 'multiKill'); addTrauma(T.multiKill); }
        else if (burstKills === HIT_FEEDBACK.multiKill.massKills) { requestStop(S.massKill, true, 'massKill'); addTrauma(T.massKill); }
      }
      return hit;
    },
    /** Named beats that are not a single hit: 'finisher' (combo finisher that connected), 'relicHeavy', 'skill'. */
    beat(kind, dx = 0, dz = 0) {
      if (!Object.hasOwn(S, kind) || typeof S[kind] !== 'number') return false;
      addTrauma(T[kind] ?? 0); addKick(dx, dz, HIT_FEEDBACK.kick[kind] ?? HIT_FEEDBACK.kick.heavy);
      return requestStop(S[kind], true, kind);
    },
    /** Health ratio of the local hero. Returns true when the alarm level changed ('ok' | 'low' | 'critical'). */
    setHealth(ratio, active) {
      let next = health;
      if (!active || !(ratio > 0)) next = 'ok';
      else if (ratio <= L.criticalEnter || (health === 'critical' && ratio < L.criticalExit)) next = 'critical';
      else if (ratio <= L.enter || (health !== 'ok' && ratio < L.exit)) next = 'low';
      else next = 'ok';
      if (next === health) return false;
      health = next; return true;
    },
    get health() { return health; },
    beginDeath() {
      death.active = true; death.finished = false; death.elapsed = 1e-6; death.duration = reduced ? D.reducedDuration : D.duration;
      stopRemaining = 0; debt = 0; kickX = kickZ = 0; stats.deaths += 1; addTrauma(T.death); health = 'ok';
    },
    /** True exactly once, when the beat is over and the summary panel must open. */
    consumeDeathFinished() { if (!death.finished) return false; death.finished = false; return true; },
    reset() { death.active = death.finished = false; death.elapsed = 0; stopRemaining = 0; debt = 0; load = 0; trauma = 0; kickX = kickZ = 0; burstKills = 0; health = 'ok'; view.deathZoom = 0; view.stopped = false; },
    /**
     * Once per rendered frame, AFTER the simulation step. `rawDt` is wall time, `simDt` the step the simulation used (0 while
     * paused). Never returns more or less SIMULATION time: only `view.mixer` (animation) is held back and paid back.
     */
    frame(rawDt, simDt) {
      const real = Math.min(Math.max(Number(rawDt) || 0, 0), .1), step = Math.min(Math.max(Number(simDt) || 0, 0), .1);
      wall += real; load = Math.max(0, load - real * S.dutyPerSecond);
      view.mixer = step; view.fx = step; view.stopped = false;
      if (death.active) {
        death.elapsed += real;
        const t = death.elapsed, scale = reduced ? 1 : t < D.freeze ? D.freezeScale : t < D.slowUntil ? D.slowScale : D.slowScale + (D.endScale - D.slowScale) * smooth((t - D.slowUntil) / (death.duration - D.slowUntil));
        view.mixer = view.fx = step * scale; view.stopped = !reduced && t < D.freeze;
        if (t >= death.duration) { death.active = false; death.finished = true; }
      } else if (stopRemaining > 0) {
        const held = Math.min(real, stopRemaining), share = real > 0 ? held / real : 1;
        stopRemaining -= held; stats.heldMs += held * 1000; view.stopped = true;
        view.mixer = step * (1 - share) + step * share * S.scale;
        debt = Math.min(S.maxDebt, debt + step - view.mixer);
        if (stopRemaining <= 1e-6) { stopRemaining = 0; lastStopEndedAt = wall; }
      } else if (debt > 1e-6) {
        const extra = Math.min(debt, step * (S.catchUp - 1)); debt -= extra; view.mixer = step + extra;
      }
      if (death.elapsed > 0 && !reduced) view.deathZoom = D.zoom * smooth(death.elapsed / D.zoomSeconds);
      trauma *= Math.exp(-real * T.decay); if (trauma < .004) trauma = 0;
      const kickDecay = Math.exp(-real * HIT_FEEDBACK.kick.decay); kickX *= kickDecay; kickZ *= kickDecay;
      view.trauma = reduced ? 0 : trauma; view.kickX = reduced ? 0 : kickX; view.kickZ = reduced ? 0 : kickZ;
      // Drift accounting covers the run only: the death beat is deliberate slow motion after the simulation has ended.
      if (!(death.elapsed > 0)) { stats.simSeconds += step; stats.mixerSeconds += view.mixer; }
      stats.debtMs = debt * 1000; stats.maxDebtMs = Math.max(stats.maxDebtMs, stats.debtMs);
      return view;
    },
    getStats() { return { ...stats, heldMs: Math.round(stats.heldMs), simSeconds: +stats.simSeconds.toFixed(3), mixerSeconds: +stats.mixerSeconds.toFixed(3),
      viewLagMs: +((stats.simSeconds - stats.mixerSeconds) * 1000).toFixed(2), debtMs: +stats.debtMs.toFixed(2), maxDebtMs: +stats.maxDebtMs.toFixed(2),
      stopping: stopRemaining > 0, trauma: +trauma.toFixed(3), health, reducedMotion: reduced, death: { active: death.active, elapsed: +death.elapsed.toFixed(3), duration: death.duration } }; },
  };
}

// ---- damage numbers: one colour language, HDR tint (the scene is filmic-composited, plain white reads grey) ----
export const DAMAGE_NUMBER_STYLES = freeze({
  normal: { fill: '#fff4dc', glow: 'rgba(255, 236, 190, 0.4)', font: 36, stroke: 7, blur: 8, scale: 1, rise: 2.25, tint: [1.5, 1.42, 1.22], pop: .5 },
  crit: { fill: '#ffd84a', glow: 'rgba(255, 190, 40, 0.9)', font: 44, stroke: 8, blur: 16, scale: 1.5, rise: 2.6, tint: [2.5, 2.05, 1.15], pop: .85, suffix: '!' },
  dot: { fill: '#ff9d45', glow: 'rgba(255, 120, 30, 0.55)', font: 32, stroke: 6, blur: 8, scale: .8, rise: 2.05, tint: [1.55, 1.12, .7], pop: .22 },
  heal: { fill: '#7dffa0', glow: 'rgba(60, 255, 130, 0.6)', font: 34, stroke: 6, blur: 10, scale: .9, rise: 2.9, tint: [1.05, 1.6, 1.15], pop: .3, prefix: '+' },
  playerDamage: { fill: '#ff4b4b', glow: 'rgba(255, 57, 57, 0.74)', font: 40, stroke: 8, blur: 14, scale: 1.08, rise: 2.95, tint: [1.7, .8, .8], pop: .4, prefix: '-' },
});
/** 1234 → "1,2k" (pt-BR). Numbers stay short so a rolling total never outgrows its sprite. */
export function formatDamageNumber(amount) {
  const value = Math.max(1, Math.ceil(Number(amount) || 0));
  if (value < 1000) return String(value);
  const short = value < 1e6 ? value / 1e3 : value / 1e6;
  return `${(Math.floor(short * 10) / 10).toLocaleString('pt-BR', { maximumFractionDigits: short >= 100 ? 0 : 1 })}${value < 1e6 ? 'k' : 'M'}`;
}

// ---- DOM: low-health pulse and death vignette/desaturation. Classes only; every animation lives in hit-feedback.css ----
export function createHitFeedbackOverlay(documentRef = globalThis.document) {
  if (!documentRef?.body) return { setHealth() {}, setDeath() {}, dispose() {} };
  if (!documentRef.querySelector('link[href*="hit-feedback.css"]')) { // index.html may link it statically; then this is a no-op
    const link = documentRef.createElement('link'); link.rel = 'stylesheet'; link.href = new URL('./hit-feedback.css', import.meta.url).href; documentRef.head.append(link);
  }
  const root = documentRef.createElement('div'); root.className = 'hit-feedback'; root.setAttribute('aria-hidden', 'true'); root.dataset.health = 'ok'; root.dataset.death = 'off';
  for (const name of ['lowhealth', 'death']) { const layer = documentRef.createElement('div'); layer.className = `hit-feedback__${name}`; root.append(layer); }
  (documentRef.querySelector('#app') || documentRef.body).append(root);
  return {
    root,
    setHealth(level) { root.dataset.health = level; },
    /** 'beat' while dying, 'settled' under the summary panel, 'off' the instant a new run starts. */
    setDeath(phase) { root.dataset.death = phase; documentRef.body.classList.toggle('hit-feedback-death', phase !== 'off'); },
    dispose() { root.remove(); documentRef.body.classList.remove('hit-feedback-death'); },
  };
}

// ---- pooled additive sprites: kill pop (flash + ring) and hit sparks for bodies that cannot flash their own material ----
export function createImpactSprites({ THREE, scene, quality = 'high', reducedMotion = false }) {
  const texture = (draw) => { const canvas = document.createElement('canvas'); canvas.width = canvas.height = 64; draw(canvas.getContext('2d')); const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace; return map; };
  const glow = texture(ctx => { const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.22, 'rgba(255,244,214,.85)'); g.addColorStop(.55, 'rgba(255,190,110,.22)'); g.addColorStop(1, 'rgba(255,160,80,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64); });
  const ring = texture(ctx => { const g = ctx.createRadialGradient(32, 32, 24, 32, 32, 31); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(.6, 'rgba(255,244,214,.95)'); g.addColorStop(1, 'rgba(255,200,120,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64); });
  const limits = { high: 28, medium: 18, low: 10 };
  let limit = limits[quality] ?? limits.high, reduced = Boolean(reducedMotion);
  const free = [], active = [];
  function acquire(map) {
    if (active.length >= limit) return null;
    // Same program defines as the damage-number sprites (map + fog), so the first pop never compiles a shader mid-fight.
    const item = free.pop() ?? { sprite: new THREE.Sprite(new THREE.SpriteMaterial({ map, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })), age: 0, life: 1, from: 1, to: 1, gain: 1 };
    item.sprite.material.map = map; item.sprite.renderOrder = 30; item.age = 0;
    if (!item.sprite.parent) scene.add(item.sprite);
    item.sprite.visible = true; active.push(item);
    return item;
  }
  function spawn(map, position, y, from, to, life, gain, r, g, b) {
    const item = acquire(map); if (!item) return;
    item.sprite.position.set(position.x, y, position.z); item.sprite.scale.set(from, from, 1);
    item.sprite.material.color.setRGB(r * gain, g * gain, b * gain); item.sprite.material.opacity = 1;
    item.from = from; item.to = to; item.life = life; item.gain = gain;
  }
  return {
    setQuality(value) { limit = limits[value] ?? limits.high; },
    setReducedMotion(value) { reduced = Boolean(value); },
    /** Kill pop: white-hot flash plus an expanding ring. `size` 1 swarm, 1.6 heavy, 2.4 boss. */
    pop(position, size = 1, height = 1.2) {
      const gain = reduced ? 1.4 : 2.6;
      spawn(glow, position, height * Math.min(size, 1.8), .8 * size, 2.7 * size, .15, gain, 1, .93, .74);
      if (!reduced && limit > limits.low) spawn(ring, position, height * .75, .5 * size, 3.4 * size, .22, 1.7, 1, .86, .6);
    },
    /** Short spark on a confirmed hit: crits, and bodies rendered as static LOD / instances. */
    spark(position, size = 1, height = 1.25, crit = false) {
      spawn(glow, position, height, .45 * size, (crit ? 1.7 : 1.15) * size, crit ? .12 : .085, reduced ? 1.2 : crit ? 2.8 : 1.9, 1, crit ? .84 : .95, crit ? .42 : .8);
    },
    update(dt) {
      for (let index = active.length - 1; index >= 0; index -= 1) {
        const item = active[index]; item.age += dt;
        const t = Math.min(1, item.age / item.life), ease = 1 - (1 - t) * (1 - t), size = item.from + (item.to - item.from) * ease;
        item.sprite.scale.set(size, size, 1); item.sprite.material.opacity = (1 - t) * (1 - t);
        if (t >= 1) { item.sprite.visible = false; active[index] = active[active.length - 1]; active.pop(); free.push(item); }
      }
    },
    reset() { while (active.length) { const item = active.pop(); item.sprite.visible = false; free.push(item); } },
    getStats() { return { active: active.length, pooled: free.length, limit }; },
    dispose() { for (const item of [...active, ...free]) { item.sprite.removeFromParent(); item.sprite.material.dispose(); } active.length = free.length = 0; glow.dispose(); ring.dispose(); },
  };
}
