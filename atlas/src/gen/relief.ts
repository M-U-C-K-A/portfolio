import { R_EARTH_KM, type Grid } from './grid';
import { Noise3 } from './noise';
import { Rng } from './rng';
import { plateVelocity, type Tectonics } from './tectonics';
import type { GenSettings } from './types';
import { areaThreshold, blurKm, clamp, coarseField, MonotoneCubic, smoothstep } from './util';

export interface Relief {
  /** Altitude (m), niveau de la mer = 0. */
  elev: Float32Array;
  /** Soulèvement tectonique positif (m) : chaînes de montagnes, arcs, points chauds. */
  uplift: Float32Array;
  /** "Continentalité" de la croûte (≈0 océanique, ≈1 continentale). */
  crust: Float32Array;
  /** 1 = océan connecté (grandes masses d'eau sous le niveau de la mer). */
  ocean: Uint8Array;
}

/** Profil croûte → altitude : plaine abyssale, talus continental, plateau continental, plaines côtières, intérieur. */
const CRUST_PROFILE = new MonotoneCubic(
  [-0.5, 0.0, 0.22, 0.34, 0.42, 0.47, 0.5, 0.55, 0.68, 1.0, 1.6],
  [-5800, -5000, -4300, -3200, -220, -90, -20, 40, 200, 420, 750],
);

const g = (d: number, w: number): number => Math.exp(-(d * d) / (w * w));

