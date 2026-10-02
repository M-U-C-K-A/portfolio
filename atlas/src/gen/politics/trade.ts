import type { Grid } from '../grid';
import { MinHeap } from '../heap';
import { cellDistKm, SpatialHash, unwrapX, type Terrain } from './common';
import type { CitySite } from './cities';

export interface TradeLink {
  a: number;
  b: number;
  kind: 0 | 1;
  cost: number;
  path: number[];
  volume: number;
}

export interface TradeResult {
  links: TradeLink[];
  /** Tronçons agrégés : polylignes avec trafic cumulé. */
  segments: { kind: 0 | 1; volume: number; pts: number[] }[];
  trade: Float64Array;
  partners: { id: number; share: number }[][];
  /** Multiplicateur de coût (routes construites = moins cher), réutilisé par les zones d'influence. */
  roadFactor: Float32Array;
}

/** Tampons réutilisés par toutes les recherches A* (tampons « estampillés » : pas de remise à zéro). */
class AStar {
  private readonly g: Float32Array;
  private readonly parent: Int32Array;
  private readonly stamp: Int32Array;
  private readonly closed: Int32Array;
  private readonly heap = new MinHeap(1 << 14);
  private id = 0;

  constructor(private readonly grid: Grid) {
    const N = grid.N;
    this.g = new Float32Array(N);
    this.parent = new Int32Array(N);
    this.stamp = new Int32Array(N);
    this.closed = new Int32Array(N);
  }

  run(start: number, goal: number, step: (c: number, n: number, d: number) => number, hScale: number, maxExpand: number): { path: number[]; cost: number } | null {
    const { grid, g, parent, stamp, closed, heap } = this;
    const { W, nbr, ndist } = grid;
    const id = ++this.id;
    heap.clear();
    g[start] = 0;
    stamp[start] = id;
    parent[start] = -1;
    heap.push(cellDistKm(grid, start, goal) * hScale, start);
    let expanded = 0;
    while (heap.size > 0) {
      const c = heap.pop();
      if (closed[c] === id) continue;
      closed[c] = id;
      if (c === goal) {
        const path: number[] = [];
        for (let x = c; x >= 0; x = parent[x]) path.push(x);
        path.reverse();
        return { path, cost: g[c] };
      }
      if (++expanded > maxExpand) return null;
      const row = ((c / W) | 0) * 8;
      const base = c * 8;
      const gc = g[c];
      for (let k = 0; k < 8; k++) {
        const n = nbr[base + k];
        if (n < 0 || closed[n] === id) continue;
        const sc = step(c, n, ndist[row + k]);
        if (!(sc < Infinity)) continue;
        const ng = gc + sc;
        if (stamp[n] !== id || ng < g[n]) {
          stamp[n] = id;
          g[n] = ng;
          parent[n] = c;
          heap.push(ng + cellDistKm(grid, n, goal) * hScale, n);
        }
      }
    }
    return null;
  }
}

/** Graphe de voisinage relatif : garde (a, b) sauf si une ville c est plus proche de a ET de b. */
function relativeNeighbors(grid: Grid, cells: number[], ok: (a: number, b: number) => boolean, maxKm: number): [number, number][] {
  const hash = new SpatialHash(grid, maxKm);
  cells.forEach((c, i) => hash.add(c, i));
  const near: { j: number; d: number }[][] = cells.map(() => []);
  cells.forEach((c, i) => {
    hash.query(c, maxKm, (_c, j, d) => {
      if (j !== i && ok(i, j)) near[i].push({ j, d });
    });
  });
  const edges: [number, number][] = [];
  for (let i = 0; i < cells.length; i++) {
    for (const { j, d } of near[i]) {
      if (j < i) continue;
      let blocked = false;
      for (const { j: k, d: dik } of near[i]) {
        if (k === j || dik >= d) continue;
        if (cellDistKm(grid, cells[j], cells[k]) < d) {
          blocked = true;
          break;
        }
      }
      if (!blocked) edges.push([i, j]);
    }
  }
  return edges;
}

