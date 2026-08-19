import { Component, OnInit, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { AuditLogService } from './audit-log.service';
import {
  AuditLogEntry,
  AuditLogFilter,
  AuditAction,
  PagedAuditLog,
  ACTION_LABELS,
  ACTION_CATEGORIES,
} from './models';

interface DayGroup {
  label: string;
  entries: AuditLogEntry[];
}

@Component({
  selector: 'app-audit-log',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, DatePipe],
  template: `
    <div class="audit-log-page">
      <header class="page-header">
        <a routerLink="/profile" class="back-link">← Back to profile</a>
        <h1>Activity &amp; Access Log</h1>
        <p class="subtitle">A record of all security events and data access for your account.</p>
      </header>

      <!-- Filters -->
      <section class="filters">
        <label>
          Event type
          <select [(ngModel)]="filter.action" (ngModelChange)="onFilterChange()">
            <option value="">All events</option>
            <option *ngFor="let a of allActions" [value]="a">{{ labelFor(a) }}</option>
          </select>
        </label>
        <label>
          From
          <input type="date" [(ngModel)]="filter.from" (ngModelChange)="onFilterChange()" />
        </label>
        <label>
          To
          <input type="date" [(ngModel)]="filter.to" (ngModelChange)="onFilterChange()" />
        </label>
        <button class="btn-secondary" (click)="clearFilters()">Clear</button>
      </section>

      <!-- Loading / error -->
      <div *ngIf="loading" class="state-message">Loading…</div>
      <div *ngIf="error" class="state-message error">{{ error }}</div>

      <!-- Day groups -->
      <ng-container *ngIf="!loading && !error">
        <div *ngIf="groups.length === 0" class="state-message">No activity found.</div>

        <div *ngFor="let group of groups" class="day-group">
          <h2 class="day-label">{{ group.label }}</h2>
          <ul class="entry-list">
            <li *ngFor="let entry of group.entries" class="entry"
                [class.entry--auth]="categoryFor(entry.action) === 'auth'"
                [class.entry--document]="categoryFor(entry.action) === 'document'"
                [class.entry--metric]="categoryFor(entry.action) === 'metric'"
                [class.entry--failure]="entry.action === 'LOGIN_FAILURE'">
              <span class="entry__icon">{{ iconFor(entry.action) }}</span>
              <div class="entry__body">
                <span class="entry__action">{{ labelFor(entry.action) }}</span>
                <span class="entry__meta">
                  {{ entry.createdAt | date:'HH:mm:ss' }}
                  <span *ngIf="entry.ipAddress"> · {{ entry.ipAddress }}</span>
                </span>
              </div>
              <span *ngIf="entry.action === 'LOGIN_FAILURE'" class="entry__badge entry__badge--warn">
                Failed
              </span>
            </li>
          </ul>
        </div>

        <!-- Pagination -->
        <nav *ngIf="totalPages > 1" class="pagination">
          <button [disabled]="currentPage === 0" (click)="goToPage(currentPage - 1)">
            Previous
          </button>
          <span>Page {{ currentPage + 1 }} of {{ totalPages }}</span>
          <button [disabled]="currentPage >= totalPages - 1" (click)="goToPage(currentPage + 1)">
            Next
          </button>
        </nav>
      </ng-container>
    </div>
  `,
  styles: [`
    .audit-log-page { max-width: 720px; margin: 0 auto; padding: 24px 16px; font-family: system-ui, sans-serif; }
    .page-header { margin-bottom: 24px; }
    .back-link { font-size: 0.875rem; color: #6366f1; text-decoration: none; }
    .back-link:hover { text-decoration: underline; }
    h1 { margin: 8px 0 4px; font-size: 1.5rem; }
    .subtitle { color: #6b7280; font-size: 0.9rem; margin: 0; }

    .filters { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 24px; align-items: flex-end; }
    .filters label { display: flex; flex-direction: column; font-size: 0.8rem; gap: 4px; color: #374151; }
    .filters select, .filters input { padding: 6px 8px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 0.875rem; }
    .btn-secondary { padding: 6px 14px; border: 1px solid #d1d5db; border-radius: 6px; background: #f9fafb; cursor: pointer; font-size: 0.875rem; }
    .btn-secondary:hover { background: #f3f4f6; }

    .state-message { text-align: center; color: #6b7280; padding: 40px 0; }
    .state-message.error { color: #ef4444; }

    .day-group { margin-bottom: 28px; }
    .day-label { font-size: 0.8rem; font-weight: 600; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.05em; margin: 0 0 10px; }

    .entry-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 2px; }
    .entry { display: flex; align-items: center; gap: 12px; padding: 10px 14px; border-radius: 8px; background: #f9fafb; }
    .entry--failure { background: #fef2f2; }
    .entry__icon { font-size: 1.1rem; flex-shrink: 0; }
    .entry__body { flex: 1; display: flex; flex-direction: column; gap: 2px; }
    .entry__action { font-size: 0.875rem; font-weight: 500; }
    .entry__meta { font-size: 0.78rem; color: #9ca3af; }
    .entry__badge { font-size: 0.72rem; padding: 2px 8px; border-radius: 9999px; font-weight: 600; }
    .entry__badge--warn { background: #fee2e2; color: #b91c1c; }

    .pagination { display: flex; justify-content: center; align-items: center; gap: 16px; padding: 16px 0; }
    .pagination button { padding: 6px 16px; border: 1px solid #d1d5db; border-radius: 6px; cursor: pointer; }
    .pagination button:disabled { opacity: 0.4; cursor: default; }
  `]
})
export class AuditLogComponent implements OnInit {
  private readonly svc = inject(AuditLogService);

