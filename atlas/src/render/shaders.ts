import { modeIndex, type MapMode } from './modes';

const M = (m: MapMode): string => `${modeIndex(m)}`;

export const VERT = /* glsl */ `#version 300 es
in vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

export const FRAG = /* glsl */ `#version 300 es
precision highp float;
precision highp int;
precision highp usampler2D;

uniform sampler2D uHeight;   // R16F  altitude (m), terres >= +2, océan <= -2
uniform sampler2D uClimate;  // RG16F température (°C), précipitations (mm)
uniform sampler2D uWater;    // RGBA16F profondeur de lac, salinité, distance signée au lac, distance signée à la côte
uniform usampler2D uMisc;    // RGBA8UI biome, plaque, frontière, océan
uniform sampler2D uLut;      // couleur de végétation (T, log2 aridité)
uniform sampler2D uPalette;  // 256x2 : plaques, biomes

uniform vec2 uWorld;      // W, H (cellules)
uniform vec2 uCenter;     // centre caméra (cellules)
uniform float uScale;     // pixels (device) par cellule
uniform vec2 uViewport;   // pixels (device)
uniform int uMode;
uniform float uExag;
uniform float uCellKm;
uniform float uLatMax;    // degrés
uniform float uGrid;
uniform vec4 uLutRange;   // tMin, tMax, aMin, aMax
uniform usampler2D uPol;     // RGBA16UI province, pays, ville d'influence, continent (65535 = aucun)
uniform sampler2D uPolPal;   // 1024x6 : pays, continents, villes, cultures, religions, familles culturelles
uniform usampler2D uLore;    // RGBA16UI culture, religion, famille culturelle, religion mère
uniform sampler2D uExtra;    // RG16F intensité d'influence, densité de population
uniform int uHover;          // pays survolé (-1)
uniform int uSelected;       // pays sélectionné (-1)
uniform float uTime;         // secondes (animation des nuages)
uniform float uClouds;       // 1 = couche nuageuse
uniform float uNight;        // 1 = cycle jour / nuit
uniform vec3 uSun;           // direction du soleil (sphère unité, même repère que sphereOf)
uniform float uDpr;          // densité de pixels de l'écran
uniform float uForests;      // 1 = forêts peintes dans le terrain
uniform usampler2D uProv;    // RGBA16UI par province (1024 par ligne) : pays affiché, État, région historique, pays précédent
uniform sampler2D uProvT;    // R32F par province : instant (s) du dernier changement de pays (transitions de la frise)

out vec4 outColor;

#define M_POLITICAL ${M('political')}
#define M_PROVINCES ${M('provinces')}
#define M_STATES ${M('states')}
#define M_REGIONS ${M('regions')}
#define M_TRADE ${M('trade')}
#define M_CULTURES ${M('cultures')}
#define M_RELIGIONS ${M('religions')}
#define M_INFLUENCE ${M('influence')}
#define M_TERRAIN ${M('terrain')}
#define M_RELIEF ${M('relief')}
#define M_CONTINENTS ${M('continents')}
#define M_PLATES ${M('plates')}
#define M_TEMPERATURE ${M('temperature')}
#define M_PRECIPITATION ${M('precipitation')}
#define M_BIOMES ${M('biomes')}
const uint NONE = 65535u;

const float PI = 3.14159265359;

// ---------- bruit simplex 3D (Ashima Arts / Ian McEwan, MIT) ----------
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 10.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
float snoise(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(i.z + vec4(0.0, i1.z, i2.z, 1.0)) + i.y + vec4(0.0, i1.y, i2.y, 1.0)) + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.5 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 105.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}

// Coordonnées sur un cylindre : le bruit boucle exactement en longitude (1 unité ≈ 1 cellule).
vec3 cyl(vec2 w) {
  float a = w.x / uWorld.x * 2.0 * PI;
  float r = uWorld.x / (2.0 * PI);
  return vec3(r * cos(a), r * sin(a), w.y);
}

// ---------- échantillonnage de l'altitude ----------
float hLin(vec2 w) { return texture(uHeight, w / uWorld).r; }

vec4 cubicW(float v) {
  vec4 n = vec4(1.0, 2.0, 3.0, 4.0) - v;
  vec4 s = n * n * n;
  float x = s.x;
  float y = s.y - 4.0 * s.x;
  float z = s.z - 4.0 * s.y + 6.0 * s.x;
  float w = 6.0 - x - y - z;
  return vec4(x, y, z, w) * (1.0 / 6.0);
}

// B-spline bicubique en 4 lectures bilinéaires : normales lisses même en zoom fort
float hCubic(vec2 w) {
  vec2 tc = w - 0.5;
  vec2 f = fract(tc);
  tc -= f;
  vec4 xc = cubicW(f.x), yc = cubicW(f.y);
  vec4 c = tc.xxyy + vec2(-0.5, 1.5).xyxy;
  vec4 s = vec4(xc.xz + xc.yw, yc.xz + yc.yw);
  vec4 off = (c + vec4(xc.yw, yc.yw) / s) / uWorld.xxyy;
  float s0 = texture(uHeight, off.xz).r;
  float s1 = texture(uHeight, off.yz).r;
  float s2 = texture(uHeight, off.xw).r;
  float s3 = texture(uHeight, off.yw).r;
  float sx = s.x / (s.x + s.y);
  float sy = s.z / (s.z + s.w);
  return mix(mix(s3, s2, sx), mix(s1, s0, sx), sy);
}

