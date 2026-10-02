import { R_EARTH_KM } from '../gen/grid';
import type { LabelPath, WorldData } from '../gen/types';
import { GEO_MODES, type MapMode } from './modes';
import { plateColorCss } from './palette';
import type { Camera } from './renderer';
import { CityIcons } from './cityicons';

const ROUTE_CLASSES = 9;
/** Durée d'affichage d'un bandeau d'événement (ms). */
const FLASH_MS = 2600;
const SERIF = "'Palatino Linotype', Palatino, 'Book Antiqua', Georgia, serif";

export interface OverlayOptions {
  mode: MapMode;
  rivers: boolean;
  selectedCity?: number;
  hoverCity?: number;
  /** Densité de pixels des symboles et du texte (export haute définition) ; par défaut celle de l'écran. */
  pixelRatio?: number;
  /** Villes dessinées en petites maisons (sinon pastilles). */
  icons?: boolean;
  /** Forêts en petits arbres. */
  forests?: boolean;
  /** export : végétation dessinée d'un bloc à l'échelle exacte (pas de cache de tuiles) */
  direct?: boolean;
  /** geste en cours (déplacement, zoom) : les tracés coûteux peuvent attendre la fin du geste */
  interacting?: boolean;
  /** Fleuves atténués (cycle jour / nuit : ils ne doivent pas luire dans l'ombre). */
  dimRivers?: boolean;
}

/** Modes où les forêts sont dessinées. */

/** Population minimale d'une ville (hors capitales) pour être dessinée à l'échelle s (px CSS par cellule). */
export function cityMinPop(s: number): number {
  return s < 0.7 ? Infinity : s < 1.2 ? 2.5e6 : s < 2 ? 9e5 : s < 3.5 ? 3e5 : s < 6 ? 1e5 : 0;
}

/** Couche 2D vectorielle au-dessus du WebGL : fleuves, réseau commercial, villes, étiquettes, plaques, vents. */
export class Overlay {
  private world: WorldData | null = null;
  private readonly icons = new CityIcons();
  /** Fleuves lissés, prêts à être tracés en rubans (coordonnées monde, x déroulé). */
  private rivers: RiverLine[] = [];
  /** Rubans déjà construits pour l'échelle courante (réutilisés pendant un déplacement). */
  private riverCache: RiverCache | null = null;
  private iconsPending = false;
  private labelCache = new Map<string, { c: HTMLCanvasElement; img: CanvasImageSource; w: number; pad: number }>();
  /** [type][classe de trafic] : 0 = routes terrestres, 1 = lignes maritimes. */
  private routes: Path2D[][] = [[], []];
  private qMin = 1;
  /** Étiquettes des pays d'une autre époque (frise historique) ; null = pays actuels. */
  private countryLabels: { name: string; label: LabelPath | null }[] | null = null;

  setCountryLabels(labels: { name: string; label: LabelPath | null }[] | null): void {
    this.countryLabels = labels;
  }

  /** Bandeaux d'événements de la frise, posés sur la région concernée (coordonnées monde). */
  private flashes: { x: number; y: number; title: string; sub: string; t0: number }[] = [];
  flash(list: { x: number; y: number; title: string; sub: string }[]): void {
    const now = performance.now();
    this.flashes = [...this.flashes.filter((f) => now - f.t0 < FLASH_MS), ...list.map((f) => ({ ...f, t0: now }))].slice(-4);
  }

