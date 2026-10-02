import type { Grid } from '../grid';
import { MinHeap } from '../heap';
import type { Rng } from '../rng';
import type { RegionInfo, StateInfo } from '../types';
import { cellDistKm } from './common';
import type { Edge, ProvStats } from './graph';
import { type Language, type NameRegistry, placeName } from './names';

/**
 * États et régions historiques, à la manière de Hearts of Iron IV.
 * - Un État regroupe quelques provinces contiguës d'un même pays autour d'une ville principale ; ses
 *   limites suivent de préférence les crêtes, les grands fleuves et les limites de peuples.
 * - Une région historique regroupe des États voisins d'un même ensemble géographique (plaine, massif,
 *   littoral, archipel) sans tenir compte des frontières politiques : c'est la géographie « longue ».
 */

/** Provinces visées par État (la taille réelle varie avec la géographie). */
const STATE_PROVINCES = 4.5;
/** États visés par région historique. */
const REGION_STATES = 8;

// terrains de PROVINCE_TERRAINS : 0 plaines, 1 forêt, 2 jungle, 3 collines, 4 montagnes, 5 désert, 6 marais, 7 toundra, 8 glacier
const RESOURCES: [string, number[], number][] = [
  ['Blé', [0], 0.35],
  ['Bois', [1, 2], 0.35],
  ['Épices', [2], 0.25],
  ['Fer', [3, 4], 0.25],
  ['Cuivre', [3, 4], 0.15],
  ['Or', [4], 0.06],
  ['Charbon', [3, 1], 0.12],
  ['Sel', [5], 0.3],
  ['Tourbe', [6], 0.3],
  ['Fourrures', [7, 1], 0.2],
  ['Chevaux', [0, 5], 0.12],
];

/** « de X » avec élision devant une voyelle. */
const de = (n: string) => (/^[aeiouyéèêâîôh]/i.test(n) ? `d'${n}` : `de ${n}`);

interface Input {
  grid: Grid;
  stats: ProvStats[];
  adj: Edge[][];
  owner: Int32Array;
  provCulture: ArrayLike<number>;
  /** Ville (indice) de chaque province, -1 sinon. */
  cityOf: (p: number) => number;
  cityPop: number[];
  cityName: string[];
  /** Ville capitale de chaque pays. */
  capitals: number[];
  langs: Language[];
  /** Altitude moyenne de chaque province (m). */
  provHeight: Float64Array;
  rng: Rng;
  reg: NameRegistry;
}

/** Croissance de régions depuis des germes sur un graphe (Dijkstra multi-sources). */
function grow(n: number, seeds: number[], neighbors: (u: number) => [number, number][], allowed: (u: number) => boolean): Int32Array {
  const lab = new Int32Array(n).fill(-1);
  const dist = new Float64Array(n).fill(Infinity);
  const heap = new MinHeap(64);
  seeds.forEach((s, k) => {
    lab[s] = k;
    dist[s] = 0;
    heap.push(0, s);
  });
  while (heap.size) {
    const u = heap.pop();
    const du = heap.topKey;
    if (du > dist[u]) continue;
    for (const [v, c] of neighbors(u)) {
      if (!allowed(v)) continue;
      const nd = du + c;
      if (nd < dist[v]) {
        dist[v] = nd;
        lab[v] = lab[u];
        heap.push(nd, v);
      }
    }
  }
  return lab;
}

/** Germes bien répartis : le plus « lourd » d'abord, puis le plus éloigné des germes déjà choisis (pondéré). */
function spreadSeeds(items: number[], k: number, weight: (u: number) => number, dist: (a: number, b: number) => number): number[] {
  const seeds = [items.reduce((a, b) => (weight(b) > weight(a) ? b : a))];
  const near = new Map(items.map((u) => [u, dist(u, seeds[0])]));
  while (seeds.length < k) {
    let best = -1, bs = -1;
    for (const u of items) {
      const sc = near.get(u)! * Math.sqrt(weight(u) + 1e-9);
      if (sc > bs && !seeds.includes(u)) {
        bs = sc;
        best = u;
      }
    }
    if (best < 0) break;
    seeds.push(best);
    for (const u of items) near.set(u, Math.min(near.get(u)!, dist(u, best)));
  }
  return seeds;
}

