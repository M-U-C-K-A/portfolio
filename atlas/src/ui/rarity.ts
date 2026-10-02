import type { WorldData } from '../gen/types';

/** Paliers de « rareté » warcraftcn, utilisés comme niveaux d'importance. */
export type Rarity = 'default' | 'uncommon' | 'rare' | 'epic' | 'legendary';

const rankCache = new WeakMap<WorldData, Float64Array>();

/** Rang de puissance démographique de chaque pays (0 = le plus peuplé, 1 = le moins). */
function powerRank(world: WorldData): Float64Array {
  let r = rankCache.get(world);
  if (r) return r;
  const cs = world.politics.countries;
  r = new Float64Array(cs.length);
  [...cs].sort((a, b) => b.pop - a.pop).forEach((c, i) => (r![c.id] = i / Math.max(1, cs.length - 1)));
  rankCache.set(world, r);
  return r;
}

export function countryRarity(world: WorldData, id: number): Rarity {
  const r = powerRank(world)[id];
  return r < 0.1 ? 'legendary' : r < 0.3 ? 'epic' : r < 0.6 ? 'rare' : 'uncommon';
}

export function cityRarity(world: WorldData, id: number): Rarity {
  const c = world.politics.cities[id];
  if (c.capital) return powerRank(world)[c.country] < 0.15 ? 'legendary' : 'epic';
  return c.pop >= 1e6 ? 'rare' : 'uncommon';
}
