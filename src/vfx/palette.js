/** Colour ownership for BIPX effects. One owner per hue band, chosen against the dark blue-green cemetery (ground luma
 * ~20 %, hue ~175°). The CVD matrices below support a deterministic simulation; no human visual evaluation or
 * tools/vfx-palette-cpu.mjs execution is claimed by this snapshot.
 *
 * Rules
 *  1. HOSTILE owns crimson-rose (hue 335°–15°). Nothing friendly, neutral or lootable may use that band.
 *     Hue alone is never the signal: hostile bodies also carry a white-hot core, a dark wine rim, a spiked silhouette,
 *     counter-rotation and a ground reticle (src/vfx/threat-markers.js), so the threat still reads in greyscale.
 *  2. A hero owns the colour of what the player just DID (class basic + class skills). Aldric: steel white + ember gold.
 *     Lyra: fire / frost / gravity.
 *  3. A relic owns the colour of the BODY of its effect only. No permanent saturated aura under the hero.
 *  4. Automatic weapons are passives: companion periwinkle/azure/gold at roughly half the intensity of an active skill.
 *  5. Loot is gold / cyan / mint and never pulses like a threat.
 * Pure data: no THREE, no DOM. src/main.js cannot import presentation tables by lane rule, so its colour literals are
 * mirrored here and the CPU harness fails when the two drift.
 */
const freeze = value => { for (const child of Object.values(value)) if (child && typeof child === 'object') freeze(child); return Object.freeze(value); };

export const VFX_PALETTE = freeze({
  hostile: {
    threat: 0xff2f5e, // projectile bodies, telegraph boundaries, enemy areas, threat reticles
    hot: 0xffe6e0, // white-hot core
    deep: 0x5c0a20, // dark rim / underlay drawn with normal blending
  },
  aldric: {
    steel: 0xeaf4ff, // blade arcs, dash ribbons
    ember: 0xffb648, // heat on the leading edge, finisher ring, war cry
    spark: 0xff8f3a, // cooling sparks and scorch
  },
  lyra: { fire: 0xff7a2a, frost: 0x7fd8ff, gravity: 0x9b5cff },
  relic: {
    flamethrower: 0xff7a28, axe: 0xa9c8ff, katana: 0x8ffcff, crossbow: 0xffd36d,
    talisman: 0xb18cff, thunderstaff: 0xfff45c, boneCannon: 0xe7e0c7, frostNova: 0x7edcff,
  },
  auto: {
    guardianBlade: [0x8ffcff, 0x5dc7ff], // Lâmina Guardiã, Lâmina Eclipse
    orbitOrb: [0x8c9bff, 0xff8a2a], // Orbe Giratório, Orbe Profano
    sealRain: [0xffd36d, 0xffd76a], // Chuva de Selos, Dilúvio Arcano
    sealRitual: [0xff8a2a, 0xff8a2a],
  },
  xp: { small: 0x74d1ff, mid: 0x4fe0c0, large: 0xffd36d },
  heal: 0x86f29a,
  levelUp: 0xf5d594,
  // Mirrors rarityStyles in src/main.js (UI lane owns the CSS side).
  loot: { common: 0x74d1ff, rare: 0xffd84a, epic: 0xff8a2a, legendary: 0xffd76a },
});

/** Literals that live outside src/vfx and must keep matching the owners above; this snapshot has no palette tool run. */
export const PALETTE_MIRRORS = freeze({
  'src/main.js': {
    casterProjectile: VFX_PALETTE.hostile.threat, hostileProjectileFallback: VFX_PALETTE.hostile.threat, hostileProjectileInstances: VFX_PALETTE.hostile.threat,
    casterEye: VFX_PALETTE.hostile.threat, profaneCircle: VFX_PALETTE.hostile.threat, crackedLightning: VFX_PALETTE.hostile.threat,
    xpSmall: VFX_PALETTE.xp.small, xpMid: VFX_PALETTE.xp.mid, xpLarge: VFX_PALETTE.xp.large, orbitEffect: VFX_PALETTE.auto.orbitOrb[0],
  },
  'src/combat/arsenal.mjs': { talisman: VFX_PALETTE.relic.talisman, orbitOrb: VFX_PALETTE.auto.orbitOrb[0], orbitOrbEvolved: VFX_PALETTE.auto.orbitOrb[1] },
});

export const relicColor = (relicId, fallback = VFX_PALETTE.aldric.ember) => Object.hasOwn(VFX_PALETTE.relic, relicId) ? VFX_PALETTE.relic[relicId] : fallback;
export const autoWeaponColor = (weaponId, evolved = false) => Object.hasOwn(VFX_PALETTE.auto, weaponId) ? VFX_PALETTE.auto[weaponId][evolved ? 1 : 0] : null;
export const xpGemColor = value => value >= 25 ? VFX_PALETTE.xp.large : value >= 7 ? VFX_PALETTE.xp.mid : VFX_PALETTE.xp.small;
/** Every hostile projectile, trail, impact and telegraph is drawn in the threat colour, whatever table colour the caller carries. */
export const hostileColor = () => VFX_PALETTE.hostile.threat;

// ---- colour-vision checks shared by the CPU harness (Machado, Oliveira & Fernandes 2009, severity 1.0) ----
const CVD = freeze({
  normal: [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
  protan: [[.152286, 1.052583, -.204868], [.114503, .786281, .099216], [-.003882, -.048116, 1.051998]],
  deutan: [[.367322, .860646, -.227968], [.280085, .672501, .047413], [-.01182, .04294, .968881]],
  tritan: [[1.255528, -.076749, -.178779], [-.078411, .930809, .147602], [.004733, .691367, .3039]],
});
export const CVD_MODES = Object.freeze(Object.keys(CVD));
const linear = v => { v /= 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; };
function oklab(hex, mode) {
  const c = [linear(hex >> 16 & 255), linear(hex >> 8 & 255), linear(hex & 255)];
  const [r, g, b] = CVD[mode].map(row => Math.max(0, Math.min(1, row[0] * c[0] + row[1] * c[1] + row[2] * c[2])));
  const l = Math.cbrt(.4122214708 * r + .5363325363 * g + .0514459929 * b), m = Math.cbrt(.2119034982 * r + .6806995451 * g + .1073969566 * b), s = Math.cbrt(.0883024619 * r + .2817188376 * g + .6299787005 * b);
  return [.2104542553 * l + .793617785 * m - .0040720468 * s, 1.9779984951 * l - 2.428592205 * m + .4505937099 * s, .0259040371 * l + .7827717662 * m - .808675766 * s];
}
/** Perceptual distance (OKLab) between two 24-bit colours as seen with the given colour vision. ~0.02 is one JND. */
export function colourDistance(a, b, mode = 'normal') {
  const x = oklab(a, mode), y = oklab(b, mode);
  return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]);
}
export function hueDegrees(hex) {
  const r = (hex >> 16 & 255) / 255, g = (hex >> 8 & 255) / 255, b = (hex & 255) / 255, max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  if (d < 1e-6) return { hue: 0, saturation: 0, value: max };
  const hue = max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { hue: hue * 60, saturation: d / max, value: max };
}
/** True for a saturated colour inside the band reserved for threats. */
export function inThreatBand(hex) {
  const { hue, saturation, value } = hueDegrees(hex);
  return saturation > .55 && value > .45 && (hue >= 335 || hue <= 15);
}
