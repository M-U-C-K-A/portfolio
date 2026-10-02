import { ownersAt } from '../gen/politics/history';
import type { HistEvent, HistKind, WorldData } from '../gen/types';

const ICON: Record<HistKind, string> = {
  guerre: '⚔', annexion: '⚔', 'indépendance': '⚑', unification: '⛬', fondation: '♔', 'héritage': '♕', mariage: '⚭', 'révolte': '✶', schisme: '✝',
};
const COLOR: Record<HistKind, string> = {
  guerre: '#e0614a', annexion: '#c2412d', 'indépendance': '#f1c95e', unification: '#79aee6', fondation: '#d8c39a', 'héritage': '#c39ae6', mariage: '#ef9fcb', 'révolte': '#f0913f', schisme: '#e8e2c6',
};
const LABEL: Record<HistKind, string> = {
  guerre: 'Guerre', annexion: 'Conquête', 'indépendance': 'Indépendance', unification: 'Unification', fondation: 'Fondation', 'héritage': 'Héritage', mariage: 'Mariage', 'révolte': 'Révolte', schisme: 'Religion',
};
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export interface TimelineCallbacks {
  /** Année affichée ; null = présent. */
  onYear(y: number | null): void;
  /** Clic sur un événement de la liste. */
  onEvent(e: HistEvent): void;
}

/**
 * Frise historique : curseur des siècles (avec les événements en repères colorés), lecture animée,
 * événements de l'époque affichée. La carte suit le curseur (frontières de l'année choisie).
 */
/** Vitesses de lecture proposées. */
const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5];
/** Durée d'une année à ×1 (ms) : trois ans par seconde. */
const BASE_TICK_MS = 333;
/** Une année sans aucun changement passe plus vite (fraction de la durée normale). */
const QUIET_TICK = 0.3;
const SPEED_KEY = 'atlas-timeline-speed';

function readSpeed(): number {
  try {
    const v = Number(localStorage.getItem(SPEED_KEY));
    return SPEEDS.includes(v) ? v : 1;
  } catch {
    return 1;
  }
}

export class Timeline {
  private world: WorldData | null = null;
  private year = 0;
  private timer = 0;
  private owners: Int32Array | null = null;
  /** vitesse de lecture choisie (×1 = rythme de référence) */
  private speed = readSpeed();
  private readonly range: HTMLInputElement;
  private readonly ticks: HTMLCanvasElement;

  constructor(private readonly root: HTMLElement, private readonly cb: TimelineCallbacks) {
    root.classList.add('fantasy', 'wc-panel');
    root.hidden = true;
    root.innerHTML = `
      <div class="tl-head">
        <button class="wc-btn tl-play" aria-label="Lecture" data-tip-title="Lecture" data-tip="Fait défiler les siècles jusqu'au présent : conquêtes, unifications et indépendances se succèdent sur la carte.">▶</button>
        <div class="tl-speed" role="group" aria-label="Vitesse de lecture" data-tip-title="Vitesse" data-tip="Vitesse de défilement des années pendant la lecture.">${SPEEDS.map((v) => `<button type="button" data-speed="${v}">×${String(v).replace('.', ',')}</button>`).join('')}</div>
        <div class="tl-year"><span class="tl-y"></span><span class="tl-sub"></span></div>
        <span class="grow"></span>
        <button class="wc-btn tl-now" data-tip="Revenir à la carte actuelle.">Présent</button>
        <button class="ic-close tl-close" aria-label="Fermer la frise">×</button>
      </div>
      <div class="tl-track">
        <canvas class="tl-ticks"></canvas>
        <input class="tl-range" type="range" step="1" aria-label="Année">
      </div>
      <div class="tl-scale"></div>
      <ol class="tl-events"></ol>`;
    const q = <T extends HTMLElement>(s: string) => root.querySelector<T>(s)!;
    this.range = q<HTMLInputElement>('.tl-range');
    this.ticks = q<HTMLCanvasElement>('.tl-ticks');
    this.range.addEventListener('input', () => {
      this.stop();
      this.setYear(Number(this.range.value));
    });
    q('.tl-play').addEventListener('click', () => (this.timer ? this.stop() : this.play()));
    root.querySelectorAll<HTMLButtonElement>('[data-speed]').forEach((b) =>
      b.addEventListener('click', () => {
        this.speed = Number(b.dataset.speed);
        try {
          localStorage.setItem(SPEED_KEY, String(this.speed));
        } catch {
          /* stockage indisponible */
        }
        this.refreshSpeed();
        // en cours de lecture : on repart au nouveau rythme
        if (this.timer) {
          this.stop();
          this.play();
        }
      }),
    );
    this.refreshSpeed();
    q('.tl-now').addEventListener('click', () => {
      this.stop();
      this.setYear(this.world!.politics.history.end);
    });
    q('.tl-close').addEventListener('click', () => this.hide());
    q('.tl-events').addEventListener('click', (e) => {
      const li = (e.target as HTMLElement).closest<HTMLElement>('[data-ev]');
      if (!li || !this.world) return;
      const ev = this.world.politics.history.events[Number(li.dataset.ev)];
      this.stop();
      this.setYear(ev.year);
      this.cb.onEvent(ev);
    });
    for (const t of ['pointerdown', 'wheel', 'dblclick']) root.addEventListener(t, (e) => e.stopPropagation());
    new ResizeObserver(() => this.drawTicks()).observe(this.ticks);
  }

  get visible(): boolean {
    return !this.root.hidden;
  }

  /** Année affichée (null : présent ou frise fermée). */
  get shown(): number | null {
    return this.visible && this.world && this.year < this.world.politics.history.end ? this.year : null;
  }

