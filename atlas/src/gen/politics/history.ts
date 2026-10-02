import { MinHeap } from '../heap';
import type { Rng } from '../rng';
import type { CultureInfo, Heraldry, HistCountry, HistEvent, HistoryData, ReligionInfo, StateInfo } from '../types';
import { makeArms } from './heraldry';
import { capitalize, countryName, deOf, givenName, listFr, type Language, type NameRegistry, officialName, ofArticle, pluralFr, withArticle } from './names';

/**
 * Histoire du monde, année par année, jusqu'à la carte actuelle.
 *
 * Plutôt que de simuler l'histoire vers l'avant en espérant retomber sur la carte du présent, on la
 * « déroule à l'envers » à partir de celle-ci : à chaque année, en remontant le temps, on défait des
 * conquêtes (des États repassent au vaincu), on dissout les pays fondés cette année-là (retour dans le
 * pays dont ils ont fait sécession, ou éclatement en principautés qu'ils ont unifiées) et l'on recrée des
 * pays disparus (annexés ou hérités plus tard). Relue dans l'ordre chronologique, la suite de ces
 * opérations est une histoire cohérente qui aboutit exactement à la carte actuelle. Les guerres opposent
 * de préférence les rivaux héréditaires des chroniques ; mariages, révoltes et schismes complètent la frise.
 */

export interface HistInputCountry {
  name: string;
  fullName: string;
  form: string;
  color: [number, number, number];
  culture: number;
  religion: number;
  founded: number;
  rivals: number[];
  allies: number[];
  dynasty: number;
  arms: Heraldry;
}

interface Input {
  states: StateInfo[];
  stateNeighbors: Map<number, number>[];
  countries: HistInputCountry[];
  cultures: CultureInfo[];
  religions: ReligionInfo[];
  langs: Language[];
  /** Religion majoritaire de chaque État. */
  stateReligion: number[];
  year: number;
  rng: Rng;
  reg: NameRegistry;
}

const MONARCHIES = new Set(['Empire', 'Royaume', 'Sultanat', 'Khanat', 'Principauté', 'Grand-duché', 'Duché', 'Comté', 'Émirat', 'Seigneurie', 'Marche']);
const NUMBERS: Record<number, string> = { 2: 'Deux', 3: 'Trois', 4: 'Quatre', 5: 'Cinq', 6: 'Six', 7: 'Sept', 8: 'Huit', 10: 'Dix', 12: 'Douze', 15: 'Quinze', 20: 'Vingt', 30: 'Trente' };
const FEMININE = new Set(['Principauté', 'Théocratie', 'République', 'Ligue marchande', 'Confédération', 'Union', 'Marche', 'Seigneurie', 'Cité-État', 'Tribu']);

function hsl(h: number, s: number, l: number): [number, number, number] {
  const k = (n: number) => (n + h * 12) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
}

