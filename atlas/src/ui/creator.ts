import { DEFAULT_SETTINGS, type GenSettings, type WorldData } from '../gen/types';
import { fmtInt } from './format';

export interface CreatorCallbacks {
  /** Nouveau monde complet (terrain + géopolitique). */
  onCreate(): void;
  /** Même planète, nouvelle géopolitique. */
  onNewPolitics(): void;
  onRandomSeed(): string;
}

interface SliderSpec {
  key: keyof GenSettings;
  label: string;
  min: number;
  max: number;
  step: number;
  fmt: (v: number) => string;
  hint?: string;
  toView?: (v: number) => number;
  fromView?: (v: number) => number;
}

type Tab = 'planet' | 'climate' | 'politics' | 'stats';

const pct = (v: number) => `${Math.round(v)} %`;
const mult = (v: number) => `×${v.toFixed(2)}`;

const SECTIONS: Record<Exclude<Tab, 'stats'>, { title: string; sliders: SliderSpec[] }[]> = {
  planet: [
    {
      title: 'Géologie',
      sliders: [
        { key: 'landFraction', label: 'Terres émergées', min: 10, max: 70, step: 1, fmt: pct, hint: 'Règle le niveau de la mer.', toView: (v) => v * 100, fromView: (v) => v / 100 },
        { key: 'plateCount', label: 'Plaques tectoniques', min: 4, max: 40, step: 1, fmt: (v) => `${v}` },
        { key: 'tectonics', label: 'Activité tectonique', min: 0.3, max: 2, step: 0.05, fmt: mult, hint: 'Hauteur des chaînes, profondeur des fosses.' },
        { key: 'fragmentation', label: 'Fragmentation', min: 0, max: 100, step: 1, fmt: pct, hint: 'Continents massifs ↔ archipels.', toView: (v) => v * 100, fromView: (v) => v / 100 },
      ],
    },
    {
      title: 'Érosion & hydrographie',
      sliders: [
        { key: 'erosion', label: 'Érosion fluviale', min: 0, max: 2, step: 0.05, fmt: mult },
        { key: 'riverDensity', label: 'Densité des fleuves', min: 0.3, max: 3, step: 0.05, fmt: mult },
        { key: 'latMax', label: 'Latitudes couvertes', min: 45, max: 85, step: 1, fmt: (v) => `±${v}°` },
      ],
    },
  ],
  climate: [
    {
      title: 'Climat',
      sliders: [
        { key: 'temperature', label: 'Température globale', min: -15, max: 15, step: 0.5, fmt: (v) => `${v > 0 ? '+' : ''}${v.toFixed(1)} °C`, hint: 'Âge glaciaire ↔ monde tropical.' },
        { key: 'humidity', label: 'Hygrométrie', min: 0.3, max: 2, step: 0.05, fmt: mult, hint: 'Évaporation océanique → précipitations.' },
      ],
    },
  ],
  politics: [
    {
      title: 'Géopolitique',
      sliders: [
        { key: 'countryCount', label: 'Pays', min: 4, max: 150, step: 1, fmt: (v) => `${v}` },
        { key: 'cityCount', label: 'Villes principales', min: 40, max: 1000, step: 10, fmt: (v) => `${v}` },
        { key: 'provinceSize', label: 'Taille des provinces', min: 25, max: 300, step: 5, fmt: (v) => `~${fmtInt(v * 680)} km²`, hint: 'Plus petites dans les régions peuplées, plus vastes dans les déserts.' },
      ],
    },
  ],
};

const RESOLUTIONS = [
  { w: 1024, label: 'Rapide — 1024 × 410 (~2 s)' },
  { w: 1536, label: 'Standard — 1536 × 614 (~5 s)' },
  { w: 2048, label: 'Haute — 2048 × 819 (~10 s)' },
  { w: 3072, label: 'Très haute — 3072 × 1229 (~25 s)' },
  { w: 4096, label: 'Ultra — 4096 × 1638 (~1 min)' },
  { w: 6144, label: 'Extrême — 6144 × 2458 (~2 min)' },
  { w: 8192, label: 'Titanesque — 8192 × 3277 (~4 min, 16 Go de RAM conseillés)' },
];

const TABS: { id: Tab; label: string; tip: string }[] = [
  { id: 'planet', label: 'Planète', tip: 'Terres émergées, plaques tectoniques, fragmentation, érosion et fleuves.' },
  { id: 'climate', label: 'Climat', tip: 'Température globale et hygrométrie (précipitations).' },
  { id: 'politics', label: 'Géopolitique', tip: 'Nombre de pays, de villes et taille des provinces.' },
  { id: 'stats', label: 'Monde actuel', tip: 'Statistiques du monde affiché : relief, fleuves, peuples, religions, temps de génération.' },
];

/** Pop-in de création : réglages du monde, affichée au lancement et via « Recréer ». */
export class Creator {
  private tab: Tab = 'planet';
  private world: WorldData | null = null;
  private stats: [string, string][] = [];
  private readonly body: HTMLElement;
  private readonly seedInput: HTMLInputElement;
  private readonly polBtn: HTMLButtonElement;
  private readonly closeBtn: HTMLButtonElement;

