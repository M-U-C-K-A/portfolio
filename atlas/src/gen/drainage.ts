import type { Grid } from './grid';
import { MinHeap } from './heap';
import { hash01 } from './rng';

/**
 * Réseau de drainage sur grille :
 *  1. priority-flood + ε (Barnes 2014) depuis l'océan → surface sans cuvette (`filled`),
 *  2. récepteur = voisin de plus forte pente (avec léger jitter pour casser l'anisotropie D8),
 *  3. ordre topologique aval → amont (BFS depuis les exutoires).
 * Les buffers sont alloués une fois et réutilisés à chaque itération d'érosion.
 */
export class Drainage {
  readonly filled: Float64Array;
  /** Cellule depuis laquelle chaque cellule a été atteinte par l'inondation (chemin vers l'exutoire). */
  readonly parent: Int32Array;
  readonly rcv: Int32Array;
  readonly rdist: Float32Array;
  /** Cellules triées de l'aval vers l'amont (les exutoires d'abord). */
  readonly order: Int32Array;
  count = 0;

  private readonly grid: Grid;
  private readonly heap: MinHeap;
  private readonly pit: Int32Array;
  private readonly closed: Uint8Array;
  private readonly donorStart: Int32Array;
  private readonly donors: Int32Array;
  private readonly cursor: Int32Array;

  constructor(grid: Grid) {
    const N = grid.N;
    this.grid = grid;
    this.filled = new Float64Array(N);
    this.parent = new Int32Array(N);
    this.rcv = new Int32Array(N);
    this.rdist = new Float32Array(N);
    this.order = new Int32Array(N);
    this.heap = new MinHeap(Math.max(1024, N >> 3));
    this.pit = new Int32Array(N);
    this.closed = new Uint8Array(N);
    this.donorStart = new Int32Array(N + 1);
    this.donors = new Int32Array(N);
    this.cursor = new Int32Array(N);
  }

  /**
   * @param breachDepth si > 0, les cuvettes vidangeables par une entaille ≤ breachDepth (m) sont
   *   percées (h est modifié le long de la gorge) au lieu d'être remplies.
   */
  compute(h: Float32Array, ocean: Uint8Array, eps: number, jitterSalt: number, breachDepth = 0, approx = false): void {
    if (approx && breachDepth === 0) this.fillBuckets(h, ocean, eps);
    else this.fill(h, ocean, eps, breachDepth);
    this.receivers(ocean, jitterSalt);
    this.topoOrder();
  }

  /** Liste des cellules terrestres (l'océan ne change pas d'une itération à l'autre). */
  private landCache: { ocean: Uint8Array; idx: Int32Array; coastal: Int32Array } | null = null;

  landCells(ocean: Uint8Array): { idx: Int32Array; coastal: Int32Array } {
    if (this.landCache && this.landCache.ocean === ocean) return this.landCache;
    const { N, nbr } = this.grid;
    const land: number[] = [];
    const coastal: number[] = [];
    for (let i = 0; i < N; i++) {
      if (!ocean[i]) {
        land.push(i);
        continue;
      }
      const base = i * 8;
      for (let k = 0; k < 8; k++) {
        const n = nbr[base + k];
        if (n >= 0 && !ocean[n]) {
          coastal.push(i);
          break;
        }
      }
    }
    this.landCache = { ocean, idx: Int32Array.from(land), coastal: Int32Array.from(coastal) };
    return this.landCache;
  }

  private fill(h: Float32Array, ocean: Uint8Array, eps: number, breachDepth: number): void {
    const { N, nbr } = this.grid;
    const { filled, closed, heap, pit, parent } = this;
    const { idx: land, coastal } = this.landCells(ocean);
    closed.fill(1);
    for (let j = 0; j < land.length; j++) {
      closed[land[j]] = 0;
      parent[land[j]] = -1;
    }
    heap.clear();
    const anyOcean = land.length < N;
    if (anyOcean) {
      for (let j = 0; j < coastal.length; j++) {
        const i = coastal[j];
        filled[i] = 0;
        parent[i] = -1;
        heap.push(0, i);
      }
    } else {
      closed.fill(0);
      let lo = 0;
      for (let i = 1; i < N; i++) if (h[i] < h[lo]) lo = i;
      closed[lo] = 1;
      filled[lo] = h[lo];
      heap.push(h[lo], lo);
    }
    let head = 0, tail = 0;
    while (head < tail || heap.size > 0) {
      let c: number;
      if (head < tail) {
        c = pit[head++];
        if (head === tail) head = tail = 0;
      } else {
        c = heap.pop();
      }
      const lim = filled[c] + eps;
      const base = c * 8;
      for (let k = 0; k < 8; k++) {
        const n = nbr[base + k];
        if (n < 0 || closed[n]) continue;
        closed[n] = 1;
        parent[n] = c;
        const hn = h[n];
        if (hn <= lim) {
          if (breachDepth > 0 && this.tryBreach(h, ocean, n, c, eps, breachDepth)) {
            filled[n] = hn;
            heap.push(hn, n);
            continue;
          }
          filled[n] = lim;
          pit[tail++] = n;
        } else {
          filled[n] = hn;
          heap.push(hn, n);
        }
      }
    }
  }

  private bucketHead: Int32Array | null = null;
  private bucketNext: Int32Array | null = null;

