import { MinHeap } from '../heap';
import { Rng } from '../rng';
import type { CultureGroupInfo, ReligionInfo } from '../types';
import { SpatialHash, type Terrain } from './common';
import type { CitySite } from './cities';
import { spreadCost, type CultureMap } from './cultures';
import type { Edge, ProvStats } from './graph';
import { capitalize, deOf, givenName, makeWord, NameRegistry, ofArticle, pluralFr, type Language } from './names';

export interface ReligionMap {
  provReligion: Int32Array;
  religions: ReligionInfo[];
  /** Religion dont la ville est le lieu saint (-1 sinon). */
  holyOf: Int32Array;
}

const KINDS = [
  { kind: 'Monothéisme', w: 0.34 },
  { kind: 'Polythéisme', w: 0.24 },
  { kind: 'Dualisme', w: 0.14 },
  { kind: 'Philosophie', w: 0.13 },
  { kind: 'Culte solaire', w: 0.15 },
];
const CONCEPTS = ['la Lumière', "l'Aube", 'la Flamme', 'la Source', "l'Étoile", 'la Roue', 'la Lune', "l'Arbre-Monde", "l'Équilibre", 'la Voie', 'le Serment', 'le Silence', "l'Aurore", 'la Montagne', 'la Mer'];
const DUALS: [string, string][] = [['la Flamme', "l'Ombre"], ['la Lumière', 'la Nuit'], ["l'Ordre", 'le Chaos'], ['la Vie', 'la Cendre'], ['le Ciel', "l'Abîme"]];
const SYMBOLS = ['☀', '☾', '✦', '❂', '✺', '◈', '⟁', '❖', '✤', '♁', '✵', '✧'];
const TENETS = [
  'Pèlerinage vers la ville sainte', 'Culte des ancêtres', 'Clergé guerrier', 'Ascétisme', 'Prosélytisme', 'Tolérance envers les autres fois',
  'Sacrifices rituels', 'Monachisme', 'Divination', 'Jeûnes sacrés', 'Interdits alimentaires', 'Prêtres-rois', 'Égalité des sexes devant le culte',
  'Crémation des morts', 'Fêtes des moissons', 'Charité obligatoire',
];
const CLERGY = ['prêtres', 'mages', 'sages', 'moines', 'oracles', 'prêtresses', 'hiérophantes'];
const TEMPLES = ['temples', 'sanctuaires', 'monastères', 'tours de prière', 'basiliques', 'cloîtres'];
/** Qualificatifs épicènes d'une « lecture » (nom féminin) des textes. */
const READINGS = ['réformiste', 'rigoriste', 'mystique', 'populaire', 'ésotérique', 'littérale'];

function hsl(h: number, s: number, l: number): [number, number, number] {
  const k = (n: number) => (n + h * 12) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
}

/**
 * Religions : quelques grandes fois naissent dans des villes saintes (carrefours commerciaux) et se
 * diffusent le long des échanges, plus facilement au sein d'une même famille culturelle. Les États
 * adoptent la foi de leur capitale et convertissent une partie de leurs sujets ; les grandes religions
 * se scindent en confessions ; les régions jamais atteintes gardent leurs cultes traditionnels.
 */
