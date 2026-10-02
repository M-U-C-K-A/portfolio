import type { WorldData } from '../gen/types';
import { cityView, countryView, cultureView, dynastyView, histCountryView, provinceView, regionView, religionView, stateView } from './loreviews';

export interface InfoCardCallbacks {
  onSelectCity(id: number): void;
  onSelectCountry(id: number): void;
  onSelectCulture(id: number): void;
  onSelectReligion(id: number): void;
  onSelectDynasty(id: number): void;
  onSelectState(id: number): void;
  onSelectRegion(id: number): void;
  onClose(): void;
}

/** Délègue les clics sur les liens [data-*] d'un conteneur aux rappels correspondants. */
export function bindLoreLinks(el: HTMLElement, cb: InfoCardCallbacks, onClose?: () => void): void {
  el.addEventListener('click', (e) => {
    const t = (e.target as HTMLElement).closest<HTMLElement>('[data-city],[data-country],[data-culture],[data-religion],[data-dynasty],[data-state],[data-region],[data-close]');
    if (!t) return;
    const d = t.dataset;
    if (d.close !== undefined) onClose?.();
    else if (d.city) cb.onSelectCity(Number(d.city));
    else if (d.country) cb.onSelectCountry(Number(d.country));
    else if (d.culture) cb.onSelectCulture(Number(d.culture));
    else if (d.religion) cb.onSelectReligion(Number(d.religion));
    else if (d.dynasty) cb.onSelectDynasty(Number(d.dynasty));
    else if (d.state) cb.onSelectState(Number(d.state));
    else if (d.region) cb.onSelectRegion(Number(d.region));
  });
}

/** Fiche détaillée (cadre « card » warcraftcn) : pays, ville, province, culture, religion, dynastie. */
export class InfoCard {
  private world: WorldData | null = null;

  constructor(private readonly el: HTMLElement, private readonly cb: InfoCardCallbacks) {
    el.classList.add('wc-card', 'fantasy');
    bindLoreLinks(el, cb, () => {
      this.hide();
      this.cb.onClose();
    });
    el.addEventListener('pointerdown', (e) => e.stopPropagation());
    el.addEventListener('wheel', (e) => e.stopPropagation());
  }

  setWorld(world: WorldData): void {
    this.world = world;
  }

  hide(): void {
    this.el.hidden = true;
  }

  private open(html: string): void {
    this.el.innerHTML = html;
    this.el.hidden = false;
    this.el.scrollTop = 0;
  }

  showCity(id: number): void {
    if (this.world) this.open(cityView(this.world, id));
  }

  showCountry(id: number): void {
    if (this.world) this.open(countryView(this.world, id));
  }

  showProvince(id: number): void {
    if (this.world && this.world.politics.provinces[id]) this.open(provinceView(this.world, id));
  }

  showCulture(id: number): void {
    if (this.world) this.open(cultureView(this.world, id));
  }

  showReligion(id: number): void {
    if (this.world) this.open(religionView(this.world, id));
  }

  showState(id: number, owner?: number): void {
    if (this.world) this.open(stateView(this.world, id, owner));
  }

  showRegion(id: number): void {
    if (this.world) this.open(regionView(this.world, id));
  }

  showHistCountry(id: number, year: number): void {
    if (this.world) this.open(histCountryView(this.world, id, year));
  }

  showDynasty(id: number): void {
    if (this.world) this.open(dynastyView(this.world, id));
  }
}
