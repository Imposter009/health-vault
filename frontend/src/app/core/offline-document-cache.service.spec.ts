import { TestBed } from '@angular/core/testing';
import { OfflineDocumentCacheService, MAX_CACHED_DOCS } from './offline-document-cache.service';

const makeBlob = (content = 'test') => new Blob([content], { type: 'application/pdf' });

function purgeDb(): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.deleteDatabase('hv-offline-docs');
    req.onsuccess = () => resolve();
    req.onerror   = () => reject(req.error);
    req.onblocked = () => resolve();
  });
}

describe('OfflineDocumentCacheService', () => {
  let svc: OfflineDocumentCacheService;

  beforeEach(async () => {
    await purgeDb();
    TestBed.configureTestingModule({});
    svc = TestBed.inject(OfflineDocumentCacheService);
  });

  afterEach(async () => {
    await svc.close();  // release connection so deleteDatabase doesn't block
    await purgeDb();
  });

  it('returns undefined for a document that has never been cached', async () => {
    expect(await svc.get('unknown-id')).toBeUndefined();
  });

  it('stores and retrieves a cached document by id', async () => {
    const blob = makeBlob('pdf content');
    await svc.put('doc-1', blob, 'application/pdf', 'report.pdf');

    const cached = await svc.get('doc-1');
    expect(cached).toBeDefined();
    expect(cached!.documentId).toBe('doc-1');
    expect(cached!.mimeType).toBe('application/pdf');
    expect(cached!.filename).toBe('report.pdf');
    expect(cached!.blob.size).toBe(blob.size);
  });

  it('overwrites an existing entry on a second put with the same id', async () => {
    await svc.put('doc-2', makeBlob('v1'), 'application/pdf', 'v1.pdf');
    await svc.put('doc-2', makeBlob('version 2 content'), 'application/pdf', 'v2.pdf');

    const cached = await svc.get('doc-2');
    expect(cached!.filename).toBe('v2.pdf');
    expect(await svc.count()).toBe(1);
  });

  it('records a cachedAt timestamp within the current test run', async () => {
    const before = Date.now();
    await svc.put('doc-3', makeBlob(), 'image/png', 'scan.png');
    const after  = Date.now();

    const cached = await svc.get('doc-3');
    expect(cached!.cachedAt).toBeGreaterThanOrEqual(before);
    expect(cached!.cachedAt).toBeLessThanOrEqual(after);
  });

  it(`evicts the oldest entry when count exceeds MAX_CACHED_DOCS (${MAX_CACHED_DOCS})`, async () => {
    for (let i = 1; i <= MAX_CACHED_DOCS + 1; i++) {
      await svc.put(`evict-${i}`, makeBlob(`file ${i}`), 'application/pdf', `file-${i}.pdf`);
      await new Promise(r => setTimeout(r, 2));
    }

    expect(await svc.count()).toBe(MAX_CACHED_DOCS);
    expect(await svc.get('evict-1')).toBeUndefined();
    expect(await svc.get(`evict-${MAX_CACHED_DOCS + 1}`)).toBeDefined();
  }, 60000); // extended timeout: 21 puts × ~2ms delay + DB overhead

  it('getAllSortedByAge returns entries in ascending cachedAt order', async () => {
    await svc.put('older', makeBlob('old'), 'application/pdf', 'old.pdf');
    await new Promise(r => setTimeout(r, 5));
    await svc.put('newer', makeBlob('new'), 'application/pdf', 'new.pdf');

    const all = await svc.getAllSortedByAge();
    const ids  = all.map(d => d.documentId);
    expect(ids.indexOf('older')).toBeLessThan(ids.indexOf('newer'));
  });
});