export function buildRelief(grid: Grid, tect: Tectonics, s: GenSettings): Relief {
  const { N, px, py, pz } = grid;
  const { plates, plate, conv, shear, across, src } = tect;
  // distance aux frontières lissée (~50 km) : la distance au point-frontière le plus proche a un pli entre
  // chaque paire de points voisins, et ces plis partaient en rayons perpendiculaires à la frontière
  // (crêtes et sillons rectilignes, nord-sud sous une frontière est-ouest)
  const dist = blurKm(grid, tect.dist, 50, 3);
  const frag = clamp(s.fragmentation, 0, 1);
  const T = s.tectonics;

  // --- 1. Croûte continentale : plaque (floutée à 2 échelles → dôme) + bruit basse fréquence ---
  const nC = new Noise3(Rng.from(s.seed, 'crust'));
  const raw = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    let base = plates[plate[i]].continental ? 1 : 0;
    const b = src[i];
    if (b >= 0 && base > 0) {
      const cv = conv[b];
      if (cv < -0.12) {
        // amincissement près d'un rift : l'océan s'ouvre entre les deux blocs (type Atlantique)
        const kd = smoothstep(0.12, 0.7, -cv);
        base -= 1.15 * kd * g(dist[i], 520);
      }
    }
    raw[i] = base;
  }
  const cNear = blurKm(grid, raw, 170);
  const cFar = blurKm(grid, raw, 650);
  const crust = new Float32Array(N);
  const bigAmp = 0.1 + 0.22 * frag;
  const terraneAmp = 0.3 + 0.9 * frag;
  const coastAmp = 0.04 + 0.05 * frag;
  // champs basse fréquence évalués sur grille grossière (bruit déformé des masses continentales, terranes)
  const q = 0.18;
  const bigNoise = coarseField(grid, 4, (x, y, z) => {
    const wx = nC.fbm(x * 1.3 + 5.1, y * 1.3, z * 1.3, 3);
    const wy = nC.fbm(x * 1.3, y * 1.3 + 9.7, z * 1.3, 3);
    const wz = nC.fbm(x * 1.3, y * 1.3, z * 1.3 + 3.3, 3);
    return nC.fbm(x * 1.6 + q * wx, y * 1.6 + q * wy, z * 1.6 + q * wz, 5);
  });
  const terrane = coarseField(grid, 3, (x, y, z) => smoothstep(1.6, 2.5, nC.fbm(x * 4.2 + 11.3, y * 4.2 - 2.1, z * 4.2 + 7.7, 4)));
  // version basse fréquence (sans la découpe fine des côtes) : sert à typer les frontières sans scintillement
  const crustLow = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const x = px[i], y = py[i], z = pz[i];
    let c = 0.5 * cNear[i] + 0.5 * cFar[i];
    c += bigAmp * bigNoise[i];
    // micro-continents / terranes isolés, surtout en domaine océanique
    c += terraneAmp * terrane[i] * (1 - smoothstep(0.3, 0.6, cNear[i]));
    crustLow[i] = c;
    // découpe fractale des côtes
    c += coastAmp * nC.fbm(x * 8 + 1.7, y * 8, z * 8, 4) + 0.02 * nC.fbm(x * 30, y * 30 + 4.1, z * 30, 3);
    crust[i] = c;
  }

  // --- 2. Relief tectonique ---
  const nM = new Noise3(Rng.from(s.seed, 'mountains'));
  const nI = new Noise3(Rng.from(s.seed, 'interior'));
  const elev = new Float32Array(N);
  const uplift = new Float32Array(N);
  // champs basse fréquence (grille grossière)
  const interior = coarseField(grid, 3, (x, y, z) =>
    200 * nI.fbm(x * 2.6, y * 2.6, z * 2.6, 4) + 700 * smoothstep(0.9, 2.0, nI.fbm(x * 3.1 + 7, y * 3.1, z * 3.1, 3)));
  const oldBelt = coarseField(grid, 2, (x, y, z) => {
    const on = nM.fbm(x * 2.0, y * 2.0 + 3.3, z * 2.0, 2);
    const om = smoothstep(0.3, 1.2, nM.fbm(x * 1.1 + 4.4, y * 1.1, z * 1.1, 3));
    return g(on, 0.13) * om;
  });
  const segment = coarseField(grid, 3, (x, y, z) => clamp(0.88 + 0.22 * nM.fbm(x * 6, y * 6, z * 6 + 8.8, 2), 0.45, 1.25));
  // régions de collines / plateaux disséqués (Massif central, Appalaches, Deccan…) vs grandes plaines
  const hilly = coarseField(grid, 3, (x, y, z) => smoothstep(-0.2, 1.1, nI.fbm(x * 3.3 + 2.2, y * 3.3, z * 3.3 - 1.7, 3)));
  // déformation de la distance aux frontières : chaînes et fosses sinueuses, pas des bandes parallèles régulières
  const nW = new Noise3(Rng.from(s.seed, 'boundary-warp'));
  const warp = coarseField(grid, Math.max(2, Math.round(grid.W / 1024)), (x, y, z) => nW.fbm(x * 8 + 1.7, y * 8, z * 8 - 3.1, 3));
  const warpFine = coarseField(grid, Math.max(2, Math.round(grid.W / 1024)), (x, y, z) => nW.fbm(x * 34 - 5.3, y * 34, z * 34 + 2.9, 3));
  // 1) profils tectoniques bruts (chaque cellule hérite des propriétés de son point-frontière le plus proche)
  const tUp = new Float32Array(N), tDn = new Float32Array(N), tRidge = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    let up = 0, dn = 0, ridge = 0;
    const b = src[i];
    if (b >= 0) {
      const d = Math.max(0, dist[i] * (1 + 0.25 * warp[i]) + 40 * warp[i] + 22 * warpFine[i]);
      const cv = conv[b];
      // parts continentales continues (et non des booléens) : pas de saut de profil d'un secteur à l'autre
      const own = smoothstep(0.44, 0.56, crustLow[b]);
      const a = across[b];
      const oth = smoothstep(0.44, 0.56, crustLow[a]);
      const k = smoothstep(0.05, 0.55, cv);
      const kd = smoothstep(0.05, 0.55, -cv);
      // une fosse ne se creuse que dans de la croûte océanique : jamais en sillon au milieu des terres
      const oceanic = 1 - smoothstep(0.3, 0.48, crustLow[i]);
      if (k > 0) {
        // collision continentale : haute chaîne + plateau d'arrière-pays (Himalaya / Tibet)
        up += 6000 * k * own * oth * (0.75 * g(d, 230) + 0.35 * g(d, 650));
        // marge active : cordillère volcanique en retrait de la fosse (Andes)
        up += k * own * (1 - oth) * (4400 * g(d - 170, 120) + 900 * g(d, 420));
        // plaque océanique plongeant sous un continent : fosse
        dn += 3800 * k * (1 - own) * oth * g(d, 75) * oceanic;
        // subduction océan-océan : arc insulaire côté chevauchant (Japon, Antilles), fosse côté plongeant
        const oo = k * (1 - own) * (1 - oth);
        if (plates[plate[i]].density < plates[plate[a]].density) up += 5000 * oo * g(d - 110, 55);
        else dn += 4200 * oo * g(d, 65) * oceanic;
      }
      if (kd > 0) {
        // rift continental : fossé d'effondrement évasé bordé d'épaulements (Rhin, Rift africain)
        dn += 900 * kd * own * g(d, 70);
        up += 450 * kd * own * g(d - 120, 80);
        // dorsale médio-océanique + bombement thermique
        ridge += 2500 * kd * (1 - own) * (0.6 * g(d, 170) + 0.4 * g(d, 850));
      }
      const ks = smoothstep(0.25, 1.0, shear[b]) * (1 - k) * (1 - kd);
      up += 600 * ks * g(d, 60) * (0.6 + 0.4 * own);
    }

    tUp[i] = up;
    tDn[i] = dn;
    tRidge[i] = ridge;
  }
  // 2) lissage (~45 km) : ces propriétés changent d'un point-frontière au voisin, ce qui laissait des marches
  //    rectilignes en rayons perpendiculaires à la frontière (bandes nord-sud sous une frontière est-ouest)
  const sUp = blurKm(grid, tUp, 45, 2), sDn = blurKm(grid, tDn, 45, 2), sRidge = blurKm(grid, tRidge, 45, 2);

  for (let i = 0; i < N; i++) {
    const x = px[i], y = py[i], z = pz[i];
    const C = crust[i];
    const land = smoothstep(0.45, 0.75, C);
    let h = CRUST_PROFILE.eval(C);

    // plateaux et bassins intérieurs
    h += land * interior[i];

    let up = sUp[i];
    const dn = sDn[i];
    let ridge = sRidge[i];

    // vieilles chaînes érodées au cœur des continents (Appalaches, Oural)
    up += 1500 * oldBelt[i] * smoothstep(0.62, 0.85, C);

    // rugosité : crêtes et vallées, sections plus ou moins hautes le long des chaînes
    if (up > 1) {
      const rug = 0.68 + 0.85 * nM.ridged(x * 20 + 1.3, y * 20, z * 20, 6);
      up *= rug * segment[i] * T;
      // arêtes et vallées à l'échelle de 50–150 km : pas de dômes lisses sous la neige
      up *= 0.78 + 0.5 * nM.ridged(x * 62 + 4.1, y * 62 - 2.7, z * 62, 3);
    }
    if (ridge > 1) ridge *= 0.6 + 0.8 * nM.ridged(x * 26, y * 26 + 2.2, z * 26, 3);

    h += up + ridge - dn * T;
    h += land * 110 * nI.fbm(x * 28, y * 28, z * 28, 4);
    const hl = hilly[i] * land;
    if (hl > 0.01) h += hl * (80 + 520 * nM.ridged(x * 38 + 4.4, y * 38, z * 38, 4));
    // rugosité du fond océanique, nulle sur le plateau continental (sinon il se mouchette d'îlots)
    const abyss = 1 - smoothstep(0.3, 0.44, C);
    h += (15 + 160 * abyss) * nI.fbm(x * 22 + 3.1, y * 22, z * 22, 3);
    elev[i] = h;
    uplift[i] = up;
  }

  // piémonts et massifs : une fraction du soulèvement étalée plus largement autour des chaînes
  const foot = blurKm(grid, uplift, 160, 2);
  for (let i = 0; i < N; i++) {
    const add = 0.32 * foot[i];
    elev[i] += add;
    uplift[i] += add;
  }

  // --- 3. Points chauds : chaînes volcaniques alignées sur le mouvement de la plaque ---
  const hot = new Float32Array(N);
  addHotspots(grid, tect, crust, s, hot);
  for (let i = 0; i < N; i++) {
    if (hot[i] > 1) {
      // édifices volcaniques accidentés plutôt que des dômes lisses
      const v = hot[i] * (0.45 + 0.9 * nM.ridged(px[i] * 34 + 7.7, py[i] * 34, pz[i] * 34, 4));
      elev[i] += v;
      uplift[i] += v;
    }
  }

  // --- 4. Niveau de la mer : on vise exactement la fraction de terres demandée ---
  const thr = areaThreshold(grid, elev, clamp(s.landFraction, 0.02, 0.95));
  for (let i = 0; i < N; i++) {
    let h = elev[i] - thr;
    // compression douce des très hauts sommets (isostasie / limite de résistance de la croûte)
    if (h > 5000) h = 5000 + 3900 * Math.tanh((h - 5000) / 3900);
    elev[i] = h;
  }

  sinkIslets(grid, elev);
  const ocean = markOcean(grid, elev);
  fillInlandBasins(grid, elev, ocean);
  return { elev, uplift, crust, ocean };
}

