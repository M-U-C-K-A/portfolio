import { B } from '../biomes';
import { R_EARTH_KM, type Grid } from '../grid';
import type { GenSettings, PlateInfo, WorldStats } from '../types';
import { smoothstep } from '../util';

/** Données de terrain nécessaires à la géopolitique (conservées en cache dans le worker). */
export interface Terrain {
  settings: GenSettings;
  grid: Grid;
  h: Float32Array;
  ocean: Uint8Array;
  temperature: Float32Array;
  precip: Float32Array;
  lakeDepth: Float32Array;
  lakeSalt: Uint8Array;
  biome: Uint8Array;
  plate: Uint8Array;
  boundary: Uint8Array;
  discharge: Float32Array;
  riverPts: Float32Array;
  riverOffsets: Uint32Array;
  crust: Float32Array;
  rcv: Int32Array;
  plates: PlateInfo[];
  windW: number;
  windH: number;
  windU: Float32Array;
  windV: Float32Array;
  stats: WorldStats;
}

export interface Components {
  label: Int32Array;
  count: number;
  cells: number[];
  area: number[];
}

/** Composantes 8-connexes des cellules vérifiant `mask`. */
export function components(grid: Grid, mask: (i: number) => boolean): Components {
  const { N, W, nbr } = grid;
  const label = new Int32Array(N).fill(-1);
  const cells: number[] = [];
  const area: number[] = [];
  const stack = new Int32Array(N);
  for (let i = 0; i < N; i++) {
    if (label[i] >= 0 || !mask(i)) continue;
    const id = cells.length;
    let sp = 0, n = 0, a = 0;
    stack[sp++] = i;
    label[i] = id;
    while (sp > 0) {
      const c = stack[--sp];
      n++;
      a += grid.area[(c / W) | 0];
      const base = c * 8;
      for (let k = 0; k < 8; k++) {
        const j = nbr[base + k];
        if (j < 0 || label[j] >= 0 || !mask(j)) continue;
        label[j] = id;
        stack[sp++] = j;
      }
    }
    cells.push(n);
    area.push(a);
  }
  return { label, count: cells.length, cells, area };
}

/** Distance (km) entre deux cellules, par la corde 3D (précis à courte distance, monotone au-delà). */
export function cellDistKm(grid: Grid, a: number, b: number): number {
  const dx = grid.px[a] - grid.px[b], dy = grid.py[a] - grid.py[b], dz = grid.pz[a] - grid.pz[b];
  return Math.sqrt(dx * dx + dy * dy + dz * dz) * R_EARTH_KM;
}

/** Pente locale (m/m) sur la grille. */
export function slopeField(grid: Grid, h: Float32Array, ocean: Uint8Array): Float32Array {
  const { W, H, N } = grid;
  const s = new Float32Array(N);
  for (let y = 0; y < H; y++) {
    const up = Math.max(0, y - 1), dn = Math.min(H - 1, y + 1);
    const gdx = 2 * grid.dxKm[y] * 1000, gdy = Math.max(1, dn - up) * grid.dyKm * 1000;
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (ocean[i]) continue;
      const l = y * W + (x === 0 ? W - 1 : x - 1), r = y * W + (x === W - 1 ? 0 : x + 1);
      const hv = (k: number) => (h[k] > 0 ? h[k] : 0);
      s[i] = Math.hypot((hv(r) - hv(l)) / gdx, (hv(dn * W + x) - hv(up * W + x)) / gdy);
    }
  }
  return s;
}