export function buildTrade(t: Terrain, cost: Float32Array, sites: CitySite[], cityCountry: number[]): TradeResult {
  const { grid, ocean } = t;
  const { N, W } = grid;
  const n = sites.length;
  const astar = new AStar(grid);
  // budget de recherche proportionnel au nombre de cellules (grilles fines = chemins plus longs)
  const budget = Math.max(1, (grid.W / 1536) ** 2);
  const roadFactor = new Float32Array(N).fill(1);
  const links: TradeLink[] = [];

  let landArea = 0;
  for (let i = 0; i < N; i++) if (!ocean[i]) landArea += grid.area[(i / W) | 0];
  const spacing = Math.sqrt(landArea / Math.max(1, n));

  // --- routes terrestres ---
  const cells = sites.map((s) => s.cell);
  const landPairs = relativeNeighbors(grid, cells, (a, b) => sites[a].landmass === sites[b].landmass, spacing * 2.8);
  const degree = new Int32Array(n);
  for (const [a, b] of landPairs) {
    degree[a]++;
    degree[b]++;
  }
  // une ville isolée se raccorde au moins à sa plus proche voisine terrestre
  for (let a = 0; a < n; a++) {
    if (degree[a] > 0) continue;
    let best = -1, bd = Infinity;
    for (let b = 0; b < n; b++) {
      if (b === a || sites[b].landmass !== sites[a].landmass) continue;
      const d = cellDistKm(grid, cells[a], cells[b]);
      if (d < bd) {
        bd = d;
        best = b;
      }
    }
    if (best >= 0) {
      landPairs.push([a, best]);
      degree[a]++;
      degree[best]++;
    }
  }
  landPairs.sort((p, q) => cellDistKm(grid, cells[p[0]], cells[p[1]]) - cellDistKm(grid, cells[q[0]], cells[q[1]]));
  const landStep = (c: number, m: number, d: number): number =>
    ocean[m] ? Infinity : d * 0.5 * (cost[c] * roadFactor[c] + cost[m] * roadFactor[m]);
  for (const [a, b] of landPairs) {
    const r = astar.run(cells[a], cells[b], landStep, 0.42, 250000 * budget);
    if (!r) continue;
    for (const c of r.path) roadFactor[c] = 0.5;
    links.push({ a, b, kind: 0, cost: r.cost * (cityCountry[a] !== cityCountry[b] ? 1.2 : 1), path: r.path, volume: 0 });
  }

  // --- lignes maritimes entre ports ---
  const ports = sites.map((s, i) => (s.port ? i : -1)).filter((i) => i >= 0);
  const portCells = ports.map((i) => sites[i].portCell);
  const landLinked = new Set(links.map((l) => l.a * 65536 + l.b));
  const seaPairs = relativeNeighbors(grid, portCells, () => true, 2400).map(([i, j]) => [ports[i], ports[j]]);
  // liaisons transocéaniques : chaque port vers le port le plus proche d'une autre terre
  const hash = new SpatialHash(grid, 1500);
  ports.forEach((c) => hash.add(sites[c].portCell, c));
  for (const a of ports) {
    let best = -1, bd = Infinity;
    for (let r = 1500; best < 0 && r <= 6000; r *= 2) {
      hash.query(sites[a].portCell, r, (_c, b, d) => {
        if (sites[b].landmass !== sites[a].landmass && d < bd) {
          bd = d;
          best = b;
        }
      });
    }
    if (best >= 0) seaPairs.push([a, best]);
  }
  const seen = new Set<number>();
  const seaStep = (_c: number, m: number, d: number): number => (ocean[m] ? d : Infinity);
  for (const [p, q] of seaPairs) {
    const a = Math.min(p, q), b = Math.max(p, q);
    const key = a * 65536 + b;
    if (seen.has(key) || landLinked.has(key)) continue;
    seen.add(key);
    const r = astar.run(sites[a].portCell, sites[b].portCell, seaStep, 1.25, 120000 * budget);
    if (!r) continue;
    const km = r.cost;
    // le cabotage le long d'une même côte n'a d'intérêt que s'il raccourcit nettement le trajet
    if (sites[a].landmass === sites[b].landmass && km < 300) continue;
    links.push({ a, b, kind: 1, cost: km * 0.45 + 240, path: [cells[a], ...r.path, cells[b]], volume: 0 });
  }

  // --- flux gravitaires entre TOUTES les paires de villes, routés sur le réseau ---
  const adj: { to: number; link: number }[][] = Array.from({ length: n }, () => []);
  links.forEach((l, li) => {
    adj[l.a].push({ to: l.b, link: li });
    adj[l.b].push({ to: l.a, link: li });
  });
  const trade = new Float64Array(n);
  const flows = new Float32Array(n * n);
  const dist = new Float64Array(n);
  const prev = new Int32Array(n);
  const heap = new MinHeap(n * 4);
  const popW = sites.map((s) => Math.pow(s.pop, 0.8));
  for (let s = 0; s < n; s++) {
    dist.fill(Infinity);
    prev.fill(-1);
    dist[s] = 0;
    heap.clear();
    heap.push(0, s);
    while (heap.size > 0) {
      const u = heap.pop();
      const d = heap.topKey;
      if (d > dist[u]) continue;
      for (const { to, link } of adj[u]) {
        const nd = d + links[link].cost;
        if (nd < dist[to]) {
          dist[to] = nd;
          prev[to] = link;
          heap.push(nd, to);
        }
      }
    }
    for (let q = s + 1; q < n; q++) {
      if (!(dist[q] < Infinity)) continue;
      const f = (popW[s] * popW[q]) / Math.pow(dist[q] + 60, 1.5) * (cityCountry[s] !== cityCountry[q] ? 0.6 : 1);
      flows[s * n + q] = flows[q * n + s] = f;
      trade[s] += f;
      trade[q] += f;
      for (let v = q; v !== s; ) {
        const l = links[prev[v]];
        l.volume += f;
        v = l.a === v ? l.b : l.a;
      }
    }
  }
  const partners = sites.map((_, a) => {
    const list: { id: number; share: number }[] = [];
    for (let b = 0; b < n; b++) if (flows[a * n + b] > 0) list.push({ id: b, share: flows[a * n + b] / trade[a] });
    return list.sort((x, y) => y.share - x.share).slice(0, 8);
  });

  return { links, segments: aggregate(grid, links), trade, partners, roadFactor };
}

