import { BIOMES } from '../gen/biomes';
import type { WorldData } from '../gen/types';

/** Table de couleur de la végétation/sol : axe X = température (°C), axe Y = log2(P / ETP). */
export const LUT_W = 128;
export const LUT_H = 72;
export const LUT_T_MIN = -30;
export const LUT_T_MAX = 35;
export const LUT_A_MIN = -5;
export const LUT_A_MAX = 4;

// [température, log2 aridité, r, g, b] — teintes "vue satellite" légèrement désaturées façon HOI4
const ANCHORS: number[][] = [
  // inlandsis
  [-26, -3, 226, 230, 234], [-26, 0, 228, 232, 236], [-26, 3, 230, 234, 238],
  // toundra
  [-10, -2.5, 146, 138, 116], [-10, -0.5, 126, 124, 102], [-10, 1.5, 108, 112, 92],
  // taïga
  [-1, 1.8, 50, 66, 48], [-1, 0.4, 68, 82, 58], [-1, -1.2, 124, 118, 90], [-1, -3, 160, 150, 122],
  // steppes et déserts froids
  [6, -3.2, 184, 168, 130], [6, -1.6, 156, 146, 104], [6, -0.3, 104, 112, 70],
  // tempéré
  [13, -3.4, 200, 178, 136], [13, -1.6, 164, 152, 98], [13, -0.6, 132, 134, 78], [13, 0.4, 84, 106, 56], [13, 1.8, 56, 86, 48],
  // subtropical / tropical
  [23, -4, 220, 192, 142], [23, -2.4, 206, 174, 114], [23, -1.3, 174, 154, 88], [23, -0.5, 136, 134, 68],
  [23, 0.3, 92, 112, 50], [23, 1.3, 52, 88, 40], [23, 2.6, 38, 76, 34],
  [32, -4.2, 224, 194, 142], [32, -2, 206, 172, 110], [32, 0, 118, 122, 58], [32, 2.6, 36, 72, 32],
];

export function buildClimateLut(): Uint8Array {
  const data = new Uint8Array(LUT_W * LUT_H * 4);
  for (let y = 0; y < LUT_H; y++) {
    const la = LUT_A_MIN + (y / (LUT_H - 1)) * (LUT_A_MAX - LUT_A_MIN);
    for (let x = 0; x < LUT_W; x++) {
      const t = LUT_T_MIN + (x / (LUT_W - 1)) * (LUT_T_MAX - LUT_T_MIN);
      let r = 0, g = 0, b = 0, ws = 0;
      for (const a of ANCHORS) {
        const dt = (t - a[0]) / 6.5;
        const da = (la - a[1]) / 0.85;
        const w = Math.exp(-(dt * dt + da * da)) + 1e-12;
        r += a[2] * w;
        g += a[3] * w;
        b += a[4] * w;
        ws += w;
      }
      const o = (y * LUT_W + x) * 4;
      data[o] = r / ws;
      data[o + 1] = g / ws;
      data[o + 2] = b / ws;
      data[o + 3] = 255;
    }
  }
  return data;
}

function hsl(h: number, s: number, l: number): [number, number, number] {
  const k = (n: number) => (n + h * 12) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
}

/** Palette 256×2 : ligne 0 = plaques, ligne 1 = biomes. */
export function buildPalette(continental: boolean[]): Uint8Array {
  const data = new Uint8Array(256 * 2 * 4);
  for (let i = 0; i < 256; i++) {
    const c = hsl((i * 0.61803398875) % 1, continental[i] ? 0.5 : 0.35, continental[i] ? 0.56 : 0.4);
    data.set([c[0], c[1], c[2], 255], i * 4);
  }
  BIOMES.forEach((b, i) => data.set([...b.color, 255], (256 + i) * 4));
  return data;
}

export function plateColorCss(id: number, continental: boolean): string {
  const c = hsl((id * 0.61803398875) % 1, continental ? 0.5 : 0.35, continental ? 0.56 : 0.4);
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

/** Palette 1024×6 : pays, continents, villes (teinte de leur pays), cultures, religions, familles culturelles. */
/** Lignes de la palette politique : pays, continents, villes, cultures, religions, familles culturelles, régions. */
export const POL_PAL_ROWS = 7;

export function buildPolPalette(world: WorldData): Uint8Array {
  const pol = world.politics;
  const data = new Uint8Array(1024 * POL_PAL_ROWS * 4);
  pol.cultures.forEach((c, i) => i < 1024 && data.set([...c.color, 255], (3 * 1024 + i) * 4));
  pol.religions.forEach((r, i) => i < 1024 && data.set([...r.color, 255], (4 * 1024 + i) * 4));
  pol.cultureGroups.forEach((g, i) => i < 1024 && data.set([...g.color, 255], (5 * 1024 + i) * 4));
  pol.countries.forEach((c, i) => {
    if (i < 1024) data.set([...c.color, 255], i * 4);
  });
  const contHues = [0.08, 0.33, 0.58, 0.83, 0.16, 0.45, 0.7, 0.95, 0.25, 0.52];
  pol.continents.forEach((k, i) => {
    if (i >= 1024) return;
    const c = k.kind === 'archipel' ? hsl(0.12, 0.15, 0.62) : hsl(contHues[i % contHues.length], 0.42, k.kind === 'continent' ? 0.52 : 0.62);
    data.set([...c, 255], (1024 + i) * 4);
  });
  // régions historiques : teintes réparties par le nombre d'or, saturation modérée
  pol.regions.forEach((_, i) => {
    if (i >= 1024) return;
    const c = hsl((i * 0.61803398875 + 0.07) % 1, 0.24 + 0.1 * ((i * 0.37) % 1), 0.54 + 0.1 * ((i * 0.7548776662) % 1));
    data.set([...c, 255], (6 * 1024 + i) * 4);
  });
  pol.cities.forEach((city, i) => {
    if (i >= 1024) return;
    const base = city.country >= 0 ? pol.countries[city.country].color : [150, 150, 150];
    // variations de luminosité autour de la couleur du pays : zones voisines distinguables
    const k = 0.72 + 0.56 * (((i * 0.61803398875) % 1));
    data.set([Math.min(255, base[0] * k), Math.min(255, base[1] * k), Math.min(255, base[2] * k), 255], (2048 + i) * 4);
  });
  return data;
}