function addHotspots(grid: Grid, tect: Tectonics, crust: Float32Array, s: GenSettings, out: Float32Array): void {
  const rng = Rng.from(s.seed, 'hotspots');
  const { W, H } = grid;
  const count = Math.round(rng.range(2, 4) + s.plateCount * 0.15);
  const zMax = Math.sin((grid.latMaxDeg * Math.PI) / 180);
  const latMax = (grid.latMaxDeg * Math.PI) / 180;
  const v = new Float64Array(3);

  const stamp = (x: number, y: number, z: number, amp: number, r: number): void => {
    const lat = Math.asin(clamp(z, -1, 1));
    const lon = Math.atan2(y, x);
    const cx = ((lon + Math.PI) / (2 * Math.PI)) * W - 0.5;
    const cy = ((latMax - lat) / (2 * latMax)) * H - 0.5;
    const reach = 2.5 * r;
    const ry = Math.ceil(reach / grid.dyKm);
    for (let yy = Math.max(0, Math.floor(cy) - ry); yy <= Math.min(H - 1, Math.ceil(cy) + ry); yy++) {
      const rx = Math.min(W >> 1, Math.ceil(reach / grid.dxKm[yy]));
      for (let xo = Math.floor(cx) - rx; xo <= Math.ceil(cx) + rx; xo++) {
        const xx = ((xo % W) + W) % W;
        const i = yy * W + xx;
        const dx = grid.px[i] - x, dy = grid.py[i] - y, dz = grid.pz[i] - z;
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz) * R_EARTH_KM;
        if (d > reach) continue;
        const val = amp * g(d, r) * (crust[i] > 0.5 ? 0.35 : 1);
        if (val > out[i]) out[i] = val;
      }
    }
  };

  for (let h = 0; h < count; h++) {
    const lon = rng.range(-Math.PI, Math.PI);
    const z0 = rng.range(-zMax, zMax);
    const c = Math.sqrt(1 - z0 * z0);
    const x0 = c * Math.cos(lon), y0 = c * Math.sin(lon);
    const cell = grid.cellAt(Math.asin(z0), lon);
    plateVelocity(tect.plates[tect.plate[cell]], x0, y0, z0, v);
    let speed = Math.hypot(v[0], v[1], v[2]);
    let dx = v[0], dy = v[1], dz = v[2];
    if (speed < 0.05) {
      // direction tangentielle arbitraire
      dx = -y0; dy = x0; dz = 0;
      speed = 0.3;
    }
    const l = Math.hypot(dx, dy, dz) || 1;
    dx /= l; dy /= l; dz /= l;
    const lenKm = rng.range(600, 2200) * clamp(speed * 1.5, 0.4, 1.4);
    const spacing = 85;
    const K = Math.max(1, Math.floor(lenKm / spacing));
    const amp0 = rng.range(4200, 6000);
    for (let k = 0; k <= K; k++) {
      const age = k / K;
      if (k > 0 && rng.chance(0.15 + 0.3 * age)) continue;
      const ang = (k * spacing) / R_EARTH_KM;
      const ca = Math.cos(ang), sa = Math.sin(ang);
      const amp = amp0 * (1 - 0.82 * age) * rng.range(0.65, 1);
      stamp(x0 * ca + dx * sa, y0 * ca + dy * sa, z0 * ca + dz * sa, amp, rng.range(35, 70));
    }
  }
}

