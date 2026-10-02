import { MAP_MODES, type MapMode } from '../render/modes';
import { makeZip } from './zip';

export interface ExportOptions {
  maps: MapMode[];
  /** `screen` : 2× la carte (≤ 8 192 px) ; `12k` : 12 288 px de large. */
  size: 'screen' | '12k';
  chronicle: boolean;
  data: boolean;
  zip: boolean;
}

/**
 * Où écrire l'export : fichier ZIP ou dossier choisis par l'utilisateur (Chrome, Edge — écriture directe
 * sur le disque, sans limite de téléchargements), sinon téléchargements classiques.
 */
export type ExportTarget =
  | { kind: 'download' }
  | { kind: 'zipfile'; handle: FileSystemFileHandle }
  | { kind: 'dir'; handle: FileSystemDirectoryHandle };

export interface ExportedFile {
  name: string;
  blob: Blob;
}

type PickerWindow = Window & {
  showSaveFilePicker?: (o: { suggestedName?: string; id?: string; types?: { description: string; accept: Record<string, string[]> }[] }) => Promise<FileSystemFileHandle>;
  showDirectoryPicker?: (o?: { mode?: 'read' | 'readwrite'; id?: string }) => Promise<FileSystemDirectoryHandle>;
};

const fmtSize = (b: number) => (b > 1e6 ? `${(b / 1e6).toFixed(b > 1e7 ? 0 : 1)} Mo` : `${Math.max(1, Math.round(b / 1e3))} Ko`);
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);

/** Pop-in d'export : cartes au choix (tous les modes), chroniques illustrées, données, archive ZIP. */
export class Exporter {
  private readonly o: ExportOptions = { maps: ['political', 'terrain', 'trade'], size: 'screen', chronicle: true, data: false, zip: true };
  /** liens des fichiers prêts (à libérer) */
  private urls: string[] = [];
  private files: ExportedFile[] = [];
  /** taille estimée de l'export (octets) */
  private estBytes = 0;

