import './style.css';
import './ui/warcraft.css';
import { BIOMES, potentialET } from './gen/biomes';
import {
  DEFAULT_SETTINGS, NONE16, PROVINCE_TERRAINS, type GenSettings, type HistEvent, type LabelPath, type WorkerRequest, type WorkerResponse, type WorldData,
} from './gen/types';
import { Life } from './render/life';
import { loadWorld, saveWorld } from './store';
import { refreshOwnership, WorldEditor } from './world-edit';
import { Editor, type EditTool } from './ui/editor';
import { GEO_MODES } from './render/modes';
import { cityMinPop, Overlay } from './render/overlay';
import { CityIcons } from './render/cityicons';
import { MAP_MODES, MapRenderer, type Camera, type MapMode, type RenderOptions } from './render/renderer';
import { Codex } from './ui/codex';
import { compassSvg } from './ui/compass';
import { Creator, worldStats } from './ui/creator';
import { DisplayMenu, QuickToggles, type DisplaySettings } from './ui/displaymenu';
import { fmtArea, fmtInt, fmtPop } from './ui/format';
import { initTips } from './ui/tips';
import { Exporter, type ExportedFile, type ExportOptions, type ExportTarget } from './ui/exporter';
import { chronicleHtml, worldJson } from './ui/chronicle';
import { makeZip, ZipWriter } from './ui/zip';
import { InfoCard, type InfoCardCallbacks } from './ui/infocard';
import { Timeline } from './ui/timeline';
import { GenView } from './ui/genview';
import { ownersAt } from './gen/politics/history';
import { curvedLabel } from './gen/politics/labels';
import { cityRarity, countryRarity, type Rarity } from './ui/rarity';

const $ = <T extends HTMLElement>(sel: string) => document.querySelector(sel) as T;
const view = $<HTMLElement>('#view');
const glCanvas = $<HTMLCanvasElement>('#gl');
const ovCanvas = $<HTMLCanvasElement>('#overlay');
const lifeCanvas = $<HTMLCanvasElement>('#life');
const tooltip = $<HTMLElement>('#tooltip');
const progress = $<HTMLElement>('#progress');
const legend = $<HTMLElement>('#legend');
const plaque = $<HTMLElement>('#plaque');
const compass = $<HTMLElement>('#compass');
const ovCtx = ovCanvas.getContext('2d')!;
const lifeCtx = lifeCanvas.getContext('2d')!;

// ---------- état ----------
const STORE_KEY = 'atlas-settings-v1';
function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return { ...fallback, ...JSON.parse(raw) };
  } catch {
    /* stockage indisponible */
  }
  return { ...fallback };
}
function save(key: string, v: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* ignoré */
  }
}

const settings: GenSettings = load(STORE_KEY, DEFAULT_SETTINGS);
const hashSeed = new URLSearchParams(location.hash.slice(1)).get('seed');
if (hashSeed) settings.seed = hashSeed;
const display: DisplaySettings = load<DisplaySettings>('atlas-display-v1', {
  exaggeration: 24, rivers: true, grid: false, life: true, cursor: 'human', clouds: false, night: false, towns: true, forests: true,
});
let mode: MapMode = 'political';
let world: WorldData | null = null;
const cam: Camera = { cx: 0, cy: 0, scale: 1 };
let dpr = window.devicePixelRatio || 1;
/** Propriétaire affiché de chaque province (présent, date passée de la frise, retouches de l'éditeur). */
let shownOwner = new Int32Array(0);
/** Année affichée par la frise (null : présent). */
let histYear: number | null = null;
let histOwners: Int32Array | null = null;
/** Nom d'un pays affiché (pays actuel ou disparu). */
function shownCountryName(id: number): string {
  if (!world) return '—';
  return (histYear !== null ? world.politics.history.countries[id]?.name : world.politics.countries[id]?.name) ?? '—';
}
const sel = { hoverCountry: -1, hoverCity: -1, city: -1, country: -1, hoverState: -1, state: -1, hoverRegion: -1, region: -1 };
/** Export en cours : le canevas WebGL sert de tampon de tuiles. */
let exporting = false;

let renderer: MapRenderer;
try {
  renderer = new MapRenderer(glCanvas);
} catch (err) {
  view.innerHTML = `<div style="padding:40px" class="error">${String(err)}</div>`;
  throw err;
}
const overlay = new Overlay();
const life = new Life();
compass.innerHTML = compassSvg();

const loreCallbacks: InfoCardCallbacks = {
  onSelectCity: (id) => selectCity(id, true),
  onSelectCountry: (id) => selectCountry(id, true),
  onSelectCulture: (id) => {
    if (!GEO_MODES.includes(mode) || mode === 'religions') setMode('cultures');
    card.showCulture(id);
    const c = world?.politics.cultures[id];
    if (c && world) centerOn(world.politics.cities[c.hearth].x, world.politics.cities[c.hearth].y, 1.5);
    requestRender();
  },
  onSelectReligion: (id) => {
    if (mode !== 'religions') setMode('religions');
    card.showReligion(id);
    const r = world?.politics.religions[id];
    if (r && world && r.holyCity >= 0) centerOn(world.politics.cities[r.holyCity].x, world.politics.cities[r.holyCity].y, 1.5);
    requestRender();
  },
  onSelectDynasty: (id) => {
    card.showDynasty(id);
    const d = world?.politics.dynasties[id];
    if (d && world) {
      sel.country = d.countries[0];
      const cap = world.politics.cities[world.politics.countries[d.countries[0]].capital];
      centerOn(cap.x, cap.y, 1.5);
    }
    requestRender();
  },
  onSelectState: (id) => {
    if (!world) return;
    if (mode !== 'states') setMode('states');
    selectState(id);
    const st = world.politics.states[id];
    centerOn(st.cx, st.cy, 3);
  },
  onSelectRegion: (id) => {
    if (!world) return;
    if (mode !== 'regions') setMode('regions');
    selectRegion(id);
    const rg = world.politics.regions[id];
    const st = world.politics.states[rg.states[0]];
    if (rg.label) centerOn(rg.label.cx, rg.label.cy, 1.6);
    else centerOn(st.cx, st.cy, 1.6);
  },
  onClose: () => {
    sel.city = -1;
    sel.country = -1;
    sel.state = sel.region = -1;
    requestRender();
  },
};
const card = new InfoCard($('#info'), loreCallbacks);
const codex = new Codex($('#codex'), loreCallbacks);

// ---------- éditeur ----------
let worldEditor: WorldEditor | null = null;
let editTool: EditTool = 'province';
let painting: { ops: number; touched: Set<number> } | null = null;
let saveTimer = 0;
let saved = true;
const editor = new Editor($('#editor'), {
  onPatch: (c, patch) => {
    worldEditor?.patchCountry(c, patch);
    afterEdit(new Set([c]), false);
  },
  onTool: (t) => {
    editTool = t;
    view.classList.toggle('painting', editor.visible && t !== 'pick');
  },
  onSelect: (c) => pickForEdit(c),
  onCityRename: (id, name) => {
    worldEditor?.renameCity(id, name);
    afterEdit(new Set(), false);
  },
  onUndo: () => undoEdit(true),
  onRedo: () => undoEdit(false),
  onExport: () => exporter.show(),
  onClose: () => toggleEditor(false),
});

function toggleEditor(on = !editor.visible): void {
  if (!world) return;
  if (on) {
    if (timeline.visible) timeline.hide();
    if (!['political', 'provinces', 'states'].includes(mode)) setMode('political');
    card.hide();
    editor.show();
  } else {
    editor.hide();
    view.classList.remove('painting');
  }
  document.body.classList.toggle('editing', on);
  editor.refresh(editStatus());
  requestRender();
}

function editStatus() {
  return { edits: worldEditor?.edits ?? 0, canUndo: !!worldEditor?.canUndo, canRedo: !!worldEditor?.canRedo, saved };
}

function pickForEdit(c: number): void {
  editor.select(c);
  sel.country = c;
  requestRender();
}

/** Pinceau : la province (ou l'État) sous le curseur passe au pays édité. */
function paintAt(e: PointerEvent): void {
  if (!world || !painting || !worldEditor) return;
  const at = worldAt(e);
  if (!at || world.ocean[at.i]) return;
  const p = world.politics.province[at.i];
  const target = editor.currentCountry;
  if (p === NONE16 || target < 0) return;
  const pol = world.politics;
  const st = pol.provinces[p].state;
  const list = editTool === 'state' && st >= 0 ? pol.states[st].provinces : [p];
  const before = worldEditor.edits;
  const touched = worldEditor.setOwner(list, target);
  if (worldEditor.edits === before) return;
  painting.ops++;
  for (const c of touched) painting.touched.add(c);
  for (const q of list) shownOwner[q] = target;
  renderer.setPolitics(shownOwner);
  requestRender();
}

