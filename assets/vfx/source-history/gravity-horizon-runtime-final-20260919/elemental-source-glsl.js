/** Source-derived algorithms; pins, paths and MIT notice in ELEMENTAL-LICENSE.txt.
 * HandCast GlacialShardStormMaterials.js: sixfold dendrite SDF.
 * Linear AcidPoolMaterial.js: true nearest-bisector Voronoi and independent bubble clocks.
 */
export const latticeGLSL = /* glsl */ `
float snowflakeSDF(vec2 p, float seed) {
  float r1 = hash11(seed + 1.3);
  float r2 = hash11(seed + 2.7);
  float r3 = hash11(seed + 4.1);
  float r4 = hash11(seed + 5.9);

  const float SECTOR = 1.0471975511965976;   // a sixth of a turn
  float a = atan(p.y, p.x);
  float rr = length(p);
  a = abs(mod(a + SECTOR * 0.5, SECTOR) - SECTOR * 0.5);
  vec2 q = vec2(cos(a), sin(a)) * rr;

  // The spar: tapering to its tip.
  float armW = 0.035 + 0.03 * r1;
  float d = max(abs(q.y) - armW * (1.0 - 0.45 * q.x), q.x - 1.0);

  // Side branches, each leaving the spar at sixty degrees.
  float branches = 2.0 + floor(r2 * 3.0);
  for (int i = 0; i < 4; i++) {
    if (float(i) >= branches) break;
    float t = 0.22 + (float(i) + 0.5 * r3) / branches * 0.66;
    float len = (0.46 - 0.07 * float(i)) * (0.7 + 0.5 * r4) * (1.0 - t * 0.45);
    vec2 b = q - vec2(t, 0.0);
    vec2 br = vec2(b.x * 0.5 + b.y * 0.8660254, -b.x * 0.8660254 + b.y * 0.5);
    float bw = armW * 0.7 * (1.0 - br.x / max(len, 0.01) * 0.6);
    float bd = max(abs(br.y) - bw, max(-br.x, br.x - len));
    d = min(d, bd);
  }

  // The plate: a hexagon with its points on the arms.
  float coreR = 0.1 + 0.16 * r3;
  float hd = dot(q, vec2(0.8660254, 0.5)) - coreR * 0.8660254;
  d = min(d, hd);

  // And on some, a ring.
  if (r4 > 0.45) {
    float ringR = 0.42 + 0.22 * r1;
    float ringW = 0.018 + 0.012 * r2;
    float hr = abs(dot(q, vec2(0.8660254, 0.5)) - ringR * 0.8660254) - ringW;
    d = min(d, hr);
  }
  return d;
}
`;
export const etchGLSL = /* glsl */ `
  vec2 voronoiEtch(vec2 p) {
    vec2 n = floor(p);
    vec2 f = fract(p);

    vec2 mg = vec2(0.0);
    vec2 mr = vec2(0.0);
    float md = 8.0;
    float id = 0.0;

    for (int j = -1; j <= 1; j++) {
      for (int i = -1; i <= 1; i++) {
        vec2 g = vec2(float(i), float(j));
        vec2 o = hash21(dot(n + g, vec2(7.13, 113.17)));
        vec2 r = g + o - f;
        float d = dot(r, r);
        if (d < md) {
          md = d;
          mr = r;
          mg = g;
          id = hash11(dot(n + g, vec2(31.7, 57.1)));
        }
      }
    }

    float edge = 8.0;
    for (int j = -1; j <= 1; j++) {
      for (int i = -1; i <= 1; i++) {
        vec2 g = mg + vec2(float(i), float(j));
        vec2 o = hash21(dot(n + g, vec2(7.13, 113.17)));
        vec2 r = g + o - f;
        vec2 diff = r - mr;
        float dd = dot(diff, diff);
        if (dd > 1e-5) edge = min(edge, dot(0.5 * (mr + r), normalize(diff)));
      }
    }

    return vec2(edge, id);
  }

  vec2 surfaceBoil(vec2 p, float scale, float rate, float seed, float clock) {
    vec2 g = p * scale;
    vec2 n = floor(g);
    vec2 f = fract(g);

    float rim = 0.0;
    float crater = 0.0;

    for (int j = -1; j <= 1; j++) {
      for (int i = -1; i <= 1; i++) {
        vec2 o = vec2(float(i), float(j));
        float cell = dot(n + o, vec2(41.3, 289.1)) + seed;
        float id = hash11(cell);
        vec2 jitter = hash21(cell * 1.37);

        // Every cell runs at its own rate, so the grid never pulses together.
        float phase = fract(clock * rate * (0.45 + id * 1.1) + id * 9.0);
        float size = 0.16 + id * 0.30;
        float r = phase * size;

        float d = length(o + jitter - f);
        float w = max(0.018, size * 0.22 * (1.0 - phase * 0.6));
        // A ring that opens, thins and goes out — one bubble, start to burst.
        float ring = (1.0 - smoothstep(0.0, w, abs(d - r))) * (1.0 - phase) * (1.0 - phase);
        rim = max(rim, ring);
        crater = max(crater, (1.0 - smoothstep(r * 0.2, max(r, 0.0001), d)) * (1.0 - phase) * 0.8);
      }
    }
    return vec2(rim, crater);
  }

`;
