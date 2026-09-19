// Presentation only: snapshots belong to Combat; requests never mutate gameplay.
const skillArt = {
  warrior_war_cry: ['war-cry', 'fervor', 'Grito', 'Fortalece o guerreiro por um tempo limitado.'],
  warrior_cleaving_dash: ['cleaving-dash', 'steel', 'Avanço cortante', 'Avança na direção da mira, cortando os inimigos no caminho.'],
  warrior_shield_charge: ['shield-charge', 'shield', 'Escudo', 'Investe com o escudo e atordoa os inimigos atingidos.'],
  dwarf_explosive_cannon: ['explosive-cannon', 'fire', 'Canhão de fogo', 'Dispara uma carga de fogo que explode e causa dano em área.'],
  dwarf_frost_shot: ['frost-shot', 'frost', 'Congelamento', 'Dispara gelo e congela os inimigos na área de impacto.'],
  dwarf_gravity_shot: ['gravity-shot', 'arcane', 'Gravidade', 'Deixa um campo no impacto que atrai os inimigos próximos.'],
};
const classSkills = {
  warrior: ['warrior_war_cry', 'warrior_cleaving_dash', 'warrior_shield_charge'],
  dwarf: ['dwarf_explosive_cannon', 'dwarf_frost_shot', 'dwarf_gravity_shot'],
};
// Relics with their own glyph in index.html (#relic-<id>); anything else falls back to #relic-generic.
const relicGlyphs = new Set(['flamethrower', 'axe', 'katana', 'crossbow', 'talisman', 'thunderstaff', 'boneCannon', 'frostNova']);
const LOW_HEALTH = .35, CRITICAL_HEALTH = .15; // the screen-edge alarm belongs to the engine; the orb carries the same two steps
const HAND_ENTER_MS = 320, HAND_EXIT_GUARD_MS = 350;
const nonnegative = (value) => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const label = (value, fallback, limit = 100) => typeof value === 'string' && value.trim() ? value.trim().slice(0, limit) : fallback;
const number = (value) => Math.ceil(value).toLocaleString('pt-BR');
function statusDescription(status) {
  const modifiers = [['damageMultiplier', 'Dano'], ['speedMultiplier', 'Movimento']]
    .filter(([key]) => nonnegative(status[key]))
    .map(([key, name]) => { const percent = Math.round((status[key] - 1) * 100); return `${name} ${percent >= 0 ? '+' : ''}${percent}%`; });
  return label(status.description, modifiers.join(' · '));
}
let snapshot = null;
let root;
let activeSlot = null;
let statusSignature = '';
let relicSpan = { id: '', duration: 0 }; // longest remaining seen for the active relic when Combat sends no duration
let lastHealthRatio = null;
let criticalAnnouncedAt = -Infinity;
let handClosedAt = -Infinity;
let handEnterTimer = 0;
const slotStates = ['waiting', 'waiting', 'waiting'];
const touchLayout = typeof matchMedia === 'function' ? matchMedia('(pointer: coarse), (max-width: 680px)') : { matches: false };

// Subscribe first: a synchronous publisher responding to arpg-ready cannot be missed.
window.addEventListener('bipx:arpg-state', (event) => {
  snapshot = normalizeSnapshot(event.detail);
  if (root) render();
});