function finishPaint(): void {
  if (!painting || !worldEditor) return;
  const p = painting;
  painting = null;
  if (!p.ops) return;
  worldEditor.mergeLast(p.ops);
  afterEdit(p.touched, true);
}

function undoEdit(back: boolean): void {
  const t = worldEditor?.step(back);
  if (t) afterEdit(t, true);
}

/** Après une retouche : données dérivées, rendu, fiches et sauvegarde (différée). */
function afterEdit(touched: Set<number>, borders: boolean): void {
  if (!world) return;
  const pol = world.politics;
  if (borders) refreshOwnership(world, touched);
  shownOwner = Int32Array.from(pol.provinces, (p) => p.country);
  renderer.setPolitics(shownOwner, pol.countries.map((c) => c.color));
  overlay.refreshPolitics();
  codex.setWorld(world);
  const alive = pol.countries.filter((c) => c.provinces > 0).length;
  plaque.querySelector('.w-sub')!.textContent = `An ${pol.year} · ${alive} pays · ${fmtPop(pol.totalPop)} d'habitants`;
  saved = false;
  clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    const w = world;
    if (!w) return;
    saveWorld(w)
      .then(() => {
        saved = true;
        editor.refresh(editStatus());
      })
      .catch((err) => console.warn('Sauvegarde impossible :', err));
  }, 1500);
  editor.refresh(editStatus());
  requestRender();
}

glCanvas.addEventListener('contextmenu', (e) => {
  if (!editor.visible || !world) return;
  e.preventDefault();
  const at = worldAt(e);
  if (at && !world.ocean[at.i] && countryAtCell(at.i) >= 0) pickForEdit(countryAtCell(at.i));
});
const timeline = new Timeline($('#timeline'), {
  onYear: (y) => showYear(y),
  onEvent: (e) => focusEvent(e),
});

function toggleTimeline(): void {
  if (!world) return;
  if (editor.visible) toggleEditor(false);
  if (!timeline.visible && !['political', 'provinces', 'states'].includes(mode)) setMode('political');
  timeline.toggle();
}

/**
 * Carte à la fin de l'année y (frise) : propriétaire de chaque province d'après celui de son État,
 * couleurs des pays de l'époque, noms recalculés sur leur territoire d'alors. null : retour au présent.
 */
function showYear(y: number | null): void {
  if (!world) return;
  const pol = world.politics;
  const h = pol.history;
  if (y === histYear) return;
  const before = histYear ?? h.end;
  histYear = y;
  const old = Int32Array.from(shownOwner);
  if (y === null) {
    shownOwner = Int32Array.from(pol.provinces, (p) => p.country);
  } else {
    histOwners = ownersAt(h, y, histOwners ?? undefined);
    for (const p of pol.provinces) shownOwner[p.id] = p.state >= 0 ? histOwners[p.state] : p.country;
  }
  // provinces qui changent de mains : la couleur du nouveau maître s'y répand (shader, ~1,3 s)
  const now = skyTime();
  if (transPrev.length !== shownOwner.length) {
    transPrev = new Int32Array(shownOwner.length).fill(-1);
    transAt = new Float32Array(shownOwner.length).fill(-1e6);
  }
  let changed = 0;
  for (let p = 0; p < shownOwner.length; p++) {
    if (old.length === shownOwner.length && old[p] !== shownOwner[p] && old[p] >= 0) {
      transPrev[p] = old[p];
      transAt[p] = now;
      changed++;
    }
  }
  const colors = y === null ? pol.countries.map((c) => c.color) : h.countries.map((c) => c.color);
  // palette complète (pays disparus compris) pour que l'ancienne couleur reste disponible pendant la transition
  if (y === null) for (let i = pol.countries.length; i < h.countries.length; i++) colors.push(h.countries[i].color);
  renderer.setPolitics(shownOwner, colors, transPrev, transAt);
  overlay.setCountryLabels(y === null ? null : histLabels());
  // bandeaux : les grands événements de la période parcourue, sur les régions concernées
  const to = y ?? h.end;
  if (to > before && to - before <= 60) {
    const evs = h.events.filter((e) => e.year > before && e.year <= to && e.states.length && e.kind !== 'révolte').slice(-3);
    if (evs.length) animateFor(2800);
    overlay.flash(evs.map((e) => {
      const st = e.states.map((i) => pol.states[i]);
      let x = 0;
      for (const s0 of st) x += s0.cx - Math.round((s0.cx - st[0].cx) / world!.W) * world!.W;
      return { x: x / st.length, y: st.reduce((a, b) => a + b.cy, 0) / st.length, title: e.title, sub: `${e.year} · ${e.countries.map((c) => h.countries[c]?.name).filter(Boolean).slice(0, 2).join(' / ')}` };
    }));
  }
  if (changed) animateFor(1500);
  document.body.classList.toggle('past', y !== null);
  if (sel.country >= 0) card.hide();
  sel.country = sel.hoverCountry = -1;
  plaque.querySelector('.w-sub')!.textContent = y === null
    ? `An ${pol.year} · ${pol.countries.length} pays · ${fmtPop(pol.totalPop)} d'habitants`
    : `An ${y} · carte historique · ${new Set(histOwners).size} pays`;
  requestRender();
}
/** Pays précédent et instant du changement, par province (transitions de la frise). */
let transPrev = new Int32Array(0);
let transAt = new Float32Array(0);

/** Étiquettes des pays de l'époque : sur la plus grande de leurs terres (continent), pondérées par la superficie. */
function histLabels(): { name: string; label: LabelPath | null }[] {
  const pol = world!.politics;
  const h = pol.history;
  const W = world!.W;
  const byOwner = new Map<number, number[]>();
  for (const p of pol.provinces) {
    const o = shownOwner[p.id];
    if (o < 0) continue;
    const l = byOwner.get(o);
    if (l) l.push(p.id);
    else byOwner.set(o, [p.id]);
  }
  const out: { name: string; label: LabelPath | null }[] = [];
  for (const [o, list] of byOwner) {
    const area = new Map<number, number>();
    for (const p of list) area.set(pol.provinces[p].continent, (area.get(pol.provinces[p].continent) ?? 0) + pol.provinces[p].area);
    const main = [...area.entries()].sort((a, b) => b[1] - a[1])[0][0];
    const keep = list.filter((p) => pol.provinces[p].continent === main);
    const xs = keep.map((p) => pol.provinces[p].cx), ys = keep.map((p) => pol.provinces[p].cy), ws = keep.map((p) => pol.provinces[p].area);
    const name = h.countries[o].name;
    // une ou deux provinces : étiquette droite minimale autour du centre
    const label = keep.length >= 3 ? curvedLabel(xs, ys, ws, xs[0], W, name.toUpperCase()) : null;
    out.push({ name, label });
  }
  return out;
}

/** Clic sur un événement de la frise : centrer la carte sur les États concernés. */
function focusEvent(e: HistEvent): void {
  if (!world || !e.states.length) return;
  const st = world.politics.states[e.states[0]];
  centerOn(st.cx, st.cy, 2.5);
}
const creator = new Creator($('#creator'), settings, {
  onCreate: generate,
  onNewPolitics: () => {
    settings.politicsSeed = Math.random().toString(36).slice(2, 8);
    generate();
  },
  onRandomSeed: randomSeed,
});
const displayMenu = new DisplayMenu($('#display-menu'), display, {
  onChange: () => {
    save('atlas-display-v1', display);
    applyDisplay();
    requestRender();
  },
  onExport: (kind) => {
    displayMenu.hide();
    if (kind === 'dialog') exporter.show();
    else exportView();
  },
});
const quick = new QuickToggles($('#quick-toggles'), display, (k) => displayMenu.toggleKey(k));
const exporter = new Exporter($('#exporter'), (o, t) => exportWorld(o, t), () => ({ W: world?.W ?? 1536, base: exportBase() }));
initTips(view);

function applyDisplay(): void {
  document.body.classList.remove('wc-cursor-human', 'wc-cursor-orc', 'wc-cursor-elf', 'wc-cursor-undead');
  if (display.cursor !== 'system') document.body.classList.add(`wc-cursor-${display.cursor}`);
  compass.hidden = false;
  quick?.refresh();
  clampCamera();
  ensureAnim();
}