  groups: DayGroup[] = [];
  totalPages = 0;
  currentPage = 0;
  loading = false;
  error: string | null = null;

  filter: AuditLogFilter & { action?: string } = { page: 0, size: 20 };

  readonly allActions: AuditAction[] = [
    'LOGIN_SUCCESS', 'LOGIN_FAILURE', 'LOGOUT', 'REGISTER',
    'DOCUMENT_UPLOADED', 'DOCUMENT_VIEWED', 'DOCUMENT_DELETED',
    'METRIC_CREATED', 'METRIC_UPDATED', 'METRIC_DELETED',
  ];

  ngOnInit(): void {
    this.load();
  }

  onFilterChange(): void {
    this.filter.page = 0;
    this.currentPage = 0;
    this.load();
  }

  clearFilters(): void {
    this.filter = { page: 0, size: 20 };
    this.currentPage = 0;
    this.load();
  }

  goToPage(page: number): void {
    this.currentPage = page;
    this.filter.page = page;
    this.load();
  }

  labelFor(action: string): string {
    return ACTION_LABELS[action as AuditAction] ?? action;
  }

  categoryFor(action: string) {
    return ACTION_CATEGORIES[action as AuditAction] ?? 'auth';
  }

  iconFor(action: string): string {
    const icons: Record<string, string> = {
      LOGIN_SUCCESS: '✅', LOGIN_FAILURE: '⚠️', LOGOUT: '🚪', REGISTER: '🎉',
      DOCUMENT_UPLOADED: '📤', DOCUMENT_VIEWED: '👁️', DOCUMENT_DOWNLOADED: '⬇️', DOCUMENT_DELETED: '🗑️',
      METRIC_CREATED: '➕', METRIC_UPDATED: '✏️', METRIC_DELETED: '🗑️',
    };
    return icons[action] ?? '•';
  }

  private load(): void {
    this.loading = true;
    this.error = null;
    const f: AuditLogFilter = {
      page: this.filter.page ?? 0,
      size: this.filter.size ?? 20,
    };
    if (this.filter.action) f.action = this.filter.action as AuditAction;
    if (this.filter.from)   f.from = new Date(this.filter.from + 'T00:00:00').toISOString();
    if (this.filter.to)     f.to   = new Date(this.filter.to   + 'T23:59:59').toISOString();

    this.svc.getMyLog(f).subscribe({
      next: (page: PagedAuditLog) => {
        this.groups = this.groupByDay(page.content);
        this.totalPages = page.totalPages;
        this.loading = false;
      },
      error: () => {
        this.error = 'Failed to load activity log. Please try again.';
        this.loading = false;
      }
    });
  }

  private groupByDay(entries: AuditLogEntry[]): DayGroup[] {
    const map = new Map<string, AuditLogEntry[]>();
    for (const e of entries) {
      const day = new Date(e.createdAt).toLocaleDateString('en-GB', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
      });
      if (!map.has(day)) map.set(day, []);
      map.get(day)!.push(e);
    }
    return Array.from(map.entries()).map(([label, items]) => ({ label, entries: items }));
  }
}
