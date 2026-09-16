import {
  Component,
  OnInit,
  OnDestroy,
  AfterViewInit,
  ElementRef,
  ViewChild,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Chart, ChartData, ChartOptions, registerables } from 'chart.js';
import { forkJoin, Subscription } from 'rxjs';
import { MetricsService } from '../metrics/metrics.service';
import { DashboardGranularity, DashboardResponse, MetricType } from '../metrics/models';
import { DocumentsService } from '../documents/documents.service';
import { ConnectivityService } from '../core/connectivity.service';
import { AuthService } from '../auth/auth.service';
import { AiService, NarrationResponse } from '../ai/ai.service';

Chart.register(...registerables);

interface MetricTile {
  label: string;
  value: string;
  unit: string;
  sub: string;
  points: number[];
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="page-container">
      <!-- Hero -->
      <section class="dash-hero">
        <div class="dash-hero__blob dash-hero__blob--a" aria-hidden="true"></div>
        <div class="dash-hero__blob dash-hero__blob--b" aria-hidden="true"></div>
        <div class="dash-hero__content">
          <h1 class="dash-hero__title">{{ greeting() }}</h1>
          <p class="dash-hero__subtitle">Trends and aggregates for your tracked metrics.</p>
        </div>
      </section>

      <!-- Getting-started checklist — shown only when there's genuinely no data anywhere yet -->
      <section class="card onboarding-card" *ngIf="showOnboarding">
        <h2 class="onboarding-card__title">Let's get your health vault started</h2>
        <p class="onboarding-card__text">
          Complete a couple of steps to start seeing real trends and insights here.
        </p>
        <div class="onboarding-steps">
          <a routerLink="/metrics/new" class="onboarding-step">
            <span class="onboarding-step__icon">♡</span>
            <span class="onboarding-step__body">
              <span class="onboarding-step__title">Log your first metric</span>
              <span class="onboarding-step__sub">Blood pressure, glucose, weight, workouts, or heart rate</span>
            </span>
            <span class="onboarding-step__arrow" aria-hidden="true">→</span>
          </a>
          <a routerLink="/documents/upload" class="onboarding-step">
            <span class="onboarding-step__icon">🗂</span>
            <span class="onboarding-step__body">
              <span class="onboarding-step__title">Upload a document</span>
              <span class="onboarding-step__sub">Lab reports, prescriptions, or scans — auto-OCR'd and indexed</span>
            </span>
            <span class="onboarding-step__arrow" aria-hidden="true">→</span>
          </a>
          <a *ngIf="aiEnabled" routerLink="/ai/chat" class="onboarding-step">
            <span class="onboarding-step__icon">✦</span>
            <span class="onboarding-step__body">
              <span class="onboarding-step__title">Ask the AI assistant</span>
              <span class="onboarding-step__sub">Once you've uploaded records, ask questions about them directly</span>
            </span>
            <span class="onboarding-step__arrow" aria-hidden="true">→</span>
          </a>
        </div>
      </section>

      <!-- Controls -->
      <div class="dash-controls card" *ngIf="!showOnboarding">
        <div class="dash-controls__row">
          <div class="ctrl-group">
            <label class="ctrl-label">Metric</label>
            <select [(ngModel)]="metricType" (change)="load()">
              <option *ngFor="let t of metricTypes" [value]="t">{{ t | titlecase }}</option>
            </select>
          </div>
          <div class="ctrl-group">
            <label class="ctrl-label">Granularity</label>
            <select [(ngModel)]="granularity" (change)="load()">
              <option value="DAY">Daily</option>
              <option value="WEEK">Weekly</option>
              <option value="MONTH">Monthly</option>
            </select>
          </div>
          <div class="ctrl-group">
            <label class="ctrl-label">Range</label>
            <div class="presets">
              <button class="preset-btn" [class.active]="activePreset===7"  (click)="setPreset(7)">7d</button>
              <button class="preset-btn" [class.active]="activePreset===30" (click)="setPreset(30)">30d</button>
              <button class="preset-btn" [class.active]="activePreset===90" (click)="setPreset(90)">90d</button>
            </div>
          </div>
          <div class="ctrl-group">
            <label class="ctrl-label">From</label>
            <input type="date" [(ngModel)]="fromDate" (change)="onCustomDate()" />
          </div>
          <div class="ctrl-group">
            <label class="ctrl-label">To</label>
            <input type="date" [(ngModel)]="toDate" (change)="onCustomDate()" />
          </div>
        </div>
      </div>

