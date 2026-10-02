import { Rng } from '../rng';
import type { Heraldry, Tincture } from '../types';

const METALS: Tincture[] = ['or', 'argent'];
const COLORS: Tincture[] = ['gueules', 'azur', 'sinople', 'sable', 'pourpre'];
const isMetal = (t: Tincture) => t === 'or' || t === 'argent';

const DIVISIONS: [Heraldry['division'], number][] = [
  ['plain', 0.34], ['parti', 0.08], ['coupe', 0.08], ['tranche', 0.06], ['ecartele', 0.07], ['fasce', 0.08],
  ['pal', 0.06], ['bande', 0.07], ['chevron', 0.07], ['croix', 0.05], ['sautoir', 0.04],
];
const PARTITIONS = new Set(['parti', 'coupe', 'tranche', 'ecartele']);

// meuble : [nom au singulier, pluriel, article « à la / au / à l' »]
const CHARGES: Record<Exclude<Heraldry['charge'], 'none'>, [string, string, string]> = {
  etoile: ['étoile', 'étoiles', "à l'"],
  croissant: ['croissant', 'croissants', 'au '],
  soleil: ['soleil', 'soleils', 'au '],
  tour: ['tour', 'tours', 'à la '],
  epee: ['épée', 'épées', "à l'"],
  couronne: ['couronne', 'couronnes', 'à la '],
  anneau: ['anneau', 'anneaux', "à l'"],
  losange: ['losange', 'losanges', 'au '],
  quartefeuille: ['quartefeuille', 'quartefeuilles', 'à la '],
  cle: ['clé', 'clés', 'à la '],
};
const SMALL = new Set(['etoile', 'anneau', 'losange', 'quartefeuille', 'croissant']);

const ORDINARY_TEXT: Record<string, string> = {
  fasce: 'à la fasce', pal: 'au pal', bande: 'à la bande', chevron: 'au chevron', croix: 'à la croix', sautoir: 'au sautoir',
};
const PARTITION_TEXT: Record<string, string> = { parti: 'Parti', coupe: 'Coupé', tranche: 'Tranché', ecartele: 'Écartelé' };

const de = (t: Tincture) => (/^[aeiou]/.test(t) ? `d'${t}` : `de ${t}`);

/** Armoiries procédurales respectant la règle de contrariété (pas de métal sur métal ni couleur sur couleur). */
export function makeArms(rng: Rng): Heraldry {
  const field: Tincture = rng.chance(0.35) ? rng.pick(METALS) : rng.pick(COLORS);
  const contrast = (t: Tincture): Tincture => (isMetal(t) ? rng.pick(COLORS) : rng.pick(METALS));
  let r = rng.next();
  let division: Heraldry['division'] = 'plain';
  for (const [d, w] of DIVISIONS) {
    r -= w;
    if (r <= 0) {
      division = d;
      break;
    }
  }
  const second = contrast(field);
  const hasCharge = division === 'plain' || rng.chance(0.55);
  const keys = Object.keys(CHARGES) as Exclude<Heraldry['charge'], 'none'>[];
  const charge: Heraldry['charge'] = hasCharge ? rng.pick(keys) : 'none';
  // sur une partition, le meuble « broche » sur deux émaux : on prend le métal si la seconde moitié est une couleur
  let chargeTincture: Tincture = PARTITIONS.has(division) ? (isMetal(second) ? rng.pick(COLORS.filter((c) => c !== 'sable')) : rng.pick(METALS)) : contrast(field);
  if (!PARTITIONS.has(division) && division !== 'plain' && chargeTincture === second) chargeTincture = isMetal(second) ? (second === 'or' ? 'argent' : 'or') : rng.pick(COLORS.filter((c) => c !== second));
  const count: 1 | 3 = charge !== 'none' && SMALL.has(charge) && (division === 'plain' || division === 'fasce' || division === 'chevron') && rng.chance(0.35) ? 3 : 1;
  const arms: Heraldry = { field, division, second, charge, chargeTincture, count, blazon: '' };
  arms.blazon = blazon(arms);
  return arms;
}

function blazon(a: Heraldry): string {
  let s: string;
  if (PARTITIONS.has(a.division)) s = `${PARTITION_TEXT[a.division]} ${de(a.field)} et ${de(a.second)}`;
  else {
    s = de(a.field);
    s = s.charAt(0).toUpperCase() + s.slice(1);
    if (a.division !== 'plain') s += ` ${ORDINARY_TEXT[a.division]} ${de(a.second)}`;
  }
  if (a.charge !== 'none') {
    const [sing, plur, art] = CHARGES[a.charge];
    const meuble = a.count === 3 ? `à trois ${plur}` : `${art}${sing}`;
    const brochant = a.division !== 'plain' && a.count === 1 ? ' brochant sur le tout' : '';
    s += `${a.division === 'plain' ? ' ' : ', '}${meuble} ${de(a.chargeTincture)}${brochant}`;
  }
  return s + '.';
}
