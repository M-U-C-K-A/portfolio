import { potentialET } from './biomes';
import { Drainage } from './drainage';
import type { Grid } from './grid';
import { hash01 } from './rng';
import type { GenSettings } from './types';

export interface Hydrology {
  /** Profondeur de lac (m), 0 hors lac. */
  lakeDepth: Float32Array;
  lakeSalt: Uint8Array;
  /** Fond de bassin endoréique asséché (salar / playa). */
  saltFlat: Uint8Array;
  /** Débit (m³/s). */
  discharge: Float32Array;
  riverPts: Float32Array;
  riverOffsets: Uint32Array;
  lakeCount: number;
  /** Indice d'humidité du sol (0..1) : fonds de vallée, plaines d'inondation. */
  wetness: Float32Array;
  /** Cellule aval de chaque cellule (réseau d'écoulement). */
  rcv: Int32Array;
}

const SEC_PER_YEAR = 3.156e7;

/**
 * Hydrographie finale :
 *  - écoulement D8 sur la surface remplie, débit = ruissellement cumulé (P − ETR, Budyko),
 *  - lacs dans les cuvettes ; bilan entrée / évaporation → lac d'eau douce avec exutoire,
 *    ou lac salé endorhéique dont le niveau baisse jusqu'à l'équilibre (voire salar asséché),
 *  - tracé des fleuves en polylignes lissées, largeur selon le débit.
 */
