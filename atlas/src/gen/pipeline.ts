import { classifyBiome } from './biomes';
import { computeMoisture, finalizeClimate } from './climate';
import { erode } from './erosion';
import { Grid } from './grid';
import { buildHydrology } from './hydrology';
import { buildRelief } from './relief';
import { buildTectonics, plateVelocity } from './tectonics';
import { generatePolitics, type Terrain } from './politics';
import { terrainKey, type GenSettings, type PlateInfo, type WorldData } from './types';
import { clamp } from './util';
import { drawRivers, naturalPreview, platesPreview, reliefPreview, type PreviewFn } from './preview';

export type ProgressFn = (stage: string, progress: number) => void;

/** Terrain de la dernière génération (le worker le garde pour ne recalculer que la géopolitique). */
export interface TerrainCache {
  key: string;
  terrain: Terrain;
}

/**
 * Génère le monde complet. Si seul un réglage géopolitique a changé, le terrain en cache est réutilisé.
 * Les tableaux du terrain sont copiés avant transfert pour que le cache reste valide.
 */
export function generateWorld(
  s: GenSettings,
  progress: ProgressFn,
  cache: TerrainCache | null = null,
  preview: PreviewFn | null = null,
): { world: WorldData; transfer: ArrayBuffer[]; cache: TerrainCache } {
  const key = terrainKey(s);
  let terrain: Terrain;
  if (cache && cache.key === key) {
    terrain = { ...cache.terrain, settings: s };
  } else {
    terrain = generateTerrain(s, (st, p) => progress(st, p * 0.72), preview);
    cache = { key, terrain };
  }
  const t0 = performance.now();
  const politics = generatePolitics(terrain, (st, p) => progress(st, 0.72 + 0.28 * p), preview);
  const copy = <T extends { slice(): T }>(a: T): T => a.slice();
  const world: WorldData = {
    settings: s,
    W: terrain.grid.W,
    H: terrain.grid.H,
    latMax: s.latMax,
    height: copy(terrain.h),
    temperature: copy(terrain.temperature),
    precipitation: copy(terrain.precip),
    lakeDepth: copy(terrain.lakeDepth),
    lakeSalt: copy(terrain.lakeSalt),
    ocean: copy(terrain.ocean),
    biome: copy(terrain.biome),
    plate: copy(terrain.plate),
    boundary: copy(terrain.boundary),
    discharge: copy(terrain.discharge),
    riverPts: copy(terrain.riverPts),
    riverOffsets: copy(terrain.riverOffsets),
    plates: terrain.plates,
    windW: terrain.windW,
    windH: terrain.windH,
    windU: copy(terrain.windU),
    windV: copy(terrain.windV),
    stats: { ...terrain.stats, timings: { ...terrain.stats.timings, ...politics.timings, 'géopolitique (total)': Math.round(performance.now() - t0) } },
    politics: politics.data,
  };
  const pd = politics.data;
  const transfer = [
    world.height, world.temperature, world.precipitation, world.lakeDepth, world.lakeSalt, world.ocean, world.biome,
    world.plate, world.boundary, world.discharge, world.riverPts, world.riverOffsets, world.windU, world.windV,
    pd.province, pd.country, pd.influence, pd.influenceStrength, pd.continent, pd.popDensity, pd.routePts, pd.routeOffsets,
    pd.routeKind, pd.routeVolume, pd.linkA, pd.linkB, pd.linkKind, pd.linkVolume,
  ].map((a) => a.buffer as ArrayBuffer);
  return { world, transfer, cache };
}