// ---------- bandeau supérieur ----------
$('#hud-actions').addEventListener('click', (e) => {
  const act = (e.target as HTMLElement).closest<HTMLElement>('[data-act]')?.dataset.act;
  if (act === 'codex') codex.toggle();
  else if (act === 'display') displayMenu.toggle();
  else if (act === 'timeline') toggleTimeline();
  else if (act === 'editor') toggleEditor();
  else if (act === 'create') creator.show();
});
for (const el of ['#hud-top', '#modes', '#legend']) {
  $(el).addEventListener('pointerdown', (e) => e.stopPropagation());
  $(el).addEventListener('wheel', (e) => e.stopPropagation());
}
legend.addEventListener('click', (e) => {
  if ((e.target as HTMLElement).closest('.ttl')) legend.classList.toggle('collapsed');
});

// ---------- rendu à la demande ----------
let frameQueued = false;
function requestRender(): void {
  if (frameQueued) return;
  frameQueued = true;
  requestAnimationFrame(() => {
    frameQueued = false;
    renderNow();
  });
}
function renderNow(): void {
  if (exporting) return;
  const t0 = performance.now();
  renderGL();
  const t1 = performance.now();
  const more = overlay.draw(ovCtx, cam, ovCanvas.width, ovCanvas.height, { mode, rivers: display.rivers, selectedCity: sel.city, hoverCity: sel.hoverCity, icons: display.towns, forests: display.forests, dimRivers: display.night, interacting });
  perf.frame(t1 - t0, performance.now() - t1);
  // icônes encore à dessiner, transition ou bandeau en cours : on continue à l'image suivante
  if (more || performance.now() < animUntil) requestRender();
}

/** Anime la carte (transitions de la frise, bandeaux) pendant ms millisecondes. */
let animUntil = 0;
function animateFor(ms: number): void {
  animUntil = Math.max(animUntil, performance.now() + ms);
  requestRender();
}

// ---------- compteur de performances (touche I) ----------
const perf = (() => {
  const el = document.createElement('div');
  el.id = 'perf';
  el.className = 'fantasy wc-panel';
  el.hidden = true;
  view.append(el);
  const frames: number[] = [];
  let gl = 0, ov = 0, last = 0;
  return {
    frame(g: number, o: number) {
      const now = performance.now();
      frames.push(now);
      while (frames.length && frames[0] < now - 1000) frames.shift();
      gl = gl * 0.8 + g * 0.2;
      ov = ov * 0.8 + o * 0.2;
      if (el.hidden || now - last < 250) return;
      last = now;
      el.innerHTML = `<b>${frames.length}</b> images/s · carte ${gl.toFixed(1)} ms · calques ${ov.toFixed(1)} ms<br><span>${glCanvas.width} × ${glCanvas.height} px${interacting ? ' · résolution réduite (mouvement)' : ''}</span>`;
    },
    toggle() {
      el.hidden = !el.hidden;
      el.innerHTML = 'Déplacez ou zoomez la carte pour mesurer…';
    },
  };
})();

// ---------- ciel : nuages et soleil ----------
const T0 = performance.now();
/** Une journée dure 90 s, une année 24 journées (le soleil remonte et descend en latitude). */
const DAY_S = 90, YEAR_S = DAY_S * 24;
function skyTime(): number {
  return (performance.now() - T0) / 1000;
}
function sunDir(t: number): [number, number, number] {
  const lon = 1.2 - (2 * Math.PI * t) / DAY_S;
  const lat = ((23.44 * Math.PI) / 180) * Math.sin((2 * Math.PI * t) / YEAR_S + 1.1);
  return [Math.cos(lat) * Math.cos(lon), Math.cos(lat) * Math.sin(lon), Math.sin(lat)];
}
// pendant un déplacement ou un zoom, la carte est calculée en résolution réduite puis agrandie ;
// elle est recalculée net 160 ms après le dernier mouvement
let interacting = false;
let interactTimer = 0;
function markMoving(): void {
  interacting = true;
  clearTimeout(interactTimer);
  interactTimer = window.setTimeout(() => {
    interacting = false;
    requestRender();
  }, 160);
}

function glOptions(): RenderOptions {
  const geo = GEO_MODES.includes(mode);
  const t = skyTime();
  return {
    mode, exaggeration: display.exaggeration, grid: display.grid,
    // en mode États / Régions, la surbrillance porte sur l'État ou la région
    hoverCountry: mode === 'states' ? sel.hoverState : mode === 'regions' ? sel.hoverRegion : geo ? sel.hoverCountry : -1,
    selectedCountry: mode === 'states' ? sel.state : mode === 'regions' ? sel.region : geo ? sel.country : -1,
    clouds: display.clouds, night: display.night, forests: display.forests, time: t, sun: sunDir(t),
    quality: interacting ? (glCanvas.width * glCanvas.height > 1.8e6 ? 0.5 : 0.7) : 1,
  };
}
function renderGL(): void {
  renderer.render(cam, glOptions());
}

// ---------- animation (nuages, jour / nuit, convois ; ~25 i/s, seulement si nécessaire) ----------
let animRunning = false;
let lastAnim = 0;
function needsAnim(): boolean {
  return !!world && (display.clouds || display.night || (display.life && life.active(mode)));
}
function animFrame(ts: number): void {
  if (!needsAnim()) {
    lifeCtx.setTransform(1, 0, 0, 1, 0, 0);
    lifeCtx.clearRect(0, 0, lifeCanvas.width, lifeCanvas.height);
    animRunning = false;
    return;
  }
  if (ts - lastAnim >= 40) {
    const dt = Math.min(0.1, (ts - lastAnim) / 1000);
    lastAnim = ts;
    lifeCtx.setTransform(1, 0, 0, 1, 0, 0);
    lifeCtx.clearRect(0, 0, lifeCanvas.width, lifeCanvas.height);
    if (display.night) life.drawLights(lifeCtx, cam, lifeCanvas.width, lifeCanvas.height, sunDir(skyTime()));
    if (display.life && life.active(mode)) life.draw(lifeCtx, cam, lifeCanvas.width, lifeCanvas.height, mode, skyTime(), dt);
    if ((display.clouds || display.night) && !exporting && !frameQueued) renderGL();
  }
  requestAnimationFrame(animFrame);
}
function ensureAnim(): void {
  if (animRunning) return;
  animRunning = true;
  lastAnim = performance.now();
  requestAnimationFrame(animFrame);
}

function resize(): void {
  dpr = window.devicePixelRatio || 1;
  const w = Math.max(1, Math.round(view.clientWidth * dpr));
  const h = Math.max(1, Math.round(view.clientHeight * dpr));
  if (glCanvas.width !== w || glCanvas.height !== h) {
    const firstFit = glCanvas.width <= 1;
    glCanvas.width = ovCanvas.width = lifeCanvas.width = w;
    glCanvas.height = ovCanvas.height = lifeCanvas.height = h;
    if (world && firstFit) fitWorld();
    clampCamera();
  }
  requestRender();
}
new ResizeObserver(resize).observe(view);

function minScale(): number {
  if (!world) return 0.1;
  return Math.min(glCanvas.height / world.H, glCanvas.width / world.W) * 0.95;
}
function maxScale(): number {
  return 64 * dpr;
}
function fitWorld(): void {
  if (!world) return;
  cam.scale = Math.min(glCanvas.width / world.W, glCanvas.height / world.H);
  cam.cx = world.W / 2;
  cam.cy = world.H / 2;
}
function clampCamera(): void {
  if (!world) return;
  cam.scale = Math.max(minScale(), Math.min(maxScale(), cam.scale));
  cam.cx = ((cam.cx % world.W) + world.W) % world.W;
  const halfH = glCanvas.height / 2 / cam.scale;
  cam.cy = world.H <= 2 * halfH ? world.H / 2 : Math.max(halfH, Math.min(world.H - halfH, cam.cy));
}
function centerOn(x: number, y: number, minScaleCss = 3): void {
  cam.cx = x;
  cam.cy = y;
  cam.scale = Math.max(cam.scale, minScaleCss * dpr);
  clampCamera();
}

// ---------- génération (worker) ----------
const worker = new Worker(new URL('./gen/worker.ts', import.meta.url), { type: 'module' });
let reqId = 0;
let genStart = 0;

function randomSeed(): string {
  const syll = ['ka', 'lor', 'men', 'dra', 'vel', 'tor', 'sa', 'rin', 'bel', 'go', 'thar', 'ne', 'al', 'mor', 'ys', 'ven', 'ka', 'dun', 'ae', 'ris'];
  let s = '';
  const n = 2 + Math.floor(Math.random() * 2);
  for (let i = 0; i < n; i++) s += syll[Math.floor(Math.random() * syll.length)];
  return s + '-' + Math.floor(Math.random() * 1000);
}

