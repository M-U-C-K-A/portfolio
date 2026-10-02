import { MinHeap } from '../heap';
import { Rng } from '../rng';
import type { ContinentInfo } from '../types';
import { components, type Terrain } from './common';
import { countryName, makeLanguage, NameRegistry, placeName } from './names';

/** Profondeur limite du plateau continental (m) : au-delà, on est sur la croûte océanique. */
const SHELF_DEPTH = -500;

/**
 * Continents au sens géologique : terres + plateaux continentaux (< 500 m de fond) connexes,
 * découpés par plaque tectonique quand plusieurs cratons de grande taille se sont soudés
 * (collision type Inde–Eurasie). Les îles océaniques sont rattachées au bloc le plus proche
 * (< 1 500 km) ou regroupées en archipels.
 */
export function buildContinents(t: Terrain, rng: Rng, reg: NameRegistry): { continent: Uint8Array; infos: ContinentInfo[] } {
  const { grid, ocean, h, plate } = t;
  const { N, W, nbr, ndist } = grid;
  const comps = components(grid, (i) => !ocean[i] || h[i] > SHELF_DEPTH);
  let totalLand = 0;
  const compLand = new Float64Array(comps.count);
  const block = new Map<number, number>(); // (composante, plaque) → surface émergée
  for (let i = 0; i < N; i++) {
    if (ocean[i]) continue;
    const a = grid.area[(i / W) | 0];
    totalLand += a;
    const c = comps.label[i];
    compLand[c] += a;
    const k = c * 256 + plate[i];
    block.set(k, (block.get(k) ?? 0) + a);
  }
  const lang = makeLanguage(rng);
  const infos: ContinentInfo[] = [];
  const blockId = new Map<number, number>();
  const compId = new Int32Array(comps.count).fill(-1);
  const newInfo = (kind: ContinentInfo['kind']): number => {
    infos.push({ id: infos.length, name: reg.unique(() => countryName(lang, rng)), kind, landArea: 0, shelfArea: 0, label: null });
    return infos.length - 1;
  };
  const blocks = [...block.entries()].sort((a, b) => b[1] - a[1]);
  for (const [k, a] of blocks) if (a >= totalLand * 0.05 && infos.length < 200) blockId.set(k, newInfo('continent'));
  const hasBlock = new Uint8Array(comps.count);
  for (const k of blockId.keys()) hasBlock[Math.floor(k / 256)] = 1;
  const compsBySize = [...Array(comps.count).keys()].sort((a, b) => compLand[b] - compLand[a]);
  for (const c of compsBySize) {
    if (hasBlock[c] || compLand[c] < totalLand * 0.0015 || infos.length >= 200) continue;
    compId[c] = newInfo(compLand[c] >= totalLand * 0.02 ? 'continent' : 'microcontinent');
  }

  const continent = new Uint8Array(N).fill(255);
  const heapB = new MinHeap(1 << 14);
  for (let i = 0; i < N; i++) {
    const c = comps.label[i];
    if (c < 0) continue;
    if (compId[c] >= 0) continent[i] = compId[c];
    else if (!ocean[i]) {
      const b = blockId.get(c * 256 + plate[i]);
      if (b !== undefined) {
        continent[i] = b;
        heapB.push(0, i);
      }
    }
  }
  // cellules d'une composante multi-cratons hors des grands blocs : au bloc le plus proche dans la composante
  const distB = new Float32Array(N).fill(Infinity);
  for (let q = 0; q < heapB.size; q++) distB[heapB.vals[q]] = 0;
  while (heapB.size > 0) {
    const c = heapB.pop();
    const d = heapB.topKey;
    if (d > distB[c]) continue;
    const row = ((c / W) | 0) * 8;
    for (let k = 0; k < 8; k++) {
      const n = nbr[c * 8 + k];
      if (n < 0 || comps.label[n] !== comps.label[c] || !hasBlock[comps.label[n]]) continue;
      const nd = Math.fround(d + ndist[row + k]); // float32 comme `dist`
      if (nd < distB[n]) {
        distB[n] = nd;
        continent[n] = continent[c];
        heapB.push(nd, n);
      }
    }
  }
  for (let i = 0; i < N; i++) {
    const k = continent[i];
    if (k === 255) continue;
    const a = grid.area[(i / W) | 0];
    if (ocean[i]) infos[k].shelfArea += a;
    else infos[k].landArea += a;
  }

  // terres restantes (îles océaniques, fragments) : rattachement au bloc le plus proche
  const MAX_KM = 1500;
  const dist = new Float32Array(N).fill(Infinity);
  const src = new Int16Array(N).fill(-1);
  const heap = new MinHeap(1 << 16);
  let pending = 0;
  for (let i = 0; i < N; i++) {
    if (ocean[i]) continue;
    if (continent[i] !== 255) {
      dist[i] = 0;
      src[i] = continent[i];
      heap.push(0, i);
    } else pending++;
  }
  while (heap.size > 0 && pending > 0) {
    const c = heap.pop();
    const d = heap.topKey;
    if (d > dist[c] || d > MAX_KM) continue;
    if (!ocean[c] && continent[c] === 255) {
      continent[c] = src[c];
      infos[src[c]].landArea += grid.area[(c / W) | 0];
      pending--;
    }
    const row = ((c / W) | 0) * 8;
    for (let k = 0; k < 8; k++) {
      const n = nbr[c * 8 + k];
      if (n < 0) continue;
      const nd = Math.fround(d + ndist[row + k]); // float32 comme `dist`
      if (nd < dist[n]) {
        dist[n] = nd;
        src[n] = src[c];
        heap.push(nd, n);
      }
    }
  }

  // îles lointaines : archipels (groupes d'îles distantes de moins de 500 km)
  if (pending > 0) {
    const group = new Int32Array(N).fill(-1);
    for (let i = 0; i < N && infos.length < 254; i++) {
      if (ocean[i] || continent[i] !== 255 || group[i] >= 0) continue;
      const id = infos.length;
      const gd = new Map<number, number>();
      const h2 = new MinHeap(256);
      h2.push(0, i);
      gd.set(i, 0);
      let area = 0;
      while (h2.size > 0) {
        const c = h2.pop();
        const d = h2.topKey;
        if (d > (gd.get(c) ?? Infinity)) continue;
        if (!ocean[c] && continent[c] === 255) {
          continent[c] = id;
          group[c] = id;
          area += grid.area[(c / W) | 0];
          gd.set(c, 0);
        }
        const base = gd.get(c)!;
        const row = ((c / W) | 0) * 8;
        for (let k = 0; k < 8; k++) {
          const n = nbr[c * 8 + k];
          if (n < 0) continue;
          const nd = base + ndist[row + k];
          if (nd > 900 || nd >= (gd.get(n) ?? Infinity)) continue;
          gd.set(n, nd);
          h2.push(nd, n);
        }
      }
      const n = reg.unique(() => placeName(lang, rng));
      infos.push({ id, name: `Archipel ${/^[aeiouy]/i.test(n) ? "d'" : 'de '}${n}`, kind: 'archipel', landArea: area, shelfArea: 0, label: null });
    }
  }
  return { continent, infos };
}
