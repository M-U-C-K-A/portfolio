/**
 * Génère un monde en Node (sans navigateur) et écrit des aperçus PNG pour contrôle rapide.
 * Usage : npx tsx scripts/bench.ts [graine] [largeur] [dossier]
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { BIOMES } from '../src/gen/biomes';
import { generateWorld } from '../src/gen/pipeline';
import { DEFAULT_SETTINGS, type WorldData } from '../src/gen/types';

const seed = process.argv[2] ?? 'terra';
const width = Number(process.argv[3] ?? 1024);
const out = process.argv[4] ?? 'scratch-out';
const extra = process.argv[5] ? JSON.parse(process.argv[5]) : {};
mkdirSync(out, { recursive: true });

const t0 = performance.now();
let last = '';
const { world } = generateWorld({ ...DEFAULT_SETTINGS, seed, width, ...extra }, (stage) => {
  if (stage !== last) {
    last = stage;
    process.stdout.write(`  ${stage}…\n`);
  }
});
console.log(`total ${Math.round(performance.now() - t0)} ms`, world.stats);

const { W, H } = world;

function crc32(buf: Buffer): number {
  let c: number, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function writePng(file: string, w: number, h: number, rgb: Uint8ClampedArray): void {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 3 + 1)] = 0;
    for (let x = 0; x < w * 3; x++) raw[y * (w * 3 + 1) + 1 + x] = rgb[y * w * 3 + x];
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
  writeFileSync(file, png);
}

function shade(w: WorldData, i: number, exag: number): number {
  const x = i % W, y = (i / W) | 0;
  const l = y * W + ((x + W - 1) % W), r = y * W + ((x + 1) % W);
  const u = Math.max(0, y - 1) * W + x, d = Math.min(H - 1, y + 1) * W + x;
  const lat = ((w.latMax - ((y + 0.5) / H) * 2 * w.latMax) * Math.PI) / 180;
  const cell = ((2 * Math.PI * 6371) / W) * 1000;
  const hh = (k: number) => Math.max(w.height[k], w.ocean[k] ? w.height[k] : 0);
  const gx = (hh(r) - hh(l)) / (2 * cell * Math.cos(lat));
  const gy = (hh(d) - hh(u)) / (2 * cell);
  const nx = -gx * exag, ny = -gy * exag, nz = 1;
  const nl = Math.hypot(nx, ny, nz);
  const L = [-0.55, -0.65, 0.75];
  const Ll = Math.hypot(L[0], L[1], L[2]);
  return ((nx * L[0] + ny * L[1] + nz * L[2]) / nl / Ll) / (L[2] / Ll);
}

function render(kind: 'terrain' | 'relief' | 'plates' | 'precip' | 'temp' | 'political'): Uint8ClampedArray {
  const img = new Uint8ClampedArray(W * H * 3);
  const pal: number[][] = [];
  for (let p = 0; p < 256; p++) pal.push([60 + ((p * 97) % 180), 60 + ((p * 57) % 180), 60 + ((p * 131) % 180)]);
  for (let i = 0; i < W * H; i++) {
    const h = world.height[i];
    let c: number[];
    const sh = Math.max(0.25, Math.min(1.6, shade(world, i, kind === 'plates' ? 10 : 30)));
    if (kind === 'political') {
      const pol = world.politics;
      const o = pol.country[i];
      if (world.ocean[i]) c = [30, 50, 80];
      else if (o === 65535) c = [120, 120, 120];
      else c = world.politics.countries[o].color.map((v) => v * (0.75 + 0.25 * sh));
      const x = i % W, y = (i / W) | 0;
      const r = y * W + ((x + 1) % W), d = Math.min(H - 1, y + 1) * W + x;
      if (!world.ocean[i] && ((!world.ocean[r] && pol.country[r] !== o) || (!world.ocean[d] && pol.country[d] !== o))) c = [20, 20, 20];
      else if (!world.ocean[i] && (pol.province[r] !== pol.province[i] || pol.province[d] !== pol.province[i])) c = c.map((v) => v * 0.8);
    } else if (kind === 'plates') {
      c = pal[world.plate[i]].map((v) => v * (world.ocean[i] ? 0.6 : 1) * (0.6 + 0.4 * sh));
      const b = world.boundary[i];
      if (b === 1) c = [230, 40, 40];
      else if (b === 2) c = [40, 200, 240];
      else if (b === 3) c = [240, 220, 40];
    } else if (kind === 'precip') {
      const p = world.precipitation[i];
      const t = Math.min(1, Math.log10(1 + p) / 3.7);
      c = [255 * (1 - t), 200 * t + 40, 255 * t * t];
      c = c.map((v) => v * (world.ocean[i] ? 0.6 : 1));
    } else if (kind === 'temp') {
      const t = Math.max(0, Math.min(1, (world.temperature[i] + 30) / 65));
      c = [255 * t, 100 + 80 * Math.sin(t * Math.PI), 255 * (1 - t)];
    } else if (world.ocean[i]) {
      const d = Math.min(1, Math.pow(-h / 6000, 0.5));
      c = [60 - 40 * d, 100 - 60 * d, 130 - 50 * d].map((v) => v * (0.85 + 0.15 * sh));
    } else if (kind === 'relief') {
      const t = Math.min(1, h / 5000);
      c = [80 + 150 * t, 140 + 40 * Math.sin(t * 3), 80 + 100 * t * t].map((v) => v * sh);
    } else {
      c = BIOMES[world.biome[i]].color.map((v) => v * sh);
    }
    img[i * 3] = c[0];
    img[i * 3 + 1] = c[1];
    img[i * 3 + 2] = c[2];
  }
  if (kind === 'political') {
    const { routePts: rp, routeOffsets: ro, routeKind: rk, routeVolume: rv } = world.politics;
    let maxV = 0;
    for (const v of rv) maxV = Math.max(maxV, v);
    for (let r = 0; r < ro.length - 1; r++) {
      const a = Math.min(1, 0.3 + Math.log10(1 + (rv[r] / maxV) * 1000) / 3);
      for (let k = ro[r]; k < ro[r + 1] - 1; k++) {
        const x0 = rp[k * 2], y0 = rp[k * 2 + 1], x1 = rp[k * 2 + 2], y1 = rp[k * 2 + 3];
        const steps = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2) + 1;
        for (let s2 = 0; s2 <= steps; s2++) {
          const x = Math.floor(x0 + ((x1 - x0) * s2) / steps), y = Math.floor(y0 + ((y1 - y0) * s2) / steps);
          if (y < 0 || y >= H) continue;
          const j = y * W + (((x % W) + W) % W);
          const col = rk[r] ? [220, 235, 245] : [110, 60, 20];
          for (let ch = 0; ch < 3; ch++) img[j * 3 + ch] = img[j * 3 + ch] * (1 - a) + col[ch] * a;
        }
      }
    }
    for (const c of world.politics.cities) {
      const rad = c.capital ? 2 : c.pop > 300000 ? 1 : 0;
      for (let dy = -rad; dy <= rad; dy++) for (let dx = -rad; dx <= rad; dx++) {
        const y = Math.floor(c.y) + dy;
        if (y < 0 || y >= H) continue;
        const j = y * W + ((Math.floor(c.x) + dx + W) % W);
        img[j * 3] = c.capital ? 255 : 250; img[j * 3 + 1] = c.capital ? 40 : 250; img[j * 3 + 2] = c.capital ? 40 : 250;
      }
    }
  }
  if (kind === 'terrain' || kind === 'relief') {
    const { riverPts: rp, riverOffsets: ro } = world;
    for (let r = 0; r < ro.length - 1; r++) {
      for (let k = ro[r]; k < ro[r + 1] - 1; k++) {
        const x0 = rp[k * 3], y0 = rp[k * 3 + 1], x1 = rp[k * 3 + 3], y1 = rp[k * 3 + 4];
        const q = rp[k * 3 + 2];
        const steps = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2) + 1;
        for (let s = 0; s <= steps; s++) {
          const x = Math.floor(x0 + ((x1 - x0) * s) / steps);
          const y = Math.floor(y0 + ((y1 - y0) * s) / steps);
          if (y < 0 || y >= H) continue;
          const j = y * W + (((x % W) + W) % W);
          const a = Math.min(1, 0.35 + Math.log10(q / 100) * 0.4);
          img[j * 3] = img[j * 3] * (1 - a) + 40 * a;
          img[j * 3 + 1] = img[j * 3 + 1] * (1 - a) + 80 * a;
          img[j * 3 + 2] = img[j * 3 + 2] * (1 - a) + 150 * a;
        }
      }
    }
  }
  return img;
}

for (const k of ['terrain', 'relief', 'plates', 'precip', 'temp', 'political'] as const) {
  writePng(`${out}/${seed}-${k}.png`, W, H, render(k));
}
console.log('écrit dans', out);

// --- diagnostics géopolitiques ---
{
  const pol = world.politics;
  console.log(`pays ${pol.countries.length}, provinces ${pol.provinces.length}, villes ${pol.cities.length}, continents ${pol.continents.length}, tronçons ${pol.routeKind.length}, liaisons ${pol.linkA.length} (maritimes ${pol.linkKind.reduce((a, b) => a + b, 0)}), population ${(pol.totalPop / 1e9).toFixed(2)} Md`);
  console.log('continents:', pol.continents.map((c) => `${c.name} (${c.kind}, ${Math.round(c.landArea / 1e3)}k km²)`).join(', '));
  const top = [...pol.countries].sort((a, b) => b.pop - a.pop).slice(0, 8);
  for (const c of top) console.log(`  ${c.fullName.padEnd(34)} capitale ${pol.cities[c.capital].name.padEnd(12)} pop ${(c.pop / 1e6).toFixed(1)} M, ${Math.round(c.area / 1e3)}k km², ${c.provinces} prov, ${c.cities} villes, ${c.neighbors.length} voisins`);
  const tc = [...pol.cities].sort((a, b) => b.pop - a.pop).slice(0, 6);
  for (const c of tc) console.log(`  ville ${c.name.padEnd(12)} ${(c.pop / 1e6).toFixed(2)} M  commerce ${c.trade.toFixed(0)}  partenaires: ${c.partners.slice(0, 3).map((p) => `${pol.cities[p.id].name} ${(p.share * 100).toFixed(0)}%`).join(', ')}`);
}

// --- lore ---
if (process.env.LORE) {
  const pol = world.politics;
  console.log(`\nAn ${pol.year} — ${pol.cultureGroups.length} familles, ${pol.cultures.length} cultures, ${pol.religions.length} religions, ${pol.dynasties.length} dynasties`);
  for (const g of pol.cultureGroups) console.log(`  ${g.name}: ${g.cultures.map((c) => pol.cultures[c].name + ' [' + pol.cultures[c].traits.join(', ') + ']').join(' ; ')}`);
  for (const r of pol.religions) console.log(`  ✦ ${r.symbol} ${r.name} (${r.kind}${r.parent >= 0 ? ', confession de ' + pol.religions[r.parent].name : ''}) — ${(r.pop / 1e6).toFixed(0)} M, ${r.provinces} prov.\n      ${r.description}`);
  for (const d of pol.dynasties.slice(0, 4)) console.log(`  ♛ ${d.house} (${d.name}), fondée en ${d.founded} par ${d.founder} — « ${d.motto} » — ${d.arms.blazon} — ${d.lineage.length} souverains, pays: ${d.countries.map((c) => pol.countries[c].name).join(', ')}\n      ${d.lineage.slice(-4).map((e) => `${e.title} ${e.name} (${e.from}–${e.to}, ${e.relation}${e.fate ? ', ' + e.fate : ''})`).join(' | ')}`);
  for (const c of [...pol.countries].sort((a, b) => b.pop - a.pop).slice(0, 3)) {
    console.log(`\n  ■ ${c.fullName} — ${c.ruler.title} ${c.ruler.regnal}, ${c.ruler.age} ans, ${c.ruler.traits.join(', ')} — ${c.arms.blazon}`);
    console.log(`    ${c.history}`);
    for (const e of c.events) console.log(`    ${e.year} : ${e.text}`);
  }
}

// --- diagnostics climatiques ---
{
  const areaB = new Float64Array(BIOMES.length);
  let landA = 0;
  const bands = 12;
  const bp = new Float64Array(bands), bt = new Float64Array(bands), bn = new Float64Array(bands);
  for (let i = 0; i < W * H; i++) {
    if (world.ocean[i]) continue;
    const y = (i / W) | 0;
    const lat = world.latMax - ((y + 0.5) / H) * 2 * world.latMax;
    const a = Math.cos((lat * Math.PI) / 180);
    areaB[world.biome[i]] += a;
    landA += a;
    const b = Math.min(bands - 1, Math.floor(((lat + world.latMax) / (2 * world.latMax)) * bands));
    bp[b] += world.precipitation[i] * a;
    bt[b] += world.temperature[i] * a;
    bn[b] += a;
  }
  console.log('biomes (terres):');
  BIOMES.forEach((b, k) => areaB[k] > 0 && console.log(`  ${b.name.padEnd(26)} ${((100 * areaB[k]) / landA).toFixed(1)}%`));
  console.log('lat   P(mm)  T(°C)');
  for (let b = bands - 1; b >= 0; b--) {
    const lat = -world.latMax + ((b + 0.5) / bands) * 2 * world.latMax;
    if (bn[b] > 0) console.log(`${lat.toFixed(0).padStart(4)} ${(bp[b] / bn[b]).toFixed(0).padStart(6)} ${(bt[b] / bn[b]).toFixed(1).padStart(6)}`);
  }
}
