/**
 * Background service worker.
 * If the customer closes the tab before uploads finish, background sync
 * fires this worker: it reads queued segments from IndexedDB and completes
 * the uploads — even with the tab closed. Every request carries the token
 * stored on each queued record. Cleans up IndexedDB on success.
 */

const DB_NAME = 'wc-recorder';
const STORE = 'uploads';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('sync', (event) => {
  if (event.tag === 'wc-upload-sync') {
    event.waitUntil(drainQueue());
  }
});

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'key' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idb(db, mode, fn) {
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const req = fn(t.objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function drainQueue() {
  const db = await openDb();
  const all = await idb(db, 'readonly', (s) => s.getAll());
  for (const seg of all.sort((a, b) => a.createdAt - b.createdAt)) {
    const ok = await uploadOne(seg);
    if (ok) {
      await idb(db, 'readwrite', (s) => s.delete(seg.key));
    }
    // Failures stay queued; the next sync event retries them.
  }
}

async function uploadOne(seg) {
  try {
    const urlRes = await fetch(`/api/public/session/${seg.sessionId}/upload-url`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: seg.token,
        take_id: seg.takeId,
        segment_index: seg.segmentIndex,
        kind: seg.kind,
        correlation_id: seg.correlationId,
      }),
    });
    if (!urlRes.ok) return false;
    const { upload_url, storage_path } = await urlRes.json();

    const putRes = await fetch(upload_url, {
      method: 'PUT',
      headers: { 'Content-Type': 'video/webm', 'x-upsert': 'true' },
      body: seg.blob,
    });
    if (!putRes.ok) return false;

    const regRes = await fetch(`/api/public/session/${seg.sessionId}/register-segment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: seg.token,
        take_id: seg.takeId,
        segment_index: seg.segmentIndex,
        storage_path,
        size_bytes: seg.blob.size,
        duration_ms: seg.durationMs,
        correlation_id: seg.correlationId,
      }),
    });
    return regRes.ok;
  } catch (e) {
    return false;
  }
}
