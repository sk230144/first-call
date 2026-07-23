'use client';

/**
 * Durable segment upload queue.
 * Segments are written to IndexedDB the moment they are recorded, then an
 * upload worker drains the queue continuously DURING the call. The queue
 * survives page refresh; a background-sync service worker drains anything
 * left if the tab closes. Every request carries the session token.
 */

const DB_NAME = 'wc-recorder';
const STORE = 'uploads';

export type QueuedSegment = {
  key: string;            // `${sessionId}:${takeId}:${segmentIndex}` — deterministic
  sessionId: string;
  token: string;
  takeId: string;
  segmentIndex: number;
  kind: 'segment' | 'snapshot';
  blob: Blob;
  durationMs: number;
  correlationId: string;
  attempts: number;
  createdAt: number;
};

export function openQueueDb(): Promise<IDBDatabase> {
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

function tx<T>(db: IDBDatabase, mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const req = fn(t.objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export class UploadQueue {
  private db: IDBDatabase | null = null;
  private draining = false;
  private stopped = false;
  public onProgress: (pending: number, uploaded: number) => void = () => {};
  private uploadedCount = 0;

  async init() {
    this.db = await openQueueDb();
  }

  /** Write segment to IndexedDB first (durability), then kick the drainer. */
  async enqueue(seg: Omit<QueuedSegment, 'key' | 'attempts' | 'createdAt'>) {
    if (!this.db) await this.init();
    const record: QueuedSegment = {
      ...seg,
      key: `${seg.sessionId}:${seg.takeId}:${seg.kind === 'snapshot' ? 'snap-' : ''}${seg.segmentIndex}`,
      attempts: 0,
      createdAt: Date.now(),
    };
    await tx(this.db!, 'readwrite', (s) => s.put(record));
    void this.drain();
  }

  async pendingCount(): Promise<number> {
    if (!this.db) await this.init();
    return tx<number>(this.db!, 'readonly', (s) => s.count());
  }

  /** Continuously process the queue with exponential backoff per segment. */
  async drain(): Promise<void> {
    if (this.draining || this.stopped) return;
    this.draining = true;
    try {
      while (!this.stopped) {
        if (!this.db) await this.init();
        const all = await tx<QueuedSegment[]>(this.db!, 'readonly', (s) => s.getAll());
        if (all.length === 0) break;
        const seg = all.sort((a, b) => a.createdAt - b.createdAt)[0];
        const ok = await this.uploadOne(seg);
        if (ok) {
          await tx(this.db!, 'readwrite', (s) => s.delete(seg.key));
          this.uploadedCount++;
        } else {
          seg.attempts++;
          await tx(this.db!, 'readwrite', (s) => s.put(seg));
          // exponential backoff, capped at 30s
          await sleep(Math.min(1000 * 2 ** seg.attempts, 30_000));
        }
        this.onProgress(await this.pendingCount(), this.uploadedCount);
      }
    } finally {
      this.draining = false;
    }
  }

  /** get-upload-url → PUT to signed URL → register-segment. All token-authed. */
  private async uploadOne(seg: QueuedSegment): Promise<boolean> {
    try {
      const urlRes = await fetch(`/api/public/session/${seg.sessionId}/upload-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: seg.token, take_id: seg.takeId, segment_index: seg.segmentIndex,
          kind: seg.kind, correlation_id: seg.correlationId,
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
          token: seg.token, take_id: seg.takeId, segment_index: seg.segmentIndex,
          storage_path, size_bytes: seg.blob.size, duration_ms: seg.durationMs,
          correlation_id: seg.correlationId,
        }),
      });
      return regRes.ok;
    } catch {
      return false;
    }
  }

  stop() { this.stopped = true; }
}

/** Register background sync so the SW finishes uploads even if the tab closes. */
export async function registerBackgroundSync() {
  try {
    if ('serviceWorker' in navigator && 'SyncManager' in window) {
      const reg = await navigator.serviceWorker.ready;
      await (reg as any).sync.register('wc-upload-sync');
      return true;
    }
  } catch { /* best-effort */ }
  return false;
}

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }
