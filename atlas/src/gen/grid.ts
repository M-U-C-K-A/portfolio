export const R_EARTH_KM = 6371;
export const DX8 = [-1, 0, 1, -1, 1, -1, 0, 1];
export const DY8 = [-1, -1, -1, 0, 0, 1, 1, 1];

/**
 * Grille équirectangulaire couvrant [-latMax, +latMax] et toute la longitude (bouclage en x).
 * La ligne 0 est au nord. Les cellules sont carrées (en degrés) à l'équateur.
 */
export class Grid {
  readonly W: number;
  readonly H: number;
  readonly N: number;
  readonly latMaxDeg: number;
  /** Latitude (radians) de chaque ligne. */
  readonly lat: Float64Array;
  /** Longitude (radians) de chaque colonne. */
  readonly lon: Float64Array;
  /** Position 3D sur la sphère unité de chaque cellule. */
  readonly px: Float32Array;
  readonly py: Float32Array;
  readonly pz: Float32Array;
  /** Largeur (km) d'une cellule pour chaque ligne. */
  readonly dxKm: Float64Array;
  readonly dyKm: number;
  /** Surface (km²) d'une cellule pour chaque ligne. */
  readonly area: Float64Array;
  /** Voisins 8-connexes (N*8), -1 hors carte (haut/bas). */
  readonly nbr: Int32Array;
  /** Distance (km) vers chaque voisin, indexée [ligne*8 + k]. */
  readonly ndist: Float32Array;

  constructor(width: number, latMaxDeg: number) {
    const W = width;
    const H = Math.max(16, Math.round((W * 2 * latMaxDeg) / 360));
    this.W = W;
    this.H = H;
    this.N = W * H;
    this.latMaxDeg = latMaxDeg;
    const latMax = (latMaxDeg * Math.PI) / 180;

    this.lat = new Float64Array(H);
    this.lon = new Float64Array(W);
    this.dxKm = new Float64Array(H);
    this.area = new Float64Array(H);
    this.dyKm = ((2 * latMax) / H) * R_EARTH_KM;
    for (let y = 0; y < H; y++) {
      this.lat[y] = latMax - ((y + 0.5) / H) * 2 * latMax;
      this.dxKm[y] = ((2 * Math.PI) / W) * R_EARTH_KM * Math.cos(this.lat[y]);
      this.area[y] = this.dxKm[y] * this.dyKm;
    }
    for (let x = 0; x < W; x++) this.lon[x] = -Math.PI + ((x + 0.5) / W) * 2 * Math.PI;

    const N = this.N;
    this.px = new Float32Array(N);
    this.py = new Float32Array(N);
    this.pz = new Float32Array(N);
    for (let y = 0; y < H; y++) {
      const cl = Math.cos(this.lat[y]);
      const sl = Math.sin(this.lat[y]);
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        this.px[i] = cl * Math.cos(this.lon[x]);
        this.py[i] = cl * Math.sin(this.lon[x]);
        this.pz[i] = sl;
      }
    }

    this.nbr = new Int32Array(N * 8);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const base = (y * W + x) * 8;
        for (let k = 0; k < 8; k++) {
          const ny = y + DY8[k];
          if (ny < 0 || ny >= H) {
            this.nbr[base + k] = -1;
            continue;
          }
          let nx = x + DX8[k];
          if (nx < 0) nx += W;
          else if (nx >= W) nx -= W;
          this.nbr[base + k] = ny * W + nx;
        }
      }
    }

    this.ndist = new Float32Array(H * 8);
    for (let y = 0; y < H; y++) {
      for (let k = 0; k < 8; k++) {
        const ny = y + DY8[k];
        if (ny < 0 || ny >= H) continue;
        const ddx = Math.abs(DX8[k]) * 0.5 * (this.dxKm[y] + this.dxKm[ny]);
        const ddy = Math.abs(DY8[k]) * this.dyKm;
        this.ndist[y * 8 + k] = Math.sqrt(ddx * ddx + ddy * ddy);
      }
    }
  }

  cellArea(i: number): number {
    return this.area[(i / this.W) | 0];
  }

  /** Cellule contenant (lat, lon) en radians. */
  cellAt(lat: number, lon: number): number {
    const latMax = (this.latMaxDeg * Math.PI) / 180;
    let x = Math.floor(((lon + Math.PI) / (2 * Math.PI)) * this.W);
    x = ((x % this.W) + this.W) % this.W;
    let y = Math.floor(((latMax - lat) / (2 * latMax)) * this.H);
    y = Math.max(0, Math.min(this.H - 1, y));
    return y * this.W + x;
  }
}
