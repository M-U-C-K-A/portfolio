import { saveWorld } from '../store';
import { generateWorld, type TerrainCache } from './pipeline';
import { terrainKey, type WorkerRequest, type WorkerResponse } from './types';

const post = (msg: WorkerResponse, transfer: Transferable[] = []): void => {
  self.postMessage(msg, { transfer });
};

let cache: TerrainCache | null = null;

self.onmessage = async (e: MessageEvent<WorkerRequest>) => {
  const msg = e.data;
  if (msg.type !== 'generate') return;
  // nouveau terrain : libérer tout de suite l'ancien cache (sinon deux mondes géants en mémoire)
  if (cache && cache.key !== terrainKey(msg.settings)) cache = null;
  try {
    const res = generateWorld(
      msg.settings,
      (stage, progress) => post({ type: 'progress', id: msg.id, stage, progress }),
      cache,
      // aperçus du monde en formation (petites images, transférées sans copie)
      (stage, img) => post({ type: 'preview', id: msg.id, stage, w: img.w, h: img.h, pixels: img.data }, [img.data.buffer]),
    );
    cache = res.cache;
    const { world, transfer } = res;
    // sauvegarde ici, avant le transfert : la sérialisation (jusqu'à ~1,5 Go) ne fige pas l'interface
    post({ type: 'progress', id: msg.id, stage: 'Sauvegarde du monde', progress: 0.995 });
    try {
      await saveWorld(world);
    } catch (err) {
      console.warn('Sauvegarde du monde impossible :', err);
    }
    post({ type: 'done', id: msg.id, world }, transfer);
  } catch (err) {
    post({ type: 'error', id: msg.id, message: err instanceof Error ? `${err.message}\n${err.stack ?? ''}` : String(err) });
  }
};
