import { loadHeroVisual } from './character-library.js';

export const playableCharacters = Object.freeze({
  warrior: Object.freeze({ id: 'warrior', name: 'Aldric Leonguard', weapon: 'Espada', weaponId: 'katana', description: 'Golpes de espada em arco. Combate corpo a corpo, sem disparos.', height: 2.7 }),
  dwarf: Object.freeze({ id: 'dwarf', name: 'Lyra Brasswarden', weapon: 'Rifle', weaponId: 'pistol', description: 'Tiros de rifle à distância. Mire, dispare e mantenha espaço.', height: 2.55 }),
});

export function readCharacterPreference() {
  try { return playableCharacters[localStorage.getItem('bipx-character')] ? localStorage.getItem('bipx-character') : 'warrior'; }
  catch { return 'warrior'; }
}

export async function loadPlayableCharacter(id, options) {
  const profile = playableCharacters[id];
  if (!profile) throw new Error(`Unknown playable character: ${id}`);
  if (id === 'warrior') return loadHeroVisual({ ...options, height: profile.height });
  const { loadDwarfVisual } = await import('./dwarf-library.js');
  return loadDwarfVisual({ ...options, height: profile.height });
}
