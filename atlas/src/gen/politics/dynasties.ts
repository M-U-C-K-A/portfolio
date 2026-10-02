import { Rng } from '../rng';
import type { CultureInfo, DynastyInfo, Heraldry, LineageEntry, Portrait, RulerInfo } from '../types';
import { smoothstep } from '../util';
import { makeArms } from './heraldry';
import { capitalize, deOf, givenName, makeWord, NameRegistry, roman, type Language } from './names';

export const DYNASTIC_FORMS = new Set(['Empire', 'Royaume', 'Sultanat', 'Khanat', 'Principauté', 'Grand-duché']);

const TITLES: Record<string, [string, string]> = {
  Empire: ['Empereur', 'Impératrice'],
  Royaume: ['Roi', 'Reine'],
  Sultanat: ['Sultan', 'Sultane'],
  Khanat: ['Khan', 'Khatoun'],
  Principauté: ['Prince', 'Princesse'],
  'Grand-duché': ['Grand-duc', 'Grande-duchesse'],
  Théocratie: ['Grand Prêtre', 'Grande Prêtresse'],
  République: ['Président', 'Présidente'],
  'Ligue marchande': ['Doge', 'Dogaresse'],
  Confédération: ['Chancelier', 'Chancelière'],
  Union: ['Consul', 'Consule'],
};
const HEADWEAR: Record<string, Portrait['headwear']> = {
  Empire: 'imperial', Royaume: 'crown', Sultanat: 'turban', Khanat: 'furhat', Principauté: 'circlet', 'Grand-duché': 'circlet',
  Théocratie: 'mitre', République: 'none', 'Ligue marchande': 'hat', Confédération: 'hat', Union: 'none',
};
const TRAITS: [string, string][] = [
  ['Ambitieux', 'Ambitieuse'], ['Pieux', 'Pieuse'], ['Bâtisseur', 'Bâtisseuse'], ['Diplomate', 'Diplomate'], ['Stratège', 'Stratège'],
  ['Cruel', 'Cruelle'], ['Juste', 'Juste'], ['Érudit', 'Érudite'], ['Prodigue', 'Prodigue'], ['Avare', 'Avare'], ['Paranoïaque', 'Paranoïaque'],
  ['Charismatique', 'Charismatique'], ['Réformateur', 'Réformatrice'], ['Conquérant', 'Conquérante'], ['Mécène', 'Mécène'], ['Sage', 'Sage'],
  ['Colérique', 'Colérique'], ['Mélancolique', 'Mélancolique'], ['Chasseur', 'Chasseresse'], ['Superstitieux', 'Superstitieuse'],
];
// fins de règne [masculin, féminin, poids]
const FATES: [string, string, number][] = [
  ['mort de vieillesse', 'morte de vieillesse', 0.34], ['mort de maladie', 'morte de maladie', 0.2], ['tombé au combat', 'tombée au combat', 0.12],
  ['assassiné', 'assassinée', 0.09], ['a abdiqué', 'a abdiqué', 0.07], ['déposé', 'déposée', 0.06], ['empoisonné', 'empoisonnée', 0.05],
  ['mort en mer', 'morte en mer', 0.03], ['disparu', 'disparue', 0.04],
];
const SUCC_M: [string, number][] = [['fils', 0.46], ['frère', 0.14], ['neveu', 0.1], ['cousin', 0.1], ['petit-fils', 0.12], ['gendre', 0.04], ['oncle', 0.04]];
const SUCC_F: [string, number][] = [['fille', 0.55], ['sœur', 0.15], ['nièce', 0.12], ['épouse', 0.1], ['petite-fille', 0.08]];
const VERBS = ['Servir', 'Tenir', 'Vaincre', 'Bâtir', 'Croire', 'Veiller', 'Garder', 'Oser', 'Durer', 'Régner', 'Unir', 'Protéger'];
const CONCEPTS = ['le fer', 'la foi', 'le sang', 'la loi', 'la mer', 'le serment', 'la couronne', 'le peuple', 'la terre', "l'honneur", 'le feu'];