export function generateTerrain(s: GenSettings, progress: ProgressFn, preview: PreviewFn | null = null): Terrain {
  const timings: Record<string, number> = {};
  let t = performance.now();
  const lap = (name: string): void => {
    const now = performance.now();
    timings[name] = Math.round(now - t);
    t = now;
  };

  progress('Grille géographique', 0);
  const grid = new Grid(s.width, s.latMax);
  const { N, W, H } = grid;
  lap('grille');

  progress('Plaques tectoniques', 0.04);
  const tect = buildTectonics(grid, s);
  lap('plaques');
  preview?.('Plaques tectoniques', platesPreview(grid, tect.plate, tect.bType, tect.plates.map((p) => p.continental)));

  progress('Orogenèse et relief', 0.14);
  const relief = buildRelief(grid, tect, s);
  const h = relief.elev;
  const ocean = relief.ocean;
  lap('relief');
  preview?.('Orogenèse et relief', reliefPreview(grid, h, ocean));

  progress('Circulation atmosphérique', 0.34);
  const moist = computeMoisture(grid, h, ocean, s);
  const clim0 = finalizeClimate(grid, h, ocean, moist, s);
  let landP = 0, landN = 0;
  for (let i = 0; i < N; i++) {
    if (ocean[i]) continue;
    landP += clim0.precip[i];
    landN++;
  }
  const meanP = landN > 0 ? landP / landN : 1;
  const precipRel = new Float32Array(N);
  for (let i = 0; i < N; i++) precipRel[i] = clamp(clim0.precip[i] / meanP, 0.05, 4);
  lap('vents');

  progress('Érosion fluviale', 0.42);
  let eroStep = 0;
  erode(grid, h, ocean, precipRel, s, (p) => {
    progress('Érosion fluviale', 0.42 + 0.4 * p);
    if (preview && ++eroStep % 3 === 0) preview('Érosion fluviale', reliefPreview(grid, h, ocean));
  });
  lap('érosion');

  progress('Climat', 0.83);
  const clim = finalizeClimate(grid, h, ocean, moist, s);
  lap('climat');
  preview?.('Climat', naturalPreview(grid, h, ocean, clim.temperature, clim.precip));

  progress('Fleuves et lacs', 0.87);
  const hydro = buildHydrology(grid, h, ocean, clim.temperature, clim.precip, s);
  lap('hydrographie');
  preview?.('Fleuves et lacs', drawRivers(naturalPreview(grid, h, ocean, clim.temperature, clim.precip), grid, hydro.riverPts, hydro.riverOffsets, 60));

  progress('Biomes', 0.95);
  const biome = new Uint8Array(N);
  for (let y = 0; y < H; y++) {
    const up = Math.max(0, y - 1) * W, dn = Math.min(H - 1, y + 1) * W;
    const gdx = 2 * grid.dxKm[y] * 1000, gdy = (dn / W - up / W) * grid.dyKm * 1000 || 1;
    const absLat = (Math.abs(grid.lat[y]) * 180) / Math.PI;
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const l = y * W + (x === 0 ? W - 1 : x - 1), r = y * W + (x === W - 1 ? 0 : x + 1);
      const gx = (Math.max(h[r], 0) - Math.max(h[l], 0)) / gdx;
      const gy = (Math.max(h[dn + x], 0) - Math.max(h[up + x], 0)) / gdy;
      biome[i] = classifyBiome({
        ocean: ocean[i] === 1,
        depth: -h[i],
        t: clim.temperature[i],
        p: clim.precip[i],
        h: h[i],
        slope: Math.hypot(gx, gy),
        lake: hydro.lakeDepth[i] > 0,
        salt: hydro.lakeSalt[i] === 1,
        saltFlat: hydro.saltFlat[i] === 1,
        absLatDeg: absLat,
        wetness: hydro.wetness[i],
      });
    }
  }
  lap('biomes');
  preview?.('Forêts et biomes', drawRivers(naturalPreview(grid, h, ocean, clim.temperature, clim.precip, biome), grid, hydro.riverPts, hydro.riverOffsets, 60));

  // --- infos plaques pour l'affichage ---
  const P = tect.plates.length;
  const sx = new Float64Array(P), sy = new Float64Array(P), sz = new Float64Array(P);
  for (let i = 0; i < N; i++) {
    const p = tect.plate[i];
    const a = grid.area[(i / W) | 0];
    sx[p] += grid.px[i] * a;
    sy[p] += grid.py[i] * a;
    sz[p] += grid.pz[i] * a;
  }
  const v = new Float64Array(3);
  const latMax = (grid.latMaxDeg * Math.PI) / 180;
  const plates: PlateInfo[] = tect.plates.map((pl) => {
    const l = Math.hypot(sx[pl.id], sy[pl.id], sz[pl.id]) || 1;
    const x = sx[pl.id] / l, y = sy[pl.id] / l, z = sz[pl.id] / l;
    const lat = Math.asin(clamp(z, -1, 1));
    const lon = Math.atan2(y, x);
    plateVelocity(pl, x, y, z, v);
    const east = -Math.sin(lon) * v[0] + Math.cos(lon) * v[1];
    const north = -Math.sin(lat) * Math.cos(lon) * v[0] - Math.sin(lat) * Math.sin(lon) * v[1] + Math.cos(lat) * v[2];
    return {
      id: pl.id,
      continental: pl.continental,
      cx: ((lon + Math.PI) / (2 * Math.PI)) * W,
      cy: clamp(((latMax - lat) / (2 * latMax)) * H, 0, H),
      vx: east,
      vy: -north,
      area: pl.area,
    };
  });

  // --- statistiques ---
  let land = 0, total = 0, maxE = -Infinity, minE = Infinity;
  for (let i = 0; i < N; i++) {
    const a = grid.area[(i / W) | 0];
    total += a;
    if (!ocean[i]) land += a;
    if (h[i] > maxE) maxE = h[i];
    if (h[i] < minE) minE = h[i];
  }

  return {
    settings: s,
    grid,
    h,
    ocean,
    temperature: clim.temperature,
    precip: clim.precip,
    lakeDepth: hydro.lakeDepth,
    lakeSalt: hydro.lakeSalt,
    biome,
    plate: tect.plate,
    boundary: tect.bType,
    discharge: hydro.discharge,
    riverPts: hydro.riverPts,
    riverOffsets: hydro.riverOffsets,
    crust: relief.crust,
    rcv: hydro.rcv,
    plates,
    windW: moist.Wc,
    windH: moist.Hc,
    windU: moist.windU,
    windV: moist.windV,
    stats: {
      landPct: (100 * land) / total,
      maxElevation: maxE,
      minElevation: minE,
      riverCount: hydro.riverOffsets.length - 1,
      lakeCount: hydro.lakeCount,
      timings,
    },
  };
}
