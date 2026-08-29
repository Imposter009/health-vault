import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MetricsService } from '../metrics.service';
import { MetricResponse, MetricType, PageResponse, formatValue } from '../models';

@Component({
  selector: 'app-metrics-list',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  template: `
    <div class="page-container">
      <div class="page-header">
        <div>
          <h1 class="page-title">My Health Metrics</h1>
        </div>
        <a routerLink="/metrics/new" class="btn btn-primary">+ Log Metric</a>
      </div>

      <!-- Filters -->
      <div class="filters" style="margin-bottom:1rem;">
        <label>
          Type
          <select [(ngModel)]="filterType" (change)="loadPage(0)">
            <option value="">All types</option>
            <option *ngFor="let t of metricTypes" [value]="t">{{ t | titlecase }}</option>
          </select>
        </label>
        <label>
          From
          <input type="date" [(ngModel)]="filterFrom" (change)="loadPage(0)" />
        </label>
        <label>
          To
          <input type="date" [(ngModel)]="filterTo" (change)="loadPage(0)" />
        </label>
        <div style="display:flex;align-items:flex-end;">
          <button class="btn btn-ghost btn-sm" (click)="clearFilters()">Clear filters</button>
        </div>
      </div>

      <div *ngIf="loading" class="state-msg">Loading…</div>
      <div *ngIf="errorMsg" class="state-msg error">{{ errorMsg }}</div>

      <div class="card" style="padding:0;overflow:hidden;" *ngIf="!loading && page && page.content.length > 0">
        <table class="data-table">
          <thead>
            <tr>
              <th>Type</th>
              <th>Value</th>
              <th>Recorded At</th>
              <th>Notes</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let m of page.content">
              <td>
                <span class="type-chip">{{ m.metricType | titlecase }}</span>
              </td>
              <td class="num">{{ fmt(m) }}</td>
              <td>{{ m.recordedAt | date:'d MMM y, HH:mm' }}</td>
              <td style="color:var(--color-text-secondary,#64748b);font-size:.875rem;">{{ m.notes ?? '—' }}</td>
              <td>
                <button class="btn btn-danger btn-sm" (click)="deleteMetric(m)">Delete</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div *ngIf="!loading && page?.content?.length === 0" class="state-msg empty">
        No metrics logged yet.
        <a routerLink="/metrics/new" class="btn btn-primary btn-sm" style="margin-top:.75rem;">Log your first metric</a>
      </div>

      <!-- Pagination -->
      <div *ngIf="page && page.totalPages > 1" class="pagination">
        <button [disabled]="currentPage === 0" (click)="loadPage(currentPage - 1)">‹ Prev</button>
        <span>Page {{ currentPage + 1 }} of {{ page.totalPages }}</span>
        <button [disabled]="page.last" (click)="loadPage(currentPage + 1)">Next ›</button>
      </div>
    </div>
  `,
  styles: [`
    .num { font-variant-numeric:tabular-nums; text-align:right; }
    .type-chip {
      display:inline-block; padding:.2rem .6rem;
      background:var(--color-primary-light,#ccfbf1);
      color:var(--color-primary,#0f766e);
      border-radius:var(--radius-pill,9999px);
      font-size:.75rem; font-weight:600;
    }
    .data-table th:last-child,
    .data-table td:last-child { text-align:right; }
  `]
})
export class MetricsListComponent implements OnInit {
  private svc    = inject(MetricsService);
  private router = inject(Router);

  readonly metricTypes: MetricType[] = [
    'BLOOD_PRESSURE', 'BLOOD_SUGAR', 'WEIGHT', 'WORKOUT', 'HEART_RATE'
  ];

  page:        PageResponse<MetricResponse> | null = null;
  currentPage  = 0;
  loading      = false;
  errorMsg     = '';
  filterType:  MetricType | '' = '';
  filterFrom   = '';
  filterTo     = '';

  ngOnInit(): void { this.loadPage(0); }

  loadPage(p: number): void {
    this.loading = true;
    this.errorMsg = '';
    this.currentPage = p;

    const opts: Parameters<MetricsService['list']>[0] = { page: p, size: 20 };
    if (this.filterType) opts.metricType = this.filterType as MetricType;
    if (this.filterFrom) opts.from = new Date(this.filterFrom).toISOString();
    if (this.filterTo)   opts.to   = new Date(this.filterTo + 'T23:59:59').toISOString();

    this.svc.list(opts).subscribe({
      next:  (r) => { this.page = r; this.loading = false; },
      error: ()  => { this.errorMsg = 'Failed to load metrics.'; this.loading = false; },
    });
  }

  deleteMetric(m: MetricResponse): void {
    if (!confirm(`Delete this ${m.metricType} reading?`)) return;
    this.svc.delete(m.id).subscribe({
      next:  () => this.loadPage(this.currentPage),
      error: () => { this.errorMsg = 'Failed to delete metric.'; },
    });
  }

  clearFilters(): void {
    this.filterType = '';
    this.filterFrom = '';
    this.filterTo   = '';
    this.loadPage(0);
  }

  fmt(m: MetricResponse): string {
    return formatValue(m.metricType, m.value);
  }
}
