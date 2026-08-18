/**
 * Champs de bruit partagés par le moteur de pixels et les vignettes.
 *
 * Le rendu décide d'allumer une cellule en comparant son énergie à un seuil.
 * Une matrice de Bayer donnerait un seuil *ordonné* : à mi-énergie, toutes les
 * cellules d'une zone franchissent leur seuil en alternance et on obtient un
 * damier régulier — mécanique et laid.
 *
 * On remplace donc le seuil ordonné par un masque bruité en deux couches :
 *
 *   - une couche *grossière* (bruit de valeur interpolé, deux octaves) qui fait
 *     que des cellules voisines partagent un seuil proche et s'allument donc
 *     ensemble — ce sont les amas ;
 *   - une couche *fine*, un aléa par cellule, qui déchiquette les bords des
 *     amas pour éviter des taches trop lisses.
 *
 * Les deux champs sont déterministes pour une graine donnée.
 */

/** PRNG déterministe : deux rendus avec la même graine sont identiques. */
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smoothstep = (t: number) => t * t * (3 - 2 * t);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Bruit de valeur : grille aléatoire lâche, interpolée en douceur. */
function valueNoise(
  cols: number,
  rows: number,
  scale: number,
  rand: () => number,
) {
  const nx = Math.ceil(cols / scale) + 2;
  const ny = Math.ceil(rows / scale) + 2;
  const lattice = new Float32Array(nx * ny);
  for (let i = 0; i < lattice.length; i++) lattice[i] = rand();

  const out = new Float32Array(cols * rows);
  for (let y = 0; y < rows; y++) {
    const gy = y / scale;
    const y0 = Math.floor(gy);
    const fy = smoothstep(gy - y0);
    const rowA = y0 * nx;
    const rowB = (y0 + 1) * nx;

    for (let x = 0; x < cols; x++) {
      const gx = x / scale;
      const x0 = Math.floor(gx);
      const fx = smoothstep(gx - x0);
      const top = lerp(lattice[rowA + x0], lattice[rowA + x0 + 1], fx);
      const bottom = lerp(lattice[rowB + x0], lattice[rowB + x0 + 1], fx);
      out[y * cols + x] = lerp(top, bottom, fy);
    }
  }
  return out;
}

export interface PixelFields {
  /** Seuil d'allumage par cellule, réparti sur (0 → 1). */
  mask: Float32Array;
  /** Structure grossière : sert aux amas de couleur et à la texture. */
  clump: Float32Array;
  /** Aléa par cellule : sert aux vitesses de dissolution. */
  grain: Float32Array;
}

/**
 * Construit les trois champs pour une grille donnée.
 *
 * `clumpScale` est la taille moyenne d'un amas, en cellules : plus il est
 * grand, plus les masses sont franches et les bords longs.
 */
export function buildPixelFields(
  cols: number,
  rows: number,
  seed: number,
  clumpScale = 7,
): PixelFields {
  const count = Math.max(cols * rows, 0);
  const rand = mulberry32(seed * 7919 + 13);

  const coarse = valueNoise(cols, rows, clumpScale, rand);
  const medium = valueNoise(cols, rows, Math.max(2, clumpScale / 2.4), rand);

  const mask = new Float32Array(count);
  const clump = new Float32Array(count);
  const grain = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    const fine = rand();
    // Le bruit de valeur interpolé a une variance réduite : sans le facteur
    // d'étalement, tous les seuils se tasseraient autour de 0,5 et on perdrait
    // le dégradé entre « presque rien » et « plein ».
    const structure = 0.64 * coarse[i] + 0.36 * medium[i];
    const combined = 0.74 * (structure - 0.5) + 0.26 * (fine - 0.5);

    mask[i] = clamp01(0.5 + combined * 2.35);
    clump[i] = structure;
    grain[i] = fine;
  }

  return { mask, clump, grain };
}
