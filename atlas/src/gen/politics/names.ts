import { Rng } from '../rng';

const ONSETS_SIMPLE = ['b', 'c', 'd', 'f', 'g', 'h', 'k', 'l', 'm', 'n', 'p', 'r', 's', 't', 'v', 'z', 'j'];
const ONSETS_COMPLEX = ['br', 'dr', 'gr', 'kr', 'tr', 'st', 'sk', 'sh', 'ch', 'th', 'kh', 'gl', 'pl', 'vr', 'zh', 'qu', 'fr', 'bl', 'sv', 'ph', 'gw'];
const VOWELS_SIMPLE = ['a', 'e', 'i', 'o', 'u'];
const VOWELS_COMPLEX = ['ae', 'ai', 'au', 'ei', 'ia', 'io', 'ou', 'y', 'ea', 'oa', 'ie', 'ua'];
const CODAS = ['n', 'r', 'l', 's', 'm', 'th', 'nd', 'rn', 'rd', 'st', 'k', 'x', 'sh', 'ng', 'lt', 'rk', 'ld', 'nt', 'z', 'v', 'sk', 'ss'];
const COUNTRY_SUFFIXES = ['ie', 'ia', 'ande', 'or', 'ar', 'ène', 'istan', 'ane', 'onie', 'orie', 'a', 'ul', 'ès', 'ium', 'enne', 'ard'];

/** Phonologie simplifiée d'une langue fictive. */
export interface Language {
  onsets: string[];
  vowels: string[];
  codas: string[];
  codaChance: number;
  maxSyl: number;
  /** Morphèmes fréquents en fin de toponyme (comme -bourg, -ville, -stadt). */
  placeSuffixes: string[];
  countrySuffixes: string[];
}

export function makeLanguage(rng: Rng): Language {
  const pick = <T>(arr: T[], n: number): T[] => rng.shuffle([...arr]).slice(0, n);
  const lang: Language = {
    onsets: [...pick(ONSETS_SIMPLE, rng.int(6, 11)), ...pick(ONSETS_COMPLEX, rng.int(0, 5))],
    vowels: [...pick(VOWELS_SIMPLE, rng.int(3, 5)), ...pick(VOWELS_COMPLEX, rng.int(0, 3))],
    codas: pick(CODAS, rng.int(2, 7)),
    codaChance: rng.range(0.15, 0.55),
    maxSyl: rng.int(2, 3),
    placeSuffixes: [],
    countrySuffixes: pick(COUNTRY_SUFFIXES, rng.int(2, 3)),
  };
  const n = rng.int(3, 5);
  for (let i = 0; i < n; i++) lang.placeSuffixes.push(syllable(lang, rng, true));
  return lang;
}

/** Dialecte : même famille, quelques sons et suffixes différents. */
export function mutateLanguage(base: Language, rng: Rng): Language {
  const l: Language = {
    onsets: [...base.onsets],
    vowels: [...base.vowels],
    codas: [...base.codas],
    codaChance: Math.min(0.7, Math.max(0.1, base.codaChance + rng.range(-0.1, 0.1))),
    maxSyl: base.maxSyl,
    placeSuffixes: base.placeSuffixes.slice(0, rng.int(1, 2)),
    countrySuffixes: [...base.countrySuffixes],
  };
  for (let i = rng.int(1, 3); i > 0; i--) l.onsets[rng.int(0, l.onsets.length - 1)] = rng.pick(rng.chance(0.7) ? ONSETS_SIMPLE : ONSETS_COMPLEX);
  if (rng.chance(0.5)) l.vowels[rng.int(0, l.vowels.length - 1)] = rng.pick(VOWELS_COMPLEX);
  if (rng.chance(0.5)) l.codas[rng.int(0, l.codas.length - 1)] = rng.pick(CODAS);
  if (rng.chance(0.4)) l.countrySuffixes[0] = rng.pick(COUNTRY_SUFFIXES);
  while (l.placeSuffixes.length < 4) l.placeSuffixes.push(syllable(l, rng, true));
  return l;
}