  constructor(
    private readonly root: HTMLElement,
    private readonly run: (o: ExportOptions, target: ExportTarget) => Promise<void>,
    private readonly info: () => { W: number; base: string },
  ) {
    root.innerHTML = `<div class="modal fantasy wc-card ex-form" role="dialog" aria-label="Exporter le monde">
      <div class="modal-head"><div><div class="modal-title">Exporter</div><div class="modal-sub">Cartes, chroniques et données du monde</div></div><button class="ic-close" aria-label="Fermer">×</button></div>
      <div class="modal-body wc-tab-content">
        <div class="modal-section"><h3>Cartes <span class="ex-all"><a data-all="1">tout</a> · <a data-all="0">rien</a></span></h3>
          <div class="ex-maps">${MAP_MODES.map((m) => `<label class="check" data-tip="${m.tip}"><input class="wc-checkbox" type="checkbox" data-mode="${m.id}"> ${m.label}</label>`).join('')}</div>
          <div class="row"><div class="head"><label>Définition</label></div>
            <select class="wc-input ex-size" data-tip="Le 12K grave chaque carte en 12 288 px de large (quelques secondes et ~80 Mo par carte).">
              <option value="screen">Standard — 2× la carte (8 192 px au plus)</option><option value="12k">12K — 12 288 px de large (lent, lourd)</option>
            </select></div>
        </div>
        <div class="modal-section"><h3>Documents</h3>
          <label class="check" data-tip="Toute l'histoire du monde dans une page illustrée : pays, souverains et événements, dynasties et lignées, peuples, religions, grandes villes. S'ouvre dans un navigateur, s'imprime en PDF."><input class="wc-checkbox" type="checkbox" data-doc="chronicle"> Chroniques (HTML illustré)</label>
          <label class="check" data-tip="Pays, villes, provinces, peuples, religions, dynasties et liaisons commerciales au format JSON, pour d'autres outils."><input class="wc-checkbox" type="checkbox" data-doc="data"> Données du monde (JSON)</label>
          <h3>Format</h3>
          <label class="check"><input class="wc-checkbox" type="radio" name="ex-fmt" value="zip"> Archive ZIP (un seul fichier)</label>
          <label class="check"><input class="wc-checkbox" type="radio" name="ex-fmt" value="files"> Fichiers séparés</label>
          <p class="hint ex-est"></p>
        </div>
      </div>
      <div class="modal-foot">
        <button class="wc-btn ex-everything" data-tip="Toutes les cartes, les chroniques et les données, en définition standard, dans une archive ZIP.">Tout exporter</button>
        <span class="grow"></span>
        <button class="wc-btn wc-btn-frame ex-go">Exporter la sélection</button>
      </div>
    </div>
    <div class="modal fantasy wc-card ex-ready" role="dialog" aria-label="Fichiers exportés" hidden>
      <div class="modal-head"><div><div class="modal-title">Fichiers prêts</div><div class="modal-sub">Cliquez sur chaque fichier pour l'enregistrer</div></div><button class="ic-close" aria-label="Fermer">×</button></div>
      <div class="modal-body wc-tab-content">
        <p class="hint">Le navigateur n'autorise qu'un téléchargement automatique à la fois : récupérez les fichiers un par un, ou tous ensemble dans une archive.</p>
        <div class="ex-list"></div>
      </div>
      <div class="modal-foot">
        <button class="wc-btn ex-back">Retour</button>
        <span class="grow"></span>
        <button class="wc-btn wc-btn-frame ex-zipall">Tout dans une archive ZIP</button>
      </div>
    </div>`;
    const q = <T extends HTMLElement>(s: string) => root.querySelector<T>(s)!;
    root.querySelectorAll<HTMLInputElement>('[data-mode]').forEach((c) =>
      c.addEventListener('change', () => {
        const m = c.dataset.mode as MapMode;
        this.o.maps = c.checked ? [...new Set([...this.o.maps, m])] : this.o.maps.filter((x) => x !== m);
        this.refresh();
      }),
    );
    root.querySelectorAll<HTMLAnchorElement>('[data-all]').forEach((a) =>
      a.addEventListener('click', () => {
        this.o.maps = a.dataset.all === '1' ? MAP_MODES.map((m) => m.id) : [];
        this.refresh();
      }),
    );
    q<HTMLSelectElement>('.ex-size').addEventListener('change', (e) => {
      this.o.size = (e.target as HTMLSelectElement).value as ExportOptions['size'];
      this.refresh();
    });
    root.querySelectorAll<HTMLInputElement>('[data-doc]').forEach((c) =>
      c.addEventListener('change', () => {
        if (c.dataset.doc === 'chronicle') this.o.chronicle = c.checked;
        else this.o.data = c.checked;
        this.refresh();
      }),
    );
    root.querySelectorAll<HTMLInputElement>('[name=ex-fmt]').forEach((r) =>
      r.addEventListener('change', () => {
        this.o.zip = r.value === 'zip';
        this.refresh();
      }),
    );
    root.querySelectorAll('.ic-close').forEach((b) => b.addEventListener('click', () => this.hide()));
    q('.ex-go').addEventListener('click', () => void this.go());
    q('.ex-back').addEventListener('click', () => this.view('form'));
    q('.ex-zipall').addEventListener('click', async (e) => {
      const b = e.currentTarget as HTMLButtonElement;
      b.disabled = true;
      b.textContent = 'Archive en cours…';
      try {
        const base = this.info().base;
        const zip = await makeZip(this.files.map((f) => ({ name: `${base}/${f.name}`, blob: f.blob })));
        const a = document.createElement('a');
        a.href = this.link(zip);
        a.download = `${base}.zip`;
        a.click();
      } finally {
        b.disabled = false;
        b.textContent = 'Tout dans une archive ZIP';
      }
    });
    q('.ex-everything').addEventListener('click', () => {
      Object.assign(this.o, { maps: MAP_MODES.map((m) => m.id), size: 'screen', chronicle: true, data: true, zip: true });
      this.refresh();
      void this.go();
    });
    root.addEventListener('pointerdown', (e) => {
      if (e.target === root) this.hide();
      e.stopPropagation();
    });
    root.addEventListener('wheel', (e) => e.stopPropagation());
    this.refresh();
  }

  get visible(): boolean {
    return !this.root.hidden;
  }

  show(): void {
    this.view('form');
    this.root.hidden = false;
    this.refresh();
  }

  hide(): void {
    this.root.hidden = true;
  }

  private view(v: 'form' | 'ready'): void {
    this.root.querySelector<HTMLElement>('.ex-form')!.hidden = v !== 'form';
    this.root.querySelector<HTMLElement>('.ex-ready')!.hidden = v !== 'ready';
  }

  private link(b: Blob): string {
    const u = URL.createObjectURL(b);
    this.urls.push(u);
    return u;
  }