      <ng-container *ngIf="!showOnboarding">
      <div *ngIf="loading" class="state-msg">Loading chart data…</div>
      <div *ngIf="errorMsg" class="state-msg error">{{ errorMsg }}</div>
      <div *ngIf="!loading && !errorMsg && data?.buckets?.length === 0" class="card empty-state">
        <span class="empty-state__icon" aria-hidden="true">📊</span>
        <h2 class="empty-state__title">No {{ metricType | titlecase }} data in this range</h2>
        <p class="empty-state__text">Try a wider date range, or log a new reading for this metric.</p>
        <div class="empty-state__actions">
          <a routerLink="/metrics/new" class="btn btn-primary btn-sm">+ Log a reading</a>
        </div>
      </div>

      <!-- Metric tiles -->
      <div class="tile-row" *ngIf="!loading && !errorMsg && metricTiles.length">
        <div class="tile" *ngFor="let t of metricTiles">
          <span class="tile__label">{{ t.label }}</span>
          <div class="tile__value">{{ t.value }}<span class="tile__unit" *ngIf="t.unit"> {{ t.unit }}</span></div>
          <div class="tile__foot">
            <span class="tile__sub">{{ t.sub }}</span>
            <svg *ngIf="t.points.length > 1" class="tile__spark" viewBox="0 0 100 28" preserveAspectRatio="none">
              <path [attr.d]="sparklinePath(t.points)" fill="none" stroke="currentColor"
                    stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
        </div>
      </div>

      <div class="card chart-card" *ngIf="!errorMsg">
        <div class="chart-wrapper">
          <canvas #chartCanvas></canvas>
        </div>
      </div>

      <!-- AI Trend Narration — only for numeric metrics when AI is enabled -->
      <div class="card ai-trend-card"
           *ngIf="aiEnabled && metricType !== 'BLOOD_PRESSURE' && metricType !== 'WORKOUT'">
        <div class="ai-trend-header">
          <span class="ai-trend-title">
            <span class="status-badge status-badge--info">AI Insight</span>
            Trend Analysis
          </span>
          <button class="ai-trend-btn" [disabled]="narratingTrend" (click)="getNarration()">
            {{ narratingTrend ? 'Analysing…' : '✨ Analyse trend' }}
          </button>
        </div>
        <ng-container *ngIf="narration">
          <p *ngIf="narration.hasTrend" class="ai-trend-text">{{ narration.narration }}</p>
          <p *ngIf="!narration.hasTrend" class="ai-trend-nodata">{{ narration.narration }}</p>
          <p class="ai-disclaimer">AI-generated — not medical advice. Always consult your healthcare provider.</p>
        </ng-container>
        <p *ngIf="trendNarrationError" class="ai-trend-error">{{ trendNarrationError }}</p>
      </div>