/** Océan = composantes connexes sous le niveau de la mer suffisamment vastes ; les autres sont des dépressions intérieures. */
export function markOcean(grid: Grid, elev: Float32Array): Uint8Array {
  const { N, W, nbr } = grid;
  const label = new Int32Array(N).fill(-1);
  const areas: number[] = [];
  const stack = new Int32Array(N);
  let totalArea = 0;
  for (let i = 0; i < N; i++) totalArea += grid.area[(i / W) | 0];
  for (let i = 0; i < N; i++) {
    if (elev[i] >= 0 || label[i] >= 0) continue;
    const id = areas.length;
    let area = 0, sp = 0;
    stack[sp++] = i;
    label[i] = id;
    while (sp > 0) {
      const c = stack[--sp];
      area += grid.area[(c / W) | 0];
      const base = c * 8;
      for (let k = 0; k < 8; k++) {
        const n = nbr[base + k];
        if (n < 0 || label[n] >= 0 || elev[n] >= 0) continue;
        label[n] = id;
        stack[sp++] = n;
      }
    }
    areas.push(area);
  }
  let maxArea = 0;
  for (const a of areas) if (a > maxArea) maxArea = a;
  const isOcean = areas.map((a) => a === maxArea || a >= totalArea * 0.0002);
  const ocean = new Uint8Array(N);
  for (let i = 0; i < N; i++) if (label[i] >= 0 && isOcean[label[i]]) ocean[i] = 1;
  return ocean;
}

