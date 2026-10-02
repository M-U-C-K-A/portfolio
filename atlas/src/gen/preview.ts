import type { Grid } from './grid';
import { buildClimateLut, LUT_A_MAX, LUT_A_MIN, LUT_H, LUT_T_MAX, LUT_T_MIN, LUT_W } from '../render/palette';

/** Petite image RGBA du monde en cours de formation (envoyée par le worker pendant la génération). */
export interface PreviewImage {
  w: number;
  h: number;
  data: Uint8ClampedArray;
}

export type PreviewFn = (stage: string, img: PreviewImage) => void;

/** Largeur des aperçus : assez pour un bel effet, négligeable devant le coût de la génération. */
const PW = 1024;

function sampler(grid: Grid): { w: number; h: number; idx: Int32Array } {
  const w = Math.min(PW, grid.W), h = Math.max(8, Math.round((w * grid.H) / grid.W));
  const idx = new Int32Array(w * h);
  for (let y = 0; y < h; y++) {
    const gy = Math.min(grid.H - 1, Math.floor(((y + 0.5) * grid.H) / h));
    for (let x = 0; x < w; x++) idx[y * w + x] = gy * grid.W + Math.min(grid.W - 1, Math.floor(((x + 0.5) * grid.W) / w));
  }
  return { w, h, idx };
}

const HYPSO: [number, number, number, number][] = [
  [-6000, 10, 28, 60], [-3000, 22, 52, 98], [-200, 44, 92, 140], [-1, 70, 126, 165],
  [0, 86, 138, 88], [300, 128, 160, 98], [900, 196, 186, 124], [1800, 170, 128, 92], [3000, 138, 112, 100], [4500, 236, 236, 240],
];
function hypso(h: number, out: Uint8ClampedArray, o: number): void {
  let k = 0;
  while (k < HYPSO.length - 2 && h > HYPSO[k + 1][0]) k++;
  const a = HYPSO[k], b = HYPSO[k + 1];
  const t = Math.max(0, Math.min(1, (h - a[0]) / (b[0] - a[0])));
  out[o] = a[1] + (b[1] - a[1]) * t;
  out[o + 1] = a[2] + (b[2] - a[2]) * t;
  out[o + 2] = a[3] + (b[3] - a[3]) * t;
  out[o + 3] = 255;
}

/** Relief ombré en teintes hypsométriques (`ocean` facultatif : sinon mer = altitude < 0). */
export function reliefPreview(grid: Grid, elev: Float32Array, ocean?: Uint8Array): PreviewImage {
  const { w, h, idx } = sampler(grid);
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = idx[y * w + x];
      const sea = ocean ? ocean[i] === 1 : elev[i] < 0;
      const v = sea ? Math.min(elev[i], -1) : Math.max(elev[i], 0);
      const o = (y * w + x) * 4;
      hypso(v, data, o);
      if (!sea) {
        // ombrage depuis le nord-ouest (pente sur deux pixels : moins de bruit)
        const l = idx[y * w + Math.max(0, x - 2)], u = idx[Math.max(0, y - 2) * w + x];
        const sh = Math.max(0.5, Math.min(1.4, 1 + ((Math.max(0, elev[l]) - elev[i]) + (Math.max(0, elev[u]) - elev[i])) * 0.0006));
        data[o] *= sh;
        data[o + 1] *= sh;
        data[o + 2] *= sh;
      }
    }
  }
  return { w, h, data };
}

/**
 * Croûte terrestre au moment où les plaques se forment : cratons continentaux en teintes de terre,
 * plancher océanique en bleus profonds, failles en traits sombres (pas de couleurs arbitraires).
 */
export function platesPreview(grid: Grid, plate: Uint8Array, boundary: Uint8Array, continental: boolean[] = []): PreviewImage {
  const { w, h, idx } = sampler(grid);
  const data = new Uint8ClampedArray(w * h * 4);
  for (let k = 0; k < w * h; k++) {
    const i = idx[k], p = plate[i];
    const v = ((p * 0.61803398875) % 1) * 0.12 - 0.06;
    const o = k * 4;
    const c = continental[p] ? [150 + 60 * v, 140 + 50 * v, 104 + 30 * v] : [24 + 30 * v, 52 + 40 * v, 86 + 50 * v];
    const b = boundary[i];
    const dark = b === 1 ? 0.55 : b ? 0.75 : 1;
    data[o] = c[0] * dark;
    data[o + 1] = c[1] * dark;
    data[o + 2] = c[2] * dark;
    data[o + 3] = 255;
  }
  return { w, h, data };
}