export function normalizeSnapshot(value) {
  if (!value || !Object.hasOwn(classSkills, value.classId)
    || !['health', 'maxHealth', 'resource', 'maxResource'].every((key) => nonnegative(value[key]))
    || value.maxHealth <= 0 || value.maxResource <= 0
    || typeof value.dead !== 'boolean' || typeof value.paused !== 'boolean') return null;
  const expected = classSkills[value.classId];
  return {
    classId: value.classId,
    health: Math.min(value.health, value.maxHealth), maxHealth: value.maxHealth,
    resource: Math.min(value.resource, value.maxResource), maxResource: value.maxResource,
    resourceLabel: label(value.resourceLabel, 'Recurso'),
    weapon: label(value.weapon, 'Arma básica'),
    // Temporary relic infusing the basic attack (trusted combat state; presentation only).
    relic: value.relic && typeof value.relic.id === 'string' && nonnegative(value.relic.remaining) && value.relic.remaining > 0
      ? { id: value.relic.id.slice(0, 24), label: label(value.relic.label, 'Relíquia'), name: label(value.relic.name, 'Relíquia'), remaining: value.relic.remaining,
        duration: nonnegative(value.relic.duration) && value.relic.duration > 0 ? Math.max(value.relic.duration, value.relic.remaining) : 0 } : null,
    dead: value.dead, paused: value.paused,
    statuses: !value.dead && Array.isArray(value.statuses) ? value.statuses
      .filter(status => status && expected.includes(status.skillId ?? status.id) && typeof status.id === 'string'
        && nonnegative(status.remaining) && status.remaining > 0 && nonnegative(status.duration) && status.duration > 0)
      .map(status => ({ id: status.id.slice(0, 100), skillId: status.skillId ?? status.id,
        label: label(status.label ?? status.name, 'Efeito ativo'), remaining: Math.min(status.remaining, status.duration), duration: status.duration,
        description: statusDescription(status) })) : [],
    skills: expected.map((id, slot) => {
      const skill = Array.isArray(value.skills) ? value.skills.find((entry) => entry?.slot === slot && entry.id === id) : null;
      if (!skill || !['cost', 'cooldownRemaining', 'cooldownDuration'].every((key) => nonnegative(skill[key]))) return null;
      return { id, slot, name: label(skill.name, `Habilidade ${slot + 1}`), key: label(skill.key, String(slot + 1)),
        cost: skill.cost, cooldownRemaining: skill.cooldownRemaining, cooldownDuration: skill.cooldownDuration,
        // Upgraded numbers lengthen the authoritative text (e.g. "6,4 m por 9,5 s"); never cut it mid-sentence.
        enabled: skill.enabled === true, description: label(skill.description, skillArt[id][3], 180),
        upgrades: Array.isArray(skill.upgrades) ? skill.upgrades.filter(entry => entry && typeof entry.label === 'string' && nonnegative(entry.stacks) && entry.stacks > 0 && nonnegative(entry.maxStacks))
          .slice(0, 8).map(entry => ({ label: label(entry.label, 'Evolução', 40), stacks: Math.floor(entry.stacks), maxStacks: Math.floor(entry.maxStacks) })) : [] };
    }),
  };
}

const menu = document.querySelector('#message');
const dialog = document.querySelector('#game-dialog');
const upgrades = document.querySelector('#upgrade-panel');
const inGame = () => menu?.classList.contains('is-hidden');
const choosingUpgrade = () => upgrades && !upgrades.classList.contains('is-hidden');

function availability(skill) {
  if (!snapshot || !skill) return ['waiting', 'Aguardando estado'];
  if (snapshot.dead) return ['dead', 'Derrotado'];
  if (snapshot.paused || dialog?.open) return ['paused', 'Em pausa'];
  if (!inGame()) return ['waiting', 'Fora da partida'];
  if (choosingUpgrade()) return ['upgrade', 'Escolha uma evolução'];
  if (skill.cooldownRemaining > 0) return ['cooldown', `${skill.cooldownRemaining.toFixed(1).replace('.', ',')} s de recarga`];
  if (snapshot.resource < skill.cost) return ['resource', `${snapshot.resourceLabel} insuficiente`];
  if (!skill.enabled) return ['unavailable', 'Indisponível'];
  return ['ready', 'Pronta'];
}

