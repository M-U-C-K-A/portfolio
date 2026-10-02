import { MinHeap } from '../heap';
import { NONE16 } from '../types';
import type { Terrain } from './common';
import type { CitySite } from './cities';

export interface Influence {
  city: Uint16Array;
  strength: Float32Array;
  area: Float64Array;
}

/**
 * Zones d'influence (aires de marché) : chaque cellule dépend de la ville qu'elle atteint au moindre
 * coût de trajet (les routes raccourcissent les distances), coût divisé par la « portée » de la ville
 * qui croît avec sa population → les métropoles rayonnent plus loin que les bourgs.
 */
export function buildInfluence(t: Terrain, cost: Float32Array, roadFactor: Float32Array, sites: CitySite[]): Influence {
  const { grid, ocean } = t;
  const { N, W, nbr, ndist } = grid;
  const pops = sites.map((s) => s.pop).sort((a, b) => a - b);
  const median = pops[pops.length >> 1] || 1;
  const reach = sites.map((s) => Math.pow(s.pop / median, 0.33));
  let landArea = 0;
  for (let i = 0; i < N; i++) if (!ocean[i]) landArea += grid.area[(i / W) | 0];
  const R0 = Math.sqrt(landArea / Math.max(1, sites.length)) * 0.9;

  const city = new Uint16Array(N).fill(NONE16);
  const dist = new Float32Array(N).fill(Infinity);
  const heap = new MinHeap(1 << 16);
  sites.forEach((s, i) => {
    city[s.cell] = i;
    dist[s.cell] = 0;
    heap.push(0, s.cell);
  });
  while (heap.size > 0) {
    const c = heap.pop();
    const d = heap.topKey;
    if (d > dist[c]) continue;
    const src = city[c];
    const r = reach[src];
    const row = ((c / W) | 0) * 8;
    const base = c * 8;
    for (let k = 0; k < 8; k++) {
      const m = nbr[base + k];
      if (m < 0 || ocean[m]) continue;
      // arrondi float32 : même valeur dans le tas et dans `dist`, sinon la cellule passe pour périmée
      const nd = Math.fround(d + (ndist[row + k] * 0.5 * (cost[c] * roadFactor[c] + cost[m] * roadFactor[m])) / r);
      if (nd < dist[m]) {
        dist[m] = nd;
        city[m] = src;
        heap.push(nd, m);
      }
    }
  }
  const strength = new Float32Array(N);
  const area = new Float64Array(sites.length);
  for (let i = 0; i < N; i++) {
    if (city[i] === NONE16) continue;
    strength[i] = Math.exp(-dist[i] / R0);
    area[city[i]] += grid.area[(i / W) | 0];
  }
  return { city, strength, area };
}
