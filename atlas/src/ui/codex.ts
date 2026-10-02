import type { WorldData } from '../gen/types';
import { fmtArea, fmtInt, fmtPop } from './format';
import { armsSvg } from './heraldry';
import { bindLoreLinks, type InfoCardCallbacks } from './infocard';
import { aCountry, aCulture, aReligion, esc, lineageList, rgb, rulerBlock } from './loreviews';

type Tab = 'countries' | 'dynasties' | 'cultures' | 'religions';
const TABS: { id: Tab; label: string; tip: string }[] = [
  { id: 'countries', label: 'Pays', tip: 'Tous les États, du plus peuplé au plus petit : souverain, histoire, chroniques.' },
  { id: 'dynasties', label: 'Dynasties', tip: 'Maisons régnantes : devise, armoiries blasonnées, lignée des souverains.' },
  { id: 'cultures', label: 'Cultures', tip: 'Peuples regroupés par familles de langues, avec leurs traits et toponymes.' },
  { id: 'religions', label: 'Religions', tip: 'Religions et leurs confessions : doctrine, clergé, villes saintes.' },
];

/** Encyclopédie du monde : onglets et accordéons warcraftcn, contenu rendu à l'ouverture. */
export class Codex {
  private world: WorldData | null = null;
  private tab: Tab = 'countries';
  private filter = '';
  private readonly list: HTMLElement;
  private readonly title: HTMLElement;
  private readonly bodies = new Map<string, () => string>();

  constructor(private readonly el: HTMLElement, cb: InfoCardCallbacks) {
    el.classList.add('fantasy', 'wc-panel');
    el.dataset.tipSide = 'right';
    el.innerHTML = `<div class="cx-head"><div class="cx-title"></div><button class="ic-close" data-close aria-label="Fermer">×</button></div>
      <div class="wc-tabs">${TABS.map((t) => `<button class="wc-tab" data-tab="${t.id}" data-tip="${t.tip}">${t.label}</button>`).join('')}</div>
      <input class="cx-search" type="search" placeholder="Rechercher…" spellcheck="false">
      <div class="cx-list wc-tab-content"></div>`;
    this.list = el.querySelector('.cx-list')!;
    this.title = el.querySelector('.cx-title')!;
    el.querySelectorAll<HTMLButtonElement>('.wc-tab').forEach((b) =>
      b.addEventListener('click', () => {
        this.tab = b.dataset.tab as Tab;
        this.render();
      }),
    );
    const search = el.querySelector<HTMLInputElement>('.cx-search')!;
    search.addEventListener('input', () => {
      this.filter = search.value.trim().toLowerCase();
      this.render();
    });
    bindLoreLinks(el, cb, () => this.hide());
    // les accordéons ne sont remplis qu'à leur ouverture
    this.list.addEventListener(
      'toggle',
      (e) => {
        const d = e.target as HTMLDetailsElement;
        const body = d.querySelector<HTMLElement>('.wc-acc-body');
        const key = d.dataset.key;
        if (d.open && body && key && !body.dataset.filled) {
          body.innerHTML = this.bodies.get(key)?.() ?? '';
          body.dataset.filled = '1';
        }
      },
      true,
    );
    el.addEventListener('pointerdown', (e) => e.stopPropagation());
    el.addEventListener('wheel', (e) => e.stopPropagation());
  }

  setWorld(world: WorldData): void {
    this.world = world;
    if (!this.el.hidden) this.render();
  }

  get visible(): boolean {
    return !this.el.hidden;
  }

  toggle(): void {
    if (this.el.hidden) this.show();
    else this.hide();
  }

  show(tab?: Tab): void {
    if (tab) this.tab = tab;
    this.el.hidden = false;
    this.render();
  }

  hide(): void {
    this.el.hidden = true;
  }

  private item(key: string, summary: string, body: () => string, icon: 'sword' | 'shield' | 'rune', tip = ''): string {
    this.bodies.set(key, body);
    const t = tip ? ` data-tip="${tip.replace(/"/g, '&quot;')}"` : '';
    return `<details class="wc-acc icon-${icon}" data-key="${key}"><summary${t}>${summary}</summary><div class="wc-acc-body"></div></details>`;
  }