  constructor(private readonly root: HTMLElement, private readonly settings: GenSettings, private readonly cb: CreatorCallbacks) {
    root.innerHTML = `<div class="modal fantasy wc-card" role="dialog" aria-label="Créer un monde">
      <div class="modal-head"><div><div class="modal-title">Atlas</div><div class="modal-sub">Générateur procédural de mondes</div></div><button class="ic-close" aria-label="Fermer">×</button></div>
      <div class="modal-seed"><label class="wc-label">Graine du monde</label><div class="seed-row"><input class="wc-input" type="text" spellcheck="false"><button class="wc-btn dice" data-tip="Tirer une graine au hasard. Une même graine redonne toujours le même monde.">⚄</button></div>
        <label class="wc-label">Résolution</label><select class="res wc-input" data-tip="Largeur de la grille en cellules : plus elle est grande, plus le zoom est détaillé, mais la génération est longue et gourmande en mémoire.">${RESOLUTIONS.map((r) => `<option value="${r.w}">${r.label}</option>`).join('')}</select></div>
      <div class="wc-tabs">${TABS.map((t) => `<button class="wc-tab" data-tab="${t.id}" data-tip="${t.tip}">${t.label}</button>`).join('')}</div>
      <div class="modal-body wc-tab-content"></div>
      <button class="more-hint" type="button" tabindex="-1">▾ Autres réglages plus bas</button>
      <div class="modal-foot">
        <button class="wc-btn reset" data-tip="Remet tous les curseurs à leur valeur d'origine (garde la graine et la résolution).">Réglages par défaut</button>
        <span class="grow"></span>
        <button class="wc-btn politics" data-tip="Même planète, autre histoire : nouveaux pays, peuples, religions et dynasties (rapide).">Nouvelle géopolitique</button>
        <button class="wc-btn wc-btn-frame create" data-tip="Génère la planète complète avec ces réglages (Entrée dans le champ de graine).">Créer le monde</button>
      </div>
    </div>`;
    this.body = root.querySelector('.modal-body')!;
    this.seedInput = root.querySelector('.seed-row input')!;
    this.polBtn = root.querySelector('.politics')!;
    this.closeBtn = root.querySelector('.ic-close')!;
    const res = root.querySelector<HTMLSelectElement>('.res')!;
    this.seedInput.addEventListener('input', () => (this.settings.seed = this.seedInput.value.trim() || 'terra'));
    this.seedInput.addEventListener('keydown', (e) => e.key === 'Enter' && this.create());
    root.querySelector('.dice')!.addEventListener('click', () => {
      this.seedInput.value = this.cb.onRandomSeed();
      this.settings.seed = this.seedInput.value;
    });
    res.addEventListener('change', () => (this.settings.width = Number(res.value)));
    root.querySelectorAll<HTMLButtonElement>('.wc-tab').forEach((b) =>
      b.addEventListener('click', () => {
        this.tab = b.dataset.tab as Tab;
        this.render();
      }),
    );
    root.querySelector('.reset')!.addEventListener('click', () => {
      Object.assign(this.settings, DEFAULT_SETTINGS, { seed: this.settings.seed, width: this.settings.width, politicsSeed: this.settings.politicsSeed });
      this.render();
    });
    this.polBtn.addEventListener('click', () => {
      this.hide();
      this.cb.onNewPolitics();
    });
    root.querySelector('.create')!.addEventListener('click', () => this.create());
    this.closeBtn.addEventListener('click', () => this.hide());
    root.addEventListener('pointerdown', (e) => {
      if (e.target === root && this.world) this.hide();
      e.stopPropagation();
    });
    // la molette fait défiler les réglages où que soit le pointeur dans la fenêtre (en-tête, onglets, pied)
    root.addEventListener(
      'wheel',
      (e) => {
        e.stopPropagation();
        const b = this.body;
        if (b.scrollHeight <= b.clientHeight + 1 || b.contains(e.target as Node)) return;
        e.preventDefault();
        b.scrollTop += e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
      },
      { passive: false },
    );
    root.querySelector('.more-hint')!.addEventListener('click', () => this.body.scrollBy({ top: this.body.clientHeight * 0.8, behavior: 'smooth' }));
    // fondu en bas et indication tant qu'il reste des réglages à faire défiler
    const updateMore = () => {
      const more = this.body.scrollTop + this.body.clientHeight < this.body.scrollHeight - 4;
      this.body.classList.toggle('more', more);
      root.querySelector('.modal')!.classList.toggle('has-more', more);
    };
    this.body.addEventListener('scroll', updateMore);
    new ResizeObserver(updateMore).observe(this.body);
    this.updateMore = updateMore;
    this.render();
  }

  private updateMore: () => void = () => {};

  private create(): void {
    this.hide();
    this.cb.onCreate();
  }

