import { PROVINCE_TERRAINS, type CountryInfo, type WorldData } from '../gen/types';
import { fmtArea, fmtPop } from './format';
import { armsSvg } from './heraldry';
import { rulerFaces } from './faces';
import { cityRarity, countryRarity, type Rarity } from './rarity';

export const esc = (s: string): string => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
export const rgb = (c: number[]): string => `rgb(${c[0]},${c[1]},${c[2]})`;
const pct = (x: number) => `${Math.round(x * 100)} %`;

// liens cliquables interprétés par la fiche et l'encyclopédie
export const aCountry = (w: WorldData, id: number) => {
  const c = w.politics.countries[id];
  return `<a data-country="${id}"><span class="ic-dot" style="background:${rgb(c.color)}"></span>${esc(c.name)}</a>`;
};
export const aCity = (w: WorldData, id: number) => `<a data-city="${id}">${w.politics.cities[id].capital ? '★ ' : ''}${esc(w.politics.cities[id].name)}</a>`;
export const aCulture = (w: WorldData, id: number) => `<a data-culture="${id}">${esc(w.politics.cultures[id].name)}</a>`;
export const aReligion = (w: WorldData, id: number) => {
  const r = w.politics.religions[id];
  return `<a data-religion="${id}"><span class="ic-sym" style="background:${rgb(r.color)}">${r.symbol}</span>${esc(r.name)}</a>`;
};
export const aDynasty = (w: WorldData, id: number) => `<a data-dynasty="${id}">${esc(w.politics.dynasties[id].house)}</a>`;
export const aState = (w: WorldData, id: number) => `<a data-state="${id}">${esc(w.politics.states[id].name)}</a>`;
export const aRegion = (w: WorldData, id: number) => `<a data-region="${id}">${esc(w.politics.regions[id].name)}</a>`;

export function head(color: number[], title: string, sub: string, rarity: Rarity = 'default', emblem = ''): string {
  return `<div class="ic-head">${emblem || `<span class="ic-flag" style="background:${rgb(color)}"></span>`}<div class="ic-titles"><div class="ic-title wc-title-${rarity}">${title}</div><div class="ic-sub">${sub}</div></div><button class="ic-close" data-close aria-label="Fermer">×</button></div>`;
}

export const rows = (r: [string, string][]): string => `<dl class="ic-dl">${r.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>`;

export function acc(title: string, body: string, open = false, icon: 'sword' | 'shield' | 'rune' = 'sword'): string {
  return `<details class="wc-acc icon-${icon}"${open ? ' open' : ''}><summary>${title}</summary><div class="wc-acc-body">${body}</div></details>`;
}

const bars = (items: { label: string; share: number; color: number[] }[]) =>
  `<ul class="ic-shares">${items
    .map((it) => `<li><span class="ic-pn">${it.label}</span><span class="ic-bar"><b style="width:${Math.max(3, it.share * 100)}%;background:${rgb(it.color)}"></b></span><span class="ic-pct">${pct(it.share)}</span></li>`)
    .join('')}</ul>`;

const FRAME: Record<string, string> = {
  Empire: 'human', Royaume: 'human', Sultanat: 'orc', Khanat: 'orc', Théocratie: 'undead', Principauté: 'elf', 'Grand-duché': 'elf',
};

export function avatar(w: WorldData, c: CountryInfo, size = 104): string {
  const faction = FRAME[c.form] ?? 'default';
  const face = rulerFaces(w)[c.id];
  return `<div class="wc-avatar wc-avatar-${faction}" style="width:${size}px;height:${size}px"><div class="wc-avatar-img"><img src="${face}" alt="Portrait de ${esc(c.ruler.regnal)}" draggable="false"></div><div class="wc-avatar-frame"></div></div>`;
}

export function rulerBlock(w: WorldData, c: CountryInfo): string {
  const r = c.ruler;
  return `<div class="ic-ruler">${avatar(w, c)}<div><div class="ic-rname">${esc(r.title)} ${esc(r.regnal)}</div><div class="ic-sub">${r.age} ans · né${r.female ? 'e' : ''} en ${r.born}</div><div class="ic-sub">${c.dynasty >= 0 ? `Règne depuis ${r.since}` : `${r.female ? 'Élue' : 'Élu'} en ${r.since}`}</div>${c.dynasty >= 0 ? `<div class="ic-sub">${aDynasty(w, c.dynasty)}</div>` : ''}<div style="margin-top:6px">${r.traits.map((t) => `<span class="wc-badge">${esc(t)}</span>`).join('')}</div></div></div>`;
}

