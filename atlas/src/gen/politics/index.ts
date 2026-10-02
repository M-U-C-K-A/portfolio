import { Rng } from '../rng';
import {
  NONE16, type CityInfo, type CountryInfo, type LabelPath, type PoliticsData, type ProvinceInfo,
} from '../types';
import { placeCities } from './cities';
import { components, slopeField, travelCost, type Terrain } from './common';
import { buildContinents } from './continents';
import { buildCountries } from './countries';
import { buildCultures } from './cultures';
import { buildDynasties, type CountrySeed } from './dynasties';
import { provinceAdjacency, provinceStats } from './graph';
import { computeHabitat } from './habitat';
import { buildInfluence } from './influence';
import { curvedLabel } from './labels';
import { buildLore, type LoreCountry } from './lore';
import { countryName, NameRegistry, officialName, pickGovForm, placeName } from './names';
import { buildProvinces } from './provinces';
import { bordersPreview, clonePreview, naturalPreview, tintPreview, type PreviewFn, type PreviewImage } from '../preview';
import { buildReligions } from './religions';
import { buildStates } from './states';
import { buildHistory } from './history';
import { buildTrade } from './trade';

export type { Terrain } from './common';

export function generatePolitics(
  t: Terrain,
  progress: (stage: string, p: number) => void,
  preview: PreviewFn | null = null,
): { data: PoliticsData; timings: Record<string, number> } {
  const s = t.settings;
  const { grid } = t;
  const { N, W } = grid;
  const rng = Rng.from(`${s.seed}|${s.politicsSeed}`, 'politics');
  const reg = new NameRegistry();
  const timings: Record<string, number> = {};
  let clock = performance.now();
  const lap = (name: string): void => {
    const now = performance.now();
    timings[name] = Math.round(now - clock);
    clock = now;
  };
  const year = 1000 + rng.int(180, 820);

  progress('Peuplement', 0);
  const slope = slopeField(grid, t.h, t.ocean);
  const cost = travelCost(t, slope);
  const habitat = computeHabitat(t, slope);
  const landmass = components(grid, (i) => !t.ocean[i]);
  lap('peuplement');

  progress('Continents géologiques', 0.08);
  const { continent, infos: continents } = buildContinents(t, Rng.from(s.seed, 'continents'), reg);
  lap('continents');

  progress('Fondation des villes', 0.16);
  const sites = placeCities(t, habitat, landmass, Math.max(4, Math.min(1000, Math.round(s.cityCount))), rng);
  lap('villes');

  progress('Découpage des provinces', 0.24);
  const pm = buildProvinces(t, habitat, slope, sites.map((c) => c.cell), landmass, s.provinceSize, rng);
  const stats = provinceStats(t, pm, habitat, cost, slope, landmass, continent);
  const adj = provinceAdjacency(t, pm, stats, 350);
  const cityProvince = sites.map((c) => pm.province[c.cell]);
  const P = pm.count;
  lap('provinces');
  // base commune des aperçus politiques : le terrain tel qu'il sera rendu, frontières tracées à l'encre
  const base: PreviewImage | null = preview ? naturalPreview(grid, t.h, t.ocean, t.temperature, t.precip, t.biome) : null;
  if (preview && base) preview('Provinces', bordersPreview(clonePreview(base), grid, pm.province, 0.28));

  progress('Peuples et cultures', 0.34);
  const cm = buildCultures(t, stats, adj, sites, cityProvince, Math.max(1, Math.round(s.countryCount)), rng, reg);
  const pc = cm.provCulture;
  lap('cultures');

  progress('Formation des États', 0.42);
  // les États se forment plus volontiers dans un même peuple : franchir une frontière culturelle coûte cher
  const groupOf = (p: number) => (pc[p] >= 0 ? cm.cultures[pc[p]].group : -1);
  const affinity = (p: number, q: number) => (pc[p] === pc[q] ? 1 : groupOf(p) === groupOf(q) ? 1.35 : 1.8);
  const cmap = buildCountries(t, stats, adj, sites, cityProvince, Math.max(1, Math.round(s.countryCount)), rng, affinity);
  const cityCountry = sites.map((_, i) => cmap.owner[cityProvince[i]]);
  const C = cmap.capitals.length;
  lap('états');
  if (preview && base) {
    const cellCountry = new Int32Array(N);
    for (let i = 0; i < N; i++) cellCountry[i] = pm.province[i] >= 0 ? cmap.owner[pm.province[i]] : -1;
    preview('Formation des États', bordersPreview(bordersPreview(clonePreview(base), grid, pm.province, 0.18), grid, cellCountry, 0.85));
  }

  progress('Routes commerciales', 0.5);
  const trade = buildTrade(t, cost, sites, cityCountry);
  lap('commerce');

  progress("Zones d'influence", 0.68);
  const infl = buildInfluence(t, cost, trade.roadFactor, sites);
  lap('influence');

  // --- noms : chaque ville dans la langue de son peuple, chaque pays dans celle de sa capitale ---
  const cityCulture = cityProvince.map((p) => Math.max(0, pc[p]));
  const cityNames = sites.map((_, i) => reg.unique(() => placeName(cm.langs[cityCulture[i]], rng)));

  progress('États et régions', 0.72);
  const provH = new Float64Array(P), provN = new Float64Array(P);
  for (let i = 0; i < N; i++) {
    const p = pm.province[i];
    if (p < 0) continue;
    provH[p] += Math.max(0, t.h[i]);
    provN[p]++;
  }
  for (let p = 0; p < P; p++) provH[p] /= Math.max(1, provN[p]);
  const sm = buildStates({
    grid, stats, adj, owner: cmap.owner, provCulture: pc, cityOf: (p) => (p < sites.length ? p : -1), cityPop: sites.map((x) => x.pop),
    cityName: cityNames, capitals: cmap.capitals, langs: cm.langs, provHeight: provH, rng, reg,
  });
  lap('régions');
  if (preview && base) {
    const cellState = new Int32Array(N).fill(-1), cellCountry = new Int32Array(N).fill(-1);
    for (let i = 0; i < N; i++) {
      if (pm.province[i] < 0) continue;
      cellState[i] = sm.provState[pm.province[i]];
      cellCountry[i] = cmap.owner[pm.province[i]];
    }
    preview('États et régions', bordersPreview(bordersPreview(clonePreview(base), grid, cellState, 0.45), grid, cellCountry, 0.85));
  }

  progress('Religions', 0.74);
  const rm = buildReligions(t, stats, adj, sites, cityNames, cityProvince, trade.trade, cm, cmap.owner, cmap.capitals, year, rng, reg);
  const pr = rm.provReligion;
  lap('religions');

  progress('Dynasties et souverains', 0.82);
  const area = new Float64Array(C), pop = new Float64Array(C), nprov = new Int32Array(C), ncity = new Int32Array(C);
  const neigh: Set<number>[] = Array.from({ length: C }, () => new Set());
  const cultPop: Map<number, number>[] = Array.from({ length: C }, () => new Map());
  const relPop: Map<number, number>[] = Array.from({ length: C }, () => new Map());
  const terrPop = Array.from({ length: C }, () => new Float64Array(9));
  for (let p = 0; p < P; p++) {
    const o = cmap.owner[p];
    if (o < 0) continue;
    area[o] += stats[p].area;
    pop[o] += stats[p].pop;
    nprov[o]++;
    terrPop[o][stats[p].terrain] += stats[p].area;
    if (pc[p] >= 0) cultPop[o].set(pc[p], (cultPop[o].get(pc[p]) ?? 0) + stats[p].pop);
    if (pr[p] >= 0) relPop[o].set(pr[p], (relPop[o].get(pr[p]) ?? 0) + stats[p].pop);
    for (const e of adj[p]) {
      const o2 = cmap.owner[e.to];
      if (o2 >= 0 && o2 !== o && !e.sea) neigh[o].add(o2);
    }
  }
  for (const o of cityCountry) if (o >= 0) ncity[o]++;
  const shares = (m: Map<number, number>, total: number) =>
    [...m.entries()].map(([id, v]) => ({ id, share: total > 0 ? v / total : 0 })).sort((a, b) => b.share - a.share).slice(0, 6);
  const areaRank = new Float64Array(C);
  [...Array(C).keys()].sort((a, b) => area[b] - area[a]).forEach((c, r) => (areaRank[c] = r / Math.max(1, C - 1)));
  const capProv = cmap.capitals.map((c) => cityProvince[c]);
  const countryCulture = capProv.map((p) => Math.max(0, pc[p]));
  const countryReligion = capProv.map((p) => pr[p]);
  const forms = [...Array(C).keys()].map((c) => {
    // les théocraties naissent autour des villes saintes
    if (rm.holyOf[cmap.capitals[c]] >= 0 && rng.chance(0.5)) return 'Théocratie';
    return pickGovForm(rng, areaRank[c]).label;
  });
  const hearthLat = cm.cultures.map((cu) => Math.abs(grid.lat[(sites[cu.hearth].cell / W) | 0] * 180) / Math.PI);
  const seeds: CountrySeed[] = [...Array(C).keys()].map((c) => ({ form: forms[c], culture: countryCulture[c], neighbors: [...neigh[c]] }));
  const byPop = [...Array(C).keys()].sort((a, b) => pop[b] - pop[a]);
  const dyn = buildDynasties(seeds, byPop, cm.cultures, cm.langs, hearthLat, year, rng, reg);
  lap('dynasties');

  progress('Chroniques', 0.9);
  const countryNames = [...Array(C).keys()].map((c) => reg.unique(() => countryName(cm.langs[countryCulture[c]], rng)));
  const loreIn: LoreCountry[] = [...Array(C).keys()].map((c) => {
    const tp = terrPop[c];
    const tot = tp.reduce((a, b) => a + b, 0) || 1;
    const big = sites.map((_, i) => i).filter((i) => cityCountry[i] === c).slice(0, 4).map((i) => cityNames[i]);
    return {
      id: c, name: countryNames[c], form: forms[c], capitalName: cityNames[cmap.capitals[c]], pop: pop[c],
      culture: countryCulture[c], religion: countryReligion[c], dynasty: dyn.countryDynasty[c], ruler: dyn.rulers[c],
      neighbors: [...neigh[c]], cultureShares: shares(cultPop[c], pop[c]), religionShares: shares(relPop[c], pop[c]),
      bigCities: big, mountainous: (tp[3] + tp[4]) / tot > 0.3, riverine: sites.some((x, i) => cityCountry[i] === c && x.river),
    };
  });
  const lore = buildLore(loreIn, cm.cultures, rm.religions, dyn.dynasties, year, rng);
  const colors = assignColors(C, neigh, rng);
  const countries: CountryInfo[] = loreIn.map((l, c) => ({
    id: c, name: l.name, fullName: officialName(forms[c], l.name), form: forms[c], color: colors[c], capital: cmap.capitals[c],
    area: area[c], pop: pop[c], provinces: nprov[c], cities: ncity[c], neighbors: l.neighbors, label: null,
    culture: l.culture, religion: l.religion, dynasty: l.dynasty, arms: dyn.arms[c], ruler: l.ruler, founded: lore.founded[c],
    cultureShares: l.cultureShares, religionShares: l.religionShares, allies: lore.allies[c], rivals: lore.rivals[c],
    unions: lore.unions[c], history: lore.history[c], events: lore.events[c],
  }));

  // --- frise historique : déroulée à rebours depuis la carte actuelle ---
  progress('Histoire du monde', 0.94);
  const stateReligion = sm.states.map((st) => {
    const m = new Map<number, number>();
    for (const p of st.provinces) if (pr[p] >= 0) m.set(pr[p], (m.get(pr[p]) ?? 0) + stats[p].pop + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? -1;
  });
  const history = buildHistory({
    states: sm.states, stateNeighbors: sm.stateNeighbors, cultures: cm.cultures, religions: rm.religions, langs: cm.langs, stateReligion, year,
    countries: countries.map((c) => ({ name: c.name, fullName: c.fullName, form: c.form, color: c.color, culture: c.culture, religion: c.religion, founded: c.founded, rivals: c.rivals, allies: c.allies, dynasty: c.dynasty, arms: c.arms })),
    rng: Rng.from(`${s.seed}|${s.politicsSeed}`, 'history'), reg,
  });
  // chaque pays reçoit dans sa chronique les événements de la frise qui le concernent
  for (const ev of history.events) {
    for (const c of ev.countries) {
      if (c >= C || (ev.kind === 'mariage' && ev.countries[0] !== c)) continue;
      countries[c].events.push({ year: ev.year, text: ev.kind === 'guerre' || ev.kind === 'annexion' ? `${ev.title} : ${ev.text}` : ev.text });
    }
  }
  for (const c of countries) c.events.sort((a, b) => a.year - b.year);
  lap('histoire');
  if (preview && base) {
    // la carte du monde aux origines de la frise, puis aujourd'hui : couleurs des pays en lavis léger
    const cellOwner = new Int32Array(N).fill(-1);
    for (let i = 0; i < N; i++) if (pm.province[i] >= 0 && sm.provState[pm.province[i]] >= 0) cellOwner[i] = history.initial[sm.provState[pm.province[i]]];
    preview(`Le monde en l'an ${history.start}`, bordersPreview(tintPreview(clonePreview(base), grid, cellOwner, (o) => history.countries[o].color, 0.55), grid, cellOwner, 0.8));
    for (let i = 0; i < N; i++) cellOwner[i] = pm.province[i] >= 0 ? cmap.owner[pm.province[i]] : -1;
    preview(`Le monde en l'an ${year}`, bordersPreview(tintPreview(clonePreview(base), grid, cellOwner, (o) => countries[o].color, 0.55), grid, cellOwner, 0.85));
  }

  // --- villes ---
  const maxTrade = Math.max(1e-9, ...trade.trade);
  const cities: CityInfo[] = sites.map((site, i) => ({
    id: i, name: cityNames[i], cell: site.cell, x: (site.cell % W) + 0.5, y: ((site.cell / W) | 0) + 0.5, pop: site.pop,
    country: cityCountry[i], province: cityProvince[i], capital: cmap.capitals[cityCountry[i]] === i, port: site.port,
    river: site.river, trade: (100 * trade.trade[i]) / maxTrade, partners: trade.partners[i], influenceArea: infl.area[i],
    culture: cityCulture[i], religion: Math.max(0, pr[cityProvince[i]]), holyOf: rm.holyOf[i],
  }));

  // --- cartes par cellule ---
  const province = new Uint16Array(N).fill(NONE16);
  const country = new Uint16Array(N).fill(NONE16);
  for (let i = 0; i < N; i++) {
    const p = pm.province[i];
    if (p < 0) continue;
    province[i] = p;
    const o = cmap.owner[p];
    if (o >= 0) country[i] = o;
  }
  const provinces: ProvinceInfo[] = stats.map((st, p) => ({
    id: p, cx: st.cx, cy: st.cy, area: st.area, pop: st.pop, terrain: st.terrain, country: cmap.owner[p],
    city: p < sites.length ? p : -1, coastal: st.coastal, continent: st.continent, culture: pc[p], religion: pr[p], state: sm.provState[p],
  }));

  // --- étiquettes courbes (pays, continents, cultures, religions) sur la terre principale de chacun ---
  const labelsFor = (count: number, idOf: (i: number) => number, text: (k: number) => string, step = 2): (LabelPath | null)[] => {
    const votes = new Map<number, number>();
    for (let i = 0; i < N; i += 3) {
      if (t.ocean[i]) continue;
      const k = idOf(i);
      if (k < 0) continue;
      const key = k * 1e6 + landmass.label[i];
      votes.set(key, (votes.get(key) ?? 0) + 1);
    }
    const main = new Int32Array(count).fill(-1), best = new Float64Array(count);
    for (const [key, v] of votes) {
      const k = Math.floor(key / 1e6);
      if (v > best[k]) {
        best[k] = v;
        main[k] = key % 1e6;
      }
    }
    const xs: number[][] = Array.from({ length: count }, () => []);
    const ys: number[][] = Array.from({ length: count }, () => []);
    for (let y = 0; y < grid.H; y += step) {
      for (let x = (y / step) % 2 === 0 ? 0 : 1; x < W; x += step) {
        const i = y * W + x;
        if (t.ocean[i]) continue;
        const k = idOf(i);
        if (k < 0 || landmass.label[i] !== main[k]) continue;
        xs[k].push(x + 0.5);
        ys[k].push(y + 0.5);
      }
    }
    return [...Array(count).keys()].map((k) => (xs[k].length ? curvedLabel(xs[k], ys[k], xs[k].map(() => 1), xs[k][0], W, text(k).toUpperCase()) : null));
  };
  const provOfCell = (i: number) => pm.province[i];
  labelsFor(C, (i) => (country[i] === NONE16 ? -1 : country[i]), (k) => countries[k].name).forEach((l, k) => (countries[k].label = l));
  labelsFor(continents.length, (i) => (continent[i] === 255 ? -1 : continent[i]), (k) => continents[k].name, 3).forEach((l, k) => (continents[k].label = l));
  labelsFor(cm.cultures.length, (i) => (provOfCell(i) >= 0 ? pc[provOfCell(i)] : -1), (k) => cm.cultures[k].name).forEach((l, k) => (cm.cultures[k].label = l));
  labelsFor(rm.religions.length, (i) => (provOfCell(i) >= 0 ? pr[provOfCell(i)] : -1), (k) => rm.religions[k].name).forEach((l, k) => (rm.religions[k].label = l));
  const stateOfCell = (i: number) => (provOfCell(i) >= 0 ? sm.provState[provOfCell(i)] : -1);
  labelsFor(sm.states.length, stateOfCell, (k) => sm.states[k].name, W > 2500 ? 2 : 1).forEach((l, k) => (sm.states[k].label = l));
  labelsFor(sm.regions.length, (i) => (stateOfCell(i) >= 0 ? sm.states[stateOfCell(i)].region : -1), (k) => sm.regions[k].name).forEach((l, k) => (sm.regions[k].label = l));

  // --- réseau commercial ---
  let nPts = 0;
  for (const sg of trade.segments) nPts += sg.pts.length / 2;
  const routePts = new Float32Array(nPts * 2);
  const routeOffsets = new Uint32Array(trade.segments.length + 1);
  const routeKind = new Uint8Array(trade.segments.length);
  const routeVolume = new Float32Array(trade.segments.length);
  let o = 0;
  trade.segments.forEach((sg, k) => {
    routeOffsets[k] = o / 2;
    routePts.set(sg.pts, o);
    o += sg.pts.length;
    routeKind[k] = sg.kind;
    routeVolume[k] = sg.volume;
  });
  routeOffsets[trade.segments.length] = o / 2;
  const L = trade.links.length;
  const linkA = new Uint16Array(L), linkB = new Uint16Array(L), linkKind = new Uint8Array(L), linkVolume = new Float32Array(L);
  trade.links.forEach((l, k) => {
    linkA[k] = l.a;
    linkB[k] = l.b;
    linkKind[k] = l.kind;
    linkVolume[k] = l.volume;
  });
  lap('chroniques');

  return {
    data: {
      province, country, influence: infl.city, influenceStrength: infl.strength, continent, popDensity: habitat.density,
      provinces, states: sm.states, regions: sm.regions, countries, cities, continents, routePts, routeOffsets, routeKind, routeVolume,
      linkA, linkB, linkKind, linkVolume, totalPop: habitat.totalPop,
      cultureGroups: cm.groups, cultures: cm.cultures, religions: rm.religions, dynasties: dyn.dynasties, history, year,
    },
    timings,
  };
}

function hsl(h: number, s: number, l: number): [number, number, number] {
  const k = (n: number) => (n + h * 12) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
}

/** Couleurs « HOI4 » (saturation modérée) en maximisant l'écart avec les voisins déjà colorés. */
function assignColors(C: number, neigh: Set<number>[], rng: Rng): [number, number, number][] {
  const colors: ([number, number, number] | null)[] = new Array(C).fill(null);
  const order = [...Array(C).keys()].sort((a, b) => neigh[b].size - neigh[a].size);
  for (const c of order) {
    let best: [number, number, number] = [128, 128, 128], bestScore = -1;
    for (let k = 0; k < 28; k++) {
      // teintes sourdes façon HOI4 : les verts et magentas vifs sont désaturés
      const hue = rng.next();
      const vivid = (hue > 0.22 && hue < 0.42) || (hue > 0.8 && hue < 0.95);
      const cand = hsl(hue, rng.range(0.22, vivid ? 0.34 : 0.46), rng.range(0.4, 0.58));
      let score = 1e9;
      for (const n of neigh[c]) {
        const o = colors[n];
        if (!o) continue;
        const d = Math.hypot(cand[0] - o[0], 1.2 * (cand[1] - o[1]), cand[2] - o[2]);
        if (d < score) score = d;
      }
      if (score > bestScore) {
        bestScore = score;
        best = cand;
      }
    }
    colors[c] = best;
  }
  return colors as [number, number, number][];
}