  private drawFlashes(ctx: CanvasRenderingContext2D, cam: Camera, ox: number, oy: number, kMin: number, kMax: number, dpr: number, W: number): void {
    const now = performance.now();
    this.flashes = this.flashes.filter((f) => now - f.t0 < FLASH_MS);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    for (const f of this.flashes) {
      const t = (now - f.t0) / FLASH_MS;
      const a = Math.min(1, t / 0.12) * (1 - Math.max(0, (t - 0.65) / 0.35));
      for (let k = kMin; k <= kMax; k++) {
        const x = ox + (f.x + k * W) * cam.scale, y = oy + f.y * cam.scale - (10 + 14 * t) * dpr;
        if (x < -300 || x > ctx.canvas.width + 300 || y < -60 || y > ctx.canvas.height + 60) continue;
        ctx.font = `700 ${13 * dpr}px Cinzel, Georgia, serif`;
        const tw = ctx.measureText(f.title).width;
        ctx.font = `${10.5 * dpr}px system-ui, sans-serif`;
        const sw = ctx.measureText(f.sub).width;
        const w = Math.max(tw, sw) + 22 * dpr, h = 38 * dpr;
        ctx.globalAlpha = a;
        ctx.fillStyle = 'rgba(20, 14, 8, 0.86)';
        ctx.strokeStyle = 'rgba(214, 167, 86, 0.85)';
        ctx.lineWidth = 1.2 * dpr;
        ctx.beginPath();
        ctx.roundRect(x - w / 2, y - h / 2, w, h, 4 * dpr);
        ctx.fill();
        ctx.stroke();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = `700 ${13 * dpr}px Cinzel, Georgia, serif`;
        ctx.fillStyle = '#fbbf24';
        ctx.fillText(f.title, x, y - 7 * dpr);
        ctx.font = `${10.5 * dpr}px system-ui, sans-serif`;
        ctx.fillStyle = 'rgba(254, 243, 199, 0.85)';
        ctx.fillText(f.sub, x, y + 9 * dpr);
      }
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'start';
  }

  /** Après une retouche (couleurs, capitales, frontières) : icônes de villes à redessiner. */
  refreshPolitics(): void {
    if (this.world) this.icons.setWorld(this.world);
  }

  setWorld(world: WorldData): void {
    this.world = world;
    this.icons.setWorld(world);
    this.qMin = 180 / Math.max(0.05, world.settings.riverDensity);
    this.rivers = buildRiverLines(world);
    this.riverCache = null;

    const pol = world.politics;
    this.routes = [0, 1].map(() => Array.from({ length: ROUTE_CLASSES }, () => new Path2D()));
    let maxV = 0;
    for (const v of pol.routeVolume) maxV = Math.max(maxV, v);
    for (let s = 0; s < pol.routeKind.length; s++) {
      const c = Math.max(0, Math.min(ROUTE_CLASSES - 1, Math.floor(Math.log2((pol.routeVolume[s] / maxV) * 256))));
      const path = this.routes[pol.routeKind[s]][c];
      const a = pol.routeOffsets[s], b = pol.routeOffsets[s + 1];
      path.moveTo(pol.routePts[a * 2], pol.routePts[a * 2 + 1]);
      for (let k = a + 1; k < b; k++) path.lineTo(pol.routePts[k * 2], pol.routePts[k * 2 + 1]);
    }
  }

  /** Dessine la couche ; renvoie `true` s'il reste du travail (tuiles de végétation) pour l'image suivante. */
  draw(ctx: CanvasRenderingContext2D, cam: Camera, vw: number, vh: number, opts: OverlayOptions, clear = true): boolean {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (clear) ctx.clearRect(0, 0, vw, vh);
    const world = this.world;
    if (!world) return false;
    const W = world.W;
    const ox = vw / 2 - cam.cx * cam.scale;
    const oy = vh / 2 - cam.cy * cam.scale;
    // copies horizontales nécessaires pour couvrir la vue (carte bouclée)
    const kMin = Math.floor(-ox / (W * cam.scale)) - 1;
    const kMax = Math.ceil((vw - ox) / (W * cam.scale)) + 1;
    const dpr = opts.pixelRatio ?? (window.devicePixelRatio || 1);
    const s = cam.scale / dpr;
    const geo = GEO_MODES.includes(opts.mode);

    const showRivers = opts.rivers && ['terrain', 'relief', 'biomes', 'political', 'provinces', 'states', 'regions', 'influence', 'cultures', 'religions'].includes(opts.mode);
    if (showRivers) this.drawRivers(ctx, cam, vw, vh, ox, oy, kMin, kMax, dpr, opts, geo);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.iconsPending = false;

    if (opts.mode === 'trade') this.drawRoutes(ctx, cam, ox, oy, kMin, kMax, dpr);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.setLineDash([]);
    if (opts.mode === 'plates') this.drawPlates(ctx, world, cam, ox, oy, kMin, kMax);
    if (opts.mode === 'temperature' || opts.mode === 'precipitation') this.drawWind(ctx, world, cam, vw, vh, ox, oy);
    if (opts.mode === 'continents') this.drawContinentLabels(ctx, world, cam, ox, oy, kMin, kMax, dpr);
    if (geo) {
      const pol = world.politics;
      if (opts.mode === 'cultures') this.drawLoreLabels(ctx, pol.cultures, world.W, cam, ox, oy, kMin, kMax, dpr);
      else if (opts.mode === 'religions') {
        this.drawLoreLabels(ctx, pol.religions.filter((r) => r.provinces > 3), world.W, cam, ox, oy, kMin, kMax, dpr);
      } else if (opts.mode === 'states') {
        // noms des pays de loin, des États de près
        this.drawCountryLabels(ctx, world, cam, ox, oy, kMin, kMax, dpr, 0.45);
        this.drawAreaNames(ctx, pol.states, world.W, cam, ox, oy, kMin, kMax, dpr, 2.5);
      } else if (opts.mode === 'regions') {
        this.drawAreaNames(ctx, pol.regions, world.W, cam, ox, oy, kMin, kMax, dpr, 0);
      } else if (opts.mode !== 'trade' || s < 3) this.drawCountryLabels(ctx, world, cam, ox, oy, kMin, kMax, dpr, opts.mode === 'political' ? 1 : 0.55);
      if (opts.selectedCity !== undefined && opts.selectedCity >= 0) this.drawTradeLinks(ctx, world, cam, ox, oy, kMin, kMax, dpr, opts.selectedCity);
      this.drawCities(ctx, world, cam, vw, vh, ox, oy, kMin, kMax, dpr, opts);
      if (opts.mode === 'religions') this.drawHolyCities(ctx, world, cam, ox, oy, kMin, kMax, dpr);
    }
    if (this.flashes.length) this.drawFlashes(ctx, cam, ox, oy, kMin, kMax, dpr, world.W);
    // icônes encore à dessiner à la bonne taille : on redemande une image
    return this.iconsPending;
  }

  /**
   * Fleuves en rubans continus : largeur croissant doucement avec le débit (pas de paliers), berge
   * sombre tracée d'abord puis l'eau par-dessus pour tout le réseau, si bien que les confluences se
   * fondent sans bourrelet. Les petits cours d'eau n'apparaissent qu'en zoomant.
   */
  private drawRivers(
    ctx: CanvasRenderingContext2D, cam: Camera, vw: number, vh: number, ox: number, oy: number,
    kMin: number, kMax: number, dpr: number, opts: OverlayOptions, geo: boolean,
  ): void {
    const s = cam.scale / dpr;
    // niveau de débit (log2 du débit relatif au seuil des fleuves) visible à ce zoom
    const lMin = s < 0.8 ? 4 : s < 1.5 ? 3 : s < 2.5 ? 2.1 : s < 4 ? 1.3 : s < 7 ? 0.6 : 0;
    const x0 = -ox / cam.scale, x1 = (vw - ox) / cam.scale, y0 = -oy / cam.scale, y1 = (vh - oy) / cam.scale;
    let c = this.riverCache;
    // les rubans déjà construits servent tels quels pendant un déplacement (même échelle) ; pendant un
    // zoom, ceux d'une échelle voisine aussi (le trait grossit ou s'affine un instant) : on ne reconstruit
    // le réseau qu'une fois le geste terminé, ou si la vue sort de la zone préparée
    const inside = !!c && c.dpr === dpr && x0 >= c.x0 && x1 <= c.x1 && y0 >= c.y0 && y1 <= c.y1;
    const near = !!c && cam.scale / c.scale < 2.2 && c.scale / cam.scale < 2.2;
    if (!c || !inside || (c.scale !== cam.scale && !(opts.interacting && near)) || (!opts.interacting && c.rough)) {
      const mx = (x1 - x0) * 0.5, my = (y1 - y0) * 0.5;
      // pendant un geste, tracé grossier (un sommet tous les 4 px) : il sera affiné à l'arrêt
      c = this.buildRibbons(cam.scale, dpr, lMin, x0 - mx, x1 + mx, y0 - my, y1 + my, kMin, kMax, !!opts.interacting);
      this.riverCache = c;
    }
    ctx.save();
    ctx.setTransform(cam.scale, 0, 0, cam.scale, ox, oy);
    const relief = opts.mode === 'relief';
    ctx.globalAlpha = opts.dimRivers ? 0.35 : 1;
    ctx.fillStyle = geo ? 'rgba(28, 46, 62, 0.42)' : 'rgba(30, 50, 64, 0.5)';
    ctx.fill(c.bank);
    ctx.fillStyle = relief ? 'rgb(52, 104, 172)' : geo ? 'rgba(62, 100, 128, 0.88)' : 'rgb(66, 108, 138)';
    ctx.fill(c.water);
    ctx.restore();
  }

  /**
   * Rubans des fleuves visibles dans la zone [x0, x1] × [y0, y1] (cellules) à l'échelle donnée. Les points
   * plus proches qu'un pixel et demi à l'écran sont sautés : de loin, un fleuve n'a besoin que de quelques
   * sommets, et le remplissage du chemin reste rapide.
   */
  private buildRibbons(scale: number, dpr: number, lMin: number, x0: number, x1: number, y0: number, y1: number, kMin: number, kMax: number, rough = false): RiverCache {
    const world = this.world!;
    const W = world.W;
    const s = scale / dpr;
    const zf = Math.max(0.55, Math.min(2.4, Math.sqrt(s / 2)));
    const pxPerKm = scale / ((2 * Math.PI * R_EARTH_KM) / W);
    const half = (q: number): number => {
      const l = Math.log2(Math.max(q, this.qMin) / this.qMin);
      const px = (0.3 + 0.3 * Math.max(0, l - lMin)) * zf * dpr;
      // au fort zoom, largeur physique (≈ 5,5 m × √débit) si elle est plus grande
      return Math.max(px, Math.min(0.6, 0.0055 * Math.sqrt(q)) * pxPerKm) / 2;
    };
    const qVis = this.qMin * Math.pow(2, lMin);
    const step = ((rough ? 4 : 2) * dpr) / scale;
    const edge = (1.1 * dpr) / scale;
    const bank = new Path2D(), water = new Path2D();
    const L: number[] = [], R: number[] = [], Lb: number[] = [], Rb: number[] = [];
    const ribbon = (path: Path2D, A: number[], B: number[]) => {
      path.moveTo(A[0], A[1]);
      for (let j = 2; j < A.length; j += 2) path.lineTo(A[j], A[j + 1]);
      for (let j = B.length - 2; j >= 0; j -= 2) path.lineTo(B[j], B[j + 1]);
      path.closePath();
    };
    for (const r of this.rivers) {
      if (r.qMax < qVis || r.maxY < y0 || r.minY > y1) continue;
      for (let k = kMin - 1; k <= kMax + 1; k++) {
        const sh = k * W;
        if (r.maxX + sh < x0 || r.minX + sh > x1) continue;
        let a = 0;
        while (a < r.n && r.qs[a] < qVis) a++;
        if (r.n - a < 2) continue;
        L.length = R.length = Lb.length = Rb.length = 0;
        let lx = Infinity, ly = Infinity, emitted = 0;
        for (let i = a; i < r.n; i++) {
          const x = r.xs[i] + sh, y = r.ys[i];
          if (i < r.n - 1 && Math.abs(x - lx) + Math.abs(y - ly) < step) continue;
          lx = x;
          ly = y;
          // effilement sur les premiers points visibles
          const taper = Math.min(1, 0.35 + 0.65 * (emitted / 3));
          emitted++;
          const h = (half(r.qs[i]) * taper) / scale, hb = h + edge;
          const nx = r.nx[i], ny = r.ny[i];
          L.push(x + nx * h, y + ny * h);
          R.push(x - nx * h, y - ny * h);
          Lb.push(x + nx * hb, y + ny * hb);
          Rb.push(x - nx * hb, y - ny * hb);
        }
        if (L.length < 4) continue;
        ribbon(bank, Lb, Rb);
        ribbon(water, L, R);
      }
    }
    return { scale, dpr, x0, x1, y0, y1, bank, water, rough };
  }

  private drawLoreLabels(
    ctx: CanvasRenderingContext2D, items: { name: string; label: LabelPath | null }[], W: number, cam: Camera,
    ox: number, oy: number, kMin: number, kMax: number, dpr: number,
  ): void {
    for (const it of items) {
      if (!it.label) continue;
      for (let k = kMin; k <= kMax; k++) curvedText(ctx, it.name.toUpperCase(), it.label, ox + k * W * cam.scale, oy, cam.scale, dpr, 0.9, 'lore');
    }
  }

  /**
   * Noms d'États ou de régions : en arc quand la place le permet, sinon petite étiquette droite au
   * centre, posée par ordre de superficie sans chevaucher les précédentes (lisible à tous les zooms).
   */
  private drawAreaNames(
    ctx: CanvasRenderingContext2D, items: { name: string; label: LabelPath | null; area: number }[], W: number, cam: Camera,
    ox: number, oy: number, kMin: number, kMax: number, dpr: number, minS: number,
  ): void {
    const s = cam.scale / dpr;
    const small = 10.5 * dpr;
    const boxes: [number, number, number, number][] = [];
    const order = items.map((_, i) => i).filter((i) => items[i].label).sort((a, b) => items[b].area - items[a].area);
    for (const i of order) {
      const it = items[i];
      const lab = it.label!;
      const curved = lab.size * cam.scale >= 14 * dpr;
      for (let k = kMin; k <= kMax; k++) {
        const ox2 = ox + k * W * cam.scale;
        if (curved) {
          curvedText(ctx, it.name.toUpperCase(), lab, ox2, oy, cam.scale, dpr, 0.9, 'lore');
          continue;
        }
        if (s < minS) continue;
        const x = ox2 + (0.25 * lab.x0 + 0.5 * lab.cx + 0.25 * lab.x1) * cam.scale;
        const y = oy + (0.25 * lab.y0 + 0.5 * lab.cy + 0.25 * lab.y1) * cam.scale;
        if (x < -150 || x > ctx.canvas.width + 150 || y < -20 || y > ctx.canvas.height + 20) continue;
        ctx.font = `italic 600 ${small}px ${SERIF}`;
        const tw = ctx.measureText(it.name).width;
        const b: [number, number, number, number] = [x - tw / 2 - 4 * dpr, y - small * 0.75, x + tw / 2 + 4 * dpr, y + small * 0.75];
        if (boxes.some((o) => o[0] < b[2] && b[0] < o[2] && o[1] < b[3] && b[1] < o[3])) continue;
        boxes.push(b);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.lineJoin = 'round';
        ctx.lineWidth = 3 * dpr;
        ctx.strokeStyle = 'rgba(250, 240, 215, 0.55)';
        ctx.strokeText(it.name, x, y);
        ctx.fillStyle = 'rgba(48, 30, 14, 0.9)';
        ctx.fillText(it.name, x, y);
      }
    }
    ctx.textAlign = 'start';
  }

  /** Symbole sacré au-dessus des villes saintes. */
  private drawHolyCities(ctx: CanvasRenderingContext2D, world: WorldData, cam: Camera, ox: number, oy: number, kMin: number, kMax: number, dpr: number): void {
    const pol = world.politics;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `${16 * dpr}px ${SERIF}`;
    for (const r of pol.religions) {
      if (r.holyCity < 0 || r.provinces === 0) continue;
      const c = pol.cities[r.holyCity];
      for (let k = kMin; k <= kMax; k++) {
        const x = ox + (c.x + k * world.W) * cam.scale, y = oy + c.y * cam.scale - 16 * dpr;
        ctx.beginPath();
        ctx.arc(x, y, 11 * dpr, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${r.color.join(',')}, 0.95)`;
        ctx.strokeStyle = 'rgba(250, 230, 170, 0.95)';
        ctx.lineWidth = 1.6 * dpr;
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#fff8e0';
        ctx.fillText(r.symbol, x, y + dpr);
      }
    }
    ctx.textAlign = 'start';
  }

  private drawRoutes(ctx: CanvasRenderingContext2D, cam: Camera, ox: number, oy: number, kMin: number, kMax: number, dpr: number): void {
    const W = this.world!.W;
    const zoom = dpr * Math.max(0.55, Math.min(2.2, Math.pow(cam.scale / dpr / 2, 0.45)));
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    for (let k = kMin; k <= kMax; k++) {
      ctx.setTransform(cam.scale, 0, 0, cam.scale, ox + k * W * cam.scale, oy);
      // lignes maritimes (pointillés) puis routes terrestres, des moins fréquentées aux plus fréquentées
      for (let c = 0; c < ROUTE_CLASSES; c++) {
        const t = c / (ROUTE_CLASSES - 1);
        ctx.setLineDash([(5 * dpr) / cam.scale, (4 * dpr) / cam.scale]);
        ctx.strokeStyle = `rgba(${Math.round(170 + 60 * t)}, ${Math.round(205 + 35 * t)}, 240, ${0.28 + 0.5 * t})`;
        ctx.lineWidth = ((0.5 + 0.38 * c) * zoom) / cam.scale;
        ctx.stroke(this.routes[1][c]);
      }
      ctx.setLineDash([]);
      for (let c = 0; c < ROUTE_CLASSES; c++) {
        const t = c / (ROUTE_CLASSES - 1);
        ctx.strokeStyle = `rgba(${Math.round(120 + 120 * t)}, ${Math.round(80 + 105 * t)}, ${Math.round(40 + 60 * t)}, ${0.45 + 0.5 * t})`;
        ctx.lineWidth = ((0.55 + 0.42 * c) * zoom) / cam.scale;
        ctx.stroke(this.routes[0][c]);
      }
    }
  }

  private drawCountryLabels(ctx: CanvasRenderingContext2D, world: WorldData, cam: Camera, ox: number, oy: number, kMin: number, kMax: number, dpr: number, alpha: number): void {
    for (const c of this.countryLabels ?? world.politics.countries) {
      if (!c.label) continue;
      for (let k = kMin; k <= kMax; k++) {
        curvedText(ctx, c.name.toUpperCase(), c.label, ox + k * world.W * cam.scale, oy, cam.scale, dpr, alpha, 'country');
      }
    }
  }

  private drawContinentLabels(ctx: CanvasRenderingContext2D, world: WorldData, cam: Camera, ox: number, oy: number, kMin: number, kMax: number, dpr: number): void {
    for (const c of world.politics.continents) {
      if (!c.label || (c.kind === 'archipel' && c.landArea < 150000)) continue;
      for (let k = kMin; k <= kMax; k++) {
        curvedText(ctx, c.name.toUpperCase(), c.label, ox + k * world.W * cam.scale, oy, cam.scale, dpr, 1, 'continent');
      }
    }
  }

  private drawCities(
    ctx: CanvasRenderingContext2D, world: WorldData, cam: Camera, vw: number, vh: number,
    ox: number, oy: number, kMin: number, kMax: number, dpr: number, opts: OverlayOptions,
  ): void {
    const pol = world.politics;
    const s = cam.scale / dpr;
    const t0 = performance.now();
    // en mode Régions, les villes s'effacent davantage derrière les noms des régions
    const minPop = opts.mode === 'regions' ? cityMinPop(s / 3) : cityMinPop(s);
    const namePop = s < 1.2 ? Infinity : s < 2 ? 2e6 : s < 3.5 ? 7e5 : s < 6 ? 2e5 : 0;
    const taken: [number, number, number, number][] = [];
    const overlaps = (b: [number, number, number, number]) => taken.some((r) => b[0] < r[2] && b[2] > r[0] && b[1] < r[3] && b[3] > r[1]);
    const icons = !!opts.icons;
    // icônes : de l'arrière (nord) vers l'avant (sud) pour un chevauchement naturel ; pastilles : capitales d'abord
    const order = icons
      ? pol.cities.filter((c) => c.capital || c.pop >= minPop || c.id === opts.selectedCity || c.id === opts.hoverCity).sort((a, b) => a.y - b.y)
      : pol.cities.filter((c) => c.capital).concat(pol.cities.filter((c) => !c.capital));
    const labels: { text: string; x: number; y: number; capital: boolean; selected: boolean }[] = [];
    ctx.lineJoin = 'round';
    for (const city of order) {
      const selected = city.id === opts.selectedCity || city.id === opts.hoverCity;
      if (!city.capital && city.pop < minPop && !selected) continue;
      // icône trop petite à ce zoom : simple repère
      const hCss = CityIcons.size(city, s);
      const asIcon = icons && hCss >= CityIcons.MIN_ICON;
      for (let k = kMin; k <= kMax; k++) {
        const x = ox + (city.x + k * world.W) * cam.scale;
        const y = oy + city.y * cam.scale;
        const m = asIcon ? hCss * 2 * dpr : 60;
        if (x < -m || x > vw + m || y < -20 || y > vh + m) continue;
        let lx: number, ly: number;
        if (asIcon) {
          const h = hCss * dpr;
          // budget de dessin d'icônes neuves par image ; au-delà, la taille voisine déjà prête (agrandie)
          const ic = this.icons.get(city, h, performance.now() - t0 < 6) ?? this.icons.get(city, h, false);
          if (!ic) {
            this.iconsPending = true;
            continue;
          }
          const ks = h / ic.h;
          if (selected) {
            const g = ctx.createRadialGradient(x, y - h * 0.3, 0, x, y - h * 0.3, h * 0.9);
            g.addColorStop(0, 'rgba(255, 226, 140, 0.55)');
            g.addColorStop(1, 'rgba(255, 226, 140, 0)');
            ctx.fillStyle = g;
            ctx.fillRect(x - h, y - h * 1.3, 2 * h, 2 * h);
          }
          if (ks > 0.98 && ks < 1.02) ctx.drawImage(ic.img, Math.round(x - ic.ax), Math.round(y - ic.ay));
          else ctx.drawImage(ic.img, x - ic.ax * ks, y - ic.ay * ks, ic.c.width * ks, ic.c.height * ks);
          if (Math.abs(Math.log(ks)) > 0.13) this.iconsPending = true;
          lx = x + h * 0.62 + 3 * dpr;
          ly = y - h * 0.32;
        } else {
          const r = Math.max(1.6, Math.min(5, 1.4 + 1.1 * Math.log10(city.pop / 5e4))) * dpr * (s < 1.5 ? 0.8 : 1) * (icons ? 0.85 : 1);
          if (city.capital) star(ctx, x, y, r * 1.9, selected, dpr);
          else {
            ctx.beginPath();
            ctx.arc(x, y, r, 0, Math.PI * 2);
            ctx.fillStyle = selected ? '#ffe7a3' : 'rgba(245, 240, 225, 0.95)';
            ctx.strokeStyle = 'rgba(15, 14, 12, 0.9)';
            ctx.lineWidth = 1.2 * dpr;
            ctx.fill();
            ctx.stroke();
          }
          lx = x + r + 4 * dpr;
          ly = y;
        }
        if (s < 1.2 || !(city.pop >= namePop || selected || city.capital)) continue;
        labels.push({ text: city.name, x: lx, y: ly, capital: city.capital, selected });
      }
    }
    // noms par-dessus toutes les icônes, capitales et sélection prioritaires
    labels.sort((a, b) => Number(b.selected) - Number(a.selected) || Number(b.capital) - Number(a.capital));
    for (const l of labels) {
      const sp = this.labelSprite(l.text, l.capital ? 1 : l.selected ? 2 : 0, dpr);
      const box: [number, number, number, number] = [l.x - 2, l.y - 7 * dpr, l.x + sp.w + 2, l.y + 7 * dpr];
      if (!l.selected && overlaps(box)) continue;
      taken.push(box);
      ctx.drawImage(sp.img, Math.round(l.x - sp.pad), Math.round(l.y - sp.c.height / 2));
    }
  }

  /** Nom de ville pré-rendu (contour + remplissage) : le tracé de texte coûte cher à chaque image. */
  private labelSprite(text: string, style: number, dpr: number): { c: HTMLCanvasElement; img: CanvasImageSource; w: number; pad: number } {
    const key = `${style}|${dpr}|${text}`;
    let sp = this.labelCache.get(key);
    if (sp) return sp;
    if (this.labelCache.size > 4000) this.labelCache.clear();
    const font = `600 ${11 * dpr}px system-ui, sans-serif`;
    const m = document.createElement('canvas').getContext('2d')!;
    m.font = font;
    const w = m.measureText(text).width;
    const pad = Math.ceil(3 * dpr);
    const c = document.createElement('canvas');
    c.width = Math.ceil(w + pad * 2);
    c.height = Math.ceil(16 * dpr);
    const g = c.getContext('2d')!;
    g.font = font;
    g.textBaseline = 'middle';
    g.lineJoin = 'round';
    g.lineWidth = 3 * dpr;
    g.strokeStyle = 'rgba(12, 12, 10, 0.75)';
    g.strokeText(text, pad, c.height / 2);
    g.fillStyle = style === 1 ? '#f3e2b0' : style === 2 ? '#ffe7a3' : 'rgba(240, 236, 224, 0.95)';
    g.fillText(text, pad, c.height / 2);
    const entry = { c, img: c as CanvasImageSource, w, pad };
    if (typeof createImageBitmap === 'function') void createImageBitmap(c).then((b) => (entry.img = b)).catch(() => {});
    this.labelCache.set(key, entry);
    return entry;
  }

  private drawTradeLinks(ctx: CanvasRenderingContext2D, world: WorldData, cam: Camera, ox: number, oy: number, kMin: number, kMax: number, dpr: number, id: number): void {
    const pol = world.politics;
    const a = pol.cities[id];
    if (!a || !a.partners.length) return;
    const W = world.W;
    const maxShare = Math.max(1e-6, ...a.partners.map((p) => p.share));
    for (let k = kMin; k <= kMax; k++) {
      const x0 = ox + (a.x + k * W) * cam.scale, y0 = oy + a.y * cam.scale;
      for (const p of [...a.partners].reverse()) {
        const b = pol.cities[p.id];
        let bx = b.x;
        if (bx - a.x > W / 2) bx -= W;
        else if (bx - a.x < -W / 2) bx += W;
        const x1 = ox + (bx + k * W) * cam.scale, y1 = oy + b.y * cam.scale;
        const dx = x1 - x0, dy = y1 - y0;
        const len = Math.hypot(dx, dy);
        // arc bombé, proportionnel à la distance
        const cx = (x0 + x1) / 2 - dy * 0.18, cy = (y0 + y1) / 2 + dx * 0.18 - len * 0.12;
        const t = p.share / maxShare;
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.quadraticCurveTo(cx, cy, x1, y1);
        ctx.strokeStyle = 'rgba(10, 8, 5, 0.55)';
        ctx.lineWidth = (2.5 + 5 * t) * dpr;
        ctx.stroke();
        ctx.strokeStyle = `rgba(242, 196, 92, ${0.55 + 0.4 * t})`;
        ctx.lineWidth = (1 + 3.5 * t) * dpr;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(x1, y1, (3 + 3 * t) * dpr, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(242, 196, 92, 0.95)';
        ctx.lineWidth = 1.5 * dpr;
        ctx.stroke();
      }
    }
  }

  private drawPlates(ctx: CanvasRenderingContext2D, world: WorldData, cam: Camera, ox: number, oy: number, kMin: number, kMax: number): void {
    const dpr = window.devicePixelRatio || 1;
    ctx.font = `${600} ${12 * dpr}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    for (const p of world.plates) {
      const len = Math.hypot(p.vx, p.vy);
      const L = (18 + 42 * Math.min(1, len)) * dpr;
      const dx = (p.vx / (len || 1)) * L, dy = (p.vy / (len || 1)) * L;
      for (let k = kMin; k <= kMax; k++) {
        const x = ox + (p.cx + k * world.W) * cam.scale;
        const y = oy + p.cy * cam.scale;
        ctx.strokeStyle = 'rgba(10,12,14,0.85)';
        ctx.fillStyle = 'rgba(245,240,225,0.95)';
        ctx.lineWidth = 5 * dpr;
        arrow(ctx, x, y, x + dx, y + dy, 9 * dpr);
        ctx.stroke();
        ctx.strokeStyle = plateColorCss(p.id, p.continental);
        ctx.lineWidth = 2.2 * dpr;
        arrow(ctx, x, y, x + dx, y + dy, 9 * dpr);
        ctx.stroke();
        const label = `${p.continental ? 'Continentale' : 'Océanique'} ${p.id + 1}`;
        ctx.lineWidth = 3 * dpr;
        ctx.strokeStyle = 'rgba(10,12,14,0.8)';
        ctx.strokeText(label, x, y - 8 * dpr);
        ctx.fillText(label, x, y - 8 * dpr);
      }
    }
    ctx.textAlign = 'start';
  }

  private drawWind(ctx: CanvasRenderingContext2D, world: WorldData, cam: Camera, vw: number, vh: number, ox: number, oy: number): void {
    const dpr = window.devicePixelRatio || 1;
    const f = world.W / world.windW;
    const spacingPx = 46 * dpr;
    const stepCells = Math.max(1, Math.round(spacingPx / (cam.scale * f)));
    ctx.strokeStyle = 'rgba(20,24,28,0.55)';
    ctx.lineWidth = 1.3 * dpr;
    const x0 = Math.floor(-ox / cam.scale / f) - stepCells;
    const x1 = Math.ceil((vw - ox) / cam.scale / f) + stepCells;
    const y0 = Math.max(0, Math.floor(-oy / cam.scale / f));
    const y1 = Math.min(world.windH - 1, Math.ceil((vh - oy) / cam.scale / f));
    for (let yc = y0 - (y0 % stepCells); yc <= y1; yc += stepCells) {
      if (yc < 0) continue;
      for (let xs = x0 - (((x0 % stepCells) + stepCells) % stepCells); xs <= x1; xs += stepCells) {
        const xc = ((xs % world.windW) + world.windW) % world.windW;
        const i = yc * world.windW + xc;
        // (u, v) sont en cellules : c'est déjà la direction telle qu'affichée en projection équirectangulaire
        const u = world.windU[i], v = world.windV[i];
        const l = Math.hypot(u, v) || 1;
        const L = 16 * dpr;
        const cx = ox + (xs + 0.5) * f * cam.scale, cy = oy + (yc + 0.5) * f * cam.scale;
        arrow(ctx, cx - (u / l) * L * 0.5, cy - (v / l) * L * 0.5, cx + (u / l) * L * 0.5, cy + (v / l) * L * 0.5, 5 * dpr);
        ctx.stroke();
      }
    }
  }
}

/** Texte le long d'une Bézier quadratique, lettre par lettre, espacement large façon HOI4. */
function curvedText(
  ctx: CanvasRenderingContext2D, text: string, lab: LabelPath, ox: number, oy: number,
  scale: number, dpr: number, alpha: number, kind: 'country' | 'continent' | 'lore',
): void {
  const P0x = ox + lab.x0 * scale, P0y = oy + lab.y0 * scale;
  const Cx = ox + lab.cx * scale, Cy = oy + lab.cy * scale;
  const P1x = ox + lab.x1 * scale, P1y = oy + lab.y1 * scale;
  if (Math.max(P0x, P1x, Cx) < -200 || Math.min(P0x, P1x, Cx) > ctx.canvas.width + 200) return;
  let size = lab.size * scale;
  const minPx = 10 * dpr, maxPx = (kind === 'continent' ? 110 : 80) * dpr;
  // les grands noms s'estompent quand on zoome fort (on lit alors provinces et villes)
  const fade = alpha * Math.min(1, Math.max(0, (size - minPx) / (4 * dpr))) * Math.min(1, Math.max(0, (maxPx * 1.6 - size) / (maxPx * 0.6)));
  if (fade <= 0.02) return;
  size = Math.min(size, maxPx);
  const S = 40;
  const pts: number[] = [];
  const cum: number[] = [0];
  for (let i = 0; i <= S; i++) {
    const t = i / S, u = 1 - t;
    pts.push(u * u * P0x + 2 * u * t * Cx + t * t * P1x, u * u * P0y + 2 * u * t * Cy + t * t * P1y);
    if (i > 0) cum.push(cum[i - 1] + Math.hypot(pts[i * 2] - pts[i * 2 - 2], pts[i * 2 + 1] - pts[i * 2 - 1]));
  }
  const total = cum[S];
  const weight = kind === 'continent' ? 400 : 600;
  const style = kind === 'lore' ? 'italic ' : '';
  ctx.font = `${style}${weight} ${size}px ${SERIF}`;
  const chars = [...text];
  let widths = chars.map((ch) => ctx.measureText(ch).width);
  let spacing = size * (kind === 'continent' ? 0.55 : kind === 'lore' ? 0.3 : 0.22);
  let len = widths.reduce((a, b) => a + b, 0) + spacing * (chars.length - 1);
  if (len > total) {
    const k = total / len;
    size *= k;
    ctx.font = `${style}${weight} ${size}px ${SERIF}`;
    widths = chars.map((ch) => ctx.measureText(ch).width);
    spacing *= k;
    len = total;
  }
  const at = (d: number): [number, number, number] => {
    let i = 1;
    while (i < S && cum[i] < d) i++;
    const f = (d - cum[i - 1]) / Math.max(1e-6, cum[i] - cum[i - 1]);
    const x = pts[i * 2 - 2] + (pts[i * 2] - pts[i * 2 - 2]) * f;
    const y = pts[i * 2 - 1] + (pts[i * 2 + 1] - pts[i * 2 - 1]) * f;
    return [x, y, Math.atan2(pts[i * 2 + 1] - pts[i * 2 - 1], pts[i * 2] - pts[i * 2 - 2])];
  };
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  ctx.lineJoin = 'round';
  let d = (total - len) / 2;
  for (let i = 0; i < chars.length; i++) {
    const [x, y, a] = at(d + widths[i] / 2);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(a);
    if (kind === 'continent') {
      ctx.lineWidth = Math.max(2, size * 0.08);
      ctx.strokeStyle = `rgba(10, 12, 14, ${0.55 * fade})`;
      ctx.strokeText(chars[i], 0, 0);
      ctx.fillStyle = `rgba(246, 240, 222, ${0.9 * fade})`;
    } else if (kind === 'lore') {
      ctx.lineWidth = Math.max(1.5, size * 0.08);
      ctx.strokeStyle = `rgba(250, 240, 215, ${0.35 * fade})`;
      ctx.strokeText(chars[i], 0, 0);
      ctx.fillStyle = `rgba(48, 30, 14, ${0.72 * fade})`;
    } else {
      ctx.lineWidth = Math.max(1.5, size * 0.07);
      ctx.strokeStyle = `rgba(250, 244, 228, ${0.22 * fade})`;
      ctx.strokeText(chars[i], 0, 0);
      ctx.fillStyle = `rgba(22, 18, 14, ${0.68 * fade})`;
    }
    ctx.fillText(chars[i], 0, 0);
    ctx.restore();
    d += widths[i] + spacing;
  }
  ctx.textAlign = 'start';
}

function star(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, selected: boolean, dpr: number): void {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 === 0 ? r : r * 0.45;
    const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = selected ? '#ffe7a3' : '#f1e6c8';
  ctx.strokeStyle = 'rgba(15, 14, 12, 0.95)';
  ctx.lineWidth = 1.3 * dpr;
  ctx.fill();
  ctx.stroke();
}

function arrow(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, head: number): void {
  const a = Math.atan2(y1 - y0, x1 - x0);
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.moveTo(x1 - head * Math.cos(a - 0.45), y1 - head * Math.sin(a - 0.45));
  ctx.lineTo(x1, y1);
  ctx.lineTo(x1 - head * Math.cos(a + 0.45), y1 - head * Math.sin(a + 0.45));
}

interface RiverCache {
  scale: number;
  dpr: number;
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  bank: Path2D;
  water: Path2D;
  /** tracé simplifié fait pendant un geste */
  rough: boolean;
}

interface RiverLine {
  n: number;
  xs: Float32Array;
  ys: Float32Array;
  qs: Float32Array;
  /** normale unitaire (gauche) en chaque point */
  nx: Float32Array;
  ny: Float32Array;
  qMax: number;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

/**
 * Prépare les fleuves pour le tracé en rubans : un lissage supplémentaire, l'embouchure d'un affluent
 * raccordée exactement au point le plus proche de la rivière qui le reçoit, normales en chaque point.
 */
function buildRiverLines(world: WorldData): RiverLine[] {
  const { riverPts: rp, riverOffsets: ro, W } = world;
  const raw: { xs: number[]; ys: number[]; qs: number[] }[] = [];
  for (let r = 0; r < ro.length - 1; r++) {
    const a = ro[r], b = ro[r + 1];
    if (b - a < 2) continue;
    let X: number[] = [], Y: number[] = [], Q: number[] = [];
    for (let k = a; k < b; k++) {
      X.push(rp[k * 3]);
      Y.push(rp[k * 3 + 1]);
      Q.push(rp[k * 3 + 2]);
    }
    // une passe de Chaikin de plus (extrémités conservées) : courbes douces au fort zoom
    const nx = [X[0]], ny = [Y[0]], nq = [Q[0]];
    for (let k = 0; k < X.length - 1; k++) {
      nx.push(0.75 * X[k] + 0.25 * X[k + 1], 0.25 * X[k] + 0.75 * X[k + 1]);
      ny.push(0.75 * Y[k] + 0.25 * Y[k + 1], 0.25 * Y[k] + 0.75 * Y[k + 1]);
      nq.push(0.75 * Q[k] + 0.25 * Q[k + 1], 0.25 * Q[k] + 0.75 * Q[k + 1]);
    }
    nx.push(X[X.length - 1]);
    ny.push(Y[Y.length - 1]);
    nq.push(Q[Q.length - 1]);
    X = nx;
    Y = ny;
    Q = nq;
    raw.push({ xs: X, ys: Y, qs: Q });
  }
  // grille de points (x ramené dans [0, W)) pour raccorder les embouchures d'affluents
  const key = (x: number, y: number) => Math.floor(y) * W + ((Math.floor(x) % W) + W) % W;
  const grid = new Map<number, [number, number][]>();
  raw.forEach((rv, ri) => rv.xs.forEach((x, i) => {
    const k = key(x, rv.ys[i]);
    const l = grid.get(k);
    if (l) l.push([ri, i]);
    else grid.set(k, [[ri, i]]);
  }));
  raw.forEach((rv, ri) => {
    const n = rv.xs.length;
    const ex = rv.xs[n - 1], ey = rv.ys[n - 1];
    let best: [number, number] | null = null, bd = 0.6 * 0.6;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        for (const [rj, j] of grid.get(key(ex + dx, ey + dy)) ?? []) {
          if (rj === ri || j === raw[rj].xs.length - 1) continue;
          let px = raw[rj].xs[j];
          while (px - ex > W / 2) px -= W;
          while (px - ex < -W / 2) px += W;
          const d = (px - ex) ** 2 + (raw[rj].ys[j] - ey) ** 2;
          if (d < bd) {
            bd = d;
            best = [rj, j];
          }
        }
      }
    }
    if (best) {
      let px = raw[best[0]].xs[best[1]];
      while (px - ex > W / 2) px -= W;
      while (px - ex < -W / 2) px += W;
      rv.xs[n - 1] = px;
      rv.ys[n - 1] = raw[best[0]].ys[best[1]];
    }
  });
  return raw.map((rv) => {
    const n = rv.xs.length;
    const xs = Float32Array.from(rv.xs), ys = Float32Array.from(rv.ys), qs = Float32Array.from(rv.qs);
    const nx = new Float32Array(n), ny = new Float32Array(n);
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, qMax = 0;
    for (let i = 0; i < n; i++) {
      const a = Math.max(0, i - 1), b = Math.min(n - 1, i + 1);
      const tx = xs[b] - xs[a], ty = ys[b] - ys[a];
      const l = Math.hypot(tx, ty) || 1;
      nx[i] = -ty / l;
      ny[i] = tx / l;
      minX = Math.min(minX, xs[i]);
      maxX = Math.max(maxX, xs[i]);
      minY = Math.min(minY, ys[i]);
      maxY = Math.max(maxY, ys[i]);
      qMax = Math.max(qMax, qs[i]);
    }
    return { n, xs, ys, qs, nx, ny, qMax, minX, maxX, minY, maxY };
  });
}