export function buildHydrology(
  grid: Grid,
  h: Float32Array,
  ocean: Uint8Array,
  temp: Float32Array,
  precip: Float32Array,
  s: GenSettings,
): Hydrology {
  const { N, W, H } = grid;
  const drain = new Drainage(grid);
  // les cuvettes vidangeables par une gorge ≤ 50 m sont percées (verrous entaillés par les fleuves)
  drain.compute(h, ocean, 1e-3, 7919, 50);
  const { filled, rcv, order, count } = drain;

  // ruissellement local (m³/s) : Budyko (Fu, w≈2)
  const local = new Float64Array(N);
  const pet = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    if (ocean[i]) continue;
    const P = precip[i];
    const E0 = potentialET(temp[i]);
    pet[i] = E0;
    const aet = P > 0 ? (P * E0) / Math.sqrt(P * P + E0 * E0) : 0;
    const runoffMm = Math.max(0, P - aet);
    local[i] = ((runoffMm / 1000) * grid.area[(i / W) | 0] * 1e6) / SEC_PER_YEAR;
  }

  // --- comblement sédimentaire : les petites cuvettes peu profondes (bruit du relief) deviennent des plaines ---
  fillSmallDepressions(grid, h, ocean, filled, 8000, 25);

  // --- lacs : composantes des cellules noyées (surface remplie > terrain) ---
  const LAKE_MIN = 2.0;
  const lakeId = new Int32Array(N).fill(-1);
  const lakes: { cells: number[]; area: number; exitFlow: number; exits: number[] }[] = [];
  const stack: number[] = [];
  for (let i = 0; i < N; i++) {
    if (ocean[i] || lakeId[i] >= 0 || filled[i] - h[i] < LAKE_MIN) continue;
    const id = lakes.length;
    const lake = { cells: [] as number[], area: 0, exitFlow: 0, exits: [] as number[] };
    lakeId[i] = id;
    stack.push(i);
    while (stack.length) {
      const c = stack.pop()!;
      lake.cells.push(c);
      lake.area += grid.area[(c / W) | 0];
      const base = c * 8;
      for (let k = 0; k < 8; k++) {
        const n = grid.nbr[base + k];
        if (n < 0 || ocean[n] || lakeId[n] >= 0 || filled[n] - h[n] < LAKE_MIN) continue;
        lakeId[n] = id;
        stack.push(n);
      }
    }
    lakes.push(lake);
  }
  for (let i = 0; i < N; i++) {
    const L = lakeId[i];
    if (L >= 0 && lakeId[rcv[i]] !== L) lakes[L].exits.push(i);
  }

  // 1re accumulation (sans évaporation des lacs) pour estimer les apports
  const Q = new Float64Array(N);
  for (let idx = count - 1; idx >= 0; idx--) {
    const i = order[idx];
    Q[i] += local[i];
    const r = rcv[i];
    if (r !== i) Q[r] += Q[i];
  }

  // bilan de chaque lac
  const lakeDepth = new Float32Array(N);
  const lakeSalt = new Uint8Array(N);
  const saltFlat = new Uint8Array(N);
  const exitFactor = new Float32Array(N).fill(1);
  let lakeCount = 0;
  for (const lake of lakes) {
    let inflow = 0;
    for (const e of lake.exits) inflow += Q[e];
    let petSum = 0;
    for (const c of lake.cells) petSum += pet[c] * grid.area[(c / W) | 0];
    const evap = ((petSum / 1000) * 1e6) / SEC_PER_YEAR; // m³/s si toute la cuvette est en eau
    if (inflow >= evap) {
      for (const c of lake.cells) lakeDepth[c] = filled[c] - h[c];
      const k = inflow > 0 ? (inflow - evap) / inflow : 0;
      for (const e of lake.exits) exitFactor[e] = k;
      lakeCount++;
      continue;
    }
    // endoréique : le plan d'eau se réduit jusqu'à ce que l'évaporation égale les apports
    for (const e of lake.exits) exitFactor[e] = 0;
    const cells = lake.cells.slice().sort((a, b) => h[a] - h[b]);
    const petMean = petSum / lake.area;
    let acc = 0, level = -Infinity;
    for (const c of cells) {
      const a = grid.area[(c / W) | 0];
      if (((acc + a) * petMean * 1e3) / SEC_PER_YEAR > inflow) break;
      acc += a;
      level = h[c];
    }
    const fillFrac = acc / lake.area;
    if (fillFrac < 0.04) {
      // bassin asséché : salar au point le plus bas
      const bottom = h[cells[0]];
      const maxCells = Math.max(1, Math.ceil(cells.length * 0.25));
      for (let k = 0; k < maxCells && h[cells[k]] < bottom + 25; k++) saltFlat[cells[k]] = 1;
      continue;
    }
    lakeCount++;
    for (const c of cells) {
      if (h[c] <= level) {
        lakeDepth[c] = Math.max(1, level - h[c] + 1);
        lakeSalt[c] = 1;
      } else if (h[c] < level + 12) {
        saltFlat[c] = 1; // rivage exondé du lac salé
      }
    }
  }

  // 2e accumulation avec pertes par évaporation aux exutoires des lacs
  Q.fill(0);
  for (let idx = count - 1; idx >= 0; idx--) {
    const i = order[idx];
    Q[i] = (Q[i] + local[i]) * exitFactor[i];
    const r = rcv[i];
    if (r !== i) Q[r] += Q[i];
  }
  const discharge = new Float32Array(N);
  for (let i = 0; i < N; i++) discharge[i] = ocean[i] ? 0 : Q[i];

  // humidité du sol : débit relatif + proximité de lac
  const wetness = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    if (ocean[i]) continue;
    const q = Q[i];
    wetness[i] = Math.min(1, Math.log10(1 + q / 50) / 2.2);
  }

  // --- tracé des fleuves ---
  const qMin = 180 / Math.max(0.05, s.riverDensity);
  const isRiver = new Uint8Array(N);
  for (let i = 0; i < N; i++) if (!ocean[i] && lakeDepth[i] === 0 && Q[i] >= qMin) isRiver[i] = 1;
  const hasRiverDonor = new Uint8Array(N);
  const lakeDonor = new Int32Array(N).fill(-1);
  for (let i = 0; i < N; i++) {
    const r = rcv[i];
    if (r === i) continue;
    if (isRiver[i]) hasRiverDonor[r] = 1;
    else if (lakeDepth[i] > 0 && isRiver[r]) lakeDonor[r] = i;
  }

  const pts: number[] = [];
  const offsets: number[] = [0];
  const visited = new Uint8Array(N);
  const path: number[] = [];
  const cx = (c: number): number => (c % W) + 0.5 + (hash01(c, 101) - 0.5) * 0.5;
  const cy = (c: number): number => ((c / W) | 0) + 0.5 + (hash01(c, 202) - 0.5) * 0.5;

  // les sources dans l'ordre amont → aval pour que les affluents s'arrêtent sur le cours principal
  for (let idx = count - 1; idx >= 0; idx--) {
    const s0 = order[idx];
    if (!isRiver[s0] || hasRiverDonor[s0] || visited[s0]) continue;
    path.length = 0;
    if (lakeDonor[s0] >= 0) path.push(lakeDonor[s0]);
    let c = s0;
    visited[c] = 1;
    path.push(c);
    let endKind = 0; // 0 = confluence/arrêt, 1 = mer ou lac (point intermédiaire)
    for (;;) {
      const r = rcv[c];
      if (r === c) break;
      if (ocean[r] || lakeDepth[r] > 0) {
        path.push(r);
        endKind = 1;
        break;
      }
      path.push(r);
      if (visited[r] || !isRiver[r]) break;
      visited[r] = 1;
      c = r;
    }
    if (path.length < 3) continue;
    emitRiver(path, endKind, pts, offsets, Q, W, H, cx, cy);
  }

  return {
    lakeDepth,
    lakeSalt,
    saltFlat,
    discharge,
    riverPts: new Float32Array(pts),
    riverOffsets: new Uint32Array(offsets),
    lakeCount,
    wetness,
    rcv: Int32Array.from(rcv),
  };
}