function icon(id, className = '') {
  return `<svg class="arpg-icon ${className}" viewBox="0 0 64 64" aria-hidden="true"><use href="./assets/ui/arpg/icons.svg#${id}"/></svg>`;
}
function setIconHref(element, href) {
  // Reassigning the same external href makes Chromium request the sprite again.
  if (element && element.getAttribute('href') !== href) element.setAttribute('href', href);
}
function setText(element, text) { if (element && element.textContent !== text) element.textContent = text; }
// Relic glyphs are copied from the page's <symbol> set instead of referenced: the action bar keeps exactly its four <use> icons.
function setGlyph(svg, id) {
  if (!svg || svg.dataset.glyph === id) return;
  svg.dataset.glyph = id;
  svg.innerHTML = (document.getElementById(id) ?? document.getElementById('relic-generic'))?.innerHTML ?? '';
}
function orb(kind, name) {
  return `<div class="arpg-orb arpg-orb--${kind}" id="arpg-${kind}" role="meter" aria-label="${name}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" aria-valuetext="Aguardando estado">
    <div class="arpg-orb__rim"><div class="arpg-orb__glass"><div class="arpg-orb__lag"></div><div class="arpg-orb__liquid"></div><div class="arpg-orb__reflection"></div><strong class="arpg-orb__value">—<small>/ —</small></strong></div></div>
    <span class="arpg-orb__label">${name}</span></div>`;
}
// A transient state class that always restarts its CSS animation.
function pulse(element, className, duration) {
  if (!element) return;
  element.classList.remove(className);
  void element.offsetWidth;
  element.classList.add(className);
  clearTimeout(element[`_${className}`]);
  element[`_${className}`] = setTimeout(() => element.classList.remove(className), duration);
}

function mount() {
  root = document.querySelector('#arpg-hud');
  if (!root) return;
  root.innerHTML = `${orb('health', 'Vida')}<div class="arpg-actionbar">
    <div class="arpg-actionbar__heading"><span class="arpg-class">Sobrevivente</span><span class="arpg-progress-dock"></span><span class="arpg-run-status">Aguardando estado</span></div>
    <div class="arpg-actions"><div class="arpg-basic" aria-label="Ataque básico"><span class="arpg-basic__icon"><span class="arpg-basic__ring" aria-hidden="true"></span>${icon('blade')}<svg class="arpg-basic__relic" viewBox="0 0 24 24" aria-hidden="true"></svg></span><span class="arpg-basic__name">Arma</span><small>Mouse / Espaço</small></div>
    ${[0, 1, 2].map((slot) => `<button type="button" class="arpg-skill" data-arpg-slot="${slot}" data-state="waiting" aria-disabled="true" aria-keyshortcuts="${slot + 1}" aria-describedby="arpg-tooltip">
      <kbd class="arpg-skill__key">${slot + 1}</kbd><span class="arpg-skill__art">${icon('unknown')}</span><span class="arpg-skill__mask" aria-hidden="true"></span><span class="arpg-skill__timer" aria-hidden="true"></span><span class="arpg-skill__cost" aria-hidden="true">—</span><span class="sr-only arpg-skill__name">Habilidade ${slot + 1}</span>
    </button>`).join('')}</div><span class="arpg-actionbar__hint">Habilidades</span></div>${orb('resource', 'Recurso')}
    <div id="arpg-statuses" class="arpg-statuses" role="list" aria-label="Efeitos ativos" hidden></div>
    <div class="arpg-tooltip" id="arpg-tooltip" role="tooltip" hidden><strong></strong><span class="arpg-tooltip__description"></span><span class="arpg-tooltip__meta"></span><span class="arpg-tooltip__upgrades" hidden></span><span class="arpg-tooltip__effect" hidden></span><span class="arpg-tooltip__state"></span></div>
    <span id="arpg-announcement" class="sr-only" role="status" aria-live="polite" aria-atomic="true"></span>`;
  // Level and XP leave the top strip and dock on the action bar. The engine keeps writing to the very same nodes.
  const progress = document.querySelector('.survivor-hud__progress');
  if (progress) { root.querySelector('.arpg-progress-dock').append(progress); progress.classList.add('is-docked'); }
  root.addEventListener('mousemove', (event) => event.stopPropagation());
  root.addEventListener('mousedown', (event) => event.stopPropagation());
  for (const button of root.querySelectorAll('[data-arpg-slot]')) {
    const slot = Number(button.dataset.arpgSlot);
    let secondaryTouch = null;
    let suppressTouchClick = false;
    const activate = (pointer) => {
      // A card that closed under the finger must not also fire the skill that was hidden beneath it.
      if (pointer && performance.now() - handClosedAt < HAND_EXIT_GUARD_MS) return;
      requestSkill(slot);
      if (pointer) {
        document.querySelector('#game-canvas')?.focus({ preventScroll: true });
        // Casting returns attention to the arena; help is intentional hover/focus.
        hideTooltip();
      } else showTooltip(slot);
    };
    button.addEventListener('pointerdown', (event) => {
      suppressTouchClick = false;
      secondaryTouch = event.pointerType === 'touch' && !event.isPrimary ? { id: event.pointerId, x: event.clientX, y: event.clientY } : null;
    });
    button.addEventListener('pointercancel', () => { secondaryTouch = null; });
    button.addEventListener('pointerup', (event) => {
      if (!secondaryTouch || secondaryTouch.id !== event.pointerId) return;
      const start = secondaryTouch; secondaryTouch = null;
      const rect = button.getBoundingClientRect();
      if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > 12
        || event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) return;
      // Secondary touches need not generate click while a joystick owns the primary touch.
      // Suppress any compatibility click; a new pointerdown resets this fence.
      event.preventDefault();
      suppressTouchClick = true;
      activate(true);
    });
    button.addEventListener('pointerenter', (event) => { if (event.pointerType !== 'touch') showTooltip(slot); });
    button.addEventListener('pointerleave', () => { if (document.activeElement !== button) hideTooltip(); });
    button.addEventListener('focus', () => showTooltip(slot));
    button.addEventListener('blur', hideTooltip);
    button.addEventListener('click', (event) => {
      if (suppressTouchClick && event.detail > 0) { suppressTouchClick = false; return; }
      activate(event.detail > 0);
    });
  }
  const observer = new MutationObserver(() => { if (!inGame()) hideTooltip(); render(); });
  if (menu) observer.observe(menu, { attributes: true, attributeFilter: ['class'] });
  if (dialog) observer.observe(dialog, { attributes: true, attributeFilter: ['open'] });
  if (upgrades) {
    let handOpen = choosingUpgrade();
    new MutationObserver(() => {
      const open = choosingUpgrade();
      if (open && !handOpen) {
        // Entry animation and tap guard run once per offer (upgrade-hand.css); re-renders of an open hand stay still.
        upgrades.dataset.entering = 'true';
        clearTimeout(handEnterTimer);
        handEnterTimer = setTimeout(() => { delete upgrades.dataset.entering; }, HAND_ENTER_MS);
      } else if (!open && handOpen) { handClosedAt = performance.now(); clearTimeout(handEnterTimer); delete upgrades.dataset.entering; }
      handOpen = open;
      hideTooltip(); render();
    }).observe(upgrades, { attributes: true, attributeFilter: ['class'] });
  }
  render();
  window.dispatchEvent(new CustomEvent('bipx:arpg-ready'));
}

