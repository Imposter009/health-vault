import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { AuditLogService } from './audit-log.service';
import { PagedAuditLog } from './models';
import { environment } from '../../environments/environment';

describe('AuditLogService', () => {
  let service: AuditLogService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [AuditLogService],
    });
    service = TestBed.inject(AuditLogService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('should GET /audit-log/me with no params when filter is empty', () => {
    const mockPage: PagedAuditLog = {
      content: [], totalElements: 0, totalPages: 0, number: 0, size: 20
    };

    service.getMyLog({}).subscribe(p => expect(p).toEqual(mockPage));

    const req = http.expectOne(`${environment.apiBaseUrl}/audit-log/me`);
    expect(req.request.method).toBe('GET');
    req.flush(mockPage);
  });

  it('should append action query param when filter specifies action', () => {
    service.getMyLog({ action: 'LOGIN_SUCCESS', page: 0, size: 20 }).subscribe();

    const req = http.expectOne(r => r.url === `${environment.apiBaseUrl}/audit-log/me`);
    expect(req.request.params.get('action')).toBe('LOGIN_SUCCESS');
    expect(req.request.params.get('page')).toBe('0');
    req.flush({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 20 });
  });

  it('should append from/to date params when provided', () => {
    service.getMyLog({ from: '2024-01-01T00:00:00Z', to: '2024-01-31T23:59:59Z' }).subscribe();

    const req = http.expectOne(r => r.url === `${environment.apiBaseUrl}/audit-log/me`);
    expect(req.request.params.get('from')).toBe('2024-01-01T00:00:00Z');
    expect(req.request.params.get('to')).toBe('2024-01-31T23:59:59Z');
    req.flush({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 20 });
  });
});
