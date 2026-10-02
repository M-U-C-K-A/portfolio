import type { Grid } from './grid';

export const clamp = (v: number, a: number, b: number): number => (v < a ? a : v > b ? b : v);

export function smoothstep(e0: number, e1: number, x: number): number {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
}

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** Interpolation cubique monotone (Fritsch–Carlson) : courbes de profil sans cassure ni dépassement. */
export class MonotoneCubic {
  private readonly xs: number[];
  private readonly ys: number[];
  private readonly ms: number[];

  constructor(xs: number[], ys: number[]) {
    const n = xs.length;
    this.xs = xs;
    this.ys = ys;
    const d: number[] = [];
    for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
    const m: number[] = new Array(n);
    m[0] = d[0];
    m[n - 1] = d[n - 2];
    for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
    for (let i = 0; i < n - 1; i++) {
      if (d[i] === 0) {
        m[i] = 0;
        m[i + 1] = 0;
        continue;
      }
      const a = m[i] / d[i];
      const b = m[i + 1] / d[i];
      const s = a * a + b * b;
      if (s > 9) {
        const t = 3 / Math.sqrt(s);
        m[i] = t * a * d[i];
        m[i + 1] = t * b * d[i];
      }
    }
    this.ms = m;
  }

  eval(x: number): number {
    const xs = this.xs, ys = this.ys, ms = this.ms;
    const n = xs.length;
    if (x <= xs[0]) return ys[0] + ms[0] * (x - xs[0]);
    if (x >= xs[n - 1]) return ys[n - 1] + ms[n - 1] * (x - xs[n - 1]);
    let i = 0;
    while (x > xs[i + 1]) i++;
    const h = xs[i + 1] - xs[i];
    const t = (x - xs[i]) / h;
    const t2 = t * t, t3 = t2 * t;
    return (
      (2 * t3 - 3 * t2 + 1) * ys[i] +
      (t3 - 2 * t2 + t) * h * ms[i] +
      (-2 * t3 + 3 * t2) * ys[i + 1] +
      (t3 - t2) * h * ms[i + 1]
    );
  }
}

/** Interpolation linéaire dans une table (x croissants). */
export function table(xs: readonly number[], ys: readonly number[], x: number): number {
  const n = xs.length;
  if (x <= xs[0]) return ys[0];
  if (x >= xs[n - 1]) return ys[n - 1];
  let i = 1;
  while (x > xs[i]) i++;
  const t = (x - xs[i - 1]) / (xs[i] - xs[i - 1]);
  return ys[i - 1] + (ys[i] - ys[i - 1]) * t;
}

/**
 * Flou gaussien approché (boîtes successives) avec rayon physique en km :
 * le rayon horizontal en cellules s'élargit vers les pôles, et la carte boucle en x.
 */
export function blurKm(grid: Grid, data: Float32Array, radiusKm: number, passes = 3): Float32Array {
  const { W, H, N } = grid;
  const a = Float32Array.from(data);
  const b = new Float32Array(N);
  const ry = Math.max(1, Math.round(radiusKm / grid.dyKm));
  for (let p = 0; p < passes; p++) {
    for (let y = 0; y < H; y++) {
      const row = y * W;
      const r = Math.min((W >> 1) - 1, Math.max(0, Math.round(radiusKm / grid.dxKm[y])));
      if (r === 0) {
        for (let x = 0; x < W; x++) b[row + x] = a[row + x];
        continue;
      }
      let s = 0;
      for (let k = -r; k <= r; k++) s += a[row + ((k + W) % W)];
      const inv = 1 / (2 * r + 1);
      for (let x = 0; x < W; x++) {
        b[row + x] = s * inv;
        let add = x + r + 1;
        if (add >= W) add -= W;
        let rem = x - r;
        if (rem < 0) rem += W;
        s += a[row + add] - a[row + rem];
      }
    }
    const inv = 1 / (2 * ry + 1);
    for (let x = 0; x < W; x++) {
      let s = 0;
      for (let k = -ry; k <= ry; k++) s += b[clamp(k, 0, H - 1) * W + x];
      for (let y = 0; y < H; y++) {
        a[y * W + x] = s * inv;
        s += b[Math.min(H - 1, y + ry + 1) * W + x] - b[Math.max(0, y - ry) * W + x];
      }
    }
  }
  return a;
}

