const key = 'bipxPresentation';
export function loadPresentationPreferences() {
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(key) || '{}') || {}; } catch { /* Storage is optional. */ }
  return {
    quality: ['auto', 'high', 'medium', 'low'].includes(saved.quality) ? saved.quality : 'auto',
    reducedMotion: typeof saved.reducedMotion === 'boolean' ? saved.reducedMotion : matchMedia('(prefers-reduced-motion: reduce)').matches,
  };
}
export function savePresentationPreferences(preferences) {
  try { localStorage.setItem(key, JSON.stringify(preferences)); } catch { /* Private browsing can reject writes. */ }
}