export function lineageList(w: WorldData, dynId: number, max = 8): string {
  const d = w.politics.dynasties[dynId];
  const lin = d.lineage;
  const shown = lin.slice(-max);
  return `<ol class="ic-lineage">${lin.length > max ? `<li class="dim">… ${lin.length - max} souverains antérieurs</li>` : ''}${shown
    .map((e) => `<li><span class="ic-yr">${e.from}–${e.to === w.politics.year ? '' : e.to}</span><span><b>${esc(e.title)} ${esc(e.name)}</b><br><i>${esc(e.relation)}${e.fate ? ` · ${esc(e.fate)}` : ' · règne'}</i></span></li>`)
    .join('')}</ol>`;
}

export function countryView(w: WorldData, id: number): string {
  const pol = w.politics;
  const c = pol.countries[id];
  const cap = pol.cities[c.capital];
  const cul = pol.cultures[c.culture];
  const rel = pol.religions[c.religion];
  const cities = pol.cities.filter((x) => x.country === id).slice(0, 6);
  const house = c.dynasty >= 0 ? pol.dynasties[c.dynasty] : null;
  const relList = (ids: number[]) => (ids.length ? ids.map((n) => aCountry(w, n)).join('') : '<span class="dim">—</span>');
  let html = head(c.color, esc(c.name), `${esc(c.fullName)} · fondé${/Principauté|Théocratie|République|Ligue|Confédération|Union/.test(c.form) ? 'e' : ''} en ${c.founded}`, countryRarity(w, id), `<span class="ic-emblem">${armsSvg(c.arms, 34)}</span>`);
  html += rows([
    ['Capitale', aCity(w, cap.id)],
    ['Population', fmtPop(c.pop)],
    ['Superficie', fmtArea(c.area)],
    ['Culture', cul ? aCulture(w, cul.id) : '—'],
    ['Religion', rel ? aReligion(w, rel.id) : '—'],
  ]);
  html += acc('Souverain', rulerBlock(w, c), true, 'shield');
  html += house
    ? acc('Maison régnante', `<div class="ic-house">${armsSvg(house.arms, 64)}<div><div class="ic-rname">${esc(house.house)}</div><div class="ic-motto">« ${esc(house.motto)} »</div><div class="ic-sub">${esc(house.arms.blazon)}</div><div class="ic-sub">Fondée en ${house.founded} par ${esc(house.founder)}${house.countries.length > 1 ? ` · règne aussi sur ${house.countries.filter((x) => x !== id).map((x) => aCountry(w, x)).join(', ')}` : ''}</div></div></div>${house.countries[0] === id ? lineageList(w, house.id) : `<div class="ic-sub">Branche cadette de la maison, dont la lignée aînée règne sur ${aCountry(w, house.countries[0])}.</div>`}`, false, 'shield')
    : acc("Armoiries de l'État", `<div class="ic-house">${armsSvg(c.arms, 64)}<div><div class="ic-sub">${esc(c.arms.blazon)}</div><div class="ic-sub">${esc(c.form)} sans dynastie : le pouvoir est électif.</div></div></div>`, false, 'shield');
  html += acc(
    'Peuples et fois',
    `<div class="ic-sec">Cultures</div>${bars(c.cultureShares.map((s) => ({ label: aCulture(w, s.id), share: s.share, color: pol.cultures[s.id].color })))}<div class="ic-sec">Religions</div>${bars(c.religionShares.map((s) => ({ label: aReligion(w, s.id), share: s.share, color: pol.religions[s.id].color })))}`,
    false,
    'rune',
  );
  html += acc('Diplomatie', rows([['Alliés', `<div class="ic-links">${relList(c.allies)}</div>`], ['Rivaux', `<div class="ic-links">${relList(c.rivals)}</div>`], ['Union dynastique', `<div class="ic-links">${relList(c.unions)}</div>`], ['Voisins', `<div class="ic-links">${relList(c.neighbors)}</div>`]]), false, 'sword');
  html += acc('Chronique', `<p class="ic-text">${esc(c.history)}</p><ol class="ic-events">${c.events.map((e) => `<li><span class="ic-yr">${e.year}</span><span>${esc(e.text)}</span></li>`).join('')}</ol>`, false, 'rune');
  html += acc(
    'Géographie et économie',
    rows([['Densité', `${Math.round(c.pop / Math.max(1, c.area))} hab/km²`], ['Provinces', `${c.provinces}`], ['Villes principales', `${c.cities}`]]) +
      `<ul class="ic-cities">${cities.map((x) => `<li data-city="${x.id}"><span>${x.capital ? '★ ' : ''}${esc(x.name)}</span><span>${fmtPop(x.pop)}</span></li>`).join('')}</ul>`,
    false,
    'sword',
  );
  return html;
}