// micro-relief procédural révélé progressivement au zoom :
// crêtes vives (ampRidge) pour les montagnes, ondulations douces (ampSoft) pour les plaines
// Micro-relief révélé au zoom. Pour éviter un « papier froissé » uniforme :
//  - caractère régional (massifs aigus / croupes arrondies, plus ou moins accidentés, pente spectrale variable),
//  - domaine légèrement déformé (pas de motif régulier), un peu plus sur les versants raides.
float detailH(vec2 w, float ampRidge, float ampSoft, float slope) {
  vec3 p = cyl(w);
  float region = snoise(p * 0.045 + 7.0);
  float sharp = smoothstep(-0.5, 0.6, region);
  float roughMul = 0.5 + 1.0 * smoothstep(-0.7, 0.8, snoise(p * 0.11 - 3.0));
  float wk = 0.5 + 0.5 * smoothstep(30.0, 250.0, slope);
  vec3 q = p + vec3(snoise(p * 0.17 + 1.7), snoise(p * 0.17 + 9.2), snoise(p * 0.17 - 4.4)) * wk;
  float ridge = 0.0, soft = 0.0, a = 1.0, f = 0.8;
  float decay = 0.45 + 0.07 * region;
  for (int i = 0; i < 6; i++) {
    // une octave n'apparaît que si ses motifs font plusieurs pixels (sinon scintillement)
    float fade = smoothstep(2.0, 5.0, uScale / f);
    if (fade <= 0.0) break;
    float n = snoise(q * f + float(i) * 17.17);
    float r = 1.0 - abs(n);
    // crêtes vives ou croupes arrondies selon la région
    float rr = mix(0.55 * r + 0.45 * (n * 0.5 + 0.5) * (n * 0.5 + 0.5), r * r, sharp);
    ridge += a * fade * (rr - 0.45);
    soft += a * fade * n;
    a *= decay;
    f *= 2.07;
  }
  return ridge * ampRidge * roughMul + soft * ampSoft * (0.6 + 0.6 * roughMul);
}

// ---------- palettes ----------
vec3 ramp7(float t, vec3 c0, vec3 c1, vec3 c2, vec3 c3, vec3 c4, vec3 c5, vec3 c6) {
  t = clamp(t, 0.0, 1.0) * 6.0;
  if (t < 1.0) return mix(c0, c1, t);
  if (t < 2.0) return mix(c1, c2, t - 1.0);
  if (t < 3.0) return mix(c2, c3, t - 2.0);
  if (t < 4.0) return mix(c3, c4, t - 3.0);
  if (t < 5.0) return mix(c4, c5, t - 4.0);
  return mix(c5, c6, t - 5.0);
}

vec3 hypso(float h) {
  float t = h < 300.0 ? h / 300.0 : h < 800.0 ? 1.0 + (h - 300.0) / 500.0 : h < 1800.0 ? 2.0 + (h - 800.0) / 1000.0
          : h < 3000.0 ? 3.0 + (h - 1800.0) / 1200.0 : h < 4500.0 ? 4.0 + (h - 3000.0) / 1500.0 : 5.0 + (h - 4500.0) / 1500.0;
  return ramp7(t / 6.0,
    vec3(0.33, 0.54, 0.34), vec3(0.57, 0.70, 0.43), vec3(0.86, 0.83, 0.57), vec3(0.80, 0.62, 0.41),
    vec3(0.60, 0.44, 0.33), vec3(0.62, 0.60, 0.59), vec3(0.97, 0.97, 0.98));
}

vec3 tempRamp(float t) {
  return ramp7((t + 30.0) / 65.0,
    vec3(0.36, 0.20, 0.52), vec3(0.22, 0.36, 0.78), vec3(0.55, 0.80, 0.92), vec3(0.45, 0.75, 0.45),
    vec3(0.93, 0.87, 0.40), vec3(0.93, 0.55, 0.22), vec3(0.72, 0.13, 0.13));
}

vec3 precipRamp(float p) {
  float t = log2(1.0 + p / 60.0) / log2(1.0 + 7000.0 / 60.0);
  return ramp7(t,
    vec3(0.52, 0.33, 0.20), vec3(0.84, 0.72, 0.45), vec3(0.74, 0.80, 0.42), vec3(0.34, 0.66, 0.32),
    vec3(0.12, 0.52, 0.52), vec3(0.12, 0.28, 0.62), vec3(0.34, 0.16, 0.50));
}

vec3 oceanColor(float depth, float T, float shade, vec3 p) {
  vec3 shallow = vec3(0.22, 0.37, 0.43);
  vec3 mid = vec3(0.14, 0.26, 0.36);
  vec3 deep = vec3(0.065, 0.13, 0.225);
  vec3 c = mix(shallow, mid, smoothstep(0.0, 350.0, depth));
  c = mix(c, deep, smoothstep(350.0, 5500.0, depth));
  c *= mix(1.0, clamp(shade, 0.72, 1.22), 0.5);
  float n = snoise(p * 0.5);
  c *= 0.97 + 0.04 * n;
  float ice = smoothstep(-1.2, -3.5, T + n * 1.2);
  return mix(c, vec3(0.83, 0.87, 0.9) * (0.95 + 0.08 * n) * mix(1.0, shade, 0.2), ice);
}

ivec2 cellOf(vec2 w);

// ---------- forêts peintes dans le terrain ----------
// densité de boisement et type de couvert par biome (indices B.* de biomes.ts)
const float FOREST_D[22] = float[22](0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.06, 0.92, 0.03, 0.86, 1.0, 0.34, 0.0, 0.0, 0.14, 0.62, 1.0, 0.42, 0.05, 0.0, 0.07, 0.0);
// 0 feuillus, 1 conifères, 2 forêt dense tropicale, 3 arbres épars (acacias, oliviers)
const int FOREST_K[22] = int[22](0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 1, 3, 0, 0, 3, 0, 2, 0, 1, 0, 0, 0);

uvec3 hashU(uvec2 v) {
  uvec3 u = uvec3(v.x, v.y, v.x ^ v.y) * uvec3(1664525u, 1013904223u, 2246822519u);
  u.x += u.y * u.z; u.y += u.z * u.x; u.z += u.x * u.y;
  u ^= u >> 16u;
  u.x += u.y * u.z; u.y += u.z * u.x; u.z += u.x * u.y;
  return u;
}
vec3 hash3(vec2 c) {
  return vec3(hashU(uvec2(ivec2(c) + ivec2(1 << 22)))) / 4294967295.0;
}

