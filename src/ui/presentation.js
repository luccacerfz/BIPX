const menu = document.querySelector('#message');
const dialog = document.querySelector('#game-dialog');
const title = document.querySelector('#dialog-title');
const status = document.querySelector('#dialog-game-status');
const done = document.querySelector('#dialog-done');
const quality = document.querySelector('#quality-select');
const motion = document.querySelector('#motion-toggle');
const contrast = document.querySelector('#contrast-toggle');
const sound = document.querySelector('#sound-toggle');
const audio = document.querySelector('#audio-toggle');
const hint = document.querySelector('#first-run-hint');
const characterPicker = document.querySelector('#character-picker');
const characterStatus = document.querySelector('#character-status');
const characterRetry = document.querySelector('#character-retry-button');
const characterInputs = [...characterPicker.querySelectorAll('input[name="character"]')];
const startButtons = [document.querySelector('#play-button'), document.querySelector('#multiplayer-button')];
let dialogOpener = null;
let ownsPause = false;
let hintTimeout;
let characterRequestPending = false;
let requestedCharacter = null;
let characterLoadError = null;

function readPreference(key, fallback = null) {
  try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; }
}
function savePreference(key, value) {
  try { localStorage.setItem(key, String(value)); } catch { /* Private storage may be unavailable. */ }
}
function presentation() { return window.__bipxPresentation; }
function inGame() { return menu.classList.contains('is-hidden'); }

function characters() { return window.__bipxCharacters; }
function selectedCharacterReady() {
  const state = characters()?.getState();
  return Boolean(state && !state.loading && !characterRequestPending && state.characters?.some((character) => character.id === state.selected && character.ready));
}
function startupWarmupRunning() {
  const status = window.__zombieNightDebug?.getStartupWarmup?.().status;
  return status === 'running' || status === 'failed';
}
function startupWarmupFailed() {
  return window.__zombieNightDebug?.getStartupWarmup?.().status === 'failed';
}
function setCharacterStartAvailability(ready) {
  const warmupStatus = window.__zombieNightDebug?.getStartupWarmup?.().status;
  const blockedByWarmup = warmupStatus === 'running';
  for (const button of startButtons) {
    // A failed preparation has an explicit solo reload affordance even when
    // the last character selection is not ready; multiplayer stays blocked.
    button.disabled = warmupStatus === 'failed'
      ? button.id !== 'play-button'
      : !ready || blockedByWarmup;
  }
}
function syncCharacters() {
  const state = characters()?.getState();
  if (!state) {
    characterPicker.disabled = true;
    characterPicker.setAttribute('aria-busy', 'true');
    setCharacterStartAvailability(false);
    characterStatus.dataset.state = 'loading';
    characterStatus.textContent = 'Preparando personagens…';
    return;
  }
  const loading = Boolean(state.loading || characterRequestPending);
  characterPicker.disabled = loading || inGame();
  characterPicker.setAttribute('aria-busy', String(loading));
  for (const input of characterInputs) {
    input.checked = input.value === state.selected;
    const character = state.characters?.find((entry) => entry.id === input.value);
    if (!character) continue;
    if (character.name) document.querySelector(`#character-${input.value}-name`).title = character.name;
    for (const field of ['weapon', 'description']) {
      if (character[field]) document.querySelector(`#character-${input.value}-${field}`).textContent = character[field];
    }
  }
  const selected = state.characters?.find((character) => character.id === state.selected);
  const ready = selectedCharacterReady();
  const preserveCharacterError = !loading && Boolean(characterLoadError) && characterStatus.dataset.state === 'error';
  setCharacterStartAvailability(ready);
  characterRetry.hidden = loading || (ready && !preserveCharacterError);
  characterStatus.dataset.state = loading ? 'loading' : preserveCharacterError ? 'error' : ready ? 'ready' : 'error';
  characterStatus.textContent = loading
    ? 'Carregando seu sobrevivente…'
    : preserveCharacterError
      ? characterLoadError
    : ready
      ? `${selected.name} ${state.selected === 'dwarf' ? 'pronta' : 'pronto'} para a noite.`
      : 'O personagem ainda não está pronto. Tente carregar novamente.';
}
async function selectCharacter(id) {
  if (!characters() || characterRequestPending || inGame()) return;
  const restoreRadioFocus = characterPicker.contains(document.activeElement);
  requestedCharacter = id;
  characterLoadError = null;
  characterRequestPending = true;
  syncCharacters();
  let succeeded = false;
  try { succeeded = await characters().select(id); }
  catch { /* Keep the current character and offer an explicit retry. */ }
  finally {
    characterRequestPending = false;
    syncCharacters();
    if (restoreRadioFocus && !inGame() && !characterPicker.disabled) characterInputs.find((input) => input.checked)?.focus();
  }
  if (succeeded) characterLoadError = null;
  if (!succeeded) {
    characterLoadError = 'Não foi possível carregar esse personagem. Tente novamente.';
    characterStatus.dataset.state = 'error';
    characterStatus.textContent = characterLoadError;
    characterRetry.hidden = false;
  }
  return succeeded;
}
for (const input of characterInputs) {
  input.addEventListener('change', () => { if (input.checked) void selectCharacter(input.value); });
}
characterRetry.addEventListener('click', () => void selectCharacter(requestedCharacter || characters()?.getState().selected || 'warrior'));
window.addEventListener('bipx:character-change', syncCharacters);
window.addEventListener('bipx:startup-warmup-state', syncCharacters);
for (const button of startButtons) {
  button.addEventListener('click', (event) => {
    if (button.id === 'play-button' && startupWarmupFailed()) return;
    if (!selectedCharacterReady()) { event.preventDefault(); event.stopImmediatePropagation(); syncCharacters(); }
  }, true);
}