      <!-- Summary table -->
      <div class="card" style="margin-top:1.25rem; padding:0; overflow:hidden;" *ngIf="data && data.buckets.length > 0">
        <table class="data-table">
          <thead>
            <tr>
              <th>Period</th>
              <th class="num" *ngIf="data.metricType !== 'BLOOD_PRESSURE' && data.metricType !== 'WORKOUT'">Avg</th>
              <th class="num" *ngIf="data.metricType !== 'BLOOD_PRESSURE' && data.metricType !== 'WORKOUT'">Min</th>
              <th class="num" *ngIf="data.metricType !== 'BLOOD_PRESSURE' && data.metricType !== 'WORKOUT'">Max</th>
              <th class="num" *ngIf="data.metricType === 'BLOOD_PRESSURE'">Avg Sys / Dia</th>
              <th class="num" *ngIf="data.metricType === 'WORKOUT'">Total Duration</th>
              <th class="num">Count</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let b of data.buckets">
              <td>{{ b.bucketStart }}</td>
              <td class="num" *ngIf="data.metricType !== 'BLOOD_PRESSURE' && data.metricType !== 'WORKOUT'">{{ b.avg }}</td>
              <td class="num" *ngIf="data.metricType !== 'BLOOD_PRESSURE' && data.metricType !== 'WORKOUT'">{{ b.min }}</td>
              <td class="num" *ngIf="data.metricType !== 'BLOOD_PRESSURE' && data.metricType !== 'WORKOUT'">{{ b.max }}</td>
              <td class="num" *ngIf="data.metricType === 'BLOOD_PRESSURE'">{{ b.avgSystolic }} / {{ b.avgDiastolic }}</td>
              <td class="num" *ngIf="data.metricType === 'WORKOUT'">{{ b.totalDurationMinutes }} min</td>
              <td class="num">{{ b.count }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      </ng-container>
    </div>
  `,
  styles: [`
    /* ── Hero */
    .dash-hero {
      position: relative; overflow: hidden;
      background: var(--color-card);
      border-radius: var(--radius-xl);
      box-shadow: var(--shadow-sm);
      padding: 1.75rem 2rem;
      margin-bottom: 1.5rem;
    }
    .dash-hero__blob {
      position: absolute; border-radius: 50%; pointer-events: none; filter: blur(40px);
    }
    .dash-hero__blob--a { width: 260px; height: 260px; top: -110px; right: -60px; background: var(--color-primary-light); opacity: .55; }
    .dash-hero__blob--b { width: 180px; height: 180px; bottom: -100px; right: 22%; background: var(--color-surface-sub); opacity: .7; }
    .dash-hero__content { position: relative; z-index: 1; }
    .dash-hero__title { margin: 0 0 .3rem; font-size: 1.625rem; font-weight: 800; color: var(--color-ink); letter-spacing: -.02em; }
    .dash-hero__subtitle { margin: 0; font-size: .9375rem; color: var(--color-text-secondary); }

    /* ── Onboarding checklist (zero-data state) */
    .onboarding-card { margin-bottom: 1.5rem; }
    .onboarding-card__title { margin: 0 0 .25rem; font-size: 1.125rem; font-weight: 700; color: var(--color-ink); }
    .onboarding-card__text { margin: 0 0 1.25rem; font-size: .875rem; color: var(--color-text-secondary); }
    .onboarding-steps { display: flex; flex-direction: column; gap: .6rem; }
    .onboarding-step {
      display: flex; align-items: center; gap: .9rem;
      padding: .9rem 1.1rem; border-radius: var(--radius-lg);
      background: var(--color-surface-sub); border: 1px solid transparent;
      text-decoration: none; transition: background .12s, border-color .12s;
    }
    .onboarding-step:hover { background: var(--color-primary-muted); border-color: var(--color-primary-light); }
    .onboarding-step__icon {
      width: 40px; height: 40px; border-radius: 50%; flex-shrink: 0;
      background: var(--color-card); color: var(--color-primary);
      display: flex; align-items: center; justify-content: center;
      font-size: 1.1rem; box-shadow: var(--shadow-sm);
    }
    .onboarding-step__body { display: flex; flex-direction: column; gap: .1rem; flex: 1; min-width: 0; }
    .onboarding-step__title { font-weight: 700; font-size: .9375rem; color: var(--color-ink); }
    .onboarding-step__sub { font-size: .8125rem; color: var(--color-text-secondary); }
    .onboarding-step__arrow { color: var(--color-primary); font-weight: 700; flex-shrink: 0; }

    /* ── Controls */
    .dash-controls { padding: 1rem 1.25rem; margin-bottom: 1.5rem; }
    .dash-controls__row { display:flex; flex-wrap:wrap; gap:1rem; align-items:flex-end; }
    .ctrl-group { display:flex; flex-direction:column; gap:.3rem; }
    .ctrl-label { font-size:.75rem; font-weight:600; color:var(--color-text-muted); text-transform:uppercase; letter-spacing:.04em; }
    .ctrl-group select, .ctrl-group input[type=date] {
      padding:.4rem .65rem; border:1.5px solid var(--color-border);
      border-radius:var(--radius-md); font-size:.875rem; font-family:inherit;
      color:var(--color-text); background:var(--color-card); outline:none;
    }
    .ctrl-group select:focus, .ctrl-group input[type=date]:focus {
      border-color:var(--color-primary); box-shadow: 0 0 0 3px var(--color-primary-glow);
    }
    .presets { display:flex; gap:.25rem; background: var(--color-surface-sub); padding: .2rem; border-radius: var(--radius-md); }
    .preset-btn {
      padding:.35rem .65rem; border:none; border-radius:calc(var(--radius-md) - 2px);
      color:var(--color-text-secondary); background:transparent;
      font-size:.8125rem; font-weight:700; cursor:pointer;
      transition:background .12s, color .12s; font-family:inherit;
    }
    .preset-btn:hover { color: var(--color-ink); }
    .preset-btn.active { background:var(--color-card); color:var(--color-primary); box-shadow: var(--shadow-sm); }

    /* ── Metric tiles */
    .tile-row {
      display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
      gap: 1rem; margin-bottom: 1.5rem;
    }
    .tile {
      background: var(--color-card); border: 1px solid var(--color-border);
      border-radius: var(--radius-lg); box-shadow: var(--shadow-sm);
      padding: 1rem 1.15rem; display: flex; flex-direction: column; gap: .5rem;
    }
    .tile__label { font-size: .6875rem; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; color: var(--color-text-muted); }
    .tile__value { font-size: 1.5rem; font-weight: 700; color: var(--color-ink); font-variant-numeric: tabular-nums; letter-spacing: -.01em; }
    .tile__unit { font-size: .75rem; font-weight: 500; color: var(--color-text-secondary); }
    .tile__foot { display: flex; align-items: center; justify-content: space-between; gap: .5rem; }
    .tile__sub { font-size: .75rem; color: var(--color-text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .tile__spark { width: 56px; height: 22px; color: var(--color-primary); flex-shrink: 0; }

    .chart-card { padding:1.25rem; }
    .chart-wrapper { position:relative; height:340px; }
    .data-table th.num, .data-table td.num { text-align:right; }

    /* ── AI Trend card */
    .ai-trend-card { padding:1.15rem 1.25rem; margin-top: 1.25rem; }
    .ai-trend-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:.65rem; gap: .75rem; flex-wrap: wrap; }
    .ai-trend-title { display:flex; align-items:center; gap:.5rem; font-weight:700; font-size:.9rem; color: var(--color-ink); }
    .ai-trend-btn { padding:.4rem .85rem; background:var(--color-primary); color:var(--color-text-on-primary); border:none; border-radius:var(--radius-md); font-size:.8125rem; font-weight:600; cursor:pointer; font-family:inherit; }
    .ai-trend-btn:hover:not(:disabled) { background: var(--color-primary-dark); }
    .ai-trend-btn:disabled { opacity:.6; cursor:not-allowed; }
    .ai-trend-text { margin:.5rem 0; font-size:.9rem; white-space:pre-wrap; color:var(--color-text); }
    .ai-trend-nodata { margin:.5rem 0; font-size:.875rem; color:var(--color-text-secondary); font-style:italic; }
    .ai-trend-error { color:var(--color-danger); font-size:.875rem; margin:.5rem 0; }
    .ai-disclaimer { margin:.5rem 0 0; font-size:.75rem; color:var(--color-text-muted); font-style:italic; }
  `]
})
export class DashboardComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('chartCanvas') canvasRef!: ElementRef<HTMLCanvasElement>;

  private svc          = inject(MetricsService);
  private docsSvc      = inject(DocumentsService);
  private connectivity = inject(ConnectivityService);
  private auth         = inject(AuthService);
  private ai           = inject(AiService);
  private chart:        Chart | null = null;
  private reconnectSub?: Subscription;

  aiEnabled           = false;
  narratingTrend      = false;
  narration:           NarrationResponse | null = null;
  trendNarrationError: string | null = null;

  checkingOnboarding = true;
  hasAnyMetrics      = false;
  hasAnyDocuments    = false;

  /** Shown instead of the chart/controls when the user has never logged a metric or uploaded a document. */
  get showOnboarding(): boolean {
    return !this.checkingOnboarding && !this.hasAnyMetrics && !this.hasAnyDocuments;
  }

  constructor() {
    this.ai.getStatus().subscribe(s => this.aiEnabled = s.enabled);
  }

  readonly metricTypes: MetricType[] = [
    'BLOOD_PRESSURE', 'BLOOD_SUGAR', 'WEIGHT', 'WORKOUT', 'HEART_RATE'
  ];

  metricType:  MetricType          = 'WEIGHT';
  granularity: DashboardGranularity = 'DAY';
  fromDate     = '';
  toDate       = '';
  data:        DashboardResponse | null = null;
  loading      = false;
  errorMsg     = '';
  activePreset: number | null = 30;
  metricTiles: MetricTile[] = [];

  private viewReady = false;

  ngOnInit(): void {
    this.setPreset(30);
    this.checkOnboardingState();
    // Refresh dashboard data automatically when connectivity is restored
    this.reconnectSub = this.connectivity.reconnected$.subscribe(() => this.load());
  }

  /** Lightweight (size=1) existence checks — purely to decide whether to show the getting-started checklist. */
  private checkOnboardingState(): void {
    forkJoin({
      metrics:   this.svc.list({ page: 0, size: 1 }),
      documents: this.docsSvc.list({ page: 0, size: 1 }),
    }).subscribe({
      next: ({ metrics, documents }) => {
        this.hasAnyMetrics   = metrics.totalElements > 0;
        this.hasAnyDocuments = documents.totalElements > 0;
        this.checkingOnboarding = false;
      },
      error: () => { this.checkingOnboarding = false; }, // fail open — show the normal dashboard
    });
  }
  ngAfterViewInit(): void { this.viewReady = true; if (this.data) this.renderChart(); }
  ngOnDestroy(): void {
    this.chart?.destroy();
    this.reconnectSub?.unsubscribe();
  }

  greeting(): string {
    const h = new Date().getHours();
    const period = h < 12 ? 'morning' : h < 18 ? 'afternoon' : 'evening';
    const first = this.auth.currentUser()?.fullName?.split(' ')[0];
    return first ? `Good ${period}, ${first}` : `Good ${period}`;
  }

  setPreset(days: number): void {
    this.activePreset = days;
    const to   = new Date();
    const from = new Date();
    from.setDate(from.getDate() - days);
    this.toDate   = to.toISOString().slice(0, 10);
    this.fromDate = from.toISOString().slice(0, 10);
    this.load();
  }

  onCustomDate(): void {
    this.activePreset = null;
    this.load();
  }

  load(): void {
    if (!this.fromDate || !this.toDate) return;
    this.loading  = true;
    this.errorMsg = '';

    this.svc.dashboard({
      metricType:  this.metricType,
      from:        new Date(this.fromDate).toISOString(),
      to:          new Date(this.toDate + 'T23:59:59').toISOString(),
      granularity: this.granularity,
    }).subscribe({
      next: (res) => {
        this.data    = res;
        this.loading = false;
        this.metricTiles = this.buildTiles();
        if (this.viewReady) this.renderChart();
      },
      error: () => { this.errorMsg = 'Failed to load dashboard.'; this.loading = false; },
    });
  }

  private renderChart(): void {
    this.chart?.destroy();
    if (!this.data || !this.canvasRef) return;

    const labels  = this.data.buckets.map(b => b.bucketStart);
    const datasets = this.buildDatasets();

    const chartData: ChartData = { labels, datasets };
    const options:  ChartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: 'top' } },
      scales:  { y: { beginAtZero: false } },
    };

    this.chart = new Chart(this.canvasRef.nativeElement, {
      type: 'line',
      data: chartData,
      options,
    });
  }

  getNarration(): void {
    if (this.narratingTrend) return;
    this.narratingTrend      = true;
    this.narration           = null;
    this.trendNarrationError = null;

    this.ai.getTrendNarration(this.metricType).subscribe({
      next: r => { this.narration = r; this.narratingTrend = false; },
      error: err => {
        this.trendNarrationError = err?.status === 503
          ? 'AI features are not available on this server.'
          : 'Failed to load trend analysis. Please try again.';
        this.narratingTrend = false;
      }
    });
  }

  /** Renders a compact SVG polyline path (viewBox 0 0 100 28) from a numeric series. */
  sparklinePath(values: number[]): string {
    if (values.length < 2) return '';
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const stepX = 100 / (values.length - 1);
    return values
      .map((v, i) => {
        const x = i * stepX;
        const y = 26 - ((v - min) / range) * 24;
        return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  }

  private unitFor(t: MetricType): string {
    switch (t) {
      case 'BLOOD_SUGAR': return 'mg/dL';
      case 'WEIGHT':      return 'kg';
      case 'HEART_RATE':  return 'bpm';
      default:            return '';
    }
  }

  /** Summary tiles computed entirely from the already-loaded bucket data — no extra API calls. */
  private buildTiles(): MetricTile[] {
    if (!this.data || this.data.buckets.length === 0) return [];
    const b = this.data.buckets;
    const last = b[b.length - 1];
    const nonNull = (arr: (number | null | undefined)[]) => arr.filter((v): v is number => v != null);
    const avgOf = (arr: number[]) => arr.length ? +(arr.reduce((a, c) => a + c, 0) / arr.length).toFixed(1) : 0;
    const totalCount = b.reduce((a, c) => a + c.count, 0);

    switch (this.data.metricType) {
      case 'BLOOD_PRESSURE': {
        const sys = nonNull(b.map(x => x.avgSystolic));
        const dia = nonNull(b.map(x => x.avgDiastolic));
        return [
          { label: 'Latest',   value: `${last.avgSystolic ?? '–'}/${last.avgDiastolic ?? '–'}`, unit: 'mmHg', sub: last.bucketStart, points: sys },
          { label: 'Average',  value: `${avgOf(sys)}/${avgOf(dia)}`, unit: 'mmHg', sub: 'across period', points: sys },
          { label: 'Readings', value: `${totalCount}`, unit: '', sub: `${b.length} periods`, points: [] },
        ];
      }
      case 'WORKOUT': {
        const durations = nonNull(b.map(x => x.totalDurationMinutes));
        const totalMin = durations.reduce((a, c) => a + c, 0);
        return [
          { label: 'Latest',  value: `${last.totalDurationMinutes ?? 0}`, unit: 'min', sub: last.bucketStart, points: durations },
          { label: 'Average', value: `${avgOf(durations)}`, unit: 'min/period', sub: 'across period', points: durations },
          { label: 'Total',   value: `${totalMin}`, unit: 'min', sub: `${totalCount} sessions`, points: [] },
        ];
      }
      default: {
        const avgs = nonNull(b.map(x => x.avg));
        const mins = nonNull(b.map(x => x.min));
        const maxs = nonNull(b.map(x => x.max));
        const unit = this.unitFor(this.data.metricType);
        return [
          { label: 'Latest',  value: `${last.avg ?? '–'}`, unit, sub: last.bucketStart, points: avgs },
          { label: 'Average', value: `${avgOf(avgs)}`, unit, sub: 'across period', points: avgs },
          { label: 'Min',     value: `${mins.length ? Math.min(...mins) : '–'}`, unit, sub: 'lowest', points: mins },
          { label: 'Max',     value: `${maxs.length ? Math.max(...maxs) : '–'}`, unit, sub: 'highest', points: maxs },
        ];
      }
    }
  }

  private buildDatasets(): ChartData['datasets'] {
    if (!this.data) return [];
    const b = this.data.buckets;

    switch (this.data.metricType) {
      case 'BLOOD_PRESSURE':
        return [
          { label: 'Avg Systolic',  data: b.map(r => r.avgSystolic  ?? null), borderColor: '#0d9488', tension: 0.3 },
          { label: 'Avg Diastolic', data: b.map(r => r.avgDiastolic ?? null), borderColor: '#6bd8cb', tension: 0.3 },
        ];
      case 'WORKOUT':
        return [{ label: 'Total Duration (min)', data: b.map(r => r.totalDurationMinutes ?? null),
          borderColor: '#8b5cf6', backgroundColor: 'rgba(139,92,246,0.15)', fill: true, tension: 0.3 }];
      default:
        return [
          { label: 'Avg', data: b.map(r => r.avg ?? null), borderColor: '#0d9488', tension: 0.3 },
          { label: 'Min', data: b.map(r => r.min ?? null), borderColor: '#10b981', tension: 0.3, borderDash: [4,4] },
          { label: 'Max', data: b.map(r => r.max ?? null), borderColor: '#f59e0b', tension: 0.3, borderDash: [4,4] },
        ];
    }
  }
}