function generate(): void {
  save(STORE_KEY, settings);
  history.replaceState(null, '', `#seed=${encodeURIComponent(settings.seed)}`);
  reqId++;
  genStart = performance.now();
  tooltip.hidden = true;
  progress.hidden = false;
  (progress.querySelector('.title') as HTMLElement).textContent = 'Formation du monde';
  genView.begin(settings.seed, settings.latMax);
  setProgress('Préparation…', 0);
  const msg: WorkerRequest = { type: 'generate', id: reqId, settings: { ...settings } };
  worker.postMessage(msg);
}

// ---------- aperçu du monde en formation ----------
const genView = new GenView(progress);

function setProgress(stage: string, p: number): void {
  (progress.querySelector('.stage') as HTMLElement).textContent = stage;
  (progress.querySelector('.bar div') as HTMLElement).style.width = `${Math.round(p * 100)}%`;
}

worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
  const m = e.data;
  if (m.id !== reqId) return;
  if (m.type === 'progress') {
    setProgress(m.stage, m.progress);
    genView.stage(m.stage, m.progress);
    return;
  }
  if (m.type === 'preview') {
    genView.image(m.w, m.h, m.pixels, m.stage);
    return;
  }
  progress.hidden = true;
  genView.end();
  if (m.type === 'error') {
    console.error(m.message);
    setProgress('', 0);
    alert(`Erreur de génération :\n${m.message}`);
    return;
  }
  // (le worker l'a déjà sauvegardé pour le prochain rafraîchissement)
  showWorld(m.world, performance.now() - genStart);
};

function showWorld(w: WorldData, genMs: number): void {
  const first = !world || world.W !== w.W || world.H !== w.H;
  world = w;
  renderer.setWorld(world);
  overlay.setWorld(world);
  life.setWorld(world);
  card.setWorld(world);
  codex.setWorld(world);
  creator.setWorld(world, worldStats(world, genMs));
  sel.city = sel.country = sel.hoverCity = sel.hoverCountry = sel.state = sel.region = sel.hoverState = sel.hoverRegion = -1;
  shownOwner = Int32Array.from(world.politics.provinces, (p) => p.country);
  histYear = null;
  overlay.setCountryLabels(null);
  timeline.setWorld(world);
  worldEditor = new WorldEditor(world);
  editor.setWorld(world);
  if (editor.visible) toggleEditor(false);
  card.hide();
  if (first) fitWorld();
  clampCamera();
  const pol = world.politics;
  plaque.innerHTML = `<span class="w-name">${escapeHtml(world.settings.seed)}</span><span class="w-sub">An ${pol.year} · ${pol.countries.length} pays · ${fmtPop(pol.totalPop)} d'habitants</span>`;
  plaque.dataset.tipTitle = escapeHtml(world.settings.seed);
  plaque.dataset.tip = `Grille ${world.W} × ${world.H} · ${world.stats.landPct.toFixed(0)} % de terres · point culminant ${fmtInt(world.stats.maxElevation)} m<br>${fmtInt(pol.provinces.length)} provinces · ${pol.cities.length} villes · ${pol.cultures.length} cultures · ${pol.religions.filter((r) => r.provinces > 0).length} religions<br>Partagez ce monde : le lien contient la graine.`;
  updateLegend();
  requestRender();
  ensureAnim();
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

// ---------- modes de carte (barre cliquable) ----------
const ICONS: Record<MapMode, string> = {
  political: '⚑', provinces: '▦', states: '⬢', regions: '❖', cultures: '♟', religions: '✦', trade: '⚖', influence: '◎',
  terrain: '⛰', relief: '▲', continents: '◒', plates: '⧉', temperature: '☀', precipitation: '☂', biomes: '✿',
};
const modesEl = $<HTMLElement>('#modes');
for (const group of ['geo', 'phys'] as const) {
  const row = document.createElement('div');
  row.className = 'mode-row';
  row.innerHTML = `<span class="mode-group">${group === 'geo' ? 'Géopolitique' : 'Géographie'}</span>`;
  for (const m of MAP_MODES.filter((x) => x.group === group)) {
    const b = document.createElement('button');
    b.className = 'mode-btn';
    b.innerHTML = `<span class="mi">${ICONS[m.id]}</span><span class="ml">${m.label}</span>`;
    b.dataset.tipTitle = m.label;
    b.dataset.tip = m.tip;
    b.dataset.tipKey = m.key.toUpperCase();
    b.dataset.mode = m.id;
    b.addEventListener('click', () => setMode(m.id));
    row.append(b);
  }
  modesEl.append(row);
}
function setMode(m: MapMode): void {
  mode = m;
  modesEl.querySelectorAll<HTMLElement>('.mode-btn').forEach((b) => b.classList.toggle('active', b.dataset.mode === m));
  updateLegend();
  requestRender();
  ensureAnim();
}
setMode(mode);

function updateLegend(): void {
  const ramp = (title: string, css: string, ticks: string[]) =>
    `<div class="ttl">${title}</div><div class="ramp" style="background:${css}"></div><div class="ticks">${ticks.map((t) => `<span>${t}</span>`).join('')}</div>`;
  const sw = (css: string, label: string) => `<div><span class="sw" style="background:${css}"></span>${label}</div>`;
  if (mode === 'relief') {
    legend.innerHTML = ramp('Altitude', 'linear-gradient(90deg,#558a57 0%,#92b36e 14%,#dbd491 28%,#cc9e69 45%,#99705a 62%,#9e9996 80%,#f7f7fa 100%)', ['0', '800', '1 800', '3 000', '4 500', '6 000 m']);
  } else if (mode === 'temperature') {
    legend.innerHTML = ramp('Température moyenne annuelle', 'linear-gradient(90deg,#5c3385,#385cc7,#8cccea,#73bf73,#edde66,#ed8c38,#b82121)', ['−30', '−10', '5', '15', '25', '35 °C']);
  } else if (mode === 'precipitation') {
    legend.innerHTML = ramp('Précipitations annuelles', 'linear-gradient(90deg,#855433,#d6b873,#bdcc6b,#57a852,#1f8585,#1f479e,#572980)', ['0', '250', '600', '1 200', '2 500', '7 000 mm']);
  } else if (mode === 'plates') {
    legend.innerHTML = `<div class="ttl">Frontières de plaques</div>${sw('#eb2e26', 'Convergente (orogenèse, subduction)')}${sw('#26c7f2', 'Divergente (rift, dorsale)')}${sw('#fadb33', 'Transformante (coulissage)')}`;
  } else if (mode === 'biomes') {
    const used = new Set<number>();
    if (world) for (let i = 0; i < world.biome.length; i += 7) used.add(world.biome[i]);
    legend.innerHTML = `<div class="ttl">Biomes</div><div class="grid">${BIOMES.map((b, i) => (used.has(i) ? sw(`rgb(${b.color.join(',')})`, b.name) : '')).join('')}</div>`;
  } else if (mode === 'continents' && world) {
    const conts = world.politics.continents.filter((c) => c.kind !== 'archipel');
    const arch = world.politics.continents.filter((c) => c.kind === 'archipel');
    legend.innerHTML = `<div class="ttl">Continents géologiques</div><div class="hint-sm">Croûte continentale : terres + plateau immergé (&lt; 500 m)</div>${conts
      .map((c) => `<div class="row-sp"><span>${escapeHtml(c.name)}${c.kind === 'microcontinent' ? ' <i>(micro)</i>' : ''}</span><span>${fmtArea(c.landArea)}</span></div>`)
      .join('')}${arch.length ? `<div class="row-sp dim"><span>${arch.length} archipels océaniques</span><span>${fmtArea(arch.reduce((a, c) => a + c.landArea, 0))}</span></div>` : ''}`;
  } else if (mode === 'trade') {
    legend.innerHTML = `<div class="ttl">Réseau commercial</div>${sw('linear-gradient(90deg,#78502a,#f0b964)', 'Routes terrestres (épaisseur = trafic)')}${sw('repeating-linear-gradient(90deg,#cfe6f5 0 4px,transparent 4px 7px)', 'Lignes maritimes')}<div class="hint-sm">Flux gravitaires entre toutes les paires de villes. Cliquez une ville pour voir ses partenaires.</div>`;
  } else if (mode === 'influence') {
    legend.innerHTML = `<div class="ttl">Zones d'influence</div><div class="hint-sm">Aire de marché de chaque ville (temps de trajet pondéré par la taille). Intensité = proximité du centre.</div>`;
  } else if (mode === 'cultures' && world) {
    legend.innerHTML = `<div class="ttl">Cultures</div><div class="hint-sm">Traits épais : familles culturelles. Les peuples ignorent les frontières politiques.</div>${world.politics.cultureGroups
      .map((g) => sw(`rgb(${g.color.join(',')})`, `${escapeHtml(g.name)} <span class="dim">(${g.cultures.length})</span>`))
      .join('')}`;
  } else if (mode === 'religions' && world) {
    const total = world.politics.totalPop;
    const roots = world.politics.religions.filter((r) => r.parent < 0 && r.pop > total * 0.01).sort((a, b) => b.pop - a.pop).slice(0, 10);
    legend.innerHTML = `<div class="ttl">Religions</div>${roots
      .map((r) => `<div class="row-sp"><span><span class="sw" style="background:rgb(${r.color.join(',')})"></span>${r.symbol} ${escapeHtml(r.name)}</span><span>${fmtPop(r.pop)}</span></div>`)
      .join('')}<div class="hint-sm">Médaillons : villes saintes. Traits épais : limites entre grandes familles religieuses.</div>`;
  } else if (mode === 'states') {
    const pol = world!.politics;
    const cats = ['Mégalopole', 'Métropole', 'Grande ville', 'Ville', 'Rural', 'Pastoral', 'Terres sauvages'];
    const count = (c: string) => pol.states.filter((s) => s.category === c).length;
    legend.innerHTML = `<div class="ttl">États</div><div class="hint-sm">${fmtInt(pol.states.length)} États, chacun en nuance de la couleur de son pays. Traits moyens : limites d'États ; épais : frontières.</div>${cats
      .map((c) => `<div class="row-sp"><span>${c}</span><span>${count(c)}</span></div>`)
      .join('')}`;
  } else if (mode === 'regions') {
    const pol = world!.politics;
    const kinds = new Map<string, number>();
    for (const r of pol.regions) kinds.set(r.kind, (kinds.get(r.kind) ?? 0) + 1);
    legend.innerHTML = `<div class="ttl">Régions historiques</div><div class="hint-sm">${pol.regions.length} ensembles géographiques, indépendants des frontières (traits fins : pays).</div>${[...kinds.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([k, n]) => `<div class="row-sp"><span>${escapeHtml(k)}</span><span>${n}</span></div>`)
      .join('')}`;
  } else if (mode === 'political' || mode === 'provinces') {
    legend.innerHTML = `<div class="ttl">${mode === 'political' ? 'Carte politique' : 'Provinces'}</div>${sw('#f1e6c8', display.towns ? '♜ château : capitale · maisons : ville · quai : port' : '★ capitale · ● ville')}<div class="hint-sm">Cliquez un pays ou une ville pour sa fiche.</div>`;
  } else {
    legend.innerHTML = '';
  }
  const t = legend.querySelector<HTMLElement>('.ttl');
  if (t) t.dataset.tip = 'Cliquez pour replier ou déplier la légende.';
}

// ---------- navigation (uniquement sur la carte elle-même, pas sur le HUD) ----------
let drag: { x: number; y: number; moved: boolean } | null = null;
view.addEventListener('pointerdown', (e) => {
  if (e.button !== 0 || e.target !== glCanvas) return;
  displayMenu.hide();
  if (editor.visible && editTool !== 'pick' && world) {
    // éditeur : on peint les frontières au lieu de déplacer la carte
    view.setPointerCapture(e.pointerId);
    painting = { ops: 0, touched: new Set() };
    paintAt(e);
    return;
  }
  view.setPointerCapture(e.pointerId);
  drag = { x: e.clientX, y: e.clientY, moved: false };
  view.classList.add('dragging');
});
view.addEventListener('pointermove', (e) => {
  if (painting) {
    paintAt(e);
    onHover(e);
    return;
  }
  if (drag) {
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (Math.abs(dx) + Math.abs(dy) > 2) drag.moved = true;
    drag.x = e.clientX;
    drag.y = e.clientY;
    markMoving();
    cam.cx -= (dx * dpr) / cam.scale;
    cam.cy -= (dy * dpr) / cam.scale;
    clampCamera();
    tooltip.hidden = true;
    requestRender();
    return;
  }
  if (e.target !== glCanvas) {
    tooltip.hidden = true;
    return;
  }
  onHover(e);
});
view.addEventListener('pointerup', (e) => {
  if (painting) {
    view.releasePointerCapture(e.pointerId);
    finishPaint();
    return;
  }
  const wasClick = drag && !drag.moved;
  if (drag) view.releasePointerCapture(e.pointerId);
  drag = null;
  view.classList.remove('dragging');
  if (wasClick) onClick(e);
});
view.addEventListener('pointercancel', () => {
  drag = null;
  view.classList.remove('dragging');
});
view.addEventListener('pointerleave', () => {
  tooltip.hidden = true;
  if (sel.hoverCountry >= 0 || sel.hoverCity >= 0) {
    sel.hoverCountry = sel.hoverCity = -1;
    requestRender();
  }
});
glCanvas.addEventListener(
  'wheel',
  (e) => {
    e.preventDefault();
    zoomAt(e.offsetX * dpr, e.offsetY * dpr, Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0018)));
  },
  { passive: false },
);
glCanvas.addEventListener('dblclick', (e) => zoomAt(e.offsetX * dpr, e.offsetY * dpr, 2));