function syncSettings() {
  const settings = presentation()?.getSettings();
  if (settings) {
    quality.value = settings.quality;
    motion.checked = settings.reducedMotion;
    document.documentElement.dataset.reducedMotion = String(settings.reducedMotion);
    if (dialog.open && inGame()) {
      status.hidden = false;
      status.textContent = settings.paused ? 'Partida pausada. Respire. A noite pode esperar.' : settings.canPause ? 'A noite continua.' : 'Partida online: a horda continua enquanto você ajusta as opções.';
      done.textContent = 'Voltar à partida';
    }
  }
  sound.checked = audio.getAttribute('aria-pressed') !== 'true';
}

function selectTab(tab) {
  for (const name of ['settings', 'controls']) {
    document.querySelector(`#${name}-tab`).setAttribute('aria-pressed', String(name === tab));
    document.querySelector(`#${name}-content`).hidden = name !== tab;
  }
  title.textContent = tab === 'controls' ? 'Como sobreviver' : inGame() ? 'Uma pausa na noite' : 'Sua experiência';
}

function openDialog(tab = 'settings', opener = document.activeElement) {
  dialogOpener = opener;
  ownsPause = false;
  if (inGame() && presentation()) {
    const before = presentation().getSettings();
    // Closing this player-requested panel also resumes a solo run paused by window blur.
    ownsPause = before.canPause;
    if (ownsPause) presentation().setPaused(true);
  }
  selectTab(tab);
  status.hidden = !inGame();
  done.textContent = inGame() ? 'Voltar à partida' : 'Concluído';
  dialog.showModal();
  syncSettings();
  document.querySelector('#dialog-close').focus();
}

function closeDialog() {
  if (!dialog.open) return;
  dialog.close();
}

dialog.addEventListener('close', () => {
  if (ownsPause) presentation()?.setPaused(false);
  ownsPause = false;
  if (inGame()) document.querySelector('#game-canvas').focus({ preventScroll: true });
  else if (dialogOpener?.isConnected && dialogOpener.getClientRects().length) dialogOpener.focus();
});
dialog.addEventListener('cancel', (event) => { event.preventDefault(); closeDialog(); });
document.querySelector('#menu-help-button').addEventListener('click', (event) => openDialog('controls', event.currentTarget));
document.querySelector('#menu-settings-button').addEventListener('click', (event) => openDialog('settings', event.currentTarget));
document.querySelector('#pause-button').addEventListener('click', (event) => openDialog('settings', event.currentTarget));
document.querySelector('#dialog-close').addEventListener('click', closeDialog);
done.addEventListener('click', closeDialog);
document.querySelector('#settings-tab').addEventListener('click', () => selectTab('settings'));
document.querySelector('#controls-tab').addEventListener('click', () => selectTab('controls'));

