/**
 * Moteur de champ de pixels.
 *
 * Une grille de cellules dessinée sur un <canvas>. Chaque cellule porte une
 * énergie et un index de couleur ; elle n'est peinte que si son énergie dépasse
 * le seuil que lui attribue le masque bruité de `pixel-noise.ts`. Comme des
 * cellules voisines partagent un seuil proche, elles s'allument et s'éteignent
 * ensemble : on obtient des amas aux bords déchiquetés, jamais un damier.
 *
 * Le module ne dépend pas de React : il expose une classe pilotée par le
 * composant client, ce qui le rend testable et réutilisable ailleurs.
 */

// Extension explicite : le runner de tests passe par le résolveur ESM de Node,
// qui n'ajoute pas d'extension tout seul.
import { buildPixelFields, mulberry32, type PixelFields } from "./pixel-noise.ts";

/**
 * Palette du canvas : une rampe de neutres, puis l'accent.
 *
 * L'accent doit rester synchronisé avec `--px-accent` dans globals.css, qui
 * sert aux puces, à la sélection et au focus.
 */
export const PIXEL_PALETTE = [
  "#0f0f11", // encre
  "#3a3a40", // ardoise
  "#6b6b73", // gris moyen
  "#9c9ca3", // gris
  "#cdcdd2", // gris clair
  "#1d3fff", // accent
] as const;

/**
 * Rampe inversée pour le mode sombre : l'index 0 reste le ton le plus
 * contrasté avec le fond, donc le plus clair ici. Les valeurs doublent celles
 * de `light-dark()` dans globals.css et doivent rester synchronisées.
 */
export const PIXEL_PALETTE_DARK = [
  "#f2f2f0", // craie
  "#c2c2c9",
  "#94949d",
  "#6a6a74",
  "#45454d",
  "#6b86ff", // accent, éclairci pour tenir le contraste sur fond sombre
] as const;

export type PixelPalette = readonly string[];

/** Index dans la palette, pour éviter les nombres magiques. */
const INK = 0;
const SLATE = 1;
const ACCENT = 5;
/** Nombre de neutres au début de la palette, avant l'accent. */
const NEUTRALS = 5;

/**
 * Comportement du champ hors interaction.
 *
 * Les zones cliquables se contentent de `sparks` : la grille doit rester calme
 * pour que l'explosion se détache. Les zones non cliquables portent en revanche
 * un motif propre, sinon elles paraissent inertes.
 */
export type PixelMotif = "sparks" | "flow" | "rain" | "scan";

const easeOutCubic = (p: number) => 1 - (1 - p) ** 3;
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** Découpe une valeur 0 → 1 en un index de la rampe de neutres. */
function neutral(t: number) {
  const step = (t * NEUTRALS) | 0;
  return step < 0 ? 0 : step > NEUTRALS - 1 ? NEUTRALS - 1 : step;
}

export interface PixelEngineOptions {
  /** Côté d'une cellule, en px CSS. */
  cell?: number;
  /** Cellules allumées par seconde et par millier de cellules. */
  spawn?: number;
  /** Durée de vie d'une cellule pleine, en ms. */
  life?: number;
  palette?: PixelPalette;
  /** Comportement du champ hors interaction. */
  motif?: PixelMotif;
  /** Taille moyenne d'un amas, en cellules. */
  clumpScale?: number;
  /** Réaction au curseur. */
  pointer?: boolean;
  /** Intervalle [min, max] en ms entre deux explosions automatiques. */
  autoBlast?: readonly [number, number] | null;
  /** Durée d'injection d'une explosion, en ms. */
  blastDuration?: number;
  /** Portée d'une explosion, en fraction de la plus grande dimension. */
  blastReach?: number;
  seed?: number;
}

interface Blast {
  cx: number;
  cy: number;
  t: number;
  duration: number;
  maxR: number;
}

const DEFAULTS = {
  cell: 8,
  spawn: 5,
  life: 2600,
  palette: PIXEL_PALETTE as PixelPalette,
  motif: "sparks" as PixelMotif,
  clumpScale: 7,
  pointer: true,
  autoBlast: null,
  blastDuration: 900,
  blastReach: 0.42,
  seed: 1,
} satisfies Required<PixelEngineOptions>;

