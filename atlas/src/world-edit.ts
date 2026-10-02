import { curvedLabel } from './gen/politics/labels';
import { officialName } from './gen/politics/names';
import { NONE16, type CountryInfo, type WorldData } from './gen/types';

/**
 * Retouches de l'éditeur sur le monde chargé : frontières (province par province), noms, couleurs,
 * forme de gouvernement et souverain des pays, noms des villes. Chaque opération est réversible
 * (pile d'annulation) et les statistiques dérivées (superficie, population, voisins, capitale,
 * étiquette) sont recalculées pour les pays touchés.
 */

export type EditOp =
  | { kind: 'owner'; provinces: number[]; from: number[]; to: number }
  | { kind: 'country'; country: number; before: CountryPatch; after: CountryPatch }
  | { kind: 'city'; city: number; before: string; after: string };

export interface CountryPatch {
  name: string;
  form: string;
  color: [number, number, number];
  rulerName: string;
  rulerTitle: string;
}

export function countryPatch(c: CountryInfo): CountryPatch {
  return { name: c.name, form: c.form, color: [...c.color] as [number, number, number], rulerName: c.ruler.name, rulerTitle: c.ruler.title };
}

/** Numéro de règne conservé (« III ») quand on change le nom du souverain. */
function regnalSuffix(regnal: string): string {
  const m = /\s([IVXLC]+)$/.exec(regnal);
  return m ? ` ${m[1]}` : '';
}

function applyCountryPatch(w: WorldData, id: number, p: CountryPatch): void {
  const c = w.politics.countries[id];
  const renamed = c.name !== p.name || c.form !== p.form;
  c.name = p.name;
  c.form = p.form;
  c.fullName = officialName(p.form, p.name);
  c.color = [...p.color] as [number, number, number];
  if (c.ruler.name !== p.rulerName) c.ruler.regnal = `${p.rulerName}${regnalSuffix(c.ruler.regnal)}`;
  c.ruler.name = p.rulerName;
  c.ruler.title = p.rulerTitle;
  const hc = w.politics.history.countries[id];
  if (hc) {
    hc.name = c.name;
    hc.fullName = c.fullName;
    hc.form = c.form;
    hc.color = c.color;
  }
  if (renamed) relabel(w, [id]);
}

/** Étiquette courbe d'un pays recalculée sur ses provinces (sa plus grande terre). */
export function relabel(w: WorldData, ids: Iterable<number>): void {
  const pol = w.politics;
  const want = new Set(ids);
  const byOwner = new Map<number, number[]>();
  for (const p of pol.provinces) {
    if (!want.has(p.country)) continue;
    const l = byOwner.get(p.country);
    if (l) l.push(p.id);
    else byOwner.set(p.country, [p.id]);
  }
  for (const id of want) {
    const list = byOwner.get(id) ?? [];
    const c = pol.countries[id];
    if (!list.length) {
      c.label = null;
      continue;
    }
    const area = new Map<number, number>();
    for (const p of list) area.set(pol.provinces[p].continent, (area.get(pol.provinces[p].continent) ?? 0) + pol.provinces[p].area);
    const main = [...area.entries()].sort((a, b) => b[1] - a[1])[0][0];
    const keep = list.filter((p) => pol.provinces[p].continent === main);
    const xs = keep.map((p) => pol.provinces[p].cx), ys = keep.map((p) => pol.provinces[p].cy), ws = keep.map((p) => pol.provinces[p].area);
    c.label = keep.length >= 3 ? curvedLabel(xs, ys, ws, xs[0], w.W, c.name.toUpperCase()) : c.label;
  }
}

/**
 * Après un changement de frontières : carte par cellule, statistiques, villes, capitales, voisins,
 * États (propriétaire majoritaire) et étiquettes des pays touchés.
 */
