import type { LabelPath } from '../types';
import { unwrapX } from './common';

/**
 * Étiquette courbe à la HOI4 : axe principal du territoire (ACP), étendue utile (quantiles),
 * courbure suivant la « colonne vertébrale » de la forme, taille limitée par l'épaisseur.
 * Les points (x, y, poids) sont en cellules ; x est déroulé autour de refX.
 */
export function curvedLabel(xs: number[], ys: number[], ws: number[], refX: number, W: number, text: string): LabelPath | null {
  const n = xs.length;
  if (n < 3) return null;
  let sw = 0, mx = 0, my = 0;
  const ux = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    ux[i] = unwrapX(xs[i], refX, W);
    sw += ws[i];
    mx += ux[i] * ws[i];
    my += ys[i] * ws[i];
  }
  mx /= sw;
  my /= sw;
  let sxx = 0, syy = 0, sxy = 0;
  for (let i = 0; i < n; i++) {
    const dx = ux[i] - mx, dy = ys[i] - my;
    sxx += ws[i] * dx * dx;
    syy += ws[i] * dy * dy;
    sxy += ws[i] * dx * dy;
  }
  let ang = 0.5 * Math.atan2(2 * sxy, sxx - syy);
  // lisibilité : on reste proche de l'horizontale
  const MAX = (38 * Math.PI) / 180;
  if (ang > Math.PI / 2) ang -= Math.PI;
  if (ang < -Math.PI / 2) ang += Math.PI;
  ang = Math.max(-MAX, Math.min(MAX, ang));
  const ax = Math.cos(ang), ay = Math.sin(ang);
  const tv = new Float64Array(n), sv = new Float64Array(n);
  const idx: number[] = [];
  for (let i = 0; i < n; i++) {
    const dx = ux[i] - mx, dy = ys[i] - my;
    tv[i] = dx * ax + dy * ay;
    sv[i] = -dx * ay + dy * ax;
    idx.push(i);
  }
  idx.sort((a, b) => tv[a] - tv[b]);
  const quant = (q: number): number => {
    let acc = 0;
    for (const i of idx) {
      acc += ws[i];
      if (acc >= q * sw) return tv[i];
    }
    return tv[idx[idx.length - 1]];
  };
  const t0 = quant(0.07), t1 = quant(0.93);
  const len = t1 - t0;
  if (len <= 0) return null;
  // décalage transversal moyen en début, milieu, fin → courbure
  const K = 3;
  const bs = new Float64Array(K), bw = new Float64Array(K);
  let ss = 0;
  for (let i = 0; i < n; i++) {
    if (tv[i] < t0 || tv[i] > t1) continue;
    const b = Math.min(K - 1, Math.floor(((tv[i] - t0) / len) * K));
    bs[b] += sv[i] * ws[i];
    bw[b] += ws[i];
    ss += sv[i] * sv[i] * ws[i];
  }
  const off = [0, 1, 2].map((b) => (bw[b] > 0 ? bs[b] / bw[b] : 0));
  const lim = len * 0.18;
  const s0 = Math.max(-lim, Math.min(lim, off[0]));
  const s1 = Math.max(-lim, Math.min(lim, off[1]));
  const s2 = Math.max(-lim, Math.min(lim, off[2]));
  const thick = 2 * Math.sqrt(ss / Math.max(1e-6, bw[0] + bw[1] + bw[2]));
  const chars = Math.max(3, text.length);
  const size = Math.min((0.9 * len) / (chars * 0.95), thick * 0.9, len * 0.5);
  const at = (t: number, s: number): [number, number] => [mx + t * ax - s * ay, my + t * ay + s * ax];
  const tm = 0.5 * (t0 + t1);
  const [x0, y0] = at(t0, s0);
  const [x1, y1] = at(t1, s2);
  const [xm, ym] = at(tm, s1);
  // point de contrôle de la Bézier quadratique passant par le milieu
  return { x0, y0, x1, y1, cx: 2 * xm - 0.5 * (x0 + x1), cy: 2 * ym - 0.5 * (y0 + y1), size };
}
