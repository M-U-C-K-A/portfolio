import { B } from '../biomes';
import { blurKm, smoothstep } from '../util';
import type { Terrain } from './common';

// Potentiel agricole / habitabilité de chaque biome (0..1)
const HAB: number[] = new Array(32).fill(0);
HAB[B.LAKE] = 0.1;
HAB[B.SALT_LAKE] = 0.02;
HAB[B.TUNDRA] = 0.05;
HAB[B.TAIGA] = 0.22;
HAB[B.COLD_STEPPE] = 0.35;
HAB[B.TEMPERATE_FOREST] = 0.8;
HAB[B.TEMPERATE_RAINFOREST] = 0.6;
HAB[B.MEDITERRANEAN] = 0.95;
HAB[B.COLD_DESERT] = 0.06;
HAB[B.HOT_DESERT] = 0.04;
HAB[B.SAVANNA] = 0.55;
HAB[B.TROPICAL_DRY_FOREST] = 0.7;
HAB[B.TROPICAL_RAINFOREST] = 0.42;
HAB[B.WETLAND] = 0.3;
HAB[B.ALPINE] = 0.07;
HAB[B.GRASSLAND] = 0.9;
HAB[B.SALT_FLAT] = 0.02;

/** Densité moyenne visée sur les terres (hab/km²), ordre de grandeur de la Terre vers 1936. */
const MEAN_DENSITY = 16;

export interface Habitat {
  /** Habitabilité lissée 0..1. */
  hab: Float32Array;
  /** Densité de population (hab/km²). */
  density: Float32Array;
  totalPop: number;
}

export function computeHabitat(t: Terrain, slope: Float32Array): Habitat {
  const { grid, ocean, biome, h, discharge, temperature, lakeDepth } = t;
  const { N, W, nbr } = grid;
  const raw = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    if (ocean[i] || lakeDepth[i] > 0) continue;
    let v = HAB[biome[i]];
    v *= 1 - 0.7 * smoothstep(1400, 3800, h[i]);
    v *= 1 - 0.55 * smoothstep(0.008, 0.05, slope[i]);
    // les vallées fluviales concentrent l'agriculture, surtout en milieu aride (effet « Nil »)
    const rb = smoothstep(1.3, 3.6, Math.log10(1 + discharge[i]));
    v += (1 - v) * 0.6 * rb * (temperature[i] > -2 ? 1 : 0.2);
    let sea = false, lake = false;
    const base = i * 8;
    for (let k = 0; k < 8; k++) {
      const n = nbr[base + k];
      if (n < 0) continue;
      if (ocean[n]) sea = true;
      else if (lakeDepth[n] > 0) lake = true;
    }
    if (sea) v += (1 - v) * 0.12;
    if (lake) v += (1 - v) * 0.08;
    if (temperature[i] < -4) v *= 0.4;
    raw[i] = v;
  }
  const blurred = blurKm(grid, raw, 80, 2);
  const hab = new Float32Array(N);
  const density = new Float32Array(N);
  let sum = 0, area = 0;
  for (let i = 0; i < N; i++) {
    if (ocean[i]) continue;
    const a = grid.area[(i / W) | 0];
    area += a;
    if (lakeDepth[i] > 0) continue;
    // max(0) : la moyenne glissante du flou peut laisser un -1e-17, et pow(négatif, 1.7) = NaN
    hab[i] = Math.max(0, 0.6 * raw[i] + 0.4 * blurred[i]);
    density[i] = Math.pow(hab[i], 1.7);
    sum += density[i] * a;
  }
  const k = sum > 0 ? (MEAN_DENSITY * area) / sum : 0;
  let total = 0;
  for (let i = 0; i < N; i++) {
    density[i] *= k;
    total += density[i] * grid.area[(i / W) | 0];
  }
  return { hab, density, totalPop: total };
}