/** Supprime les îlots bas d'une ou deux cellules (bruit de plaine côtière, pas de vraies îles). */
function sinkIslets(grid: Grid, elev: Float32Array): void {
  const { N, nbr } = grid;
  const seen = new Uint8Array(N);
  const comp: number[] = [];
  for (let i = 0; i < N; i++) {
    if (seen[i] || elev[i] < 0) continue;
    comp.length = 0;
    comp.push(i);
    seen[i] = 1;
    let maxH = elev[i];
    for (let q = 0; q < comp.length && comp.length <= 3; q++) {
      const base = comp[q] * 8;
      for (let k = 0; k < 8; k++) {
        const n = nbr[base + k];
        if (n < 0 || seen[n] || elev[n] < 0) continue;
        seen[n] = 1;
        comp.push(n);
        if (elev[n] > maxH) maxH = elev[n];
      }
    }
    if (comp.length <= 2 && maxH < 60) for (const c of comp) elev[c] = -3;
  }
}

/**
 * Les petites dépressions sous le niveau de la mer non reliées à l'océan sont remblayées
 * jusqu'au niveau de leur seuil : elles deviennent des plaines alluviales plates.
 */
function fillInlandBasins(grid: Grid, elev: Float32Array, ocean: Uint8Array): void {
  const { N, nbr } = grid;
  const seen = new Uint8Array(N);
  const comp: number[] = [];
  for (let i = 0; i < N; i++) {
    if (seen[i] || ocean[i] || elev[i] >= 0) continue;
    comp.length = 0;
    comp.push(i);
    seen[i] = 1;
    let rim = Infinity;
    for (let q = 0; q < comp.length; q++) {
      const base = comp[q] * 8;
      for (let k = 0; k < 8; k++) {
        const n = nbr[base + k];
        if (n < 0) continue;
        if (elev[n] >= 0 || ocean[n]) {
          if (!ocean[n] && elev[n] < rim) rim = elev[n];
          continue;
        }
        if (seen[n]) continue;
        seen[n] = 1;
        comp.push(n);
      }
    }
    const level = Math.max(1, Number.isFinite(rim) ? rim - 0.5 : 1);
    for (const c of comp) elev[c] = level;
  }
}