export function buildReligions(
  t: Terrain,
  stats: ProvStats[],
  adj: Edge[][],
  sites: CitySite[],
  cityNames: string[],
  cityProvince: number[],
  cityTrade: Float64Array,
  cm: CultureMap,
  owner: Int32Array,
  capitals: number[],
  year: number,
  rng: Rng,
  reg: NameRegistry,
): ReligionMap {
  const P = stats.length;
  const nCity = sites.length;
  let landArea = 0;
  for (const s of stats) landArea += s.area;
  const groupOf = (p: number) => (cm.provCulture[p] >= 0 ? cm.cultures[cm.provCulture[p]].group : -1);

  // --- villes saintes : carrefours commerciaux éloignés, dans des familles culturelles distinctes ---
  const R = Math.min(7, 3 + rng.int(0, 2) + (landArea > 6e7 ? 1 : 0));
  const maxTrade = Math.max(1e-9, ...cityTrade);
  const order = sites.map((_, i) => i).sort((a, b) => score(b) - score(a));
  function score(i: number): number {
    return (0.2 + cityTrade[i] / maxTrade) * Math.pow(sites[i].pop, 0.3) * rng.range(0.5, 1.5);
  }
  const holy: number[] = [];
  const usedGroups = new Set<number>();
  let sep = 0.33 * Math.sqrt(landArea);
  for (let pass = 0; pass < 6 && holy.length < R; pass++) {
    const hash = new SpatialHash(t.grid, sep);
    for (const c of holy) hash.add(sites[c].cell);
    for (const c of order) {
      if (holy.length >= R) break;
      const g = groupOf(cityProvince[c]);
      if (holy.includes(c) || (pass < 2 && usedGroups.has(g)) || hash.anyWithin(sites[c].cell, sep)) continue;
      hash.add(sites[c].cell);
      holy.push(c);
      usedGroups.add(g);
    }
    sep *= 0.8;
  }

  // --- diffusion ---
  const provTrade = new Float64Array(P);
  for (let c = 0; c < nCity; c++) provTrade[cityProvince[c]] += cityTrade[c] / maxTrade;
  const vigor = holy.map(() => rng.range(0.75, 1.5));
  const REACH = 0.85 * Math.sqrt(landArea);
  const provReligion = new Int32Array(P).fill(-1);
  const key = new Float64Array(P).fill(Infinity);
  const heap = new MinHeap(1024);
  holy.forEach((c, r) => {
    const p = cityProvince[c];
    provReligion[p] = r;
    key[p] = 0;
    heap.push(0, p);
  });
  while (heap.size > 0) {
    const p = heap.pop();
    const k = heap.topKey;
    if (k > key[p]) continue;
    const r = provReligion[p];
    for (const e of adj[p]) {
      const q = e.to;
      const cross = groupOf(p) !== groupOf(q) ? 1.6 : 1;
      const tradeF = 1 / (1 + 0.8 * Math.log10(1 + 100 * provTrade[q]));
      const nk = k + (spreadCost(t, stats, p, e) * cross * tradeF) / vigor[r];
      if (nk < key[q] && nk < REACH) {
        key[q] = nk;
        provReligion[q] = r;
        heap.push(nk, q);
      }
    }
  }

  // --- cultes traditionnels : un par famille culturelle, là où aucune grande foi n'est arrivée ---
  const religions: ReligionInfo[] = [];
  const folkOfGroup = new Map<number, number>();
  const folkId = (g: number): number => {
    let id = folkOfGroup.get(g);
    if (id === undefined) {
      id = holy.length + folkOfGroup.size;
      folkOfGroup.set(g, id);
    }
    return id;
  };
  for (let p = 0; p < P; p++) if (provReligion[p] < 0 && stats[p].cells > 0) provReligion[p] = folkId(Math.max(0, groupOf(p)));

  // --- religions d'État : conversions partielles des sujets ---
  const capCulture = capitals.map((c) => cm.provCulture[cityProvince[c]]);
  for (let p = 0; p < P; p++) {
    const o = owner[p];
    if (o < 0) continue;
    const state = provReligion[cityProvince[capitals[o]]];
    if (provReligion[p] === state) continue;
    const isFolk = provReligion[p] >= holy.length;
    const chance = (cm.provCulture[p] === capCulture[o] ? 0.72 : 0.3) + (isFolk ? 0.18 : 0);
    if (rng.chance(chance)) provReligion[p] = state;
  }

  // --- identité des grandes religions ---
  const hues = rng.shuffle([0.0, 0.08, 0.15, 0.55, 0.62, 0.72, 0.82, 0.92, 0.33, 0.45]);
  const symbols = rng.shuffle([...SYMBOLS]);
  const langOfCity = (c: number): Language => cm.langs[Math.max(0, cm.provCulture[cityProvince[c]])];
  holy.forEach((c, r) => {
    const lang = langOfCity(c);
    const culture = cm.cultures[Math.max(0, cm.provCulture[cityProvince[c]])];
    const kind = pickKind(rng);
    const female = rng.chance(0.3);
    let deity = givenName(lang, rng, female);
    for (let i = 0; i < 6 && deity.length < 4; i++) deity = givenName(lang, rng, female);
    const founder = givenName(lang, rng, rng.chance(0.2));
    const concept = rng.pick(CONCEPTS);
    const [dA, dB] = rng.pick(DUALS);
    let name: string;
    let doctrine: string;
    switch (kind) {
      case 'Monothéisme':
        name = rng.pick([`${deity.replace(/[aeiouy]+$/, '')}isme`, `Foi ${deOf(deity)}`, `Église de ${concept}`, `Culte ${deOf(deity)}`]);
        doctrine = `professe l'existence d'un dieu unique, ${deity}, créateur du monde et juge des âmes.`;
        break;
      case 'Polythéisme':
        name = rng.pick([`Panthéon ${culture.adjM}`, `Culte des ${rng.pick(['Sept', 'Neuf', 'Douze', 'Trois'])} Dieux`, `Anciens Dieux des ${pluralFr(culture.name)}`]);
        doctrine = `honore un vaste panthéon dominé par ${female ? 'la déesse' : 'le dieu'} ${deity}.`;
        break;
      case 'Dualisme':
        name = rng.pick([`Voie de ${dA} et de ${dB}`, `${founder.replace(/[aeiouy]+$/, '')}isme`]);
        doctrine = `voit le monde comme l'affrontement éternel de ${dA} et de ${dB}, dont chaque fidèle doit choisir le camp.`;
        break;
      case 'Philosophie':
        name = rng.pick([`Voie de ${concept}`, `Enseignements ${deOf(founder)}`, `Doctrine ${culture.adjF}`]);
        doctrine = `tient davantage de la sagesse : elle suit les enseignements ${deOf(founder)}, qui prêchait la maîtrise de soi et l'harmonie.`;
        break;
      default:
        name = rng.pick([`Culte ${deOf(deity)}`, "Église de l'Aube", 'Flamme éternelle', `Temple du Soleil ${culture.adjM}`]);
        doctrine = `vénère ${deity}, l'astre du jour, source de toute vie et gardien des moissons.`;
    }
    name = reg.unique(() => name);
    const clergy = rng.pick(CLERGY);
    const temples = rng.pick(TEMPLES);
    const book = capitalize(makeWord(lang, rng, 2));
    const scripture = rng.pick([/^[AEIOUY]/.test(book) ? `l'${book}` : `le ${book}`, `les Livres ${deOf(founder)}`, `les Chants ${deOf(deity)}`, `le Codex ${concept.startsWith('le ') ? 'du ' + concept.slice(3) : 'de ' + concept}`]);
    const founded = year - rng.int(150, Math.max(200, Math.min(year - 60, 1150)));
    religions.push({
      id: r, name, kind, parent: -1, folk: false, color: hsl(hues[r % hues.length], 0.55, 0.48), symbol: symbols[r % symbols.length],
      holyCity: c, deity, founder, founded, tenets: rng.shuffle([...TENETS]).slice(0, 3), clergy, temples, scripture,
      description: `Apparue à ${cityNames[c]} vers l'an ${founded}, cette foi ${doctrine} Ses fidèles, guidés par des ${clergy}, se réunissent dans des ${temples}. Texte sacré : ${scripture}.`,
      pop: 0, provinces: 0, label: null,
    });
  });
  const groups: CultureGroupInfo[] = cm.groups;
  for (const [g, id] of [...folkOfGroup.entries()].sort((a, b) => a[1] - b[1])) {
    const adj = groups[g].name.replace(/^Famille /, '');
    const name = reg.unique(() => rng.pick([`Traditions ${adj}s`, `Anciens cultes ${adj}s`, `Culte des esprits ${adj}`]));
    const col = groups[g].color;
    const gray = (col[0] + col[1] + col[2]) / 3;
    religions[id] = {
      id, name, kind: 'Culte traditionnel', parent: -1, folk: true,
      color: col.map((v) => Math.round(v * 0.35 + gray * 0.45 + 40)) as [number, number, number],
      symbol: '⚘', holyCity: -1, deity: '', founder: '', founded: -1, tenets: ['Culte des ancêtres', 'Esprits de la nature', 'Rites saisonniers'],
      clergy: 'chamanes', temples: 'bois sacrés', scripture: 'la tradition orale',
      description: `Croyances ancestrales des peuples de la ${groups[g].name.toLowerCase()} : esprits de la nature, culte des ancêtres et rites saisonniers, transmis oralement par des chamanes.`,
      pop: 0, provinces: 0, label: null,
    };
  }

  // --- schismes : les grandes religions se scindent en confessions régionales ---
  const counts = new Int32Array(religions.length);
  for (let p = 0; p < P; p++) if (provReligion[p] >= 0) counts[provReligion[p]]++;
  for (let r = 0; r < holy.length; r++) {
    if (counts[r] < 0.16 * P) continue;
    const splits = counts[r] > 0.33 * P ? 2 : 1;
    const area = new Set<number>();
    for (let p = 0; p < P; p++) if (provReligion[p] === r) area.add(p);
    const centers = [cityProvince[holy[r]]];
    for (let k = 0; k < splits; k++) {
      // centre du schisme : grande ville de la religion, loin des centres existants
      let best = -1, bs = -1;
      for (let c = 0; c < nCity; c++) {
        const p = cityProvince[c];
        if (!area.has(p)) continue;
        let dmin = Infinity;
        for (const cp of centers) dmin = Math.min(dmin, Math.hypot(stats[p].cx - stats[cp].cx, stats[p].cy - stats[cp].cy));
        const s = dmin * Math.pow(sites[c].pop, 0.25);
        if (s > bs) {
          bs = s;
          best = c;
        }
      }
      if (best < 0) break;
      centers.push(cityProvince[best]);
      const parent = religions[r];
      const reading = rng.pick(READINGS);
      const hp = cityProvince[parent.holyCity], bp = cityProvince[best];
      let dx = stats[bp].cx - stats[hp].cx;
      if (dx > t.grid.W / 2) dx -= t.grid.W;
      else if (dx < -t.grid.W / 2) dx += t.grid.W;
      const dy = stats[bp].cy - stats[hp].cy;
      const dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "de l'Est" : "de l'Ouest") : dy > 0 ? 'du Sud' : 'du Nord';
      const city = cityNames[best];
      const dname = rng.pick([`${parent.name} ${dir}`, `Église ${deOf(city)}`, `Réforme ${deOf(city)}`, `Rite ${deOf(city)}`]);
      const id = religions.length;
      const founded = parent.founded + rng.int(150, Math.max(200, year - parent.founded - 40));
      const [h, s, l] = [(hues[r % hues.length] + (k + 1) * 0.035) % 1, 0.45, 0.36 + 0.14 * k];
      religions.push({
        ...parent, id, parent: r, name: reg.unique(() => dname), color: hsl(h, s, l),
        holyCity: best, founded, tenets: [...parent.tenets.slice(0, 2), rng.pick(TENETS)],
        description: `Confession née d'un schisme au sein ${ofArticle(parent.name)} vers l'an ${founded}, autour de ${cityNames[best]}. Elle conteste l'autorité des ${parent.clergy} ${deOf(cityNames[parent.holyCity])} et impose une lecture ${reading} des textes sacrés.`,
        pop: 0, provinces: 0, label: null,
      });
    }
    if (centers.length < 2) continue;
    // chaque province de la religion rejoint le centre le plus proche (dans l'aire de la religion)
    const lab = new Map<number, number>();
    const dist = new Map<number, number>();
    const h2 = new MinHeap(256);
    centers.forEach((p, k) => {
      lab.set(p, k === 0 ? r : religions.length - centers.length + k);
      dist.set(p, 0);
      h2.push(0, p);
    });
    while (h2.size > 0) {
      const p = h2.pop();
      const d = h2.topKey;
      if (d > (dist.get(p) ?? Infinity)) continue;
      for (const e of adj[p]) {
        if (!area.has(e.to)) continue;
        const nd = d + spreadCost(t, stats, p, e);
        if (nd < (dist.get(e.to) ?? Infinity)) {
          dist.set(e.to, nd);
          lab.set(e.to, lab.get(p)!);
          h2.push(nd, e.to);
        }
      }
    }
    for (const [p, rel] of lab) provReligion[p] = rel;
  }

  for (let p = 0; p < P; p++) {
    const r = provReligion[p];
    if (r < 0) continue;
    religions[r].pop += stats[p].pop;
    religions[r].provinces++;
  }
  const holyOf = new Int32Array(nCity).fill(-1);
  for (const rel of religions) if (rel.holyCity >= 0 && holyOf[rel.holyCity] < 0) holyOf[rel.holyCity] = rel.id;
  return { provReligion, religions, holyOf };
}

function pickKind(rng: Rng): string {
  let r = rng.next();
  for (const k of KINDS) {
    r -= k.w;
    if (r <= 0) return k.kind;
  }
  return KINDS[0].kind;
}