const BIOME_MOVE: number[] = [];
BIOME_MOVE[B.TAIGA] = 0.6;
BIOME_MOVE[B.TEMPERATE_FOREST] = 0.35;
BIOME_MOVE[B.TEMPERATE_RAINFOREST] = 0.6;
BIOME_MOVE[B.TROPICAL_DRY_FOREST] = 0.5;
BIOME_MOVE[B.TROPICAL_RAINFOREST] = 1.3;
BIOME_MOVE[B.WETLAND] = 1.5;
BIOME_MOVE[B.HOT_DESERT] = 0.7;
BIOME_MOVE[B.COLD_DESERT] = 0.7;
BIOME_MOVE[B.SALT_FLAT] = 0.4;
BIOME_MOVE[B.TUNDRA] = 0.9;
BIOME_MOVE[B.ICE_CAP] = 6;
BIOME_MOVE[B.GLACIER] = 6;
BIOME_MOVE[B.ALPINE] = 1.6;
BIOME_MOVE[B.LAKE] = 0.2;
BIOME_MOVE[B.SALT_LAKE] = 0.4;

/**
 * Coût de déplacement terrestre par km (multiplicateur ≥ 0.5) : pente, altitude, végétation.
 * Les grands fleuves navigables et les lacs réduisent le coût (voies d'eau intérieures).
 */
export function travelCost(t: Terrain, slope: Float32Array): Float32Array {
  const { N } = t.grid;
  const c = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    if (t.ocean[i]) {
      c[i] = Infinity;
      continue;
    }
    let v = 1 + 28 * slope[i] + 2.5 * smoothstep(1200, 4200, t.h[i]) + (BIOME_MOVE[t.biome[i]] ?? 0);
    if (t.lakeDepth[i] > 0) v = 0.7;
    else if (t.discharge[i] > 1500) v = Math.min(v, 0.6 + 0.3 * slope[i] * 10);
    c[i] = v;
  }
  return c;
}

export const smooth01 = smoothstep;

/**
 * Index spatial sur la sphère : seaux cubiques dans l'espace 3D (pas de problème d'antiméridien).
 * Les distances sont des cordes × rayon terrestre (≈ distance au sol à courte portée).
 */
export class SpatialHash {
  private readonly grid: Grid;
  private readonly s: number;
  private readonly K: number;
  private readonly buckets = new Map<number, number[]>();

  constructor(grid: Grid, bucketKm: number) {
    this.grid = grid;
    this.s = Math.max(1e-4, bucketKm / R_EARTH_KM);
    this.K = Math.ceil(2 / this.s) + 3;
  }

  private key(ix: number, iy: number, iz: number): number {
    return (ix * this.K + iy) * this.K + iz;
  }

  private coords(cell: number): [number, number, number] {
    const g = this.grid;
    return [Math.floor((g.px[cell] + 1) / this.s) + 1, Math.floor((g.py[cell] + 1) / this.s) + 1, Math.floor((g.pz[cell] + 1) / this.s) + 1];
  }

  add(cell: number, value: number = cell): void {
    const [x, y, z] = this.coords(cell);
    const k = this.key(x, y, z);
    let b = this.buckets.get(k);
    if (!b) this.buckets.set(k, (b = []));
    b.push(cell, value);
  }

  /** Appelle fn(cellule, valeur, distance) pour chaque élément à moins de `km` ; arrêt si fn renvoie true. */
  query(cell: number, km: number, fn: (c: number, v: number, d: number) => boolean | void): void {
    const [x, y, z] = this.coords(cell);
    const r = Math.ceil(km / R_EARTH_KM / this.s);
    for (let ix = x - r; ix <= x + r; ix++) {
      for (let iy = y - r; iy <= y + r; iy++) {
        for (let iz = z - r; iz <= z + r; iz++) {
          const b = this.buckets.get(this.key(ix, iy, iz));
          if (!b) continue;
          for (let j = 0; j < b.length; j += 2) {
            const d = cellDistKm(this.grid, cell, b[j]);
            if (d <= km && fn(b[j], b[j + 1], d) === true) return;
          }
        }
      }
    }
  }

  anyWithin(cell: number, km: number): boolean {
    let found = false;
    this.query(cell, km, () => (found = true));
    return found;
  }
}

/** Abscisse ramenée au plus près d'une référence (carte bouclée). */
export function unwrapX(x: number, ref: number, W: number): number {
  let d = x - ref;
  if (d > W / 2) d -= W;
  else if (d < -W / 2) d += W;
  return ref + d;
}
