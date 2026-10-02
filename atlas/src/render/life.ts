import { R_EARTH_KM } from '../gen/grid';
import type { WorldData } from '../gen/types';
import { hash01 } from '../gen/rng';
import type { MapMode } from './modes';
import type { Camera } from './renderer';

interface Segment {
  kind: 0 | 1;
  pts: Float32Array;
  cum: Float32Array;
  len: number;
  weight: number;
  /** Nœuds (extrémités) de départ et d'arrivée. */
  a: number;
  b: number;
}

/** Voyageur sur le réseau : avance le long d'un tronçon puis en choisit un autre au carrefour. */
interface Traveller {
  seg: number;
  d: number;
  dir: 1 | -1;
  speed: number;
  color: string;
  phase: number;
}

interface Creature {
  x: number;
  y: number;
  dir: 1 | -1;
  size: number;
  phase: number;
  kind: 'serpent' | 'whale';
}

/** Modes où navires et créatures sont dessinés. */
const LIFE_MODES: readonly MapMode[] = ['terrain', 'relief', 'political', 'provinces', 'cultures', 'religions', 'trade', 'influence'];

/**
 * Couche animée : navires marchands sur les lignes maritimes, convois de marchands sur les routes
 * (mode Commerce), créatures des grands fonds, halos des villes la nuit. Les voyageurs parcourent
 * le réseau de carrefour en carrefour (pondéré par le trafic) au lieu de faire des allers-retours.
 */
export class Life {
  private world: WorldData | null = null;
  private segs: Segment[] = [];
  /** Pour chaque nœud : tronçons qui y aboutissent. */
  private nodes: number[][] = [];
  private ships: Traveller[] = [];
  private convoys: Traveller[] = [];
  private creatures: Creature[] = [];
  private cellKm = 26;

  setWorld(world: WorldData): void {
    this.world = world;
    this.cellKm = (2 * Math.PI * R_EARTH_KM) / world.W;
    const pol = world.politics;
    const W = world.W;
    const salt = hashStr(world.settings.seed) + 17;
    this.segs = [];
    this.nodes = [];
    const nodeOf = new Map<string, number>();
    const node = (x: number, y: number) => {
      const k = `${Math.round((((x % W) + W) % W) * 4)},${Math.round(y * 4)}`;
      let id = nodeOf.get(k);
      if (id === undefined) {
        id = this.nodes.length;
        nodeOf.set(k, id);
        this.nodes.push([]);
      }
      return id;
    };
    for (let s = 0; s < pol.routeKind.length; s++) {
      const a = pol.routeOffsets[s], b = pol.routeOffsets[s + 1];
      if (b - a < 2) continue;
      const pts = pol.routePts.subarray(a * 2, b * 2);
      const cum = new Float32Array(b - a);
      for (let k = 1; k < b - a; k++) cum[k] = cum[k - 1] + Math.hypot(pts[k * 2] - pts[k * 2 - 2], pts[k * 2 + 1] - pts[k * 2 - 1]);
      const len = cum[cum.length - 1];
      if (len < 0.5) continue;
      const na = node(pts[0], pts[1]), nb = node(pts[pts.length - 2], pts[pts.length - 1]);
      const id = this.segs.length;
      this.segs.push({ kind: pol.routeKind[s] as 0 | 1, pts, cum, len, weight: Math.sqrt(pol.routeVolume[s]) + 1e-3, a: na, b: nb });
      this.nodes[na].push(id);
      this.nodes[nb].push(id);
    }
    const spawn = (kind: 0 | 1, n: number, off: number): Traveller[] => {
      const idx = this.segs.map((_, i) => i).filter((i) => this.segs[i].kind === kind);
      const tot = idx.reduce((a, i) => a + this.segs[i].weight * this.segs[i].len, 0);
      const out: Traveller[] = [];
      for (let k = 0; k < n && tot > 0; k++) {
        let r = hash01(k, salt + off) * tot, seg = idx[0];
        for (const i of idx) {
          r -= this.segs[i].weight * this.segs[i].len;
          if (r <= 0) {
            seg = i;
            break;
          }
        }
        const country = pol.countries[Math.floor(hash01(k, salt + off + 5) * pol.countries.length)];
        out.push({
          seg, d: hash01(k, salt + off + 1) * this.segs[seg].len, dir: hash01(k, salt + off + 3) < 0.5 ? 1 : -1,
          speed: 0.75 + 0.5 * hash01(k, salt + off + 2), color: `rgb(${country.color.join(',')})`, phase: hash01(k, salt + off + 4) * 10,
        });
      }
      return out;
    };
    const ports = pol.cities.filter((c) => c.port).length;
    this.ships = spawn(1, Math.round(Math.min(90, 16 + ports / 2.5)), 100);
    this.convoys = spawn(0, 170, 300);
    this.placeCreatures(world);
  }