export function refreshOwnership(w: WorldData, touched: Set<number>): void {
  const pol = w.politics;
  const { W, H } = w;
  const N = W * H;
  for (let i = 0; i < N; i++) {
    const p = pol.province[i];
    if (p !== NONE16) pol.country[i] = pol.provinces[p].country >= 0 ? pol.provinces[p].country : NONE16;
  }
  for (const c of pol.countries) {
    c.area = 0;
    c.pop = 0;
    c.provinces = 0;
    c.cities = 0;
  }
  for (const p of pol.provinces) {
    const c = pol.countries[p.country];
    if (!c) continue;
    c.area += p.area;
    c.pop += p.pop;
    c.provinces++;
  }
  for (const city of pol.cities) {
    city.country = pol.provinces[city.province].country;
    if (city.country >= 0) pol.countries[city.country].cities++;
  }
  // capitales : un pays qui perd la sienne la transfère à sa plus grande ville
  for (const c of pol.countries) {
    const cap = pol.cities[c.capital];
    if (cap && cap.country === c.id) continue;
    if (cap) cap.capital = false;
    const best = pol.cities.filter((x) => x.country === c.id).sort((a, b) => b.pop - a.pop)[0];
    if (best) {
      best.capital = true;
      c.capital = best.id;
      touched.add(c.id);
    }
  }
  for (const city of pol.cities) city.capital = city.country >= 0 && pol.countries[city.country].capital === city.id;
  // voisins (frontières terrestres entre cellules)
  const neigh = pol.countries.map(() => new Set<number>());
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const a = pol.country[i];
      if (a === NONE16) continue;
      const r = pol.country[y * W + ((x + 1) % W)];
      if (r !== NONE16 && r !== a) {
        neigh[a].add(r);
        neigh[r].add(a);
      }
      if (y + 1 < H) {
        const d = pol.country[i + W];
        if (d !== NONE16 && d !== a) {
          neigh[a].add(d);
          neigh[d].add(a);
        }
      }
    }
  }
  pol.countries.forEach((c, i) => (c.neighbors = [...neigh[i]]));
  // États : propriétaire majoritaire (par population)
  for (const st of pol.states) {
    const m = new Map<number, number>();
    for (const p of st.provinces) m.set(pol.provinces[p].country, (m.get(pol.provinces[p].country) ?? 0) + pol.provinces[p].pop + 1);
    st.country = [...m.entries()].sort((a, b) => b[1] - a[1])[0][0];
    st.hasCapital = st.capitalCity >= 0 && pol.cities[st.capitalCity].capital;
  }
  for (const rg of pol.regions) rg.countries = [...new Set(rg.states.map((s) => pol.states[s].country))];
  relabel(w, touched);
}

export class WorldEditor {
  private undo: EditOp[] = [];
  private redo: EditOp[] = [];

  constructor(private readonly w: WorldData) {}

  get canUndo(): boolean {
    return this.undo.length > 0;
  }

  get canRedo(): boolean {
    return this.redo.length > 0;
  }

  get edits(): number {
    return this.undo.length;
  }

  /** Change le propriétaire de provinces ; renvoie les pays touchés (à rafraîchir). */
  setOwner(provinces: number[], to: number, record = true): Set<number> {
    const pol = this.w.politics;
    const list = provinces.filter((p) => pol.provinces[p] && pol.provinces[p].country !== to && pol.provinces[p].country >= 0);
    const touched = new Set<number>([to]);
    if (!list.length) return touched;
    const from = list.map((p) => pol.provinces[p].country);
    for (const p of list) {
      touched.add(pol.provinces[p].country);
      pol.provinces[p].country = to;
    }
    if (record) {
      this.undo.push({ kind: 'owner', provinces: list, from, to });
      this.redo = [];
    }
    return touched;
  }

  /** Regroupe une série d'opérations de pinceau en une seule entrée d'annulation. */
  mergeLast(n: number): void {
    if (n < 2) return;
    const ops = this.undo.splice(this.undo.length - n, n) as Extract<EditOp, { kind: 'owner' }>[];
    if (ops.some((o) => o.kind !== 'owner' || o.to !== ops[0].to)) {
      this.undo.push(...ops);
      return;
    }
    this.undo.push({ kind: 'owner', provinces: ops.flatMap((o) => o.provinces), from: ops.flatMap((o) => o.from), to: ops[0].to });
  }

  patchCountry(id: number, after: CountryPatch): void {
    const before = countryPatch(this.w.politics.countries[id]);
    applyCountryPatch(this.w, id, after);
    this.undo.push({ kind: 'country', country: id, before, after });
    this.redo = [];
  }

  renameCity(id: number, name: string): void {
    const c = this.w.politics.cities[id];
    this.undo.push({ kind: 'city', city: id, before: c.name, after: name });
    this.redo = [];
    c.name = name;
  }

  /** Annule (ou rétablit) la dernière opération ; renvoie les pays touchés. */
  step(back: boolean): Set<number> | null {
    const op = (back ? this.undo : this.redo).pop();
    if (!op) return null;
    (back ? this.redo : this.undo).push(op);
    const pol = this.w.politics;
    const touched = new Set<number>();
    if (op.kind === 'owner') {
      op.provinces.forEach((p, k) => {
        const target = back ? op.from[k] : op.to;
        touched.add(pol.provinces[p].country);
        touched.add(target);
        pol.provinces[p].country = target;
      });
    } else if (op.kind === 'country') {
      applyCountryPatch(this.w, op.country, back ? op.before : op.after);
      touched.add(op.country);
    } else {
      pol.cities[op.city].name = back ? op.before : op.after;
    }
    return touched;
  }
}
