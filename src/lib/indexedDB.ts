/**
 * IndexedDB — Offline Audio Cache for StreamSync
 *
 * Stores:
 *   offline-tracks   → audio ArrayBuffer keyed by fileId
 *   offline-covers    → cover image ArrayBuffer keyed by fileId
 *   offline-metadata  → ApiFile metadata keyed by fileId
 */

const DB_NAME = 'streamsync-offline';
const DB_VERSION = 1;

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('offline-tracks')) {
        db.createObjectStore('offline-tracks');
      }
      if (!db.objectStoreNames.contains('offline-covers')) {
        db.createObjectStore('offline-covers');
      }
      if (!db.objectStoreNames.contains('offline-metadata')) {
        db.createObjectStore('offline-metadata');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function promisify<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// ─── Audio Tracks ───────────────────────────────────────

export async function cacheAudioTrack(fileId: string, buffer: ArrayBuffer): Promise<void> {
  const db = await open();
  const tx = db.transaction('offline-tracks', 'readwrite');
  tx.objectStore('offline-tracks').put(buffer, fileId);
  await promisify(tx as unknown as IDBRequest);
}

export async function getCachedAudioTrack(fileId: string): Promise<ArrayBuffer | null> {
  const db = await open();
  const result = await promisify(db.transaction('offline-tracks').objectStore('offline-tracks').get(fileId));
  return result ?? null;
}

export async function removeCachedTrack(fileId: string): Promise<void> {
  const db = await open();
  const tx = db.transaction(['offline-tracks', 'offline-covers', 'offline-metadata'], 'readwrite');
  tx.objectStore('offline-tracks').delete(fileId);
  tx.objectStore('offline-covers').delete(fileId);
  tx.objectStore('offline-metadata').delete(fileId);
  await promisify(tx as unknown as IDBRequest);
}

export async function isTrackCached(fileId: string): Promise<boolean> {
  const db = await open();
  const store = db.transaction('offline-tracks').objectStore('offline-tracks');
  const count = await promisify(store.count(fileId));
  return count > 0;
}

/** Check multiple tracks at once */
export async function getCachedTrackIds(ids: string[]): Promise<Set<string>> {
  const db = await open();
  const store = db.transaction('offline-tracks').objectStore('offline-tracks');
  const cached = new Set<string>();
  // Use getAllKeys (fast) and intersect
  const allKeys = await promisify(store.getAllKeys());
  const keySet = new Set(allKeys as string[]);
  for (const id of ids) {
    if (keySet.has(id)) cached.add(id);
  }
  return cached;
}

export async function getAllCachedTrackIds(): Promise<string[]> {
  const db = await open();
  const keys = await promisify(db.transaction('offline-tracks').objectStore('offline-tracks').getAllKeys());
  return keys as string[];
}

// ─── Cover Art ──────────────────────────────────────────

export async function cacheCover(fileId: string, buffer: ArrayBuffer): Promise<void> {
  const db = await open();
  const tx = db.transaction('offline-covers', 'readwrite');
  tx.objectStore('offline-covers').put(buffer, fileId);
  await promisify(tx as unknown as IDBRequest);
}

export async function getCachedCover(fileId: string): Promise<ArrayBuffer | null> {
  const db = await open();
  const result = await promisify(db.transaction('offline-covers').objectStore('offline-covers').get(fileId));
  return result ?? null;
}

// ─── Metadata ───────────────────────────────────────────

export async function cacheMetadata(fileId: string, metadata: Record<string, unknown>): Promise<void> {
  const db = await open();
  const tx = db.transaction('offline-metadata', 'readwrite');
  tx.objectStore('offline-metadata').put(metadata, fileId);
  await promisify(tx as unknown as IDBRequest);
}

export async function getCachedMetadata(fileId: string): Promise<Record<string, unknown> | null> {
  const db = await open();
  const result = await promisify(db.transaction('offline-metadata').objectStore('offline-metadata').get(fileId));
  return result ?? null;
}

// ─── Storage Info ───────────────────────────────────────

export async function getOfflineStorageUsage(): Promise<{ tracks: number; bytes: number }> {
  const db = await open();
  const store = db.transaction('offline-tracks').objectStore('offline-tracks');
  const keys = await promisify(store.getAllKeys()) as string[];
  let bytes = 0;
  const cursorReq = store.openCursor();
  await new Promise<void>((resolve, reject) => {
    cursorReq.onsuccess = () => {
      const cursor = cursorReq.result;
      if (cursor) {
        if (cursor.value instanceof ArrayBuffer) {
          bytes += cursor.value.byteLength;
        }
        cursor.continue();
      } else {
        resolve();
      }
    };
    cursorReq.onerror = () => reject(cursorReq.error);
  });
  return { tracks: keys.length, bytes };
}

/** Try to get browser storage estimate (works in supporting browsers) */
export async function getStorageEstimate(): Promise<{ usage: number; quota: number } | null> {
  if ('storage' in navigator && 'estimate' in navigator.storage) {
    const est = await navigator.storage.estimate();
    return {
      usage: est.usage ?? 0,
      quota: est.quota ?? 0,
    };
  }
  return null;
}