function updateOrb(kind, value, max, name) {
  const element = root.querySelector(`#arpg-${kind}`);
  const known = snapshot !== null;
  const ratio = known ? value / max : 0;
  element.style.setProperty('--orb-fill', `${ratio * 100}%`);
  element.setAttribute('aria-label', name);
  element.setAttribute('aria-valuemax', known ? max : 100);
  element.setAttribute('aria-valuenow', known ? value : 0);
  const danger = kind === 'health' && known && !snapshot.dead ? ratio <= CRITICAL_HEALTH ? 'critical' : ratio <= LOW_HEALTH ? 'low' : '' : '';
  element.setAttribute('aria-valuetext', known ? `${number(value)} de ${number(max)}${danger === 'critical' ? ', vida crítica' : danger === 'low' ? ', vida baixa' : ''}` : 'Aguardando estado');
  const text = known ? `${number(value)}<small>/ ${number(max)}</small>` : '—<small>/ —</small>';
  const valueElement = element.querySelector('.arpg-orb__value');
  if (valueElement.dataset.text !== text) { valueElement.dataset.text = text; valueElement.innerHTML = text; }
  setText(element.querySelector('.arpg-orb__label'), name);
  element.dataset.low = String(known && ratio <= .25);
  if (kind !== 'health') return;
  element.dataset.danger = danger;
  root.dataset.danger = danger;
  if (known && lastHealthRatio !== null && !snapshot.dead) {
    if (ratio - lastHealthRatio >= .03) pulse(element, 'is-healed', 600);
    else if (lastHealthRatio - ratio >= .01) pulse(element, 'is-hurt', 320);
    if (danger === 'critical' && lastHealthRatio > CRITICAL_HEALTH && performance.now() - criticalAnnouncedAt > 10000) {
      criticalAnnouncedAt = performance.now();
      root.querySelector('#arpg-announcement').textContent = 'Vida crítica.';
    }
  }
  lastHealthRatio = known ? ratio : null;
}