function zoomAt(sx: number, sy: number, factor: number): void {
  if (!world) return;
  markMoving();
  const wx = cam.cx + (sx - glCanvas.width / 2) / cam.scale;
  const wy = cam.cy + (sy - glCanvas.height / 2) / cam.scale;
  cam.scale *= factor;
  clampCamera();
  cam.cx = wx - (sx - glCanvas.width / 2) / cam.scale;
  cam.cy = wy - (sy - glCanvas.height / 2) / cam.scale;
  clampCamera();
  requestRender();
}

window.addEventListener('keydown', (e) => {
  const tag = (e.target as HTMLElement).tagName;
  if (tag === 'INPUT' || tag === 'SELECT' || creator.visible || exporter.visible) {
    if (e.key === 'Escape' && creator.visible && world) creator.hide();
    if (e.key === 'Escape' && exporter.visible) exporter.hide();
    return;
  }
  const k = e.key.toLowerCase();
  if (editor.visible && (e.metaKey || e.ctrlKey) && (k === 'z' || k === 'y')) {
    e.preventDefault();
    undoEdit(k === 'z' && !e.shiftKey);
    return;
  }
  const m = MAP_MODES.find((x) => x.key === k);
  if (m) setMode(m.id);
  else if (k === 'g') displayMenu.toggleKey('grid');
  else if (k === 'r') displayMenu.toggleKey('rivers');
  else if (k === 'u') displayMenu.toggleKey('clouds');
  else if (k === 'j') displayMenu.toggleKey('night');
  else if (k === 'v') displayMenu.toggleKey('towns');
  else if (k === 'm') displayMenu.toggleKey('life');
  else if (k === 'o') displayMenu.toggleKey('forests');
  else if (k === 'n') creator.show();
  else if (k === 'f' || e.key === 'Home') {
    fitWorld();
    requestRender();
  } else if (k === 'c') codex.toggle();
  else if (k === 'y') toggleTimeline();
  else if (k === 'k') toggleEditor();
  else if (k === 'i') perf.toggle();
  else if (e.key === 'Escape') {
    if (codex.visible) codex.hide();
    else clearSelection();
  }
});

function worldAt(e: PointerEvent | MouseEvent): { wx: number; wy: number; i: number } | null {
  if (!world) return null;
  const wx = cam.cx + (e.offsetX * dpr - glCanvas.width / 2) / cam.scale;
  const wy = cam.cy + (e.offsetY * dpr - glCanvas.height / 2) / cam.scale;
  if (wy < 0 || wy >= world.H) return null;
  const x = ((Math.floor(wx) % world.W) + world.W) % world.W;
  return { wx, wy, i: Math.floor(wy) * world.W + x };
}

/**
 * Ville sous le curseur, -1 sinon. Zone de clic généreuse : toute l'icône (maisons dessinées au-dessus
 * du point de la ville) ou un disque de 14 px autour de la pastille.
 */
