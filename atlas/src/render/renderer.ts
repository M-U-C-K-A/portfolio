import { NONE16, type WorldData } from '../gen/types';
import { R_EARTH_KM } from '../gen/grid';
import { modeIndex, type MapMode } from './modes';
import { buildClimateLut, buildPalette, buildPolPalette, POL_PAL_ROWS, LUT_A_MAX, LUT_A_MIN, LUT_H, LUT_T_MAX, LUT_T_MIN, LUT_W } from './palette';
import { FRAG, VERT } from './shaders';

export { MAP_MODES, type MapMode } from './modes';

export interface Camera {
  /** Centre de la vue (cellules). */
  cx: number;
  cy: number;
  /** Pixels (device) par cellule. */
  scale: number;
}

export interface RenderOptions {
  mode: MapMode;
  exaggeration: number;
  grid: boolean;
  hoverCountry?: number;
  selectedCountry?: number;
  /** Couche nuageuse animée. */
  clouds?: boolean;
  /** Cycle jour / nuit. */
  night?: boolean;
  /** Forêts peintes dans le terrain. */
  forests?: boolean;
  /**
   * Fraction de la résolution (≤ 1) : pendant un déplacement, l'image est calculée en plus petit puis
   * agrandie (le shader du terrain coûte par pixel), et recalculée en pleine résolution à l'arrêt.
   */
  quality?: number;
  /** Secondes écoulées (animation). */
  time?: number;
  /** Direction du soleil sur la sphère unité. */
  sun?: [number, number, number];
}

type TexKey = 'height' | 'climate' | 'water' | 'misc' | 'lut' | 'palette' | 'pol' | 'polPal' | 'extra' | 'lore' | 'prov' | 'provT';
const UNITS: Record<TexKey, number> = { height: 0, climate: 1, water: 2, misc: 3, lut: 4, palette: 5, pol: 6, polPal: 7, extra: 8, lore: 9, prov: 10, provT: 11 };

export class MapRenderer {
  readonly gl: WebGL2RenderingContext;
  private readonly prog: WebGLProgram;
  private readonly loc: Record<string, WebGLUniformLocation | null> = {};
  private readonly tex = {} as Record<TexKey, WebGLTexture>;
  private world: WorldData | null = null;