function weighted<T>(rng: Rng, list: [T, ...unknown[]][], wIdx: number): T {
  let total = 0;
  for (const e of list) total += e[wIdx] as number;
  let r = rng.next() * total;
  for (const e of list) {
    r -= e[wIdx] as number;
    if (r <= 0) return e[0];
  }
  return list[0][0];
}

function motto(rng: Rng): string {
  const a = rng.pick(VERBS), b = rng.pick(VERBS.filter((v) => v !== a));
  const c = rng.pick(CONCEPTS), d = rng.pick(CONCEPTS.filter((v) => v !== c));
  return rng.pick([
    `${a} et ${b.toLowerCase()}`,
    `Par ${c}, pour ${d}`,
    `Nul ne ${rng.pick(['passe', 'ploie', 'recule', 'nous brise', 'oublie'])}`,
    `Toujours ${rng.pick(['fidèles', 'debout', 'vigilants', 'libres', 'unis'])}`,
    `${capitalize(c)} avant tout`,
  ]);
}

export interface CountrySeed {
  form: string;
  culture: number;
  neighbors: number[];
}

export interface DynastyResult {
  dynasties: DynastyInfo[];
  countryDynasty: number[];
  rulers: RulerInfo[];
  arms: Heraldry[];
}

/**
 * Maisons régnantes et dirigeants. Les monarchies ont une dynastie (lignée depuis sa fondation,
 * noms de règne répétés → numéros, parenté, fins de règne) ; un voisin de même famille culturelle
 * peut être gouverné par une branche cadette (union dynastique). Les républiques ont un dirigeant élu.
 */
export function buildDynasties(
  seeds: CountrySeed[],
  order: number[],
  cultures: CultureInfo[],
  langs: Language[],
  hearthLat: number[],
  year: number,
  rng: Rng,
  reg: NameRegistry,
): DynastyResult {
  const C = seeds.length;
  const dynasties: DynastyInfo[] = [];
  const countryDynasty = new Array<number>(C).fill(-1);
  const rulers = new Array<RulerInfo>(C);
  const arms = new Array<Heraldry>(C);
  const pools = new Map<number, { m: string[]; f: string[] }>();

  const portrait = (culture: number, female: boolean, age: number, form: string): Portrait => {
    const lat = hearthLat[culture] ?? 30;
    const skin = Math.max(0, Math.min(1, 0.12 + 0.85 * smoothstep(6, 58, lat) + rng.range(-0.12, 0.12)));
    let hair = skin > 0.72 ? weighted(rng, [[0, 0.2], [1, 0.3], [2, 0.25], [3, 0.17], [4, 0.08]], 1) : skin > 0.45 ? weighted(rng, [[0, 0.55], [1, 0.4], [2, 0.05]], 1) : 0;
    if (age > 58 && rng.chance(0.65)) hair = 5;
    return {
      female, skin, hair, beard: !female && rng.chance(form === 'Sultanat' || form === 'Khanat' ? 0.85 : 0.55),
      headwear: HEADWEAR[form] ?? 'none', hairLong: female ? rng.chance(0.85) : rng.chance(0.2), seed: rng.int(0, 1e9),
    };
  };
  const traits = (female: boolean): string[] => rng.shuffle([...TRAITS]).slice(0, rng.int(2, 3)).map((t) => t[female ? 1 : 0]);
  const femaleChance = (culture: number) => (cultures[culture]?.traits.includes('Égalitaires') ? 0.45 : 0.16);

  for (const c of order) {
    const seed = seeds[c];
    const culture = Math.max(0, seed.culture);
    const lang = langs[culture];
    const [tm, tf] = TITLES[seed.form] ?? ['Souverain', 'Souveraine'];
    if (!DYNASTIC_FORMS.has(seed.form)) {
      // dirigeant élu ou désigné
      const female = rng.chance(femaleChance(culture) + 0.08);
      const given = givenName(lang, rng, female);
      const surname = capitalize(makeWord(lang, rng, 2));
      const age = rng.int(38, 74);
      rulers[c] = {
        name: `${given} ${surname}`, regnal: `${given} ${surname}`, title: female ? tf : tm, female, age, born: year - age,
        since: year - rng.int(0, 9), traits: traits(female), portrait: portrait(culture, female, age, seed.form),
      };
      arms[c] = makeArms(rng);
      continue;
    }
    // branche cadette d'une dynastie voisine de même famille culturelle ?
    let dyn = -1;
    for (const n of seed.neighbors) {
      const d = countryDynasty[n];
      if (d >= 0 && cultures[dynasties[d].culture]?.group === cultures[culture]?.group && rng.chance(0.16)) {
        dyn = d;
        break;
      }
    }
    if (dyn < 0) {
      const root = reg.unique(() => {
        let w = makeWord(lang, rng, 2);
        for (let i = 0; i < 8 && w.length < 4; i++) w = makeWord(lang, rng, 2);
        return capitalize(w);
      });
      const founded = year - rng.int(40, 460);
      dyn = dynasties.length;
      pools.set(dyn, {
        m: Array.from({ length: 5 }, () => givenName(lang, rng, false)),
        f: Array.from({ length: 4 }, () => givenName(lang, rng, true)),
      });
      dynasties.push({
        id: dyn, name: root + rng.pick(['ides', 'ing', 'ar', 'ens', 'ides']), house: `Maison ${deOf(root)}`, founded, founder: '',
        culture, arms: makeArms(rng), motto: motto(rng), countries: [], lineage: [],
      });
    }
    const D = dynasties[dyn];
    const first = D.countries.length === 0;
    D.countries.push(c);
    countryDynasty[c] = dyn;
    arms[c] = D.arms;
    const pool = pools.get(dyn)!;
    const lin = lineage(first ? D.founded : year - rng.int(15, 160), year, pool, femaleChance(culture), tm, tf, first, rng);
    if (first) {
      D.lineage = lin;
      D.founder = lin[0].name;
    }
    const cur = lin[lin.length - 1];
    const female = cur.title === tf;
    const startAge = rng.int(16, 46);
    let age = startAge + (year - cur.from);
    if (age > 88) age = rng.int(70, 86);
    rulers[c] = {
      name: cur.name.replace(/ [IVXL]+(er)?$/, ''), regnal: cur.name, title: female ? tf : tm, female, age, born: year - age, since: cur.from,
      traits: traits(female), portrait: portrait(culture, female, age, seed.form),
    };
  }
  return { dynasties, countryDynasty, rulers, arms };
}

