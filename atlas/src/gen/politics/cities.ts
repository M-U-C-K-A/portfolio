import { Rng } from '../rng';
import { smoothstep } from '../util';
import { SpatialHash, type Components, type Terrain } from './common';
import type { Habitat } from './habitat';

export interface CitySite {
  cell: number;
  pop: number;
  port: boolean;
  /** Cellule océanique adjacente (départ des lignes maritimes), -1 sinon. */
  portCell: number;
  river: boolean;
  landmass: number;
}

/**
 * Emplacements des villes : sites favorables (confluences, embouchures, baies abritées, rives de lacs)
 * dans les régions habitables, avec un espacement d'autant plus serré que la région est fertile.
 */
export function placeCities(t: Terrain, habitat: Habitat, landmass: Components, count: number, rng: Rng): CitySite[] {
  const { grid, ocean, discharge, rcv, lakeDepth } = t;
  const { N, W, nbr } = grid;
  const hab = habitat.hab;

  const bigDonors = new Uint8Array(N);
  for (let i = 0; i < N; i++) {
    if (ocean[i] || discharge[i] < 60) continue;
    const r = rcv[i];
    if (r !== i && bigDonors[r] < 255) bigDonors[r]++;
  }

  const score = new Float32Array(N);
  const siteRiver = new Float32Array(N);
  const cand: number[] = [];
  let landArea = 0;
  for (let i = 0; i < N; i++) {
    if (ocean[i]) continue;
    landArea += grid.area[(i / W) | 0];
    if (lakeDepth[i] > 0 || hab[i] < 0.03) continue;
    const q = discharge[i];
    const riverF = smoothstep(1.7, 3.8, Math.log10(1 + q));
    const conf = bigDonors[i] >= 2 && q > 150 ? 1 : 0;
    const mouth = q > 200 && ocean[rcv[i]] ? 1 : 0;
    let seaN = 0, lakeN = 0;
    const base = i * 8;
    for (let k = 0; k < 8; k++) {
      const n = nbr[base + k];
      if (n < 0) continue;
      if (ocean[n]) seaN++;
      else if (lakeDepth[n] > 0) lakeN++;
    }
    const harbor = seaN >= 1 && seaN <= 4 ? 1 : seaN > 4 ? 0.3 : 0;
    score[i] = hab[i] * (1 + 0.5 * riverF + 0.8 * conf + 0.9 * mouth + 0.45 * harbor + 0.25 * (lakeN > 0 ? 1 : 0));
    siteRiver[i] = riverF;
    if (score[i] > 0.02) cand.push(i);
  }
  const key = new Float32Array(N);
  for (const i of cand) key[i] = score[i] * (0.55 + 0.9 * rng.next());
  cand.sort((a, b) => key[b] - key[a]);

  const spacing = Math.sqrt(landArea / Math.max(1, count)) * 0.75;
  const hash = new SpatialHash(grid, spacing * 1.4);
  const chosen: number[] = [];
  let factor = 1;
  for (let pass = 0; pass < 4 && chosen.length < count; pass++) {
    for (const i of cand) {
      if (chosen.length >= count) break;
      const minKm = spacing * factor * (1.35 - 0.7 * hab[i]);
      if (hash.anyWithin(i, minKm)) continue;
      hash.add(i);
      chosen.push(i);
    }
    factor *= 0.78;
  }

  // population urbaine : bassin de peuplement (~150 km) × bonus de site × aléa log-normal
  const sites: CitySite[] = chosen.map((cell) => {
    const y0 = (cell / W) | 0, x0 = cell % W;
    const ry = Math.max(1, Math.round(150 / grid.dyKm));
    let catchment = 0;
    for (let y = Math.max(0, y0 - ry); y <= Math.min(grid.H - 1, y0 + ry); y++) {
      const rx = Math.min(W >> 1, Math.max(1, Math.round(150 / grid.dxKm[y])));
      for (let dx = -rx; dx <= rx; dx++) {
        const j = y * W + ((x0 + dx + W) % W);
        catchment += habitat.density[j] * grid.area[y];
      }
    }
    let portCell = -1;
    const base = cell * 8;
    for (let k = 0; k < 8; k++) {
      const n = nbr[base + k];
      if (n >= 0 && ocean[n]) {
        portCell = n;
        break;
      }
    }
    const bonus = 1 + (portCell >= 0 ? 0.6 : 0) + 0.5 * (bigDonors[cell] >= 2 ? 1 : 0) + 0.4 * siteRiver[cell];
    const pop = catchment * 0.1 * bonus * Math.exp(0.5 * rng.normal());
    return { cell, pop, port: portCell >= 0, portCell, river: siteRiver[cell] > 0.3, landmass: landmass.label[cell] };
  });
  // mise à l'échelle : les villes retenues rassemblent ~18 % de la population mondiale
  let sum = 0;
  for (const c of sites) sum += c.pop;
  const k = sum > 0 ? (0.18 * habitat.totalPop) / sum : 1;
  for (const c of sites) c.pop = Math.max(4000, Math.round((c.pop * k) / 1000) * 1000);
  sites.sort((a, b) => b.pop - a.pop);
  return sites;
}
