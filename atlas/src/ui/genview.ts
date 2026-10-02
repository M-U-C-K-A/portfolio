/**
 * Écran de génération : le monde « se développe » comme une image qui se débruite. La carte est
 * découpée en tronçons (à la manière des chunks de Minecraft) qui passent chacun, à leur tour, du
 * bruit au flou puis au net à mesure que la génération avance ; chaque étape envoyée par le worker
 * (relief, climat, fleuves, forêts, frontières…) remplace la précédente en fondu. Le même rendu
 * habille un globe en rotation ; une loupe parcourt le détail de l'image la plus récente.
 */

const VERT = `#version 300 es
in vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

const FRAG = `#version 300 es
precision highp float;
uniform sampler2D uA;
uniform sampler2D uB;
uniform float uMix;
uniform float uT;
uniform float uTime;
uniform float uRot;
uniform float uLatMax;
uniform float uHas;
uniform float uFlat;
uniform vec2 uRes;
out vec4 outColor;
const float PI = 3.14159265;

float h21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

// image « développée » : chaque tronçon se révèle à son tour, du bruit au flou puis au net
vec3 developed(vec2 uv) {
  vec2 cells = vec2(40.0, 16.0);
  vec2 g = floor(uv * cells);
  float order = 0.7 * h21(g + 3.1) + 0.3 * (0.5 + 0.5 * sin(g.x * 0.31 + g.y * 0.77));
  float k = uHas < 0.5 ? 0.0 : clamp((uT * 1.18 - order * 0.92) / 0.22, 0.0, 1.0);
  float blur = (1.0 - k) * 5.5;
  vec3 a = texture(uA, uv, blur).rgb, b = texture(uB, uv, blur).rgb;
  vec3 col = uHas < 0.5 ? vec3(0.06, 0.1, 0.16) : mix(a, b, uMix);
  // grain qui scintille, de plus en plus fin et de plus en plus faible
  float gs = mix(70.0, 700.0, k);
  float nz = h21(floor(uv * vec2(gs * 2.5, gs)) + floor(uTime * 14.0) * 7.31) - 0.5;
  col += nz * 0.38 * (1.0 - k) * (1.0 - k);
  // tronçons pas encore « chargés » : désaturés et assombris, trame discrète
  float gray = dot(col, vec3(0.3, 0.5, 0.2));
  vec3 dull = mix(vec3(gray), col, 0.35) * 0.78 + vec3(0.02, 0.03, 0.05);
  vec2 fr = fract(uv * cells);
  float grid = (1.0 - k) * 0.25 * (1.0 - smoothstep(0.0, 0.04, min(min(fr.x, 1.0 - fr.x), min(fr.y, 1.0 - fr.y))));
  col = mix(dull, col, smoothstep(0.0, 0.45, k));
  return col + vec3(0.9, 0.75, 0.4) * grid * 0.35;
}