function syllable(l: Language, rng: Rng, forceCoda = false): string {
  let s = '';
  if (rng.chance(0.85)) s += rng.pick(l.onsets);
  s += rng.pick(l.vowels);
  if (forceCoda || rng.chance(l.codaChance)) s += rng.pick(l.codas);
  return s;
}

function tidy(w: string): string {
  return w
    .replace(/(.)\1\1+/g, '$1$1')
    .replace(/[bcdfghjklmnpqrstvwxz]{3,}/g, (m) => m.slice(0, 2))
    .replace(/[aeiouy]{3,}/g, (m) => m.slice(0, 2))
    .replace(/q(?!u)/g, 'qu')
    .replace(/^(.)\1/, '$1');
}

const cap = (w: string): string => w.charAt(0).toUpperCase() + w.slice(1);

export function makeWord(l: Language, rng: Rng, syl?: number): string {
  const n = syl ?? rng.int(1, l.maxSyl);
  let w = '';
  for (let i = 0; i < n; i++) w += syllable(l, rng);
  return tidy(w);
}

export function placeName(l: Language, rng: Rng): string {
  let w = makeWord(l, rng, rng.int(1, 2));
  if (rng.chance(0.45)) w += rng.pick(l.placeSuffixes);
  else if (w.length < 4) w += syllable(l, rng);
  w = tidy(w);
  if (w.length > 11) w = w.slice(0, 9 + rng.int(0, 2));
  return cap(w);
}

export function countryName(l: Language, rng: Rng): string {
  let root = makeWord(l, rng, rng.int(1, 2));
  if (root.length > 7) root = root.slice(0, 7);
  const suf = rng.pick(l.countrySuffixes);
  // élision : racine terminée par une voyelle + suffixe commençant par une voyelle
  if (/[aeiouy]$/.test(root) && /^[aeiouyè]/.test(suf)) root = root.slice(0, -1);
  return cap(tidy(root + suf));
}

export interface GovForm {
  label: string;
  weight: number;
  /** Réservé aux États les plus étendus. */
  large?: boolean;
  small?: boolean;
}

export const GOV_FORMS: GovForm[] = [
  { label: 'Empire', weight: 3, large: true },
  { label: 'Royaume', weight: 10 },
  { label: 'République', weight: 8 },
  { label: 'Principauté', weight: 3, small: true },
  { label: 'Grand-duché', weight: 2, small: true },
  { label: 'Sultanat', weight: 3 },
  { label: 'Khanat', weight: 2 },
  { label: 'Confédération', weight: 2 },
  { label: 'Théocratie', weight: 2 },
  { label: 'Ligue marchande', weight: 2, small: true },
  { label: 'Union', weight: 2 },
];

export function pickGovForm(rng: Rng, sizeRank: number): GovForm {
  const pool = GOV_FORMS.filter((f) => (f.large ? sizeRank < 0.12 : true) && (f.small ? sizeRank > 0.4 : true));
  let total = 0;
  for (const f of pool) total += f.weight;
  let r = rng.next() * total;
  for (const f of pool) {
    r -= f.weight;
    if (r <= 0) return f;
  }
  return pool[0];
}

export function officialName(form: string, name: string): string {
  return `${form} ${/^[aeiouyéèêâh]/i.test(name) ? "d'" : 'de '}${name}`;
}

/** Garantit l'unicité des noms dans un monde. */
export class NameRegistry {
  private readonly used = new Set<string>();

  unique(gen: () => string): string {
    for (let i = 0; i < 30; i++) {
      const n = gen();
      if (n.length >= 3 && !this.used.has(n)) {
        this.used.add(n);
        return n;
      }
    }
    const n = gen() + 'a';
    this.used.add(n);
    return n;
  }
}

