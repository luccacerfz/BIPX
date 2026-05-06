export const CONFIG_SCHEMA = Object.freeze({
  camera: {
    label: "Camera",
    targetable: true,
    fields: {
      fov: { type: "number", min: 30, max: 90, step: 1 },
      zoomScale: { type: "number", min: 0.5, max: 4, step: 0.05 },
      height: { type: "number", min: 8, max: 48, step: 0.5 },
      depth: { type: "number", min: 8, max: 56, step: 0.5 },
      lookAhead: { type: "number", min: 0, max: 12, step: 0.1 },
    },
  },
  lighting: {
    label: "Lighting",
    targetable: true,
    groups: {
      hemi: {
        label: "Hemisphere",
        fields: {
          skyColor: { type: "color" },
          groundColor: { type: "color" },
          intensity: { type: "number", min: 0, max: 5, step: 0.05 },
        },
      },
      moon: {
        label: "Moon",
        fields: {
          color: { type: "color" },
          intensity: { type: "number", min: 0, max: 8, step: 0.05 },
          shadowMapSize: { type: "number", min: 256, max: 4096, step: 256 },
          shadowBias: { type: "number", min: -0.02, max: 0, step: 0.0005 },
        },
      },
      player: {
        label: "Player Light",
        fields: {
          color: { type: "color" },
          intensity: { type: "number", min: 0, max: 8, step: 0.05 },
          distance: { type: "number", min: 4, max: 72, step: 1 },
          height: { type: "number", min: 1, max: 12, step: 0.1 },
        },
      },
    },
  },
  fog: {
    label: "Fog",
    targetable: true,
    fields: {
      color: { type: "color" },
      density: { type: "number", min: 0, max: 0.1, step: 0.001 },
    },
  },
  quality: {
    label: "Quality",
    targetable: true,
    groups: {
      pixelRatio: {
        label: "Pixel Ratio",
        fields: {
          highPixelRatio: { type: "number", min: 0.5, max: 3, step: 0.01 },
          mediumPixelRatio: { type: "number", min: 0.5, max: 3, step: 0.01 },
          lowPixelRatio: { type: "number", min: 0.5, max: 3, step: 0.01 },
          mobileHighPixelRatio: { type: "number", min: 0.5, max: 3, step: 0.01 },
          mobileMediumPixelRatio: { type: "number", min: 0.5, max: 3, step: 0.01 },
          mobileLowPixelRatio: { type: "number", min: 0.5, max: 3, step: 0.01 },
        },
      },
      effectBudget: {
        label: "Effect Budget",
        fields: {
          high: { type: "number", min: 4, max: 256, step: 1, path: "quality.effectBudget.high" },
          medium: { type: "number", min: 4, max: 256, step: 1, path: "quality.effectBudget.medium" },
          low: { type: "number", min: 4, max: 256, step: 1, path: "quality.effectBudget.low" },
          mobileHigh: { type: "number", min: 4, max: 256, step: 1, path: "quality.effectBudget.mobileHigh" },
          mobileMedium: { type: "number", min: 4, max: 256, step: 1, path: "quality.effectBudget.mobileMedium" },
          mobileLow: { type: "number", min: 4, max: 256, step: 1, path: "quality.effectBudget.mobileLow" },
        },
      },
    },
  },
  gameplay: {
    label: "Gameplay",
    targetable: true,
    groups: {
      touch: {
        label: "Touch",
        fields: {
          responseMobileExponent: { type: "number", min: 0.2, max: 2, step: 0.01 },
          responseDesktopExponent: { type: "number", min: 0.2, max: 2, step: 0.01 },
          stickRadiusMobile: { type: "number", min: 0.1, max: 1, step: 0.01 },
          stickRadiusDesktop: { type: "number", min: 0.1, max: 1, step: 0.01 },
          deadZoneMobile: { type: "number", min: 0.01, max: 0.5, step: 0.01 },
          deadZoneDesktop: { type: "number", min: 0.01, max: 0.5, step: 0.01 },
        },
      },
      partyHud: {
        label: "Party HUD",
        fields: {
          mobileInterval: { type: "number", min: 0.01, max: 2, step: 0.01 },
          desktopInterval: { type: "number", min: 0.01, max: 2, step: 0.01 },
        },
      },
      skillHud: {
        label: "Skill HUD",
        fields: {
          mobileMaxEntries: { type: "number", min: 1, max: 24, step: 1 },
          desktopMaxEntries: { type: "number", min: 1, max: 24, step: 1 },
        },
      },
    },
  },
});
