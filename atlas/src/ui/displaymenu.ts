export interface DisplaySettings {
  exaggeration: number;
  rivers: boolean;
  grid: boolean;
  /** Navires, créatures marines et convois du mode Commerce. */
  life: boolean;
  /** Couche nuageuse animée. */
  clouds: boolean;
  /** Cycle jour / nuit (lumières des villes la nuit). */
  night: boolean;
  /** Forêts dessinées en petits arbres. */
  forests: boolean;
  /** Villes dessinées en petites maisons (château pour les capitales) plutôt qu'en pastilles. */
  towns: boolean;
  /** Curseur warcraftcn (ou curseur système). */
  cursor: 'system' | 'human' | 'orc' | 'elf' | 'undead';
}

export interface DisplayCallbacks {
  onChange(): void;
  /** `screen` : la vue actuelle en PNG (×2, ≤ 8192 px) ; `dialog` : fenêtre d'export complète. */
  onExport(kind: 'screen' | 'dialog'): void;
}

export type Toggle = 'rivers' | 'grid' | 'life' | 'clouds' | 'night' | 'towns' | 'forests';

/** Héros des factions warcraftcn : chacun porte son curseur. */
const HEROES: [DisplaySettings['cursor'], string][] = [['human', 'Humain'], ['orc', 'Orc'], ['elf', 'Elfe'], ['undead', 'Mort-vivant'], ['system', 'Système']];
const TOGGLES: [Toggle, string, string, string][] = [
  ['rivers', 'Fleuves', 'R', 'Fleuves tracés selon le débit ; leur largeur réelle apparaît au fort zoom.'],
  ['grid', 'Méridiens et parallèles', 'G', 'Grille géographique tous les 15°.'],
  ['clouds', 'Nuages', 'U', 'Couche nuageuse animée, poussée par les vents dominants, plus dense là où il pleut.'],
  ['night', 'Cycle jour / nuit', 'J', 'Le soleil tourne autour du monde ; la nuit, les villes s\'illuminent selon leur population.'],
  ['forests', 'Forêts', 'O', 'Petits arbres selon le biome : conifères de la taïga, feuillus, jungle, acacias de savane, saules des marais. Apparaissent dès qu\'on zoome un peu.'],
  ['towns', 'Villes illustrées', 'V', 'Villes dessinées en petites maisons (château pour les capitales, port sur la côte) plutôt qu\'en pastilles.'],
  ['life', 'Navires, créatures et convois', 'M', 'Navires marchands sur les lignes maritimes, baleines et serpents de mer, convois du mode Commerce.'],
];
const HERO_TIPS: Record<DisplaySettings['cursor'], string> = {
  human: 'Gantelet de l\'Alliance', orc: 'Griffe de la Horde', elf: 'Main elfique', undead: 'Main squelettique', system: 'Curseur habituel du système',
};