/** Additionne le trafic par lien de cellules puis chaîne les liens en polylignes de trafic homogène. */
function aggregate(grid: Grid, links: TradeLink[]): TradeResult['segments'] {
  const { W } = grid;
  const traffic = new Map<number, number>();
  const kindOf = new Map<number, number>();
  const nbrs = new Map<number, Set<number>>();
  const N = grid.N;
  const addN = (a: number, b: number) => {
    let s = nbrs.get(a);
    if (!s) nbrs.set(a, (s = new Set()));
    s.add(b);
  };
  for (const l of links) {
    for (let k = 0; k + 1 < l.path.length; k++) {
      const a = l.path[k], b = l.path[k + 1];
      if (a === b) continue;
      const key = Math.min(a, b) * N + Math.max(a, b);
      traffic.set(key, (traffic.get(key) ?? 0) + l.volume);
      kindOf.set(key, Math.max(kindOf.get(key) ?? 0, l.kind));
      addN(a, b);
      addN(b, a);
    }
  }
  let maxV = 0;
  for (const v of traffic.values()) maxV = Math.max(maxV, v);
  const cls = (v: number) => Math.max(0, Math.min(9, Math.floor(Math.log2((v / maxV) * 1024))));
  const done = new Set<number>();
  const segments: TradeResult['segments'] = [];
  const keyOf = (a: number, b: number) => Math.min(a, b) * N + Math.max(a, b);
  for (const [key, vol] of traffic) {
    if (done.has(key)) continue;
    const a0 = Math.floor(key / N), b0 = key % N;
    const c0 = cls(vol), k0 = kindOf.get(key)!;
    done.add(key);
    // prolongation dans les deux sens tant que le nœud est de degré 2 et le trafic de même classe
    const extend = (from: number, to: number): number[] => {
      const chain: number[] = [];
      let p = from, c = to;
      for (;;) {
        const nb = nbrs.get(c)!;
        if (nb.size !== 2) break;
        let nx = -1;
        for (const x of nb) if (x !== p) nx = x;
        const k = keyOf(c, nx);
        if (done.has(k) || cls(traffic.get(k)!) !== c0 || kindOf.get(k) !== k0) break;
        done.add(k);
        chain.push(nx);
        p = c;
        c = nx;
      }
      return chain;
    };
    const fwd = extend(a0, b0);
    const bwd = extend(b0, a0);
    const cellsChain = [...bwd.reverse(), a0, b0, ...fwd];
    const pts: number[] = [];
    let prevX = (cellsChain[0] % W) + 0.5;
    for (const c of cellsChain) {
      const x = unwrapX((c % W) + 0.5, prevX, W);
      prevX = x;
      pts.push(x, ((c / W) | 0) + 0.5);
    }
    segments.push({ kind: k0 as 0 | 1, volume: vol, pts: chaikin(pts, 2) });
  }
  return segments;
}

function chaikin(p: number[], passes: number): number[] {
  let pts = p;
  for (let s = 0; s < passes && pts.length >= 6; s++) {
    const out = [pts[0], pts[1]];
    for (let i = 0; i + 3 < pts.length; i += 2) {
      out.push(0.75 * pts[i] + 0.25 * pts[i + 2], 0.75 * pts[i + 1] + 0.25 * pts[i + 3]);
      out.push(0.25 * pts[i] + 0.75 * pts[i + 2], 0.25 * pts[i + 1] + 0.75 * pts[i + 3]);
    }
    out.push(pts[pts.length - 2], pts[pts.length - 1]);
    pts = out;
  }
  return pts;
}
