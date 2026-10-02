import type { Grid } from './grid';
import { Noise3 } from './noise';
import { Rng } from './rng';
import type { GenSettings } from './types';
import { clamp, sampleWrap, smoothstep, table } from './util';

/** Température moyenne annuelle au niveau de la mer selon la latitude (°C), calée sur la Terre. */
export const seaLevelTemp = (absLatDeg: number): number => 27 - 52 * Math.pow(absLatDeg / 90, 1.8);

// Circulation générale (cellules de Hadley, Ferrel, polaire) — |latitude| en degrés.
const WIND_LAT = [0, 10, 20, 30, 40, 50, 60, 67, 80, 90];
/** Composante zonale (+ = vers l'est) : alizés, vents d'ouest, vents d'est polaires. */
const WIND_U = [-0.7, -1.0, -0.8, 0.0, 0.9, 1.0, 0.4, -0.3, -0.6, -0.4];
const WIND_VLAT = [0, 8, 20, 30, 40, 55, 62, 70, 90];
/** Composante méridienne (+ = vers le pôle). */
const WIND_V = [0.0, -0.35, -0.3, 0.0, 0.25, 0.2, 0.0, -0.2, -0.1];
// Efficacité des précipitations : ZCIT très pluvieuse, anticyclones subtropicaux secs, fronts des latitudes moyennes.
const RAIN_LAT = [0, 6, 12, 18, 24, 30, 36, 42, 50, 58, 66, 75, 90];
const RAIN_F = [1.9, 1.8, 1.25, 0.6, 0.2, 0.12, 0.35, 0.8, 1.0, 0.95, 0.75, 0.5, 0.4];

/** Champs grossiers (~1°) issus du modèle d'humidité. */
export interface Moisture {
  f: number;
  Wc: number;
  Hc: number;
  /** Précipitations (mm/an). */
  precip: Float32Array;
  /** Influence maritime 0..1 (1 = air océanique). */
  maritime: Float32Array;
  /** Anomalie thermique (°C) due aux courants océaniques, transportée par les vents. */
  anomaly: Float32Array;
  windU: Float32Array;
  windV: Float32Array;
}