  /** Liste de liens de téléchargement (repli quand le navigateur bloque les téléchargements multiples). */
  showFiles(files: ExportedFile[]): void {
    for (const u of this.urls) URL.revokeObjectURL(u);
    this.urls = [];
    this.files = files;
    const base = this.info().base;
    this.root.querySelector('.ex-list')!.innerHTML = files
      .map((f) => {
        const name = `${base}-${f.name.replace(/^cartes\//, '')}`;
        return `<a class="ex-file" href="${this.link(f.blob)}" download="${esc(name)}"><span>⤓ ${esc(name)}</span><small>${fmtSize(f.blob.size)}</small></a>`;
      })
      .join('');
    this.view('ready');
    this.root.hidden = false;
  }

  /**
   * Lance l'export. La destination est demandée tout de suite, pendant le clic : les sélecteurs de fichier
   * du navigateur exigent un geste de l'utilisateur, qui serait expiré après plusieurs secondes de rendu.
   */
  private async go(): Promise<void> {
    if (!this.o.maps.length && !this.o.chronicle && !this.o.data) return;
    const w = window as PickerWindow;
    const base = this.info().base;
    let target: ExportTarget = { kind: 'download' };
    // l'écriture directe passe par le quota de stockage du site (Chrome, Arc) : inutile de proposer le
    // sélecteur s'il ne reste pas la place, le téléchargement classique n'a pas cette limite
    let roomy = true;
    try {
      const e = await navigator.storage?.estimate?.();
      if (e?.quota !== undefined && e.usage !== undefined) roomy = e.quota - e.usage > this.estBytes * 1.3 + 50e6;
    } catch {
      /* estimation indisponible */
    }
    try {
      if (!roomy) {
        /* téléchargement classique */
      } else if (this.o.zip && w.showSaveFilePicker) {
        target = { kind: 'zipfile', handle: await w.showSaveFilePicker({ suggestedName: `${base}.zip`, id: 'atlas-export', types: [{ description: 'Archive ZIP', accept: { 'application/zip': ['.zip'] } }] }) };
      } else if (!this.o.zip && w.showDirectoryPicker) {
        target = { kind: 'dir', handle: await w.showDirectoryPicker({ mode: 'readwrite', id: 'atlas-export' }) };
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return; // sélecteur fermé : on reste sur la pop-in
      target = { kind: 'download' }; // sélecteur indisponible (iframe, navigateur) : téléchargements classiques
    }
    this.hide();
    void this.run({ ...this.o, maps: MAP_MODES.map((m) => m.id).filter((m) => this.o.maps.includes(m)) }, target);
  }

  private refresh(): void {
    const r = this.root;
    r.querySelectorAll<HTMLInputElement>('[data-mode]').forEach((c) => (c.checked = this.o.maps.includes(c.dataset.mode as MapMode)));
    r.querySelector<HTMLSelectElement>('.ex-size')!.value = this.o.size;
    r.querySelector<HTMLInputElement>('[data-doc=chronicle]')!.checked = this.o.chronicle;
    r.querySelector<HTMLInputElement>('[data-doc=data]')!.checked = this.o.data;
    r.querySelectorAll<HTMLInputElement>('[name=ex-fmt]').forEach((x) => (x.checked = (x.value === 'zip') === this.o.zip));
    // estimation grossière de la taille (PNG ~ 1,4 octet par pixel)
    const W = this.info().W;
    const w = this.o.size === '12k' ? 12288 : Math.round(W * Math.min(2, 8192 / Math.max(1, W)));
    const mb = this.o.maps.length * (w * w * 0.4 * 1.4) / 1e6 + (this.o.chronicle ? 1 : 0) + (this.o.data ? 2 : 0);
    const n = this.o.maps.length + Number(this.o.chronicle) + Number(this.o.data);
    this.estBytes = mb * 1e6;
    const w0 = window as PickerWindow;
    const dest = this.o.zip
      ? w0.showSaveFilePicker ? 'vous choisirez où enregistrer l\'archive' : 'une seule archive téléchargée'
      : w0.showDirectoryPicker ? 'vous choisirez un dossier ; un sous-dossier y sera créé' : 'une liste de fichiers à télécharger';
    r.querySelector('.ex-est')!.textContent = n ? `${n} fichier${n > 1 ? 's' : ''} · environ ${mb < 10 ? mb.toFixed(1) : Math.round(mb)} Mo — ${dest}` : 'Rien de sélectionné.';
  }
}