function lineage(from: number, year: number, pool: { m: string[]; f: string[] }, fChance: number, tm: string, tf: string, founder: boolean, rng: Rng): LineageEntry[] {
  const entries: LineageEntry[] = [];
  const counts = new Map<string, number>();
  const raw: { name: string; female: boolean }[] = [];
  let y = from;
  while (y < year) {
    const female = rng.chance(fChance);
    const name = rng.pick(female ? pool.f : pool.m);
    raw.push({ name, female });
    const len = Math.max(1, Math.min(55, Math.round(Math.exp(Math.log(15) + 0.6 * rng.normal()))));
    const to = Math.min(year, y + len);
    entries.push({ name, title: female ? tf : tm, from: y, to, relation: '', fate: '' });
    y = to;
  }
  // numéros de règne (« Ier » pour le premier d'un nom porté plusieurs fois)
  const total = new Map<string, number>();
  for (const r of raw) total.set(r.name, (total.get(r.name) ?? 0) + 1);
  entries.forEach((e, i) => {
    const n = (counts.get(raw[i].name) ?? 0) + 1;
    counts.set(raw[i].name, n);
    if ((total.get(raw[i].name) ?? 1) > 1) e.name = `${raw[i].name} ${n === 1 ? 'Ier' : roman(n)}`;
    if (i === 0) e.relation = founder ? (raw[i].female ? 'fondatrice de la dynastie' : 'fondateur de la dynastie') : 'fondateur de la branche cadette';
    else e.relation = `${weighted(rng, raw[i].female ? SUCC_F : SUCC_M, 1)} ${deOf(entries[i - 1].name)}`;
    if (i < entries.length - 1) {
      const f = weighted(rng, FATES.map((x) => [x[raw[i].female ? 1 : 0], x[2]] as [string, number]), 1);
      e.fate = f;
    }
  });
  return entries;
}
