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
import { MetricsService } from '../metrics/metrics.service';
import { DashboardGranularity, DashboardResponse, MetricType } from '../metrics/models';

Chart.register(...registerables);

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="dash-container">
      <h2>Health Dashboard</h2>

      <!-- Controls -->
      <div class="controls">
        <select [(ngModel)]="metricType" (change)="load()">
          <option *ngFor="let t of metricTypes" [value]="t">{{ t }}</option>
        </select>

        <select [(ngModel)]="granularity" (change)="load()">
          <option value="DAY">Daily</option>
          <option value="WEEK">Weekly</option>
          <option value="MONTH">Monthly</option>
        </select>

        <div class="presets">
          <button (click)="setPreset(7)">7 days</button>
          <button (click)="setPreset(30)">30 days</button>
          <button (click)="setPreset(90)">90 days</button>
        </div>

        <input type="date" [(ngModel)]="fromDate" (change)="load()" />
        <input type="date" [(ngModel)]="toDate"   (change)="load()" />
      </div>

      <div *ngIf="loading" class="loading">Loading…</div>
      <div *ngIf="errorMsg" class="error">{{ errorMsg }}</div>
      <div *ngIf="!loading && !errorMsg && data?.buckets?.length === 0" class="empty">
        No data for the selected period.
      </div>

      <div class="chart-wrapper">
        <canvas #chartCanvas></canvas>
      </div>

      <!-- Summary table -->
      <table *ngIf="data && data.buckets.length > 0" class="summary-table">
        <thead>
          <tr>
            <th>Period</th>
            <th *ngIf="data.metricType !== 'BLOOD_PRESSURE' && data.metricType !== 'WORKOUT'">Avg</th>
            <th *ngIf="data.metricType !== 'BLOOD_PRESSURE' && data.metricType !== 'WORKOUT'">Min</th>
            <th *ngIf="data.metricType !== 'BLOOD_PRESSURE' && data.metricType !== 'WORKOUT'">Max</th>
            <th *ngIf="data.metricType === 'BLOOD_PRESSURE'">Avg Sys/Dia</th>
            <th *ngIf="data.metricType === 'WORKOUT'">Total Duration</th>
            <th>Count</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let b of data.buckets">
            <td>{{ b.bucketStart }}</td>
            <td *ngIf="data.metricType !== 'BLOOD_PRESSURE' && data.metricType !== 'WORKOUT'">{{ b.avg }}</td>
            <td *ngIf="data.metricType !== 'BLOOD_PRESSURE' && data.metricType !== 'WORKOUT'">{{ b.min }}</td>
            <td *ngIf="data.metricType !== 'BLOOD_PRESSURE' && data.metricType !== 'WORKOUT'">{{ b.max }}</td>
            <td *ngIf="data.metricType === 'BLOOD_PRESSURE'">{{ b.avgSystolic }}/{{ b.avgDiastolic }}</td>
            <td *ngIf="data.metricType === 'WORKOUT'">{{ b.totalDurationMinutes }} min</td>
            <td>{{ b.count }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  `,
  styles: [`
    .dash-container { max-width: 900px; margin: 2rem auto; padding: 0 1rem; }
    .controls { display: flex; gap: 0.5rem; margin-bottom: 1.5rem; flex-wrap: wrap; align-items: center; }
    .controls select, .controls input { padding: 0.3rem 0.5rem; border: 1px solid #ccc; border-radius: 4px; }
    .presets { display: flex; gap: 0.3rem; }
    .presets button { padding: 0.3rem 0.7rem; cursor: pointer; border: 1px solid #2563eb;
      border-radius: 4px; color: #2563eb; background: white; font-size: 0.85rem; }
    .presets button:hover { background: #eff6ff; }
    .chart-wrapper { position: relative; height: 350px; margin-bottom: 1.5rem; }
    .summary-table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
    th, td { padding: 0.4rem 0.75rem; border-bottom: 1px solid #e5e7eb; text-align: left; }
    th { background: #f9fafb; font-weight: 600; }
    .loading, .empty { text-align: center; color: #6b7280; padding: 2rem; }
    .error { color: #dc2626; margin-bottom: 0.5rem; }
  `]
})
export class DashboardComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('chartCanvas') canvasRef!: ElementRef<HTMLCanvasElement>;

  private svc   = inject(MetricsService);
  private chart: Chart | null = null;

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

  ngOnInit(): void { this.setPreset(30); }
  ngAfterViewInit(): void { this.viewReady = true; if (this.data) this.renderChart(); }
  ngOnDestroy(): void { this.chart?.destroy(); }

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
