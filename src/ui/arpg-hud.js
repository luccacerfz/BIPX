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
      ? { id: value.relic.id.slice(0, 24), label: label(value.relic.label, 'Relíquia'), name: label(value.relic.name, 'Relíquia'), remaining: value.relic.remaining } : null,
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
function orb(kind, name) {
  return `<div class="arpg-orb arpg-orb--${kind}" id="arpg-${kind}" role="meter" aria-label="${name}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" aria-valuetext="Aguardando estado">
    <div class="arpg-orb__rim"><div class="arpg-orb__glass"><div class="arpg-orb__liquid"></div><div class="arpg-orb__reflection"></div><strong class="arpg-orb__value">—<small>/ —</small></strong></div></div>
    <span class="arpg-orb__label">${name}</span></div>`;
}

function mount() {
  root = document.querySelector('#arpg-hud');
  if (!root) return;
  root.innerHTML = `${orb('health', 'Vida')}<div class="arpg-actionbar">
    <div class="arpg-actionbar__heading"><span class="arpg-class">Sobrevivente</span><span class="arpg-run-status">Aguardando estado</span></div>
    <div class="arpg-actions"><div class="arpg-basic" aria-label="Ataque básico"><span class="arpg-basic__icon">${icon('blade')}</span><span class="arpg-basic__name">Arma</span><small>Mouse / Espaço</small></div>
    ${[0, 1, 2].map((slot) => `<button type="button" class="arpg-skill" data-arpg-slot="${slot}" data-state="waiting" aria-disabled="true" aria-keyshortcuts="${slot + 1}" aria-describedby="arpg-tooltip">
      <kbd class="arpg-skill__key">${slot + 1}</kbd><span class="arpg-skill__art">${icon('unknown')}</span><span class="arpg-skill__mask" aria-hidden="true"></span><span class="arpg-skill__timer" aria-hidden="true"></span><span class="arpg-skill__cost" aria-hidden="true">—</span><span class="sr-only arpg-skill__name">Habilidade ${slot + 1}</span>
    </button>`).join('')}</div><span class="arpg-actionbar__hint">Habilidades</span></div>${orb('resource', 'Recurso')}
    <div id="arpg-statuses" class="arpg-statuses" role="list" aria-label="Efeitos ativos" hidden></div>
    <div class="arpg-tooltip" id="arpg-tooltip" role="tooltip" hidden><strong></strong><span class="arpg-tooltip__description"></span><span class="arpg-tooltip__meta"></span><span class="arpg-tooltip__upgrades" hidden></span><span class="arpg-tooltip__effect" hidden></span><span class="arpg-tooltip__state"></span></div>
    <span id="arpg-announcement" class="sr-only" role="status" aria-live="polite" aria-atomic="true"></span>`;
  root.addEventListener('mousemove', (event) => event.stopPropagation());
  root.addEventListener('mousedown', (event) => event.stopPropagation());
  for (const button of root.querySelectorAll('[data-arpg-slot]')) {
    const slot = Number(button.dataset.arpgSlot);
    let secondaryTouch = null;
    let suppressTouchClick = false;
    const activate = (pointer) => {
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
  if (upgrades) observer.observe(upgrades, { attributes: true, attributeFilter: ['class'] });
  if (dialog) observer.observe(dialog, { attributes: true, attributeFilter: ['open'] });
  render();
  window.dispatchEvent(new CustomEvent('bipx:arpg-ready'));
}

function updateOrb(kind, value, max, name) {
  const element = root.querySelector(`#arpg-${kind}`);
  const known = snapshot !== null;
  element.style.setProperty('--orb-fill', `${known ? value / max * 100 : 0}%`);
  element.setAttribute('aria-label', name);
  element.setAttribute('aria-valuemax', known ? max : 100);
  element.setAttribute('aria-valuenow', known ? value : 0);
  element.setAttribute('aria-valuetext', known ? `${number(value)} de ${number(max)}` : 'Aguardando estado');
  element.querySelector('.arpg-orb__value').innerHTML = known ? `${number(value)}<small>/ ${number(max)}</small>` : '—<small>/ —</small>';
  element.querySelector('.arpg-orb__label').textContent = name;
  element.dataset.low = String(known && value / max <= .25);
}

function render() {
  root.hidden = !inGame();
  root.dataset.connected = String(Boolean(snapshot));
  root.dataset.class = snapshot?.classId ?? '';
  document.documentElement.dataset.arpgConnected = String(Boolean(snapshot));
  updateOrb('health', snapshot?.health, snapshot?.maxHealth, 'Vida');
  updateOrb('resource', snapshot?.resource, snapshot?.maxResource, snapshot?.resourceLabel ?? 'Recurso');
  root.querySelector('.arpg-class').textContent = snapshot ? snapshot.classId === 'warrior' ? 'Aldric' : 'Lyra' : 'Sobrevivente';
  root.querySelector('.arpg-run-status').textContent = !snapshot ? 'Aguardando estado' : snapshot.dead ? 'Derrotado' : snapshot.paused || dialog?.open ? 'Em pausa' : choosingUpgrade() ? 'Evolução' : '';
  const relic = snapshot && !snapshot.dead ? snapshot.relic : null;
  root.querySelector('.arpg-basic__name').textContent = relic ? relic.label : snapshot?.weapon ?? 'Arma';
  root.querySelector('.arpg-basic').dataset.relic = relic ? relic.id : '';
  root.querySelector('.arpg-basic small').textContent = relic ? `${Math.ceil(relic.remaining)}s` : 'Mouse / Espaço';
  const weaponId = snapshot?.classId === 'dwarf' ? 'rifle' : 'blade';
  setIconHref(root.querySelector('.arpg-basic use'), `./assets/ui/arpg/icons.svg#${weaponId}`);
  root.querySelector('.arpg-basic').setAttribute('aria-label', `${snapshot?.weapon ?? 'Arma básica'}${relic ? `, relíquia ${relic.name}, ${Math.ceil(relic.remaining)} segundos` : ''}. Ataque básico: mouse ou Espaço; no toque, controle direito.`);
  // Keep the upper weapon/buff status accurate for both classes.
  setIconHref(document.querySelector('.hud__stat--weapon use'), `#icon-${weaponId}`);
  for (const button of root.querySelectorAll('[data-arpg-slot]')) {
    const slot = Number(button.dataset.arpgSlot);
    const skill = snapshot?.skills[slot];
    const [state, reason] = availability(skill);
    const [art, element] = skillArt[skill?.id] ?? ['unknown', 'unknown'];
    button.dataset.state = state;
    button.dataset.element = element;
    button.setAttribute('aria-disabled', String(state !== 'ready'));
    const name = skill?.name ?? `Habilidade ${slot + 1}`;
    button.setAttribute('aria-label', `${slot + 1}: ${name}. ${skill ? `Custo ${number(skill.cost)} de ${snapshot.resourceLabel}. ` : ''}${reason}.`);
    button.querySelector('.arpg-skill__name').textContent = name;
    setIconHref(button.querySelector('use'), `./assets/ui/arpg/icons.svg#${art}`);
    button.querySelector('.arpg-skill__key').textContent = skill?.key ?? String(slot + 1);
    button.querySelector('.arpg-skill__cost').textContent = skill ? number(skill.cost) : '—';
    button.querySelector('.arpg-skill__timer').textContent = state === 'cooldown' ? `${Math.ceil(skill.cooldownRemaining)}s` : state === 'resource' ? '×' : state === 'waiting' ? '—' : state === 'upgrade' ? '◆' : state !== 'ready' ? 'Ⅱ' : '';
    const ratio = skill?.cooldownRemaining > 0 ? Math.min(1, skill.cooldownRemaining / (skill.cooldownDuration || skill.cooldownRemaining)) : 0;
    button.style.setProperty('--cooldown-angle', `${ratio * 360}deg`);
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
  effect.textContent = status ? `Efeito ativo: ${Math.ceil(status.remaining)}s${status.description ? ` · ${status.description}` : ''}` : '';
}

function requestSkill(slot) {
  const skill = snapshot?.skills[slot];
  const [state, reason] = availability(skill);
  if (state !== 'ready') {
    root.querySelector('#arpg-announcement').textContent = `${skill?.name ?? 'Habilidade'}: ${reason}.`;
    if (!['cooldown', 'resource'].includes(state)) return;
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

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true });
else mount();