function updateRelic(relic) {
  const basic = root.querySelector('.arpg-basic'), fire = document.querySelector('#touch-fire');
  if (relic) {
    if (relicSpan.id !== relic.id || relic.remaining > relicSpan.duration) relicSpan = { id: relic.id, duration: Math.max(relic.duration, relic.remaining) };
  } else relicSpan = { id: '', duration: 0 };
  const ratio = relic ? Math.max(0, Math.min(1, relic.remaining / (relic.duration || relicSpan.duration || relic.remaining))) : 0;
  const seconds = relic ? `${Math.ceil(relic.remaining)}` : '';
  basic.dataset.relic = relic ? relic.id : '';
  basic.dataset.relicEnding = String(Boolean(relic) && relic.remaining <= 5);
  basic.style.setProperty('--relic-ratio', ratio.toFixed(3));
  setText(root.querySelector('.arpg-basic__name'), relic ? relic.label : snapshot?.weapon ?? 'Arma');
  const small = root.querySelector('.arpg-basic small');
  const smallText = relic ? `<b>${seconds}</b><i>s</i>` : 'Mouse / Espaço';
  if (small.dataset.text !== smallText) { small.dataset.text = smallText; small.innerHTML = smallText; }
  const glyphId = `relic-${relic && relicGlyphs.has(relic.id) ? relic.id : 'generic'}`;
  if (relic) setGlyph(root.querySelector('.arpg-basic__relic'), glyphId);
  // On touch layouts the attack button is the basic attack: it carries the same ring, glyph and seconds.
  if (fire) {
    fire.dataset.relic = relic ? relic.id : '';
    fire.dataset.relicEnding = basic.dataset.relicEnding;
    if (relic) fire.dataset.relicTime = `${seconds}s`; else delete fire.dataset.relicTime;
    fire.style.setProperty('--relic-ratio', ratio.toFixed(3));
    let glyph = fire.querySelector('.touch-fire__relic');
    if (relic && !glyph) { fire.insertAdjacentHTML('beforeend', '<svg class="touch-fire__relic" viewBox="0 0 24 24" aria-hidden="true"></svg>'); glyph = fire.querySelector('.touch-fire__relic'); }
    if (relic) setGlyph(glyph, glyphId);
  }
}