/** Couleurs par catégorie (biomes, pays…) sur fond de relief ombré. */
export function categoryPreview(grid: Grid, elev: Float32Array, ocean: Uint8Array, cat: ArrayLike<number>, color: (c: number) => [number, number, number] | null): PreviewImage {
  const img = reliefPreview(grid, elev, ocean);
  const { w, h, idx } = sampler(grid);
  const d = img.data;
  for (let k = 0; k < w * h; k++) {
    const i = idx[k];
    if (ocean[i]) continue;
    const c = color(cat[i]);
    if (!c) continue;
    const o = k * 4;
    const lum = (d[o] + d[o + 1] + d[o + 2]) / (3 * 150);
    d[o] = c[0] * (0.55 + 0.5 * lum);
    d[o + 1] = c[1] * (0.55 + 0.5 * lum);
    d[o + 2] = c[2] * (0.55 + 0.5 * lum);
  }
  void h;
  return img;
}

export function hsl(h: number, s: number, l: number): [number, number, number] {
  const k = (n: number) => (n + h * 12) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
}

/** Trace les fleuves (triplets x, y, débit en cellules) sur un aperçu, épaisseur selon le débit. */
export function drawRivers(img: PreviewImage, grid: Grid, pts: Float32Array, offsets: Uint32Array, minQ: number): PreviewImage {
  const { w, h, data } = img;
  const sx = w / grid.W, sy = h / grid.H;
  const plot = (x: number, y: number, a: number) => {
    const px = ((Math.round(x) % w) + w) % w, py = Math.round(y);
    if (py < 0 || py >= h) return;
    const o = (py * w + px) * 4;
    data[o] += (52 - data[o]) * a;
    data[o + 1] += (104 - data[o + 1]) * a;
    data[o + 2] += (178 - data[o + 2]) * a;
  };
  for (let r = 0; r + 1 < offsets.length; r++) {
    for (let k = offsets[r]; k + 1 < offsets[r + 1]; k++) {
      const q = pts[k * 3 + 2];
      if (q < minQ) continue;
      const a = Math.min(0.95, 0.35 + 0.2 * Math.log10(q / minQ + 1));
      const x0 = pts[k * 3] * sx, y0 = pts[k * 3 + 1] * sy, x1 = pts[k * 3 + 3] * sx, y1 = pts[k * 3 + 4] * sy;
      const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0)));
      for (let s = 0; s <= n; s++) plot(x0 + ((x1 - x0) * s) / n, y0 + ((y1 - y0) * s) / n, a);
    }
  }
  return img;
}


let LUT: Uint8Array | null = null;
// densité de boisement par biome (comme le rendu de la carte) : assombrit les forêts sur l'aperçu
const FOREST_D = [0, 0, 0, 0, 0, 0, 0.06, 0.92, 0.03, 0.86, 1, 0.34, 0, 0, 0.14, 0.62, 1, 0.42, 0.05, 0, 0.07, 0];

/**
 * Le monde « vu du ciel », dans les teintes du rendu final : végétation selon la température et
 * l'aridité, forêts plus sombres, neiges et roches d'altitude, relief ombré, mers selon la profondeur.
 */
