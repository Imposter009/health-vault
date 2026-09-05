import { TestBed } from '@angular/core/testing';
import { DocumentsListComponent } from './documents-list.component';
import { DocumentsService } from '../documents.service';
import { DocumentResponse, PageResponse } from '../models';
import { of, throwError } from 'rxjs';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { RouterTestingModule } from '@angular/router/testing';

function makeDoc(overrides: Partial<DocumentResponse> = {}): DocumentResponse {
  return {
    id:         'doc-1',
    filename:   'report.pdf',
    category:   'LAB_REPORT',
    status:     'PROCESSED',
    mimeType:   'application/pdf',
    sizeBytes:  1048576,
    uploadedAt: '2025-06-01T10:00:00Z',
    ...overrides,
  };
}

function makePage(docs: DocumentResponse[], totalPages = 1): PageResponse<DocumentResponse> {
  return { content: docs, page: 0, size: 20, totalElements: docs.length, totalPages, last: true };
}

describe('DocumentsListComponent', () => {
  let component: DocumentsListComponent;
  let svc: jasmine.SpyObj<DocumentsService>;

  beforeEach(async () => {
    svc = jasmine.createSpyObj('DocumentsService', ['list', 'delete']);
    svc.list.and.returnValue(of(makePage([makeDoc()])));
    svc.delete.and.returnValue(of(undefined));

    await TestBed.configureTestingModule({
      imports: [DocumentsListComponent, RouterTestingModule],
      providers: [{ provide: DocumentsService, useValue: svc }],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    const fixture = TestBed.createComponent(DocumentsListComponent);
    component     = fixture.componentInstance;
    fixture.detectChanges();
  });

  // ── ngOnInit ──────────────────────────────────────────────────────────

  it('calls list() on init with default page 0', () => {
    expect(svc.list).toHaveBeenCalledWith(jasmine.objectContaining({ page: 0 }));
  });

  it('populates documents from service response', () => {
    expect(component.documents.length).toBe(1);
    expect(component.documents[0].filename).toBe('report.pdf');
    expect(component.loading).toBeFalse();
  });

  // ── Filter change ─────────────────────────────────────────────────────

  it('reload() with category filter passes category param', () => {
    component.filterCategory = 'PRESCRIPTION';
    component.reload();
    expect(svc.list).toHaveBeenCalledWith(jasmine.objectContaining({ category: 'PRESCRIPTION' }));
  });

  it('reload() without category filter omits category param', () => {
    component.filterCategory = '';
    component.reload();
    const args = svc.list.calls.mostRecent().args[0] ?? {};
    expect(args['category']).toBeUndefined();
  });

  // ── Pagination ────────────────────────────────────────────────────────

  it('changePage() updates page and reloads', () => {
    svc.list.and.returnValue(of(makePage([], 3)));
    component.totalPages = 3;
    component.changePage(2);
    expect(component.page).toBe(2);
    expect(svc.list).toHaveBeenCalledWith(jasmine.objectContaining({ page: 2 }));
  });

  // ── Error state ───────────────────────────────────────────────────────

  it('shows error message when list() fails', () => {
    svc.list.and.returnValue(throwError(() => ({
      error: { message: 'Unauthorized' }
    })));
    component.reload();
    expect(component.error).toBe('Unauthorized');
    expect(component.loading).toBeFalse();
  });

  it('falls back to generic error message when error body is missing', () => {
    svc.list.and.returnValue(throwError(() => ({})));
    component.reload();
    expect(component.error).toBe('Failed to load documents.');
  });

  // ── Delete ────────────────────────────────────────────────────────────

  it('confirmDelete reloads list on success', () => {
    spyOn(window, 'confirm').and.returnValue(true);
    svc.delete.and.returnValue(of(undefined));
    const callsBefore = svc.list.calls.count();
    component.confirmDelete(makeDoc());
    expect(svc.delete).toHaveBeenCalledWith('doc-1');
    expect(svc.list.calls.count()).toBeGreaterThan(callsBefore);
  });

  it('confirmDelete does nothing when user cancels', () => {
    spyOn(window, 'confirm').and.returnValue(false);
    component.confirmDelete(makeDoc());
    expect(svc.delete).not.toHaveBeenCalled();
  });

  // ── mimeShort helper ──────────────────────────────────────────────────

  it('mimeShort returns PDF for application/pdf', () => {
    expect(component.mimeShort('application/pdf')).toBe('PDF');
  });

  it('mimeShort returns JPEG for image/jpeg', () => {
    expect(component.mimeShort('image/jpeg')).toBe('JPEG');
  });

  it('mimeShort returns PNG for image/png', () => {
    expect(component.mimeShort('image/png')).toBe('PNG');
  });

  it('mimeShort returns raw mime for unknown types', () => {
    expect(component.mimeShort('application/x-unknown')).toBe('application/x-unknown');
  });

  // ── statusLabel helper ────────────────────────────────────────────────

  it('statusLabel maps all known statuses', () => {
    expect(component.statusLabel('UPLOADED')).toBe('Uploaded');
    expect(component.statusLabel('PROCESSING')).toBe('Processing…');
    expect(component.statusLabel('PROCESSED')).toBe('Processed');
    expect(component.statusLabel('FAILED')).toBe('Failed');
  });

  it('statusLabel returns status value for unknown codes', () => {
    expect(component.statusLabel('ARCHIVING')).toBe('ARCHIVING');
  });
});
