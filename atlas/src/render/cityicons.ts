import type { CityInfo, WorldData } from '../gen/types';

/**
 * Icônes de villes façon carte ancienne : petites maisons en perspective cavalière.
 * - toits teintés aux couleurs du pays, forme selon le peuple (pignon, croupe, avant-toits relevés,
 *   terrasses au désert), colombages dans les pays froids ;
 * - lieu de culte selon la religion (clocher, dôme et minaret, pagode, ziggourat) ;
 * - capitales : château et bannière, très grandes capitales avec double enceinte ;
 * - villes côtières : quai, navire amarré et phare du côté de la mer ;
 * - arbres (feuillus, conifères) autour des bourgs.
 * Chaque icône est dessinée une fois par taille dans un petit canevas, puis simplement recopiée.
 */

type RoofShape = 'gable' | 'hip' | 'curved' | 'flat';
type TempleStyle = 'spire' | 'dome' | 'pagoda' | 'ziggurat';

interface Style {
  roofs: string[];
  wall: string;
  wallShade: string;
  ink: string;
  shape: RoofShape;
  timber: boolean;
  temple: TempleStyle;
  trees: 'leaf' | 'conifer' | 'palm' | 'none';
}

function mulberry(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const hex = (h: string): [number, number, number] => {
  const n = parseInt(h.slice(1), 16);
  return [n >> 16, (n >> 8) & 255, n & 255];
};
const css = (c: [number, number, number]) => `rgb(${c.map((v) => Math.max(0, Math.min(255, Math.round(v)))).join(', ')})`;
function shade(col: string, k: number): string {
  const c = col.startsWith('#') ? hex(col) : (col.match(/\d+/g)!.map(Number) as [number, number, number]);
  return css([c[0] * k, c[1] * k, c[2] * k]);
}
function mix(a: [number, number, number], b: [number, number, number], t: number): [number, number, number] {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

// ---------- éléments ----------
function box(g: CanvasRenderingContext2D, st: Style, L: number, y: number, w: number, h: number, d: number, wall = st.wall, side = st.wallShade): void {
  const dy = d * 0.45;
  g.beginPath();
  g.moveTo(L + w, y);
  g.lineTo(L + w + d, y - dy);
  g.lineTo(L + w + d, y - h - dy);
  g.lineTo(L + w, y - h);
  g.closePath();
  g.fillStyle = side;
  g.fill();
  g.stroke();
  g.beginPath();
  g.rect(L, y - h, w, h);
  g.fillStyle = wall;
  g.fill();
  g.stroke();
}

/** Une maison : façade, flanc, toit (selon la forme), fenêtres, cheminée. (x, y) = milieu du bas de la façade. */
function house(g: CanvasRenderingContext2D, st: Style, x: number, y: number, u: number, roof: string, tall: number, rnd: () => number): void {
  const w = 5.6 * u, hw = 3.4 * u * tall, d = 2.2 * u, dy = d * 0.45;
  const L = x - w / 2, Rr = x + w / 2;
  g.lineJoin = 'round';
  g.lineWidth = Math.max(0.7, 0.3 * u);
  g.strokeStyle = st.ink;
  box(g, st, L, y, w, hw, d);
  if (st.timber) {
    g.save();
    g.lineWidth = Math.max(0.5, 0.22 * u);
    g.strokeStyle = 'rgba(70, 48, 30, 0.85)';
    g.beginPath();
    g.moveTo(L, y - hw * 0.5);
    g.lineTo(Rr, y - hw * 0.5);
    g.moveTo(L + w * 0.33, y - hw);
    g.lineTo(L + w * 0.33, y);
    g.moveTo(L + w * 0.66, y - hw);
    g.lineTo(L + w * 0.66, y - hw * 0.5);
    g.moveTo(L, y - hw);
    g.lineTo(L + w * 0.33, y - hw * 0.5);
    g.stroke();
    g.restore();
  }
  const top = y - hw;
  const rh = st.shape === 'gable' && st.timber ? 3.8 * u : 3 * u;
  const o = 0.4 * u;
  if (st.shape === 'flat') {
    g.beginPath();
    g.moveTo(L - 0.3 * u, top);
    g.lineTo(Rr + 0.3 * u, top);
    g.lineTo(Rr + d + 0.3 * u, top - dy);
    g.lineTo(L + d - 0.3 * u, top - dy);
    g.closePath();
    g.fillStyle = shade(roof, 0.95);
    g.fill();
    g.stroke();
    g.fillStyle = st.wall;
    g.fillRect(L - 0.3 * u, top - 0.6 * u, w + 0.6 * u, 0.6 * u);
    g.strokeRect(L - 0.3 * u, top - 0.6 * u, w + 0.6 * u, 0.6 * u);
  } else if (st.shape === 'hip') {
    // toit en croupe : faîtage court, pans en trapèze
    g.beginPath();
    g.moveTo(x - 1.2 * u + d * 0.5, top - rh - dy * 0.5);
    g.lineTo(x + 1.2 * u + d * 0.5, top - rh - dy * 0.5);
    g.lineTo(Rr + d + o, top - dy);
    g.lineTo(Rr + o, top + 0.1 * u);
    g.closePath();
    g.fillStyle = shade(roof, 0.78);
    g.fill();
    g.stroke();
    g.beginPath();
    g.moveTo(L - o, top + 0.1 * u);
    g.lineTo(x - 1.2 * u + d * 0.5, top - rh - dy * 0.5);
    g.lineTo(x + 1.2 * u + d * 0.5, top - rh - dy * 0.5);
    g.lineTo(Rr + o, top + 0.1 * u);
    g.closePath();
    g.fillStyle = roof;
    g.fill();
    g.stroke();
  } else {
    const curved = st.shape === 'curved';
    g.beginPath();
    g.moveTo(x, top - rh);
    g.lineTo(x + d, top - rh - dy);
    g.lineTo(Rr + d + o, top - dy + 0.1 * u);
    g.lineTo(Rr + o, top + 0.1 * u);
    g.closePath();
    g.fillStyle = shade(roof, 0.78);
    g.fill();
    g.stroke();
    g.beginPath();
    if (curved) {
      // avant-toits relevés
      g.moveTo(L - o - 0.9 * u, top - 0.7 * u);
      g.quadraticCurveTo(L + 0.4 * u, top - 0.2 * u, x, top - rh);
      g.quadraticCurveTo(Rr - 0.4 * u, top - 0.2 * u, Rr + o + 0.9 * u, top - 0.7 * u);
      g.quadraticCurveTo(x, top + 0.3 * u, L - o - 0.9 * u, top - 0.7 * u);
    } else {
      g.moveTo(L - o, top + 0.1 * u);
      g.lineTo(x, top - rh);
      g.lineTo(Rr + o, top + 0.1 * u);
    }
    g.closePath();
    g.fillStyle = roof;
    g.fill();
    g.stroke();
  }
  // cheminée
  if (st.shape !== 'flat' && rnd() < 0.55) {
    const cx = x + d * 0.6 + 1.1 * u, cy = top - rh * 0.55 - dy * 0.6;
    g.fillStyle = shade(st.wallShade, 0.85);
    g.fillRect(cx, cy - 1.6 * u, 0.9 * u, 1.6 * u);
    g.strokeRect(cx, cy - 1.6 * u, 0.9 * u, 1.6 * u);
  }
  // porte et fenêtres
  g.fillStyle = st.ink;
  g.fillRect(x - 0.6 * u, y - 1.7 * u, 1.2 * u, 1.7 * u);
  g.fillStyle = 'rgba(60, 40, 25, 0.85)';
  g.fillRect(L + 0.7 * u, y - hw + 0.9 * u, 1 * u, 0.95 * u);
  if (tall > 1.05) g.fillRect(Rr - 1.7 * u, y - hw + 0.9 * u, 1 * u, 0.95 * u);
}

/** Lieu de culte selon la religion. (x, y) = pied de l'édifice. */
function temple(g: CanvasRenderingContext2D, st: Style, x: number, y: number, u: number, roof: string): void {
  g.lineJoin = 'round';
  g.lineWidth = Math.max(0.7, 0.32 * u);
  g.strokeStyle = st.ink;
  if (st.temple === 'spire') {
    box(g, st, x - 0.5 * u, y, 6.4 * u, 4.4 * u, 2.4 * u);
    g.beginPath();
    g.moveTo(x - 0.9 * u, y - 4.3 * u);
    g.lineTo(x + 2.7 * u, y - 7.6 * u);
    g.lineTo(x + 6.3 * u, y - 4.3 * u);
    g.closePath();
    g.fillStyle = roof;
    g.fill();
    g.stroke();
    box(g, st, x - 4.6 * u, y, 3.6 * u, 9 * u, 1.6 * u);
    g.beginPath();
    g.moveTo(x - 4.9 * u, y - 9 * u);
    g.lineTo(x - 2.4 * u, y - 15.5 * u);
    g.lineTo(x - 0.2 * u, y - 9.7 * u);
    g.lineTo(x - 1 * u, y - 9 * u);
    g.closePath();
    g.fillStyle = '#4f586a';
    g.fill();
    g.stroke();
    g.fillStyle = st.ink;
    g.beginPath();
    g.arc(x - 2.8 * u, y - 6.6 * u, 0.7 * u, Math.PI, 0);
    g.lineTo(x - 2.1 * u, y - 5.5 * u);
    g.lineTo(x - 3.5 * u, y - 5.5 * u);
    g.closePath();
    g.fill();
  } else if (st.temple === 'dome') {
    box(g, st, x - 3.6 * u, y, 7.2 * u, 4.6 * u, 2.4 * u);
    // dôme
    g.beginPath();
    g.arc(x + 0.6 * u, y - 4.6 * u, 3.3 * u, Math.PI, 0);
    g.closePath();
    const dg = g.createLinearGradient(x - 3 * u, 0, x + 4 * u, 0);
    dg.addColorStop(0, '#e8d27a');
    dg.addColorStop(1, '#a8862e');
    g.fillStyle = dg;
    g.fill();
    g.stroke();
    g.beginPath();
    g.moveTo(x + 0.6 * u, y - 7.9 * u);
    g.lineTo(x + 0.6 * u, y - 9.4 * u);
    g.stroke();
    // minaret
    box(g, st, x + 5.4 * u, y, 1.6 * u, 11 * u, 0.8 * u);
    g.beginPath();
    g.moveTo(x + 5.1 * u, y - 11 * u);
    g.lineTo(x + 6.6 * u, y - 13.6 * u);
    g.lineTo(x + 7.8 * u, y - 11.3 * u);
    g.closePath();
    g.fillStyle = '#7b8a66';
    g.fill();
    g.stroke();
    g.fillStyle = st.ink;
    g.beginPath();
    g.arc(x - 1.2 * u, y - 1.8 * u, 1 * u, Math.PI, 0);
    g.lineTo(x - 0.2 * u, y);
    g.lineTo(x - 2.2 * u, y);
    g.closePath();
    g.fill();
  } else if (st.temple === 'pagoda') {
    const tiers = 4;
    for (let k = 0; k < tiers; k++) {
      const s = 1 - k * 0.2, by = y - k * 3.1 * u;
      box(g, st, x - 2.6 * u * s, by, 5.2 * u * s, 2.4 * u, 1.6 * u * s);
      g.beginPath();
      g.moveTo(x - 4.4 * u * s, by - 2.1 * u);
      g.quadraticCurveTo(x - 1.8 * u * s, by - 2.6 * u, x + 0.4 * u, by - 3.4 * u);
      g.quadraticCurveTo(x + 2.6 * u * s, by - 2.6 * u, x + 5.2 * u * s, by - 2.1 * u);
      g.quadraticCurveTo(x + 0.4 * u, by - 1.9 * u, x - 4.4 * u * s, by - 2.1 * u);
      g.closePath();
      g.fillStyle = roof;
      g.fill();
      g.stroke();
    }
    g.beginPath();
    g.moveTo(x + 0.4 * u, y - tiers * 3.1 * u - 0.2 * u);
    g.lineTo(x + 0.4 * u, y - tiers * 3.1 * u - 2.6 * u);
    g.stroke();
  } else {
    // ziggourat : terrasses en gradins et sanctuaire au sommet
    const steps = 4;
    for (let k = 0; k < steps; k++) {
      const w = (9.5 - k * 2) * u;
      box(g, st, x - w / 2, y - k * 2.4 * u, w, 2.4 * u, 2 * u, '#d9c39a', '#b49a6c');
    }
    g.fillStyle = st.ink;
    g.fillRect(x - 0.5 * u, y - 2.4 * u * steps + 0.4 * u, 1 * u, 2.4 * u * steps - 0.4 * u);
    box(g, st, x - 1.4 * u, y - steps * 2.4 * u, 2.8 * u, 2 * u, 1.2 * u);
  }
}

function merlons(g: CanvasRenderingContext2D, x0: number, x1: number, y: number, u: number): void {
  const n = Math.max(2, Math.round((x1 - x0) / (1.6 * u)));
  const step = (x1 - x0) / n;
  for (let i = 0; i < n; i += 2) g.rect(x0 + i * step, y - 1.1 * u, step, 1.1 * u);
}

/** Château de capitale : donjon crénelé, tours à toit conique, porte, bannière. `big` : quatre tours. */
function castle(g: CanvasRenderingContext2D, st: Style, x: number, y: number, u: number, flag: string, roof: string, big: boolean): void {
  g.lineJoin = 'round';
  g.lineWidth = Math.max(0.8, 0.34 * u);
  g.strokeStyle = st.ink;
  const stone = '#cfc6b4', stoneShade = '#a69d8b';
  const tower = (tx: number, ty: number, tw: number, th: number) => {
    g.beginPath();
    g.rect(tx - tw / 2, ty - th, tw, th);
    g.fillStyle = stone;
    g.fill();
    g.stroke();
    g.fillStyle = stoneShade;
    g.fillRect(tx + tw / 2 - tw * 0.32, ty - th, tw * 0.32, th);
    g.strokeRect(tx - tw / 2, ty - th, tw, th);
    g.beginPath();
    g.moveTo(tx - tw / 2 - 0.5 * u, ty - th);
    g.lineTo(tx, ty - th - tw * 1.35);
    g.lineTo(tx + tw / 2 + 0.5 * u, ty - th);
    g.closePath();
    g.fillStyle = roof;
    g.fill();
    g.stroke();
    g.fillStyle = st.ink;
    g.fillRect(tx - 0.35 * u, ty - th * 0.62, 0.7 * u, 1.2 * u);
  };
  if (big) {
    tower(x - 7.5 * u, y - 2.6 * u, 3 * u, 7.5 * u);
    tower(x + 7.5 * u, y - 2.6 * u, 3 * u, 7.5 * u);
  }
  const kw = 7.5 * u, kh = (big ? 11 : 9.5) * u;
  g.beginPath();
  g.rect(x - kw / 2, y - kh, kw, kh);
  g.fillStyle = stone;
  g.fill();
  g.stroke();
  g.beginPath();
  merlons(g, x - kw / 2, x + kw / 2, y - kh, u);
  g.fillStyle = stone;
  g.fill();
  g.stroke();
  g.fillStyle = stoneShade;
  g.fillRect(x + kw / 2 - kw * 0.28, y - kh, kw * 0.28, kh);
  g.strokeRect(x - kw / 2, y - kh, kw, kh);
  g.fillStyle = st.ink;
  g.fillRect(x - 2.4 * u, y - kh + 2.5 * u, 0.8 * u, 1.3 * u);
  g.fillRect(x + 0.8 * u, y - kh + 2.5 * u, 0.8 * u, 1.3 * u);
  // bannière
  g.beginPath();
  g.moveTo(x, y - kh - 1.1 * u);
  g.lineTo(x, y - kh - 6.5 * u);
  g.stroke();
  g.beginPath();
  g.moveTo(x, y - kh - 6.5 * u);
  g.quadraticCurveTo(x + 2.4 * u, y - kh - 6.2 * u, x + 4.4 * u, y - kh - 5.6 * u);
  g.lineTo(x, y - kh - 4.4 * u);
  g.closePath();
  g.fillStyle = flag;
  g.fill();
  g.stroke();
  tower(x - 5.6 * u, y, 3.6 * u, 8 * u);
  tower(x + 5.6 * u, y, 3.6 * u, 8 * u);
  g.beginPath();
  g.rect(x - 4 * u, y - 4.2 * u, 8 * u, 4.2 * u);
  g.fillStyle = stone;
  g.fill();
  g.stroke();
  g.beginPath();
  merlons(g, x - 4 * u, x + 4 * u, y - 4.2 * u, u);
  g.fill();
  g.stroke();
  g.fillStyle = st.ink;
  g.beginPath();
  g.arc(x, y - 1.8 * u, 1.2 * u, Math.PI, 0);
  g.lineTo(x + 1.2 * u, y);
  g.lineTo(x - 1.2 * u, y);
  g.closePath();
  g.fill();
}

/** Rempart bas crénelé devant la ville, tours d'angle et porte. */
function rampart(g: CanvasRenderingContext2D, st: Style, x: number, y: number, u: number, half: number): void {
  g.lineWidth = Math.max(0.7, 0.3 * u);
  g.strokeStyle = st.ink;
  g.fillStyle = '#cbbfa8';
  g.beginPath();
  g.rect(x - half, y - 2.4 * u, 2 * half, 2.4 * u);
  g.fill();
  g.stroke();
  g.beginPath();
  merlons(g, x - half, x + half, y - 2.4 * u, u * 0.8);
  g.fill();
  g.stroke();
  for (const tx of [x - half, x + half, x]) {
    g.fillStyle = '#cbbfa8';
    g.beginPath();
    g.rect(tx - 1.5 * u, y - 4 * u, 3 * u, 4 * u);
    g.fill();
    g.stroke();
    g.beginPath();
    merlons(g, tx - 1.5 * u, tx + 1.5 * u, y - 4 * u, u * 0.8);
    g.fill();
    g.stroke();
  }
  g.fillStyle = st.ink;
  g.beginPath();
  g.arc(x, y - 1.3 * u, 0.9 * u, Math.PI, 0);
  g.lineTo(x + 0.9 * u, y);
  g.lineTo(x - 0.9 * u, y);
  g.closePath();
  g.fill();
}

function tree(g: CanvasRenderingContext2D, kind: Style['trees'], x: number, y: number, u: number): void {
  g.lineWidth = Math.max(0.6, 0.26 * u);
  g.strokeStyle = 'rgba(28, 34, 18, 0.9)';
  if (kind === 'conifer') {
    g.fillStyle = '#3f5a36';
    g.beginPath();
    g.moveTo(x, y - 5 * u);
    g.lineTo(x + 1.6 * u, y - 0.6 * u);
    g.lineTo(x - 1.6 * u, y - 0.6 * u);
    g.closePath();
    g.fill();
    g.stroke();
  } else if (kind === 'palm') {
    g.strokeStyle = '#6b4a2a';
    g.beginPath();
    g.moveTo(x, y);
    g.quadraticCurveTo(x + 0.6 * u, y - 2.5 * u, x + 0.2 * u, y - 4.6 * u);
    g.stroke();
    g.strokeStyle = '#4f6b2e';
    g.lineWidth = Math.max(0.8, 0.5 * u);
    g.beginPath();
    for (const a of [-2.6, -2, -1.1, -0.5]) {
      g.moveTo(x + 0.2 * u, y - 4.6 * u);
      g.quadraticCurveTo(x + Math.cos(a) * 1.6 * u, y - 5.4 * u, x + Math.cos(a) * 2.6 * u, y - 4.6 * u + Math.sin(-a) * 0.4 * u);
    }
    g.stroke();
  } else {
    g.fillStyle = '#5b2f1a';
    g.fillRect(x - 0.25 * u, y - 1.4 * u, 0.5 * u, 1.4 * u);
    g.fillStyle = '#56733e';
    g.beginPath();
    g.arc(x, y - 2.8 * u, 1.6 * u, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    g.fillStyle = 'rgba(160, 190, 120, 0.5)';
    g.beginPath();
    g.arc(x - 0.5 * u, y - 3.3 * u, 0.6 * u, 0, Math.PI * 2);
    g.fill();
  }
}

/** Port : quai en bois vers la mer, navire amarré, phare pour les grands ports. side = ±1 (côté de la mer). */
function harbor(g: CanvasRenderingContext2D, st: Style, x: number, y: number, u: number, side: number, flag: string, lighthouse: boolean): void {
  const x0 = x + side * 9 * u, x1 = x + side * 19 * u;
  // eau sous le quai (rides)
  g.strokeStyle = 'rgba(200, 225, 235, 0.55)';
  g.lineWidth = Math.max(0.6, 0.25 * u);
  g.beginPath();
  for (let k = 0; k < 3; k++) {
    const yy = y + (0.4 + k * 0.9) * u;
    g.moveTo(Math.min(x0, x1) + k * u, yy);
    g.quadraticCurveTo((x0 + x1) / 2, yy - 0.5 * u, Math.max(x0, x1) - k * u, yy);
  }
  g.stroke();
  // quai
  g.fillStyle = '#8a6a44';
  g.strokeStyle = st.ink;
  g.lineWidth = Math.max(0.6, 0.28 * u);
  g.beginPath();
  g.rect(Math.min(x0, x1), y - 1.1 * u, Math.abs(x1 - x0), 1.1 * u);
  g.fill();
  g.stroke();
  for (let k = 0; k <= 4; k++) {
    const px = x0 + ((x1 - x0) * k) / 4;
    g.beginPath();
    g.moveTo(px, y);
    g.lineTo(px, y + 1.2 * u);
    g.stroke();
  }
  // navire amarré (voiles carguées)
  const sx = x0 + (x1 - x0) * 0.45, sy = y + 3.2 * u;
  g.beginPath();
  g.moveTo(sx - 5 * u, sy - 1.6 * u);
  g.lineTo(sx + 5 * u, sy - 1.6 * u);
  g.lineTo(sx + 3.6 * u, sy);
  g.lineTo(sx - 3.8 * u, sy);
  g.closePath();
  g.fillStyle = '#5e3f24';
  g.fill();
  g.stroke();
  g.beginPath();
  g.moveTo(sx, sy - 1.6 * u);
  g.lineTo(sx, sy - 8.5 * u);
  g.moveTo(sx - 2.4 * u, sy - 6.8 * u);
  g.lineTo(sx + 2.4 * u, sy - 6.8 * u);
  g.stroke();
  g.fillStyle = '#e8dfc8';
  g.fillRect(sx - 2.2 * u, sy - 6.8 * u, 4.4 * u, 0.8 * u);
  g.strokeRect(sx - 2.2 * u, sy - 6.8 * u, 4.4 * u, 0.8 * u);
  g.fillStyle = flag;
  g.beginPath();
  g.moveTo(sx, sy - 8.5 * u);
  g.lineTo(sx + side * 2 * u, sy - 8 * u);
  g.lineTo(sx, sy - 7.5 * u);
  g.closePath();
  g.fill();
  if (lighthouse) {
    const lx = x1 + side * 1.2 * u;
    g.beginPath();
    g.moveTo(lx - 1.4 * u, y);
    g.lineTo(lx - 0.9 * u, y - 8 * u);
    g.lineTo(lx + 0.9 * u, y - 8 * u);
    g.lineTo(lx + 1.4 * u, y);
    g.closePath();
    g.fillStyle = '#ece6d8';
    g.fill();
    g.stroke();
    g.fillStyle = '#a8433a';
    g.fillRect(lx - 1.15 * u, y - 5.4 * u, 2.3 * u, 1.3 * u);
    g.fillRect(lx - 1 * u, y - 2.6 * u, 2 * u, 1.2 * u);
    g.fillStyle = '#ffe08a';
    g.fillRect(lx - 0.8 * u, y - 9.6 * u, 1.6 * u, 1.6 * u);
    g.strokeRect(lx - 0.8 * u, y - 9.6 * u, 1.6 * u, 1.6 * u);
    g.beginPath();
    g.moveTo(lx - 1.2 * u, y - 9.6 * u);
    g.lineTo(lx, y - 10.8 * u);
    g.lineTo(lx + 1.2 * u, y - 9.6 * u);
    g.closePath();
    g.fillStyle = '#4b5873';
    g.fill();
    g.stroke();
  }
}

const SHAPES: RoofShape[] = ['gable', 'hip', 'curved', 'gable', 'hip'];
const TEMPLES: TempleStyle[] = ['spire', 'dome', 'pagoda', 'ziggurat', 'spire', 'dome'];

export interface IconEntry {
  c: HTMLCanvasElement;
  /** source à dessiner : l'ImageBitmap dès qu'elle est prête, le canevas en attendant */
  img: CanvasImageSource;
  ax: number;
  ay: number;
  /** hauteur (px) pour laquelle l'icône a été dessinée */
  h: number;
}

export class CityIcons {
  private world: WorldData | null = null;
  private cache = new Map<string, IconEntry>();
  /** icônes déjà dessinées de chaque ville, toutes tailles confondues */
  private byCity = new Map<number, IconEntry[]>();

  setWorld(world: WorldData): void {
    this.world = world;
    this.cache.clear();
    this.byCity.clear();
  }

  /** Hauteur de l'icône (px CSS) selon la population et le zoom ; les grandes capitales sont plus imposantes. */
  /**
   * Hauteur de l'icône (px CSS) : elle suit l'échelle de la carte (une ville garde la même emprise sur le
   * terrain quand on zoome ou dézoome), jusqu'à un plafond au très fort zoom. En dessous de MIN_ICON px,
   * la ville est dessinée en simple repère.
   */
  static size(city: CityInfo, s: number): number {
    const base = 11 + 5 * Math.max(0, Math.log10(city.pop / 5e4)) + (city.capital ? 4 : 0) + (city.capital && city.pop > 2e6 ? 4 : 0);
    return base * Math.min(4.5, s / 8);
  }

  /** Taille sous laquelle l'icône devient un simple repère (px CSS). */
  static readonly MIN_ICON = 10;

  private style(city: CityInfo): Style {
    const w = this.world!;
    const pol = w.politics;
    const i = Math.floor(city.y) * w.W + Math.floor(city.x);
    const T = w.temperature[i] ?? 12, P = w.precipitation[i] ?? 700;
    const desert = P < 320 && T > 12;
    const climateRoof: [number, number, number] = desert ? [200, 164, 118] : T > 15 ? [178, 86, 58] : T > 5 ? [150, 78, 56] : [86, 96, 111];
    // toits aux couleurs du pays (atténuées), variantes de teinte d'une maison à l'autre
    const cc = city.country >= 0 ? (pol.countries[city.country].color as [number, number, number]) : climateRoof;
    const base = mix(climateRoof, cc, desert ? 0.25 : 0.5).map((v) => v * 0.88) as [number, number, number];
    const roofs = [css(base), css(base.map((v) => v * 1.1) as [number, number, number]), css(base.map((v) => v * 0.9) as [number, number, number])];
    const culture = pol.cultures[city.culture];
    const group = culture ? culture.group : 0;
    const rel = pol.religions[city.religion];
    const root = rel ? (rel.parent >= 0 ? rel.parent : rel.id) : 0;
    const shape: RoofShape = desert ? 'flat' : T < 3 ? 'gable' : SHAPES[group % SHAPES.length];
    return {
      roofs,
      wall: desert ? '#ead6ad' : T > 15 ? '#efe2c6' : '#e8dfcc',
      wallShade: desert ? '#c9b088' : T > 15 ? '#cdbd9c' : '#c6bca7',
      ink: '#33261c',
      shape,
      timber: !desert && T < 12 && group % 2 === 0,
      temple: TEMPLES[root % TEMPLES.length],
      trees: desert ? 'palm' : T < 4 ? 'conifer' : P < 250 ? 'none' : 'leaf',
    };
  }

  /** Côté de la mer pour une ville portuaire : -1 (ouest), +1 (est), 0 si inconnu. */
  private seaSide(city: CityInfo): number {
    const w = this.world!;
    let sx = 0, n = 0;
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2;
      for (const r of [1, 2, 3]) {
        const x = Math.floor(city.x + Math.cos(a) * r), y = Math.floor(city.y + Math.sin(a) * r);
        if (y < 0 || y >= w.H) continue;
        if (w.ocean[y * w.W + ((x % w.W) + w.W) % w.W]) {
          sx += Math.cos(a);
          n++;
        }
      }
    }
    return n === 0 ? 0 : sx >= 0 ? 1 : -1;
  }

  /** Icône (canevas) et point d'ancrage (pied de l'icône) pour une ville à une hauteur donnée (px écran). */
  /**
   * Icône d'une ville pour une hauteur voulue (px écran). Les tailles sont regroupées par paliers de
   * 2^(1/3) : l'icône la plus proche est simplement agrandie ou réduite (au plus ±12 %), si bien qu'un
   * zoom continu ne redessine pas toutes les villes à chaque cran. Si `create` est faux, renvoie la
   * version déjà prête la plus proche (ou null) au lieu d'en dessiner une nouvelle.
   */
  get(city: CityInfo, hPx: number, create = true): IconEntry | null {
    const hb = Math.max(8, Math.round(Math.pow(2, Math.round(Math.log2(Math.max(8, hPx)) * 3) / 3)));
    const key = `${city.id}:${hb}`;
    let e = this.cache.get(key);
    if (e) return e;
    if (!create) {
      let best: IconEntry | null = null;
      for (const c of this.byCity.get(city.id) ?? []) if (!best || Math.abs(Math.log(c.h / hPx)) < Math.abs(Math.log(best.h / hPx))) best = c;
      return best;
    }
    if (this.cache.size > 4000) {
      this.cache.clear();
      this.byCity.clear();
    }
    const u = hb / 22;
    const c = document.createElement('canvas');
    c.width = Math.ceil(64 * u);
    c.height = Math.ceil(36 * u);
    const g = c.getContext('2d')!;
    const ax = c.width / 2, ay = c.height - 5 * u;
    const st = this.style(city);
    const rnd = mulberry(city.id * 2654435761);
    const roof = () => st.roofs[Math.floor(rnd() * st.roofs.length)];
    const pol = this.world!.politics;
    const flag = city.country >= 0 ? `rgb(${pol.countries[city.country].color.join(',')})` : '#c9a24a';
    const pop = city.pop;
    const metropolis = pop > 2e6;
    const side = city.port ? this.seaSide(city) || 1 : 0;

    // ombre portée au sol
    g.fillStyle = 'rgba(25, 18, 10, 0.28)';
    g.beginPath();
    g.ellipse(ax + 1.2 * u, ay + 0.6 * u, (metropolis ? 17 : 12.5) * u, 2.8 * u, 0, 0, Math.PI * 2);
    g.fill();

    // éléments à dessiner de l'arrière (dy petit) vers l'avant
    const items: { dy: number; draw: () => void }[] = [];
    const n = pop < 1e5 ? 2 : pop < 3e5 ? 4 : pop < 8e5 ? 6 : pop < 2e6 ? 8 : 12;
    for (let k = 0; k < n; k++) {
      const s = k % 2 ? 1 : -1;
      const ring = Math.floor(k / 2) + 1;
      // côté port : les maisons laissent la place au quai
      const spread = side && s === side ? 0.75 : 1;
      const dx = s * (2.6 + ring * 2.9 * spread + rnd() * 1.1) * u;
      const dyv = (k % 4 < 2 ? -2.4 : 0.9) * u - rnd() * 0.9 * u;
      const sc = 0.76 + rnd() * 0.3, tall = 0.9 + rnd() * 0.35, r = roof();
      items.push({ dy: dyv, draw: () => house(g, st, ax + dx, ay + dyv, u * sc, r, tall, rnd) });
    }
    if (city.capital) items.push({ dy: -1.5 * u, draw: () => castle(g, st, ax, ay - 1.5 * u, u * (metropolis ? 1.08 : 0.94), flag, roof(), metropolis) });
    else if (pop >= 2.5e5 || city.holyOf >= 0) items.push({ dy: -1 * u, draw: () => temple(g, st, ax - 0.6 * u, ay - 1 * u, u, roof()) });
    else items.push({ dy: -0.6 * u, draw: () => house(g, st, ax, ay - 0.6 * u, u, roof(), 1.12, rnd) });
    if (city.capital && pop >= 8e5) items.push({ dy: -3.2 * u, draw: () => temple(g, st, ax + (side >= 0 ? -9 : 9) * u, ay - 3.2 * u, u * 0.8, roof()) });
    if (st.trees !== 'none') {
      const nt = pop < 3e5 ? 2 : 3;
      for (let k = 0; k < nt; k++) {
        const s = side ? -side : k % 2 ? 1 : -1;
        const dx = s * (10 + k * 2.4 + rnd() * 2) * u * (metropolis ? 1.35 : 1);
        const dyv = (-1.5 + rnd() * 3) * u;
        items.push({ dy: dyv, draw: () => tree(g, st.trees, ax + dx, ay + dyv, u * (0.8 + rnd() * 0.3)) });
      }
    }
    items.sort((a, b) => a.dy - b.dy);
    for (const it of items) it.draw();
    if (pop >= 1.2e6) rampart(g, st, ax, ay + 1.8 * u, u, (metropolis ? 17 : 12.5) * u);
    if (side) harbor(g, st, ax, ay + 1.2 * u, u, side, flag, pop >= 3e5);
    e = { c, ax, ay, img: c, h: hb };
    // copie figée sur la carte graphique : bien plus rapide à dessiner qu'un petit canevas
    const entry = e;
    if (typeof createImageBitmap === 'function') void createImageBitmap(c).then((b) => (entry.img = b)).catch(() => {});
    this.cache.set(key, e);
    const l = this.byCity.get(city.id);
    if (l) l.push(e);
    else this.byCity.set(city.id, [e]);
    return e;
  }
}