export function naturalPreview(grid: Grid, elev: Float32Array, ocean: Uint8Array, temp: Float32Array, precip: Float32Array, biome?: Uint8Array): PreviewImage {
  LUT ??= buildClimateLut();
  const lut = LUT;
  const { w, h, idx } = sampler(grid);
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = idx[y * w + x];
      const o = (y * w + x) * 4;
      const T = temp[i];
      if (ocean[i]) {
        const d = Math.min(1, Math.pow(Math.max(0, -elev[i]) / 5500, 0.5));
        const ice = Math.max(0, Math.min(1, (-1.5 - T) / 2.5));
        data[o] = (56 - 40 * d) * (1 - ice) + 212 * ice;
        data[o + 1] = (94 - 62 * d) * (1 - ice) + 222 * ice;
        data[o + 2] = (110 - 52 * d) * (1 - ice) + 230 * ice;
        data[o + 3] = 255;
        continue;
      }
      const pet = Math.max(150, Math.min(1700, 300 + 45 * T));
      const la = Math.log2(Math.max(precip[i], 5) / pet);
      const lx = Math.round(Math.max(0, Math.min(1, (T - LUT_T_MIN) / (LUT_T_MAX - LUT_T_MIN))) * (LUT_W - 1));
      const ly = Math.round(Math.max(0, Math.min(1, (la - LUT_A_MIN) / (LUT_A_MAX - LUT_A_MIN))) * (LUT_H - 1));
      const lo = (ly * LUT_W + lx) * 4;
      let r = lut[lo], g = lut[lo + 1], b = lut[lo + 2];
      const f = biome ? FOREST_D[biome[i]] ?? 0 : 0;
      if (f > 0) {
        r = r * (1 - 0.45 * f) + 34 * 0.45 * f;
        g = g * (1 - 0.45 * f) + 58 * 0.45 * f;
        b = b * (1 - 0.45 * f) + 30 * 0.45 * f;
      }
      const rock = Math.max(0, Math.min(0.7, (elev[i] - 2200) / 2500));
      r += (112 - r) * rock;
      g += (106 - g) * rock;
      b += (98 - b) * rock;
      const snow = Math.max(0, Math.min(1, (-5 - T) / 5));
      r += (238 - r) * snow;
      g += (240 - g) * snow;
      b += (244 - b) * snow;
      const l = idx[y * w + Math.max(0, x - 2)], u = idx[Math.max(0, y - 2) * w + x];
      const sh = Math.max(0.5, Math.min(1.4, 1 + ((Math.max(0, elev[l]) - elev[i]) + (Math.max(0, elev[u]) - elev[i])) * 0.0006));
      data[o] = r * sh;
      data[o + 1] = g * sh;
      data[o + 2] = b * sh;
      data[o + 3] = 255;
    }
  }
  return { w, h, data };
}

/** Copie d'un aperçu (pour superposer plusieurs couches politiques à une même base). */
export function clonePreview(img: PreviewImage): PreviewImage {
  return { w: img.w, h: img.h, data: new Uint8ClampedArray(img.data) };
}

/** Teinte légère d'une couleur par catégorie (pays…), en multipliant la base : le relief reste lisible. */
export function tintPreview(img: PreviewImage, grid: Grid, cat: ArrayLike<number>, color: (c: number) => readonly number[] | null, k: number): PreviewImage {
  const { w, h, idx } = sampler(grid);
  const d = img.data;
  for (let p = 0; p < w * h; p++) {
    const c = cat[idx[p]];
    if (c < 0) continue;
    const col = color(c);
    if (!col) continue;
    const o = p * 4;
    for (let j = 0; j < 3; j++) d[o + j] = d[o + j] * (1 - k) + ((d[o + j] * col[j]) / 160) * k;
  }
  void h;
  return img;
}

/** Limites entre catégories (provinces, États, pays) en traits sombres, comme à l'encre. */
export function bordersPreview(img: PreviewImage, grid: Grid, cat: ArrayLike<number>, alpha: number, ink: readonly number[] = [40, 30, 22]): PreviewImage {
  const { w, h, idx } = sampler(grid);
  const d = img.data;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = y * w + x;
      const c = cat[idx[p]];
      if (c < 0) continue;
      const r = x + 1 < w ? cat[idx[p + 1]] : c, dn = y + 1 < h ? cat[idx[p + w]] : c;
      if (r === c && dn === c) continue;
      const o = p * 4;
      for (let j = 0; j < 3; j++) d[o + j] = d[o + j] * (1 - alpha) + ink[j] * alpha;
    }
  }
  return img;
}
