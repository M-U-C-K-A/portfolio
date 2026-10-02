import { Drainage } from './drainage';
import type { Grid } from './grid';
import type { GenSettings } from './types';

/**
 * Érosion fluviale par loi de puissance (stream power law, n = 1, m = 0.5),
 * résolue implicitement de l'aval vers l'amont (Braun & Willett 2013), + diffusion de versant.
 * L'aire drainée est pondérée par les précipitations : les régions humides s'incisent davantage.
 */
export function erode(
  grid: Grid,
  h: Float32Array,
  ocean: Uint8Array,
  precipRel: Float32Array,
  s: GenSettings,
  onProgress: (p: number) => void,
): void {
  if (s.erosion <= 0) return;
  const { N, W } = grid;
  const iterations = 15;
  const K = 0.021 * s.erosion;
  // diffusion de versant : forte en plaine (vallées évasées), faible en montagne (arêtes préservées)
  const kd = 0.16;
  const drain = new Drainage(grid);
  const A = new Float64Array(N);
  const floorH = new Float32Array(N);
  for (let i = 0; i < N; i++) floorH[i] = h[i] >= 0 ? 0.5 : h[i] - 400;
  const tmp = new Float32Array(N);
  const land = drain.landCells(ocean).idx;
  const baseA = new Float64Array(N);
  for (let j = 0; j < land.length; j++) {
    const i = land[j];
    baseA[i] = grid.area[(i / W) | 0] * precipRel[i];
  }

  for (let it = 0; it < iterations; it++) {
    drain.compute(h, ocean, 1e-3, it + 1, 0, true);
    const { order, rcv, rdist, count } = drain;

    A.set(baseA);
    for (let idx = count - 1; idx >= 0; idx--) {
      const i = order[idx];
      const r = rcv[i];
      if (r !== i) A[r] += A[i];
    }

    for (let idx = 0; idx < count; idx++) {
      const i = order[idx];
      const r = rcv[i];
      if (r === i || ocean[i]) continue;
      const hr = ocean[r] ? 0 : h[r];
      const hi = h[i];
      if (hi <= hr) continue; // cuvette : pas d'incision
      const f = (K * Math.sqrt(A[i])) / rdist[i];
      let nh = (hi + f * hr) / (1 + f);
      if (nh < floorH[i]) nh = floorH[i];
      h[i] = nh;
    }

    diffuse(grid, h, ocean, land, floorH, tmp, kd);
    onProgress((it + 1) / iterations);
  }
}

function diffuse(grid: Grid, h: Float32Array, ocean: Uint8Array, land: Int32Array, floorH: Float32Array, tmp: Float32Array, kd: number): void {
  const nbr = grid.nbr;
  tmp.set(h);
  for (let j = 0; j < land.length; j++) {
    const i = land[j];
    const base = i * 8;
    let sum = 0, cnt = 0;
    for (let k = 1; k < 7; k++) {
      if (k === 2 || k === 5) continue; // 4-voisinage : k = 1, 3, 4, 6
      const n = nbr[base + k];
      if (n < 0) continue;
      const v = tmp[n];
      sum += ocean[n] && v < 0 ? 0 : v;
      cnt++;
    }
    const hi = tmp[i];
    const k = hi < 250 ? kd : hi > 1600 ? kd * 0.18 : kd * (1 - 0.82 * ((hi - 250) / 1350));
    let nh = hi + k * (sum / cnt - hi);
    if (nh < floorH[i]) nh = floorH[i];
    h[i] = nh;
  }
}