/** Houppier le plus haut sous le point (grille d'arbres de pas 1) : hauteur, teinte propre, normale. */
// kw : part de chaque type de couvert (feuillus, résineux, tropical dense, épars) autour du point ;
// chaque arbre tire son type selon ces parts, si bien que les lisières entre biomes se mélangent
int treeKind(vec4 kw, float r) {
  float a = kw.x;
  if (r < a) return 0;
  a += kw.y;
  if (r < a) return 1;
  a += kw.z;
  if (r < a) return 2;
  return 3;
}

vec2 crown(vec2 q, float cover, vec4 kw, out vec3 n) {
  vec2 i = floor(q), f = fract(q);
  float best = 0.0, id = 0.0;
  n = vec3(0.0, 0.0, 1.0);
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 g = vec2(float(x), float(y));
      vec3 h = hash3(i + g);
      if (h.z > cover) continue;
      int k = treeKind(kw, fract(h.z * 13.7));
      if (k == 0 && fract(h.y * 9.1) < 0.14) k = 1; // quelques résineux parmi les feuillus
      vec2 o = f - (g + 0.12 + 0.76 * h.xy);
      float r = (k == 1 ? 0.46 : k == 2 ? 0.74 : 0.62) * (0.8 + 0.4 * fract(h.x * 7.31));
      vec2 oo = k == 3 ? o * vec2(0.85, 1.3) : o;
      float d = length(oo) / r;
      if (d >= 1.0) continue;
      float z = (k == 1 ? 1.0 - d : sqrt(1.0 - d * d)) * (0.72 + 0.28 * h.y);
      if (z > best) {
        best = z;
        id = h.x + float(k) * 10.0;
        n = k == 1 ? normalize(vec3(oo / max(length(oo), 1e-4) * 0.85, 0.62)) : normalize(vec3(oo / r, sqrt(max(1.0 - d * d, 0.0)) + 0.08));
      }
    }
  }
  return vec2(best, id);
}

vec3 kindColor(int k) {
  return k == 1 ? vec3(0.13, 0.23, 0.16) : k == 2 ? vec3(0.11, 0.3, 0.12) : k == 3 ? vec3(0.3, 0.37, 0.16) : vec3(0.21, 0.33, 0.13);
}

vec3 canopyAt(vec2 q, float cover, vec4 kw, vec3 ground0, vec3 floorC) {
  vec3 n, sn;
  vec2 c = crown(q, cover, kw, n);
  // ombre portée : un houppier entre le point et le soleil (au nord-ouest)
  float sh = crown(q + vec2(-0.55, -0.7) * 0.4, cover, kw, sn).x;
  vec3 ground = floorC * (1.0 - 0.5 * smoothstep(0.0, 0.1, sh));
  float lam = clamp(dot(n, normalize(vec3(-0.55, -0.7, 0.95))), 0.0, 1.0);
  int k = int(c.y / 10.0);
  vec3 base = mix(kindColor(k), ground0 * 0.72, 0.18);
  vec3 tint = base * (0.84 + 0.32 * fract(c.y));
  vec3 cc = tint * (0.46 + 0.9 * lam) * (0.8 + 0.2 * c.x);
  return mix(ground, cc, smoothstep(0.0, 0.14, c.x));
}

/**
 * Couvert forestier peint sur la couleur du sol : densité par biome (interpolée entre cellules),
 * clairières par bruit lent, houppiers vus de dessus dont la taille à l'écran reste lisible (deux
 * niveaux de grille fondus selon le zoom) ; de très loin, simple assombrissement vert du terrain.
 */
vec3 forestPaint(vec3 ground, vec2 w, vec3 p, float bare) {
  // lisières : biome lu à une position déformée par du bruit, sinon elles suivraient la grille des cellules
  vec2 warp = vec2(snoise(p * 0.45 + 31.0), snoise(p * 0.45 + 57.0)) * 1.1
            + vec2(snoise(p * 1.4 + 11.0), snoise(p * 1.4 + 23.0)) * 0.42;
  vec2 t = w + warp - 0.5;
  vec2 b = floor(t), f = t - b;
  uint b00 = texelFetch(uMisc, cellOf(b + vec2(0.5, 0.5)), 0).r, b10 = texelFetch(uMisc, cellOf(b + vec2(1.5, 0.5)), 0).r;
  uint b01 = texelFetch(uMisc, cellOf(b + vec2(0.5, 1.5)), 0).r, b11 = texelFetch(uMisc, cellOf(b + vec2(1.5, 1.5)), 0).r;
  vec4 wt = vec4((1.0 - f.x) * (1.0 - f.y), f.x * (1.0 - f.y), (1.0 - f.x) * f.y, f.x * f.y);
  int i00 = int(min(b00, 21u)), i10 = int(min(b10, 21u)), i01 = int(min(b01, 21u)), i11 = int(min(b11, 21u));
  float dens = wt.x * FOREST_D[i00] + wt.y * FOREST_D[i10] + wt.z * FOREST_D[i01] + wt.w * FOREST_D[i11];
  dens *= 1.0 - bare;
  if (dens < 0.01) return ground;
  // parts des types de couvert, pondérées par la densité de chaque coin
  vec4 kw = vec4(0.0);
  float d00 = wt.x * FOREST_D[i00], d10 = wt.y * FOREST_D[i10], d01 = wt.z * FOREST_D[i01], d11 = wt.w * FOREST_D[i11];
  kw[FOREST_K[i00]] += d00;
  kw[FOREST_K[i10]] += d10;
  kw[FOREST_K[i01]] += d01;
  kw[FOREST_K[i11]] += d11;
  kw /= max(d00 + d10 + d01 + d11, 1e-5);
  float n = snoise(p * 2.3 + 5.1) * 0.5 + snoise(p * 7.7 + 2.2) * 0.3 * smoothstep(1.0, 3.0, uScale / 7.7);
  // forêts denses : couvert continu troué de clairières ; biomes clairsemés : bosquets isolés plutôt
  // qu'un semis d'arbres uniforme (qui ferait du grain)
  float clump = 0.5 + 0.5 * snoise(p * 0.9 + 3.7);
  float cover = dens >= 0.5 ? clamp(dens * 1.2 + n * 0.5 - 0.08, 0.0, 1.0) : clamp(smoothstep(0.5, 0.8, clump) * dens * 3.2, 0.0, 1.0);
  if (cover <= 0.0) return ground;
  vec3 base = kw.x * kindColor(0) + kw.y * kindColor(1) + kw.z * kindColor(2) + kw.w * kindColor(3);
  base = mix(base, ground * 0.72, 0.3);
  // sol forestier assombri en proportion du couvert : pas de saut entre prairie et sous-bois
  vec3 floorC = ground * mix(1.0, 0.6, smoothstep(0.0, 0.7, cover));
  vec3 far = mix(ground, base * 1.05, cover * 0.8);
  float s = uScale / uDpr;
  // houppiers visibles un à un : dès le zoom moyen en forêt dense, seulement de près pour les arbres épars
  float nearK = dens >= 0.5 ? smoothstep(0.55, 1.3, s) : smoothstep(7.0, 14.0, s);
  if (nearK <= 0.0) return far;
  // diamètre visé des houppiers : 4 px au loin, 8 px au plus près
  float px = uDpr * mix(5.5, 10.0, clamp(log2(max(s, 1.0)) / 6.0, 0.0, 1.0));
  float lvl = log2(px / uScale);
  float l0 = floor(lvl), fl = lvl - l0;
  vec3 c0 = canopyAt(w / exp2(l0), cover, kw, ground, floorC);
  vec3 c1 = canopyAt(w / exp2(l0 + 1.0), cover, kw, ground, floorC);
  vec3 near = mix(c0, c1, smoothstep(0.0, 1.0, fl));
  return mix(far, near, nearK);
}