  private render(): void {
    const w = this.world;
    if (!w) return;
    const pol = w.politics;
    this.title.textContent = `Chroniques — an ${pol.year}`;
    this.el.querySelectorAll<HTMLElement>('.wc-tab').forEach((b) => b.classList.toggle('active', b.dataset.tab === this.tab));
    this.bodies.clear();
    const match = (s: string) => !this.filter || s.toLowerCase().includes(this.filter);
    let html = '';
    if (this.tab === 'countries') {
      for (const c of [...pol.countries].sort((a, b) => b.pop - a.pop)) {
        if (!match(`${c.fullName} ${c.ruler.regnal}`)) continue;
        html += this.item(
          `c${c.id}`,
          `<span class="cx-emb">${armsSvg(c.arms, 20)}</span><span class="cx-name">${esc(c.name)}<small>${esc(c.ruler.title)} ${esc(c.ruler.regnal)}</small></span><span class="cx-stat">${fmtPop(c.pop)}</span>`,
          () => `${rulerBlock(w, c)}<p class="ic-text">${esc(c.history)}</p><div class="cx-more"><a data-country="${c.id}">Ouvrir la fiche et centrer la carte ›</a></div>`,
          'shield',
          `<b>${esc(c.fullName)}</b><br>Capitale : ${esc(pol.cities[c.capital].name)} · ${fmtInt(c.provinces)} provinces · ${fmtArea(c.area)}<br>Peuple : ${esc(pol.cultures[c.culture]?.name ?? '—')} · Foi : ${esc(pol.religions[c.religion]?.name ?? '—')}<br>Fondé en ${c.founded} · cliquez pour la chronique`,
        );
      }
    } else if (this.tab === 'dynasties') {
      for (const d of [...pol.dynasties].sort((a, b) => b.lineage.length - a.lineage.length)) {
        if (!match(`${d.house} ${d.name}`)) continue;
        html += this.item(
          `d${d.id}`,
          `<span class="cx-emb">${armsSvg(d.arms, 20)}</span><span class="cx-name">${esc(d.house)}<small>depuis ${d.founded} · ${d.lineage.length} souverains</small></span>`,
          () => `<div class="ic-motto">« ${esc(d.motto)} »</div><div class="ic-sub">${esc(d.arms.blazon)}</div><div class="ic-links" style="margin:6px 0">${d.countries.map((c) => aCountry(w, c)).join('')}</div>${lineageList(w, d.id, 6)}<div class="cx-more"><a data-dynasty="${d.id}">Ouvrir la fiche ›</a></div>`,
          'shield',
          `<i>« ${esc(d.motto)} »</i><br>Règne sur : ${d.countries.map((c) => esc(pol.countries[c].name)).join(', ') || '—'}<br>Fondée en ${d.founded} · ${d.lineage.length} souverains`,
        );
      }
    } else if (this.tab === 'cultures') {
      for (const g of pol.cultureGroups) {
        const items = g.cultures.map((c) => pol.cultures[c]).filter((c) => match(`${c.name} ${g.name}`)).sort((a, b) => b.pop - a.pop);
        if (!items.length) continue;
        html += `<div class="cx-group"><span class="ic-dot" style="background:${rgb(g.color)}"></span>${esc(g.name)}</div>`;
        for (const c of items) {
          html += this.item(
            `u${c.id}`,
            `<span class="ic-dot" style="background:${rgb(c.color)}"></span><span class="cx-name">${esc(c.name)}<small>${c.traits.map(esc).join(' · ') || '—'}</small></span><span class="cx-stat">${fmtPop(c.pop)}</span>`,
            () => `<div class="ic-text">Toponymes : <i>${c.sample.map(esc).join(', ')}</i></div><div class="ic-links" style="margin:6px 0">${pol.countries.filter((k) => k.culture === c.id).map((k) => aCountry(w, k.id)).join('') || '<span class="dim">Aucun État national</span>'}</div><div class="cx-more">${aCulture(w, c.id)} ›</div>`,
            'rune',
            `<b>${esc(c.name)}</b> — ${esc(g.name.toLowerCase())}<br>Foyer : ${esc(pol.cities[c.hearth].name)} · ${fmtInt(c.provinces)} provinces<br>Toponymes : <i>${c.sample.map(esc).join(', ')}</i>`,
          );
        }
      }
    } else {
      const roots = pol.religions.filter((r) => r.parent < 0 && r.provinces > 0).sort((a, b) => b.pop - a.pop);
      for (const r of roots) {
        const fam = [r, ...pol.religions.filter((x) => x.parent === r.id && x.provinces > 0)];
        for (const x of fam) {
          if (!match(`${x.name} ${x.kind}`)) continue;
          html += this.item(
            `r${x.id}`,
            `<span class="ic-sym" style="background:${rgb(x.color)}">${x.symbol}</span><span class="cx-name">${x.parent >= 0 ? '↳ ' : ''}${esc(x.name)}<small>${esc(x.kind)}</small></span><span class="cx-stat">${fmtPop(x.pop)}</span>`,
            () => `<p class="ic-text">${esc(x.description)}</p><div class="cx-more">${aReligion(w, x.id)} ›</div>`,
            'rune',
            `<b>${x.symbol} ${esc(x.name)}</b> — ${esc(x.kind)}${x.parent >= 0 ? `, confession de ${esc(pol.religions[x.parent].name)}` : ''}<br>${x.holyCity >= 0 ? `Ville sainte : ${esc(pol.cities[x.holyCity].name)} · ` : ''}${fmtInt(x.provinces)} provinces · ${fmtPop(x.pop)} fidèles`,
          );
        }
      }
    }
    this.list.innerHTML = html || '<div class="dim" style="padding:12px">Aucun résultat.</div>';
  }
}