/** Menu déroulant « Affichage » du bandeau supérieur (panneau warcraftcn). */
export class DisplayMenu {
  constructor(private readonly root: HTMLElement, private readonly d: DisplaySettings, private readonly cb: DisplayCallbacks) {
    root.innerHTML = `
      <div class="row" data-tip="Accentue l'ombrage des reliefs (×1 = réaliste ; la carte vue de très haut paraîtrait plate)."><div class="head"><label>Exagération du relief</label><span class="val"></span></div><input class="exag" type="range" min="4" max="60" step="1"></div>
      ${TOGGLES.map(([k, l, key, tip]) => `<label class="check" data-tip="${tip}"${key ? ` data-tip-key="${key}"` : ''}><input class="wc-checkbox" type="checkbox" data-k="${k}"> ${l} <span class="key">${key}</span></label>`).join('')}
      <div class="dm-sep"></div>
      <div class="dm-title">Curseur de faction</div>
      <div class="heroes">${HEROES.map(
        ([v, l]) => `<button class="hero" data-cursor="${v}" data-tip-title="${l}" data-tip="${HERO_TIPS[v]}"><span class="pic"${v === 'system' ? '>➚' : ` style="background-image:url('/warcraftcn/heroes/${v}-hero.webp')">`}</span>${l}</button>`,
      ).join('')}</div>
      <div class="dm-sep"></div>
      <div class="dm-title">Exporter la carte</div>
      <div class="dm-export"><button class="wc-btn export" data-kind="screen" data-tip="Le monde entier dans la vue actuelle, en PNG (deux fois la résolution de la carte).">PNG de la vue</button><button class="wc-btn wc-btn-frame export" data-kind="dialog" data-tip="Choisir les cartes (toutes les vues, jusqu'en 12K), les chroniques illustrées et les données — ou tout exporter dans une archive ZIP.">Exporter…</button></div>`;
    const ex = root.querySelector<HTMLInputElement>('.exag')!;
    const exVal = root.querySelector('.row .val')!;
    ex.addEventListener('input', () => {
      d.exaggeration = Number(ex.value);
      exVal.textContent = `×${ex.value}`;
      cb.onChange();
    });
    root.querySelectorAll<HTMLInputElement>('input[type=checkbox]').forEach((c) =>
      c.addEventListener('change', () => {
        d[c.dataset.k as Toggle] = c.checked;
        cb.onChange();
      }),
    );
    root.querySelectorAll<HTMLButtonElement>('.hero').forEach((b) =>
      b.addEventListener('click', () => {
        d.cursor = b.dataset.cursor as DisplaySettings['cursor'];
        this.refresh();
        cb.onChange();
      }),
    );
    root.querySelectorAll<HTMLButtonElement>('.export').forEach((b) => b.addEventListener('click', () => cb.onExport(b.dataset.kind as 'screen' | 'dialog')));
    root.addEventListener('pointerdown', (e) => e.stopPropagation());
    root.addEventListener('wheel', (e) => e.stopPropagation());
    this.refresh();
  }

  refresh(): void {
    const r = this.root;
    r.querySelector<HTMLInputElement>('.exag')!.value = String(this.d.exaggeration);
    r.querySelector('.row .val')!.textContent = `×${this.d.exaggeration}`;
    r.querySelectorAll<HTMLInputElement>('input[type=checkbox]').forEach((c) => (c.checked = this.d[c.dataset.k as Toggle]));
    r.querySelectorAll<HTMLElement>('.hero').forEach((b) => b.classList.toggle('active', b.dataset.cursor === this.d.cursor));
  }

  toggle(): void {
    this.root.hidden = !this.root.hidden;
    if (!this.root.hidden) this.refresh();
  }

  hide(): void {
    this.root.hidden = true;
  }

  toggleKey(k: Toggle): void {
    this.d[k] = !this.d[k];
    this.refresh();
    this.cb.onChange();
  }
}

/** Petites bascules rondes en bas à droite : nuages, jour / nuit, villes illustrées, vie marine. */
export class QuickToggles {
  private static readonly ITEMS: [Toggle, string, string][] = [
    ['clouds', '☁', 'Nuages'], ['night', '☾', 'Cycle jour / nuit'], ['forests', '♣', 'Forêts'], ['towns', '⌂', 'Villes illustrées'], ['life', '⚓', 'Navires, créatures et convois'],
  ];

  constructor(private readonly root: HTMLElement, private readonly d: DisplaySettings, private readonly onToggle: (k: Toggle) => void) {
    root.innerHTML = QuickToggles.ITEMS.map(([k, icon, title]) => {
      const t = TOGGLES.find((x) => x[0] === k)!;
      return `<button class="qt" data-k="${k}" aria-label="${title}" data-tip-title="${title}" data-tip="${t[3]}" data-tip-key="${t[2]}"><span>${icon}</span></button>`;
    }).join('');
    root.querySelectorAll<HTMLButtonElement>('.qt').forEach((b) => b.addEventListener('click', () => this.onToggle(b.dataset.k as Toggle)));
    root.addEventListener('pointerdown', (e) => e.stopPropagation());
    this.refresh();
  }

  refresh(): void {
    this.root.querySelectorAll<HTMLElement>('.qt').forEach((b) => b.classList.toggle('on', this.d[b.dataset.k as Toggle]));
  }
}