export function cityView(w: WorldData, id: number): string {
  const pol = w.politics;
  const c = pol.cities[id];
  const country = c.country >= 0 ? pol.countries[c.country] : null;
  const prov = pol.provinces[c.province];
  const tags = [c.capital ? 'Capitale' : 'Ville', c.port ? 'port' : '', c.river ? 'fluviale' : '', c.holyOf >= 0 ? 'ville sainte' : ''].filter(Boolean).join(' · ');
  const partners = c.partners
    .map((p) => {
      const o = pol.cities[p.id];
      const foreign = o.country !== c.country && o.country >= 0 ? ` <i>${esc(pol.countries[o.country].name)}</i>` : '';
      return `<li data-city="${o.id}"><span class="ic-pn">${o.capital ? '★ ' : ''}${esc(o.name)}${foreign}</span><span class="ic-bar"><b style="width:${Math.max(4, p.share * 220)}%"></b></span><span class="ic-pct">${pct(p.share)}</span></li>`;
    })
    .join('');
  return (
    head(country?.color ?? [150, 150, 150], `${c.capital ? '★ ' : ''}${esc(c.name)}`, `${tags}${country ? ` — <a data-country="${country.id}">${esc(country.fullName)}</a>` : ''}`, cityRarity(w, id)) +
    rows([
      ['Population', fmtPop(c.pop)],
      ['Culture', aCulture(w, c.culture)],
      ['Religion', aReligion(w, c.religion)],
      ...(c.holyOf >= 0 ? ([['Lieu saint de', aReligion(w, c.holyOf)]] as [string, string][]) : []),
      ['Province', `n° ${prov.id + 1} · ${PROVINCE_TERRAINS[prov.terrain]}`],
      ...(prov.state >= 0 ? ([['État', aState(w, prov.state)]] as [string, string][]) : []),
      ["Zone d'influence", fmtArea(c.influenceArea)],
      ['Indice commercial', `${c.trade.toFixed(0)} / 100`],
    ]) +
    `<div class="ic-sec">Principaux partenaires commerciaux</div><ul class="ic-partners">${partners || '<li class="dim">Aucune liaison</li>'}</ul>`
  );
}

export function provinceView(w: WorldData, id: number): string {
  const pol = w.politics;
  const p = pol.provinces[id];
  const country = p.country >= 0 ? pol.countries[p.country] : null;
  const city = p.city >= 0 ? pol.cities[p.city] : null;
  const cont = p.continent !== 255 ? pol.continents[p.continent] : null;
  return (
    head(country?.color ?? [150, 150, 150], `Province n° ${p.id + 1}`, country ? `<a data-country="${country.id}">${esc(country.fullName)}</a>` : 'Terre sans maître') +
    rows([
      ['Terrain', PROVINCE_TERRAINS[p.terrain]],
      ['Population', fmtPop(p.pop)],
      ['Superficie', fmtArea(p.area)],
      ['Culture', p.culture >= 0 ? aCulture(w, p.culture) : '—'],
      ['Religion', p.religion >= 0 ? aReligion(w, p.religion) : '—'],
      ['Côtière', p.coastal ? 'oui' : 'non'],
      ['Ville', city ? aCity(w, city.id) : '—'],
      ['État', p.state >= 0 ? aState(w, p.state) : '—'],
      ['Continent', cont ? esc(cont.name) : '—'],
    ])
  );
}

const CATEGORY_TEXT: Record<string, string> = {
  'Mégalopole': "l'un des plus grands foyers de population du monde",
  'Métropole': 'une grande région urbaine',
  'Grande ville': 'une région peuplée autour de villes importantes',
  Ville: 'une région de bourgs et de villes moyennes',
  Rural: 'une campagne de villages et de marchés',
  Pastoral: "une terre d'élevage, peu peuplée",
  'Terres sauvages': 'des confins presque vides',
};