  /** Grands fonds loin de toute côte (même un îlot), créatures espacées. */
  private placeCreatures(world: WorldData): void {
    const { W, H, height, ocean } = world;
    const salt = hashStr(world.settings.seed) + 911;
    const cand: number[] = [];
    const step = Math.max(2, Math.round(W / 256));
    const R = W * 0.03;
    for (let y = Math.round(H * 0.12); y < H * 0.88; y += step) {
      for (let x = 0; x < W; x += step) {
        const i = y * W + x;
        if (!ocean[i] || height[i] > -3000) continue;
        let clear = true;
        for (let ring = 1; ring <= 3 && clear; ring++) {
          const r = (R * ring) / 3, n = 8 * ring + 4;
          for (let k = 0; k < n && clear; k++) {
            const a = (k / n) * Math.PI * 2;
            const xx = (((x + Math.round(Math.cos(a) * r)) % W) + W) % W;
            const yy = Math.min(H - 1, Math.max(0, y + Math.round(Math.sin(a) * r * 0.8)));
            if (!ocean[yy * W + xx]) clear = false;
          }
        }
        if (clear) cand.push(i);
      }
    }
    cand.sort((a, b) => hash01(a, salt) - hash01(b, salt));
    const target = Math.max(2, Math.min(6, Math.round(cand.length / 90)));
    const out: Creature[] = [];
    for (const i of cand) {
      if (out.length >= target) break;
      const x = (i % W) + 0.5, y = Math.floor(i / W) + 0.5;
      if (out.some((c) => Math.hypot(wrapDx(c.x - x, W), c.y - y) < W * 0.18)) continue;
      out.push({
        x, y, dir: hash01(i, salt + 1) < 0.5 ? 1 : -1, size: 0.85 + 0.35 * hash01(i, salt + 2),
        phase: hash01(i, salt + 3) * 60, kind: hash01(i, salt + 4) < 0.5 ? 'serpent' : 'whale',
      });
    }
    this.creatures = out;
  }

  /** Vrai s'il y a quelque chose à animer dans ce mode. */
  active(mode: MapMode): boolean {
    return !!this.world && LIFE_MODES.includes(mode);
  }

  /** Avance un voyageur ; au bout du tronçon, poursuit sur un tronçon voisin du même type (pondéré par le trafic). */
  private advance(tr: Traveller, dist: number, salt: number): void {
    let left = dist;
    for (let guard = 0; guard < 8 && left > 0; guard++) {
      const seg = this.segs[tr.seg];
      const room = tr.dir > 0 ? seg.len - tr.d : tr.d;
      if (left < room) {
        tr.d += tr.dir * left;
        return;
      }
      left -= room;
      const at = tr.dir > 0 ? seg.b : seg.a;
      const next = this.nodes[at].filter((i) => i !== tr.seg && this.segs[i].kind === seg.kind);
      if (!next.length) {
        // impasse (port, ville terminus) : demi-tour
        tr.d = tr.dir > 0 ? seg.len : 0;
        tr.dir = tr.dir > 0 ? -1 : 1;
        continue;
      }
      const tot = next.reduce((a, i) => a + this.segs[i].weight, 0);
      let r = hash01(Math.floor(tr.phase * 1e3) + guard, salt + tr.seg) * tot;
      tr.phase += 0.37;
      let pick = next[0];
      for (const i of next) {
        r -= this.segs[i].weight;
        if (r <= 0) {
          pick = i;
          break;
        }
      }
      const ns = this.segs[pick];
      tr.seg = pick;
      if (ns.a === at) {
        tr.d = 0;
        tr.dir = 1;
      } else {
        tr.d = ns.len;
        tr.dir = -1;
      }
    }
  }