function cityAt(wx: number, wy: number): number {
  if (!world || !GEO_MODES.includes(mode)) return -1;
  const W = world.W;
  const s = cam.scale / dpr;
  const minPop = cityMinPop(s);
  let best = -1, bd = Infinity;
  for (const c of world.politics.cities) {
    if (!c.capital && c.pop < minPop && c.id !== sel.city) continue;
    let dx = c.x - wx;
    dx -= Math.round(dx / W) * W;
    // écarts en pixels CSS ; `up` > 0 quand le curseur est au-dessus du point de la ville
    const ex = dx * s, up = (c.y - wy) * s;
    let d: number;
    const hIcon = CityIcons.size(c, s);
    if (display.towns && hIcon >= CityIcons.MIN_ICON) {
      const h = hIcon;
      // icône : de ~0,95 h au-dessus du point à 0,35 h en dessous, ~1,2 h de large
      if (Math.abs(ex) > h * 0.62 || up > h * 0.95 || up < -h * 0.35) continue;
      d = Math.hypot(ex, up - h * 0.4);
    } else {
      d = Math.hypot(ex, up);
      if (d > 14) continue;
    }
    if (d < bd) {
      bd = d;
      best = c.id;
    }
  }
  return best;
}

function onHover(e: PointerEvent): void {
  const at = worldAt(e);
  if (!world || !at) {
    tooltip.hidden = true;
    return;
  }
  const geo = GEO_MODES.includes(mode);
  const land = geo && !world.ocean[at.i];
  const hCountry = land ? countryAtCell(at.i) : -1;
  const hState = land ? stateAtCell(at.i) : -1;
  const hRegion = hState >= 0 ? world.politics.states[hState].region : -1;
  const hCity = cityAt(at.wx, at.wy);
  if (hCountry !== sel.hoverCountry || hCity !== sel.hoverCity || hState !== sel.hoverState || hRegion !== sel.hoverRegion) {
    sel.hoverCountry = hCountry;
    sel.hoverCity = hCity;
    sel.hoverState = hState;
    sel.hoverRegion = hRegion;
    requestRender();
  }
  glCanvas.style.cursor = hCity >= 0 ? 'pointer' : '';
  showTooltip(e, at, hCity);
}

function onClick(e: PointerEvent): void {
  const at = worldAt(e);
  if (!world || !at) return;
  const city = cityAt(at.wx, at.wy);
  if (editor.visible) {
    // éditeur (outil « Choisir ») : une ville se renomme, un pays devient le pays édité
    if (city >= 0) editor.showCity(city);
    else if (!world.ocean[at.i] && countryAtCell(at.i) >= 0) pickForEdit(countryAtCell(at.i));
    return;
  }
  if (city >= 0) {
    selectCity(city, false);
    return;
  }
  if (GEO_MODES.includes(mode) && !world.ocean[at.i]) {
    const c = countryAtCell(at.i);
    const p = world.politics.province[at.i];
    if (c >= 0) {
      const prov = world.politics.provinces[p];
      if (mode === 'provinces') card.showProvince(p);
      else if (mode === 'states' && prov.state >= 0) selectState(prov.state);
      else if (mode === 'regions' && prov.state >= 0) selectRegion(world.politics.states[prov.state].region);
      else if (mode === 'cultures' && prov.culture >= 0) card.showCulture(prov.culture);
      else if (mode === 'religions' && prov.religion >= 0) card.showReligion(prov.religion);
      else selectCountry(c, false);
      return;
    }
  }
  clearSelection();
}

function clearSelection(): void {
  card.hide();
  sel.city = sel.country = sel.state = sel.region = -1;
  requestRender();
}

/** Pays affiché sur une cellule (carte datée ou retouchée : via la province). */
function countryAtCell(i: number): number {
  const p = world ? world.politics.province[i] : NONE16;
  return p === NONE16 ? -1 : shownOwner[p] ?? -1;
}
function stateAtCell(i: number): number {
  const p = world ? world.politics.province[i] : NONE16;
  return p === NONE16 ? -1 : world!.politics.provinces[p].state;
}

function selectState(id: number): void {
  if (!world) return;
  sel.state = id;
  sel.region = world.politics.states[id].region;
  card.showState(id);
  requestRender();
}

function selectRegion(id: number): void {
  if (!world) return;
  sel.region = id;
  sel.state = -1;
  card.showRegion(id);
  requestRender();
}

function selectCity(id: number, focus: boolean): void {
  if (!world) return;
  sel.city = id;
  sel.country = world.politics.cities[id].country;
  card.showCity(id);
  if (focus) centerOn(world.politics.cities[id].x, world.politics.cities[id].y);
  requestRender();
}

function selectCountry(id: number, focus: boolean): void {
  if (!world) return;
  sel.country = id;
  sel.city = -1;
  if (histYear !== null) {
    // carte d'une autre époque : fiche du pays tel qu'il était (actuel ou disparu)
    card.showHistCountry(id, histYear);
    requestRender();
    return;
  }
  card.showCountry(id);
  if (focus) {
    const cap = world.politics.cities[world.politics.countries[id].capital];
    centerOn(cap.x, cap.y, 1.5);
  }
  requestRender();
}

const fmtLat = (v: number) => `${Math.abs(v).toFixed(1)}° ${v >= 0 ? 'N' : 'S'}`;
const fmtLon = (v: number) => `${Math.abs(v).toFixed(1)}° ${v >= 0 ? 'E' : 'O'}`;

