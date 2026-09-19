// Small immutable signature for the transient values that upgrade cards show.
// Callers provide live state; this module never owns or mutates gameplay state.
export function upgradePreviewTransientSignature({ skillState = null, weaponTimer = 0, prismStormRemaining = 0 } = {}) {
  return Object.freeze({
    skill: Boolean(skillState?.buff?.remaining > 0),
    infusion: Number(weaponTimer) > 0,
    prism: Number(prismStormRemaining) > 0,
  });
}

export function upgradePreviewTransientChanged(previous, next) {
  if (!previous || !next) return true;
  return previous.skill !== next.skill || previous.infusion !== next.infusion || previous.prism !== next.prism;
}

// Shared decision used by solo ticks and authoritative multiplayer snapshots.
// Keeping this pure makes the real event handlers testable without importing
// the renderer or mutating a live player state.
export function shouldRefreshUpgradePreviewTransient({ previousSignature, nextSignature, offerOpen = false } = {}) {
  const changed = upgradePreviewTransientChanged(previousSignature, nextSignature);
  return Object.freeze({ changed, render: Boolean(offerOpen) && changed });
}