/** Composantes connexes d'un sous-ensemble de nœuds. */
function componentsOf(items: number[], neighbors: (u: number) => number[]): number[][] {
  const set = new Set(items), seen = new Set<number>(), out: number[][] = [];
  for (const s of items) {
    if (seen.has(s)) continue;
    const comp: number[] = [], stack = [s];
    seen.add(s);
    while (stack.length) {
      const u = stack.pop()!;
      comp.push(u);
      for (const v of neighbors(u)) {
        if (set.has(v) && !seen.has(v)) {
          seen.add(v);
          stack.push(v);
        }
      }
    }
    out.push(comp);
  }
  return out;
}

export function buildStates(inp: Input): { provState: Int32Array; states: StateInfo[]; regions: RegionInfo[]; stateNeighbors: Map<number, number>[] } {
  const { grid, stats, adj, owner, provCulture, rng, reg } = inp;
  const P = stats.length;
  const C = inp.capitals.length;
  const provDist = (a: number, b: number) => cellDistKm(grid, stats[a].seed, stats[b].seed);
  // coût de franchissement d'une frontière de provinces : crêtes, grands fleuves, limites de peuples
  const edgeCost = (p: number, e: Edge) => {
    let c = Math.max(20, e.km);
    if (e.maxH > 1200) c *= 1 + (e.maxH - 1200) / 900;
    if (e.river > 400) c *= 1.5;
    if (provCulture[p] !== provCulture[e.to]) c *= 1.7;
    return c;
  };

  // ---------- États : par pays, par bloc de terres contiguës ----------
  const provState = new Int32Array(P).fill(-1);
  const groups: number[][] = [];
  const byCountry: number[][] = Array.from({ length: C }, () => []);
  for (let p = 0; p < P; p++) if (owner[p] >= 0) byCountry[owner[p]].push(p);
  const landNeighbors = (u: number) => adj[u].filter((e) => !e.sea).map((e) => e.to);
  for (let c = 0; c < C; c++) {
    const comps = componentsOf(byCountry[c], (u) => landNeighbors(u).filter((v) => owner[v] === c));
    comps.sort((a, b) => b.length - a.length);
    const countryPop = byCountry[c].reduce((s, p) => s + stats[p].pop, 0);
    const avgStatePop = countryPop / Math.max(1, Math.round(byCountry[c].length / STATE_PROVINCES));
    for (const comp of comps) {
      const compPop = comp.reduce((s, p) => s + stats[p].pop, 0);
      // îlot minuscule : rattaché à l'État voisin par la mer, s'il y en a un du même pays
      if (comp.length <= 2 && compPop < avgStatePop * 0.18) {
        const link = comp.flatMap((p) => adj[p]).find((e) => owner[e.to] === c && provState[e.to] >= 0);
        if (link) {
          for (const p of comp) {
            provState[p] = provState[link.to];
            groups[provState[p]].push(p);
          }
          continue;
        }
      }
      const k = Math.max(1, Math.round(comp.length / STATE_PROVINCES));
      const inComp = new Set(comp);
      const seeds = spreadSeeds(comp, k, (p) => stats[p].pop + (inp.cityOf(p) >= 0 ? inp.cityPop[inp.cityOf(p)] : 0), provDist);
      const lab = grow(P, seeds, (u) => adj[u].filter((e) => !e.sea).map((e) => [e.to, edgeCost(u, e)]), (v) => inComp.has(v));
      const base = groups.length;
      for (let s = 0; s < seeds.length; s++) groups.push([]);
      for (const p of comp) {
        const l = lab[p] >= 0 ? lab[p] : 0;
        provState[p] = base + l;
        groups[base + l].push(p);
      }
    }
  }

  // ---------- caractéristiques et noms des États ----------
  const S = groups.length;
  const statePop = groups.map((g) => g.reduce((s, p) => s + stats[p].pop, 0));
  const rank = [...statePop.keys()].sort((a, b) => statePop[b] - statePop[a]);
  const popRank = new Float64Array(S);
  rank.forEach((s, r) => (popRank[s] = r / Math.max(1, S - 1)));
  const capitalSet = new Set(inp.capitals);
  const states: StateInfo[] = groups.map((g, id) => {
    let area = 0, cx = 0, cy = 0, coastal = false, best = -1, bestPop = -1, h = 0;
    const terr = new Float64Array(9);
    const cult = new Map<number, number>();
    const ref = stats[g[0]].cx;
    for (const p of g) {
      const st = stats[p];
      area += st.area;
      let x = st.cx;
      if (x - ref > grid.W / 2) x -= grid.W;
      else if (ref - x > grid.W / 2) x += grid.W;
      cx += x * st.area;
      cy += st.cy * st.area;
      coastal ||= st.coastal;
      terr[st.terrain] += st.area;
      h += inp.provHeight[p] * st.area;
      if (provCulture[p] >= 0) cult.set(provCulture[p], (cult.get(provCulture[p]) ?? 0) + st.pop);
      const city = inp.cityOf(p);
      if (city >= 0 && inp.cityPop[city] > bestPop) {
        bestPop = inp.cityPop[city];
        best = city;
      }
    }
    cx = ((cx / area) % grid.W + grid.W) % grid.W;
    cy /= area;
    const dominant = terr.indexOf(Math.max(...terr));
    const wild = (terr[5] + terr[7] + terr[8]) / area;
    const r = popRank[id];
    const category = wild > 0.6 && r > 0.5 ? 'Terres sauvages'
      : r < 0.03 ? 'Mégalopole' : r < 0.1 ? 'Métropole' : r < 0.25 ? 'Grande ville' : r < 0.5 ? 'Ville' : r < 0.75 ? 'Rural' : 'Pastoral';
    const resources = RESOURCES.filter(([, ts, prob]) => ts.some((t) => terr[t] / area > 0.25) && rng.chance(prob)).map(([n]) => n).slice(0, 3);
    if (coastal && rng.chance(0.45) && resources.length < 3) resources.push('Poisson');
    const culture = [...cult.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? -1;
    return {
      id, name: '', country: owner[g[0]], provinces: g, capitalCity: best, pop: statePop[id], area, category, region: -1,
      terrain: dominant, coastal, resources, culture, height: h / area, cx, cy, label: null,
      hasCapital: best >= 0 && capitalSet.has(best),
    };
  });

  // voisinage des États (terre), longueur de frontière cumulée
  const stateNeighbors: Map<number, number>[] = Array.from({ length: S }, () => new Map());
  const stateSea: Set<number>[] = Array.from({ length: S }, () => new Set());
  for (let p = 0; p < P; p++) {
    const a = provState[p];
    if (a < 0) continue;
    for (const e of adj[p]) {
      const b = provState[e.to];
      if (b < 0 || b === a) continue;
      if (e.sea) stateSea[a].add(b);
      else stateNeighbors[a].set(b, (stateNeighbors[a].get(b) ?? 0) + Math.max(1, e.len));
    }
  }

  // noms : la langue du peuple majoritaire ; parfois « Haute- / Basse- » pour deux États voisins d'un même pays
  const lang = (s: StateInfo) => inp.langs[Math.max(0, s.culture)];
  for (const s of states) {
    if (s.name) continue;
    const base = reg.unique(() => placeName(lang(s), rng));
    const twin = [...stateNeighbors[s.id].keys()].find((t) => !states[t].name && states[t].country === s.country && states[t].culture === s.culture);
    if (twin !== undefined && rng.chance(0.1)) {
      const hi = states[twin].height > s.height ? states[twin] : s, lo = hi === s ? states[twin] : s;
      hi.name = `Haute-${base}`;
      lo.name = `Basse-${base}`;
      continue;
    }
    const city = s.capitalCity >= 0 ? inp.cityName[s.capitalCity] : base;
    const roll = rng.next();
    if (s.terrain === 4 && roll < 0.3) s.name = `Monts ${de(base)}`;
    else if (s.coastal && roll < 0.14) s.name = `Côte ${de(base)}`;
    else if (roll < 0.22 && s.capitalCity >= 0 && !s.hasCapital) s.name = `Pays ${de(city)}`;
    else if (roll < 0.3 && s.terrain === 0) s.name = `Val ${de(base)}`;
    else s.name = base;
  }

  // ---------- régions historiques : États voisins regroupés par la géographie, frontières ignorées ----------
  const stateLand = (u: number) => [...stateNeighbors[u].keys()];
  const blocks = componentsOf([...Array(S).keys()], stateLand);
  blocks.sort((a, b) => b.length - a.length);
  const stateRegion = new Int32Array(S).fill(-1);
  const regionGroups: number[][] = [];
  const stDist = (a: number, b: number) => provDist(states[a].provinces[0], states[b].provinces[0]);
  const stateEdgeCost = (a: number, b: number) => {
    // franchir une chaîne de montagnes ou changer de grand terrain coûte cher : la région suit le relief
    let c = stDist(a, b);
    const ha = states[a].height, hb = states[b].height;
    if (Math.max(ha, hb) > 1300) c *= 1 + Math.abs(ha - hb) / 500;
    if (states[a].terrain !== states[b].terrain) c *= 1.35;
    return c;
  };
  const bigBlocks: number[][] = [];
  const smallBlocks: number[][] = [];
  for (const b of blocks) (b.length >= 3 || b.reduce((s, u) => s + states[u].area, 0) > 400000 ? bigBlocks : smallBlocks).push(b);
  for (const b of bigBlocks) {
    const k = Math.max(1, Math.round(b.length / REGION_STATES));
    const seeds = spreadSeeds(b, k, (u) => states[u].area, stDist);
    const inB = new Set(b);
    const lab = grow(S, seeds, (u) => stateLand(u).map((v) => [v, stateEdgeCost(u, v)]), (v) => inB.has(v));
    const base = regionGroups.length;
    for (let s = 0; s < seeds.length; s++) regionGroups.push([]);
    for (const u of b) {
      stateRegion[u] = base + Math.max(0, lab[u]);
      regionGroups[stateRegion[u]].push(u);
    }
  }
  // îles et petits archipels : rattachés à la région la plus proche par la mer (en plusieurs passes, de
  // proche en proche le long des chapelets d'îles), sinon regroupés en archipel
  const archipelago = new Set<number>();
  const attach = (b: number[], maxKm: number): boolean => {
    let target = -1, bd = Infinity;
    for (const u of b) {
      for (const v of stateSea[u]) {
        const r = stateRegion[v];
        if (r < 0 || (archipelago.has(r) && regionGroups[r].length >= REGION_STATES)) continue;
        const d = stDist(u, v);
        if (d < bd) {
          bd = d;
          target = r;
        }
      }
    }
    if (target < 0) {
      // pas de liaison maritime connue (île lointaine) : la région côtière la plus proche à vol d'oiseau
      for (const u of b) {
        for (let v = 0; v < S; v++) {
          const r = stateRegion[v];
          if (r < 0 || !states[v].coastal || (archipelago.has(r) && regionGroups[r].length >= REGION_STATES)) continue;
          const d = stDist(u, v);
          if (d < bd) {
            bd = d;
            target = r;
          }
        }
      }
    }
    if (target < 0 || bd > maxKm) return false;
    for (const u of b) {
      stateRegion[u] = target;
      regionGroups[target].push(u);
    }
    return true;
  };
  let pending = smallBlocks;
  for (let pass = 0; pass < 8 && pending.length; pass++) {
    const next = pending.filter((b) => !attach(b, 1500));
    if (next.length === pending.length) break;
    pending = next;
  }
  for (const b of pending) {
    if (attach(b, 1500)) continue;
    const id = regionGroups.length;
    regionGroups.push([]);
    archipelago.add(id);
    for (const u of b) {
      stateRegion[u] = id;
      regionGroups[id].push(u);
    }
  }
  // fusion des archipels voisins (régions d'îles reliées par la mer, toutes deux petites)
  for (const id of archipelago) {
    if (!regionGroups[id].length) continue;
    for (const u of [...regionGroups[id]]) {
      for (const v of stateSea[u]) {
        const r = stateRegion[v];
        if (r === id || !archipelago.has(r) || !regionGroups[r].length || regionGroups[id].length >= REGION_STATES) continue;
        if (stDist(u, v) > 1200) continue;
        for (const w of regionGroups[r]) {
          stateRegion[w] = id;
          regionGroups[id].push(w);
        }
        regionGroups[r] = [];
      }
    }
  }
  const kept = regionGroups.map((g, i) => [g, i] as const).filter(([g]) => g.length);
  const remap = new Map(kept.map(([, i], k) => [i, k]));
  const TERRAIN_NAMES: ((n: string) => string)[] = [
    (n) => `Plaines ${de(n)}`,
    (n) => `Forêts ${de(n)}`,
    (n) => `Jungles ${de(n)}`,
    (n) => `Collines ${de(n)}`,
    (n) => rng.pick([`Monts ${de(n)}`, `Massif ${de(n)}`, `Cordillère ${de(n)}`]),
    (n) => `Désert ${de(n)}`,
    (n) => `Marais ${de(n)}`,
    (n) => `Toundra ${de(n)}`,
    (n) => `Glaces ${de(n)}`,
  ];
  const regions: RegionInfo[] = kept.map(([g, oldId], id) => {
    const terr = new Float64Array(9);
    const cult = new Map<number, number>();
    let area = 0, pop = 0, coast = 0;
    const countries = new Set<number>();
    for (const u of g) {
      const s = states[u];
      s.region = id;
      area += s.area;
      pop += s.pop;
      if (s.coastal) coast += s.area;
      countries.add(s.country);
      for (const p of s.provinces) terr[stats[p].terrain] += stats[p].area;
      if (s.culture >= 0) cult.set(s.culture, (cult.get(s.culture) ?? 0) + s.pop);
    }
    const culture = [...cult.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 0;
    const base = reg.unique(() => placeName(inp.langs[culture], rng));
    const dominant = terr.indexOf(Math.max(...terr));
    let name: string, kind: string;
    if (archipelago.has(oldId) && g.length > 1) {
      name = rng.chance(0.5) ? `Archipel ${de(base)}` : `Îles ${base}`;
      kind = 'Archipel';
    } else if (archipelago.has(oldId)) {
      name = `Île ${de(base)}`;
      kind = 'Île';
    } else if (coast / area > 0.75 && dominant !== 4 && rng.chance(0.5)) {
      name = rng.chance(0.5) ? `Côte ${de(base)}` : `Littoral ${de(base)}`;
      kind = 'Littoral';
    } else if (countries.size >= 4 && rng.chance(0.3)) {
      name = `Marches ${de(base)}`;
      kind = 'Marches';
    } else {
      name = TERRAIN_NAMES[dominant](base);
      kind = ['Plaines', 'Forêts', 'Jungles', 'Collines', 'Montagnes', 'Désert', 'Marais', 'Toundra', 'Glaces'][dominant];
    }
    return { id, name, kind, states: g, area, pop, countries: [...countries], culture, label: null };
  });
  for (const s of states) if (s.region < 0) s.region = remap.get(stateRegion[s.id]) ?? 0;
  return { provState, states, regions, stateNeighbors };
}