quality.addEventListener('change', () => { presentation()?.setQuality(quality.value); syncSettings(); });
motion.addEventListener('change', () => {
  presentation()?.setReducedMotion(motion.checked);
  document.documentElement.dataset.reducedMotion = String(motion.checked);
});
contrast.checked = readPreference('bipx-ui-high-contrast', 'false') === 'true';
document.documentElement.dataset.highContrast = String(contrast.checked);
contrast.addEventListener('change', () => {
  document.documentElement.dataset.highContrast = String(contrast.checked);
  savePreference('bipx-ui-high-contrast', contrast.checked);
});
sound.addEventListener('change', () => {
  const enabled = audio.getAttribute('aria-pressed') !== 'true';
  if (sound.checked !== enabled) audio.click();
  syncSettings();
});
new MutationObserver(syncSettings).observe(audio, { attributes: true, attributeFilter: ['aria-pressed'] });
window.addEventListener('bipx:presentation-change', syncSettings);

// Intercept menu shortcuts before the game window listener. Native button activation still runs.
window.addEventListener('keydown', (event) => {
  if (event.code === 'Escape') {
    event.preventDefault();
    event.stopImmediatePropagation();
    if (dialog.open) closeDialog();
    else if (inGame()) openDialog('settings', document.querySelector('#pause-button'));
    else if (menu.classList.contains('message--ranking')) document.querySelector('#ranking-back-button').click();
    else if (menu.classList.contains('message--login')) document.querySelector('#login-back-button').click();
    return;
  }
  if (dialog.open) {
    event.stopImmediatePropagation();
    return;
  }
  if (!inGame()) {
    if (event.target instanceof Element && event.target.closest('#character-picker')) {
      // Native radio arrows and Space continue to work; combat shortcuts stay inactive.
      event.stopImmediatePropagation();
      return;
    }
    if (event.code === 'Enter' && menu.classList.contains('message--login') && !selectedCharacterReady()) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
    if (event.target instanceof HTMLButtonElement && ['Enter', 'Space'].includes(event.code)) {
      event.stopImmediatePropagation();
      return;
    }
    if (event.code === 'Enter' && !menu.classList.contains('message--login') && !menu.classList.contains('message--ranking')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      document.querySelector('#open-login-button').click();
    }
  }
}, true);

function hideHint() {
  hint.hidden = true;
  clearTimeout(hintTimeout);
  savePreference('bipx-controls-seen', 'true');
}
hint.querySelector('button').addEventListener('click', hideHint);
new MutationObserver(() => {
  syncCharacters();
  if (!inGame()) {
    hint.hidden = true;
    clearTimeout(hintTimeout);
    if (dialog.open) closeDialog();
    return;
  }
  if (dialog.open) closeDialog();
  if (readPreference('bipx-controls-seen') !== 'true') {
    hint.hidden = false;
    clearTimeout(hintTimeout);
    hintTimeout = setTimeout(hideHint, 14000);
  }
}).observe(menu, { attributes: true, attributeFilter: ['class'] });

// Load order can vary because the engine imports the Three.js module graph.
function connectEngine(attempt = 0) {
  if (presentation()) { syncSettings(); return; }
  if (attempt < 200) setTimeout(() => connectEngine(attempt + 1), 100);
}
connectEngine();

function connectCharacters(attempt = 0) {
  syncCharacters();
  if (characters()) return;
  if (attempt < 200) setTimeout(() => connectCharacters(attempt + 1), 100);
}
connectCharacters();

// A native disclosure keeps live rankings available without covering the arena.
const liveRanking = document.querySelector('details.leaderboard-panel');
liveRanking?.addEventListener('mousedown', (event) => event.stopPropagation());
liveRanking?.addEventListener('mousemove', (event) => event.stopPropagation());
liveRanking?.addEventListener('keydown', (event) => {
  if (['Space', 'Enter'].includes(event.code)) event.stopPropagation();
});