  get visible(): boolean {
    return !this.root.hidden;
  }

  show(tab?: Tab): void {
    if (tab) this.tab = tab;
    this.root.hidden = false;
    this.render();
    this.seedInput.focus();
  }

  hide(): void {
    this.root.hidden = true;
  }

  /** Désactive les résolutions que la carte graphique ne peut pas afficher. */
  setMaxWidth(max: number): void {
    this.root.querySelectorAll<HTMLOptionElement>('.res option').forEach((o) => (o.disabled = Number(o.value) > max));
    const ok = RESOLUTIONS.filter((r) => r.w <= max);
    if (ok.length && this.settings.width > max) this.settings.width = ok[ok.length - 1].w;
  }

  setWorld(world: WorldData, stats: [string, string][]): void {
    this.world = world;
    this.stats = stats;
    if (this.visible) this.render();
  }

  private render(): void {
    const r = this.root;
    if (!RESOLUTIONS.some((x) => x.w === this.settings.width)) {
      this.settings.width = RESOLUTIONS.reduce((a, b) => (Math.abs(b.w - this.settings.width) < Math.abs(a.w - this.settings.width) ? b : a)).w;
    }
    this.seedInput.value = this.settings.seed;
    r.querySelector<HTMLSelectElement>('.res')!.value = String(this.settings.width);
    // sans monde existant, pas de « même planète » ni de fermeture
    this.polBtn.disabled = !this.world;
    this.closeBtn.hidden = !this.world;
    r.querySelectorAll<HTMLElement>('.wc-tab').forEach((b) => b.classList.toggle('active', b.dataset.tab === this.tab));
    this.body.replaceChildren();
    if (this.tab === 'stats') {
      const dl = document.createElement('dl');
      dl.className = 'stats';
      if (!this.stats.length) dl.innerHTML = '<dt>Aucun monde généré pour l’instant.</dt>';
      for (const [k, v] of this.stats) dl.insertAdjacentHTML('beforeend', `<dt>${k}</dt><dd>${v}</dd>`);
      this.body.append(dl);
      return;
    }
    const grid = document.createElement('div');
    grid.className = 'modal-grid';
    for (const sec of SECTIONS[this.tab]) {
      const s = document.createElement('div');
      s.className = 'modal-section';
      s.innerHTML = `<h3>${sec.title}</h3>`;
      for (const spec of sec.sliders) s.append(this.slider(spec));
      grid.append(s);
    }
    this.body.append(grid);
    requestAnimationFrame(() => this.updateMore());
  }

  private slider(spec: SliderSpec): HTMLElement {
    const row = document.createElement('div');
    row.className = 'row';
    const toView = spec.toView ?? ((v: number) => v);
    const fromView = spec.fromView ?? ((v: number) => v);
    const v0 = toView(this.settings[spec.key] as number);
    row.innerHTML = `<div class="head"><label>${spec.label}</label><span class="val">${spec.fmt(v0)}</span></div><input type="range" min="${spec.min}" max="${spec.max}" step="${spec.step}" value="${v0}">${spec.hint ? `<div class="hint">${spec.hint}</div>` : ''}`;
    const input = row.querySelector('input')!;
    const val = row.querySelector('.val')!;
    input.addEventListener('input', () => {
      (this.settings[spec.key] as number) = fromView(Number(input.value));
      val.textContent = spec.fmt(Number(input.value));
    });
    return row;
  }
}

/** Lignes de statistiques affichées dans l'onglet « Monde actuel ». */
export function worldStats(world: WorldData, totalMs: number): [string, string][] {
  const s = world.stats;
  const pol = world.politics;
  return [
    ['Grille', `${world.W} × ${world.H}`],
    ['Terres émergées', `${s.landPct.toFixed(1)} %`],
    ['Point culminant', `${fmtInt(s.maxElevation)} m`],
    ['Fosse la plus profonde', `${fmtInt(s.minElevation)} m`],
    ['Plaques', `${world.plates.length} (${world.plates.filter((p) => p.continental).length} continentales)`],
    ['Continents', `${pol.continents.filter((c) => c.kind !== 'archipel').length}`],
    ['Fleuves tracés', fmtInt(s.riverCount)],
    ['Lacs', fmtInt(s.lakeCount)],
    ['Pays', `${pol.countries.length}`],
    ['Provinces', fmtInt(pol.provinces.length)],
    ['Villes', `${pol.cities.length}`],
    ['Population', `${(pol.totalPop / 1e9).toFixed(2).replace('.', ',')} Md`],
    ['Liaisons commerciales', `${pol.linkA.length} (${pol.linkKind.reduce((a, b) => a + b, 0)} maritimes)`],
    ['Cultures', `${pol.cultures.length} (${pol.cultureGroups.length} familles)`],
    ['Religions', `${pol.religions.filter((r) => r.provinces > 0).length}`],
    ['Dynasties', `${pol.dynasties.length}`],
    ['Temps de génération', `${(totalMs / 1000).toFixed(1).replace('.', ',')} s`],
  ];
}
