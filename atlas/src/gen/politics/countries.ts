import { MinHeap } from '../heap';
import { Rng } from '../rng';
import { smoothstep } from '../util';
import { SpatialHash, type Terrain } from './common';
import type { CitySite } from './cities';
import type { Edge, ProvStats } from './graph';

export interface CountryMap {
  /** Pays propriétaire de chaque province (-1 = aucune). */
  owner: Int32Array;
  /** Ville capitale (indice dans sites) de chaque pays. */
  capitals: number[];
}

/**
 * Formation des États : capitales choisies parmi les grandes villes (espacées), puis expansion
 * sur le graphe des provinces. Montagnes, fleuves frontaliers, jungles, déserts et détroits freinent
 * l'expansion ; chaque État a une « puissance » qui étire son rayon d'action (empires vs cités-États).
 */
export function buildCountries(
  t: Terrain,
  stats: ProvStats[],
  adj: Edge[][],
  sites: CitySite[],
  cityProvince: number[],
  count: number,
  rng: Rng,
  /** Multiplicateur de coût entre deux provinces (frontières culturelles). */
  affinity: (p: number, q: number) => number = () => 1,
): CountryMap {
  const { grid, h } = t;
  const P = stats.length;
  let landArea = 0;
  for (const s of stats) landArea += s.area;

  // --- capitales ---
  let sep = 0.6 * Math.sqrt(landArea / Math.max(1, count));
  const capitals: number[] = [];
  for (let pass = 0; pass < 5 && capitals.length < count; pass++) {
    const hash = new SpatialHash(grid, sep);
    for (const c of capitals) hash.add(sites[c].cell);
    for (let c = 0; c < sites.length && capitals.length < count; c++) {
      if (capitals.includes(c) || hash.anyWithin(sites[c].cell, sep)) continue;
      hash.add(sites[c].cell);
      capitals.push(c);
    }
    sep *= 0.8;
  }

  const meanPop = capitals.reduce((a, c) => a + sites[c].pop, 0) / Math.max(1, capitals.length);
  const power: number[] = capitals.map((c) => Math.exp(0.45 * rng.normal()) * Math.pow(sites[c].pop / meanPop, 0.2));

  const edgeCost = (p: number, e: Edge): number => {
    if (e.sea) return (e.km * 1.3 + 350) * 1.5;
    const rough = 0.5 * (stats[p].rough + stats[e.to].rough);
    const ridge = e.maxH - Math.max(h[stats[p].seed], h[stats[e.to].seed], 0);
    const barrier = 1 + 0.8 * smoothstep(400, 1500, ridge) + 0.5 * smoothstep(2.6, 3.8, Math.log10(1 + e.river));
    return e.km * rough * barrier;
  };

  const owner = new Int32Array(P).fill(-1);
  const key = new Float64Array(P).fill(Infinity);
  const grow = (sources: number[]): void => {
    const heap = new MinHeap(1024);
    for (const c of sources) {
      const p = cityProvince[capitals[c]];
      owner[p] = c;
      key[p] = 0;
      heap.push(0, p);
    }
    while (heap.size > 0) {
      const p = heap.pop();
      const k = heap.topKey;
      if (k > key[p]) continue;
      const o = owner[p];
      for (const e of adj[p]) {
        const q = e.to;
        if (sources.length < capitals.length && owner[q] >= 0 && !sources.includes(owner[q])) continue;
        const nk = k + (edgeCost(p, e) * affinity(p, q)) / power[o];
        if (nk < key[q]) {
          key[q] = nk;
          owner[q] = o;
          heap.push(nk, q);
        }
      }
    }
  };
  grow(capitals.map((_, i) => i));

  // --- terres isolées : nouvel État si assez peuplées, sinon possession du voisin le plus proche ---
  const popByCountry = new Float64Array(capitals.length);
  for (let p = 0; p < P; p++) if (owner[p] >= 0) popByCountry[owner[p]] += stats[p].pop;
  const sorted = [...popByCountry].sort((a, b) => a - b);
  const medianPop = sorted[sorted.length >> 1] ?? 0;
  const orphanPop = new Map<number, number>();
  for (let p = 0; p < P; p++) if (owner[p] < 0 && stats[p].cells > 0) orphanPop.set(stats[p].landmass, (orphanPop.get(stats[p].landmass) ?? 0) + stats[p].pop);
  const fresh: number[] = [];
  for (const [lm, pop] of orphanPop) {
    if (pop < 0.2 * medianPop) continue;
    let best = -1;
    for (let c = 0; c < sites.length; c++) if (sites[c].landmass === lm && (best < 0 || sites[c].pop > sites[best].pop)) best = c;
    if (best < 0) continue;
    fresh.push(capitals.length);
    capitals.push(best);
    power.push(1);
  }
  if (fresh.length) grow(fresh);

  const ownedHash = new SpatialHash(grid, 800);
  for (let p = 0; p < P; p++) if (owner[p] >= 0) ownedHash.add(stats[p].seed, p);
  for (let p = 0; p < P; p++) {
    if (owner[p] >= 0 || stats[p].cells === 0) continue;
    let best = -1, bd = Infinity;
    for (let r = 800; best < 0 && r <= 6400; r *= 2) {
      ownedHash.query(stats[p].seed, r, (_c, q, d) => {
        if (d < bd) {
          bd = d;
          best = q;
        }
      });
    }
    if (best >= 0) owner[p] = owner[best];
  }
  return { owner, capitals };
}
