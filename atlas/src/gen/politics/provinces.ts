import { MinHeap } from '../heap';
import { Noise3 } from '../noise';
import { Rng } from '../rng';
import { smoothstep } from '../util';
import { SpatialHash, type Components, type Terrain } from './common';
import type { Habitat } from './habitat';

export interface ProvinceMap {
  /** Province de chaque cellule terrestre (-1 en mer). */
  province: Int32Array;
  count: number;
  /** Cellule germe de chaque province (les n premières sont les villes). */
  seeds: number[];
}

/**
 * Provinces : germes denses dans les régions peuplées (et une par ville), croissance par Dijkstra
 * où franchir un grand fleuve, une crête ou un lac coûte cher → frontières naturelles.
 */
export function buildProvinces(
  t: Terrain,
  habitat: Habitat,
  slope: Float32Array,
  cityCells: number[],
  landmass: Components,
  provinceSize: number,
  rng: Rng,
): ProvinceMap {
  const { grid, ocean, h, discharge, lakeDepth } = t;
  const { N, W, nbr, ndist, px, py, pz } = grid;
  const hab = habitat.hab;

  let landCells = 0, landArea = 0;
  const land: number[] = [];
  for (let i = 0; i < N; i++) {
    if (ocean[i]) continue;
    landCells++;
    landArea += grid.area[(i / W) | 0];
    land.push(i);
  }
  // provinceSize est exprimée en cellules de la grille de référence (1536 de large) : même découpage quelle que soit la résolution
  const ref = (grid.W / 1536) ** 2;
  const target = Math.max(1, Math.round(landCells / Math.max(8, provinceSize * ref)));
  const baseKm = Math.sqrt(landArea / target) * 0.8;

  const seeds: number[] = [...cityCells];
  const hash = new SpatialHash(grid, baseKm * 1.9);
  for (const c of seeds) hash.add(c);
  const spacing = (i: number) => baseKm * (1.9 - 1.25 * Math.pow(hab[i], 0.6));
  rng.shuffle(land);
  for (const i of land) {
    if (lakeDepth[i] > 0) continue;
    if (hash.anyWithin(i, spacing(i))) continue;
    hash.add(i);
    seeds.push(i);
  }
  // au moins une province par terre émergée
  const has = new Uint8Array(landmass.count);
  for (const s of seeds) has[landmass.label[s]] = 1;
  const best = new Int32Array(landmass.count).fill(-1);
  for (const i of land) {
    const l = landmass.label[i];
    if (has[l]) continue;
    if (best[l] < 0 || hab[i] > hab[best[l]]) best[l] = i;
  }
  for (let l = 0; l < landmass.count; l++) if (!has[l] && best[l] >= 0) seeds.push(best[l]);

  // coût de franchissement de chaque cellule
  const noise = new Noise3(Rng.from(t.settings.seed, 'province-noise'));
  const cost = new Float32Array(N);
  for (const i of land) {
    let c = 1 + 22 * slope[i] + 2 * smoothstep(1500, 4000, h[i]);
    if (discharge[i] > 400) c += 2 + 2 * Math.log10(discharge[i] / 400);
    if (lakeDepth[i] > 0) c += 3;
    cost[i] = c * Math.exp(0.35 * noise.fbm(px[i] * 40, py[i] * 40, pz[i] * 40, 2));
  }

  const province = new Int32Array(N).fill(-1);
  const dist = new Float32Array(N).fill(Infinity);
  const heap = new MinHeap(1 << 16);
  seeds.forEach((s, id) => {
    province[s] = id;
    dist[s] = 0;
    heap.push(0, s);
  });
  while (heap.size > 0) {
    const c = heap.pop();
    const d = heap.topKey;
    if (d > dist[c]) continue;
    const row = ((c / W) | 0) * 8;
    const base = c * 8;
    const pc = province[c];
    for (let k = 0; k < 8; k++) {
      const n = nbr[base + k];
      if (n < 0 || ocean[n]) continue;
      // arrondi float32 : même valeur dans le tas et dans `dist`, sinon la cellule passe pour périmée et
      // n'est jamais propagée (des enclaves entières restaient sans province sur les grandes cartes)
      const nd = Math.fround(d + ndist[row + k] * 0.5 * (cost[c] + cost[n]));
      if (nd < dist[n]) {
        dist[n] = nd;
        province[n] = pc;
        heap.push(nd, n);
      }
    }
  }
  return { province, count: seeds.length, seeds };
}
