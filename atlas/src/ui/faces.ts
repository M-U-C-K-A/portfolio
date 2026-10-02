import type { CountryInfo, WorldData } from '../gen/types';

/** Styles régionaux des portraits (public/face). */
type Style = 'orient' | 'nordic' | 'occident' | 'african' | 'asian';
type Head = 'crown' | 'turban' | 'helm' | 'none' | 'hat' | 'circlet' | 'veil';

interface Face {
  file: string;
  female: boolean;
  age: 'young' | 'adult' | 'old';
  /** 0 clair, 1 mat, 2 foncé. */
  skin: 0 | 1 | 2;
  style: Style;
  head: Head;
}

// [rang, colonne, sexe, âge, teint, style, couvre-chef] — décrits d'après les planches
const RAW: [number, number, 'm' | 'f', Face['age'], Face['skin'], Style, Head][] = [
  [1, 1, 'm', 'adult', 1, 'orient', 'turban'], [1, 2, 'f', 'adult', 1, 'orient', 'crown'], [1, 3, 'm', 'adult', 1, 'orient', 'crown'],
  [1, 4, 'm', 'adult', 1, 'orient', 'turban'], [1, 5, 'm', 'adult', 1, 'orient', 'crown'], [1, 6, 'm', 'adult', 1, 'orient', 'crown'],
  [1, 7, 'm', 'adult', 1, 'orient', 'turban'], [1, 8, 'm', 'adult', 1, 'orient', 'crown'], [1, 9, 'm', 'adult', 1, 'orient', 'turban'],
  [1, 10, 'm', 'old', 1, 'orient', 'turban'],
  [2, 1, 'm', 'old', 0, 'nordic', 'helm'], [2, 2, 'm', 'adult', 0, 'nordic', 'helm'], [2, 3, 'm', 'adult', 0, 'nordic', 'helm'],
  [2, 4, 'm', 'adult', 0, 'nordic', 'helm'], [2, 5, 'm', 'adult', 0, 'nordic', 'helm'], [2, 6, 'm', 'adult', 0, 'nordic', 'helm'],
  [2, 7, 'm', 'adult', 0, 'nordic', 'helm'], [2, 8, 'm', 'adult', 0, 'nordic', 'helm'], [2, 9, 'm', 'young', 0, 'nordic', 'circlet'],
  [2, 10, 'm', 'adult', 0, 'nordic', 'circlet'],
  [3, 1, 'm', 'adult', 0, 'occident', 'crown'], [3, 2, 'm', 'adult', 0, 'occident', 'crown'], [3, 3, 'm', 'adult', 0, 'occident', 'crown'],
  [3, 4, 'm', 'old', 0, 'occident', 'crown'], [3, 5, 'm', 'young', 0, 'occident', 'crown'], [3, 6, 'm', 'adult', 0, 'occident', 'crown'],
  [3, 7, 'm', 'adult', 0, 'occident', 'crown'], [3, 8, 'm', 'young', 0, 'occident', 'crown'], [3, 9, 'm', 'old', 0, 'occident', 'crown'],
  [3, 10, 'm', 'old', 0, 'occident', 'crown'],
  [4, 1, 'm', 'adult', 2, 'african', 'turban'], [4, 2, 'f', 'adult', 2, 'african', 'veil'], [4, 3, 'm', 'adult', 2, 'african', 'none'],
  [4, 4, 'm', 'old', 2, 'african', 'crown'], [4, 5, 'm', 'adult', 2, 'african', 'none'], [4, 6, 'm', 'adult', 2, 'african', 'hat'],
  [4, 7, 'f', 'adult', 2, 'african', 'circlet'], [4, 8, 'm', 'young', 2, 'african', 'none'], [4, 9, 'm', 'old', 2, 'african', 'none'],
  [4, 10, 'm', 'old', 2, 'african', 'hat'],
  [5, 1, 'm', 'adult', 1, 'asian', 'hat'], [5, 2, 'm', 'adult', 1, 'asian', 'crown'], [5, 3, 'm', 'adult', 1, 'asian', 'crown'],
  [5, 4, 'm', 'adult', 1, 'asian', 'hat'], [5, 5, 'm', 'old', 1, 'asian', 'veil'], [5, 6, 'm', 'old', 1, 'asian', 'hat'],
  [5, 7, 'm', 'adult', 1, 'asian', 'helm'], [5, 8, 'm', 'adult', 1, 'asian', 'hat'], [5, 9, 'm', 'adult', 1, 'asian', 'crown'],
  [5, 10, 'm', 'adult', 1, 'asian', 'crown'],
  [6, 1, 'f', 'adult', 0, 'occident', 'crown'], [6, 2, 'f', 'adult', 0, 'occident', 'crown'], [6, 3, 'f', 'adult', 1, 'occident', 'crown'],
  [6, 4, 'f', 'adult', 0, 'occident', 'crown'], [6, 5, 'f', 'adult', 1, 'occident', 'crown'], [6, 6, 'f', 'adult', 0, 'occident', 'veil'],
  [6, 7, 'f', 'adult', 0, 'occident', 'crown'], [6, 8, 'm', 'old', 0, 'occident', 'crown'], [6, 9, 'm', 'adult', 0, 'occident', 'crown'],
  [6, 10, 'm', 'young', 0, 'occident', 'crown'],
  [7, 1, 'f', 'adult', 0, 'occident', 'circlet'], [7, 2, 'm', 'old', 0, 'occident', 'crown'], [7, 3, 'm', 'old', 0, 'occident', 'crown'],
  [7, 4, 'm', 'old', 0, 'occident', 'crown'], [7, 5, 'm', 'old', 0, 'occident', 'circlet'], [7, 6, 'm', 'old', 0, 'occident', 'none'],
  [7, 7, 'm', 'old', 0, 'occident', 'crown'], [7, 8, 'm', 'old', 0, 'nordic', 'circlet'], [7, 9, 'm', 'young', 0, 'occident', 'crown'],
  [7, 10, 'm', 'young', 0, 'occident', 'crown'],
  [8, 1, 'm', 'adult', 0, 'occident', 'crown'], [8, 2, 'f', 'young', 1, 'occident', 'crown'], [8, 3, 'f', 'young', 0, 'occident', 'crown'],
  [8, 4, 'f', 'young', 0, 'nordic', 'none'], [8, 5, 'f', 'young', 2, 'african', 'crown'], [8, 6, 'f', 'young', 0, 'occident', 'circlet'],
  [8, 7, 'm', 'young', 0, 'occident', 'circlet'], [8, 8, 'm', 'young', 0, 'occident', 'none'], [8, 9, 'm', 'young', 0, 'occident', 'none'],
  [8, 10, 'm', 'young', 0, 'nordic', 'none'],
];