  constructor(readonly canvas: HTMLCanvasElement) {
    const gl = canvas.getContext('webgl2', { antialias: false, preserveDrawingBuffer: true, alpha: false });
    if (!gl) throw new Error('WebGL2 n’est pas disponible dans ce navigateur.');
    this.gl = gl;
    this.prog = this.link(VERT, FRAG);
    gl.useProgram(this.prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(this.prog, 'aPos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const names = ['uHeight', 'uClimate', 'uWater', 'uMisc', 'uLut', 'uPalette', 'uWorld', 'uCenter', 'uScale',
      'uViewport', 'uMode', 'uExag', 'uCellKm', 'uLatMax', 'uGrid', 'uLutRange', 'uPol', 'uPolPal', 'uExtra', 'uHover', 'uSelected', 'uLore',
      'uTime', 'uClouds', 'uNight', 'uSun', 'uDpr', 'uProv', 'uForests', 'uProvT'];
    for (const n of names) this.loc[n] = gl.getUniformLocation(this.prog, n);
    (Object.keys(UNITS) as TexKey[]).forEach((k) => {
      this.tex[k] = gl.createTexture()!;
      const uniform = `u${k[0].toUpperCase()}${k.slice(1)}`;
      gl.uniform1i(this.loc[uniform], UNITS[k]);
    });

    this.upload('lut', gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, LUT_W, LUT_H, buildClimateLut(), gl.LINEAR, gl.CLAMP_TO_EDGE);
    gl.uniform4f(this.loc.uLutRange, LUT_T_MIN, LUT_T_MAX, LUT_A_MIN, LUT_A_MAX);
  }

  private link(vs: string, fs: string): WebGLProgram {
    const gl = this.gl;
    const compile = (type: number, src: string): WebGLShader => {
      const sh = gl.createShader(type)!;
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh) ?? 'shader');
      return sh;
    };
    const p = gl.createProgram()!;
    gl.attachShader(p, compile(gl.VERTEX_SHADER, vs));
    gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) ?? 'link');
    return p;
  }

  /**
   * Remplit une texture par bandes de lignes : pas de tableau intermédiaire de la taille du monde
   * (sur une carte de 8192 de large, un seul RGBA en flottants pèserait 430 Mo).
   */
  private uploadRows<T extends Float32Array | Uint8Array>(
    key: TexKey, internal: number, format: number, type: number, w: number, h: number, comps: number,
    make: (n: number) => T, fill: (y0: number, rows: number, out: T) => void, filter: number, wrapS: number,
  ): void {
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0 + UNITS[key]);
    gl.bindTexture(gl.TEXTURE_2D, this.tex[key]);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, internal, w, h, 0, format, type, null);
    const rowsPer = Math.max(1, Math.floor((1 << 22) / (w * comps)));
    const buf = make(rowsPer * w * comps);
    for (let y0 = 0; y0 < h; y0 += rowsPer) {
      const rows = Math.min(rowsPer, h - y0);
      const view = buf.subarray(0, rows * w * comps) as T;
      fill(y0, rows, view);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, y0, w, rows, format, type, view);
    }
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrapS);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }

  private upload(
    key: TexKey,
    internal: number,
    format: number,
    type: number,
    w: number,
    h: number,
    data: ArrayBufferView,
    filter: number,
    wrapS: number,
  ): void {
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0 + UNITS[key]);
    gl.bindTexture(gl.TEXTURE_2D, this.tex[key]);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, internal, w, h, 0, format, type, data);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrapS);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }

  /** Plus grande texture (donc plus grande largeur de monde) acceptée par la carte graphique. */
  get maxTextureSize(): number {
    return this.gl.getParameter(this.gl.MAX_TEXTURE_SIZE) as number;
  }

  setWorld(world: WorldData): void {
    const gl = this.gl;
    this.world = world;
    const { W, H } = world;
    const N = W * H;

    const F32 = (n: number) => new Float32Array(n);
    this.uploadRows('height', gl.R16F, gl.RED, gl.FLOAT, W, H, 1, F32, (y0, rows, out) => {
      for (let j = 0, i = y0 * W; j < rows * W; j++, i++) {
        const h = world.height[i];
        out[j] = world.ocean[i] ? Math.min(h, -2) : Math.max(h, 2);
      }
    }, gl.LINEAR, gl.REPEAT);

    this.uploadRows('climate', gl.RG16F, gl.RG, gl.FLOAT, W, H, 2, F32, (y0, rows, out) => {
      for (let j = 0, i = y0 * W; j < rows * W; j++, i++) {
        out[j * 2] = world.temperature[i];
        out[j * 2 + 1] = world.precipitation[i];
      }
    }, gl.LINEAR, gl.REPEAT);

    // rives des lacs : même champ de distance signée que les côtes (sinon rives en escalier au fort zoom)
    const sdf = coastDistance(world.ocean, W, H);
    const lakeMask = new Uint8Array(N);
    for (let i = 0; i < N; i++) lakeMask[i] = world.lakeDepth[i] > 0 ? 1 : 0;
    const lakeSdf = coastDistance(lakeMask, W, H);
    this.uploadRows('water', gl.RGBA16F, gl.RGBA, gl.FLOAT, W, H, 4, F32, (y0, rows, out) => {
      for (let j = 0, i = y0 * W; j < rows * W; j++, i++) {
        out[j * 4] = world.lakeDepth[i];
        out[j * 4 + 1] = world.lakeSalt[i];
        out[j * 4 + 2] = lakeSdf[i];
        out[j * 4 + 3] = sdf[i];
      }
    }, gl.LINEAR, gl.REPEAT);

    this.uploadRows('misc', gl.RGBA8UI, gl.RGBA_INTEGER, gl.UNSIGNED_BYTE, W, H, 4, (n) => new Uint8Array(n), (y0, rows, out) => {
      for (let j = 0, i = y0 * W; j < rows * W; j++, i++) {
        out[j * 4] = world.biome[i];
        out[j * 4 + 1] = world.plate[i];
        out[j * 4 + 2] = world.boundary[i];
        out[j * 4 + 3] = world.ocean[i];
      }
    }, gl.NEAREST, gl.REPEAT);

    const cont: boolean[] = [];
    for (const p of world.plates) cont[p.id] = p.continental;
    this.upload('palette', gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, 256, 2, buildPalette(cont), gl.NEAREST, gl.CLAMP_TO_EDGE);

    // --- géopolitique ---
    const pol = world.politics;
    const ids = new Uint16Array(N * 4);
    for (let i = 0; i < N; i++) {
      ids[i * 4] = pol.province[i];
      ids[i * 4 + 1] = pol.country[i];
      ids[i * 4 + 2] = pol.influence[i];
      ids[i * 4 + 3] = pol.continent[i] === 255 ? NONE16 : pol.continent[i];
    }
    dilateIntoSea(ids, world.ocean, W, H, 4, 3);
    this.upload('pol', gl.RGBA16UI, gl.RGBA_INTEGER, gl.UNSIGNED_SHORT, W, H, ids, gl.NEAREST, gl.REPEAT);
    this.upload('polPal', gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, 1024, POL_PAL_ROWS, buildPolPalette(world), gl.NEAREST, gl.CLAMP_TO_EDGE);
    this.setPolitics(pol.provinces.map((p) => p.country));

    // cultures et religions : déduites de la province de chaque cellule
    const lore = new Uint16Array(N * 4).fill(NONE16);
    for (let i = 0; i < N; i++) {
      const p = pol.province[i];
      if (p === NONE16) continue;
      const pr = pol.provinces[p];
      if (pr.culture >= 0) {
        lore[i * 4] = pr.culture;
        lore[i * 4 + 2] = pol.cultures[pr.culture].group;
      }
      if (pr.religion >= 0) {
        lore[i * 4 + 1] = pr.religion;
        const rel = pol.religions[pr.religion];
        lore[i * 4 + 3] = rel.parent >= 0 ? rel.parent : rel.id;
      }
    }
    dilateIntoSea(lore, world.ocean, W, H, 4, 4);
    this.upload('lore', gl.RGBA16UI, gl.RGBA_INTEGER, gl.UNSIGNED_SHORT, W, H, lore, gl.NEAREST, gl.REPEAT);
    this.uploadRows('extra', gl.RG16F, gl.RG, gl.FLOAT, W, H, 2, F32, (y0, rows, out) => {
      for (let j = 0, i = y0 * W; j < rows * W; j++, i++) {
        out[j * 2] = pol.influenceStrength[i];
        out[j * 2 + 1] = Math.min(60000, pol.popDensity[i]);
      }
    }, gl.LINEAR, gl.REPEAT);
  }

  /**
   * Propriétaire affiché de chaque province (carte à une date passée, retouches de l'éditeur) et, au
   * besoin, couleurs des pays (y compris des pays disparus, indices au-delà des pays actuels).
   * Le shader lit pays, État et région à travers la province : rien à renvoyer par cellule.
   */
  setPolitics(
    owner: ArrayLike<number>, colors?: readonly (readonly [number, number, number])[],
    prev?: ArrayLike<number>, changedAt?: Float32Array,
  ): void {
    const world = this.world;
    if (!world) return;
    const gl = this.gl;
    const pol = world.politics;
    const P = pol.provinces.length;
    const rows = Math.max(1, Math.ceil(P / 1024));
    const d = new Uint16Array(1024 * rows * 4).fill(NONE16);
    for (let p = 0; p < P; p++) {
      const o = owner[p], st = pol.provinces[p].state;
      d[p * 4] = o >= 0 ? o : NONE16;
      if (st >= 0) {
        d[p * 4 + 1] = st;
        d[p * 4 + 2] = pol.states[st].region;
      }
      // pays précédent (transition de la frise), NONE si aucun
      if (prev && prev[p] >= 0) d[p * 4 + 3] = prev[p];
    }
    this.upload('prov', gl.RGBA16UI, gl.RGBA_INTEGER, gl.UNSIGNED_SHORT, 1024, rows, d, gl.NEAREST, gl.CLAMP_TO_EDGE);
    const t = new Float32Array(1024 * rows).fill(-1e6);
    if (changedAt) t.set(changedAt.subarray(0, Math.min(P, changedAt.length)));
    this.upload('provT', gl.R32F, gl.RED, gl.FLOAT, 1024, rows, t, gl.NEAREST, gl.CLAMP_TO_EDGE);
    if (colors) {
      const row = new Uint8Array(1024 * 4);
      colors.forEach((c, i) => i < 1024 && row.set([c[0], c[1], c[2], 255], i * 4));
      gl.activeTexture(gl.TEXTURE0 + UNITS.polPal);
      gl.bindTexture(gl.TEXTURE_2D, this.tex.polPal);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 1024, 1, gl.RGBA, gl.UNSIGNED_BYTE, row);
    }
  }

  render(cam: Camera, opts: RenderOptions): void {
    const gl = this.gl;
    const world = this.world;
    const q = Math.min(1, Math.max(0.25, opts.quality ?? 1));
    const W = this.canvas.width, H = this.canvas.height;
    const vw = q < 1 ? Math.max(1, Math.round(W * q)) : W, vh = q < 1 ? Math.max(1, Math.round(H * q)) : H;
    if (q < 1) this.bindLowRes(vw, vh);
    else gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, vw, vh);
    if (!world) {
      gl.clearColor(0.045, 0.05, 0.055, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      if (q < 1) this.blitLowRes(vw, vh);
      return;
    }
    const k = vw / W;
    const L = this.loc;
    gl.uniform2f(L.uWorld, world.W, world.H);
    gl.uniform2f(L.uCenter, cam.cx, cam.cy);
    gl.uniform1f(L.uScale, cam.scale * k);
    gl.uniform2f(L.uViewport, vw, vh);
    gl.uniform1i(L.uMode, modeIndex(opts.mode));
    gl.uniform1i(L.uHover, opts.hoverCountry ?? -1);
    gl.uniform1i(L.uSelected, opts.selectedCountry ?? -1);
    gl.uniform1f(L.uExag, opts.exaggeration);
    gl.uniform1f(L.uCellKm, (2 * Math.PI * R_EARTH_KM) / world.W);
    gl.uniform1f(L.uLatMax, world.latMax);
    gl.uniform1f(L.uGrid, opts.grid ? 1 : 0);
    gl.uniform1f(L.uTime, opts.time ?? 0);
    gl.uniform1f(L.uClouds, opts.clouds ? 1 : 0);
    gl.uniform1f(L.uNight, opts.night ? 1 : 0);
    gl.uniform1f(L.uForests, opts.forests === false ? 0 : 1);
    const sun = opts.sun ?? [1, 0, 0];
    gl.uniform3f(L.uSun, sun[0], sun[1], sun[2]);
    gl.uniform1f(L.uDpr, (window.devicePixelRatio || 1) * k);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    if (q < 1) this.blitLowRes(vw, vh);
  }

  private lowFbo: WebGLFramebuffer | null = null;
  private lowRb: WebGLRenderbuffer | null = null;
  private lowSize = [0, 0];

  /** Tampon réduit pour le rendu pendant les déplacements. */
  private bindLowRes(w: number, h: number): void {
    const gl = this.gl;
    if (!this.lowFbo) {
      this.lowFbo = gl.createFramebuffer();
      this.lowRb = gl.createRenderbuffer();
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.lowFbo);
    if (this.lowSize[0] !== w || this.lowSize[1] !== h) {
      gl.bindRenderbuffer(gl.RENDERBUFFER, this.lowRb);
      gl.renderbufferStorage(gl.RENDERBUFFER, gl.RGBA8, w, h);
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, this.lowRb);
      this.lowSize = [w, h];
    }
  }

  /** Agrandit le tampon réduit dans le canevas (filtrage linéaire). */
  private blitLowRes(w: number, h: number): void {
    const gl = this.gl;
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, this.lowFbo);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
    gl.blitFramebuffer(0, 0, w, h, 0, 0, this.canvas.width, this.canvas.height, gl.COLOR_BUFFER_BIT, gl.LINEAR);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }
}

