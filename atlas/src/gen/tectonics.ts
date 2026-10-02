import { R_EARTH_KM, type Grid } from './grid';
import { MinHeap } from './heap';
import { Noise3 } from './noise';
import { Rng } from './rng';
import type { GenSettings } from './types';
import { clamp, coarseField } from './util';

export interface Plate {
  id: number;
  seed: number;
  /** Axe de rotation (pôle d'Euler), unitaire. */
  ax: number;
  ay: number;
  az: number;
  /** Vitesse angulaire signée (unité arbitraire). */
  omega: number;
  /** Coût de croissance : faible = grande plaque. */
  weight: number;
  continental: boolean;
  /** Densité relative : la plus dense plonge en subduction océan-océan. */
  density: number;
  /** Part de la surface de la carte. */
  area: number;
}

export interface Tectonics {
  plates: Plate[];
  plate: Uint8Array;
  isBoundary: Uint8Array;
  /** 0 aucune, 1 convergente, 2 divergente, 3 transformante. */
  bType: Uint8Array;
  /** Convergence (>0) / divergence (<0) sur les cellules frontières. */
  conv: Float32Array;
  shear: Float32Array;
  /** Une cellule voisine de l'autre côté de la frontière. */
  across: Int32Array;
  /** Distance (km) à la frontière la plus proche de SA propre plaque. */
  dist: Float32Array;
  /** Cellule frontière la plus proche (même plaque). */
  src: Int32Array;
}

export const MAX_BOUNDARY_DIST = 2600;

/** v = ω (axe × p) : vitesse tangentielle d'une plaque en rotation rigide sur la sphère. */
export function plateVelocity(p: Plate, x: number, y: number, z: number, out: Float64Array): void {
  out[0] = p.omega * (p.ay * z - p.az * y);
  out[1] = p.omega * (p.az * x - p.ax * z);
  out[2] = p.omega * (p.ax * y - p.ay * x);
}

