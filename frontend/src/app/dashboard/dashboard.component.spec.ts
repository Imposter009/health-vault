import { TestBed } from '@angular/core/testing';
import { DashboardComponent } from './dashboard.component';
import { MetricsService } from '../metrics/metrics.service';
import { ConnectivityService } from '../core/connectivity.service';
import { DashboardResponse } from '../metrics/models';
import { of, Subject, throwError } from 'rxjs';
import { NO_ERRORS_SCHEMA } from '@angular/core';

// Chart.js requires a real Canvas context that is unavailable in jsdom.
// Disable canvas operations entirely so Chart construction is a no-op.
beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = () => null;
});

describe('DashboardComponent', () => {
  let component: DashboardComponent;
  let metricsSvc: jasmine.SpyObj<MetricsService>;
  let reconnected$: Subject<void>;

  const mockResponse: DashboardResponse = {
    metricType:  'WEIGHT',
    from:        '2025-01-01',
    to:          '2025-01-31',
    granularity: 'DAY',
    buckets: [
      { bucketStart: '2025-01-15', avg: 72, min: 70, max: 74,
        avgSystolic: null, avgDiastolic: null, minSystolic: null, maxSystolic: null,
        totalDurationMinutes: null, count: 2 }
    ]
  };

  beforeEach(async () => {
    reconnected$ = new Subject<void>();
    metricsSvc = jasmine.createSpyObj('MetricsService', ['dashboard']);
    metricsSvc.dashboard.and.returnValue(of(mockResponse));

    const connectivitySvc = { reconnected$: reconnected$.asObservable() };

    await TestBed.configureTestingModule({
      imports: [DashboardComponent],
      providers: [
        { provide: MetricsService,     useValue: metricsSvc },
        { provide: ConnectivityService, useValue: connectivitySvc },
      ],
      schemas: [NO_ERRORS_SCHEMA]
    }).compileComponents();

    const fixture = TestBed.createComponent(DashboardComponent);
    component     = fixture.componentInstance;
    fixture.detectChanges();
  });

  // ── setPreset date calculation ────────────────────────────────────────

  it('setPreset(7) sets fromDate 7 days before today', () => {
    const before = Date.now();
    component.setPreset(7);
    const after = Date.now();

    const from = new Date(component.fromDate + 'T00:00:00');
    const diff  = Math.round((after - from.getTime()) / 86_400_000);
    // Allow ±1 day for midnight boundary
    expect(diff).toBeGreaterThanOrEqual(6);
    expect(diff).toBeLessThanOrEqual(8);
  });

  it('setPreset calls load() which calls MetricsService.dashboard()', () => {
    const callsBefore = metricsSvc.dashboard.calls.count();
    component.setPreset(30);
    expect(metricsSvc.dashboard.calls.count()).toBeGreaterThan(callsBefore);
  });

  // ── Service call parameters ───────────────────────────────────────────

  it('load() passes correct metricType and granularity to service', () => {
    component.metricType  = 'HEART_RATE';
    component.granularity = 'WEEK';
    component.fromDate    = '2025-03-01';
    component.toDate      = '2025-03-31';
    component.load();

    const args = metricsSvc.dashboard.calls.mostRecent().args[0];
    expect(args.metricType).toBe('HEART_RATE');
    expect(args.granularity).toBe('WEEK');
  });

  it('load() sets data on success and clears loading flag', () => {
    component.fromDate = '2025-01-01';
    component.toDate   = '2025-01-31';
    component.load();

    expect(component.data).toEqual(mockResponse);
    expect(component.loading).toBeFalse();
    expect(component.errorMsg).toBe('');
  });

  it('load() sets errorMsg on service failure', () => {
    metricsSvc.dashboard.and.returnValue(throwError(() => new Error('500')));
    component.fromDate = '2025-01-01';
    component.toDate   = '2025-01-31';
    component.load();

    expect(component.errorMsg).toBeTruthy();
    expect(component.loading).toBeFalse();
  });

  it('load() does nothing when fromDate is empty', () => {
    component.fromDate = '';
    component.toDate   = '2025-01-31';
    const before = metricsSvc.dashboard.calls.count();
    component.load();
    expect(metricsSvc.dashboard.calls.count()).toBe(before);
  });

  // ── Connectivity reconnect ────────────────────────────────────────────

  it('reconnect event triggers a new dashboard load', () => {
    const before = metricsSvc.dashboard.calls.count();
    reconnected$.next();
    expect(metricsSvc.dashboard.calls.count()).toBeGreaterThan(before);
  });

  // ── Cleanup ───────────────────────────────────────────────────────────

  it('ngOnDestroy unsubscribes from reconnect events', () => {
    component.ngOnDestroy();
    const before = metricsSvc.dashboard.calls.count();
    reconnected$.next(); // should not trigger load any more
    expect(metricsSvc.dashboard.calls.count()).toBe(before);
  });
});