vec3 vegetation(float T, float P, vec3 p) {
  float n1 = snoise(p * 0.2);
  float n2 = snoise(p * 1.1 + 3.1);
  float n3 = snoise(p * 3.6 + 7.7) * smoothstep(1.0, 4.0, uScale / 3.6);
  float n4 = snoise(p * 9.5 + 1.9) * smoothstep(1.0, 4.0, uScale / 9.5);
  float Tl = T + n1 * 0.6;
  float pet = clamp(300.0 + 45.0 * Tl, 150.0, 1700.0);
  float la = log2(max(P, 5.0) / pet) + n1 * 0.1 + n2 * 0.12 + n3 * 0.14 + n4 * 0.1;
  vec2 uv = vec2((Tl - uLutRange.x) / (uLutRange.y - uLutRange.x), (la - uLutRange.z) / (uLutRange.w - uLutRange.z));
  vec3 col = texture(uLut, uv).rgb;
  return col * (0.95 + 0.05 * n2 + 0.06 * n3 + 0.07 * n4);
}

float gridLine(vec2 w) {
  float lon = w.x / uWorld.x * 360.0 - 180.0;
  float lat = uLatMax - w.y / uWorld.y * 2.0 * uLatMax;
  float gs = 15.0;
  float dl = abs(fract(lon / gs + 0.5) - 0.5) * gs;
  float dp = abs(fract(lat / gs + 0.5) - 0.5) * gs;
  float fl = fwidth(lon), fp = fwidth(lat);
  float g = max(1.0 - smoothstep(0.4, 1.3, dl / fl), 1.0 - smoothstep(0.4, 1.3, dp / fp));
  float eq = 1.0 - smoothstep(0.6, 1.8, abs(lat) / fp);
  return max(g * 0.35, eq * 0.6);
}

// ---------- couches politiques ----------
ivec2 cellOf(vec2 w) {
  return ivec2(int(mod(floor(w.x), uWorld.x)), clamp(int(floor(w.y)), 0, int(uWorld.y) - 1));
}
uvec4 polAt(vec2 w) { return texelFetch(uPol, cellOf(w), 0); }
uvec4 loreAt(vec2 w) { return texelFetch(uLore, cellOf(w), 0); }
vec3 pal(uint idx, int row) { return texelFetch(uPolPal, ivec2(int(idx), row), 0).rgb; }
uvec4 provInfo(uint p) {
  if (p == NONE) return uvec4(NONE);
  int i = int(p);
  return texelFetch(uProv, ivec2(i & 1023, i >> 10), 0);
}

// Couleur du pays d'une province ; juste après un changement de mains (frise), la couleur du nouveau
// maître se répand sur la province comme une encre, avec un front doré qui avance. front : intensité du front.
vec3 ownerColor(uint prov, uint owner, vec3 p, out float front) {
  front = 0.0;
  vec3 c = pal(owner, 0);
  if (prov == NONE) return c;
  uvec4 inf = provInfo(prov);
  if (inf.a == NONE || inf.a == owner) return c;
  int i = int(prov);
  float t = clamp((uTime - texelFetch(uProvT, ivec2(i & 1023, i >> 10), 0).r) / 1.3, 0.0, 1.0);
  if (t >= 1.0) return c;
  float n = clamp(0.5 + 0.38 * snoise(p * 0.3 + 9.0) + 0.12 * snoise(p * 1.6 + 2.0), 0.0, 1.0);
  float k = t * 1.25 - 0.12;
  front = (1.0 - smoothstep(0.0, 0.07, abs(k - n))) * (1.0 - t * t);
  return mix(pal(inf.a, 0), c, smoothstep(n - 0.05, n + 0.05, k));
}

// identifiant majoritaire des 4 cellules voisines pondérées bilinéairement → frontières lissées ;
// m = écart entre les deux meilleurs poids (0 sur la frontière)
void majority(uint a, uint b, uint c, uint d, vec4 w, out uint id, out float m) {
  float wa = w.x + (b == a ? w.y : 0.0) + (c == a ? w.z : 0.0) + (d == a ? w.w : 0.0);
  float wb = b == a ? 0.0 : w.y + (c == b ? w.z : 0.0) + (d == b ? w.w : 0.0);
  float wc = (c == a || c == b) ? 0.0 : w.z + (d == c ? w.w : 0.0);
  float wd = (d == a || d == b || d == c) ? 0.0 : w.w;
  float b1 = wa, b2 = 0.0;
  uint i1 = a;
  if (wb > b1) { b2 = b1; b1 = wb; i1 = b; } else b2 = max(b2, wb);
  if (wc > b1) { b2 = b1; b1 = wc; i1 = c; } else b2 = max(b2, wc);
  if (wd > b1) { b2 = b1; b1 = wd; i1 = d; } else b2 = max(b2, wd);
  id = i1;
  m = b1 - b2;
}