  /**
   * Variante approchée du priority-flood avec une file à seaux (hauteurs quantifiées à 0,25 m) :
   * O(1) par opération au lieu de O(log n). Suffisant pour les itérations d'érosion.
   */
  private fillBuckets(h: Float32Array, ocean: Uint8Array, eps: number): void {
    const { N, nbr } = this.grid;
    const { filled, closed, pit, parent } = this;
    const { idx: land, coastal } = this.landCells(ocean);
    if (land.length === N) {
      this.fill(h, ocean, eps, 0);
      return;
    }
    const BW = 0.25;
    let lo = 0, hi = 1;
    for (let j = 0; j < land.length; j++) {
      const v = h[land[j]];
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
    const nb = Math.ceil((hi - lo) / BW) + 2;
    if (!this.bucketHead || this.bucketHead.length < nb) this.bucketHead = new Int32Array(nb);
    if (!this.bucketNext) this.bucketNext = new Int32Array(N);
    const head = this.bucketHead, next = this.bucketNext;
    head.fill(-1, 0, nb);
    closed.fill(1);
    for (let j = 0; j < land.length; j++) {
      closed[land[j]] = 0;
      parent[land[j]] = -1;
    }
    const b0 = Math.floor((0 - lo) / BW);
    for (let j = 0; j < coastal.length; j++) {
      const i = coastal[j];
      filled[i] = 0;
      parent[i] = -1;
      next[i] = head[b0];
      head[b0] = i;
    }
    let cur = b0;
    let ph = 0, pt = 0;
    for (;;) {
      let c: number;
      if (ph < pt) {
        c = pit[ph++];
        if (ph === pt) ph = pt = 0;
      } else {
        while (cur < nb && head[cur] < 0) cur++;
        if (cur >= nb) break;
        c = head[cur];
        head[cur] = next[c];
      }
      const lim = filled[c] + eps;
      const base = c * 8;
      for (let k = 0; k < 8; k++) {
        const n = nbr[base + k];
        if (n < 0 || closed[n]) continue;
        closed[n] = 1;
        parent[n] = c;
        const hn = h[n];
        if (hn <= lim) {
          filled[n] = lim;
          pit[pt++] = n;
        } else {
          filled[n] = hn;
          let b = Math.floor((hn - lo) / BW);
          if (b < cur) b = cur;
          next[n] = head[b];
          head[b] = n;
        }
      }
    }
  }

  /** Tente de creuser une gorge descendante de n vers l'exutoire en suivant la chaîne des parents. */
  private tryBreach(h: Float32Array, ocean: Uint8Array, n: number, c: number, eps: number, maxDepth: number): boolean {
    const { filled, parent } = this;
    if (filled[c] !== h[c]) return false; // c est lui-même dans une cuvette remplie
    const hn = h[n];
    const MAX_LEN = 80;
    let k = c, j = 1;
    while (k >= 0 && !ocean[k]) {
      const target = hn - j * eps;
      if (h[k] <= target) break;
      if (h[k] - target > maxDepth || j > MAX_LEN) return false;
      k = parent[k];
      j++;
    }
    k = c;
    j = 1;
    while (k >= 0 && !ocean[k]) {
      const target = hn - j * eps;
      if (h[k] <= target) break;
      h[k] = target;
      filled[k] = h[k];
      k = parent[k];
      j++;
    }
    return true;
  }

  private receivers(ocean: Uint8Array, salt: number): void {
    const { N, W, nbr, ndist } = this.grid;
    const { filled, rcv, rdist } = this;
    const land = this.landCells(ocean).idx;
    if (land.length < N) {
      for (let i = 0; i < N; i++) {
        rcv[i] = i;
        rdist[i] = 1;
      }
    }
    for (let j = 0; j < land.length; j++) {
      const i = land[j];
      const row = ((i / W) | 0) * 8;
      const base = i * 8;
      const fi = filled[i];
      let best = -1, bs = 0, bd = 1;
      for (let k = 0; k < 8; k++) {
        const n = nbr[base + k];
        if (n < 0) continue;
        const dz = fi - filled[n];
        if (dz <= 0) continue;
        const d = ndist[row + k];
        let sl = dz / d;
        if (salt) sl *= 0.75 + 0.5 * hash01(base + k, salt);
        if (sl > bs) {
          bs = sl;
          best = n;
          bd = d;
        }
      }
      if (best < 0) {
        rcv[i] = i;
        rdist[i] = 1;
      } else {
        rcv[i] = best;
        rdist[i] = bd;
      }
    }
  }

  private topoOrder(): void {
    const N = this.grid.N;
    const { rcv, order, donorStart, donors, cursor } = this;
    donorStart.fill(0);
    for (let i = 0; i < N; i++) {
      const r = rcv[i];
      if (r !== i) donorStart[r + 1]++;
    }
    for (let i = 1; i <= N; i++) donorStart[i] += donorStart[i - 1];
    for (let i = 0; i < N; i++) cursor[i] = donorStart[i];
    for (let i = 0; i < N; i++) {
      const r = rcv[i];
      if (r !== i) donors[cursor[r]++] = i;
    }
    let count = 0;
    for (let i = 0; i < N; i++) if (rcv[i] === i) order[count++] = i;
    let head = 0;
    while (head < count) {
      const c = order[head++];
      for (let j = donorStart[c], e = donorStart[c + 1]; j < e; j++) order[count++] = donors[j];
    }
    this.count = count;
  }

  /** Donneurs (amont immédiat) d'une cellule. */
  forEachDonor(c: number, fn: (d: number) => void): void {
    for (let j = this.donorStart[c], e = this.donorStart[c + 1]; j < e; j++) fn(this.donors[j]);
  }
}
