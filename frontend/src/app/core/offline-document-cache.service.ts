import { Injectable } from '@angular/core';
import { openDB, IDBPDatabase } from 'idb';

export interface CachedDocument {
  documentId: string;
  blob:       Blob;
  mimeType:   string;
  filename:   string;
  cachedAt:   number;
}

const DB_NAME  = 'hv-offline-docs';
const STORE    = 'documents';
const DB_VER   = 1;

/** Maximum number of documents kept in the offline cache (evict oldest on overflow). */
export const MAX_CACHED_DOCS = 20;

@Injectable({ providedIn: 'root' })
export class OfflineDocumentCacheService {

  private readonly db: Promise<IDBPDatabase>;

  constructor() {
    this.db = openDB(DB_NAME, DB_VER, {
      upgrade(database) {
        const store = database.createObjectStore(STORE, { keyPath: 'documentId' });
        store.createIndex('by_cachedAt', 'cachedAt');
      },
    });
  }

  async put(documentId: string, blob: Blob, mimeType: string, filename: string): Promise<void> {
    const db = await this.db;
    await db.put(STORE, { documentId, blob, mimeType, filename, cachedAt: Date.now() });
    await this.evictOldest(db);
  }

  async get(documentId: string): Promise<CachedDocument | undefined> {
    const db = await this.db;
    return db.get(STORE, documentId);
  }

  async count(): Promise<number> {
    const db = await this.db;
    return db.count(STORE);
  }

  /** Returns all cached docs sorted oldest-first (for eviction inspection / testing). */
  async getAllSortedByAge(): Promise<CachedDocument[]> {
    const db = await this.db;
    return db.getAllFromIndex(STORE, 'by_cachedAt');
  }

  /** Close the underlying IndexedDB connection. Used in tests to allow clean database deletion. */
  async close(): Promise<void> {
    (await this.db).close();
  }

  private async evictOldest(db: IDBPDatabase): Promise<void> {
    const all = await db.getAllFromIndex(STORE, 'by_cachedAt');
    if (all.length <= MAX_CACHED_DOCS) return;

    const toEvict = all.slice(0, all.length - MAX_CACHED_DOCS);
    const tx = db.transaction(STORE, 'readwrite');
    await Promise.all(toEvict.map(d => tx.store.delete(d.documentId)));
    await tx.done;
  }
}