export class PixelEngine {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly opts: Required<PixelEngineOptions>;
  private readonly rand: () => number;

  private cols = 0;
  private rows = 0;
  private width = 0;
  private height = 0;

  private energy = new Float32Array(0);
  private color = new Uint8Array(0);
  private fields: PixelFields = {
    mask: new Float32Array(0),
    clump: new Float32Array(0),
    grain: new Float32Array(0),
  };

  private blasts: Blast[] = [];
  private spawnDebt = 0;
  private clock = 0;
  private nextAutoBlast = 0;

  private pointerX = -1;
  private pointerY = -1;
  private pointerActive = false;

  private raf = 0;
  private lastFrame = 0;
  private running = false;

  constructor(canvas: HTMLCanvasElement, options: PixelEngineOptions = {}) {
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) throw new Error("Contexte 2D indisponible");
    this.canvas = canvas;
    this.ctx = ctx;
    this.opts = { ...DEFAULTS, ...options };
    this.rand = mulberry32(this.opts.seed);
    this.nextAutoBlast = this.pickAutoBlastDelay();
  }

  // --- Dimensionnement ------------------------------------------------------

  resize(width: number, height: number, dpr: number) {
    if (width <= 0 || height <= 0) return;
    const cell = this.opts.cell;
    const cols = Math.ceil(width / cell);
    const rows = Math.ceil(height / cell);

    this.width = width;
    this.height = height;
    this.canvas.width = Math.round(width * dpr);
    this.canvas.height = Math.round(height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    if (cols !== this.cols || rows !== this.rows) {
      const count = cols * rows;
      const energy = new Float32Array(count);
      const color = new Uint8Array(count);
      // On reporte l'état existant pour éviter un flash au redimensionnement.
      const copyCols = Math.min(cols, this.cols);
      const copyRows = Math.min(rows, this.rows);
      for (let y = 0; y < copyRows; y++) {
        for (let x = 0; x < copyCols; x++) {
          energy[y * cols + x] = this.energy[y * this.cols + x];
          color[y * cols + x] = this.color[y * this.cols + x];
        }
      }

      this.cols = cols;
      this.rows = rows;
      this.energy = energy;
      this.color = color;
      this.fields = buildPixelFields(
        cols,
        rows,
        this.opts.seed,
        this.opts.clumpScale,
      );
    }
  }

  // --- Cycle de vie ---------------------------------------------------------

  start() {
    if (this.running) return;
    this.running = true;
    this.lastFrame = 0;
    const tick = (now: number) => {
      if (!this.running) return;
      const dt = this.lastFrame ? Math.min(now - this.lastFrame, 64) : 16.7;
      this.lastFrame = now;
      this.step(dt);
      this.paint();
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  stop() {
    this.running = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  destroy() {
    this.stop();
    this.energy = new Float32Array(0);
    this.color = new Uint8Array(0);
  }

  get isRunning() {
    return this.running;
  }

  /** Faux tant qu'aucun `resize` utile n'a eu lieu (hôte encore à taille nulle). */
  get hasSize() {
    return this.cols > 0 && this.rows > 0;
  }

  /**
   * Remplace la palette sans toucher à la simulation. Les cellules stockent un
   * index, pas une couleur : une bascule de thème est donc un simple repaint,
   * et le champ ne se réinitialise pas sous les yeux de l'utilisateur.
   */
  setPalette(palette: PixelPalette) {
    if (palette === this.opts.palette) return;
    this.opts.palette = palette;
    if (this.hasSize) this.paint();
  }

  // --- Interactions ---------------------------------------------------------

  /** Déclenche une explosion aux coordonnées CSS données. */
  blast(x: number, y: number, scale = 1) {
    const reach = Math.max(this.width, this.height) * this.opts.blastReach;
    this.blasts.push({
      cx: x / this.opts.cell,
      cy: y / this.opts.cell,
      t: 0,
      duration: this.opts.blastDuration,
      maxR: (reach * scale) / this.opts.cell,
    });
    // Au-delà de quelques explosions simultanées le rendu sature pour rien.
    if (this.blasts.length > 4) this.blasts.shift();
  }

  pointerAt(x: number, y: number) {
    this.pointerX = x / this.opts.cell;
    this.pointerY = y / this.opts.cell;
    this.pointerActive = true;
  }

  pointerLeave() {
    this.pointerActive = false;
  }

  // --- Simulation -----------------------------------------------------------

  private step(dt: number) {
    this.clock += dt;
    this.decay(dt);
    this.applyMotif(dt);
    if (this.opts.pointer && this.pointerActive) this.applyPointer();
    this.applyBlasts(dt);
    this.maybeAutoBlast(dt);
  }

  private decay(dt: number) {
    const { energy, opts } = this;
    const { grain } = this.fields;
    const base = dt / opts.life;
    for (let i = 0; i < energy.length; i++) {
      const e = energy[i];
      if (e <= 0) continue;
      // Le grain module la vitesse : les cellules ne s'éteignent pas en bloc.
      const next = e - base * (0.75 + grain[i] * 1.05);
      energy[i] = next > 0 ? next : 0;
    }
  }

  private applyMotif(dt: number) {
    if (!this.cols || !this.rows) return;
    switch (this.opts.motif) {
      case "flow":
        this.motifFlow(dt);
        break;
      case "rain":
        this.motifRain(dt);
        break;
      case "scan":
        this.motifScan();
        break;
      default:
        this.motifSparks(dt);
    }
  }

  /**
   * Combien de cellules allumer sur cette image, d'après le débit demandé.
   * La dette évite de perdre les fractions : à faible débit, on n'allumerait
   * jamais rien si on arrondissait à chaque image.
   */
  private takeBudget(dt: number) {
    const { cols, rows, opts } = this;
    this.spawnDebt += ((cols * rows) / 1000) * opts.spawn * (dt / 1000);
    const budget = Math.floor(this.spawnDebt);
    if (budget <= 0) return 0;
    this.spawnDebt -= budget;
    // Plafond de sécurité si l'onglet revient au premier plan après une pause.
    return Math.min(budget, 400);
  }

  /** Étincelles isolées, en bandes lentes. Le motif par défaut. */
  private motifSparks(dt: number) {
    const { cols, rows } = this;
    const budget = this.takeBudget(dt);
    if (!budget) return;

    const t = this.clock;
    for (let n = 0; n < budget; n++) {
      let x = 0;
      let y = 0;
      // Échantillonnage par rejet : les pixels se regroupent en bandes lentes.
      for (let attempt = 0; attempt < 4; attempt++) {
        x = (this.rand() * cols) | 0;
        y = (this.rand() * rows) | 0;
        const nx = x / cols;
        const ny = y / rows;
        const w =
          0.5 +
          0.5 *
            Math.sin(nx * 6.2 + ny * 3.1 + t * 0.00035) *
            Math.cos(ny * 4.4 - t * 0.00021);
        if (this.rand() < w) break;
      }
      const i = y * cols + x;
      // On allume relativement au seuil local, pas dans l'absolu : la cellule
      // est certaine d'être visible, et toutes les étincelles ont la même durée
      // de vie quel que soit l'amas où elles tombent.
      this.energy[i] = this.fields.mask[i] + 0.5;
      this.color[i] = this.pickIdleColor(i);
    }
  }

  /**
   * Ruban qui ondule sur la largeur. Sous la section méthode, il donne à lire
   * un enchaînement — quatre temps qui s'écoulent — plutôt qu'un champ inerte.
   */
  private motifFlow(dt: number) {
    const { cols, rows } = this;
    // Le ruban concentre les cellules sur une bande étroite, qui couvre à peine
    // un sixième de la hauteur : à débit égal il paraîtrait vide.
    const budget = this.takeBudget(dt) * 12;
    if (!budget) return;
    const t = this.clock;

    for (let n = 0; n < budget; n++) {
      const u = this.rand();
      const x = (u * cols) | 0;
      // Deux harmoniques de périodes incommensurables : le ruban ne se répète
      // jamais à l'identique. L'ondulation est lente à dessein — plus rapide,
      // la traînée des cellules balaierait toute la hauteur et le tracé se
      // lirait comme une bande pleine au lieu d'une courbe.
      const wave =
        Math.sin(u * 5.4 + t * 0.00042) * 0.62 +
        Math.sin(u * 11.3 - t * 0.00027) * 0.24;
      const centre = rows * (0.5 + wave * 0.26);
      // Somme de trois tirages : épaisseur dense au cœur, dispersée aux bords.
      const spread =
        (this.rand() + this.rand() + this.rand() - 1.5) * rows * 0.055;
      const y = (centre + spread) | 0;
      if (y < 0 || y >= rows) continue;

      const i = y * cols + x;
      const closeness = 1 - Math.min(1, Math.abs(spread) / (rows * 0.08));
      this.energy[i] = this.fields.mask[i] + 0.25 + closeness * 0.4;
      this.color[i] =
        closeness > 0.74 ? INK : closeness > 0.42 ? SLATE : neutral(this.rand());
    }
  }

  /**
   * Pluie. Chaque colonne tire sa vitesse et sa cadence du bruit : les
   * traînées ne tombent jamais en rang, et une colonne sur trois reste vide.
   */
  private motifRain(dt: number) {
    const { cols, rows, energy, color } = this;
    const { mask, grain } = this.fields;
    const t = this.clock;

    for (let x = 0; x < cols; x++) {
      // `grain` de la première ligne : une valeur stable propre à la colonne.
      const g = grain[x];
      // Deux colonnes sur trois restent vides, sinon la pluie fait un mur.
      if (g < 0.62) continue;

      // Lente : la traînée doit rester lisible, pas clignoter.
      const speed = 0.006 + g * 0.009; // cellules par milliseconde
      const period = rows * (2.2 + g * 2.6); // intervalle entre deux gouttes
      const offset = g * period;
      const now = (t * speed + offset) % period;
      const before = ((t - dt) * speed + offset) % period;
      if (now >= rows) continue;

      // La goutte avance de plus d'une cellule par image : on remplit
      // l'intervalle, sinon la traînée serait pointillée.
      const from = before < now ? Math.ceil(before) : 0;
      for (let y = from; y <= now && y < rows; y++) {
        if (y < 0) continue;
        const i = y * cols + x;
        const head = 1 - (now - y) / Math.max(1, now - from + 1);
        // Traînée courte : l'énergie reste juste au-dessus du seuil local, la
        // cellule s'éteint donc peu après le passage de la goutte.
        const amp = mask[i] + 0.06 + head * 0.16;
        if (amp <= energy[i]) continue;
        energy[i] = amp;
        color[i] = head > 0.8 ? (g > 0.85 ? INK : SLATE) : neutral(1 - head);
      }
    }
  }

  /**
   * Balayage : une barre verticale traverse le champ et laisse derrière elle
   * une traînée que la décroissance désagrège.
   */
  private motifScan() {
    const { cols, rows, energy, color } = this;
    const { mask, clump } = this.fields;

    const width = Math.max(4, cols * 0.07);
    const span = cols + width * 2;
    const head = ((this.clock * 0.022) % span) - width;

    const x0 = Math.max(0, Math.floor(head - width));
    const x1 = Math.min(cols - 1, Math.ceil(head));

    for (let x = x0; x <= x1; x++) {
      const front = 1 - (head - x) / width; // 1 sur le front, 0 en queue
      if (front < 0 || front > 1) continue;

      for (let y = 0; y < rows; y++) {
        const i = y * cols + x;
        // Valeur absolue comparée au seuil, et modulée par l'*inverse* de
        // l'amas : la barre se troue là où le seuil est haut, au lieu d'être
        // un aplat qui avance.
        const target = front * 1.25 * (0.45 + (1 - clump[i]) * 0.85);
        if (target <= mask[i]) continue;
        // On plafonne l'excédent au-dessus du seuil : sans cela une cellule de
        // tête vivrait plusieurs secondes et la traînée couvrirait la moitié
        // du champ au lieu de s'effacer derrière la barre.
        const amp = mask[i] + Math.min(0.42, target - mask[i]);
        if (amp <= energy[i]) continue;
        energy[i] = amp;
        // Tête sombre, traînée qui s'éclaircit en s'éloignant.
        color[i] = neutral((1 - front) * 0.75 + clump[i] * 0.25);
      }
    }
  }

  /**
   * Nuance d'une étincelle au repos. Elle suit majoritairement l'amas : les
   * pixels voisins partagent un ton, ce qui donne au champ une profondeur que
   * n'aurait pas un tirage purement aléatoire.
   */
  private pickIdleColor(i: number) {
    // Le bruit d'amas est interpolé, donc resserré autour de 0,5 : sans
    // étalement, presque toutes les étincelles tomberaient sur le ton médian
    // et la rampe ne servirait à rien.
    const mixed =
      (this.fields.clump[i] - 0.5) * 0.72 + (this.rand() - 0.5) * 0.28;
    return neutral(0.5 + mixed * 2.1);
  }

  private applyPointer() {
    const { cols, rows, energy, color } = this;
    const { mask, clump } = this.fields;
    const radius = 4.2;
    const x0 = Math.max(0, Math.floor(this.pointerX - radius));
    const x1 = Math.min(cols - 1, Math.ceil(this.pointerX + radius));
    const y0 = Math.max(0, Math.floor(this.pointerY - radius));
    const y1 = Math.min(rows - 1, Math.ceil(this.pointerY + radius));

    for (let y = y0; y <= y1; y++) {
      const dy = y + 0.5 - this.pointerY;
      for (let x = x0; x <= x1; x++) {
        const dx = x + 0.5 - this.pointerX;
        const d = Math.hypot(dx, dy);
        if (d > radius) continue;
        const i = y * cols + x;
        // Le halo suit le masque local : il s'accroche aux amas au lieu de
        // dessiner un disque net.
        const amp = (1 - d / radius) * (mask[i] + 0.42) * 0.92;
        if (amp > energy[i]) {
          energy[i] = amp;
          // Le halo s'assombrit vers le centre du curseur.
          color[i] = clump[i] > 0.6 ? SLATE : d < radius * 0.45 ? INK : 2;
        }
      }
    }
  }

  private applyBlasts(dt: number) {
    if (!this.blasts.length) return;
    const frame: PixelFrame = {
      cols: this.cols,
      rows: this.rows,
      energy: this.energy,
      color: this.color,
      fields: this.fields,
    };

    for (let b = this.blasts.length - 1; b >= 0; b--) {
      const blast = this.blasts[b];
      blast.t += dt;
      const p = clamp01(blast.t / blast.duration);
      stampBlast(frame, blast.cx, blast.cy, blast.maxR * easeOutCubic(p), p);
      if (p >= 1) this.blasts.splice(b, 1);
    }
  }

  private pickAutoBlastDelay() {
    const range = this.opts.autoBlast;
    if (!range) return Number.POSITIVE_INFINITY;
    return range[0] + this.rand() * (range[1] - range[0]);
  }

  private maybeAutoBlast(dt: number) {
    if (!this.opts.autoBlast) return;
    this.nextAutoBlast -= dt;
    if (this.nextAutoBlast > 0) return;
    this.nextAutoBlast = this.pickAutoBlastDelay();
    this.blast(
      this.rand() * this.width,
      this.rand() * this.height,
      0.55 + this.rand() * 0.45,
    );
  }

  // --- Rendu ----------------------------------------------------------------

  /**
   * Peint la grille. Les cellules voisines de même couleur sont fusionnées en
   * un seul fillRect : comme le masque produit des amas, les aplats se
   * réduisent à quelques centaines de rectangles au lieu de plusieurs milliers.
   */
  paint() {
    const { ctx, cols, rows, energy, color, opts } = this;
    const { mask } = this.fields;
    const cell = opts.cell;
    ctx.clearRect(0, 0, this.width, this.height);

    let lastFill = "";
    let runColor = -1;
    let runStart = 0;

    for (let y = 0; y < rows; y++) {
      const rowOffset = y * cols;
      runColor = -1;
      runStart = 0;

      for (let x = 0; x < cols; x++) {
        const i = rowOffset + x;
        const lit = energy[i] > mask[i];
        const c = lit ? color[i] : -1;
        if (c === runColor) continue;
        if (runColor >= 0) {
          const fill = opts.palette[runColor];
          if (fill !== lastFill) {
            ctx.fillStyle = fill;
            lastFill = fill;
          }
          ctx.fillRect(runStart * cell, y * cell, (x - runStart) * cell, cell);
        }
        runColor = c;
        runStart = x;
      }

      if (runColor >= 0) {
        const fill = opts.palette[runColor];
        if (fill !== lastFill) {
          ctx.fillStyle = fill;
          lastFill = fill;
        }
        ctx.fillRect(runStart * cell, y * cell, (cols - runStart) * cell, cell);
      }
    }
  }

  /** Une image fixe, sans boucle — utilisé quand l'animation est désactivée. */
  paintStill(density = 1) {
    const { cols, rows } = this;
    if (!cols || !rows) return;
    this.energy.fill(0);
    const count = Math.round(cols * rows * 0.006 * density);
    for (let n = 0; n < count; n++) {
      const x = (this.rand() * cols) | 0;
      const y = (this.rand() * rows) | 0;
      const i = y * cols + x;
      this.energy[i] = this.fields.mask[i] + 0.5;
      this.color[i] = this.pickIdleColor(i);
    }
    this.paint();
  }
}

/**
 * Couleur d'une cellule d'explosion. Le choix suit l'amas pour que les tons
 * forment des plaques et non du bruit : masse rouge au cœur, plaques sombres
 * là où l'amas est le plus creux, et un pourtour qui se dilue dans la rampe de
 * gris en allant vers l'extérieur.
 */
function pickBlastColor(clump: number, grain: number, edge: number) {
  // `edge` vaut 1 au centre et 0 sur le bord. Le cœur reste d'un seul tenant :
  // y semer des neutres salissait la masse au lieu de la texturer.
  if (edge > 0.58) return ACCENT;

  // Quelques plaques sombres, rares et cantonnées au pourtour.
  if (clump < 0.12 && grain > 0.45) return grain > 0.75 ? INK : SLATE;

  // Éclats neutres qui s'éclaircissent vers l'extérieur.
  if (grain > 0.62) return neutral((1 - edge / 0.58) * 0.8 + clump * 0.2);

  return ACCENT;
}

/**
 * Un champ de pixels, réduit à ce qu'il faut pour y tamponner une explosion.
 * L'extraire de la classe permet de composer un disque hors du navigateur —
 * c'est ce dont se sert la marque imprimée du CV, calculée en SVG.
 */
export interface PixelFrame {
  cols: number;
  rows: number;
  energy: Float32Array;
  color: Uint8Array;
  fields: PixelFields;
}

/**
 * Tamponne une explosion sur un champ. `radius` est déjà amorti, `progress`
 * (0 → 1) ne sert qu'à faire retomber l'amplitude en fin de course.
 */
export function stampBlast(
  frame: PixelFrame,
  cx: number,
  cy: number,
  radius: number,
  progress: number,
) {
  const { cols, rows, energy, color } = frame;
  const { clump, grain } = frame.fields;

  const x0 = Math.max(0, Math.floor(cx - radius));
  const x1 = Math.min(cols - 1, Math.ceil(cx + radius));
  const y0 = Math.max(0, Math.floor(cy - radius));
  const y1 = Math.min(rows - 1, Math.ceil(cy + radius));
  const r2 = radius * radius;

  for (let y = y0; y <= y1; y++) {
    const dy = y + 0.5 - cy;
    const dy2 = dy * dy;
    for (let x = x0; x <= x1; x++) {
      const dx = x + 0.5 - cx;
      const d2 = dx * dx + dy2;
      if (d2 > r2) continue;
      const i = y * cols + x;
      const edge = 1 - Math.sqrt(d2) / radius;

      // Plateau franc sur le cœur du disque, chute sur le pourtour.
      const core = clamp01(edge * 2.2);
      // L'érosion par l'amas ne mord qu'en périphérie : appliquée partout,
      // elle laissait des trous de fond au milieu de la masse. Au cœur,
      // `rim` vaut 0 et l'énergie dépasse tous les seuils — le disque est
      // plein ; au bord elle vaut 1 et l'amas déchiquette franchement.
      const rim = 1 - clamp01(edge * 1.6);
      let amp = core * (1.5 - rim * 0.95 * clump[i]);
      amp *= 1 - progress * 0.12;

      if (amp <= energy[i]) continue;
      energy[i] = amp;
      color[i] = pickBlastColor(clump[i], grain[i], edge);
    }
  }
}