function render() {
  root.hidden = !inGame();
  root.dataset.connected = String(Boolean(snapshot));
  root.dataset.class = snapshot?.classId ?? '';
  document.documentElement.dataset.arpgConnected = String(Boolean(snapshot));
  updateOrb('health', snapshot?.health, snapshot?.maxHealth, 'Vida');
  updateOrb('resource', snapshot?.resource, snapshot?.maxResource, snapshot?.resourceLabel ?? 'Recurso');
  setText(root.querySelector('.arpg-class'), snapshot ? snapshot.classId === 'warrior' ? 'Aldric' : 'Lyra' : 'Sobrevivente');
  const choosing = choosingUpgrade();
  setText(root.querySelector('.arpg-run-status'), !snapshot ? 'Aguardando estado' : snapshot.dead ? 'Derrotado' : snapshot.paused || dialog?.open ? 'Em pausa' : choosing ? touchLayout.matches ? 'Evolução · toque numa carta' : 'Evolução' : '');
  root.dataset.choosing = String(Boolean(snapshot) && choosing);
  const relic = snapshot && !snapshot.dead ? snapshot.relic : null;
  updateRelic(relic);
  const weaponId = snapshot?.classId === 'dwarf' ? 'rifle' : 'blade';
  setIconHref(root.querySelector('.arpg-basic .arpg-icon use'), `./assets/ui/arpg/icons.svg#${weaponId}`);
  root.querySelector('.arpg-basic').setAttribute('aria-label', `${snapshot?.weapon ?? 'Arma básica'}${relic ? `, relíquia ${relic.name}, ${Math.ceil(relic.remaining)} segundos` : ''}. Ataque básico: mouse ou Espaço; no toque, controle direito.`);
  // Keep the upper weapon/buff status accurate for both classes.
  setIconHref(document.querySelector('.hud__stat--weapon use'), `#icon-${weaponId}`);
  for (const button of root.querySelectorAll('[data-arpg-slot]')) {
    const slot = Number(button.dataset.arpgSlot);
    const skill = snapshot?.skills[slot];
    const [state, reason] = availability(skill);
    const [art, element] = skillArt[skill?.id] ?? ['unknown', 'unknown'];
    // "Pronta" is an event worth a glance: only a recharge or a refilled resource earns the ping, never a closed menu.
    if (state === 'ready' && ['cooldown', 'resource'].includes(slotStates[slot])) pulse(button, 'is-ready-ping', 520);
    slotStates[slot] = state;
    button.dataset.state = state;
    button.dataset.element = element;
    button.setAttribute('aria-disabled', String(state !== 'ready'));
    const name = skill?.name ?? `Habilidade ${slot + 1}`;
    button.setAttribute('aria-label', `${slot + 1}: ${name}. ${skill ? `Custo ${number(skill.cost)} de ${snapshot.resourceLabel}. ` : ''}${reason}.`);
    setText(button.querySelector('.arpg-skill__name'), name);
    setIconHref(button.querySelector('use'), `./assets/ui/arpg/icons.svg#${art}`);
    setText(button.querySelector('.arpg-skill__key'), skill?.key ?? String(slot + 1));
    setText(button.querySelector('.arpg-skill__cost'), skill ? number(skill.cost) : '—');
    const timer = button.querySelector('.arpg-skill__timer');
    const timerText = state === 'cooldown' ? `<b>${Math.ceil(skill.cooldownRemaining)}</b><i>s</i>` : state === 'waiting' ? '—' : state === 'upgrade' ? '◆' : ['ready', 'resource'].includes(state) ? '' : 'Ⅱ';
    if (timer.dataset.text !== timerText) { timer.dataset.text = timerText; timer.innerHTML = timerText; }
    const ratio = skill?.cooldownRemaining > 0 ? Math.min(1, skill.cooldownRemaining / (skill.cooldownDuration || skill.cooldownRemaining)) : 0;
    button.style.setProperty('--cooldown-angle', `${ratio * 360}deg`);
    // How much of the cost is already in the orb: the tint drains upward as the resource comes back.
    button.style.setProperty('--resource-ratio', (skill && skill.cost > 0 && snapshot ? Math.max(0, Math.min(1, snapshot.resource / skill.cost)) : 1).toFixed(3));
  }
  renderStatuses();
  if (activeSlot !== null) renderTooltip();
}

function renderStatuses() {
  const statuses = snapshot?.statuses ?? [];
  const signature = JSON.stringify(statuses.map(status => [status.id, status.skillId, status.label, Math.ceil(status.remaining), status.description]));
  if (signature === statusSignature) return;
  statusSignature = signature;
  const list = root.querySelector('#arpg-statuses');
  list.hidden = statuses.length === 0;
  const existing = new Map([...list.children].map(item => [item.dataset.statusId, item]));
  const currentIds = new Set(statuses.map(status => status.id));
  for (const [id, item] of existing) if (!currentIds.has(id)) item.remove();
  for (const status of statuses) {
    let item = existing.get(status.id);
    if (!item) {
      item = document.createElement('span');
      item.className = 'arpg-status';
      item.setAttribute('role', 'listitem');
      item.dataset.statusId = status.id;
      item.innerHTML = icon(skillArt[status.skillId][0]);
      item.append(document.createElement('span'));
      list.append(item);
    }
    setIconHref(item.querySelector('use'), `./assets/ui/arpg/icons.svg#${skillArt[status.skillId][0]}`);
    item.lastElementChild.textContent = `${status.label} · ${Math.ceil(status.remaining)}s`;
    item.style.setProperty('--status-ratio', Math.max(0, Math.min(1, status.remaining / status.duration)).toFixed(3));
    item.dataset.ending = String(status.remaining <= 3);
    const description = `${status.label}: ${Math.ceil(status.remaining)} segundos restantes.${status.description ? ` ${status.description}` : ''}`;
    item.setAttribute('aria-label', description);
    item.title = description;
  }
}

