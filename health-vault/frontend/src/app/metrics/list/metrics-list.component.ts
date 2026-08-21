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
    <div class="list-container">
      <div class="list-header">
        <h2>My Health Metrics</h2>
        <a routerLink="/metrics/new" class="btn-primary">+ Log Metric</a>
      </div>

      <!-- Filters -->
      <div class="filters">
        <select [(ngModel)]="filterType" (change)="loadPage(0)">
          <option value="">All Types</option>
          <option *ngFor="let t of metricTypes" [value]="t">{{ t }}</option>
        </select>
        <input type="date" [(ngModel)]="filterFrom" placeholder="From" (change)="loadPage(0)" />
        <input type="date" [(ngModel)]="filterTo"   placeholder="To"   (change)="loadPage(0)" />
        <button (click)="clearFilters()">Clear</button>
      </div>

      <div *ngIf="loading" class="loading">Loading…</div>
      <div *ngIf="errorMsg" class="error">{{ errorMsg }}</div>

      <table *ngIf="!loading && page">
        <thead>
          <tr>
            <th>Type</th><th>Value</th><th>Recorded At</th><th>Notes</th><th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let m of page.content">
            <td>{{ m.metricType }}</td>
            <td>{{ fmt(m) }}</td>
            <td>{{ m.recordedAt | date:'medium' }}</td>
            <td>{{ m.notes ?? '—' }}</td>
            <td class="actions-cell">
              <button class="btn-sm" (click)="deleteMetric(m)">Delete</button>
            </td>
          </tr>
        </tbody>
      </table>

      <p *ngIf="!loading && page?.content?.length === 0" class="empty">No metrics logged yet.</p>

      <!-- Pagination -->
      <div *ngIf="page && page.totalPages > 1" class="pagination">
        <button [disabled]="currentPage === 0" (click)="loadPage(currentPage - 1)">‹ Prev</button>
        <span>Page {{ currentPage + 1 }} of {{ page.totalPages }}</span>
        <button [disabled]="page.last" (click)="loadPage(currentPage + 1)">Next ›</button>
      </div>
    </div>
  `,
  styles: [`
    .list-container { max-width: 900px; margin: 2rem auto; padding: 0 1rem; }
    .list-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; }
    .btn-primary { background: #2563eb; color: white; padding: 0.4rem 1rem;
      border-radius: 4px; text-decoration: none; font-size: 0.9rem; }
    .filters { display: flex; gap: 0.5rem; margin-bottom: 1rem; flex-wrap: wrap; }
    .filters select, .filters input { padding: 0.3rem 0.5rem; border: 1px solid #ccc; border-radius: 4px; }
    .filters button { padding: 0.3rem 0.7rem; cursor: pointer; }
    table { width: 100%; border-collapse: collapse; }
    th, td { text-align: left; padding: 0.5rem 0.75rem; border-bottom: 1px solid #e5e7eb; }
    th { background: #f9fafb; font-weight: 600; }
    .actions-cell { display: flex; gap: 0.3rem; }
    .btn-sm { padding: 0.2rem 0.5rem; font-size: 0.8rem; cursor: pointer;
      border: 1px solid #ccc; border-radius: 3px; background: white; }
    .btn-sm:hover { background: #fee2e2; border-color: #dc2626; color: #dc2626; }
    .pagination { display: flex; gap: 1rem; align-items: center; justify-content: center; margin-top: 1rem; }
    .loading, .empty { text-align: center; color: #6b7280; padding: 2rem; }
    .error { color: #dc2626; margin-bottom: 0.5rem; }
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