function showTooltip(e: PointerEvent, at: { wx: number; wy: number; i: number }, cityId: number): void {
  if (!world) return;
  const { wx, wy, i } = at;
  const pol = world.politics;
  const lat = world.latMax - (wy / world.H) * 2 * world.latMax;
  const lon = ((((wx / world.W) * 360) % 360) + 360) % 360 - 180;
  const h = world.height[i];
  const T = world.temperature[i];
  const P = world.precipitation[i];
  const rows: [string, string][] = [];
  let title = BIOMES[world.biome[i]].name;
  let sub = `${fmtLat(lat)} · ${fmtLon(lon)}`;
  let rarity: Rarity = 'default';
  const geo = GEO_MODES.includes(mode);
  if (cityId >= 0) {
    const c = pol.cities[cityId];
    rarity = cityRarity(world, cityId);
    title = `${c.capital ? '★ ' : ''}${c.name}`;
    sub = c.country >= 0 ? `${c.capital ? 'Capitale' : 'Ville'} · ${pol.countries[c.country].name}` : 'Ville';
    rows.push(['Population', fmtPop(c.pop)]);
    rows.push(['Peuple', pol.cultures[c.culture].name]);
    rows.push(['Religion', `${pol.religions[c.religion].symbol} ${pol.religions[c.religion].name}`]);
    if (c.holyOf >= 0) rows.push(['Lieu saint', pol.religions[c.holyOf].name]);
    rows.push(['Commerce', `indice ${c.trade.toFixed(0)}`]);
    if (c.partners[0]) rows.push(['1er partenaire', `${pol.cities[c.partners[0].id].name} (${Math.round(c.partners[0].share * 100)} %)`]);
  } else if (geo && !world.ocean[i] && countryAtCell(i) >= 0 && (mode === 'states' || mode === 'regions') && stateAtCell(i) >= 0) {
    const st = pol.states[stateAtCell(i)];
    const rg = pol.regions[st.region];
    const owner = countryAtCell(i);
    if (mode === 'states') {
      title = st.name;
      sub = `État · ${st.category} · ${shownCountryName(owner)}`;
      if (st.capitalCity >= 0) rows.push(['Ville principale', pol.cities[st.capitalCity].name]);
      rows.push(['Population', fmtPop(st.pop)]);
      rows.push(['Provinces', String(st.provinces.length)]);
      rows.push(['Superficie', `${fmtInt(st.area)} km²`]);
      if (st.resources.length) rows.push(['Ressources', st.resources.join(', ')]);
      rows.push(['Région', rg.name]);
    } else {
      title = rg.name;
      sub = `Région historique · ${rg.kind}`;
      rows.push(['États', String(rg.states.length)]);
      rows.push(['Population', fmtPop(rg.pop)]);
      rows.push(['Superficie', `${fmtInt(rg.area)} km²`]);
      rows.push(['Pays', rg.countries.map((c) => pol.countries[c].name).slice(0, 4).join(', ') + (rg.countries.length > 4 ? '…' : '')]);
      rows.push(['État survolé', st.name]);
    }
  } else if (geo && !world.ocean[i] && countryAtCell(i) >= 0 && histYear !== null) {
    const hc = pol.history.countries[countryAtCell(i)];
    const st = stateAtCell(i) >= 0 ? pol.states[stateAtCell(i)] : null;
    title = hc.name;
    sub = `${hc.fullName} · en ${histYear}`;
    rows.push(['Existence', hc.ended === null ? `depuis ${hc.founded <= pol.history.start ? 'les origines' : hc.founded}` : `${hc.founded <= pol.history.start ? '…' : hc.founded} – ${hc.ended}`]);
    if (hc.fate) rows.push(['Destin', hc.fate]);
    if (hc.culture >= 0) rows.push(['Peuple', pol.cultures[hc.culture].name]);
    if (hc.religion >= 0) rows.push(['Religion', `${pol.religions[hc.religion].symbol} ${pol.religions[hc.religion].name}`]);
    if (st) rows.push(['État', st.name]);
    if (hc.present) rows.push(['Aujourd\'hui', pol.countries[hc.id].fullName]);
  } else if (geo && !world.ocean[i] && countryAtCell(i) >= 0) {
    const c = pol.countries[countryAtCell(i)] ?? pol.countries[pol.country[i]];
    const prov = pol.provinces[pol.province[i]];
    rarity = countryRarity(world, c.id);
    title = c.name;
    sub = `${c.fullName} · ${c.ruler.title} ${c.ruler.regnal}`;
    rows.push(['Province', `n° ${prov.id + 1} · ${PROVINCE_TERRAINS[prov.terrain]}`]);
    rows.push(['Pop. provinciale', fmtPop(prov.pop)]);
    if (prov.culture >= 0) rows.push(['Culture', `${pol.cultures[prov.culture].name} (${pol.cultureGroups[pol.cultures[prov.culture].group].name.toLowerCase()})`]);
    if (prov.religion >= 0) rows.push(['Religion', `${pol.religions[prov.religion].symbol} ${pol.religions[prov.religion].name}`]);
    if (pol.influence[i] !== NONE16) rows.push(["Zone d'influence", pol.cities[pol.influence[i]].name]);
    rows.push(['Densité', `${fmtInt(pol.popDensity[i])} hab/km²`]);
    rows.push(['Biome', BIOMES[world.biome[i]].name]);
  }
  if (!geo || cityId < 0) {
    if (world.ocean[i]) rows.push(['Profondeur', `${fmtInt(-h)} m`]);
    else rows.push(['Altitude', `${fmtInt(h)} m`]);
  }
  if (!geo) {
    if (world.lakeDepth[i] > 0) rows.push(['Profondeur du lac', `${Math.round(world.lakeDepth[i])} m`]);
    rows.push(['Température moy.', `${T.toFixed(1)} °C`]);
    rows.push(['Précipitations', `${fmtInt(P)} mm/an`]);
    if (!world.ocean[i]) rows.push(['Aridité (P/ETP)', (P / potentialET(T)).toFixed(2)]);
    if (world.discharge[i] > 20) rows.push(['Débit', `${fmtInt(world.discharge[i])} m³/s`]);
    const k = pol.continent[i];
    if (k !== 255) rows.push(['Continent', pol.continents[k].name]);
    const plate = world.plates[world.plate[i]];
    rows.push(['Plaque', `${plate.id + 1} · ${plate.continental ? 'continentale' : 'océanique'}`]);
  }
  tooltip.className = `fantasy wc-panel r-${rarity}`;
  tooltip.innerHTML = `<div class="t wc-title-${rarity}">${escapeHtml(title)}</div><div class="s">${escapeHtml(sub)}</div><dl>${rows
    .map(([k, v]) => `<dt>${k}</dt><dd>${escapeHtml(v)}</dd>`)
    .join('')}</dl>`;
  tooltip.hidden = false;
  const tw = tooltip.offsetWidth, th = tooltip.offsetHeight;
  let tx = e.offsetX + 16, ty = e.offsetY + 16;
  if (tx + tw > view.clientWidth - 8) tx = e.offsetX - tw - 16;
  if (ty + th > view.clientHeight - 8) ty = e.offsetY - th - 16;
  tooltip.style.left = `${tx}px`;
  tooltip.style.top = `${ty}px`;
}

// ---------- export ----------
/** Laisse le navigateur respirer entre deux étapes ; onglet en arrière-plan : minuterie (plus d'images). */
const nextFrame = () => new Promise<void>((r) => (document.hidden ? setTimeout(r, 0) : requestAnimationFrame(() => r())));

/**
 * Rend le monde entier dans un mode donné en PNG (le mode affiché n'est pas modifié). `12k` : 12 288 px de
 * large, rendu WebGL par tuiles (la carte graphique ne dessine pas une image aussi grande d'un coup), puis
 * couche vectorielle (fleuves, noms, villes) à l'échelle de l'image.
 */
async function renderMapBlob(m: MapMode, size: 'screen' | '12k', label: string, p0: number, p1: number, type = 'image/png'): Promise<Blob> {
  const wd = world!;
  const w = size === '12k' ? 12288 : Math.round(wd.W * Math.min(2, 8192 / wd.W));
  const scale = w / wd.W;
  const h = Math.round(wd.H * scale);
  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const ctx = out.getContext('2d')!;
  const tile = Math.min(4096, renderer.maxTextureSize);
  const tw = Math.min(tile, w), th = Math.min(tile, h);
  glCanvas.width = tw;
  glCanvas.height = th;
  const nx = Math.ceil(w / tw), ny = Math.ceil(h / th);
  for (let ty = 0; ty < ny; ty++) {
    for (let tx = 0; tx < nx; tx++) {
      const x0 = tx * tw, y0 = ty * th;
      renderer.render({ cx: (x0 + tw / 2) / scale, cy: (y0 + th / 2) / scale, scale }, { ...glOptions(), mode: m, hoverCountry: -1, selectedCountry: -1, quality: 1 });
      const cw = Math.min(tw, w - x0), ch = Math.min(th, h - y0);
      ctx.drawImage(glCanvas, 0, 0, cw, ch, x0, y0, cw, ch);
      setProgress(`${label} — ${fmtInt(w)} × ${fmtInt(h)} px`, p0 + ((ty * nx + tx + 1) / (nx * ny)) * (p1 - p0) * 0.7);
      await nextFrame();
    }
  }
  // symboles et texte à l'échelle de l'image, comme sur un écran zoomé ~×2,4
  const pixelRatio = Math.max(1, scale / 2.4);
  overlay.draw(ctx, { cx: wd.W / 2, cy: wd.H / 2, scale }, w, h, { mode: m, rivers: display.rivers, pixelRatio, icons: display.towns, forests: display.forests, direct: true }, false);
  setProgress(`${label} — compression`, p0 + (p1 - p0) * 0.85);
  await nextFrame();
  const blob = await new Promise<Blob | null>((r) => out.toBlob(r, type, 0.88));
  if (!blob) throw new Error('image trop grande pour ce navigateur');
  return blob;
}

function download(blob: Blob, name: string): void {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  // le lien doit survivre à la boîte « Enregistrer sous » et à l'écriture de gros fichiers
  setTimeout(() => URL.revokeObjectURL(a.href), 10 * 60_000);
}

/** Exécute une tâche d'export en masquant le rendu écran, avec la carte de progression. */
async function withExport(title: string, job: () => Promise<void>): Promise<void> {
  if (!world || exporting) return;
  exporting = true;
  displayMenu.hide();
  progress.hidden = false;
  progress.classList.remove('live');
  (progress.querySelector('.title') as HTMLElement).textContent = title;
  setProgress('Préparation…', 0);
  await nextFrame();
  const prev = { w: glCanvas.width, h: glCanvas.height };
  try {
    await job();
  } catch (err) {
    alert(`Export impossible : ${err instanceof Error ? err.message : String(err)}`);
  } finally {
    glCanvas.width = prev.w;
    glCanvas.height = prev.h;
    progress.hidden = true;
    (progress.querySelector('.title') as HTMLElement).textContent = 'Formation du monde';
    exporting = false;
    requestRender();
  }
}

