import { PROVINCE_TERRAINS, type WorldData } from '../gen/types';
import { fmtArea, fmtInt, fmtPop } from './format';
import { armsSvg } from './heraldry';

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const rgb = (c: number[]) => `rgb(${c.join(',')})`;

/**
 * Chroniques du monde en un document HTML autonome (s'ouvre dans n'importe quel navigateur, s'imprime
 * en PDF) : pays et souverains, dynasties et lignées, peuples, religions, grandes villes.
 * `maps` : images à insérer en tête (chemin relatif dans l'archive ou data URL).
 */
export function chronicleHtml(w: WorldData, maps: { title: string; src: string }[] = []): string {
  const pol = w.politics;
  const s = w.stats;
  const city = (id: number) => (id >= 0 ? esc(pol.cities[id].name) : '—');
  const country = (id: number) => `<a href="#pays-${id}">${esc(pol.countries[id].name)}</a>`;
  const countries = [...pol.countries].sort((a, b) => b.pop - a.pop);
  const dynasties = [...pol.dynasties].sort((a, b) => b.lineage.length - a.lineage.length);

  const countryHtml = countries.map((c) => {
    const ruler = c.ruler;
    const dyn = c.dynasty >= 0 ? pol.dynasties[c.dynasty] : null;
    const shares = (list: { id: number; share: number }[], name: (id: number) => string) =>
      list.slice(0, 4).map((x) => `${name(x.id)} ${Math.round(x.share * 100)} %`).join(', ');
    return `<section class="entry" id="pays-${c.id}">
  <header><span class="arms">${armsSvg(c.arms, 46)}</span><div><h3 style="--c:${rgb(c.color)}">${esc(c.name)}</h3><div class="sub">${esc(c.fullName)} · fondé en ${c.founded}</div></div></header>
  <dl>
    <dt>Capitale</dt><dd>${city(c.capital)}</dd>
    <dt>Population</dt><dd>${fmtPop(c.pop)} · ${fmtArea(c.area)} · ${fmtInt(c.provinces)} provinces · ${c.cities} villes</dd>
    <dt>Souverain</dt><dd>${esc(ruler.title)} ${esc(ruler.regnal)}, ${ruler.age} ans, règne depuis ${ruler.since}${ruler.traits.length ? ` — ${ruler.traits.map(esc).join(', ')}` : ''}</dd>
    ${dyn ? `<dt>Maison</dt><dd><a href="#dyn-${dyn.id}">${esc(dyn.house)}</a></dd>` : ''}
    <dt>Peuples</dt><dd>${shares(c.cultureShares, (id) => esc(pol.cultures[id].name))}</dd>
    <dt>Religions</dt><dd>${shares(c.religionShares, (id) => esc(pol.religions[id].name))}</dd>
    ${c.allies.length ? `<dt>Alliés</dt><dd>${c.allies.map(country).join(', ')}</dd>` : ''}
    ${c.rivals.length ? `<dt>Rivaux</dt><dd>${c.rivals.map(country).join(', ')}</dd>` : ''}
    ${c.neighbors.length ? `<dt>Voisins</dt><dd>${c.neighbors.map(country).join(', ')}</dd>` : ''}
  </dl>
  <p class="story">${esc(c.history)}</p>
  ${c.events.length ? `<ol class="events">${c.events.map((e) => `<li><b>${e.year}</b> ${esc(e.text)}</li>`).join('')}</ol>` : ''}
</section>`;
  }).join('\n');

  const dynHtml = dynasties.map((d) => `<section class="entry" id="dyn-${d.id}">
  <header><span class="arms">${armsSvg(d.arms, 46)}</span><div><h3>${esc(d.house)}</h3><div class="sub">fondée en ${d.founded} par ${esc(d.founder)} · <i>« ${esc(d.motto)} »</i></div></div></header>
  <p class="blazon">${esc(d.arms.blazon)}</p>
  <p>Règne sur : ${d.countries.map(country).join(', ') || '—'}</p>
  <table><thead><tr><th>Souverain</th><th>Titre</th><th>Règne</th><th>Lien</th><th>Fin</th></tr></thead><tbody>
  ${d.lineage.map((l) => `<tr><td>${esc(l.name)}</td><td>${esc(l.title)}</td><td>${l.from}–${l.to > 0 ? l.to : ''}</td><td>${esc(l.relation)}</td><td>${esc(l.fate)}</td></tr>`).join('')}
  </tbody></table>
</section>`).join('\n');

  const cultHtml = pol.cultureGroups.map((g) => `<h3 class="group" style="--c:${rgb(g.color)}">${esc(g.name)}</h3>
${g.cultures.map((id) => pol.cultures[id]).sort((a, b) => b.pop - a.pop).map((c) => `<section class="entry small">
  <h4 style="--c:${rgb(c.color)}">${esc(c.name)}</h4>
  <p>${fmtPop(c.pop)} · ${fmtInt(c.provinces)} provinces · foyer : ${city(c.hearth)}${c.traits.length ? ` · ${c.traits.map(esc).join(', ')}` : ''}</p>
  <p class="dim">Toponymes : <i>${c.sample.map(esc).join(', ')}</i></p>
</section>`).join('\n')}`).join('\n');

  const relHtml = pol.religions.filter((r) => r.provinces > 0).sort((a, b) => b.pop - a.pop).map((r) => `<section class="entry small">
  <h4 style="--c:${rgb(r.color)}">${r.symbol} ${esc(r.name)}</h4>
  <p>${esc(r.kind)}${r.parent >= 0 ? `, confession issue de ${esc(pol.religions[r.parent].name)}` : ''} · ${fmtPop(r.pop)} fidèles${r.holyCity >= 0 ? ` · ville sainte : ${city(r.holyCity)}` : ''}${r.founded ? ` · fondée en ${r.founded}${r.founder ? ` par ${esc(r.founder)}` : ''}` : ''}</p>
  <p class="story">${esc(r.description)}</p>
  ${r.tenets.length ? `<p class="dim">Préceptes : ${r.tenets.map(esc).join(' · ')}</p>` : ''}
  <p class="dim">${[r.deity && `Divinité : ${esc(r.deity)}`, r.clergy && `Clergé : ${esc(r.clergy)}`, r.temples && `Lieux de culte : ${esc(r.temples)}`, r.scripture && `Texte sacré : ${esc(r.scripture)}`].filter(Boolean).join(' · ')}</p>
</section>`).join('\n');

  const cities = [...pol.cities].sort((a, b) => b.pop - a.pop).slice(0, 60);
  const cityHtml = `<table><thead><tr><th>Ville</th><th>Pays</th><th>Habitants</th><th>Peuple</th><th>Religion</th><th>Premiers partenaires</th></tr></thead><tbody>
${cities.map((c) => `<tr><td>${c.capital ? '★ ' : ''}${esc(c.name)}${c.port ? ' ⚓' : ''}</td><td>${c.country >= 0 ? country(c.country) : '—'}</td><td>${fmtPop(c.pop)}</td><td>${esc(pol.cultures[c.culture]?.name ?? '—')}</td><td>${esc(pol.religions[c.religion]?.name ?? '—')}</td><td>${c.partners.slice(0, 3).map((p) => esc(pol.cities[p.id].name)).join(', ')}</td></tr>`).join('\n')}
</tbody></table>`;

  const terrains = new Array(PROVINCE_TERRAINS.length).fill(0);
  for (const p of pol.provinces) terrains[p.terrain]++;

  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Chroniques de ${esc(w.settings.seed)} — an ${pol.year}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700&family=EB+Garamond:ital@0;1&display=swap" rel="stylesheet">
<style>
  body { margin: 0; background: #2a2018; color: #2b2116; font: 17px/1.55 'EB Garamond', Georgia, serif; }
  main { max-width: 980px; margin: 0 auto; padding: 40px 48px 80px; background: #efe3c6 linear-gradient(180deg, #f3e9d0, #e8d9b6); box-shadow: 0 0 60px rgba(0,0,0,.6); }
  h1, h2, h3, h4 { font-family: Cinzel, Georgia, serif; color: #5a3a14; }
  h1 { font-size: 46px; text-align: center; margin: 0; letter-spacing: .08em; }
  .lead { text-align: center; color: #6b5536; margin: 4px 0 24px; }
  h2 { border-bottom: 2px solid #b98a3a; padding-bottom: 4px; margin-top: 48px; }
  h3 { margin: 0; border-left: 6px solid var(--c, #b98a3a); padding-left: 8px; }
  h3.group { margin: 28px 0 8px; }
  h4 { margin: 0 0 2px; border-left: 4px solid var(--c, #b98a3a); padding-left: 6px; }
  nav ul { columns: 3; list-style: none; padding: 0; } nav a, a { color: #7a3b14; text-decoration: none; } a:hover { text-decoration: underline; }
  .entry { margin: 22px 0; padding: 14px 18px; background: rgba(255,255,255,.35); border: 1px solid rgba(120,90,40,.3); border-radius: 4px; break-inside: avoid; }
  .entry.small { padding: 8px 14px; margin: 10px 0; }
  .entry header { display: flex; gap: 14px; align-items: center; }
  .sub, .dim { color: #6b5536; font-size: 15px; }
  dl { display: grid; grid-template-columns: max-content 1fr; gap: 2px 14px; margin: 10px 0; font-size: 15.5px; }
  dt { color: #7a5a2a; font-variant: small-caps; } dd { margin: 0; }
  .story { font-style: italic; }
  .blazon { font-style: italic; color: #6b5536; }
  .events { font-size: 15px; padding-left: 20px; } .events b { color: #7a3b14; margin-right: 6px; }
  table { width: 100%; border-collapse: collapse; font-size: 15px; margin: 8px 0; }
  th { text-align: left; font-family: Cinzel, serif; font-size: 13px; color: #7a5a2a; border-bottom: 1px solid #b98a3a; }
  td { border-bottom: 1px solid rgba(120,90,40,.2); padding: 2px 6px 2px 0; }
  figure { margin: 18px 0; } figure img { width: 100%; border: 1px solid #8a6a2c; box-shadow: 0 4px 16px rgba(0,0,0,.35); } figcaption { text-align: center; font-family: Cinzel, serif; color: #6b5536; }
  @media print { body { background: none; } main { box-shadow: none; } }
</style></head>
<body><main>
<h1>${esc(w.settings.seed)}</h1>
<p class="lead">Chroniques du monde en l'an ${pol.year} · ${pol.countries.length} pays · ${fmtPop(pol.totalPop)} d'habitants</p>
${maps.map((m) => `<figure><img src="${m.src}" alt="${esc(m.title)}"><figcaption>${esc(m.title)}</figcaption></figure>`).join('\n')}
<nav><h2>Sommaire</h2><ul>
<li><a href="#monde">Le monde</a></li><li><a href="#pays">Pays et souverains</a></li><li><a href="#dynasties">Dynasties</a></li>
<li><a href="#peuples">Peuples</a></li><li><a href="#religions">Religions</a></li><li><a href="#villes">Grandes villes</a></li>
<li><a href="#frise">Grandes dates</a></li><li><a href="#etats">États et régions</a></li>
</ul></nav>
<h2 id="monde">Le monde</h2>
<dl>
  <dt>Grille</dt><dd>${w.W} × ${w.H} cellules (graine « ${esc(w.settings.seed)} »)</dd>
  <dt>Terres émergées</dt><dd>${s.landPct.toFixed(1)} % de la surface</dd>
  <dt>Point culminant</dt><dd>${fmtInt(s.maxElevation)} m · fosse la plus profonde ${fmtInt(s.minElevation)} m</dd>
  <dt>Hydrographie</dt><dd>${fmtInt(s.riverCount)} fleuves tracés, ${fmtInt(s.lakeCount)} lacs</dd>
  <dt>Continents</dt><dd>${pol.continents.filter((c) => c.kind !== 'archipel').map((c) => `${esc(c.name)} (${fmtArea(c.landArea)})`).join(', ')}</dd>
  <dt>Provinces</dt><dd>${fmtInt(pol.provinces.length)} — ${PROVINCE_TERRAINS.map((t, i) => (terrains[i] ? `${t.toLowerCase()} ${terrains[i]}` : '')).filter(Boolean).join(', ')}</dd>
</dl>
<h2 id="pays">Pays et souverains</h2>
${countryHtml}
<h2 id="dynasties">Dynasties</h2>
${dynHtml}
<h2 id="peuples">Peuples</h2>
${cultHtml}
<h2 id="religions">Religions</h2>
${relHtml}
<h2 id="villes">Grandes villes</h2>
${cityHtml}
<h2 id="frise">Grandes dates (${pol.history.start}–${pol.history.end})</h2>
<p>De ${new Set(pol.history.initial).size} principautés et royaumes aux ${pol.countries.length} pays d'aujourd'hui : unifications, indépendances, grandes conquêtes et schismes.</p>
<table><tr><th>Année</th><th>Événement</th></tr>
${pol.history.events
  .filter((e) => e.kind === 'unification' || e.kind === 'indépendance' || e.kind === 'schisme' || e.kind === 'héritage' || ((e.kind === 'guerre' || e.kind === 'annexion') && e.states.length >= 2))
  .map((e) => `<tr><td>${e.from !== undefined && e.from < e.year ? `${e.from}–${e.year}` : e.year}</td><td><b>${esc(e.title)}</b> — ${esc(e.text)}</td></tr>`)
  .join('\n')}
</table>
<h2 id="etats">États et régions historiques</h2>
${pol.regions
  .slice()
  .sort((a, b) => b.pop - a.pop)
  .map((r) => `<section class="entry small"><h3>${esc(r.name)}</h3><p><i>${esc(r.kind)}</i> · ${fmtPop(r.pop)} · ${fmtArea(r.area)} — ${r.states.map((id) => `${esc(pol.states[id].name)} <small>(${esc(pol.countries[pol.states[id].country]?.name ?? '—')}, ${esc(pol.states[id].category.toLowerCase())})</small>`).join(', ')}</p></section>`)
  .join('\n')}
</main></body></html>`;
}

/** Données du monde (sans les grilles par cellule) pour d'autres outils : pays, villes, provinces, lore, commerce. */
export function worldJson(w: WorldData): string {
  const pol = w.politics;
  const strip = <T extends object>(o: T) => {
    const { label: _label, ...rest } = o as T & { label?: unknown };
    return rest;
  };
  const data = {
    format: 'atlas-monde-1',
    seed: w.settings.seed,
    settings: w.settings,
    year: pol.year,
    grid: { width: w.W, height: w.H, latMax: w.latMax },
    stats: w.stats,
    totalPop: pol.totalPop,
    continents: pol.continents.map(strip),
    countries: pol.countries.map(strip),
    cities: pol.cities,
    provinces: pol.provinces,
    cultureGroups: pol.cultureGroups,
    cultures: pol.cultures.map(strip),
    religions: pol.religions.map(strip),
    dynasties: pol.dynasties,
    states: pol.states.map(strip),
    regions: pol.regions.map(strip),
    history: {
      start: pol.history.start,
      end: pol.history.end,
      countries: pol.history.countries,
      initialOwners: Array.from(pol.history.initial),
      transfers: Array.from(pol.history.changeYear, (year, k) => ({ year, state: pol.history.changeState[k], from: pol.history.changeFrom[k], to: pol.history.changeTo[k] })),
      events: pol.history.events,
    },
    trade: Array.from(pol.linkA, (a, i) => ({ a, b: pol.linkB[i], maritime: pol.linkKind[i] === 1, volume: pol.linkVolume[i] })),
  };
  return JSON.stringify(data, null, 1);
}
