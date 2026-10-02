import { MinHeap } from '../heap';
import { Rng } from '../rng';
import type { CultureGroupInfo, CultureInfo } from '../types';
import { smoothstep } from '../util';
import { SpatialHash, type Terrain } from './common';
import type { CitySite } from './cities';
import type { Edge, ProvStats } from './graph';
import { demonym, makeLanguage, mutateLanguage, NameRegistry, placeName, type Language } from './names';

export interface CultureMap {
  provCulture: Int32Array;
  groups: CultureGroupInfo[];
  cultures: CultureInfo[];
  langs: Language[];
}

/** Coût de diffusion culturelle entre deux provinces : distance × relief, mers et crêtes isolent. */
export function spreadCost(t: Terrain, stats: ProvStats[], p: number, e: Edge): number {
  if (e.sea) return (e.km * 1.3 + 350) * 2.2;
  const rough = 0.5 * (stats[p].rough + stats[e.to].rough);
  const ridge = e.maxH - Math.max(t.h[stats[p].seed], t.h[stats[e.to].seed], 0);
  return e.km * rough * (1 + 1.2 * smoothstep(400, 1500, ridge));
}

function hsl(h: number, s: number, l: number): [number, number, number] {
  const k = (n: number) => (n + h * 12) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
}

/**
 * Cultures : des foyers historiques (grandes villes anciennes) diffusent leur culture sur le graphe
 * des provinces, freinée par les montagnes et les mers. Deux niveaux : familles (langues apparentées)
 * puis cultures à l'intérieur de chaque famille. Les frontières culturelles ignorent les frontières
 * politiques actuelles → minorités et peuples transfrontaliers.
 */
export function buildCultures(
  t: Terrain,
  stats: ProvStats[],
  adj: Edge[][],
  sites: CitySite[],
  cityProvince: number[],
  countryCount: number,
  rng: Rng,
  reg: NameRegistry,
): CultureMap {
  const { grid } = t;
  const P = stats.length;
  let landArea = 0, totalPop = 0;
  for (const s of stats) {
    landArea += s.area;
    totalPop += s.pop;
  }
  const G = Math.max(4, Math.min(14, Math.round(countryCount / 6) + 2));
  const Ctarget = Math.max(G * 2, Math.min(160, Math.round(countryCount * 1.2)));

  // foyers : grandes villes, avec une part de hasard (l'histoire n'est pas que démographie)
  const cand = sites.map((_, i) => i).sort((a, b) => sites[b].pop * rng.range(0.4, 1.6) - sites[a].pop * rng.range(0.4, 1.6));
  const pickHearths = (n: number, sepKm: number, allowed: (c: number) => boolean): number[] => {
    const out: number[] = [];
    let sep = sepKm;
    for (let pass = 0; pass < 5 && out.length < n; pass++) {
      const hash = new SpatialHash(grid, sep);
      for (const c of out) hash.add(sites[c].cell);
      for (const c of cand) {
        if (out.length >= n) break;
        if (!allowed(c) || out.includes(c) || hash.anyWithin(sites[c].cell, sep)) continue;
        hash.add(sites[c].cell);
        out.push(c);
      }
      sep *= 0.75;
    }
    return out;
  };

  const grow = (sources: number[], label: Int32Array, region: Int32Array | null): void => {
    const key = new Float64Array(P).fill(Infinity);
    const heap = new MinHeap(1024);
    sources.forEach((c, id) => {
      const p = cityProvince[c];
      label[p] = id;
      key[p] = 0;
      heap.push(0, p);
    });
    while (heap.size > 0) {
      const p = heap.pop();
      const k = heap.topKey;
      if (k > key[p]) continue;
      for (const e of adj[p]) {
        const q = e.to;
        if (region && region[q] !== region[p]) continue;
        const nk = k + spreadCost(t, stats, p, e);
        if (nk < key[q]) {
          key[q] = nk;
          label[q] = label[p];
          heap.push(nk, q);
        }
      }
    }
    // provinces isolées (îles lointaines) : étiquette de la province étiquetée la plus proche
    const hash = new SpatialHash(grid, 900);
    for (let p = 0; p < P; p++) if (label[p] >= 0) hash.add(stats[p].seed, p);
    for (let p = 0; p < P; p++) {
      if (label[p] >= 0 || stats[p].cells === 0) continue;
      let best = -1, bd = Infinity;
      for (let r = 900; best < 0 && r <= 7200; r *= 2) {
        hash.query(stats[p].seed, r, (_c, q, d) => {
          if (d < bd && (!region || region[q] === region[p] || region[p] < 0)) {
            bd = d;
            best = q;
          }
        });
      }
      if (best >= 0) label[p] = label[best];
    }
  };

  // --- familles culturelles ---
  const groupHearths = pickHearths(G, 0.8 * Math.sqrt(landArea / G), () => true);
  const provGroup = new Int32Array(P).fill(-1);
  grow(groupHearths, provGroup, null);
  const groupPop = new Float64Array(groupHearths.length);
  for (let p = 0; p < P; p++) if (provGroup[p] >= 0) groupPop[provGroup[p]] += stats[p].pop;

  // --- cultures dans chaque famille ---
  const cultureHearths: number[] = [];
  const cultureGroup: number[] = [];
  groupHearths.forEach((gh, g) => {
    const n = Math.max(1, Math.round((Ctarget * groupPop[g]) / Math.max(1, totalPop)));
    const inGroup = (c: number) => provGroup[cityProvince[c]] === g;
    const sep = 0.55 * Math.sqrt(landArea / Ctarget);
    const hs = [gh, ...pickHearths(n, sep, (c) => inGroup(c) && c !== gh)].slice(0, n);
    for (const h of hs) {
      cultureHearths.push(h);
      cultureGroup.push(g);
    }
  });
  const provCulture = new Int32Array(P).fill(-1);
  grow(cultureHearths, provCulture, provGroup);

  // --- identité : langue, noms, couleurs, traits ---
  const groupLangs = groupHearths.map(() => makeLanguage(rng));
  const langs = cultureHearths.map((_, c) => mutateLanguage(groupLangs[cultureGroup[c]], rng));
  const groups: CultureGroupInfo[] = groupHearths.map((_, g) => {
    const adj = reg.unique(() => {
      const r = demonym(groupLangs[g], rng).root;
      return r.replace(/i$/, '') + 'ique';
    });
    const hue = (g * 0.61803398875 + 0.05) % 1;
    return { id: g, name: `Famille ${adj}`, color: hsl(hue, 0.42, 0.5), cultures: [] };
  });

  const n = cultureHearths.length;
  const pop = new Float64Array(n), area = new Float64Array(n), nprov = new Int32Array(n);
  const terr = new Float64Array(n * 9), coastPop = new Float64Array(n);
  for (let p = 0; p < P; p++) {
    const c = provCulture[p];
    if (c < 0) continue;
    pop[c] += stats[p].pop;
    area[c] += stats[p].area;
    nprov[c]++;
    terr[c * 9 + stats[p].terrain] += stats[p].pop + stats[p].area * 0.5;
    if (stats[p].coastal) coastPop[c] += stats[p].pop;
  }
  const byGroupIndex = new Int32Array(G + 1);
  const cultures: CultureInfo[] = cultureHearths.map((h, c) => {
    const g = cultureGroup[c];
    const name = reg.unique(() => {
      const x = demonym(langs[c], rng);
      return x.m.charAt(0).toUpperCase() + x.m.slice(1);
    });
    const adjM = name.toLowerCase();
    const adjF = feminine(adjM);
    groups[g].cultures.push(c);
    const k = byGroupIndex[g]++;
    const baseHue = (g * 0.61803398875 + 0.05) % 1;
    const color = hsl((baseHue + ((k % 5) - 2) * 0.028 + 1) % 1, 0.3 + 0.08 * (k % 3), 0.4 + 0.07 * ((k * 3) % 4));
    return {
      id: c, name, adjM, adjF, group: g, color, hearth: h, pop: pop[c], area: area[c], provinces: nprov[c],
      traits: cultureTraits(c, terr, coastPop[c], pop[c], rng), sample: [0, 1, 2, 3].map(() => placeName(langs[c], rng)), label: null,
    };
  });
  return { provCulture, groups, cultures, langs };
}

