import { TestBed, fakeAsync, tick, discardPeriodicTasks } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { DocumentsService, UploadProgress }              from './documents.service';
import { DocumentCategory, DocumentResponse, DocumentStatusResponse, PageResponse } from './models';

describe('DocumentsService', () => {
  let service: DocumentsService;
  let http:    HttpTestingController;

  const MOCK_DOC: DocumentResponse = {
    id:         'doc-1',
    filename:   'blood-test.pdf',
    category:   'LAB_REPORT',
    status:     'UPLOADED',
    mimeType:   'application/pdf',
    sizeBytes:  12345,
    uploadedAt: '2024-06-01T10:00:00Z',
  };

  const MOCK_STATUS: DocumentStatusResponse = {
    status:           'PROCESSED',
    processedAt:      '2024-06-01T10:05:00Z',
    metricsExtracted: 2,
    processingError:  null,
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
    });
    service = TestBed.inject(DocumentsService);
    http    = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('list() hits GET /api/documents', () => {
    const page: PageResponse<DocumentResponse> = {
      content: [MOCK_DOC], page: 0, size: 20, totalElements: 1, totalPages: 1, last: true
    };
    service.list().subscribe(r => expect(r.content.length).toBe(1));
    http.expectOne(r => r.url === '/api/documents').flush(page);
  });

  it('list() forwards category filter', () => {
    service.list({ category: 'PRESCRIPTION' }).subscribe(r => expect(r.content).toEqual([]));
    const req = http.expectOne(r => r.urlWithParams.includes('category=PRESCRIPTION'));
    req.flush({ content: [], page: 0, size: 20, totalElements: 0, totalPages: 0, last: true });
  });

  it('getById() hits GET /api/documents/:id', () => {
    service.getById('doc-1').subscribe(d => expect(d.filename).toBe('blood-test.pdf'));
    http.expectOne('/api/documents/doc-1').flush(MOCK_DOC);
  });

  it('getDownloadUrl() hits GET /api/documents/:id/download-url', () => {
    service.getDownloadUrl('doc-1').subscribe(r => {
      expect(r.url).toContain('presigned');
      expect(r.expiryMinutes).toBe(5);
    });
    http.expectOne('/api/documents/doc-1/download-url')
      .flush({ url: 'http://minio/presigned?token=x', expiryMinutes: 5 });
  });

  it('delete() hits DELETE /api/documents/:id', () => {
    let completed = false;
    service.delete('doc-1').subscribe({ complete: () => { completed = true; } });
    http.expectOne(r => r.method === 'DELETE' && r.url === '/api/documents/doc-1')
      .flush(null, { status: 204, statusText: 'No Content' });
    expect(completed).toBeTrue();
  });

  it('upload() emits progress then complete', done => {
    const file = new File(['%PDF-1.4'], 'report.pdf', { type: 'application/pdf' });
    const events: UploadProgress[] = [];

    service.upload(file, 'LAB_REPORT').subscribe({
      next:  e => events.push(e),
      complete: () => {
        const types = events.map(e => e.type);
        expect(types).toContain('complete');
        const completed = events.find(e => e.type === 'complete')!;
        expect(completed.document?.filename).toBe('blood-test.pdf');
        done();
      },
    });

    const req = http.expectOne(r => r.url === '/api/documents');
    req.event({ type: 1 /* UploadProgress */, loaded: 50, total: 100 } as any);
    req.flush(MOCK_DOC);
  });

  it('getStatus() hits GET /api/documents/:id/status', () => {
    service.getStatus('doc-1').subscribe(s => {
      expect(s.status).toBe('PROCESSED');
      expect(s.metricsExtracted).toBe(2);
    });
    http.expectOne('/api/documents/doc-1/status').flush(MOCK_STATUS);
  });

  it('pollStatus() emits then completes when terminal status returned', fakeAsync(() => {
    const statuses: DocumentStatusResponse[] = [];
    let completed = false;

    service.pollStatus('doc-1', 5).subscribe({
      next:     s => statuses.push(s),
      complete: () => { completed = true; },
    });

    // interval(2500) doesn't fire until after the first 2500ms; advance the timer
    tick(2500);

    const req = http.expectOne('/api/documents/doc-1/status');
    req.flush(MOCK_STATUS);  // PROCESSED — terminal, so takeWhile emits then completes

    tick(0);  // flush microtasks so takeWhile + complete propagate

    expect(statuses.length).toBe(1);
    expect(statuses[0].status).toBe('PROCESSED');
    expect(completed).toBeTrue();

    discardPeriodicTasks();  // drain the interval so the test zone cleans up
  }));
});
