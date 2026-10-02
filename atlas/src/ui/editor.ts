import { GOV_FORMS } from '../gen/politics/names';
import type { WorldData } from '../gen/types';
import type { CountryPatch } from '../world-edit';

export type EditTool = 'pick' | 'province' | 'state';

export interface EditorCallbacks {
  onPatch(country: number, patch: CountryPatch): void;
  onTool(tool: EditTool): void;
  onSelect(country: number): void;
  onCityRename(city: number, name: string): void;
  onUndo(): void;
  onRedo(): void;
  onExport(): void;
  onClose(): void;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const hex = (c: readonly number[]) => `#${c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
const unhex = (h: string): [number, number, number] => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];

/**
 * Panneau de l'éditeur (cadre warcraftcn) : choix du pays, nom, forme de gouvernement, couleur et
 * souverain ; pinceau de frontières (province par province ou État entier) ; nom des villes ;
 * annuler / rétablir ; export. Les retouches sont appliquées par main.ts (world-edit.ts).
 */
export class Editor {
  private world: WorldData | null = null;
  private country = -1;
  private city = -1;
  private tool: EditTool = 'province';

  constructor(private readonly root: HTMLElement, private readonly cb: EditorCallbacks) {
    root.classList.add('fantasy', 'wc-card');
    root.hidden = true;
    root.innerHTML = `
      <div class="ic-head"><div class="ic-titles"><div class="ic-title wc-title-epic">Éditeur</div><div class="ic-sub">Retouchez le monde, puis exportez-le</div></div><button class="ic-close ed-close" aria-label="Fermer l'éditeur">×</button></div>
      <div class="ed-sec">
        <label class="wc-label">Pays</label>
        <div class="ed-pickrow"><span class="ic-flag ed-flag"></span><select class="wc-input ed-pick" data-tip="Pays à modifier. Clic droit sur la carte : choisir le pays sous le curseur."></select></div>
        <div class="ed-grid">
          <label class="wc-label">Nom</label><input class="wc-input ed-name" maxlength="40" spellcheck="false">
          <label class="wc-label">Régime</label><select class="wc-input ed-form">${GOV_FORMS.map((f) => `<option>${f.label}</option>`).join('')}</select>
          <label class="wc-label">Couleur</label><div class="ed-colorrow"><input type="color" class="ed-color"><span class="ed-full"></span></div>
          <label class="wc-label">Souverain</label><div class="ed-rulerrow"><input class="wc-input ed-rtitle" maxlength="24" placeholder="Titre"><input class="wc-input ed-rname" maxlength="24" placeholder="Nom"></div>
        </div>
      </div>
      <div class="ed-sec">
        <label class="wc-label">Frontières</label>
        <div class="ed-tools">
          <button class="wc-btn ed-tool" data-tool="province" data-tip="Peignez sur la carte : chaque province survolée passe au pays choisi.">✎ Province</button>
          <button class="wc-btn ed-tool" data-tool="state" data-tip="Peignez sur la carte : l'État entier passe au pays choisi.">⬢ État</button>
          <button class="wc-btn ed-tool" data-tool="pick" data-tip="Cliquez un pays sur la carte pour le choisir ; la carte se déplace normalement.">◉ Choisir</button>
        </div>
        <p class="ed-hint">Glisser pour peindre · clic droit : choisir le pays sous le curseur · cliquez une ville pour la renommer.</p>
      </div>
      <div class="ed-sec ed-citysec" hidden>
        <label class="wc-label">Ville</label>
        <input class="wc-input ed-city" maxlength="32" spellcheck="false">
      </div>
      <div class="ed-foot">
        <button class="wc-btn ed-undo" data-tip-key="Ctrl Z">↶ Annuler</button>
        <button class="wc-btn ed-redo" data-tip-key="Ctrl Y">↷ Rétablir</button>
        <span class="grow"></span>
        <button class="wc-btn wc-btn-frame ed-export" data-tip="Cartes de toutes les vues, chroniques et données, avec vos retouches.">Exporter…</button>
      </div>
      <div class="ed-status"></div>`;
    const q = <T extends HTMLElement>(s: string) => root.querySelector<T>(s)!;
    q('.ed-close').addEventListener('click', () => this.cb.onClose());
    q<HTMLSelectElement>('.ed-pick').addEventListener('change', (e) => {
      this.select(Number((e.target as HTMLSelectElement).value));
      this.cb.onSelect(this.country);
    });
    const commit = () => {
      if (this.country < 0 || !this.world) return;
      const c = this.world.politics.countries[this.country];
      const name = q<HTMLInputElement>('.ed-name').value.trim() || c.name;
      const patch: CountryPatch = {
        name,
        form: q<HTMLSelectElement>('.ed-form').value,
        color: unhex(q<HTMLInputElement>('.ed-color').value),
        rulerName: q<HTMLInputElement>('.ed-rname').value.trim() || c.ruler.name,
        rulerTitle: q<HTMLInputElement>('.ed-rtitle').value.trim() || c.ruler.title,
      };
      if (patch.name === c.name && patch.form === c.form && hex(patch.color) === hex(c.color) && patch.rulerName === c.ruler.name && patch.rulerTitle === c.ruler.title) return;
      this.cb.onPatch(this.country, patch);
      this.refresh();
    };
    for (const s of ['.ed-name', '.ed-rname', '.ed-rtitle']) {
      q<HTMLInputElement>(s).addEventListener('change', commit);
      q<HTMLInputElement>(s).addEventListener('keydown', (e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur());
    }
    q('.ed-form').addEventListener('change', commit);
    q('.ed-color').addEventListener('change', commit);
    q<HTMLInputElement>('.ed-city').addEventListener('change', (e) => {
      const v = (e.target as HTMLInputElement).value.trim();
      if (this.city >= 0 && v) this.cb.onCityRename(this.city, v);
    });
    root.querySelectorAll<HTMLElement>('.ed-tool').forEach((b) =>
      b.addEventListener('click', () => {
        this.tool = b.dataset.tool as EditTool;
        this.refreshTools();
        this.cb.onTool(this.tool);
      }),
    );
    q('.ed-undo').addEventListener('click', () => this.cb.onUndo());
    q('.ed-redo').addEventListener('click', () => this.cb.onRedo());
    q('.ed-export').addEventListener('click', () => this.cb.onExport());
    for (const t of ['pointerdown', 'wheel', 'dblclick', 'keydown']) root.addEventListener(t, (e) => e.stopPropagation());
  }

  get visible(): boolean {
    return !this.root.hidden;
  }

  get currentTool(): EditTool {
    return this.tool;
  }

  get currentCountry(): number {
    return this.country;
  }

  setWorld(w: WorldData): void {
    this.world = w;
    this.country = -1;
    this.city = -1;
    this.fillCountries();
  }

  show(): void {
    if (!this.world) return;
    this.root.hidden = false;
    if (this.country < 0) {
      const biggest = [...this.world.politics.countries].sort((a, b) => b.pop - a.pop)[0];
      this.select(biggest.id);
    }
    this.refreshTools();
    this.cb.onTool(this.tool);
  }

  hide(): void {
    this.root.hidden = true;
  }

  /** Liste des pays (triés par nom), à reconstruire après un renommage. */
  private fillCountries(): void {
    if (!this.world) return;
    const pick = this.root.querySelector<HTMLSelectElement>('.ed-pick')!;
    pick.innerHTML = [...this.world.politics.countries]
      .sort((a, b) => a.name.localeCompare(b.name, 'fr'))
      .map((c) => `<option value="${c.id}">${esc(c.name)}${c.provinces ? '' : ' (annexé)'}</option>`)
      .join('');
    if (this.country >= 0) pick.value = String(this.country);
  }

  select(country: number): void {
    this.country = country;
    this.refresh();
  }

  showCity(city: number): void {
    if (!this.world) return;
    this.city = city;
    const sec = this.root.querySelector<HTMLElement>('.ed-citysec')!;
    sec.hidden = false;
    const inp = this.root.querySelector<HTMLInputElement>('.ed-city')!;
    inp.value = this.world.politics.cities[city].name;
    inp.focus();
    inp.select();
  }

  /** Met à jour les champs et l'état des boutons. */
  refresh(status?: { edits: number; canUndo: boolean; canRedo: boolean; saved: boolean }): void {
    const w = this.world;
    if (!w || this.country < 0) return;
    const c = w.politics.countries[this.country];
    const q = <T extends HTMLElement>(s: string) => this.root.querySelector<T>(s)!;
    this.fillCountries();
    q('.ed-flag').style.background = `rgb(${c.color.join(',')})`;
    if (document.activeElement !== q('.ed-name')) q<HTMLInputElement>('.ed-name').value = c.name;
    const form = q<HTMLSelectElement>('.ed-form');
    if (![...form.options].some((o) => o.value === c.form)) form.add(new Option(c.form));
    form.value = c.form;
    q<HTMLInputElement>('.ed-color').value = hex(c.color);
    q('.ed-full').textContent = c.fullName;
    q<HTMLInputElement>('.ed-rname').value = c.ruler.name;
    q<HTMLInputElement>('.ed-rtitle').value = c.ruler.title;
    if (status) {
      q<HTMLButtonElement>('.ed-undo').disabled = !status.canUndo;
      q<HTMLButtonElement>('.ed-redo').disabled = !status.canRedo;
      q('.ed-status').textContent = status.edits ? `${status.edits} retouche${status.edits > 1 ? 's' : ''} · ${status.saved ? 'enregistrées' : 'enregistrement…'}` : 'Aucune retouche';
    }
  }

  private refreshTools(): void {
    this.root.querySelectorAll<HTMLElement>('.ed-tool').forEach((b) => b.classList.toggle('active', b.dataset.tool === this.tool));
  }
}