export function stateView(w: WorldData, id: number, owner = w.politics.states[id].country): string {
  const pol = w.politics;
  const st = pol.states[id];
  const country = owner >= 0 ? pol.countries[owner] : null;
  const rg = pol.regions[st.region];
  const cities = pol.cities.filter((c) => pol.provinces[c.province]?.state === id).sort((a, b) => b.pop - a.pop).slice(0, 6);
  return (
    head(country?.color ?? [150, 150, 150], esc(st.name), `État · ${esc(st.category)}${country ? ` — <a data-country="${country.id}">${esc(country.fullName)}</a>` : ''}`) +
    `<p class="ic-text">${esc(st.name)} est ${CATEGORY_TEXT[st.category] ?? 'une région'}${st.hasCapital ? ', siège de la capitale' : ''}${st.coastal ? ', ouverte sur la mer' : ''}.</p>` +
    rows([
      ['Ville principale', st.capitalCity >= 0 ? aCity(w, st.capitalCity) : '—'],
      ['Population', fmtPop(st.pop)],
      ['Superficie', fmtArea(st.area)],
      ['Densité', `${Math.round(st.pop / Math.max(1, st.area))} hab/km²`],
      ['Provinces', String(st.provinces.length)],
      ['Terrain dominant', PROVINCE_TERRAINS[st.terrain]],
      ['Altitude moyenne', `${Math.round(st.height)} m`],
      ['Ressources', st.resources.length ? st.resources.map((r) => `<span class="wc-badge">${esc(r)}</span>`).join('') : '—'],
      ['Peuple', st.culture >= 0 ? aCulture(w, st.culture) : '—'],
      ['Région historique', aRegion(w, st.region)],
    ]) +
    (cities.length ? `<div class="ic-sec">Villes</div><ul class="ic-cities">${cities.map((x) => `<li data-city="${x.id}"><span>${x.capital ? '★ ' : ''}${esc(x.name)}</span><span>${fmtPop(x.pop)}</span></li>`).join('')}</ul>` : '') +
    `<div class="ic-sec">Autres États de la région</div><div class="ic-links">${rg.states.filter((s) => s !== id).slice(0, 14).map((s) => aState(w, s)).join('') || '<span class="dim">—</span>'}</div>`
  );
}

export function regionView(w: WorldData, id: number): string {
  const pol = w.politics;
  const rg = pol.regions[id];
  const byCountry = new Map<number, number>();
  for (const s of rg.states) {
    const c = pol.states[s].country;
    byCountry.set(c, (byCountry.get(c) ?? 0) + pol.states[s].area);
  }
  const shares = [...byCountry.entries()].sort((a, b) => b[1] - a[1]);
  return (
    head([180, 160, 120], esc(rg.name), `Région historique · ${esc(rg.kind)}`) +
    rows([
      ['Population', fmtPop(rg.pop)],
      ['Superficie', fmtArea(rg.area)],
      ['États', String(rg.states.length)],
      ['Peuple dominant', aCulture(w, rg.culture)],
    ]) +
    `<div class="ic-sec">Partage politique</div>${bars(shares.map(([c, a]) => ({ label: aCountry(w, c), share: a / rg.area, color: pol.countries[c].color })))}` +
    `<div class="ic-sec">États</div><div class="ic-links">${rg.states.map((s) => aState(w, s)).join('')}</div>`
  );
}

export function cultureView(w: WorldData, id: number): string {
  const pol = w.politics;
  const c = pol.cultures[id];
  const g = pol.cultureGroups[c.group];
  const where = pol.countries
    .map((k) => ({ k, s: k.cultureShares.find((x) => x.id === id)?.share ?? 0 }))
    .filter((x) => x.s > 0.02)
    .sort((a, b) => b.s * b.k.pop - a.s * a.k.pop)
    .slice(0, 8);
  const siblings = g.cultures.filter((x) => x !== id);
  return (
    head(c.color, esc(c.name), `Peuple de la ${esc(g.name.toLowerCase())}`, c.pop > 1e8 ? 'epic' : c.pop > 3e7 ? 'rare' : 'uncommon') +
    rows([
      ['Population', fmtPop(c.pop)],
      ['Aire', fmtArea(c.area)],
      ['Provinces', `${c.provinces}`],
      ['Foyer historique', aCity(w, c.hearth)],
    ]) +
    (c.traits.length ? `<div style="margin:6px 0">${c.traits.map((t) => `<span class="wc-badge">${esc(t)}</span>`).join('')}</div>` : '') +
    `<div class="ic-sec">Toponymes typiques</div><div class="ic-text"><i>${c.sample.map(esc).join(', ')}</i></div>` +
    `<div class="ic-sec">Présence</div>${bars(where.map((x) => ({ label: aCountry(w, x.k.id), share: x.s, color: x.k.color })))}` +
    (siblings.length ? `<div class="ic-sec">Peuples apparentés</div><div class="ic-links">${siblings.map((x) => aCulture(w, x)).join('')}</div>` : '')
  );
}