export function computeMoisture(grid: Grid, h: Float32Array, ocean: Uint8Array, s: GenSettings): Moisture {
  const { W, H } = grid;
  // grille grossière ~1° : au-delà de 2048 cellules, on garde ~512 colonnes pour borner le coût
  let f = W > 2048 ? Math.max(4, Math.round(W / 512)) : W >= 1024 ? 4 : 2;
  while (f > 1 && W % f !== 0) f--;
  const Wc = W / f;
  const Hc = Math.ceil(H / f);
  const Nc = Wc * Hc;
  const latMax = (grid.latMaxDeg * Math.PI) / 180;

  // agrégation sur la grille grossière
  const hC = new Float32Array(Nc);
  const oc = new Float32Array(Nc);
  const cnt = new Float32Array(Nc);
  for (let y = 0; y < H; y++) {
    const cy = (y / f) | 0;
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const ci = cy * Wc + ((x / f) | 0);
      hC[ci] += h[i] > 0 ? h[i] : 0;
      oc[ci] += ocean[i];
      cnt[ci]++;
    }
  }
  for (let i = 0; i < Nc; i++) {
    hC[i] /= cnt[i];
    oc[i] /= cnt[i];
  }

  const latC = new Float64Array(Hc);
  for (let yc = 0; yc < Hc; yc++) {
    const rows = Math.min(f, H - yc * f);
    const yCenter = yc * f + rows / 2;
    latC[yc] = latMax - (yCenter / H) * 2 * latMax;
  }

  // vents : table latitudinale + méandres à grande échelle
  const noise = new Noise3(Rng.from(s.seed, 'wind'));
  const STEP_KM = 120;
  const windU = new Float32Array(Nc);
  const windV = new Float32Array(Nc);
  const Tc = new Float32Array(Nc);
  for (let yc = 0; yc < Hc; yc++) {
    const lat = latC[yc];
    const absDeg = (Math.abs(lat) * 180) / Math.PI;
    const sgn = lat >= 0 ? 1 : -1;
    const u0 = table(WIND_LAT, WIND_U, absDeg);
    const vN = table(WIND_VLAT, WIND_V, absDeg) * sgn;
    const dxKm = grid.dxKm[Math.min(H - 1, yc * f)] * f;
    const dyKm = grid.dyKm * f;
    const tsl = seaLevelTemp(absDeg) + s.temperature;
    const cl = Math.cos(lat), sl = Math.sin(lat);
    for (let xc = 0; xc < Wc; xc++) {
      const ci = yc * Wc + xc;
      const lon = -Math.PI + ((xc + 0.5) / Wc) * 2 * Math.PI;
      const px = cl * Math.cos(lon), py = cl * Math.sin(lon), pz = sl;
      const th = 0.45 * noise.fbm(px * 2.5, py * 2.5, pz * 2.5, 2);
      const ct = Math.cos(th), st = Math.sin(th);
      let east = u0 * ct - vN * st;
      let north = u0 * st + vN * ct;
      const sp = Math.hypot(east, north);
      if (sp < 0.3) {
        const k = 0.3 / (sp || 1);
        east = sp > 0 ? east * k : 0.3;
        north *= sp > 0 ? k : 0;
      }
      windU[ci] = clamp((east * STEP_KM) / dxKm, -Wc / 4, Wc / 4);
      windV[ci] = (-north * STEP_KM) / dyKm;
      Tc[ci] = tsl - (6.5 * hC[ci]) / 1000;
    }
  }

  // courants océaniques : anomalie de température de surface selon la position dans le bassin
  //  - façade orientale des océans, subtropiques : upwelling froid (Humboldt, Benguela, Californie)
  //  - façade occidentale, subtropiques : courants chauds de bord ouest (Gulf Stream, Kuroshio)
  //  - façade orientale, latitudes moyennes/hautes : dérive chaude (Europe de l'Ouest, Norvège)
  const sstA = new Float32Array(Nc);
  const dE = new Float32Array(Wc), dW = new Float32Array(Wc);
  for (let yc = 0; yc < Hc; yc++) {
    const absDeg = (Math.abs(latC[yc]) * 180) / Math.PI;
    const wCold = smoothstep(8, 18, absDeg) * (1 - smoothstep(35, 45, absDeg));
    const wWarm = smoothstep(15, 25, absDeg) * (1 - smoothstep(40, 50, absDeg));
    const wDrift = smoothstep(42, 52, absDeg) * (1 - smoothstep(68, 75, absDeg));
    if (wCold + wWarm + wDrift === 0) continue;
    const dx = grid.dxKm[Math.min(H - 1, yc * f)] * f;
    const row = yc * Wc;
    let last = -1e9;
    for (let k = 2 * Wc - 1; k >= 0; k--) {
      const xc = k % Wc;
      if (oc[row + xc] <= 0.5) last = k;
      if (k < Wc) dE[xc] = Math.min(8000, (last - k) * dx);
    }
    last = -1e9;
    for (let k = 0; k < 2 * Wc; k++) {
      const xc = k % Wc;
      if (oc[row + xc] <= 0.5) last = k;
      if (k >= Wc) dW[xc] = Math.min(8000, (k - last) * dx);
    }
    for (let xc = 0; xc < Wc; xc++) {
      if (oc[row + xc] <= 0.5) continue;
      const nearEast = smoothstep(2200, 200, dE[xc]);
      const nearWest = smoothstep(2500, 200, dW[xc]);
      sstA[row + xc] = -6 * wCold * nearEast + 4 * wWarm * nearWest + 5 * wDrift * nearEast;
    }
  }

  // advection semi-lagrangienne de l'humidité jusqu'à l'état stationnaire.
  // Les vents étant fixes, la rétro-trajectoire (4 indices + poids bilinéaires) est précalculée.
  const bi = new Int32Array(Nc * 4);
  const bw = new Float32Array(Nc * 4);
  const hUpArr = new Float32Array(Nc);
  for (let yc = 0; yc < Hc; yc++) {
    for (let xc = 0; xc < Wc; xc++) {
      const ci = yc * Wc + xc;
      let sy = yc - windV[ci];
      if (sy < 0) sy = 0;
      else if (sy > Hc - 1) sy = Hc - 1;
      const sx = xc - windU[ci];
      const y0 = Math.floor(sy), ty = sy - y0;
      const y1 = y0 + 1 >= Hc ? Hc - 1 : y0 + 1;
      const x0f = Math.floor(sx), tx = sx - x0f;
      let x0 = x0f % Wc;
      if (x0 < 0) x0 += Wc;
      const x1 = x0 + 1 === Wc ? 0 : x0 + 1;
      const o = ci * 4;
      bi[o] = y0 * Wc + x0; bw[o] = (1 - tx) * (1 - ty);
      bi[o + 1] = y0 * Wc + x1; bw[o + 1] = tx * (1 - ty);
      bi[o + 2] = y1 * Wc + x0; bw[o + 2] = (1 - tx) * ty;
      bi[o + 3] = y1 * Wc + x1; bw[o + 3] = tx * ty;
      hUpArr[ci] = hC[ci] - (hC[bi[o]] * bw[o] + hC[bi[o + 1]] * bw[o + 1] + hC[bi[o + 2]] * bw[o + 2] + hC[bi[o + 3]] * bw[o + 3]);
    }
  }
  const q = new Float32Array(Nc), qn = new Float32Array(Nc);
  let mar = new Float32Array(Nc), marn = new Float32Array(Nc);
  let an = new Float32Array(Nc), ann = new Float32Array(Nc);
  const rain = new Float32Array(Nc);
  const latF = new Float32Array(Hc);
  for (let yc = 0; yc < Hc; yc++) latF[yc] = table(RAIN_LAT, RAIN_F, (Math.abs(latC[yc]) * 180) / Math.PI);
  const ITER = 140;
  for (let it = 0; it < ITER; it++) {
    for (let yc = 0; yc < Hc; yc++) {
      const lf = latF[yc];
      for (let xc = 0; xc < Wc; xc++) {
        const ci = yc * Wc + xc;
        const o = ci * 4;
        const i0 = bi[o], i1 = bi[o + 1], i2 = bi[o + 2], i3 = bi[o + 3];
        const w0 = bw[o], w1 = bw[o + 1], w2 = bw[o + 2], w3 = bw[o + 3];
        let qa = q[i0] * w0 + q[i1] * w1 + q[i2] * w2 + q[i3] * w3;
        let ma = mar[i0] * w0 + mar[i1] * w1 + mar[i2] * w2 + mar[i3] * w3;
        let aa = an[i0] * w0 + an[i1] * w1 + an[i2] * w2 + an[i3] * w3;
        let T = Tc[ci];
        let r: number;
        let recycle = 0;
        if (oc[ci] > 0.5) {
          aa = sstA[ci];
          T += aa;
          const e = clamp((T + 2) / 30, 0, 1.2);
          qa += (0.12 + 0.88 * Math.pow(e, 1.4)) * s.humidity;
          ma = 1;
          r = qa * 0.1 * lf;
        } else {
          T += 0.8 * aa;
          const hUp = hUpArr[ci];
          let rate = 0.085 * lf + (Math.max(0, hUp) / 1000) * 0.7;
          if (hUp < 0) rate /= 1 + (-hUp / 1000) * 1.5; // air descendant, réchauffé : ombre pluviométrique
          r = qa * Math.min(0.92, rate);
          ma *= 0.94;
          aa *= 0.93;
          recycle = 0.3 + 0.45 * clamp(T / 25, 0, 1); // évapotranspiration : la végétation recycle la pluie
        }
        const cap = 2.2 * Math.exp(0.066 * T);
        if (qa - r > cap) r = qa - cap;
        qn[ci] = qa - r * (1 - recycle);
        marn[ci] = ma;
        ann[ci] = aa;
        rain[ci] = r;
      }
    }
    // légère diffusion latérale (les vents réels ne sont pas laminaires)
    for (let yc = 0; yc < Hc; yc++) {
      for (let xc = 0; xc < Wc; xc++) {
        const ci = yc * Wc + xc;
        const l = yc * Wc + (xc === 0 ? Wc - 1 : xc - 1);
        const rr = yc * Wc + (xc === Wc - 1 ? 0 : xc + 1);
        const u = (yc > 0 ? yc - 1 : yc) * Wc + xc;
        const d = (yc < Hc - 1 ? yc + 1 : yc) * Wc + xc;
        q[ci] = 0.88 * qn[ci] + 0.03 * (qn[l] + qn[rr] + qn[u] + qn[d]);
      }
    }
    let tm = mar;
    mar = marn;
    marn = tm;
    tm = an;
    an = ann;
    ann = tm;
  }

  const precip = new Float32Array(Nc);
  for (let i = 0; i < Nc; i++) {
    let p = rain[i] * 2800;
    if (p > 4500) p = 4500 + (p - 4500) * 0.35;
    precip[i] = p;
  }
  return { f, Wc, Hc, precip, maritime: mar, anomaly: an, windU, windV };
}