const FACES: Face[] = RAW.map(([r, c, sx, age, skin, style, head]) => ({
  file: `${import.meta.env.BASE_URL}face/row-${r}-column-${c}.png`, female: sx === 'f', age, skin, style, head,
}));

const HEAD_BY_FORM: Record<string, Head[]> = {
  Empire: ['crown'], Royaume: ['crown'], Sultanat: ['turban', 'crown'], Khanat: ['helm', 'hat'], Principauté: ['circlet', 'crown'],
  'Grand-duché': ['circlet', 'crown'], Théocratie: ['veil', 'turban', 'none', 'hat'], République: ['none', 'hat'],
  'Ligue marchande': ['hat', 'none'], Confédération: ['none', 'hat', 'circlet'], Union: ['none', 'circlet'],
};

const hash = (n: number, s: number) => {
  let h = Math.imul(n ^ s, 0x9e3779b1);
  h ^= h >>> 15;
  h = Math.imul(h, 0x85ebca77);
  return ((h ^ (h >>> 13)) >>> 0) / 4294967296;
};

/** Style régional d'une famille culturelle : teint d'après la latitude du foyer, variante par famille. */
function groupStyle(world: WorldData, group: number): { style: Style; skin: number } {
  const pol = world.politics;
  const g = pol.cultureGroups[group];
  const lats = g.cultures.map((c) => {
    const city = pol.cities[pol.cultures[c].hearth];
    return Math.abs(world.latMax - (city.y / world.H) * 2 * world.latMax);
  });
  const lat = lats.reduce((a, b) => a + b, 0) / Math.max(1, lats.length);
  const r = hash(group, 7331);
  if (lat < 16) return { style: r < 0.8 ? 'african' : 'orient', skin: 2 };
  if (lat < 34) return { style: r < 0.55 ? 'orient' : r < 0.85 ? 'asian' : 'african', skin: 1 };
  if (lat < 50) return { style: r < 0.6 ? 'occident' : r < 0.8 ? 'asian' : 'orient', skin: 0.5 };
  return { style: r < 0.55 ? 'nordic' : 'occident', skin: 0 };
}

const cache = new WeakMap<WorldData, string[]>();

/** Portrait (fichier) de chaque dirigeant : sexe, âge, style régional, régime ; on évite les doublons. */
export function rulerFaces(world: WorldData): string[] {
  const hit = cache.get(world);
  if (hit) return hit;
  const pol = world.politics;
  const used = new Map<string, number>();
  const out: string[] = [];
  const order = [...pol.countries].sort((a, b) => b.pop - a.pop);
  const byId: string[] = [];
  for (const c of order) {
    const f = pickFace(world, c, used);
    used.set(f, (used.get(f) ?? 0) + 1);
    byId[c.id] = f;
  }
  for (let i = 0; i < pol.countries.length; i++) out.push(byId[i]);
  cache.set(world, out);
  return out;
}

function pickFace(world: WorldData, c: CountryInfo, used: Map<string, number>): string {
  const r = c.ruler;
  const group = world.politics.cultures[c.culture]?.group ?? 0;
  const { style, skin } = groupStyle(world, group);
  const age = r.age < 24 ? 'young' : r.age >= 58 ? 'old' : 'adult';
  const heads = HEAD_BY_FORM[c.form] ?? ['crown'];
  let best = FACES[0], bs = -Infinity;
  FACES.forEach((f, i) => {
    let s = 0;
    s += f.female === r.female ? 100 : -100;
    s += f.style === style ? 40 : 0;
    s -= Math.abs(f.skin / 2 - skin) * 40;
    s += f.age === age ? 25 : f.age === 'adult' ? 8 : -10;
    const hi = heads.indexOf(f.head);
    s += hi === 0 ? 18 : hi > 0 ? 10 : 0;
    s -= (used.get(f.file) ?? 0) * 14;
    s += hash(i, r.portrait.seed) * 6;
    if (s > bs) {
      bs = s;
      best = f;
    }
  });
  return best.file;
}