export function buildTectonics(grid: Grid, s: GenSettings): Tectonics {
  const rng = Rng.from(s.seed, 'plates');
  const noise = new Noise3(Rng.from(s.seed, 'plate-noise'));
  const { N, W, nbr, px, py, pz } = grid;
  const P = clamp(Math.round(s.plateCount), 2, 250);

  // --- 1. Germes répartis uniformément (en surface) avec espacement minimal ---
  const zMax = Math.sin((grid.latMaxDeg * Math.PI) / 180);
  const bandArea = 4 * Math.PI * zMax;
  let minSep = 0.62 * Math.sqrt(bandArea / P);
  const seedPos: number[][] = [];
  const seeds: number[] = [];
  let fails = 0;
  while (seeds.length < P) {
    const lon = rng.range(-Math.PI, Math.PI);
    const z = rng.range(-zMax, zMax);
    const lat = Math.asin(z);
    const c = Math.cos(lat);
    const x = c * Math.cos(lon), y = c * Math.sin(lon);
    let ok = true;
    for (const q of seedPos) {
      if (Math.acos(clamp(q[0] * x + q[1] * y + q[2] * z, -1, 1)) < minSep) {
        ok = false;
        break;
      }
    }
    const cell = grid.cellAt(lat, lon);
    if (ok && !seeds.includes(cell)) {
      seedPos.push([x, y, z]);
      seeds.push(cell);
    } else if (++fails > 60) {
      minSep *= 0.9;
      fails = 0;
    }
  }

  const plates: Plate[] = seeds.map((seed, id) => {
    const major = rng.chance(0.4);
    let ax = rng.normal(), ay = rng.normal(), az = rng.normal();
    const l = Math.hypot(ax, ay, az) || 1;
    ax /= l; ay /= l; az /= l;
    return {
      id,
      seed,
      ax, ay, az,
      omega: rng.range(0.35, 1.0) * (rng.chance(0.5) ? 1 : -1),
      weight: major ? rng.range(0.5, 0.85) : rng.range(0.95, 1.7),
      continental: false,
      density: rng.next(),
      area: 0,
    };
  });

  // --- 2. Croissance des plaques ---
  // Priorité = distance réelle au germe (pondérée par la « taille » de la plaque) + un décalage bruité
  // propre à chaque plaque (projection d'un champ vectoriel de bruit sur une direction tirée par plaque).
  // Une somme de pas 8-voisins sur un coût lisse faisait se rencontrer les fronts le long de droites
  // (frontières, rifts et lacs rectilignes) ; ici les frontières sont sinueuses à toutes les échelles.
  const spacingKm = R_EARTH_KM * Math.sqrt(bandArea / P);
  const amp = 0.11 * spacingKm;
  const gf = Math.max(2, Math.round(W / 1024));
  // grandes ondulations seulement : un bruit trop fin fait s'imbriquer les plaques en « doigts »
  // (zones de frontière épaisses, massifs en blocs) ; le détail fin des chaînes vient de relief.ts
  const nfield = (ox: number) => coarseField(grid, gf, (x, y, z) => noise.fbm(x * 2.6 + ox, y * 2.6, z * 2.6 - ox, 5, 2.0, 0.5));
  const gx = nfield(0), gy = nfield(17.3), gz = nfield(-41.9);
  const dirs = plates.map(() => {
    let a = rng.normal(), b = rng.normal(), c = rng.normal();
    const l = Math.hypot(a, b, c) || 1;
    return [a / l, b / l, c / l];
  });
  const sx = seeds.map((c) => px[c]), sy = seeds.map((c) => py[c]), sz = seeds.map((c) => pz[c]);
  const plate = new Uint8Array(N).fill(255);
  const heap = new MinHeap(N);
  for (const p of plates) {
    plate[p.seed] = p.id;
    heap.push(0, p.seed);
  }
  while (heap.size > 0) {
    const c = heap.pop();
    const pid = plate[c];
    const w = plates[pid].weight;
    const u = dirs[pid];
    const base = c * 8;
    for (let k = 0; k < 8; k++) {
      const n = nbr[base + k];
      if (n < 0 || plate[n] !== 255) continue;
      plate[n] = pid;
      const d = R_EARTH_KM * Math.hypot(px[n] - sx[pid], py[n] - sy[pid], pz[n] - sz[pid]);
      heap.push(w * d + amp * (u[0] * gx[n] + u[1] * gy[n] + u[2] * gz[n]), n);
    }
  }

  // --- 3. Surfaces, choix des plaques continentales ---
  let total = 0;
  for (let i = 0; i < N; i++) {
    const a = grid.area[(i / W) | 0];
    plates[plate[i]].area += a;
    total += a;
  }
  for (const p of plates) p.area /= total;
  const target = clamp(s.landFraction * 1.15 + 0.04, 0.1, 0.85);
  let contArea = 0;
  for (const p of rng.shuffle([...plates])) {
    if (contArea + p.area <= target * 1.1) {
      p.continental = true;
      contArea += p.area;
    }
  }
  if (contArea < target * 0.7) {
    const rest = plates.filter((p) => !p.continental).sort((a, b) => Math.abs(target - contArea - a.area) - Math.abs(target - contArea - b.area));
    if (rest.length > 0) {
      rest[0].continental = true;
      contArea += rest[0].area;
    }
  }
  // les plaques continentales, épaisses, se déplacent plus lentement
  for (const p of plates) if (p.continental) p.omega *= 0.65;

  // --- 4. Frontières : normale, vitesse relative → convergence / cisaillement ---
  const isBoundary = new Uint8Array(N);
  const across = new Int32Array(N).fill(-1);
  const conv = new Float32Array(N);
  const shear = new Float32Array(N);
  const va = new Float64Array(3), vb = new Float64Array(3);
  for (let i = 0; i < N; i++) {
    const pi = plate[i];
    let other = -1, nx = 0, ny = 0, nz = 0;
    const base = i * 8;
    for (let k = 0; k < 8; k++) {
      const n = nbr[base + k];
      if (n < 0) continue;
      const pn = plate[n];
      if (pn === pi) continue;
      if (other < 0) {
        other = pn;
        across[i] = n;
      }
      if (pn !== other) continue;
      nx += px[n] - px[i];
      ny += py[n] - py[i];
      nz += pz[n] - pz[i];
    }
    if (other < 0) continue;
    isBoundary[i] = 1;
    const x = px[i], y = py[i], z = pz[i];
    const d = nx * x + ny * y + nz * z;
    nx -= d * x; ny -= d * y; nz -= d * z;
    const l = Math.hypot(nx, ny, nz) || 1;
    nx /= l; ny /= l; nz /= l;
    plateVelocity(plates[pi], x, y, z, va);
    plateVelocity(plates[other], x, y, z, vb);
    const rx = va[0] - vb[0], ry = va[1] - vb[1], rz = va[2] - vb[2];
    const c = rx * nx + ry * ny + rz * nz;
    conv[i] = c;
    shear[i] = Math.hypot(rx - c * nx, ry - c * ny, rz - c * nz);
  }
  // lissage le long de la frontière (les normales sur grille sont bruitées). Le nombre de passes suit la
  // résolution (rayon constant en km, ~100 km) : sinon, sur les grandes cartes, la convergence varie d'une
  // cellule à l'autre et chaque « secteur » de frontière donne une crête différente (reliefs en râteau).
  const bList: number[] = [];
  for (let i = 0; i < N; i++) if (isBoundary[i]) bList.push(i);
  const passes = Math.round(clamp(5 * (W / 1536) ** 2, 4, 120));
  const tmpC = new Float32Array(bList.length), tmpS = new Float32Array(bList.length);
  for (let pass = 0; pass < passes; pass++) {
    for (let j = 0; j < bList.length; j++) {
      const i = bList[j];
      const pi = plate[i], po = plate[across[i]];
      let sc = conv[i], ss = shear[i], cnt = 1;
      const base = i * 8;
      for (let k = 0; k < 8; k++) {
        const n = nbr[base + k];
        if (n < 0 || !isBoundary[n] || plate[n] !== pi || plate[across[n]] !== po) continue;
        sc += conv[n];
        ss += shear[n];
        cnt++;
      }
      tmpC[j] = sc / cnt;
      tmpS[j] = ss / cnt;
    }
    for (let j = 0; j < bList.length; j++) {
      conv[bList[j]] = tmpC[j];
      shear[bList[j]] = tmpS[j];
    }
  }
  const bType = new Uint8Array(N);
  for (let i = 0; i < N; i++) {
    if (!isBoundary[i]) continue;
    bType[i] = conv[i] > 0.18 ? 1 : conv[i] < -0.18 ? 2 : 3;
  }

  // --- 5. Distance à la frontière la plus proche, à l'intérieur de chaque plaque ---
  // Propagation de la source la plus proche : la distance est la corde réelle jusqu'à la cellule-frontière
  // source (et non une somme de pas 8-voisins, dont les isolignes octogonales dessinaient des chaînes,
  // fosses et côtes rectilignes à 0°/45°/90°).
  const chordKm = (a: number, b: number) => R_EARTH_KM * Math.hypot(px[a] - px[b], py[a] - py[b], pz[a] - pz[b]);
  const dist = new Float32Array(N).fill(MAX_BOUNDARY_DIST);
  const src = new Int32Array(N).fill(-1);
  heap.clear();
  for (let i = 0; i < N; i++) {
    if (!isBoundary[i]) continue;
    dist[i] = 0;
    src[i] = i;
    heap.push(0, i);
  }
  while (heap.size > 0) {
    const c = heap.pop();
    const d = heap.topKey;
    if (d > dist[c]) continue;
    const pc = plate[c];
    const base = c * 8;
    for (let k = 0; k < 8; k++) {
      const n = nbr[base + k];
      if (n < 0 || plate[n] !== pc) continue;
      // arrondi float32 : même valeur dans le tas et dans `dist`, sinon la cellule passe pour périmée
      const nd = Math.fround(chordKm(n, src[c]));
      if (nd < dist[n] && nd < MAX_BOUNDARY_DIST) {
        dist[n] = nd;
        src[n] = src[c];
        heap.push(nd, n);
      }
    }
  }

  return { plates, plate, isBoundary, bType, conv, shear, across, dist, src };
}
