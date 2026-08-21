import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { MetricsService } from './metrics.service';
import { MetricRequest, MetricResponse, MetricType, PageResponse } from './models';

const mockMetric: MetricResponse = {
  id: 'abc-123',
  userId: 'user-1',
  metricType: 'WEIGHT',
  value: { kg: 72.5 },
  recordedAt: '2026-08-01T08:00:00Z',
  source: 'MANUAL',
  notes: null,
  createdAt: '2026-08-01T08:00:00Z',
  updatedAt: '2026-08-01T08:00:00Z',
};

describe('MetricsService', () => {
  let svc: MetricsService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [MetricsService],
    });
    svc  = TestBed.inject(MetricsService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('create — POSTs to /api/metrics and returns metric', () => {
    const req: MetricRequest = {
      metricType: 'WEIGHT',
      value: { kg: 72.5 },
      recordedAt: '2026-08-01T08:00:00Z',
    };
    let result: MetricResponse | undefined;
    svc.create(req).subscribe(r => (result = r));

    const testReq = http.expectOne('/api/metrics');
    expect(testReq.request.method).toBe('POST');
    testReq.flush(mockMetric);
    expect(result).toEqual(mockMetric);
  });

  it('list — GETs /api/metrics with no params', () => {
    const page: PageResponse<MetricResponse> = {
      content: [mockMetric], page: 0, size: 20, totalElements: 1, totalPages: 1, last: true,
    };
    let result: PageResponse<MetricResponse> | undefined;
    svc.list().subscribe(r => (result = r));

    const testReq = http.expectOne(r => r.url === '/api/metrics');
    expect(testReq.request.method).toBe('GET');
    testReq.flush(page);
    expect(result?.content).toHaveSize(1);
  });

  it('list — passes metricType filter param', () => {
    svc.list({ metricType: 'BLOOD_PRESSURE' }).subscribe();
    const testReq = http.expectOne(r => r.url === '/api/metrics');
    expect(testReq.request.params.get('metricType')).toBe('BLOOD_PRESSURE');
    testReq.flush({ content: [], page: 0, size: 20, totalElements: 0, totalPages: 0, last: true });
  });

  it('getById — GETs /api/metrics/{id}', () => {
    let result: MetricResponse | undefined;
    svc.getById('abc-123').subscribe(r => (result = r));

    const testReq = http.expectOne('/api/metrics/abc-123');
    expect(testReq.request.method).toBe('GET');
    testReq.flush(mockMetric);
    expect(result?.id).toBe('abc-123');
  });

  it('update — PUTs to /api/metrics/{id}', () => {
    svc.update('abc-123', { value: { kg: 75 }, recordedAt: '2026-08-02T08:00:00Z' }).subscribe();
    const testReq = http.expectOne('/api/metrics/abc-123');
    expect(testReq.request.method).toBe('PUT');
    testReq.flush(mockMetric);
  });

  it('delete — DELETEs /api/metrics/{id}', () => {
    svc.delete('abc-123').subscribe();
    const testReq = http.expectOne('/api/metrics/abc-123');
    expect(testReq.request.method).toBe('DELETE');
    testReq.flush(null);
  });

  it('dashboard — GETs /api/metrics/dashboard with required params', () => {
    svc.dashboard({
      metricType: 'WEIGHT',
      from: '2026-08-01T00:00:00Z',
      to:   '2026-08-31T00:00:00Z',
      granularity: 'WEEK',
    }).subscribe();
    const testReq = http.expectOne(r => r.url === '/api/metrics/dashboard');
    expect(testReq.request.params.get('metricType')).toBe('WEIGHT');
    expect(testReq.request.params.get('granularity')).toBe('WEEK');
    testReq.flush({ metricType: 'WEIGHT', from: '2026-08-01', to: '2026-08-31', granularity: 'WEEK', buckets: [] });
  });
});