/** Préfixe des fichiers exportés (graine sans caractères interdits dans un nom de fichier). */
function exportBase(): string {
  const seed = String(world?.settings.seed ?? 'monde').replace(/[\\/:*?"<>|\s]+/g, '-').slice(0, 60);
  return `atlas-${seed || 'monde'}`;
}

const FILE_NAMES: Record<MapMode, string> = {
  political: 'pays', provinces: 'provinces', states: 'etats', regions: 'regions', cultures: 'cultures', religions: 'religions', trade: 'commerce', influence: 'influence',
  terrain: 'terrain', relief: 'relief', continents: 'continents', plates: 'plaques', temperature: 'temperatures', precipitation: 'precipitations', biomes: 'biomes',
};

/** La vue actuelle en PNG. */
function exportView(): void {
  void withExport('Gravure de la carte', async () => {
    const blob = await renderMapBlob(mode, 'screen', MAP_MODES.find((m) => m.id === mode)!.label, 0, 1);
    download(blob, `${exportBase()}-${FILE_NAMES[mode]}.png`);
  });
}

/**
 * Export au choix : cartes de tous les modes, chroniques illustrées, données. Chaque fichier est écrit dès
 * qu'il est prêt vers la destination choisie : archive ZIP ou dossier sur le disque (Chrome, Edge), sinon
 * archive téléchargée, ou liste de liens (les navigateurs bloquent les téléchargements multiples).
 */
function exportWorld(o: ExportOptions, target: ExportTarget): Promise<void> {
  return withExport('Export du monde', async () => {
    const wd = world!;
    const base = exportBase();
    // tous les fichiers restent aussi en mémoire (Blob, géré par le navigateur) : si l'écriture directe
    // échoue — Arc et Chrome la décomptent du quota de stockage du site, déjà entamé par la sauvegarde du
    // monde —, on bascule sans rien perdre vers le téléchargement classique
    const kept: ExportedFile[] = [];
    let direct: { put: (name: string, blob: Blob) => Promise<void>; finish: () => Promise<void>; abort: () => Promise<void> } | null = null;
    if (target.kind === 'dir') {
      const root = await target.handle.getDirectoryHandle(base, { create: true });
      direct = {
        put: async (name, blob) => {
          const parts = name.split('/');
          let d = root;
          for (const p of parts.slice(0, -1)) d = await d.getDirectoryHandle(p, { create: true });
          const ws = await (await d.getFileHandle(parts[parts.length - 1], { create: true })).createWritable();
          try {
            await ws.write(blob);
            await ws.close();
          } catch (err) {
            await ws.abort().catch(() => {});
            throw err;
          }
        },
        finish: async () => {},
        abort: async () => {},
      };
    } else if (target.kind === 'zipfile') {
      const ws = await target.handle.createWritable();
      const zip = new ZipWriter((p) => ws.write(p));
      direct = {
        put: (name, blob) => zip.add(`${base}/${name}`, blob),
        finish: async () => {
          await zip.finish();
          await ws.close();
        },
        abort: () => ws.abort(),
      };
    }
    const fallBack = async (err: unknown): Promise<void> => {
      console.warn('Écriture directe impossible, repli sur le téléchargement :', err);
      await direct?.abort().catch(() => {});
      direct = null;
    };
    const put = async (name: string, blob: Blob): Promise<void> => {
      kept.push({ name, blob });
      if (direct) await direct.put(name, blob).catch(fallBack);
    };
    const finish = async (): Promise<boolean> => {
      if (direct) {
        try {
          await direct.finish();
          return true;
        } catch (err) {
          await fallBack(err);
        }
      }
      if (o.zip) download(await makeZip(kept.map((f) => ({ name: `${base}/${f.name}`, blob: f.blob }))), `${base}.zip`);
      else if (kept.length === 1) download(kept[0].blob, `${base}-${kept[0].name.replace(/^cartes\//, '')}`);
      else exporter.showFiles(kept);
      return false;
    };
    const steps = o.maps.length + Number(o.chronicle) + Number(o.data) + 0.5;
    let k = 0, count = 0, saved = false;
    const mapFiles: { title: string; name: string }[] = [];
    try {
      for (const m of o.maps) {
        const def = MAP_MODES.find((x) => x.id === m)!;
        const name = `cartes/${String(MAP_MODES.indexOf(def) + 1).padStart(2, '0')}-${FILE_NAMES[m]}.png`;
        const blob = await renderMapBlob(m, o.size, `Carte « ${def.label} »`, k / steps, (k + 1) / steps);
        setProgress(`Carte « ${def.label} » — écriture`, (k + 0.95) / steps);
        await put(name, blob);
        mapFiles.push({ title: `Carte — ${def.label}`, name });
        k++;
        count++;
      }
      if (o.chronicle) {
        setProgress('Chroniques', k / steps);
        await nextFrame();
        // dans une archive ou un dossier, les chroniques montrent les cartes exportées à côté d'elles
        const linked = o.zip || (target.kind === 'dir' && direct !== null);
        let maps = mapFiles.filter((f) => /pays|terrain|commerce|cultures|religions/.test(f.name)).map((f) => ({ title: f.title, src: f.name }));
        if (!linked || !maps.length) {
          // fichier isolé : une carte politique intégrée à la page
          const jpg = await renderMapBlob('political', 'screen', 'Carte des chroniques', k / steps, (k + 0.8) / steps, 'image/jpeg');
          maps = [{ title: 'Carte politique', src: await blobToDataUrl(jpg) }];
        }
        await put('chroniques.html', new Blob([chronicleHtml(wd, maps)], { type: 'text/html' }));
        k++;
        count++;
      }
      if (o.data) {
        setProgress('Données', k / steps);
        await nextFrame();
        await put('donnees.json', new Blob([worldJson(wd)], { type: 'application/json' }));
        k++;
        count++;
      }
      setProgress(o.zip ? 'Fermeture de l\'archive' : 'Finalisation', k / steps);
      await nextFrame();
      saved = await finish();
    } catch (err) {
      await direct?.abort().catch(() => {});
      throw err;
    }
    if (saved) {
      setProgress(`Terminé — ${count} fichier${count > 1 ? 's' : ''} enregistré${count > 1 ? 's' : ''}${o.zip ? ' dans l\'archive' : ` dans « ${base} »`}`, 1);
      await new Promise((r) => setTimeout(r, 1800));
    }
  });
}

function blobToDataUrl(b: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(b);
  });
}

if (import.meta.env.DEV) {
  // accès de débogage depuis la console
  Object.assign(window, {
    atlas: {
      cam, display, sel, creator, codex, life,
      get world() {
        return world;
      },
      setMode, selectCity, selectCountry, render: requestRender,
      view(cx: number, cy: number, scale: number) {
        Object.assign(cam, { cx, cy, scale });
        clampCamera();
        requestRender();
      },
      /** Mesure (ms) du rendu WebGL et de la couche 2D sur n images en déplaçant la carte. */
      bench(n = 20, moving = false) {
        const gl = renderer.gl;
        let tg = 0, to = 0;
        for (let k = 0; k < n; k++) {
          if (moving) markMoving();
          cam.cx += 3 / cam.scale;
          const t0 = performance.now();
          renderGL();
          gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
          const t1 = performance.now();
          overlay.draw(ovCtx, cam, ovCanvas.width, ovCanvas.height, { mode, rivers: display.rivers, selectedCity: sel.city, hoverCity: sel.hoverCity, icons: display.towns, forests: display.forests, dimRivers: display.night });
          to += performance.now() - t1;
          tg += t1 - t0;
        }
        return { gl: +(tg / n).toFixed(1), overlay: +(to / n).toFixed(1), px: `${glCanvas.width}x${glCanvas.height}` };
      },
    },
  });
}

window.addEventListener('hashchange', () => {
  const seed = new URLSearchParams(location.hash.slice(1)).get('seed');
  if (seed && seed !== settings.seed) {
    settings.seed = seed;
    generate();
  }
});

creator.setMaxWidth(renderer.maxTextureSize);
applyDisplay();
resize();
void start();

/**
 * Démarrage : le dernier monde sauvegardé est rechargé tel quel (rafraîchir la page ne régénère rien),
 * sauf si le lien désigne une autre graine. Sans sauvegarde : lien → génération, sinon pop-in de création.
 */
async function start(): Promise<void> {
  progress.hidden = false;
  (progress.querySelector('.title') as HTMLElement).textContent = 'Ouverture de l’atlas';
  setProgress('Chargement du dernier monde…', 0.5);
  let saved: WorldData | null = null;
  try {
    saved = await loadWorld();
  } catch (err) {
    console.warn('Lecture de la sauvegarde impossible :', err);
  }
  progress.hidden = true;
  (progress.querySelector('.title') as HTMLElement).textContent = 'Formation du monde';
  if (saved && (!hashSeed || hashSeed === saved.settings.seed)) {
    Object.assign(settings, saved.settings);
    save(STORE_KEY, settings);
    history.replaceState(null, '', `#seed=${encodeURIComponent(settings.seed)}`);
    const ms = Object.values(saved.stats.timings).reduce((a, b) => a + b, 0);
    showWorld(saved, ms);
  } else if (hashSeed) generate();
  else creator.show();
}