/** Accord féminin d'un gentilé généré (terminaisons connues). */
export function feminine(m: string): string {
  const pairs: [string, string][] = [['ois', 'oise'], ['ien', 'ienne'], ['ais', 'aise'], ['éen', 'éenne'], ['ain', 'aine'], ['an', 'ane'], ['in', 'ine'], ['i', 'ie']];
  for (const [a, b] of pairs) if (m.endsWith(a)) return m.slice(0, -a.length) + b;
  return m;
}

const EXTRA_TRAITS = ['Égalitaires', 'Guerriers', 'Érudits', 'Artisans', 'Hospitaliers', 'Superstitieux', 'Conteurs', 'Bâtisseurs'];

function cultureTraits(c: number, terr: Float64Array, coastPop: number, pop: number, rng: Rng): string[] {
  let tot = 0;
  for (let k = 0; k < 9; k++) tot += terr[c * 9 + k];
  const sh = (k: number) => (tot > 0 ? terr[c * 9 + k] / tot : 0);
  const traits: string[] = [];
  if (pop > 0 && coastPop / pop > 0.45) traits.push('Peuple marin');
  if (sh(3) + sh(4) > 0.42) traits.push('Montagnards');
  if (sh(5) > 0.3) traits.push('Caravaniers du désert');
  if (sh(7) + sh(8) > 0.3) traits.push('Peuple du grand froid');
  if (sh(2) > 0.35) traits.push('Gens de la jungle');
  if (sh(1) > 0.45) traits.push('Peuple des forêts');
  if (sh(0) > 0.5) traits.push(rng.chance(0.5) ? 'Agriculteurs' : 'Cavaliers des plaines');
  if (sh(6) > 0.2) traits.push('Gens des marais');
  if (traits.length < 3 && rng.chance(0.6)) traits.push(rng.pick(EXTRA_TRAITS));
  return traits.slice(0, 3);
}
