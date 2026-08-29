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
    .audit-log-page { max-width: 720px; margin: 0 auto; padding: 2rem 1rem; }
    .page-header { margin-bottom: 1.5rem; }
    h1 { margin: .25rem 0 .25rem; font-size: 1.375rem; font-weight:700; color:var(--color-text,#1e293b); }
    .subtitle { color: var(--color-text-secondary,#64748b); font-size: 0.875rem; margin: 0; }

    .filters { display: flex; gap: .75rem; flex-wrap: wrap; margin-bottom: 1.5rem; align-items: flex-end; }
    .filters label { display: flex; flex-direction: column; font-size: 0.75rem; font-weight:600; gap: 4px; color: var(--color-text-secondary,#64748b); text-transform:uppercase; letter-spacing:.04em; }
    .filters select, .filters input {
      padding: .4rem .65rem; border: 1.5px solid var(--color-border,#e2e8f0);
      border-radius: var(--radius-md,8px); font-size: 0.875rem; font-family:inherit;
      color:var(--color-text,#1e293b); background:#fff; outline:none;
    }
    .filters select:focus, .filters input:focus { border-color:var(--color-primary,#0f766e); }
    .btn-secondary {
      padding: .4rem .9rem; border: 1.5px solid var(--color-border,#e2e8f0);
      border-radius: var(--radius-md,8px); background: #fff; cursor: pointer;
      font-size: 0.875rem; font-family:inherit; color:var(--color-text-secondary,#64748b);
      transition:background .1s;
    }
    .btn-secondary:hover { background: var(--color-surface,#f8fafc); }

    .state-message { text-align: center; color: var(--color-text-muted,#94a3b8); padding: 3rem 0; }
    .state-message.error { color: var(--color-danger,#dc2626); }

    .day-group { margin-bottom: 1.75rem; }
    .day-label {
      font-size: 0.75rem; font-weight: 700; color: var(--color-text-muted,#94a3b8);
      text-transform: uppercase; letter-spacing: 0.06em; margin: 0 0 .5rem;
    }

    .entry-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 2px; }

    .entry {
      display: flex; align-items: center; gap: .75rem;
      padding: .65rem .9rem; border-radius: var(--radius-md,8px);
      background: var(--color-card,#fff);
      border: 1px solid var(--color-border,#e2e8f0);
      transition: background .1s;
    }
    .entry:hover { background: var(--color-surface,#f8fafc); }
    .entry--failure { background: var(--color-danger-bg,#fee2e2); border-color: #fca5a5; }
    .entry--failure:hover { background: #fecaca; }
    .entry--auth   { border-left: 3px solid var(--color-info,#0369a1); }
    .entry--document { border-left: 3px solid var(--color-primary,#0f766e); }
    .entry--metric  { border-left: 3px solid var(--color-warning,#d97706); }

    .entry__icon { font-size: 1rem; flex-shrink: 0; width: 1.5rem; text-align:center; }
    .entry__body { flex: 1; display: flex; flex-direction: column; gap: 1px; min-width:0; }
    .entry__action { font-size: 0.875rem; font-weight: 500; color:var(--color-text,#1e293b); }
    .entry__meta { font-size: 0.775rem; color: var(--color-text-muted,#94a3b8); }
    .entry__badge { font-size: 0.725rem; padding: 2px 8px; border-radius: 9999px; font-weight: 600; flex-shrink:0; }
    .entry__badge--warn {
      background: var(--color-danger-bg,#fee2e2);
      color: var(--color-danger,#dc2626);
    }
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
