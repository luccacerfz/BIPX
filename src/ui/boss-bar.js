// Fixed boss bar. Presentation only: it mirrors `bipx:boss-state` (published by the engine next to the ARPG snapshot)
// and never talks back. While it is mounted the world plate shrinks to a health pip (boss-label-painter.js).
import { setBossWorldPlateMode } from './boss-label-painter.js';

const root = document.querySelector('#boss-bar');
const finite = value => typeof value === 'number' && Number.isFinite(value);
const whole = value => Math.ceil(value).toLocaleString('pt-BR');
const SWITCH_AFTER_MS = 2500; // the focused boss changes only after the player has left it alone this long
const known = new Map(); // id -> { health, damagedAt, seenAt }
let primaryId = null;
let signature = '';
let furyAnnounced = new Set();

export function normalizeBosses(detail) {
  const list = Array.isArray(detail?.bosses) ? detail.bosses : [];
  return list.filter(boss => boss && (typeof boss.id === 'number' || typeof boss.id === 'string') && finite(boss.health) && finite(boss.maxHealth) && boss.maxHealth > 0 && boss.health > 0)
    .slice(0, 12).map(boss => ({
      id: String(boss.id), label: typeof boss.label === 'string' && boss.label.trim() ? boss.label.trim().slice(0, 48) : 'Chefe',
      health: Math.min(boss.health, boss.maxHealth), maxHealth: boss.maxHealth, ratio: Math.max(0, Math.min(1, boss.health / boss.maxHealth)),
      accent: typeof boss.accent === 'string' && /^#[0-9a-f]{3,8}$/i.test(boss.accent) ? boss.accent : '#b39a6e',
      phases: Array.isArray(boss.phases) ? boss.phases.filter(value => finite(value) && value > 0 && value < 1).slice(0, 4).sort((a, b) => b - a) : [],
    }));
}

// Sticky focus: keep the current boss unless it is gone, or another one is being hit while this one has been left alone.
export function pickPrimary(bosses, now) {
  const current = bosses.find(boss => boss.id === primaryId);
  const hottest = bosses.reduce((best, boss) => (known.get(boss.id)?.damagedAt ?? 0) > (known.get(best?.id)?.damagedAt ?? 0) ? boss : best, null);
  if (current) {
    const currentHit = known.get(current.id)?.damagedAt ?? 0, hottestHit = known.get(hottest?.id)?.damagedAt ?? 0;
    if (!hottest || hottest.id === current.id || hottestHit === 0 || now - currentHit < SWITCH_AFTER_MS) return current;
    return hottest;
  }
  return hottest && (known.get(hottest.id)?.damagedAt ?? 0) > 0 ? hottest : bosses.reduce((first, boss) => (known.get(boss.id).seenAt < known.get(first.id).seenAt ? boss : first), bosses[0]);
}

function render(bosses, now) {
  const name = root.querySelector('.boss-bar__name'), value = root.querySelector('.boss-bar__value'), track = root.querySelector('.boss-bar__track');
  const ticks = root.querySelector('.boss-bar__ticks'), state = root.querySelector('.boss-bar__state'), others = root.querySelector('.boss-bar__others');
  if (!bosses.length) {
    if (!root.hidden) { root.hidden = true; root.dataset.count = '0'; }
    primaryId = null; signature = ''; furyAnnounced = new Set();
    return;
  }
  const primary = pickPrimary(bosses, now), switched = primary.id !== primaryId, appeared = root.hidden;
  primaryId = primary.id;
  const fury = primary.phases.length > 0 && primary.ratio < primary.phases.at(-1);
  const rest = bosses.filter(boss => boss.id !== primary.id);
  const next = JSON.stringify([primary.id, primary.label, Math.ceil(primary.health), Math.ceil(primary.maxHealth), primary.accent, primary.phases, fury, rest.map(boss => [boss.id, boss.label, Math.round(boss.ratio * 100)])]);
  if (next === signature && !appeared) return;
  signature = next;
  if (switched) { root.classList.add('is-switching'); requestAnimationFrame(() => requestAnimationFrame(() => root.classList.remove('is-switching'))); }
  root.hidden = false;
  root.dataset.count = String(bosses.length);
  root.dataset.fury = String(fury);
  root.style.setProperty('--boss-ratio', primary.ratio.toFixed(4));
  root.style.setProperty('--boss-accent', primary.accent);
  name.textContent = primary.label;
  value.textContent = `${whole(primary.health)} / ${whole(primary.maxHealth)}`;
  state.hidden = !fury;
  track.setAttribute('aria-label', `Vida de ${primary.label}`);
  track.setAttribute('aria-valuemax', String(Math.ceil(primary.maxHealth)));
  track.setAttribute('aria-valuenow', String(Math.ceil(primary.health)));
  track.setAttribute('aria-valuetext', `${whole(primary.health)} de ${whole(primary.maxHealth)}${fury ? ', em fúria' : ''}`);
  const tickSignature = primary.phases.join('|');
  if (ticks.dataset.phases !== tickSignature) {
    ticks.dataset.phases = tickSignature;
    ticks.replaceChildren(...primary.phases.map(phase => { const tick = document.createElement('i'); tick.style.left = `${phase * 100}%`; tick.dataset.phase = String(phase); return tick; }));
  }
  for (const tick of ticks.children) tick.dataset.spent = String(primary.ratio < Number(tick.dataset.phase));
  others.hidden = rest.length === 0;
  others.replaceChildren(...rest.slice(0, 3).map(boss => {
    const item = document.createElement('li');
    item.style.setProperty('--boss-ratio', boss.ratio.toFixed(3)); item.style.setProperty('--boss-accent', boss.accent);
    item.innerHTML = '<span></span><b></b>';
    item.firstElementChild.textContent = boss.label; item.lastElementChild.textContent = `${Math.round(boss.ratio * 100)}%`;
    return item;
  }), ...(rest.length > 3 ? [Object.assign(document.createElement('li'), { className: 'boss-bar__more', textContent: `+${rest.length - 3}` })] : []));
  const announcement = root.querySelector('#boss-announcement');
  if (appeared || switched) announcement.textContent = `Chefe: ${primary.label}.`;
  else if (fury && !furyAnnounced.has(primary.id)) announcement.textContent = `${primary.label} em fúria.`;
  if (fury) furyAnnounced.add(primary.id);
}

function update(detail) {
  const now = performance.now(), bosses = normalizeBosses(detail), alive = new Set(bosses.map(boss => boss.id));
  for (const id of [...known.keys()]) if (!alive.has(id)) { known.delete(id); furyAnnounced.delete(id); }
  for (const boss of bosses) {
    const entry = known.get(boss.id);
    if (!entry) known.set(boss.id, { health: boss.health, damagedAt: 0, seenAt: now });
    else { if (boss.health < entry.health - 1e-6) entry.damagedAt = now; entry.health = boss.health; }
  }
  render(bosses, now);
}

if (root) {
  setBossWorldPlateMode('pip');
  window.addEventListener('bipx:boss-state', event => update(event.detail));
}