function emitRiver(
  path: number[],
  endKind: number,
  pts: number[],
  offsets: number[],
  Q: Float64Array,
  W: number,
  H: number,
  cx: (c: number) => number,
  cy: (c: number) => number,
): void {
  // coordonnées "déroulées" en x pour traverser l'antiméridien sans saut
  const xs: number[] = [], ys: number[] = [], qs: number[] = [];
  let prevX = cx(path[0]);
  for (let k = 0; k < path.length; k++) {
    const c = path[k];
    let x = cx(c);
    while (x - prevX > W / 2) x -= W;
    while (x - prevX < -W / 2) x += W;
    prevX = x;
    xs.push(x);
    ys.push(Math.min(H, cy(c)));
    qs.push(Q[c]);
  }
  // l'embouchure s'arrête à mi-chemin de la cellule d'eau
  const n = xs.length;
  if (endKind === 1 && n >= 2) {
    xs[n - 1] = (xs[n - 1] + xs[n - 2]) / 2;
    ys[n - 1] = (ys[n - 1] + ys[n - 2]) / 2;
    qs[n - 1] = qs[n - 2];
  }
  // le point de départ dans un lac porte le débit du premier tronçon
  if (qs[0] < qs[1] * 0.5) qs[0] = qs[1];
  // lissage de Chaikin (extrémités conservées)
  let X = xs, Y = ys, Qa = qs;
  for (let pass = 0; pass < 2; pass++) {
    const nx = [X[0]], ny = [Y[0]], nq = [Qa[0]];
    for (let k = 0; k < X.length - 1; k++) {
      nx.push(0.75 * X[k] + 0.25 * X[k + 1], 0.25 * X[k] + 0.75 * X[k + 1]);
      ny.push(0.75 * Y[k] + 0.25 * Y[k + 1], 0.25 * Y[k] + 0.75 * Y[k + 1]);
      nq.push(Qa[k], Qa[k + 1]);
    }
    nx.push(X[X.length - 1]);
    ny.push(Y[Y.length - 1]);
    nq.push(Qa[Qa.length - 1]);
    X = nx; Y = ny; Qa = nq;
  }
  for (let k = 0; k < X.length; k++) pts.push(X[k], Y[k], Qa[k]);
  offsets.push(pts.length / 3);
}

/** Remplit (h = niveau de débordement) les cuvettes de faible surface ou peu profondes. */
function fillSmallDepressions(
  grid: Grid,
  h: Float32Array,
  ocean: Uint8Array,
  filled: Float64Array,
  minAreaKm2: number,
  minDepth: number,
): void {
  const { N, W, nbr } = grid;
  const seen = new Uint8Array(N);
  const comp: number[] = [];
  const stack: number[] = [];
  for (let i = 0; i < N; i++) {
    if (seen[i] || ocean[i] || filled[i] - h[i] < 0.5) continue;
    comp.length = 0;
    let area = 0, maxDepth = 0;
    seen[i] = 1;
    stack.push(i);
    while (stack.length) {
      const c = stack.pop()!;
      comp.push(c);
      area += grid.area[(c / W) | 0];
      const d = filled[c] - h[c];
      if (d > maxDepth) maxDepth = d;
      const base = c * 8;
      for (let k = 0; k < 8; k++) {
        const n = nbr[base + k];
        if (n < 0 || seen[n] || ocean[n] || filled[n] - h[n] < 0.5) continue;
        seen[n] = 1;
        stack.push(n);
      }
    }
    if (area < minAreaKm2 || maxDepth < minDepth) {
      for (const c of comp) h[c] = filled[c];
    }
  }
}
