const baseConfig = {
  camera: {
    fov: 48,
    zoomScale: 1,
    height: 17,
    depth: 20,
    lookAhead: 2.6,
  },
  lighting: {
    hemi: {
      skyColor: 0xd7e8ff,
      groundColor: 0x38485c,
      intensity: 3.1,
    },
    moon: {
      color: 0xf1f7ff,
      intensity: 4.2,
      shadowMapSize: 2048,
      shadowBias: -0.0005,
    },
    player: {
      color: 0xffe2ab,
      intensity: 5.4,
      distance: 58,
      height: 4.5,
    },
  },
  fog: {
    color: 0x17212a,
    density: 0.009,
  },
  quality: {
    highPixelRatio: 2,
    mediumPixelRatio: 1.6,
    lowPixelRatio: 1,
    mobileHighPixelRatio: 1.75,
    mobileMediumPixelRatio: 1.45,
    mobileLowPixelRatio: 1,
    effectBudget: {
      high: 86,
      medium: 56,
      low: 34,
      mobileHigh: 68,
      mobileMedium: 42,
      mobileLow: 24,
    },
  },
  gameplay: {
    touch: {
      responseMobileExponent: 0.78,
      responseDesktopExponent: 0.9,
      stickRadiusMobile: 0.42,
      stickRadiusDesktop: 0.36,
      deadZoneMobile: 0.12,
      deadZoneDesktop: 0.16,
      fireAimDeadZone: 0.18,
      aimAssistRange: 16,
    },
    hud: {
      mobileInterval: 0.14,
      desktopInterval: 0.1,
    },
    labels: {
      mobileInterval: 0.12,
      desktopInterval: 0.05,
    },
    partyHud: {
      mobileInterval: 0.25,
      desktopInterval: 0.15,
    },
    skillHud: {
      mobileMaxEntries: 8,
      desktopMaxEntries: 12,
    },
  },
};

export const DEFAULT_CONFIG = Object.freeze({
  desktop: deepFreeze(structuredClone(baseConfig)),
  mobilePro: deepFreeze(
    mergeObjects(structuredClone(baseConfig), {
      camera: {
        fov: 49,
        zoomScale: 1.82,
        height: 16.2,
        depth: 19.2,
        lookAhead: 2.95,
      },
      lighting: {
        moon: {
          shadowMapSize: 1024,
          shadowBias: -0.0018,
        },
        player: {
          intensity: 3.8,
          distance: 35,
          height: 4.2,
        },
      },
      fog: {
        density: 0.021,
      },
      quality: {
        mobileHighPixelRatio: 1.65,
        mobileMediumPixelRatio: 1.35,
        mobileLowPixelRatio: 0.95,
        effectBudget: {
          mobileHigh: 58,
          mobileMedium: 36,
          mobileLow: 20,
        },
      },
      gameplay: {
        touch: {
          responseMobileExponent: 0.72,
          stickRadiusMobile: 0.46,
          deadZoneMobile: 0.09,
          fireAimDeadZone: 0.16,
          aimAssistRange: 18,
        },
        hud: {
          mobileInterval: 0.16,
        },
        labels: {
          mobileInterval: 0.14,
        },
        partyHud: {
          mobileInterval: 0.28,
        },
        skillHud: {
          mobileMaxEntries: 7,
        },
      },
    }),
  ),
  mobile: deepFreeze(
    mergeObjects(structuredClone(baseConfig), {
      camera: {
        zoomScale: 2,
      },
      lighting: {
        moon: {
          shadowMapSize: 1024,
          shadowBias: -0.002,
        },
        player: {
          intensity: 3.5,
          distance: 32,
        },
      },
      fog: {
        density: 0.024,
      },
    }),
  ),
  tablet: deepFreeze(
    mergeObjects(structuredClone(baseConfig), {
      camera: {
        zoomScale: 1.5,
      },
      lighting: {
        moon: {
          shadowMapSize: 1536,
          shadowBias: -0.001,
        },
        player: {
          intensity: 3.1,
          distance: 30,
        },
      },
      fog: {
        density: 0.026,
      },
    }),
  ),
});

export function cloneDefaultConfig(target = "desktop") {
  return structuredClone(DEFAULT_CONFIG[target] ?? DEFAULT_CONFIG.desktop);
}

export function mergeObjects(base, patch) {
  if (!patch || typeof patch !== "object") {
    return base;
  }

  for (const [key, value] of Object.entries(patch)) {
    if (Array.isArray(value)) {
      base[key] = value.slice();
      continue;
    }

    if (value && typeof value === "object") {
      const current = base[key];
      base[key] = mergeObjects(
        current && typeof current === "object" && !Array.isArray(current) ? current : {},
        value,
      );
      continue;
    }

    base[key] = value;
  }

  return base;
}

function deepFreeze(value) {
  if (!value || typeof value !== "object") {
    return value;
  }

  for (const key of Object.keys(value)) {
    deepFreeze(value[key]);
  }

  return Object.freeze(value);
}
