import type { Heraldry, Tincture } from '../gen/types';

export const TINCTURES: Record<Tincture, string> = {
  or: '#d4af37',
  argent: '#e9e8e2',
  gueules: '#b3261e',
  azur: '#1f4e9c',
  sinople: '#2f7a3a',
  sable: '#1d1b19',
  pourpre: '#6b2d73',
};

const SHIELD = 'M6,6 H94 V52 C94,86 72,104 50,114 C28,104 6,86 6,52 Z';
let uid = 0;

/** Meuble dessiné dans une boîte ~36×36 centrée sur l'origine. */
function charge(kind: Heraldry['charge'], fill: string, id: string): string {
  const st = 'stroke="#1a140c" stroke-width="1.2" stroke-linejoin="round"';
  switch (kind) {
    case 'etoile': {
      const pts: string[] = [];
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        const r = i % 2 ? 7 : 17;
        pts.push(`${(Math.cos(a) * r).toFixed(1)},${(Math.sin(a) * r).toFixed(1)}`);
      }
      return `<polygon points="${pts.join(' ')}" fill="${fill}" ${st}/>`;
    }
    case 'croissant':
      return `<mask id="m${id}"><rect x="-20" y="-20" width="40" height="40" fill="#fff"/><circle cx="0" cy="-4" r="12" fill="#000"/></mask>
        <circle cx="0" cy="2" r="15" fill="${fill}" mask="url(#m${id})"/><circle cx="0" cy="2" r="15" fill="none" ${st} mask="url(#m${id})"/>`;
    case 'soleil': {
      let rays = '';
      for (let i = 0; i < 12; i++) {
        const a = (i * Math.PI) / 6;
        const p = (r: number, da: number) => `${(Math.cos(a + da) * r).toFixed(1)},${(Math.sin(a + da) * r).toFixed(1)}`;
        rays += `<polygon points="${p(10, -0.2)} ${p(18, 0)} ${p(10, 0.2)}" fill="${fill}" ${st}/>`;
      }
      return `${rays}<circle r="10" fill="${fill}" ${st}/>`;
    }
    case 'tour':
      return `<path d="M-13,-6 V-16 H-8 V-11 H-3 V-16 H3 V-11 H8 V-16 H13 V-6 H10 V17 H-10 V-6 Z" fill="${fill}" ${st}/><path d="M-4,17 V9 A4,4 0 0 1 4,9 V17" fill="#1a140c" opacity="0.55"/>`;
    case 'epee':
      return `<path d="M-2.6,-6 H2.6 V9 L0,15 L-2.6,9 Z" fill="${fill}" ${st}/><rect x="-10" y="-10" width="20" height="4" rx="1" fill="${fill}" ${st}/><rect x="-1.6" y="-17" width="3.2" height="7" fill="${fill}" ${st}/><circle cy="-18" r="2.6" fill="${fill}" ${st}/>`;
    case 'couronne':
      return `<path d="M-15,7 L-15,-7 L-8,1 L0,-11 L8,1 L15,-7 L15,7 Z" fill="${fill}" ${st}/><rect x="-15" y="7" width="30" height="6" fill="${fill}" ${st}/><circle cx="-15" cy="-8" r="2.2" fill="${fill}" ${st}/><circle cy="-12" r="2.2" fill="${fill}" ${st}/><circle cx="15" cy="-8" r="2.2" fill="${fill}" ${st}/>`;
    case 'anneau':
      return `<circle r="12" fill="none" stroke="#1a140c" stroke-width="7.5"/><circle r="12" fill="none" stroke="${fill}" stroke-width="5"/>`;
    case 'losange':
      return `<polygon points="0,-17 12,0 0,17 -12,0" fill="${fill}" ${st}/>`;
    case 'quartefeuille':
      return `<circle cx="-7" r="7" fill="${fill}" ${st}/><circle cx="7" r="7" fill="${fill}" ${st}/><circle cy="-7" r="7" fill="${fill}" ${st}/><circle cy="7" r="7" fill="${fill}" ${st}/><circle r="4" fill="${fill}" ${st}/>`;
    case 'cle':
      return `<circle cy="-11" r="6" fill="none" stroke="#1a140c" stroke-width="4.5"/><circle cy="-11" r="6" fill="none" stroke="${fill}" stroke-width="2.6"/><rect x="-1.8" y="-5" width="3.6" height="21" fill="${fill}" ${st}/><rect x="1.8" y="9" width="6" height="3" fill="${fill}" ${st}/><rect x="1.8" y="13.5" width="4.5" height="3" fill="${fill}" ${st}/>`;
    default:
      return '';
  }
}

function division(a: Heraldry): string {
  const c = TINCTURES[a.second];
  switch (a.division) {
    case 'parti': return `<rect x="50" y="0" width="60" height="120" fill="${c}"/>`;
    case 'coupe': return `<rect x="0" y="58" width="100" height="70" fill="${c}"/>`;
    case 'tranche': return `<polygon points="0,0 100,120 0,120" fill="${c}"/>`;
    case 'ecartele': return `<rect x="50" y="0" width="60" height="58" fill="${c}"/><rect x="0" y="58" width="50" height="70" fill="${c}"/>`;
    case 'fasce': return `<rect x="0" y="42" width="100" height="30" fill="${c}"/>`;
    case 'pal': return `<rect x="36" y="0" width="28" height="120" fill="${c}"/>`;
    case 'bande': return `<rect x="-30" y="46" width="170" height="24" fill="${c}" transform="rotate(48 50 58)"/>`;
    case 'chevron': return `<path d="M-4,104 L50,48 L104,104" fill="none" stroke="${c}" stroke-width="20"/>`;
    case 'croix': return `<rect x="40" y="0" width="20" height="120" fill="${c}"/><rect x="0" y="44" width="100" height="20" fill="${c}"/>`;
    case 'sautoir': return `<rect x="-30" y="48" width="170" height="18" fill="${c}" transform="rotate(48 50 57)"/><rect x="-30" y="48" width="170" height="18" fill="${c}" transform="rotate(-48 50 57)"/>`;
    default: return '';
  }
}

/** Écu en SVG (100×120 unités). */
export function armsSvg(a: Heraldry, width = 48): string {
  const id = `h${++uid}`;
  const fill = TINCTURES[a.chargeTincture];
  const spots: [number, number, number][] = a.count === 3 ? [[30, 30, 0.55], [70, 30, 0.55], [50, 80, 0.55]] : [[50, 56, a.division === 'plain' ? 1.35 : 1]];
  const charges = a.charge === 'none' ? '' : spots.map(([x, y, s], k) => `<g transform="translate(${x} ${y}) scale(${s})">${charge(a.charge, fill, `${id}${k}`)}</g>`).join('');
  return `<svg class="arms" viewBox="0 0 100 120" width="${width}" height="${(width * 1.2).toFixed(0)}" role="img" aria-label="${a.blazon.replace(/"/g, '')}">
  <defs>
    <clipPath id="c${id}"><path d="${SHIELD}"/></clipPath>
    <linearGradient id="g${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0.32"/><stop offset="0.45" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.35"/></linearGradient>
  </defs>
  <g clip-path="url(#c${id})"><rect width="100" height="120" fill="${TINCTURES[a.field]}"/>${division(a)}${charges}<rect width="100" height="120" fill="url(#g${id})"/></g>
  <path d="${SHIELD}" fill="none" stroke="#2a1f10" stroke-width="3"/><path d="${SHIELD}" fill="none" stroke="#d6b35a" stroke-width="1" opacity="0.7"/>
</svg>`;
}
