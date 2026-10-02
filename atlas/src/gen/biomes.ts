export const B = {
  DEEP_OCEAN: 0,
  SHELF: 1,
  SEA_ICE: 2,
  LAKE: 3,
  SALT_LAKE: 4,
  ICE_CAP: 5,
  TUNDRA: 6,
  TAIGA: 7,
  COLD_STEPPE: 8,
  TEMPERATE_FOREST: 9,
  TEMPERATE_RAINFOREST: 10,
  MEDITERRANEAN: 11,
  COLD_DESERT: 12,
  HOT_DESERT: 13,
  SAVANNA: 14,
  TROPICAL_DRY_FOREST: 15,
  TROPICAL_RAINFOREST: 16,
  WETLAND: 17,
  ALPINE: 18,
  GLACIER: 19,
  GRASSLAND: 20,
  SALT_FLAT: 21,
} as const;

export interface BiomeDef {
  name: string;
  color: [number, number, number];
}

export const BIOMES: BiomeDef[] = [
  { name: 'Océan profond', color: [28, 52, 86] },
  { name: 'Plateau continental', color: [56, 96, 130] },
  { name: 'Banquise', color: [214, 226, 236] },
  { name: 'Lac', color: [64, 110, 150] },
  { name: 'Lac salé', color: [150, 178, 180] },
  { name: 'Calotte glaciaire', color: [240, 244, 248] },
  { name: 'Toundra', color: [150, 152, 124] },
  { name: 'Taïga', color: [52, 86, 62] },
  { name: 'Steppe froide', color: [176, 168, 118] },
  { name: 'Forêt tempérée', color: [72, 120, 58] },
  { name: 'Forêt pluviale tempérée', color: [36, 96, 74] },
  { name: 'Maquis méditerranéen', color: [150, 148, 84] },
  { name: 'Désert froid', color: [196, 182, 146] },
  { name: 'Désert chaud', color: [230, 204, 142] },
  { name: 'Savane', color: [198, 178, 92] },
  { name: 'Forêt tropicale sèche', color: [126, 146, 62] },
  { name: 'Forêt tropicale humide', color: [28, 98, 40] },
  { name: 'Marécages', color: [86, 124, 106] },
  { name: 'Alpages & rocaille', color: [138, 128, 118] },
  { name: 'Glacier de montagne', color: [226, 232, 240] },
  { name: 'Prairie', color: [150, 170, 86] },
  { name: 'Salar', color: [222, 216, 198] },
];

/** Évapotranspiration potentielle annuelle (mm), approximation dépendant de la température. */
export function potentialET(t: number): number {
  const v = 300 + 45 * t;
  return v < 150 ? 150 : v > 1700 ? 1700 : v;
}

export interface BiomeInput {
  ocean: boolean;
  depth: number;
  t: number;
  p: number;
  h: number;
  slope: number;
  lake: boolean;
  salt: boolean;
  saltFlat: boolean;
  absLatDeg: number;
  wetness: number;
}

export function classifyBiome(c: BiomeInput): number {
  if (c.ocean) {
    if (c.t < -1.8) return B.SEA_ICE;
    return c.depth < 220 ? B.SHELF : B.DEEP_OCEAN;
  }
  if (c.lake) return c.salt ? B.SALT_LAKE : B.LAKE;
  if (c.saltFlat) return B.SALT_FLAT;
  const t = c.t;
  if (t < -9) return B.ICE_CAP;
  if (c.h > 2800 && t < -4) return B.GLACIER;
  if (c.h > 2200 && t < 3 && c.slope > 0.02) return B.ALPINE;
  if (t < -2) return B.TUNDRA;
  const a = c.p / potentialET(t);
  if (c.wetness > 0.65 && c.slope < 0.004 && a > 0.7 && t > 0) return B.WETLAND;
  if (t < 5) {
    if (a > 0.5) return B.TAIGA;
    if (a > 0.22) return B.COLD_STEPPE;
    return B.COLD_DESERT;
  }
  if (t < 18) {
    if (a < 0.18) return t < 12 ? B.COLD_DESERT : B.HOT_DESERT;
    if (a < 0.4) return t < 11 ? B.COLD_STEPPE : B.GRASSLAND;
    if (a < 0.75) return c.absLatDeg > 27 && c.absLatDeg < 46 && t > 11 ? B.MEDITERRANEAN : B.GRASSLAND;
    if (a < 1.9) return B.TEMPERATE_FOREST;
    return B.TEMPERATE_RAINFOREST;
  }
  if (a < 0.2) return B.HOT_DESERT;
  if (a < 0.55) return B.SAVANNA;
  if (a < 1.05) return B.TROPICAL_DRY_FOREST;
  return B.TROPICAL_RAINFOREST;
}