// kind : 0 = province, pays, ville d'influence, continent ; 1 = couches culturelles ;
// 2 = province, pays, État, région historique. Le pays vient de la province (carte datée, éditeur).
void polSample(vec2 q, int kind, out uvec4 id, out vec4 m) {
  vec2 t = q - 0.5;
  vec2 b = floor(t);
  vec2 f = t - b;
  uvec4 A, B, C, D;
  if (kind == 1) {
    A = loreAt(b + vec2(0.5, 0.5)); B = loreAt(b + vec2(1.5, 0.5));
    C = loreAt(b + vec2(0.5, 1.5)); D = loreAt(b + vec2(1.5, 1.5));
  } else {
    A = polAt(b + vec2(0.5, 0.5)); B = polAt(b + vec2(1.5, 0.5));
    C = polAt(b + vec2(0.5, 1.5)); D = polAt(b + vec2(1.5, 1.5));
    uvec4 ia = provInfo(A.r), ib = provInfo(B.r), ic = provInfo(C.r), id_ = provInfo(D.r);
    A.g = ia.r; B.g = ib.r; C.g = ic.r; D.g = id_.r;
    if (kind == 2) {
      A.b = ia.g; B.b = ib.g; C.b = ic.g; D.b = id_.g;
      A.a = ia.b; B.a = ib.b; C.a = ic.b; D.a = id_.b;
    }
  }
  vec4 wt = vec4((1.0 - f.x) * (1.0 - f.y), f.x * (1.0 - f.y), (1.0 - f.x) * f.y, f.x * f.y);
  uint i0, i1, i2, i3;
  float m0, m1, m2, m3;
  majority(A.r, B.r, C.r, D.r, wt, i0, m0);
  majority(A.g, B.g, C.g, D.g, wt, i1, m1);
  majority(A.b, B.b, C.b, D.b, wt, i2, m2);
  majority(A.a, B.a, C.a, D.a, wt, i3, m3);
  id = uvec4(i0, i1, i2, i3);
  m = vec4(m0, m1, m2, m3);
}

// déformation douce des frontières (tracés naturels plutôt que géométriques)
vec2 borderWarp(vec3 p) {
  return vec2(snoise(p * 0.6 + 13.1), snoise(p * 0.6 + 47.3)) * 0.35
       + vec2(snoise(p * 2.2 + 3.3), snoise(p * 2.2 + 8.8)) * 0.12 * smoothstep(1.0, 3.0, uScale / 2.2);
}

// rotation de teinte (autour de l'axe gris) : variations d'une même couleur de pays
vec3 hueShift(vec3 c, float a) {
  const vec3 k = vec3(0.57735);
  float ca = cos(a);
  return c * ca + cross(k, c) * sin(a) + k * dot(k, c) * (1.0 - ca);
}

float hash1(uint id, uint salt) {
  uint h = (id ^ salt) * 2654435761u;
  h ^= h >> 15;
  h *= 2246822519u;
  h ^= h >> 13;
  return float(h & 65535u) / 65535.0;
}

vec3 hashColor(uint id) {
  uint h = id * 2654435761u;
  h ^= h >> 15;
  h *= 2246822519u;
  h ^= h >> 13;
  vec3 c = vec3(float(h & 255u), float((h >> 8) & 255u), float((h >> 16) & 255u)) / 255.0;
  return mix(vec3(0.55), c, 0.6);
}

float edgeOf(float m, float px) {
  return 1.0 - smoothstep(0.0, fwidth(m) * px + 1e-4, m);
}

// ---------- nuages et éclairage solaire ----------
vec3 sphereOf(vec2 w) {
  float lat = radians(uLatMax - w.y / uWorld.y * 2.0 * uLatMax);
  float lon = w.x / uWorld.x * 2.0 * PI - PI;
  return vec3(cos(lat) * cos(lon), cos(lat) * sin(lon), sin(lat));
}
vec3 rotZ(vec3 v, float a) {
  float c = cos(a), s = sin(a);
  return vec3(c * v.x - s * v.y, s * v.x + c * v.y, v.z);
}
// champ nuageux sur la sphère, entraîné par les vents dominants (alizés vers l'ouest, vents d'ouest aux
// latitudes moyennes, vents polaires d'est) ; deux couches décalées d'une demi-période et fondues l'une
// dans l'autre pour une animation sans fin et sans cisaillement cumulé
float cloudNoise(vec3 s, float oct) {
  // grandes structures (fronts, dépressions enroulées) puis détail de plus en plus fin
  vec3 q = s * 2.6;
  q += 0.9 * vec3(snoise(s * 1.4 + 11.0), snoise(s * 1.4 + 23.0), snoise(s * 1.4 + 37.0));
  float a = 0.55, f = 1.0, v = 0.0;
  for (int i = 0; i < 6; i++) {
    if (float(i) >= oct) break;
    v += a * snoise(q * f);
    f *= 2.13;
    a *= 0.48;
  }
  return v;
}
float cloudAt(vec3 s, float cover, float oct) {
  float latD = degrees(asin(clamp(s.z, -1.0, 1.0)));
  float aL = abs(latD);
  float v = mix(-0.8, 1.2, smoothstep(24.0, 36.0, aL));
  v = mix(v, -0.5, smoothstep(56.0, 66.0, aL));
  const float PER = 60.0;
  float ph = fract(uTime / PER);
  float k = v * 0.0035 * PER;
  float n1 = cloudNoise(rotZ(s, ph * k), oct);
  float n2 = cloudNoise(rotZ(s, fract(ph + 0.5) * k) + 17.0, oct);
  float w1 = 1.0 - abs(2.0 * ph - 1.0);
  float n = mix(n2, n1, w1);
  float thr = mix(0.38, -0.3, cover);
  return smoothstep(thr, thr + 0.42, n);
}