export function buildHistory(inp: Input): HistoryData {
  const { states, stateNeighbors: nb, rng, reg, year } = inp;
  const S = states.length;
  const C = inp.countries.length;
  const owner = Int32Array.from(states, (s) => s.country);
  const earliest = Math.min(...inp.countries.map((c) => c.founded));
  const start = Math.max(year - 1100, earliest - 30 - rng.int(0, 40));

  const countries: HistCountry[] = inp.countries.map((c, id) => ({
    id, name: c.name, fullName: c.fullName, form: c.form, color: c.color, culture: c.culture, religion: c.religion,
    founded: c.founded, ended: null, fate: '', arms: c.arms, present: true, capitalState: -1,
  }));
  for (const s of states) if (s.hasCapital) countries[s.country].capitalState = s.id;
  for (let s = 0; s < S; s++) if (countries[owner[s]] && countries[owner[s]].capitalState < 0) countries[owner[s]].capitalState = s;
  const alive = countries.map(() => true);
  // nombre d'États de chaque pays, tenu à jour à chaque transfert
  const cnt: number[] = countries.map(() => 0);
  for (let s = 0; s < S; s++) cnt[owner[s]]++;
  const setOwner = (s: number, c: number) => {
    cnt[owner[s]]--;
    cnt[c] = (cnt[c] ?? 0) + 1;
    owner[s] = c;
  };
  const events: HistEvent[] = [];
  // transferts, créés à rebours ; seq sert à rétablir l'ordre chronologique au sein d'une même année
  const changes: { year: number; seq: number; state: number; from: number; to: number }[] = [];
  let seq = 0;
  const moveBack = (s: number, y: number, holderBefore: number) => {
    // à rebours : l'État revient à holderBefore ; dans le sens du temps, il passe de holderBefore à owner[s] en y
    changes.push({ year: y, seq: seq++, state: s, from: holderBefore, to: owner[s] });
    setOwner(s, holderBefore);
  };
  const statesOf = (c: number) => {
    const out: number[] = [];
    for (let s = 0; s < S; s++) if (owner[s] === c) out.push(s);
    return out;
  };
  const neighborsOf = (c: number, list = statesOf(c)) => {
    const m = new Map<number, number>();
    for (const s of list) for (const [t, len] of nb[s]) if (owner[t] !== c) m.set(owner[t], (m.get(owner[t]) ?? 0) + len);
    return m;
  };
  /** Nom d'État avec son article quand il en a un (« la Côte de X », « le Val de Y »). */
  const sName = (s: number) => {
    const n = states[s].name;
    return /^Côte /.test(n) ? `la ${n}` : /^(Pays|Val) /.test(n) ? `le ${n}` : /^Monts /.test(n) ? `les ${n}` : n;
  };
  /** « de X » / « de la Côte de X » / « du Val de Y » / « des Monts de Z ». */
  const ofState = (s: number) => {
    const n = sName(s);
    return n.startsWith('le ') ? `du ${n.slice(3)}` : n.startsWith('les ') ? `des ${n.slice(4)}` : n.startsWith('la ') ? `de ${n}` : deOf(n);
  };
  const cName = (c: number) => countries[c].name;
  /** « le royaume de X », « la principauté de Y », « l'émirat de Z ». */
  const theFull = (c: number) => {
    const f = countries[c].form.toLowerCase();
    const art = /^[aeiouyéèêh]/.test(f) ? `l'${f}` : FEMININE.has(countries[c].form) ? `la ${f}` : `le ${f}`;
    return `${art} ${deOf(cName(c))}`;
  };
  /** « du royaume de X », « de la principauté de Y », « de l'émirat de Z ». */
  const ofFull = (c: number) => {
    const t = theFull(c);
    return t.startsWith('le ') ? `du ${t.slice(3)}` : `de ${t}`;
  };
  const group = (c: number) => (countries[c].culture >= 0 ? inp.cultures[countries[c].culture].group : -1);
  const rootRel = (r: number) => (r >= 0 && inp.religions[r].parent >= 0 ? inp.religions[r].parent : r);
  const majority = (list: number[], f: (s: number) => number) => {
    const m = new Map<number, number>();
    for (const s of list) {
      const k = f(s);
      if (k >= 0) m.set(k, (m.get(k) ?? 0) + states[s].pop + 1);
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? -1;
  };

  /** Pays disparu, créé à rebours sur un groupe d'États. */
  const newCountry = (list: number[], ended: number, fate: string): number => {
    const culture = majority(list, (s) => states[s].culture);
    const religion = majority(list, (s) => inp.stateReligion[s]);
    const lang = inp.langs[Math.max(0, culture)];
    const n = list.length;
    const form = n <= 1 ? rng.pick(['Comté', 'Seigneurie', 'Cité-État', 'Marche', 'Émirat'])
      : n <= 3 ? rng.pick(['Duché', 'Principauté', 'Comté', 'Marche', 'Khanat', 'Émirat'])
        : rng.pick(['Royaume', 'Royaume', 'Grand-duché', 'Khanat', 'Sultanat', 'Confédération', 'République']);
    const name = reg.unique(() => countryName(lang, rng));
    const id = countries.length;
    const cap = list.reduce((a, b) => (states[b].pop > states[a].pop ? b : a));
    countries.push({
      id, name, fullName: officialName(form, name), form, color: hsl(rng.next(), rng.range(0.22, 0.4), rng.range(0.38, 0.58)),
      culture, religion, founded: start, ended, fate, arms: makeArms(rng), present: false, capitalState: cap,
    });
    alive.push(true);
    cnt.push(0);
    for (const s of list) setOwner(s, id);
    return id;
  };

  /** Regroupe les États d'une liste en k blocs contigus (croissance depuis des germes éloignés). */
  const partition = (list: number[], k: number): number[][] => {
    const inL = new Set(list);
    const seeds = [list.reduce((a, b) => (states[b].pop > states[a].pop ? b : a))];
    while (seeds.length < k) {
      let best = -1, bd = -1;
      for (const s of list) {
        if (seeds.includes(s)) continue;
        const d = Math.min(...seeds.map((t) => Math.hypot(states[s].cx - states[t].cx, states[s].cy - states[t].cy)));
        if (d > bd) {
          bd = d;
          best = s;
        }
      }
      if (best < 0) break;
      seeds.push(best);
    }
    const lab = new Map<number, number>();
    const heap = new MinHeap(32);
    const dist = new Map<number, number>();
    seeds.forEach((s, i) => {
      lab.set(s, i);
      dist.set(s, 0);
      heap.push(0, s);
    });
    while (heap.size) {
      const u = heap.pop();
      const du = heap.topKey;
      if (du > (dist.get(u) ?? Infinity)) continue;
      for (const [v] of nb[u]) {
        if (!inL.has(v)) continue;
        const nd = du + Math.hypot(states[u].cx - states[v].cx, states[u].cy - states[v].cy);
        if (nd < (dist.get(v) ?? Infinity)) {
          dist.set(v, nd);
          lab.set(v, lab.get(u)!);
          heap.push(nd, v);
        }
      }
    }
    const out: number[][] = seeds.map(() => []);
    for (const s of list) out[lab.get(s) ?? 0].push(s);
    return out.filter((g) => g.length);
  };

  // noms de guerres ; une guerre qui reprend porte un ordinal (« Deuxième guerre de X »)
  const warCount = new Map<string, number>();
  const ORDINALS = ['', '', 'Deuxième', 'Troisième', 'Quatrième', 'Cinquième', 'Sixième', 'Septième', 'Huitième', 'Neuvième', 'Dixième'];
  const warName = (a: number, b: number, dur: number, focus: number): string => {
    const holy = rootRel(countries[a].religion) !== rootRel(countries[b].religion) && rng.chance(0.35);
    const crowns = MONARCHIES.has(countries[a].form) && MONARCHIES.has(countries[b].form) && rng.chance(0.12);
    const base = holy ? `guerre sainte ${deOf(cName(b))}`
      : crowns ? 'guerre des Deux Couronnes'
        : NUMBERS[dur] && !warCount.has(`guerre des ${NUMBERS[dur]} Ans`) && rng.chance(0.3) ? `guerre des ${NUMBERS[dur]} Ans`
          : rng.chance(0.55) ? `guerre ${ofState(focus)}` : `guerre ${deOf(cName(b))}`;
    const n = (warCount.get(base) ?? 0) + 1;
    warCount.set(base, n);
    return n === 1 ? capitalize(base) : `${ORDINALS[Math.min(n, 10)] || `${n}e`} ${base}`;
  };

  // ---------- opérations à rebours ----------

  /** Le pays K naît en y : avant, ses terres appartenaient à un voisin (sécession) ou à des pays qu'il a unifiés. */
  const dissolve = (K: number, y: number) => {
    const list = statesOf(K);
    alive[K] = false;
    if (!list.length) return;
    const neigh = [...neighborsOf(K, list).entries()].filter(([c]) => alive[c]);
    neigh.sort((a, b) => b[1] * (group(b[0]) === group(K) ? 2 : 1) - a[1] * (group(a[0]) === group(K) ? 2 : 1));
    if (neigh.length && rng.chance(0.6)) {
      const M = neigh[0][0];
      for (const s of list) moveBack(s, y, M);
      const revolt = countries[K].culture !== countries[M].culture;
      events.push({
        year: y, kind: 'indépendance', title: `Indépendance ${deOf(cName(K))}`, countries: [K, M], states: list,
        text: revolt
          ? `Les ${pluralFr(inp.cultures[countries[K].culture]?.name ?? 'peuple')} se soulèvent contre ${cName(M)} : ${theFull(K)} proclame son indépendance autour ${ofState(countries[K].capitalState)}.`
          : `${capitalize(theFull(K))} se détache ${deOf(cName(M))} et devient indépendant${FEMININE.has(countries[K].form) ? 'e' : ''}.`,
      });
      return;
    }
    const parts = list.length >= 3 ? partition(list, Math.max(2, Math.min(4, Math.round(list.length / 3)))) : [list];
    const olds = parts.map((g) => {
      // à rebours, les États redeviennent ceux du prédécesseur
      const id = countries.length;
      for (const s of g) changes.push({ year: y, seq: seq++, state: s, from: id, to: K });
      return newCountry(g, y, '');
    });
    for (const o of olds) countries[o].fate = parts.length > 1 ? `réuni${FEMININE.has(countries[o].form) ? 'e' : ''} à ${cName(K)} en ${y}` : `devient ${cName(K)} en ${y}`;
    events.push(
      parts.length > 1
        ? { year: y, kind: 'unification', title: `Unification ${deOf(cName(K))}`, countries: [K, ...olds], states: list, text: `${listFr(olds.map(cName))} s'unissent autour ${ofState(countries[K].capitalState)} : naissance ${ofFull(K)}.` }
        : { year: y, kind: 'fondation', title: `Fondation ${deOf(cName(K))}`, countries: [K, olds[0]], states: list, text: `Changement de régime : ${theFull(olds[0])} devient ${theFull(K)}.` },
    );
  };

  /** Conquête : en y, A arrache 1 à 3 États frontaliers à B (à rebours, ils retournent à B). */
  const war = (y: number) => {
    const cand = countries.map((_, i) => i).filter((i) => alive[i] && cnt[i] > 0 && countries[i].founded < y - 3);
    if (cand.length < 2) return;
    const sizes = cand.map((i) => Math.pow(cnt[i], 0.7));
    let r = rng.next() * sizes.reduce((a, b) => a + b, 0), A = cand[0];
    for (let k = 0; k < cand.length; k++) if ((r -= sizes[k]) <= 0) {
      A = cand[k];
      break;
    }
    const mine = statesOf(A);
    const neigh = [...neighborsOf(A, mine).entries()].filter(([c]) => alive[c] && countries[c].founded < y - 3);
    if (!neigh.length) return;
    const weight = (c: number) => (A < C && inp.countries[A].rivals.includes(c) ? 4 : 1) * (A < C && inp.countries[A].allies.includes(c) ? 0.2 : 1);
    let rr = rng.next() * neigh.reduce((s, [c]) => s + weight(c), 0);
    let B = neigh[0][0];
    for (const [c] of neigh) if ((rr -= weight(c)) <= 0) {
      B = c;
      break;
    }
    const dur = rng.chance(0.5) ? rng.int(1, 4) : rng.pick([5, 6, 7, 8, 10, 12, 15, 20, 30]);
    const from = y - dur;
    const border = mine.filter((s) => s !== countries[A].capitalState && [...nb[s].keys()].some((t) => owner[t] === B));
    const ally = A < C ? inp.countries[A].allies.find((c) => alive[c]) : undefined;
    if (!border.length || rng.chance(0.2) || mine.length <= 1) {
      events.push({
        year: y, from, kind: 'guerre', title: warName(A, B, dur, border[0] ?? mine[0]), countries: [A, B], states: [],
        text: `${cName(A)} et ${cName(B)} s'affrontent ${dur > 1 ? `pendant ${dur} ans` : 'une saison durant'} ; la paix revient sans changement de frontière.`,
      });
      return;
    }
    const take = [rng.pick(border)];
    const n = Math.min(border.length, rng.int(1, 3), mine.length - 1);
    while (take.length < n) {
      const next = border.find((s) => !take.includes(s) && take.some((t) => nb[t].has(s)));
      if (next === undefined) break;
      take.push(next);
    }
    for (const s of take) moveBack(s, y, B);
    events.push({
      year: y, from, kind: 'guerre', title: warName(A, B, dur, take[0]), countries: ally !== undefined ? [A, B, ally] : [A, B], states: take,
      text: `${cName(A)}${ally !== undefined ? `, avec l'appui ${deOf(cName(ally))},` : ''} l'emporte sur ${cName(B)} et annexe ${listFr(take.map(sName))}.`,
    });
  };

  /** En y, A absorbe un pays voisin, par les armes ou par héritage (à rebours, ce pays renaît). */
  const annex = (y: number) => {
    const cand = countries.map((_, i) => i).filter((i) => alive[i] && countries[i].founded < y - 10);
    const big = cand.filter((i) => cnt[i] >= 4);
    if (!big.length) return;
    const A = rng.pick(big);
    const mine = statesOf(A);
    const capA = countries[A].capitalState;
    // bloc périphérique contigu, loin de la capitale
    const far = [...mine].filter((s) => s !== capA).sort((a, b) =>
      Math.hypot(states[b].cx - states[capA].cx, states[b].cy - states[capA].cy) - Math.hypot(states[a].cx - states[capA].cx, states[a].cy - states[capA].cy));
    const seed = far[rng.int(0, Math.min(far.length - 1, 3))];
    if (seed === undefined) return;
    const size = Math.min(rng.int(1, 5), Math.floor(mine.length / 3));
    const chunk = [seed];
    for (let i = 0; i < chunk.length && chunk.length < size; i++) {
      for (const [t] of nb[chunk[i]]) {
        if (chunk.length >= size) break;
        if (owner[t] === A && t !== capA && !chunk.includes(t)) chunk.push(t);
      }
    }
    const monarchy = MONARCHIES.has(countries[A].form);
    const inherit = monarchy && rng.chance(0.3);
    const id = countries.length;
    for (const s of chunk) changes.push({ year: y, seq: seq++, state: s, from: id, to: A });
    const E = newCountry(chunk, y, '');
    countries[E].fate = inherit ? `passe par héritage à ${cName(A)} en ${y}` : `conquis${FEMININE.has(countries[E].form) ? 'e' : ''} par ${cName(A)} en ${y}`;
    if (inherit) {
      const wed = y - rng.int(8, 35);
      const lang = (c: number) => inp.langs[Math.max(0, countries[c].culture)];
      const groom = givenName(lang(A), rng, false), bride = givenName(lang(E), rng, true);
      events.push({ year: wed, kind: 'mariage', title: `Mariage ${deOf(groom)} et ${deOf(bride)}`, countries: [A, E], states: [], text: `Le prince ${groom} ${deOf(cName(A))} épouse ${bride}, héritière ${ofFull(E)}.` });
      events.push({ year: y, kind: 'héritage', title: `Héritage ${deOf(cName(E))}`, countries: [A, E], states: chunk, text: `Le dernier souverain ${deOf(cName(E))} meurt sans héritier mâle : par le mariage de ${wed}, ${listFr(chunk.map(sName))} passe${chunk.length > 1 ? 'nt' : ''} à ${cName(A)}.` });
    } else {
      const dur = rng.int(1, 8);
      events.push({ year: y, from: y - dur, kind: 'annexion', title: warName(A, E, dur, chunk[0]), countries: [A, E], states: chunk, text: `${cName(A)} conquiert ${theFull(E)} (${listFr(chunk.map(sName))}), rayé${FEMININE.has(countries[E].form) ? 'e' : ''} de la carte.` });
    }
  };

  /** Révolte écrasée dans un État de culture différente de celle du pouvoir. */
  const revolt = (y: number) => {
    const cand: number[] = [];
    for (let s = 0; s < S; s++) {
      const o = owner[s];
      if (alive[o] && states[s].culture >= 0 && states[s].culture !== countries[o].culture && s !== countries[o].capitalState) cand.push(s);
    }
    if (!cand.length) return;
    const s = rng.pick(cand), o = owner[s];
    const people = inp.cultures[states[s].culture].name;
    events.push({ year: y, from: y - rng.int(0, 3), kind: 'révolte', title: capitalize(`révolte ${ofState(s)}`), countries: [o], states: [s], text: `Les ${pluralFr(people)} ${ofState(s)} se soulèvent contre ${cName(o)} ; la révolte est écrasée.` });
  };

  /** Mariage princier entre deux monarchies voisines (sans conséquence territoriale). */
  const marriage = (y: number) => {
    const mons = countries.map((_, i) => i).filter((i) => alive[i] && MONARCHIES.has(countries[i].form));
    if (mons.length < 2) return;
    const A = rng.pick(mons);
    const near = [...neighborsOf(A).keys()].filter((c) => alive[c] && MONARCHIES.has(countries[c].form));
    if (!near.length) return;
    const B = rng.pick(near);
    const lang = (c: number) => inp.langs[Math.max(0, countries[c].culture)];
    const groom = givenName(lang(A), rng, false), bride = givenName(lang(B), rng, true);
    events.push({ year: y, kind: 'mariage', title: `Mariage ${deOf(groom)} et ${deOf(bride)}`, countries: [A, B], states: [], text: `Alliance scellée par le mariage de ${groom} ${deOf(cName(A))} et de ${bride} ${deOf(cName(B))}.` });
  };

  // ---------- déroulement à rebours ----------
  const foundedAt = new Map<number, number[]>();
  for (let c = 0; c < C; c++) {
    const f = Math.max(start + 1, countries[c].founded);
    countries[c].founded = f;
    foundedAt.set(f, [...(foundedAt.get(f) ?? []), c]);
  }
  for (let y = year; y > start; y--) {
    for (const K of foundedAt.get(y) ?? []) dissolve(K, y);
    const nAlive = alive.filter(Boolean).length;
    if (rng.chance(Math.min(0.6, 0.12 + 0.004 * nAlive))) war(y);
    if (countries.length < 900 && rng.chance(0.16)) annex(y);
    if (rng.chance(0.08)) revolt(y);
    if (rng.chance(0.06)) marriage(y);
  }
  // schismes et prédications (dates des religions)
  for (const r of inp.religions) {
    if (r.folk || r.founded <= start || r.founded > year) continue;
    events.push(r.parent >= 0
      ? { year: r.founded, kind: 'schisme', title: `Schisme : ${r.name}`, countries: [], states: [], text: `Schisme : ${r.founder} rompt avec ${withArticle(inp.religions[r.parent].name)} et fonde ${withArticle(r.name)}.` }
      : { year: r.founded, kind: 'schisme', title: `Naissance : ${r.name}`, countries: [], states: [], text: `${r.founder} prêche une foi nouvelle : naissance ${ofArticle(r.name)}.` });
  }

  // ---------- remise dans l'ordre chronologique ----------
  changes.sort((a, b) => a.year - b.year || b.seq - a.seq);
  events.sort((a, b) => a.year - b.year);
  const initial = Int32Array.from(owner);
  return {
    start, end: year, countries, initial,
    changeYear: Int32Array.from(changes, (c) => c.year),
    changeState: Int32Array.from(changes, (c) => c.state),
    changeFrom: Int32Array.from(changes, (c) => c.from),
    changeTo: Int32Array.from(changes, (c) => c.to),
    events,
  };
}

/** Propriétaire de chaque État à la fin de l'année `y` (après les événements de l'année). */
export function ownersAt(h: HistoryData, y: number, out?: Int32Array): Int32Array {
  const o = out ?? new Int32Array(h.initial.length);
  o.set(h.initial);
  for (let k = 0; k < h.changeYear.length && h.changeYear[k] <= y; k++) o[h.changeState[k]] = h.changeTo[k];
  return o;
}