export interface ClimateFields {
  temperature: Float32Array;
  precip: Float32Array;
}

/** Champs pleine résolution : température avec gradient adiabatique local et continentalité. */
export function finalizeClimate(grid: Grid, h: Float32Array, ocean: Uint8Array, m: Moisture, s: GenSettings): ClimateFields {
  const { W, H, N, px, py, pz } = grid;
  const temperature = new Float32Array(N);
  const precip = new Float32Array(N);
  const noise = new Noise3(Rng.from(s.seed, 'climate-detail'));
  for (let y = 0; y < H; y++) {
    const absDeg = (Math.abs(grid.lat[y]) * 180) / Math.PI;
    const tsl = seaLevelTemp(absDeg) + s.temperature;
    const cy = (y + 0.5) / m.f - 0.5;
    const coldInterior = 6 * smoothstep(25, 65, absDeg);
    const hotInterior = 2 * (1 - smoothstep(20, 45, absDeg));
    const oceanWarm = smoothstep(40, 70, absDeg);
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const cx = (x + 0.5) / m.f - 0.5;
      const cont = 1 - sampleWrap(m.maritime, m.Wc, m.Hc, cx, cy);
      const anom = sampleWrap(m.anomaly, m.Wc, m.Hc, cx, cy);
      // variabilité régionale (tourbillons océaniques, masses d'air) : isothermes non rectilignes
      const tv = noise.fbm(px[i] * 7 + 3.3, py[i] * 7, pz[i] * 7, 3);
      if (ocean[i]) {
        temperature[i] = tsl + oceanWarm + anom + 1.6 * tv;
      } else {
        const hh = h[i] > 0 ? h[i] : 0;
        temperature[i] = tsl - (6.5 * hh) / 1000 - cont * coldInterior + cont * hotInterior + 0.8 * anom + 0.8 * tv;
      }
      const n = noise.fbm(px[i] * 14, py[i] * 14, pz[i] * 14, 2);
      precip[i] = Math.max(0, sampleWrap(m.precip, m.Wc, m.Hc, cx, cy) * (1 + 0.07 * n));
    }
  }
  return { temperature, precip };
}