void main() {
  if (uFlat > 0.5) {
    vec2 uv = vec2(gl_FragCoord.x / uRes.x, 1.0 - gl_FragCoord.y / uRes.y);
    outColor = vec4(developed(uv), 1.0);
    return;
  }
  vec2 p = (gl_FragCoord.xy - 0.5 * uRes) / (0.5 * min(uRes.x, uRes.y));
  float R = 0.84;
  vec2 q = p / R;
  float d2 = dot(q, q);
  if (d2 > 1.0) {
    float d = sqrt(d2) - 1.0;
    float halo = exp(-d * 11.0);
    outColor = vec4(vec3(0.38, 0.6, 1.0) * halo, halo * 0.8);
    return;
  }
  vec3 n = vec3(q, sqrt(1.0 - d2));
  float tilt = 0.32;
  float ct = cos(tilt), st = sin(tilt);
  vec3 m = vec3(n.x, ct * n.y + st * n.z, -st * n.y + ct * n.z);
  float cr = cos(uRot), sr = sin(uRot);
  vec3 w = vec3(cr * m.x - sr * m.z, m.y, sr * m.x + cr * m.z);
  float lat = degrees(asin(clamp(w.y, -1.0, 1.0)));
  float lon = atan(w.x, w.z);
  float v = clamp(0.5 - lat / (2.0 * uLatMax), 0.002, 0.998);
  vec3 col = developed(vec2(lon / (2.0 * PI) + 0.5, v));
  float pole = smoothstep(uLatMax - 2.0, uLatMax + 6.0, abs(lat));
  col = mix(col, vec3(0.8, 0.85, 0.9), pole * 0.85 * uHas);
  vec3 L = normalize(vec3(-0.55, 0.42, 0.72));
  col *= 0.16 + 1.0 * max(dot(n, L), 0.0);
  float sea = smoothstep(0.05, 0.25, col.b - max(col.r, col.g));
  vec3 H = normalize(L + vec3(0.0, 0.0, 1.0));
  col += vec3(0.9, 0.95, 1.0) * pow(max(dot(n, H), 0.0), 60.0) * 0.35 * sea;
  col = mix(col, vec3(0.5, 0.7, 1.0), pow(1.0 - n.z, 3.0) * 0.5);
  outColor = vec4(col, 1.0);
}
`;

/** Un canevas WebGL (globe ou carte plane) avec ses deux textures de fondu. */
class Surface {
  readonly gl: WebGL2RenderingContext | null;
  private loc: Record<string, WebGLUniformLocation | null> = {};
  private tex: WebGLTexture[] = [];

  constructor(readonly canvas: HTMLCanvasElement, private readonly flat: boolean) {
    const gl = canvas.getContext('webgl2', { premultipliedAlpha: false, alpha: !flat, antialias: !flat });
    this.gl = gl;
    if (!gl) return;
    const sh = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? 'genview');
      return s;
    };
    const p = gl.createProgram()!;
    gl.attachShader(p, sh(gl.VERTEX_SHADER, VERT));
    gl.attachShader(p, sh(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(p);
    gl.useProgram(p);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const a = gl.getAttribLocation(p, 'aPos');
    gl.enableVertexAttribArray(a);
    gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0);
    for (const n of ['uA', 'uB', 'uMix', 'uT', 'uTime', 'uRot', 'uLatMax', 'uHas', 'uFlat', 'uRes']) this.loc[n] = gl.getUniformLocation(p, n);
    this.tex = [gl.createTexture()!, gl.createTexture()!];
    this.tex.forEach((t, i) => {
      gl.activeTexture(gl.TEXTURE0 + i);
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([12, 34, 60, 255]));
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    });
    gl.uniform1i(this.loc.uA, 0);
    gl.uniform1i(this.loc.uB, 1);
    gl.uniform1f(this.loc.uFlat, flat ? 1 : 0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  }

  upload(prev: TexImageSource, next: TexImageSource): void {
    const gl = this.gl;
    if (!gl) return;
    [prev, next].forEach((img, i) => {
      gl.activeTexture(gl.TEXTURE0 + i);
      gl.bindTexture(gl.TEXTURE_2D, this.tex[i]);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
      // mip-maps : flou du « développement » et pôles du globe sans crénelage
      gl.generateMipmap(gl.TEXTURE_2D);
    });
  }

  draw(u: { mix: number; t: number; time: number; rot: number; has: boolean; latMax: number }): void {
    const gl = this.gl;
    if (!gl) return;
    const r = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(2, Math.round(r.width * dpr)), h = Math.max(2, Math.round(r.height * dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    gl.viewport(0, 0, w, h);
    gl.clearColor(0, 0, 0, this.flat ? 1 : 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform2f(this.loc.uRes, w, h);
    gl.uniform1f(this.loc.uMix, u.mix);
    gl.uniform1f(this.loc.uT, u.t);
    gl.uniform1f(this.loc.uTime, u.time);
    gl.uniform1f(this.loc.uRot, u.rot);
    gl.uniform1f(this.loc.uLatMax, u.latMax);
    gl.uniform1f(this.loc.uHas, u.has ? 1 : 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
}

export class GenView {
  private readonly globe: Surface;
  private readonly flat: Surface;
  private readonly loupe: HTMLCanvasElement;
  private readonly caption: HTMLElement;
  private readonly steps: HTMLOListElement;
  private raf = 0;
  private t0 = 0;
  private fadeStart = 0;
  private has = false;
  private latMax = 85;
  private prevImg: HTMLCanvasElement | null = null;
  private nextImg: HTMLCanvasElement | null = null;
  private lastStage = '';
  private stageStart = 0;
  /** avancement réel (worker) et avancement affiché (lissé) */
  private target = 0;
  private shown = 0;
  /** parcours de la loupe : points d'intérêt de l'image courante */
  private spots: [number, number][] = [];
  private spotFrom: [number, number] = [0.5, 0.5];
  private spotTo: [number, number] = [0.5, 0.5];
  private spotStart = 0;

  constructor(private readonly root: HTMLElement) {
    this.globe = new Surface(root.querySelector<HTMLCanvasElement>('.gen-globe')!, false);
    this.flat = new Surface(root.querySelector<HTMLCanvasElement>('.gen-preview')!, true);
    this.loupe = root.querySelector<HTMLCanvasElement>('.gen-loupe')!;
    this.caption = root.querySelector<HTMLElement>('.gen-caption')!;
    this.steps = root.querySelector<HTMLOListElement>('.gen-steps')!;
    root.style.setProperty('--stars', `url(${starfield()})`);
  }

  begin(seed: string, latMax: number): void {
    this.latMax = latMax;
    this.has = false;
    this.prevImg = this.nextImg = null;
    this.lastStage = '';
    this.target = this.shown = 0;
    this.spots = [];
    this.steps.innerHTML = '';
    this.caption.textContent = '';
    this.root.querySelector('.gen-seed')!.textContent = `« ${seed} »`;
    this.root.classList.add('live');
    this.t0 = performance.now();
    this.stageStart = this.t0;
    cancelAnimationFrame(this.raf);
    const loop = () => {
      this.raf = requestAnimationFrame(loop);
      if (!document.hidden) this.frame();
    };
    loop();
  }

  end(): void {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.closeStage();
    this.root.classList.remove('live');
  }

  /** Étape et avancement (0..1) annoncés par le worker. */
  stage(name: string, p: number): void {
    this.target = Math.max(this.target, p);
    if (name === this.lastStage) return;
    this.closeStage();
    this.lastStage = name;
    this.stageStart = performance.now();
    const li = document.createElement('li');
    li.className = 'cur';
    li.innerHTML = '<span class="gs-ic"></span><span class="gs-n"></span><span class="gs-t"></span>';
    li.querySelector('.gs-n')!.textContent = name;
    this.steps.append(li);
    while (this.steps.children.length > 8) this.steps.firstElementChild!.remove();
  }

  private closeStage(): void {
    const cur = this.steps.querySelector('li.cur');
    if (!cur) return;
    cur.classList.remove('cur');
    cur.classList.add('done');
    const s = (performance.now() - this.stageStart) / 1000;
    cur.querySelector('.gs-t')!.textContent = s < 0.1 ? '' : `${s.toFixed(1).replace('.', ',')} s`;
  }

  /** Aperçu envoyé par le worker. */
  image(w: number, h: number, pixels: Uint8ClampedArray, stage: string): void {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    c.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(pixels), w, h), 0, 0);
    this.prevImg = this.nextImg ? this.blendNow() : c;
    this.nextImg = c;
    this.fadeStart = performance.now();
    this.caption.textContent = stage;
    this.globe.upload(this.prevImg, c);
    this.flat.upload(this.prevImg, c);
    this.has = true;
    this.findSpots(pixels, w, h);
  }

  /** Points d'intérêt pour la loupe : pixels de terre les plus contrastés (reliefs, côtes, frontières). */
  private findSpots(px: Uint8ClampedArray, w: number, h: number): void {
    const cand: [number, number, number][] = [];
    for (let k = 0; k < 400; k++) {
      const x = 8 + Math.floor(Math.random() * (w - 16)), y = 8 + Math.floor(Math.random() * (h - 16));
      const o = (y * w + x) * 4;
      if (px[o + 2] > px[o] + 20 && px[o + 2] > px[o + 1]) continue; // mer
      let v = 0;
      for (const [dx, dy] of [[4, 0], [0, 4], [-4, 0], [0, -4]]) {
        const q = ((y + dy) * w + x + dx) * 4;
        v += Math.abs(px[q] - px[o]) + Math.abs(px[q + 1] - px[o + 1]) + Math.abs(px[q + 2] - px[o + 2]);
      }
      cand.push([x / w, y / h, v]);
    }
    cand.sort((a, b) => b[2] - a[2]);
    this.spots = cand.slice(0, 12).map(([x, y]) => [x, y]);
  }

  private mixK(): number {
    const t = Math.min(1, (performance.now() - this.fadeStart) / 900);
    return t * t * (3 - 2 * t);
  }

  private blendNow(): HTMLCanvasElement {
    const a = this.prevImg!, b = this.nextImg!;
    const c = document.createElement('canvas');
    c.width = b.width;
    c.height = b.height;
    const g = c.getContext('2d')!;
    g.drawImage(a, 0, 0, c.width, c.height);
    g.globalAlpha = this.mixK();
    g.drawImage(b, 0, 0);
    return c;
  }

  private frame(): void {
    const now = performance.now();
    const time = (now - this.t0) / 1000;
    this.shown += (this.target - this.shown) * 0.06;
    const u = { mix: this.mixK(), t: this.shown, time, rot: time * ((2 * Math.PI) / 48), has: this.has, latMax: this.latMax };
    this.flat.draw(u);
    this.globe.draw(u);
    this.drawLoupe(now);
    const cur = this.steps.querySelector('li.cur .gs-t');
    if (cur) {
      const s = (now - this.stageStart) / 1000;
      cur.textContent = s < 0.5 ? '' : `${s.toFixed(1).replace('.', ',')} s`;
    }
  }

  /** Loupe : glisse lentement d'un point d'intérêt à l'autre sur l'image la plus récente (×4,5). */
  private drawLoupe(now: number): void {
    const c = this.loupe;
    const img = this.nextImg;
    const r = c.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(2, Math.round(r.width * dpr)), h = Math.max(2, Math.round(r.height * dpr));
    if (c.width !== w || c.height !== h) {
      c.width = w;
      c.height = h;
    }
    const g = c.getContext('2d')!;
    if (!img || !this.spots.length) {
      g.fillStyle = '#0b1420';
      g.fillRect(0, 0, w, h);
      return;
    }
    let t = (now - this.spotStart) / 4200;
    if (t >= 1) {
      this.spotFrom = this.spotTo;
      this.spotTo = this.spots[Math.floor(Math.random() * this.spots.length)];
      this.spotStart = now;
      t = 0;
    }
    const e = t * t * (3 - 2 * t);
    const cx = this.spotFrom[0] + (this.spotTo[0] - this.spotFrom[0]) * e;
    const cy = this.spotFrom[1] + (this.spotTo[1] - this.spotFrom[1]) * e;
    const sw = img.width / 4.5, sh = sw * (h / w);
    g.imageSmoothingQuality = 'high';
    g.drawImage(img, cx * img.width - sw / 2, cy * img.height - sh / 2, sw, sh, 0, 0, w, h);
  }
}

/** Ciel étoilé (image de fond générée une fois). */
function starfield(): string {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d')!;
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 420; i++) {
    const r = rnd() < 0.92 ? 0.5 + rnd() * 0.6 : 1.1 + rnd() * 0.8;
    g.globalAlpha = 0.25 + rnd() * 0.7;
    g.fillStyle = rnd() < 0.15 ? '#ffd9a8' : rnd() < 0.3 ? '#bcd4ff' : '#ffffff';
    g.beginPath();
    g.arc(rnd() * 512, rnd() * 512, r, 0, Math.PI * 2);
    g.fill();
  }
  return c.toDataURL('image/png');
}