void main() {
  vec2 sp = vec2(gl_FragCoord.x, uViewport.y - gl_FragCoord.y);
  vec2 w = uCenter + (sp - 0.5 * uViewport) / uScale;
  if (w.y < 0.0 || w.y > uWorld.y) {
    outColor = vec4(0.045, 0.05, 0.055, 1.0);
    return;
  }
  vec2 uv = w / uWorld;
  vec3 p = cyl(w);

  float hb = hLin(w);
  vec2 clim = texture(uClimate, uv).rg;
  float e = clamp(0.8 / uScale, 0.02, 1.5);
  float cL = hCubic(w - vec2(e, 0.0)), cR = hCubic(w + vec2(e, 0.0));
  float cU = hCubic(w - vec2(0.0, e)), cD = hCubic(w + vec2(0.0, e));
  // pente du relief de base (m / cellule) : le micro-relief suit le relief réel,
  // une plaine reste une plaine, une montagne devient accidentée
  float gBase = length(vec2(cR - cL, cD - cU)) / (2.0 * e);
  float iceK = mix(1.0, 0.3, smoothstep(-6.0, -14.0, clim.r));
  float ampRidge = hb > 0.0 ? (0.13 * hb * smoothstep(350.0, 2500.0, hb) + 110.0 * smoothstep(25.0, 260.0, gBase)) * iceK : 0.0;
  float ampSoft = hb > 0.0 ? 4.0 + 0.012 * hb : 8.0;
  // relief de base (bicubique, différences finies) + micro-relief évalué une seule fois, sa pente
  // venant des dérivées écran (4× moins de bruit à calculer qu'avec quatre échantillons)
  vec2 gCell = vec2(cR - cL, cD - cU) / (2.0 * e);
  float det = detailH(w, ampRidge, ampSoft, length(gCell));
  vec2 gDet = vec2(dFdx(det), -dFdy(det)) * uScale;
  float hPix = 0.25 * (cL + cR + cU + cD) + det;
  float latDeg = uLatMax - w.y / uWorld.y * 2.0 * uLatMax;
  float cosLat = max(cos(radians(latDeg)), 0.05);
  float cellM = uCellKm * 1000.0;
  vec2 grad = vec2((gCell.x + gDet.x) / (cellM * cosLat), (gCell.y + gDet.y) / cellM);
  vec3 N = normalize(vec3(-grad * uExag, 1.0));
  vec3 L = normalize(vec3(-0.55, -0.7, 0.95));
  float shade = dot(N, L) / L.z;

  // trait de côte : distance signée à la côte (cellules) + bruit fractal
  vec4 wat = texture(uWater, uv);
  float cn = snoise(p * 1.6) * 0.6 + snoise(p * 4.1) * 0.25 * smoothstep(1.0, 3.0, uScale / 4.1)
           + snoise(p * 9.3) * 0.06 * smoothstep(1.5, 4.0, uScale / 9.3);
  float hv = wat.a + cn * 0.45;
  bool isSea = hv < 0.0;
  float depth = isSea ? max(-hb, 0.0) : 0.0;

  // rive des lacs : distance signée (cellules, − dans le lac) + même bruit fractal que les côtes
  float lakeV = -wat.b + cn * 0.35;
  bool isLake = !isSea && lakeV > 0.0;

  float T = clim.r - max(hPix - max(hb, 0.0), -500.0) * 0.0065;
  float P = clim.g;

  float slope = length(grad);
  const vec3 LUMA = vec3(0.299, 0.587, 0.114);

  // couleur « terrain » (base de la plupart des modes)
  vec3 terr;
  if (isSea) {
    terr = oceanColor(depth, T, shade, p);
  } else if (isLake) {
    vec3 fresh = vec3(0.22, 0.38, 0.46), salt = vec3(0.60, 0.68, 0.66);
    terr = mix(fresh, salt, wat.g) * mix(1.0, 0.8, smoothstep(0.0, 200.0, wat.r));
    terr = mix(terr, vec3(0.84, 0.88, 0.91), smoothstep(-2.0, -6.0, T));
  } else {
    terr = vegetation(T, P, p);
    float n3 = snoise(p * 1.3 + 1.3);
    float rock = clamp(smoothstep(0.035, 0.14, slope) * 0.65 + smoothstep(1800.0, 4200.0, hPix) * 0.55, 0.0, 0.85);
    terr = mix(terr, vec3(0.45, 0.42, 0.38) * (0.94 + 0.08 * n3), rock);
    // neiges éternelles : haut des versants, moins sur les pentes raides et les versants au soleil
    float snow = smoothstep(-4.0, -10.0, T + n3 * 1.5 - (shade - 1.0) * 2.0) * (1.0 - 0.55 * smoothstep(0.1, 0.35, slope));
    if (uForests > 0.5) terr = forestPaint(terr, w, p, clamp(rock * 1.3 + snow, 0.0, 1.0));
    terr = mix(terr, vec3(0.94, 0.95, 0.97), snow);
    terr *= clamp(mix(1.0, shade, 0.9), 0.18, 1.45);
    terr = mix(vec3(dot(terr, LUMA)), terr, 0.88);
  }
  float tl = dot(terr, LUMA);
  bool landPx = !isSea && !isLake;

  // couches politiques (échantillonnage majoritaire lissé)
  uvec4 pid = uvec4(NONE);
  vec4 pm = vec4(1.0);
  bool geo = uMode == M_POLITICAL || uMode == M_PROVINCES || uMode == M_TRADE || uMode == M_INFLUENCE || uMode == M_CONTINENTS;

  bool loreMode = uMode == M_CULTURES || uMode == M_RELIGIONS;
  bool stMode = uMode == M_STATES || uMode == M_REGIONS;
  geo = geo || loreMode || stMode;
  vec2 bwp = w + borderWarp(p);
  if (geo) polSample(bwp, stMode ? 2 : 0, pid, pm);
  uvec4 lid = uvec4(NONE);
  vec4 lm = vec4(1.0);
  if (loreMode) polSample(bwp, 1, lid, lm);
  float cEdge = landPx || isLake ? edgeOf(pm.g, 1.8) : 0.0;
  float pEdge = landPx ? edgeOf(pm.r, 0.9) : 0.0;
  float iEdge = landPx ? edgeOf(pm.b, 1.0) : 0.0;
  bool owned = pid.g != NONE;

  vec3 col;
  uvec4 misc = texelFetch(uMisc, cellOf(w), 0);
  if (uMode == M_TERRAIN) {
    col = terr;
  } else if (uMode == M_POLITICAL) {
    col = terr;
    if (landPx && owned) {
      float front;
      vec3 pc = ownerColor(pid.r, pid.g, p, front);
      float k = int(pid.g) == uHover ? 0.78 : 0.66;
      col = mix(terr, pc * (0.5 + 0.85 * tl), k);
      // front doré de la conquête qui avance (transition de la frise)
      col = mix(col, vec3(1.0, 0.8, 0.36), front * 0.75);
      if (int(pid.g) == uSelected) col = mix(col, vec3(1.0, 0.95, 0.8), 0.18);
      col *= 1.0 - pEdge * 0.16 * smoothstep(1.5, 4.0, uScale);
    }
    col = mix(col, vec3(0.07, 0.06, 0.05), cEdge * 0.8);
  } else if (uMode == M_PROVINCES) {
    col = terr;
    if (landPx && pid.r != NONE) {
      // dégradé autour de la couleur du pays : teinte, luminosité et saturation légèrement variées
      float front;
      vec3 base = owned ? ownerColor(pid.r, pid.g, p, front) : vec3(0.55);
      vec3 pc = hueShift(base, (hash1(pid.r, 11u) - 0.5) * 0.42) * (0.8 + 0.4 * hash1(pid.r, 23u));
      pc = mix(vec3(dot(pc, LUMA)), pc, 0.8 + 0.5 * hash1(pid.r, 37u));
      col = mix(terr, clamp(pc, 0.0, 1.0) * (0.55 + 0.75 * tl), 0.66);
      col = mix(col, vec3(1.0, 0.8, 0.36), front * 0.75);
    }
    col *= 1.0 - pEdge * 0.4;
    col = mix(col, vec3(0.06), cEdge * 0.85);
  } else if (uMode == M_STATES) {
    // États : nuances de la couleur du pays, limites d'États marquées, provinces à peine visibles
    col = terr;
    if (landPx && pid.b != NONE) {
      float front;
      vec3 base = owned ? ownerColor(pid.r, pid.g, p, front) : vec3(0.55);
      vec3 sc = hueShift(base, (hash1(pid.b, 53u) - 0.5) * 0.34) * (0.84 + 0.32 * hash1(pid.b, 71u));
      float k = int(pid.b) == uHover ? 0.8 : 0.66;
      col = mix(terr, clamp(sc, 0.0, 1.0) * (0.55 + 0.75 * tl), k);
      col = mix(col, vec3(1.0, 0.8, 0.36), front * 0.75);
      if (int(pid.b) == uSelected) col = mix(col, vec3(1.0, 0.95, 0.8), 0.22);
    }
    float sEdge = landPx ? edgeOf(pm.b, 1.3) : 0.0;
    col *= 1.0 - pEdge * 0.1 * smoothstep(2.0, 5.0, uScale);
    col *= 1.0 - sEdge * 0.5;
    col = mix(col, vec3(0.06), cEdge * 0.85);
  } else if (uMode == M_REGIONS) {
    // régions historiques : couleurs propres, traits épais ; frontières politiques discrètes
    col = mix(vec3(tl), terr, 0.5);
    if (landPx && pid.a != NONE) {
      float k = int(pid.a) == uHover ? 0.78 : 0.62;
      col = mix(terr, pal(pid.a, 6) * (0.5 + 0.8 * tl), k);
      if (int(pid.a) == uSelected) col = mix(col, vec3(1.0, 0.95, 0.8), 0.22);
    }
    float sEdge = landPx ? edgeOf(pm.b, 0.9) : 0.0;
    float rEdge = landPx ? edgeOf(pm.a, 2.0) : 0.0;
    col *= 1.0 - sEdge * 0.2;
    col = mix(col, vec3(0.08, 0.06, 0.04), rEdge * 0.75);
    col = mix(col, vec3(0.05), cEdge * 0.3);
  } else if (uMode == M_CULTURES) {
    col = mix(vec3(tl), terr, 0.5);
    if (landPx && lid.r != NONE) col = mix(terr, pal(lid.r, 3) * (0.5 + 0.8 * tl), 0.66);
    float ce = landPx ? edgeOf(lm.r, 0.9) : 0.0;
    float ge = landPx ? edgeOf(lm.b, 2.0) : 0.0;
    col *= 1.0 - ce * 0.35;
    col = mix(col, vec3(0.08, 0.06, 0.04), ge * 0.7);
    col = mix(col, vec3(0.05), cEdge * 0.25);
  } else if (uMode == M_RELIGIONS) {
    col = mix(vec3(tl), terr, 0.5);
    if (landPx && lid.g != NONE) col = mix(terr, pal(lid.g, 4) * (0.5 + 0.8 * tl), 0.68);
    float re = landPx ? edgeOf(lm.g, 1.0) : 0.0;
    float fe = landPx ? edgeOf(lm.a, 2.0) : 0.0;
    col *= 1.0 - re * 0.35;
    col = mix(col, vec3(0.08, 0.06, 0.04), fe * 0.65);
    col = mix(col, vec3(0.05), cEdge * 0.25);
  } else if (uMode == M_TRADE) {
    col = mix(vec3(tl), terr, 0.35) * 0.78;
    if (landPx && owned) col = mix(col, pal(pid.g, 0) * (0.45 + 0.6 * tl), 0.18);
    col = mix(col, vec3(0.05), cEdge * 0.45);
  } else if (uMode == M_INFLUENCE) {
    col = terr * 0.85;
    if (landPx && pid.b != NONE) {
      float st = texture(uExtra, uv).r;
      col = mix(terr * 0.8, pal(pid.b, 2) * (0.5 + 0.8 * tl), 0.3 + 0.5 * st);
    }
    col *= 1.0 - iEdge * 0.5;
    col = mix(col, vec3(0.05), cEdge * 0.75);
  } else if (uMode == M_CONTINENTS) {
    col = terr;
    if (pid.a != NONE) {
      vec3 kc = pal(pid.a, 1);
      col = isSea ? mix(terr, kc * 0.55 + 0.12, 0.42) : mix(terr, kc * (0.5 + 0.8 * tl), 0.62);
    } else if (landPx) {
      col = mix(terr, vec3(tl), 0.6);
    }
    col *= 1.0 - edgeOf(pm.a, 1.6) * 0.6;
  } else if (uMode == M_RELIEF) {
    if (isSea) {
      col = mix(vec3(0.60, 0.78, 0.86), vec3(0.08, 0.18, 0.40), smoothstep(0.0, 1.0, pow(depth / 7000.0, 0.45)));
      col *= mix(1.0, clamp(shade, 0.7, 1.3), 0.5);
    } else if (isLake) {
      col = vec3(0.45, 0.66, 0.82);
    } else {
      col = hypso(hPix) * clamp(mix(1.0, shade, 0.85), 0.25, 1.4);
    }
  } else if (uMode == M_PLATES) {
    vec3 pc = texelFetch(uPalette, ivec2(int(misc.g), 0), 0).rgb;
    col = pc * (isSea ? 0.62 : 1.0) * clamp(mix(1.0, shade, 0.5), 0.5, 1.3);
    uint bt = misc.b;
    if (bt == 1u) col = mix(col, vec3(0.92, 0.18, 0.15), 0.9);
    else if (bt == 2u) col = mix(col, vec3(0.15, 0.78, 0.95), 0.9);
    else if (bt == 3u) col = mix(col, vec3(0.98, 0.86, 0.2), 0.8);
  } else if (uMode == M_TEMPERATURE) {
    col = tempRamp(T) * clamp(mix(1.0, shade, 0.35), 0.6, 1.25);
    if (isSea) col *= 0.82;
  } else if (uMode == M_PRECIPITATION) {
    col = precipRamp(P) * clamp(mix(1.0, shade, 0.35), 0.6, 1.25);
    if (isSea) col *= 0.7;
  } else {
    col = texelFetch(uPalette, ivec2(int(misc.r), 1), 0).rgb * clamp(mix(1.0, shade, 0.55), 0.45, 1.3);
  }
  bool terrainLike = uMode == M_TERRAIN || geo;

  // contours des côtes et des lacs
  float fw = max(fwidth(hv), 1e-4);
  float coast = 1.0 - smoothstep(0.3, 1.15, abs(hv) / fw);
  float fl = max(fwidth(lakeV), 1e-4);
  float lakeEdge = isSea ? 0.0 : 1.0 - smoothstep(0.3, 1.15, abs(lakeV) / fl);
  float edge = max(coast, lakeEdge * 0.8);
  // liseré côtier : eau plus claire le long du rivage, trait fin qui assombrit sans virer au noir
  if (terrainLike && isSea && uMode != M_CONTINENTS) col = mix(col, vec3(0.30, 0.45, 0.50), 0.28 * smoothstep(-0.9, 0.0, hv) * (1.0 - smoothstep(-1.0, -4.0, T)));
  float edgeK = (uMode == M_PLATES ? 0.35 : 0.42) * mix(0.45, 1.0, smoothstep(0.4, 2.5, uScale));
  col *= 1.0 - edge * edgeK;

  if (uGrid > 0.5) col = mix(col, vec3(0.85, 0.82, 0.7), gridLine(w));

  vec3 sph = sphereOf(w);
  float cz = dot(sph, uSun);
  float day = uNight > 0.5 ? smoothstep(-0.1, 0.07, cz) : 1.0;
  // --- nuit : terre dans l'ombre, lumières des régions peuplées ---
  if (uNight > 0.5) {
    vec3 nightCol = col * vec3(0.16, 0.19, 0.3) + vec3(0.006, 0.009, 0.02);
    float dens = texture(uExtra, uv).g;
    // campagnes habitées : faible lueur diffuse (les villes ont leur halo dans la couche animée)
    float lights = landPx ? smoothstep(6.0, 45.0, dens) * (0.55 + 0.45 * snoise(p * 2.5 + 3.0)) : 0.0;
    nightCol += vec3(1.0, 0.74, 0.4) * max(lights, 0.0) * 0.22;
    float dusk = exp(-(cz * cz) / 0.004);
    col = mix(nightCol, col, day) + vec3(0.32, 0.14, 0.05) * dusk * 0.18;
  }
  // --- nuages : ombre portée puis voile, estompés au fort zoom (on passe sous la couche) ---
  if (uClouds > 0.5) {
    float kmPx = uCellKm / max(uScale / uDpr, 1e-3);
    float fade = smoothstep(0.25, 2.5, kmPx);
    if (fade > 0.0) {
      float cover = smoothstep(150.0, 2600.0, P) * 0.8 + 0.12;
      float c = cloudAt(sph, cover, 6.0);
      vec3 toSun = normalize(uSun - sph * dot(uSun, sph) + vec3(1e-5));
      float sh = cloudAt(normalize(sph + toSun * 0.006), cover, 3.0);
      col *= 1.0 - 0.32 * sh * fade * day;
      float lit = 0.72 + 0.28 * smoothstep(-0.2, 0.6, cloudNoise(sph * 1.7 + 5.0, 2.0));
      vec3 cloudCol = mix(vec3(0.05, 0.06, 0.09), vec3(lit, lit, lit * 1.03), day);
      col = mix(col, cloudCol, c * 0.82 * fade);
    }
  }
  outColor = vec4(col, 1.0);
}
`;