const DEMONYMS: [string, string][] = [
  ['ois', 'oise'], ['ien', 'ienne'], ['ais', 'aise'], ['an', 'ane'], ['ite', 'ite'], ['i', 'ie'],
  ['ain', 'aine'], ['éen', 'éenne'], ['ique', 'ique'], ['in', 'ine'], ['ote', 'ote'],
];

/** Gentilé d'un peuple : adjectifs masculin et féminin (« valdois », « valdoise »). */
export function demonym(l: Language, rng: Rng): { m: string; f: string; root: string } {
  let root = '';
  // racine d'au moins trois lettres terminée par une consonne (évite « Ois », « Fin »…)
  for (let i = 0; i < 12 && root.length < 3; i++) {
    root = makeWord(l, rng, 2).replace(/[aeiouy]+$/, '');
    if (root.length > 7) root = root.slice(0, 7).replace(/[aeiouy]+$/, '');
  }
  if (root.length < 3) root += rng.pick(l.onsets.filter((o) => o.length === 1)) ?? 'r';
  const [sm, sf] = rng.pick(DEMONYMS);
  return { m: tidy(root + sm), f: tidy(root + sf), root };
}

/** Prénom dans la langue donnée ; les prénoms féminins prennent une terminaison vocalique. */
export function givenName(l: Language, rng: Rng, female: boolean): string {
  let w = makeWord(l, rng, rng.int(1, 2));
  for (let i = 0; i < 8 && w.length < 3; i++) w = makeWord(l, rng, 2);
  if (w.length > 7) w = w.slice(0, 7);
  if (female) w = w.replace(/[aeiouy]+$/, '') + rng.pick(['a', 'e', 'ia', 'ine', 'elle', 'ys', 'wen', 'a']);
  else if (/[aeiouy]$/.test(w) && rng.chance(0.6)) w += rng.pick(l.codas.length ? l.codas : ['n']);
  return cap(tidy(w));
}

export function roman(n: number): string {
  const t: [number, string][] = [[10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
  let s = '';
  for (const [v, r] of t) while (n >= v) {
    s += r;
    n -= v;
  }
  return s;
}

export const capitalize = cap;

/** « de » ou « d' » devant un nom. */
export const deOf = (name: string): string => (/^[aeiouyéèêâh]/i.test(name) ? "d'" : 'de ') + name;

const ARTICLES: Record<string, string> = {
  Foi: 'la', Église: "l'", Culte: 'le', Panthéon: 'le', Anciens: 'les', Voie: 'la', Enseignements: 'les', Doctrine: 'la',
  Flamme: 'la', Temple: 'le', Traditions: 'les', Réforme: 'la', Rite: 'le', Famille: 'la', Maison: 'la',
};

/** Nom précédé de son article (« le Kesharisme », « la Foi d'Asha », « l'Église de l'Aube »). */
export function withArticle(name: string): string {
  const a = ARTICLES[name.split(' ')[0]] ?? (/^[aeiouyéèêh]/i.test(name) ? "l'" : 'le');
  return a.endsWith("'") ? a + name : `${a} ${name}`;
}

/** Complément introduit par « de » avec contraction (« du », « des », « de la », « de l' »). */
export function ofArticle(name: string): string {
  const a = withArticle(name);
  if (a.startsWith('le ')) return 'du ' + a.slice(3);
  if (a.startsWith('les ')) return 'des ' + a.slice(4);
  return 'de ' + a;
}

/** Complément introduit par « à » avec contraction (« au », « aux », « à la », « à l' »). */
export function toArticle(name: string): string {
  const a = withArticle(name);
  if (a.startsWith('le ')) return 'au ' + a.slice(3);
  if (a.startsWith('les ')) return 'aux ' + a.slice(4);
  return 'à ' + a;
}

/** Énumération française : « A », « A et B », « A, B et C ». */
export function listFr(items: string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} et ${items[items.length - 1]}`;
}

/** Pluriel simple d'un gentilé ou d'un adjectif. */
export const pluralFr = (w: string): string => (/[sx]$/.test(w) ? w : w + 's');
