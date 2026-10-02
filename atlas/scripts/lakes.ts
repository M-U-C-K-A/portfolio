// Statistiques des lacs d'un monde : npx tsx scripts/lakes.ts [graine]
import { generateWorld } from '../src/gen/pipeline';
import { DEFAULT_SETTINGS } from '../src/gen/types';
const { world } = generateWorld({ ...DEFAULT_SETTINGS, seed: process.argv[2] ?? 'terra', width: 1024 }, () => {});
const { W, H } = world;
const seen = new Uint8Array(W * H);
const lakes: { n: number; maxD: number; meanH: number; salt: number; lat: number }[] = [];
for (let i = 0; i < W * H; i++) {
  if (seen[i] || world.lakeDepth[i] <= 0) continue;
  const st = [i]; seen[i] = 1; let n = 0, maxD = 0, sh = 0, salt = 0, sy = 0;
  while (st.length) {
    const c = st.pop()!; n++; maxD = Math.max(maxD, world.lakeDepth[c]); sh += world.height[c] + world.lakeDepth[c]; salt += world.lakeSalt[c]; sy += (c / W) | 0;
    const x = c % W, y = (c / W) | 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const ny = y + dy; if (ny < 0 || ny >= H) continue;
      const j = ny * W + ((x + dx + W) % W);
      if (!seen[j] && world.lakeDepth[j] > 0) { seen[j] = 1; st.push(j); }
    }
  }
  lakes.push({ n, maxD, meanH: sh / n, salt: salt / n, lat: world.latMax - (sy / n / H) * 2 * world.latMax });
}
lakes.sort((a, b) => b.n - a.n);
console.log('lakes', lakes.length, 'cells total', lakes.reduce((s, l) => s + l.n, 0));
for (const l of lakes.slice(0, 15)) console.log(`cells ${l.n}  maxDepth ${l.maxD.toFixed(0)}m  level ${l.meanH.toFixed(0)}m  salt ${l.salt.toFixed(1)}  lat ${l.lat.toFixed(0)}`);
const hist = [0, 0, 0, 0, 0]; for (const l of lakes) hist[l.n < 3 ? 0 : l.n < 10 ? 1 : l.n < 50 ? 2 : l.n < 200 ? 3 : 4]++;
console.log('size hist <3,<10,<50,<200,>=200:', hist);
