import type { WorldData } from './gen/types';

/**
 * Sauvegarde du dernier monde dans IndexedDB : un rafraîchissement de la page le recharge tel quel
 * au lieu de le régénérer (quelques secondes au lieu de plusieurs minutes pour les grandes cartes,
 * et la même carte même si le générateur a évolué entre-temps).
 */
const DB = 'atlas';
const STORE = 'worlds';
const KEY = 'last';
/** Incrémenté si la forme de WorldData ou le générateur change : une sauvegarde périmée est ignorée. */
const FORMAT = 9;

interface Saved {
  format: number;
  savedAt: number;
  world: WorldData;
}

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveWorld(world: WorldData): Promise<void> {
  const db = await open();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      const rec: Saved = { format: FORMAT, savedAt: Date.now(), world };
      tx.objectStore(STORE).put(rec, KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

export async function loadWorld(): Promise<WorldData | null> {
  const db = await open();
  try {
    const rec = await new Promise<Saved | undefined>((resolve, reject) => {
      const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(KEY);
      req.onsuccess = () => resolve(req.result as Saved | undefined);
      req.onerror = () => reject(req.error);
    });
    return rec && rec.format === FORMAT ? rec.world : null;
  } finally {
    db.close();
  }
}
