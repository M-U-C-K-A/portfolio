import { B } from '../biomes';
import { cellDistKm, SpatialHash, unwrapX, type Components, type Terrain } from './common';
import type { Habitat } from './habitat';
import type { ProvinceMap } from './provinces';

export interface ProvStats {
  cells: number;
  area: number;
  pop: number;
  cx: number;
  cy: number;
  seed: number;
  /** Coût de déplacement moyen (rugosité du terrain). */
  rough: number;
  coastal: boolean;
  terrain: number;
  landmass: number;
  continent: number;
}

export interface Edge {
  to: number;
  /** Longueur de frontière (cellules), 0 pour une liaison maritime. */
  len: number;
  /** Altitude maximale le long de la frontière (crête). */
  maxH: number;
  /** Plus fort débit le long de la frontière (fleuve frontalier). */
  river: number;
  sea: boolean;
  km: number;
}

export function terrainClass(t: Terrain, i: number, slope: Float32Array): number {
  const b = t.biome[i], h = t.h[i];
  if (b === B.ICE_CAP || b === B.GLACIER) return 8;
  if (h > 1800 || slope[i] > 0.045) return 4;
  if (h > 700 || slope[i] > 0.018) return 3;
  if (b === B.HOT_DESERT || b === B.COLD_DESERT || b === B.SALT_FLAT) return 5;
  if (b === B.WETLAND) return 6;
  if (b === B.TUNDRA) return 7;
  if (b === B.TROPICAL_RAINFOREST) return 2;
  if (b === B.TAIGA || b === B.TEMPERATE_FOREST || b === B.TEMPERATE_RAINFOREST || b === B.TROPICAL_DRY_FOREST) return 1;
  return 0;
}

export function provinceStats(
  t: Terrain,
  pm: ProvinceMap,
  habitat: Habitat,
  cost: Float32Array,
  slope: Float32Array,
  landmass: Components,
  continent: Uint8Array,
): ProvStats[] {
  const { grid, ocean } = t;
  const { N, W, nbr } = grid;
  const P = pm.count;
  const sx = new Float64Array(P), sy = new Float64Array(P);
  const votes = new Float32Array(P * 9);
  const contVotes = new Map<number, number>();
  const stats: ProvStats[] = pm.seeds.map((seed) => ({
    cells: 0, area: 0, pop: 0, cx: 0, cy: 0, seed, rough: 0, coastal: false, terrain: 0, landmass: landmass.label[seed], continent: 255,
  }));
  for (let i = 0; i < N; i++) {
    const p = pm.province[i];
    if (p < 0) continue;
    const s = stats[p];
    const y = (i / W) | 0;
    const a = grid.area[y];
    s.cells++;
    s.area += a;
    s.pop += habitat.density[i] * a;
    s.rough += Number.isFinite(cost[i]) ? cost[i] : 3;
    sx[p] += unwrapX(i % W, s.seed % W, W) + 0.5;
    sy[p] += y + 0.5;
    votes[p * 9 + terrainClass(t, i, slope)] += 1;
    if (continent[i] !== 255) contVotes.set(p * 256 + continent[i], (contVotes.get(p * 256 + continent[i]) ?? 0) + 1);
    if (!s.coastal) {
      const base = i * 8;
      for (let k = 0; k < 8; k++) {
        const n = nbr[base + k];
        if (n >= 0 && ocean[n]) {
          s.coastal = true;
          break;
        }
      }
    }
  }
  const bestCont = new Float32Array(P);
  for (const [key, v] of contVotes) {
    const p = Math.floor(key / 256);
    if (v > bestCont[p]) {
      bestCont[p] = v;
      stats[p].continent = key % 256;
    }
  }
  for (let p = 0; p < P; p++) {
    const s = stats[p];
    if (s.cells === 0) continue;
    s.rough /= s.cells;
    s.cx = (((sx[p] / s.cells) % W) + W) % W;
    s.cy = sy[p] / s.cells;
    let bv = -1;
    for (let k = 0; k < 9; k++) {
      // les reliefs l'emportent même minoritaires (une province montagneuse le reste)
      const v = votes[p * 9 + k] * (k === 4 ? 1.6 : k === 3 ? 1.2 : 1);
      if (v > bv) {
        bv = v;
        s.terrain = k;
      }
    }
  }
  return stats;
}

export function provinceAdjacency(t: Terrain, pm: ProvinceMap, stats: ProvStats[], seaKm: number): Edge[][] {
  const { grid, h, discharge } = t;
  const { N, nbr } = grid;
  const P = pm.count;
  const maps: Map<number, Edge>[] = Array.from({ length: P }, () => new Map());
  for (let i = 0; i < N; i++) {
    const a = pm.province[i];
    if (a < 0) continue;
    // voisins droite et bas suffisent (chaque paire vue une fois par cellule frontière)
    for (const k of [4, 6]) {
      const j = nbr[i * 8 + k];
      if (j < 0) continue;
      const b = pm.province[j];
      if (b < 0 || b === a) continue;
      const mh = Math.max(h[i], h[j]);
      const rv = Math.max(discharge[i], discharge[j]);
      for (const [x, y] of [[a, b], [b, a]]) {
        const e = maps[x].get(y);
        if (e) {
          e.len++;
          if (mh > e.maxH) e.maxH = mh;
          if (rv > e.river) e.river = rv;
        } else {
          maps[x].set(y, { to: y, len: 1, maxH: mh, river: rv, sea: false, km: cellDistKm(grid, stats[x].seed, stats[y].seed) });
        }
      }
    }
  }
  // liaisons maritimes entre provinces côtières de terres différentes (détroits, îles proches)
  const hash = new SpatialHash(grid, seaKm);
  const coastalCells: number[][] = Array.from({ length: P }, () => []);
  const seen = new Int32Array(P);
  for (let i = 0; i < N; i++) {
    const p = pm.province[i];
    if (p < 0 || !stats[p].coastal) continue;
    const base = i * 8;
    let coast = false;
    for (let k = 0; k < 8; k++) {
      const n = nbr[base + k];
      if (n >= 0 && t.ocean[n]) coast = true;
    }
    if (!coast) continue;
    // échantillonnage : une cellule côtière sur trois, 40 au plus par province
    if (seen[p]++ % 3 === 0 && coastalCells[p].length < 40) coastalCells[p].push(i);
  }
  for (let p = 0; p < P; p++) for (const c of coastalCells[p]) hash.add(c, p);
  for (let p = 0; p < P; p++) {
    for (const c of coastalCells[p]) {
      hash.query(c, seaKm, (_cell, q, d) => {
        if (q === p || stats[q].landmass === stats[p].landmass) return;
        const e = maps[p].get(q);
        if (e) {
          if (e.sea && d < e.km) e.km = d;
          return;
        }
        maps[p].set(q, { to: q, len: 0, maxH: 0, river: 0, sea: true, km: d });
        maps[q].set(p, { to: p, len: 0, maxH: 0, river: 0, sea: true, km: d });
      });
    }
  }
  return maps.map((m) => [...m.values()]);
}