export function religionView(w: WorldData, id: number): string {
  const pol = w.politics;
  const r = pol.religions[id];
  const children = pol.religions.filter((x) => x.parent === id && x.provinces > 0);
  const states = pol.countries.filter((k) => k.religion === id);
  const emblem = `<span class="ic-sym ic-sym-lg" style="background:${rgb(r.color)}">${r.symbol}</span>`;
  return (
    head(r.color, esc(r.name), `${esc(r.kind)}${r.parent >= 0 ? ` · confession ${esc(pol.religions[r.parent].name)}` : ''}`, r.folk ? 'uncommon' : r.parent >= 0 ? 'rare' : 'legendary', emblem) +
    rows([
      ['Fidèles', fmtPop(r.pop)],
      ['Provinces', `${r.provinces}`],
      ['Fondation', r.founded > 0 ? `an ${r.founded}` : 'temps immémoriaux'],
      ...(r.holyCity >= 0 ? ([['Ville sainte', aCity(w, r.holyCity)]] as [string, string][]) : []),
      ...(r.parent >= 0 ? ([['Religion mère', aReligion(w, r.parent)]] as [string, string][]) : []),
      ['Clergé', esc(r.clergy)],
      ['Lieux de culte', esc(r.temples)],
    ]) +
    `<div style="margin:6px 0">${r.tenets.map((t) => `<span class="wc-badge">${esc(t)}</span>`).join('')}</div>` +
    `<p class="ic-text">${esc(r.description)}</p>` +
    (children.length ? `<div class="ic-sec">Confessions</div><div class="ic-links">${children.map((x) => aReligion(w, x.id)).join('')}</div>` : '') +
    (states.length ? `<div class="ic-sec">Religion d'État de</div><div class="ic-links">${states.map((k) => aCountry(w, k.id)).join('')}</div>` : '')
  );
}

export function dynastyView(w: WorldData, id: number): string {
  const pol = w.politics;
  const d = pol.dynasties[id];
  const seat = pol.countries[d.countries[0]];
  return (
    head(seat.color, esc(d.house), `Dynastie ${esc(pol.cultures[d.culture]?.adjF ?? '')} · fondée en ${d.founded}`, d.lineage.length > 15 ? 'legendary' : 'epic', `<span class="ic-emblem">${armsSvg(d.arms, 34)}</span>`) +
    `<div class="ic-house">${armsSvg(d.arms, 72)}<div><div class="ic-motto">« ${esc(d.motto)} »</div><div class="ic-sub">${esc(d.arms.blazon)}</div><div class="ic-sub">Fondateur : ${esc(d.founder)}</div><div class="ic-links" style="margin-top:4px">${d.countries.map((c) => aCountry(w, c)).join('')}</div></div></div>` +
    `<div class="ic-sec">Lignée (${d.lineage.length} souverains)</div>${lineageList(w, id, 14)}`
  );
}

/** Pays tel qu'il était à l'année `year` de la frise (pays actuel ou disparu). */
export function histCountryView(w: WorldData, id: number, year: number): string {
  const pol = w.politics;
  const h = pol.history;
  const c = h.countries[id];
  const evs = h.events.filter((e) => e.countries.includes(id)).slice(-14);
  const since = c.founded <= h.start ? 'des origines' : `${c.founded}`;
  return (
    head(c.color, esc(c.name), `${esc(c.fullName)} · en ${year}`, 'default', `<span class="ic-emblem">${armsSvg(c.arms, 34)}</span>`) +
    rows([
      ['Existence', c.ended === null ? `${since} à nos jours` : `${since} – ${c.ended}`],
      ['Destin', c.fate ? esc(c.fate) : c.present ? 'existe toujours' : '—'],
      ['Peuple', c.culture >= 0 ? aCulture(w, c.culture) : '—'],
      ['Religion', c.religion >= 0 ? aReligion(w, c.religion) : '—'],
      ['Capitale', c.capitalState >= 0 ? aState(w, c.capitalState) : '—'],
      ...(c.present ? ([["Aujourd'hui", aCountry(w, id)]] as [string, string][]) : []),
    ]) +
    `<div class="ic-sec">Événements</div><ol class="ic-events">${evs.map((e) => `<li><span class="ic-yr">${e.year}</span><span><b>${esc(e.title)}</b> — ${esc(e.text)}</span></li>`).join('') || '<li class="dim">—</li>'}</ol>`
  );
}