/** Seuil tel qu'une fraction `fractionAbove` de la SURFACE (pondérée par la latitude) soit au-dessus. */
export function areaThreshold(grid: Grid, values: Float32Array, fractionAbove: number): number {
  const { W, N } = grid;
  let min = Infinity, max = -Infinity;
  for (let i = 0; i < N; i++) {
    const v = values[i];
    if (v < min) min = v;
    if (v > max) max = v;
  }
  const BINS = 16384;
  const hist = new Float64Array(BINS);
  const scale = (BINS - 1) / (max - min || 1);
  let total = 0;
  for (let i = 0; i < N; i++) {
    const a = grid.area[(i / W) | 0];
    hist[((values[i] - min) * scale) | 0] += a;
    total += a;
  }
  const target = fractionAbove * total;
  let acc = 0;
  for (let b = BINS - 1; b >= 0; b--) {
    const next = acc + hist[b];
    if (next >= target) {
      const frac = hist[b] > 0 ? (target - acc) / hist[b] : 0;
      return min + (b + 1 - frac) / scale;
    }
    acc = next;
  }
  return min;
}

/** Échantillonnage bilinéaire d'un champ (Wc×Hc) avec bouclage en x et clamp en y. */
export function sampleWrap(f: Float32Array, W: number, H: number, x: number, y: number): number {
  if (y < 0) y = 0;
  else if (y > H - 1) y = H - 1;
  const x0f = Math.floor(x);
  const y0 = Math.floor(y);
  const tx = x - x0f;
  const ty = y - y0;
  let x0 = x0f % W;
  if (x0 < 0) x0 += W;
  const x1 = x0 + 1 === W ? 0 : x0 + 1;
  const y1 = y0 + 1 >= H ? H - 1 : y0 + 1;
  const a = f[y0 * W + x0], b = f[y0 * W + x1];
  const c = f[y1 * W + x0], d = f[y1 * W + x1];
  return (a + (b - a) * tx) * (1 - ty) + (c + (d - c) * tx) * ty;
}

/**
 * Évalue fn(x, y, z) (point de la sphère unité) sur une grille `factor` fois plus grossière puis
 * interpole bilinéairement : pour les bruits basse fréquence, le résultat est indiscernable et 16× moins coûteux.
 */
export function coarseField(grid: Grid, factor: number, fn: (x: number, y: number, z: number) => number): Float32Array {
  const { W, H, N } = grid;
  const Wc = Math.ceil(W / factor);
  const Hc = Math.ceil(H / factor) + 1;
  const latMax = (grid.latMaxDeg * Math.PI) / 180;
  const c = new Float32Array(Wc * Hc);
  for (let yc = 0; yc < Hc; yc++) {
    // centre de la cellule grossière exprimé en cellules fines
    const yf = (yc + 0.5) * factor - 0.5;
    const lat = latMax - ((yf + 0.5) / H) * 2 * latMax;
    const cl = Math.cos(lat), sl = Math.sin(lat);
    for (let xc = 0; xc < Wc; xc++) {
      const xf = (xc + 0.5) * factor - 0.5;
      const lon = -Math.PI + ((xf + 0.5) / W) * 2 * Math.PI;
      c[yc * Wc + xc] = fn(cl * Math.cos(lon), cl * Math.sin(lon), sl);
    }
  }
  const out = new Float32Array(N);
  const inv = 1 / factor;
  for (let y = 0; y < H; y++) {
    const fy = (y + 0.5) * inv - 0.5;
    for (let x = 0; x < W; x++) {
      out[y * W + x] = sampleWrap(c, Wc, Hc, (x + 0.5) * inv - 0.5, fy);
    }
  }
  return out;
}