  setWorld(w: WorldData): void {
    this.stop();
    this.world = w;
    const h = w.politics.history;
    this.range.min = String(h.start);
    this.range.max = String(h.end);
    this.year = h.end;
    this.owners = null;
    const span = h.end - h.start;
    const step = span > 600 ? 200 : span > 300 ? 100 : 50;
    const marks: number[] = [];
    for (let y = Math.ceil(h.start / step) * step; y <= h.end; y += step) marks.push(y);
    this.root.querySelector('.tl-scale')!.innerHTML = marks.map((y) => `<span style="left:${((y - h.start) / span) * 100}%">${y}</span>`).join('');
    if (this.visible) this.setYear(h.end);
    this.drawTicks();
  }

  show(): void {
    if (!this.world) return;
    this.root.hidden = false;
    this.drawTicks();
    this.setYear(this.year);
  }

  hide(): void {
    this.stop();
    this.root.hidden = true;
    this.cb.onYear(null);
  }

  toggle(): void {
    if (this.visible) this.hide();
    else this.show();
  }

  setYear(y: number): void {
    const w = this.world;
    if (!w) return;
    const h = w.politics.history;
    this.year = Math.max(h.start, Math.min(h.end, Math.round(y)));
    this.range.value = String(this.year);
    this.owners = ownersAt(h, this.year, this.owners ?? undefined);
    const alive = new Set(this.owners).size;
    const now = this.year >= h.end;
    this.root.querySelector('.tl-y')!.textContent = `An ${this.year}`;
    this.root.querySelector('.tl-sub')!.textContent = now ? `Présent · ${alive} pays` : `${alive} pays · ${h.end - this.year} ans avant le présent`;
    this.root.classList.toggle('past', !now);
    this.renderEvents();
    this.cb.onYear(now ? null : this.year);
  }

  /**
   * Lecture année par année ; une année où rien ne change de mains (ni guerre, ni fondation…) passe plus
   * vite, pour que les longues paix ne fassent pas attendre les conquêtes.
   */
  private play(): void {
    const h = this.world!.politics.history;
    if (this.year >= h.end) this.setYear(h.start);
    this.root.querySelector('.tl-play')!.textContent = '❚❚';
    const busy = new Set<number>(h.changeYear);
    for (const e of h.events) if (e.kind !== 'mariage') busy.add(e.year);
    const tick = () => {
      if (this.year >= h.end) return this.stop();
      this.setYear(this.year + 1);
      const ms = (BASE_TICK_MS / this.speed) * (busy.has(this.year + 1) ? 1 : QUIET_TICK);
      this.timer = window.setTimeout(tick, ms);
    };
    this.timer = window.setTimeout(tick, BASE_TICK_MS / this.speed);
  }

  private refreshSpeed(): void {
    this.root.querySelectorAll<HTMLElement>('[data-speed]').forEach((b) => b.classList.toggle('active', Number(b.dataset.speed) === this.speed));
  }

  private stop(): void {
    if (!this.timer) return;
    clearTimeout(this.timer);
    this.timer = 0;
    this.root.querySelector('.tl-play')!.textContent = '▶';
  }

  /** Événements de l'époque : guerres en cours et faits des vingt dernières années. */
  private renderEvents(): void {
    const h = this.world!.politics.history;
    const y = this.year;
    const list: number[] = [];
    h.events.forEach((e, i) => {
      const ongoing = e.from !== undefined && e.from <= y && e.year >= y;
      if (ongoing || (e.year <= y && e.year > y - 20)) list.push(i);
    });
    const shown = list.slice(-5).reverse();
    this.root.querySelector('.tl-events')!.innerHTML = shown.length
      ? shown
          .map((i) => {
            const e = h.events[i];
            const ongoing = e.from !== undefined && e.year > y;
            const when = e.from !== undefined && e.from < e.year ? `${e.from}–${e.year}` : `${e.year}`;
            return `<li data-ev="${i}" class="${ongoing ? 'ongoing' : ''}" data-tip-title="${esc(e.title)}" data-tip="${esc(e.text)}"><span class="tl-ic" style="color:${COLOR[e.kind]}">${ICON[e.kind]}</span><span class="tl-ey">${when}</span><span class="tl-et"><b>${esc(e.title)}</b><span>${ongoing ? 'en cours' : LABEL[e.kind]}</span></span></li>`;
          })
          .join('')
      : '<li class="dim">Années de paix.</li>';
  }

  /** Repères des événements sur la piste (hauteur selon l'importance). */
  private drawTicks(): void {
    const w = this.world;
    const c = this.ticks;
    if (!w || this.root.hidden) return;
    const dpr = window.devicePixelRatio || 1;
    const W = Math.max(1, Math.round(c.clientWidth * dpr)), H = Math.max(1, Math.round(c.clientHeight * dpr));
    if (c.width !== W || c.height !== H) {
      c.width = W;
      c.height = H;
    }
    const g = c.getContext('2d')!;
    g.clearRect(0, 0, W, H);
    const h = w.politics.history;
    const span = Math.max(1, h.end - h.start);
    for (const e of h.events) {
      if (e.kind === 'mariage' || e.kind === 'révolte') continue;
      const x = ((e.year - h.start) / span) * W;
      const big = e.states.length >= 3 || e.kind === 'unification' || e.kind === 'indépendance';
      g.fillStyle = COLOR[e.kind];
      g.globalAlpha = big ? 0.95 : 0.55;
      const th = (big ? 0.85 : 0.45) * H;
      g.fillRect(Math.round(x), H - th, Math.max(1, dpr), th);
    }
    g.globalAlpha = 1;
  }
}