/**
 * Distance signée au bord d'un masque en cellules (+ hors masque, − dans le masque), bornée à ±8 : son
 * contour zéro interpolé donne un trait exact et d'épaisseur uniforme (chanfrein 8-voisins, carte bouclée en x).
 * Sert aux côtes (masque = océan) et aux rives des lacs (masque = lac).
 */
export function coastDistance(ocean: Uint8Array, W: number, H: number): Float32Array {
  const N = W * H;
  const MAX = 8;
  const d = new Float32Array(N).fill(MAX);
  let queue: number[] = [];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const o = ocean[i];
      let edge = false;
      for (let dy = -1; dy <= 1 && !edge; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= H) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const nx = (x + dx + W) % W;
          if (ocean[ny * W + nx] !== o) {
            edge = true;
            break;
          }
        }
      }
      if (edge) {
        d[i] = 0.5;
        queue.push(i);
      }
    }
  }
  // propagation par passes successives (Dijkstra approché, suffisant à cette portée)
  for (let pass = 0; pass < MAX; pass++) {
    const next: number[] = [];
    for (const i of queue) {
      const x = i % W, y = (i / W) | 0;
      for (let dy = -1; dy <= 1; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= H) continue;
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const j = ny * W + ((x + dx + W) % W);
          if (ocean[j] !== ocean[i]) continue;
          const nd = d[i] + (dx && dy ? Math.SQRT2 : 1);
          if (nd < d[j] - 1e-4) {
            d[j] = nd;
            next.push(j);
          }
        }
      }
    }
    queue = next;
    if (!queue.length) break;
  }
  for (let i = 0; i < N; i++) if (ocean[i]) d[i] = -d[i];
  return d;
}

/**
 * Prolonge les identifiants (province, pays, influence) de 4 cellules en mer : les pixels côtiers
 * tracés par le bruit fractal restent ainsi colorés. Le canal continent (plateaux inclus) est conservé.
 */
function dilateIntoSea(ids: Uint16Array, ocean: Uint8Array, W: number, H: number, steps: number, channels: number): void {
  let front: number[] = [];
  const done = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) {
    if (!ocean[i]) {
      done[i] = 1;
      front.push(i);
    }
  }
  for (let s = 0; s < steps; s++) {
    const next: number[] = [];
    for (const i of front) {
      const x = i % W, y = (i / W) | 0;
      for (let dy = -1; dy <= 1; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= H) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const j = ny * W + ((x + dx + W) % W);
          if (done[j]) continue;
          done[j] = 1;
          for (let ch = 0; ch < channels; ch++) ids[j * 4 + ch] = ids[i * 4 + ch];
          next.push(j);
        }
      }
    }
    front = next;
  }
}