  /** Navires, créatures et convois. Le canevas est effacé par l'appelant. */
  draw(ctx: CanvasRenderingContext2D, cam: Camera, vw: number, vh: number, mode: MapMode, t: number, dt: number): void {
    const world = this.world;
    if (!world || !LIFE_MODES.includes(mode)) return;
    const W = world.W;
    const dpr = window.devicePixelRatio || 1;
    const s = cam.scale / dpr;
    const ox = vw / 2 - cam.cx * cam.scale, oy = vh / 2 - cam.cy * cam.scale;
    const kMin = Math.floor(-ox / (W * cam.scale)) - 1, kMax = Math.ceil((vw - ox) / (W * cam.scale)) + 1;
    const toScreen = (x: number, y: number, k: number): [number, number] => [ox + (x + k * W) * cam.scale, oy + y * cam.scale];
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    // --- créatures des grands fonds ---
    const csize = dpr * Math.max(34, Math.min(210, 48 * Math.pow(s, 0.6)));
    for (const c of this.creatures) {
      for (let k = kMin; k <= kMax; k++) {
        const [x, y] = toScreen(c.x, c.y, k);
        if (x < -csize * 1.2 || x > vw + csize * 1.2 || y < -csize || y > vh + csize) continue;
        if (c.kind === 'serpent') drawSerpent(ctx, x, y, csize * c.size, c.dir, t + c.phase);
        else drawWhale(ctx, x, y, csize * c.size * 0.9, c.dir, t + c.phase);
      }
    }

    // --- navires marchands (dès qu'on zoome un peu) ---
    const kmPerS = 55; // vitesse de croisière accélérée (km par seconde réelle)
    if (s >= 0.8) {
      const size = dpr * Math.max(13, Math.min(46, 15 * Math.pow(s, 0.55)));
      for (const sh of this.ships) {
        this.advance(sh, (dt * kmPerS * sh.speed) / this.cellKm, 101);
        const seg = this.segs[sh.seg];
        const [px, py] = pointAt(seg, sh.d);
        const [qx] = pointAt(seg, Math.max(0, Math.min(seg.len, sh.d + sh.dir * 0.6)));
        const dir: 1 | -1 = qx >= px ? 1 : -1;
        for (let k = kMin; k <= kMax; k++) {
          const [x, y] = toScreen(px, py, k);
          if (x < -size * 2 || x > vw + size * 2 || y < -size * 2 || y > vh + size) continue;
          drawShip(ctx, x, y + Math.sin(t * 1.7 + sh.phase) * 0.6 * dpr, dir, size, sh.color, t + sh.phase);
        }
      }
    }

    // --- convois terrestres (mode Commerce) ---
    if (mode === 'trade') {
      ctx.fillStyle = 'rgba(255, 226, 150, 0.95)';
      ctx.shadowColor = 'rgba(255, 200, 90, 0.9)';
      ctx.shadowBlur = 6 * dpr;
      for (const c of this.convoys) {
        this.advance(c, (dt * kmPerS * 0.7 * c.speed) / this.cellKm, 303);
        const [px, py] = pointAt(this.segs[c.seg], c.d);
        for (let k = kMin; k <= kMax; k++) {
          const [x, y] = toScreen(px, py, k);
          if (x < -10 || x > vw + 10 || y < -10 || y > vh + 10) continue;
          ctx.beginPath();
          ctx.arc(x, y, 1.9 * dpr, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.shadowBlur = 0;
    }
    ctx.restore();
  }

  /**
   * Halos des villes du côté nuit (même terminateur que le shader) : taille et éclat selon la population.
   * `sun` : direction du soleil sur la sphère unité.
   */
  drawLights(ctx: CanvasRenderingContext2D, cam: Camera, vw: number, vh: number, sun: [number, number, number]): void {
    const world = this.world;
    if (!world) return;
    const W = world.W;
    const dpr = window.devicePixelRatio || 1;
    const s = cam.scale / dpr;
    const ox = vw / 2 - cam.cx * cam.scale, oy = vh / 2 - cam.cy * cam.scale;
    const kMin = Math.floor(-ox / (W * cam.scale)) - 1, kMax = Math.ceil((vw - ox) / (W * cam.scale)) + 1;
    const zoom = Math.max(0.7, Math.min(4, Math.sqrt(s)));
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'lighter';
    for (const c of world.politics.cities) {
      const lat = ((world.latMax - (c.y / world.H) * 2 * world.latMax) * Math.PI) / 180;
      const lon = (c.x / W) * 2 * Math.PI - Math.PI;
      const cz = Math.cos(lat) * Math.cos(lon) * sun[0] + Math.cos(lat) * Math.sin(lon) * sun[1] + Math.sin(lat) * sun[2];
      const tt = Math.min(1, Math.max(0, (cz + 0.1) / 0.17));
      const night = 1 - tt * tt * (3 - 2 * tt);
      if (night < 0.02) continue;
      const r = (3 + 4.5 * Math.max(0, Math.log10(c.pop / 3e4))) * zoom * dpr;
      for (let k = kMin; k <= kMax; k++) {
        const x = ox + (c.x + k * W) * cam.scale, y = oy + c.y * cam.scale;
        if (x < -r || x > vw + r || y < -r || y > vh + r) continue;
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, `rgba(255, 236, 190, ${0.95 * night})`);
        g.addColorStop(0.25, `rgba(255, 190, 110, ${0.55 * night})`);
        g.addColorStop(1, 'rgba(255, 150, 60, 0)');
        ctx.fillStyle = g;
        ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
      }
    }
    ctx.restore();
  }
}

function pointAt(seg: Segment, d: number): [number, number] {
  const cum = seg.cum;
  let lo = 0, hi = cum.length - 1;
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    if (cum[mid] <= d) lo = mid;
    else hi = mid;
  }
  const f = Math.max(0, Math.min(1, (d - cum[lo]) / Math.max(1e-6, cum[hi] - cum[lo])));
  const p = seg.pts;
  return [p[lo * 2] + (p[hi * 2] - p[lo * 2]) * f, p[lo * 2 + 1] + (p[hi * 2 + 1] - p[lo * 2 + 1]) * f];
}

const wrapDx = (dx: number, W: number) => dx - Math.round(dx / W) * W;

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

// ---------- navire : caraque à trois mâts, vue de profil ----------
function drawShip(ctx: CanvasRenderingContext2D, x: number, y: number, dir: 1 | -1, size: number, flag: string, t: number): void {
  const u = size / 24;
  const detailed = size > 18;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(dir * u, u);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  // sillage et écume
  const wake = ctx.createLinearGradient(-30, 0, -8, 0);
  wake.addColorStop(0, 'rgba(225, 236, 240, 0)');
  wake.addColorStop(1, 'rgba(225, 236, 240, 0.55)');
  ctx.strokeStyle = wake;
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.moveTo(-9, 1.8);
  ctx.quadraticCurveTo(-18, 2.6, -30, 0.6 + Math.sin(t * 2.3) * 0.5);
  ctx.moveTo(-9, 2.4);
  ctx.quadraticCurveTo(-18, 4.4, -29, 5.4 + Math.sin(t * 2.1 + 1) * 0.5);
  ctx.stroke();
  ctx.fillStyle = 'rgba(235, 242, 245, 0.55)';
  ctx.beginPath();
  ctx.ellipse(10.5, 1.9, 2.2, 0.7, 0, 0, Math.PI * 2);
  ctx.fill();
  // ombre dans l'eau
  ctx.fillStyle = 'rgba(8, 18, 26, 0.3)';
  ctx.beginPath();
  ctx.ellipse(0.5, 2.6, 11.5, 1.6, 0, 0, Math.PI * 2);
  ctx.fill();

  // coque : château arrière haut, pont bas, gaillard d'avant, guibre
  const hull = new Path2D();
  hull.moveTo(-10.5, -4.2);
  hull.lineTo(-7, -4.2);
  hull.lineTo(-6.4, -2.6);
  hull.quadraticCurveTo(1, -1.7, 6.5, -2.4);
  hull.lineTo(7.2, -3.6);
  hull.lineTo(9.6, -3.4);
  hull.lineTo(12.6, -2.5);
  hull.lineTo(10.4, -1.2);
  hull.quadraticCurveTo(9.2, 1.7, 5.5, 2.2);
  hull.lineTo(-7.5, 2.2);
  hull.quadraticCurveTo(-10.2, 1.4, -10.5, -4.2);
  hull.closePath();
  const hg = ctx.createLinearGradient(0, -4.2, 0, 2.2);
  hg.addColorStop(0, '#8a6038');
  hg.addColorStop(0.45, '#6a4527');
  hg.addColorStop(1, '#3a2414');
  ctx.fillStyle = hg;
  ctx.fill(hull);
  ctx.save();
  ctx.clip(hull);
  // préceinte claire, sabords, coque immergée
  ctx.strokeStyle = 'rgba(214, 186, 128, 0.7)';
  ctx.lineWidth = 0.32;
  ctx.beginPath();
  ctx.moveTo(-10.5, -0.9);
  ctx.quadraticCurveTo(1, 0, 11, -0.9);
  ctx.stroke();
  if (detailed) {
    ctx.fillStyle = '#1b120a';
    for (let gx = -5.5; gx <= 6.5; gx += 2.4) ctx.fillRect(gx, -0.5 + Math.abs(gx) * 0.02, 0.8, 0.7);
  }
  ctx.fillStyle = 'rgba(28, 52, 64, 0.5)';
  ctx.fillRect(-12, 1.15, 26, 2);
  ctx.restore();
  ctx.strokeStyle = '#1d1209';
  ctx.lineWidth = 0.35;
  ctx.stroke(hull);

  // mâts et beaupré
  ctx.strokeStyle = '#2a1b0f';
  ctx.lineWidth = 0.42;
  ctx.beginPath();
  ctx.moveTo(4.6, -2.3);
  ctx.lineTo(4.6, -15.5);
  ctx.moveTo(-0.6, -1.8);
  ctx.lineTo(-0.6, -19);
  ctx.moveTo(-6, -2.6);
  ctx.lineTo(-6, -13.5);
  ctx.moveTo(11.6, -2.8);
  ctx.lineTo(16.5, -6);
  ctx.stroke();

  // voiles carrées gonflées, ombrées
  const sail = (mx: number, top: number, bottom: number, half: number) => {
    const p = new Path2D();
    p.moveTo(mx - half, top);
    p.lineTo(mx + half, top);
    p.quadraticCurveTo(mx + half + 1.1, (top + bottom) / 2, mx + half * 0.92, bottom);
    p.quadraticCurveTo(mx, bottom + 1.1, mx - half * 0.92, bottom);
    p.quadraticCurveTo(mx - half + 0.5, (top + bottom) / 2, mx - half, top);
    p.closePath();
    const g = ctx.createLinearGradient(mx - half, 0, mx + half + 1, 0);
    g.addColorStop(0, '#d9ccad');
    g.addColorStop(0.55, '#f2e9d4');
    g.addColorStop(1, '#c8b993');
    ctx.fillStyle = g;
    ctx.fill(p);
    ctx.strokeStyle = 'rgba(96, 78, 52, 0.85)';
    ctx.lineWidth = 0.26;
    ctx.stroke(p);
    ctx.strokeStyle = '#2a1b0f';
    ctx.lineWidth = 0.3;
    ctx.beginPath();
    ctx.moveTo(mx - half - 0.3, top);
    ctx.lineTo(mx + half + 0.3, top);
    ctx.stroke();
  };
  sail(-0.6, -17.6, -11.4, 4.6);
  sail(-0.6, -10.6, -3.6, 5.6);
  sail(4.6, -14.4, -9.6, 3.5);
  sail(4.6, -8.9, -3.4, 4.3);
  // voile latine d'artimon et foc
  ctx.fillStyle = '#e6dcc2';
  ctx.strokeStyle = 'rgba(96, 78, 52, 0.85)';
  ctx.lineWidth = 0.26;
  ctx.beginPath();
  ctx.moveTo(-6, -13);
  ctx.lineTo(-9.8, -4);
  ctx.lineTo(-3.2, -4.4);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(16.3, -5.9);
  ctx.lineTo(5, -14.6);
  ctx.lineTo(9.2, -4.2);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // haubans
  if (detailed) {
    ctx.strokeStyle = 'rgba(40, 28, 16, 0.55)';
    ctx.lineWidth = 0.18;
    ctx.beginPath();
    ctx.moveTo(-0.6, -19);
    ctx.lineTo(-10.2, -4.2);
    ctx.moveTo(-0.6, -19);
    ctx.lineTo(4.6, -15.5);
    ctx.lineTo(16.5, -6);
    ctx.stroke();
  }
  // flamme aux couleurs du pays
  ctx.fillStyle = flag;
  ctx.strokeStyle = 'rgba(20, 14, 8, 0.7)';
  ctx.lineWidth = 0.2;
  ctx.beginPath();
  ctx.moveTo(-0.6, -19);
  ctx.quadraticCurveTo(2.5, -19.6 + Math.sin(t * 4) * 0.4, 5.5, -18.7 + Math.sin(t * 4 + 1) * 0.5);
  ctx.lineTo(-0.6, -17.9);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

// ---------- créatures : serpent de mer et léviathan, tons sourds, émergeant de l'eau ----------
function foam(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, a: number): void {
  ctx.fillStyle = `rgba(226, 236, 238, ${0.5 * a})`;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = `rgba(240, 246, 248, ${0.6 * a})`;
  ctx.lineWidth = ry * 0.35;
  ctx.beginPath();
  ctx.ellipse(x, y - ry * 0.1, rx * 0.8, ry * 0.55, 0, Math.PI * 1.05, Math.PI * 1.95);
  ctx.stroke();
}

function ripples(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, t: number, a: number): void {
  for (let k = 0; k < 2; k++) {
    const p = (t * 0.22 + k * 0.5) % 1;
    ctx.strokeStyle = `rgba(210, 226, 232, ${0.4 * (1 - p) * a})`;
    ctx.lineWidth = Math.max(0.8, r * 0.05);
    ctx.beginPath();
    ctx.ellipse(x, y, r * (0.6 + p), r * (0.18 + p * 0.3), 0, 0, Math.PI * 2);
    ctx.stroke();
  }
}

/** Visibilité au fil d'un cycle de plongée (~50 s) : la créature fait surface, reste, puis replonge. */
function surfacing(t: number): number {
  const p = (t % 50) / 50;
  const up = Math.min(1, Math.max(0, (p - 0.05) / 0.12));
  const down = Math.min(1, Math.max(0, (0.88 - p) / 0.12));
  const v = Math.min(up, down);
  return v * v * (3 - 2 * v);
}

function drawSerpent(ctx: CanvasRenderingContext2D, x: number, y: number, L: number, dir: 1 | -1, t: number): void {
  const vis = surfacing(t);
  const u = L / 100;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(dir, 1);
  // corps immergé : ombre sinueuse sous la surface
  ctx.strokeStyle = 'rgba(6, 16, 20, 0.32)';
  ctx.lineWidth = 7 * u;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-58 * u, 4 * u);
  for (let k = 0; k <= 20; k++) {
    const sx = -58 + k * 5.6;
    ctx.lineTo(sx * u, (4 + Math.sin(k * 0.8 + t * 0.6) * 3) * u);
  }
  ctx.stroke();
  if (vis > 0.01) {
    ripples(ctx, 0, 2 * u, 40 * u, t, vis);
    const h = vis;
    // anneaux émergés (dos écailleux), du plus éloigné au plus proche
    const humps: [number, number, number][] = [[-34, 11, 9], [-12, 14, 11], [10, 11, 9]];
    for (const [cx, ch, cw] of humps) {
      const hh = ch * h, w = cw;
      const wob = Math.sin(t * 0.7 + cx) * 1.2;
      const body = new Path2D();
      body.moveTo((cx - w) * u, 2 * u);
      body.bezierCurveTo((cx - w + 1) * u, (-hh - wob) * u, (cx + w - 1) * u, (-hh + wob) * u, (cx + w) * u, 2 * u);
      body.lineTo((cx + w - 4.5) * u, 2 * u);
      body.bezierCurveTo((cx + w - 5) * u, (-hh * 0.45) * u, (cx - w + 5) * u, (-hh * 0.45) * u, (cx - w + 4.5) * u, 2 * u);
      body.closePath();
      const g = ctx.createLinearGradient(0, -hh * u, 0, 2 * u);
      g.addColorStop(0, '#5f6f62');
      g.addColorStop(0.5, '#3a4840');
      g.addColorStop(1, '#1d2622');
      ctx.fillStyle = g;
      ctx.fill(body);
      ctx.strokeStyle = 'rgba(12, 18, 15, 0.85)';
      ctx.lineWidth = Math.max(0.8, 0.6 * u);
      ctx.stroke(body);
      // écailles : petites hachures sur le dos
      ctx.strokeStyle = 'rgba(150, 168, 150, 0.35)';
      ctx.lineWidth = Math.max(0.5, 0.35 * u);
      ctx.beginPath();
      for (let k = -3; k <= 3; k++) {
        const a = k / 4.2;
        const px = cx + a * w * 0.9, py = -hh * 0.82 * (1 - a * a * 0.8) + 1.2;
        ctx.moveTo((px - 0.9) * u, py * u);
        ctx.quadraticCurveTo(px * u, (py + 0.9) * u, (px + 0.9) * u, py * u);
      }
      ctx.stroke();
      // crête dorsale sombre
      ctx.fillStyle = '#2a332e';
      for (let k = -2; k <= 2; k++) {
        const a = k / 3.3;
        const px = cx + a * w * 0.95, py = -hh * 0.98 * (1 - a * a * 0.85);
        ctx.beginPath();
        ctx.moveTo((px - 1.2) * u, (py + 0.6) * u);
        ctx.lineTo((px + 0.4) * u, (py - 2.4 * h) * u);
        ctx.lineTo((px + 1.2) * u, (py + 0.6) * u);
        ctx.fill();
      }
      foam(ctx, (cx - w + 2) * u, 2 * u, 3.4 * u, 1.1 * u, h);
      foam(ctx, (cx + w - 2) * u, 2 * u, 3.4 * u, 1.1 * u, h);
    }
    // tête allongée, mâchoire close, émergeant en avant
    const nod = Math.sin(t * 0.9) * 1.2;
    const hx = 30, hy = -10 * h + nod;
    const neck = new Path2D();
    neck.moveTo(21 * u, 2 * u);
    neck.quadraticCurveTo(23 * u, (hy + 4) * u, (hx - 2) * u, (hy - 1) * u);
    neck.lineTo((hx + 9) * u, (hy - 0.5) * u);
    neck.quadraticCurveTo((hx + 12.5) * u, (hy + 0.8) * u, (hx + 9) * u, (hy + 2.2) * u);
    neck.lineTo((hx + 1) * u, (hy + 3) * u);
    neck.quadraticCurveTo(29 * u, (hy + 6) * u, 27.5 * u, 2 * u);
    neck.closePath();
    const hg = ctx.createLinearGradient(0, (hy - 2) * u, 0, 2 * u);
    hg.addColorStop(0, '#617163');
    hg.addColorStop(1, '#222c27');
    ctx.fillStyle = hg;
    ctx.fill(neck);
    ctx.strokeStyle = 'rgba(12, 18, 15, 0.9)';
    ctx.lineWidth = Math.max(0.8, 0.6 * u);
    ctx.stroke(neck);
    ctx.beginPath();
    ctx.moveTo((hx + 3) * u, (hy + 1.6) * u);
    ctx.lineTo((hx + 10.5) * u, (hy + 1.2) * u);
    ctx.stroke();
    ctx.fillStyle = 'rgba(214, 196, 120, 0.9)';
    ctx.beginPath();
    ctx.arc((hx + 3.5) * u, (hy + 0.2) * u, Math.max(0.6, 0.55 * u), 0, Math.PI * 2);
    ctx.fill();
    foam(ctx, 24 * u, 2 * u, 4.5 * u, 1.3 * u, h);
  }
  ctx.restore();
}

function drawWhale(ctx: CanvasRenderingContext2D, x: number, y: number, L: number, dir: 1 | -1, t: number): void {
  const vis = surfacing(t + 13);
  const u = L / 100;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(dir, 1);
  // silhouette sous l'eau
  ctx.fillStyle = 'rgba(6, 16, 22, 0.3)';
  ctx.beginPath();
  ctx.ellipse(0, 3 * u, 44 * u, 8 * u, 0, 0, Math.PI * 2);
  ctx.fill();
  if (vis > 0.01) {
    ripples(ctx, 0, 2 * u, 46 * u, t, vis);
    const h = vis;
    // dos émergé, nageoire dorsale
    const back = new Path2D();
    back.moveTo(-34 * u, 2 * u);
    back.bezierCurveTo(-24 * u, -9 * h * u, 18 * u, -12 * h * u, 34 * u, 2 * u);
    back.closePath();
    const g = ctx.createLinearGradient(0, -12 * h * u, 0, 2 * u);
    g.addColorStop(0, '#6b7780');
    g.addColorStop(0.55, '#424e57');
    g.addColorStop(1, '#232b31');
    ctx.fillStyle = g;
    ctx.fill(back);
    ctx.strokeStyle = 'rgba(14, 18, 22, 0.85)';
    ctx.lineWidth = Math.max(0.8, 0.6 * u);
    ctx.stroke(back);
    ctx.fillStyle = '#353f47';
    ctx.beginPath();
    ctx.moveTo(-14 * u, -6.8 * h * u);
    ctx.quadraticCurveTo(-17 * u, -12.5 * h * u, -21.5 * u, -13 * h * u);
    ctx.quadraticCurveTo(-18 * u, -9 * h * u, -18.5 * u, -5.6 * h * u);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // reflets clairs (peau mouillée) et cicatrices
    ctx.strokeStyle = 'rgba(205, 215, 222, 0.35)';
    ctx.lineWidth = Math.max(0.6, 0.5 * u);
    ctx.beginPath();
    ctx.moveTo(-6 * u, -8.5 * h * u);
    ctx.quadraticCurveTo(8 * u, -9.6 * h * u, 20 * u, -5 * h * u);
    ctx.stroke();
    // queue : la nageoire caudale se lève en fin de cycle
    const tailUp = Math.max(0, Math.sin(((t + 13) % 50) / 50 * Math.PI * 2 - 1.2));
    const tx = -38 * u, ty = 1 * u - tailUp * 9 * u;
    ctx.fillStyle = '#2f3940';
    ctx.beginPath();
    ctx.moveTo(-31 * u, 2 * u);
    ctx.quadraticCurveTo(-35 * u, ty + 3 * u, tx, ty);
    ctx.quadraticCurveTo(tx - 6 * u, ty - 5 * u, tx - 11 * u, ty - 3 * u);
    ctx.quadraticCurveTo(tx - 5 * u, ty + 0.5 * u, tx - 1 * u, ty + 2.5 * u);
    ctx.quadraticCurveTo(tx - 4 * u, ty + 6 * u, tx - 9 * u, ty + 8 * u);
    ctx.quadraticCurveTo(tx - 2 * u, ty + 6.5 * u, -30 * u, 2.5 * u);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    foam(ctx, -31 * u, 2 * u, 5 * u, 1.4 * u, h);
    foam(ctx, 31 * u, 2 * u, 5 * u, 1.4 * u, h);
    // souffle intermittent
    const sp = ((t * 0.5) % 6) / 6;
    if (sp < 0.35) {
      const a = (1 - sp / 0.35) * h;
      for (let k = 0; k < 6; k++) {
        const ang = -Math.PI / 2 + (k - 2.5) * 0.18;
        const r = (6 + sp * 40) * u;
        ctx.fillStyle = `rgba(236, 242, 246, ${0.35 * a})`;
        ctx.beginPath();
        ctx.arc(24 * u + Math.cos(ang) * r * 0.4, -8 * u + Math.sin(ang) * r, (2.2 + sp * 6) * u, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  ctx.restore();
}