function showTooltip(slot) { activeSlot = slot; renderTooltip(); }
function hideTooltip() { activeSlot = null; if (root) root.querySelector('#arpg-tooltip').hidden = true; }
function renderTooltip() {
  const tooltip = root.querySelector('#arpg-tooltip');
  // Keyboard focus wins over a stationary pointer resting on another slot.
  const focused = document.activeElement?.closest?.('.arpg-skill');
  if (focused && root.contains(focused)) activeSlot = Number(focused.dataset.arpgSlot);
  const skill = snapshot?.skills[activeSlot];
  tooltip.hidden = !inGame() || dialog?.open || choosingUpgrade();
  tooltip.querySelector('strong').textContent = skill?.name ?? `Habilidade ${activeSlot + 1}`;
  tooltip.querySelector('.arpg-tooltip__description').textContent = skill?.description ?? '';
  tooltip.querySelector('.arpg-tooltip__meta').textContent = skill ? `${skillArt[skill.id][2]} · ${number(skill.cost)} de ${snapshot.resourceLabel} · Recarga ${skill.cooldownDuration.toLocaleString('pt-BR')} s` : 'Aguardando informações da habilidade';
  tooltip.querySelector('.arpg-tooltip__state').textContent = availability(skill)[1];
  // Owned class cards that change this skill; cost, recharge and the description above already show their numbers.
  const upgradesLine = tooltip.querySelector('.arpg-tooltip__upgrades');
  upgradesLine.hidden = !skill?.upgrades.length;
  upgradesLine.textContent = skill?.upgrades.length ? `Evoluções: ${skill.upgrades.map(entry => `${entry.label} ${entry.stacks}/${entry.maxStacks}`).join(' · ')}` : '';
  const status = snapshot?.statuses.find(item => item.skillId === skill?.id);
  const effect = tooltip.querySelector('.arpg-tooltip__effect');
  effect.hidden = !status;
  // The description above already says what the effect does; here only what is left of it (plus modifiers Combat reports).
  const extra = status?.description && status.description !== skill?.description && !skill?.description?.includes(status.description) ? ` · ${status.description}` : '';
  effect.textContent = status ? `Efeito ativo: ${Math.ceil(status.remaining)} s${extra}` : '';
}

function requestSkill(slot) {
  const skill = snapshot?.skills[slot];
  const [state, reason] = availability(skill);
  const button = root.querySelector(`[data-arpg-slot="${slot}"]`);
  pulse(button, 'is-pressed', 110);
  if (state !== 'ready') {
    root.querySelector('#arpg-announcement').textContent = `${skill?.name ?? 'Habilidade'}: ${reason}.`;
    if (!['cooldown', 'resource'].includes(state)) return;
    pulse(button, 'is-denied', 360);
    if (state === 'resource') pulse(root.querySelector('#arpg-resource'), 'is-short', 520);
  }
  window.dispatchEvent(new CustomEvent('bipx:skill-request', { detail: { slot } }));
}

window.addEventListener('keydown', (event) => {
  const key = /^(?:Digit|Numpad)([123])$/.exec(event.code);
  if (!root || !key || !inGame() || choosingUpgrade() || dialog?.open || event.altKey || event.ctrlKey || event.metaKey || event.isComposing) return;
  if (event.target instanceof Element && event.target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"]), dialog, [role="dialog"]')) return; // digits never activate a button natively
  event.preventDefault();
  event.stopImmediatePropagation();
  if (!event.repeat) requestSkill(Number(key[1]) - 1);
}, true);

touchLayout.addEventListener?.('change', () => { if (root) render(); });
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true });
else mount();
