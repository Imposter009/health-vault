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
import { Chart, ChartData, ChartOptions, registerables } from 'chart.js';
import { Subscription } from 'rxjs';
import { MetricsService } from '../metrics/metrics.service';
import { DashboardGranularity, DashboardResponse, MetricType } from '../metrics/models';
import { ConnectivityService } from '../core/connectivity.service';
import { AiService, NarrationResponse } from '../ai/ai.service';

Chart.register(...registerables);

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page-container">
      <div class="page-header">
        <div>
          <h1 class="page-title">Health Dashboard</h1>
          <p class="page-subtitle">Trends and aggregates for your tracked metrics.</p>
        </div>
      </div>

      <!-- Controls -->
      <div class="dash-controls card" style="margin-bottom:1.5rem;">
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
            <label class="ctrl-label">Presets</label>
            <div class="presets">
              <button class="preset-btn" (click)="setPreset(7)">7 d</button>
              <button class="preset-btn" (click)="setPreset(30)">30 d</button>
              <button class="preset-btn" (click)="setPreset(90)">90 d</button>
            </div>
          </div>
          <div class="ctrl-group">
            <label class="ctrl-label">From</label>
            <input type="date" [(ngModel)]="fromDate" (change)="load()" />
          </div>
          <div class="ctrl-group">
            <label class="ctrl-label">To</label>
            <input type="date" [(ngModel)]="toDate" (change)="load()" />
          </div>
        </div>
      </div>

      <div *ngIf="loading" class="state-msg">Loading chart data…</div>
      <div *ngIf="errorMsg" class="state-msg error">{{ errorMsg }}</div>
      <div *ngIf="!loading && !errorMsg && data?.buckets?.length === 0" class="state-msg empty">
        No data for the selected period.
      </div>

      <div class="card chart-card" *ngIf="!errorMsg">
        <div class="chart-wrapper">
          <canvas #chartCanvas></canvas>
        </div>
      </div>

      <!-- AI Trend Narration — only for numeric metrics when AI is enabled -->
      <div class="card ai-trend-card" style="margin-top:1.25rem;"
           *ngIf="aiEnabled && metricType !== 'BLOOD_PRESSURE' && metricType !== 'WORKOUT'">
        <div class="ai-trend-header">
          <span>AI Trend Analysis</span>
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
      <div class="card" style="margin-top:1.25rem;" *ngIf="data && data.buckets.length > 0">
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
    </div>
  `,
  styles: [`
    .dash-controls { padding: 1rem 1.25rem; }
    .dash-controls__row { display:flex; flex-wrap:wrap; gap:1rem; align-items:flex-end; }
    .ctrl-group { display:flex; flex-direction:column; gap:.3rem; }
    .ctrl-label { font-size:.75rem; font-weight:600; color:var(--color-text-muted,#94a3b8); text-transform:uppercase; letter-spacing:.04em; }
    .ctrl-group select, .ctrl-group input[type=date] {
      padding:.4rem .65rem; border:1.5px solid var(--color-border,#e2e8f0);
      border-radius:var(--radius-md,8px); font-size:.875rem; font-family:inherit;
      color:var(--color-text,#1e293b); background:#fff; outline:none;
    }
    .ctrl-group select:focus, .ctrl-group input[type=date]:focus {
      border-color:var(--color-primary,#0f766e);
    }
    .presets { display:flex; gap:.3rem; }
    .preset-btn {
      padding:.4rem .7rem; border:1.5px solid var(--color-primary,#0f766e);
      border-radius:var(--radius-md,8px); color:var(--color-primary,#0f766e);
      background:#fff; font-size:.8125rem; font-weight:600; cursor:pointer;
      transition:background .12s, color .12s; font-family:inherit;
    }
    .preset-btn:hover { background:var(--color-primary-light,#ccfbf1); }
    .chart-card { padding:1.25rem; }
    .chart-wrapper { position:relative; height:340px; }
    .data-table th.num, .data-table td.num { text-align:right; }
    .ai-trend-card { padding:1rem 1.25rem; }
    .ai-trend-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:.5rem; font-weight:600; font-size:.9rem; color:#065f46; }
    .ai-trend-btn { padding:.3rem .75rem; background:var(--color-primary,#0f766e); color:#fff; border:none; border-radius:4px; font-size:.8125rem; font-weight:600; cursor:pointer; font-family:inherit; }
    .ai-trend-btn:disabled { opacity:.6; cursor:not-allowed; }
    .ai-trend-text { margin:.5rem 0; font-size:.9rem; white-space:pre-wrap; color:#1e293b; }
    .ai-trend-nodata { margin:.5rem 0; font-size:.875rem; color:#64748b; font-style:italic; }
    .ai-trend-error { color:#dc2626; font-size:.875rem; margin:.5rem 0; }
    .ai-disclaimer { margin:.5rem 0 0; font-size:.75rem; color:#94a3b8; font-style:italic; }
  `]
})
export class DashboardComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('chartCanvas') canvasRef!: ElementRef<HTMLCanvasElement>;

  private svc          = inject(MetricsService);
  private connectivity = inject(ConnectivityService);
  private ai           = inject(AiService);
  private chart:        Chart | null = null;
  private reconnectSub?: Subscription;

  aiEnabled           = false;
  narratingTrend      = false;
  narration:           NarrationResponse | null = null;
  trendNarrationError: string | null = null;

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

  private viewReady = false;

  ngOnInit(): void {
    this.setPreset(30);
    // Refresh dashboard data automatically when connectivity is restored
    this.reconnectSub = this.connectivity.reconnected$.subscribe(() => this.load());
  }
  ngAfterViewInit(): void { this.viewReady = true; if (this.data) this.renderChart(); }
  ngOnDestroy(): void {
    this.chart?.destroy();
    this.reconnectSub?.unsubscribe();
  }

  setPreset(days: number): void {
    const to   = new Date();
    const from = new Date();
    from.setDate(from.getDate() - days);
    this.toDate   = to.toISOString().slice(0, 10);
    this.fromDate = from.toISOString().slice(0, 10);
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

  private buildDatasets(): ChartData['datasets'] {
    if (!this.data) return [];
    const b = this.data.buckets;

    switch (this.data.metricType) {
      case 'BLOOD_PRESSURE':
        return [
          { label: 'Avg Systolic',  data: b.map(r => r.avgSystolic  ?? null), borderColor: '#ef4444', tension: 0.3 },
          { label: 'Avg Diastolic', data: b.map(r => r.avgDiastolic ?? null), borderColor: '#f97316', tension: 0.3 },
        ];
      case 'WORKOUT':
        return [{ label: 'Total Duration (min)', data: b.map(r => r.totalDurationMinutes ?? null),
          borderColor: '#8b5cf6', backgroundColor: 'rgba(139,92,246,0.15)', fill: true, tension: 0.3 }];
      default:
        return [
          { label: 'Avg', data: b.map(r => r.avg ?? null), borderColor: '#2563eb', tension: 0.3 },
          { label: 'Min', data: b.map(r => r.min ?? null), borderColor: '#10b981', tension: 0.3, borderDash: [4,4] },
          { label: 'Max', data: b.map(r => r.max ?? null), borderColor: '#f59e0b', tension: 0.3, borderDash: [4,4] },
        ];
    }
  }
}
