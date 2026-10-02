import { Rng } from '../rng';
import type { CountryEvent, CultureInfo, DynastyInfo, ReligionInfo, RulerInfo } from '../types';
import { capitalize, deOf, listFr, ofArticle, pluralFr, toArticle, withArticle } from './names';

const FEMININE_FORMS = new Set(['Principauté', 'Théocratie', 'République', 'Ligue marchande', 'Confédération', 'Union']);

export interface LoreCountry {
  id: number;
  name: string;
  form: string;
  capitalName: string;
  pop: number;
  culture: number;
  religion: number;
  dynasty: number;
  ruler: RulerInfo;
  neighbors: number[];
  cultureShares: { id: number; share: number }[];
  religionShares: { id: number; share: number }[];
  bigCities: string[];
  mountainous: boolean;
  riverine: boolean;
}

export interface LoreResult {
  founded: number[];
  allies: number[][];
  rivals: number[][];
  unions: number[][];
  events: CountryEvent[][];
  history: string[];
}

const plural = pluralFr;
/** « le royaume », « l'empire », « la république »… */
const formWithArticle = (form: string): string => {
  const f = form.toLowerCase();
  return /^[aeiouyéèêh]/.test(f) ? `l'${f}` : FEMININE_FORMS.has(form) ? `la ${f}` : `le ${f}`;
};
const formOf = (form: string): string => {
  const a = formWithArticle(form);
  return a.startsWith('le ') ? 'du ' + a.slice(3) : 'de ' + a;
};
const fmt = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1).replace('.', ',')} millions` : `${Math.round(n / 1000)} 000`);

/**
 * Chroniques : relations diplomatiques déduites des affinités (religion, famille culturelle, dynastie),
 * frise d'événements et récit de chaque État.
 */
export function buildLore(
  cs: LoreCountry[],
  cultures: CultureInfo[],
  religions: ReligionInfo[],
  dynasties: DynastyInfo[],
  year: number,
  rng: Rng,
): LoreResult {
  const C = cs.length;
  const rootRel = (r: number) => (r >= 0 && religions[r].parent >= 0 ? religions[r].parent : r);
  const group = (c: number) => (cs[c].culture >= 0 ? cultures[cs[c].culture].group : -1);

  // --- fondation ---
  const founded = cs.map((c) => {
    const d = c.dynasty >= 0 ? dynasties[c.dynasty].founded : year;
    return Math.min(d - rng.int(0, 120), year - rng.int(25, 700));
  });

  // --- diplomatie ---
  const allies: number[][] = Array.from({ length: C }, () => []);
  const rivals: number[][] = Array.from({ length: C }, () => []);
  const unions: number[][] = Array.from({ length: C }, () => []);
  for (let a = 0; a < C; a++) {
    if (cs[a].dynasty >= 0) for (const b of dynasties[cs[a].dynasty].countries) if (b !== a) unions[a].push(b);
    const scored = cs[a].neighbors.map((b) => {
      let s = rng.range(-1, 1);
      s += cs[a].religion === cs[b].religion ? 2 : rootRel(cs[a].religion) === rootRel(cs[b].religion) ? 0.5 : -1.2;
      s += group(a) === group(b) ? 0.8 : -0.6;
      if (cs[a].dynasty >= 0 && cs[a].dynasty === cs[b].dynasty) s += 3;
      // les grands voisins se méfient l'un de l'autre
      s -= 0.4 * Math.log10(1 + Math.min(cs[a].pop, cs[b].pop) / 5e6);
      return { b, s };
    });
    scored.sort((x, y) => y.s - x.s);
    for (const { b, s } of scored) if (s > 1.4 && allies[a].length < 2) allies[a].push(b);
    for (const { b, s } of [...scored].reverse()) if (s < -0.8 && rivals[a].length < 2) rivals[a].push(b);
  }
  // relations symétriques
  for (let a = 0; a < C; a++) {
    for (const b of allies[a]) if (!allies[b].includes(a) && allies[b].length < 3) allies[b].push(a);
    for (const b of rivals[a]) if (!rivals[b].includes(a) && rivals[b].length < 3) rivals[b].push(a);
  }

  // --- événements & récit ---
  const events: CountryEvent[][] = [];
  const history: string[] = [];
  for (let a = 0; a < C; a++) {
    const c = cs[a];
    const ev: CountryEvent[] = [];
    const f0 = founded[a];
    const at = (lo: number, hi: number) => rng.int(Math.min(lo, hi), Math.max(lo, hi));
    const fem = FEMININE_FORMS.has(c.form);
    ev.push({ year: f0, text: `Fondation ${formOf(c.form)} autour ${deOf(c.capitalName)}.` });
    if (c.dynasty >= 0) {
      const d = dynasties[c.dynasty];
      const house = d.house.replace(/^Maison/, 'maison');
      if (d.countries[0] === a && d.founded > f0) ev.push({ year: d.founded, text: `Avènement de la ${house} avec ${d.founder}.` });
      else if (d.countries[0] !== a) ev.push({ year: c.ruler.since - at(0, 40), text: `Une branche cadette de la ${house} monte sur le trône.` });
    }
    const rel = religions[c.religion];
    if (rel && !rel.folk) ev.push({ year: Math.max(f0, rel.founded) + at(5, 120), text: `Adoption ${ofArticle(rel.name)} comme religion d'État.` });
    // guerres, révoltes, mariages et changements de frontières : ajoutés par la frise historique (history.ts)
    for (const u of unions[a].slice(0, 1)) ev.push({ year: at(Math.max(f0, year - 120), year - 1), text: `Union dynastique avec ${cs[u].name}.` });
    if (rng.chance(0.5)) ev.push({ year: at(f0, year - 1), text: rng.pick(['Grande peste : un sujet sur cinq périt.', 'Famine des trois hivers.', 'Grand incendie de la capitale.']) });
    if (c.mountainous && rng.chance(0.5)) ev.push({ year: at(f0, year - 1), text: 'Un séisme ravage les vallées de montagne.' });
    if (c.riverine && rng.chance(0.5)) ev.push({ year: at(f0, year - 1), text: 'Crue centennale du grand fleuve.' });
    if (c.bigCities.length > 1 && rng.chance(0.6)) ev.push({ year: at(f0 + 30, year - 1), text: `Construction de la grande route ${deOf(c.capitalName)} à ${c.bigCities[1]}.` });
    if (rng.chance(0.4)) ev.push({ year: at(f0 + 50, year - 1), text: `Fondation de l'université ${deOf(rng.pick(c.bigCities.length ? c.bigCities : [c.capitalName]))}.` });
    ev.push({ year: c.ruler.since, text: `${c.ruler.title} ${c.ruler.regnal} ${c.dynasty >= 0 ? 'monte sur le trône' : c.ruler.female ? "est élue à la tête de l'État" : "est élu à la tête de l'État"}.` });
    ev.sort((x, y) => x.year - y.year);
    events.push(ev);

    // récit
    const cult = cultures[c.culture];
    const parts: string[] = [];
    parts.push(`${capitalize(formWithArticle(c.form))} ${deOf(c.name)} a été fondé${fem ? 'e' : ''} en l'an ${f0} autour ${deOf(c.capitalName)}.`);
    if (cult) {
      const main = c.cultureShares[0];
      const minors = c.cultureShares.slice(1).filter((s) => s.share > 0.04).slice(0, 2).map((s) => plural(cultures[s.id].adjF));
      const pct = Math.round(main.share * 100);
      parts.push(
        main.share >= 0.5
          ? `Ses ${fmt(c.pop)} d'habitants sont en majorité ${plural(cultures[main.id].adjM)} (${pct} %)${minors.length ? `, avec des minorités ${listFr(minors)}` : ''}.`
          : `Ses ${fmt(c.pop)} d'habitants forment une mosaïque de peuples dominée par les ${plural(cultures[main.id].name)} (${pct} %)${minors.length ? `, aux côtés de minorités ${listFr(minors)}` : ''}.`,
      );
    }
    if (rel) {
      const other = c.religionShares.find((s) => s.id !== c.religion && s.share > 0.15);
      parts.push(`L'État professe ${withArticle(rel.name)}${other ? `, mais ${Math.round(other.share * 100)} % des sujets restent fidèles ${toArticle(religions[other.id].name)}` : ''}.`);
    }
    const tr = listFr(c.ruler.traits.map((x) => x.toLowerCase()));
    if (c.dynasty >= 0) {
      const d = dynasties[c.dynasty];
      parts.push(`${c.ruler.female ? 'La souveraine, la' : 'Le souverain, le'} ${c.ruler.title.toLowerCase()} ${c.ruler.regnal} de la ${d.house.replace(/^Maison/, 'maison')}, règne depuis ${c.ruler.since} ; on ${c.ruler.female ? 'la' : 'le'} dit ${tr}.`);
    } else {
      parts.push(`${c.ruler.female ? 'Élue' : 'Élu'} en ${c.ruler.since}, ${c.ruler.female ? 'la' : 'le'} ${c.ruler.title.toLowerCase()} ${c.ruler.name} passe pour ${tr}.`);
    }
    const allyNames = allies[a].map((b) => cs[b].name);
    const rivalNames = rivals[a].map((b) => cs[b].name);
    if (allyNames.length || rivalNames.length) {
      const pron = fem ? 'elle' : 'il';
      let sentence = allyNames.length ? `Allié${fem ? 'e' : ''} ${listFr(allyNames.map(deOf))}` : '';
      if (rivalNames.length) {
        sentence += `${sentence ? `, ${pron}` : capitalize(pron)} voit en ${listFr(rivalNames)} ${rivalNames.length > 1 ? 'ses rivaux héréditaires' : 'son rival héréditaire'}`;
      }
      parts.push(sentence + '.');
    }
    history.push(parts.join(' '));
  }
  return { founded, allies, rivals, unions, events, history };
}
