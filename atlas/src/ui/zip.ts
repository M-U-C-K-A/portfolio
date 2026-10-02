/**
 * Archive ZIP minimale (fichiers « stockés », sans compression : les PNG le sont déjà) avec CRC-32.
 * Écriture en flux : chaque fichier est envoyé dès qu'il est prêt, soit directement sur le disque
 * (fichier choisi avec showSaveFilePicker), soit dans une liste de morceaux de Blob — les images ne sont
 * jamais recopiées en mémoire JavaScript, ce qui permet des archives de plusieurs centaines de Mo.
 */
const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

/** CRC-32 d'un Blob, lu par morceaux. */
async function crc32(b: Blob): Promise<number> {
  let c = 0xffffffff;
  const reader = b.stream().getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    for (let i = 0; i < value.length; i++) c = CRC[(c ^ value[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

export type ZipPart = Blob | Uint8Array<ArrayBuffer>;

export class ZipWriter {
  private readonly enc = new TextEncoder();
  private readonly central: Uint8Array<ArrayBuffer>[] = [];
  private offset = 0;
  private readonly dosTime: number;
  private readonly dosDate: number;

  constructor(private readonly write: (part: ZipPart) => Promise<void>) {
    const now = new Date();
    this.dosTime = ((now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1)) & 0xffff;
    this.dosDate = (((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate()) & 0xffff;
  }

  async add(path: string, data: Blob): Promise<void> {
    const name = this.enc.encode(path);
    const size = data.size;
    if (this.offset + 30 + name.length + size > 0xffffffff) throw new Error('archive de plus de 4 Go : choisissez « Fichiers séparés »');
    const crc = await crc32(data);
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true);
    local.setUint16(6, 0x0800, true); // noms en UTF-8
    local.setUint16(8, 0, true); // stocké
    local.setUint16(10, this.dosTime, true);
    local.setUint16(12, this.dosDate, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, size, true);
    local.setUint32(22, size, true);
    local.setUint16(26, name.length, true);
    local.setUint16(28, 0, true);
    const head = new Uint8Array(30 + name.length);
    head.set(new Uint8Array(local.buffer), 0);
    head.set(name, 30);
    await this.write(head);
    await this.write(data);
    const cen = new DataView(new ArrayBuffer(46));
    cen.setUint32(0, 0x02014b50, true);
    cen.setUint16(4, 20, true);
    cen.setUint16(6, 20, true);
    cen.setUint16(8, 0x0800, true);
    cen.setUint16(10, 0, true);
    cen.setUint16(12, this.dosTime, true);
    cen.setUint16(14, this.dosDate, true);
    cen.setUint32(16, crc, true);
    cen.setUint32(20, size, true);
    cen.setUint32(24, size, true);
    cen.setUint16(28, name.length, true);
    cen.setUint32(42, this.offset, true);
    const c = new Uint8Array(46 + name.length);
    c.set(new Uint8Array(cen.buffer), 0);
    c.set(name, 46);
    this.central.push(c);
    this.offset += 30 + name.length + size;
  }

  /** Écrit le répertoire central et la fin d'archive. */
  async finish(): Promise<void> {
    const size = this.central.reduce((a, c) => a + c.length, 0);
    for (const c of this.central) await this.write(c);
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true);
    end.setUint16(8, this.central.length, true);
    end.setUint16(10, this.central.length, true);
    end.setUint32(12, size, true);
    end.setUint32(16, this.offset, true);
    await this.write(new Uint8Array(end.buffer));
  }
}

/** Archive entière en mémoire (repli quand le navigateur ne permet pas d'écrire sur le disque). */
export async function makeZip(entries: { name: string; blob: Blob }[]): Promise<Blob> {
  const parts: ZipPart[] = [];
  const z = new ZipWriter(async (p) => void parts.push(p));
  for (const e of entries) await z.add(e.name, e.blob);
  await z.finish();
  return new Blob(parts, { type: 'application/zip' });
}
