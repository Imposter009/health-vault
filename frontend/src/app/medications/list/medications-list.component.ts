import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { forkJoin } from 'rxjs';
import { MedicationsService } from '../medications.service';
import {
  MedicationResponse, MedicationStatus, MEDICATION_STATUSES,
  STATUS_LABELS, STATUS_BADGE_CLASS, isExpiringSoon
} from '../models';

@Component({
  selector: 'app-medications-list',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="page-container">
      <div class="page-header">
        <div>
          <h1 class="page-title">My Medications</h1>
          <p class="page-subtitle">Prescriptions and dosing schedules, all in one place.</p>
        </div>
        <a routerLink="/medications/new" class="btn btn-primary">+ Add Medication</a>
      </div>

      <!-- Status filter pills -->
      <div class="cat-pills">
        <button class="cat-pill" [class.active]="filterStatus === ''" (click)="setStatus('')">
          <span>All</span>
          <span class="cat-pill__count">{{ statusCounts['ALL'] ?? '–' }}</span>
        </button>
        <button class="cat-pill" *ngFor="let s of statuses"
                [class.active]="filterStatus === s" (click)="setStatus(s)">
          <span>{{ statusLabel(s) }}</span>
          <span class="cat-pill__count">{{ statusCounts[s] ?? '–' }}</span>
        </button>
      </div>

      <div *ngIf="loading" class="state-msg">Loading…</div>
      <div *ngIf="error" class="state-msg error">{{ error }}</div>

      <div *ngIf="!loading && medications.length === 0 && !error" class="card empty-state">
        <span class="empty-state__icon" aria-hidden="true">💊</span>
        <h2 class="empty-state__title">No medications logged yet</h2>
        <p class="empty-state__text">
          Track prescriptions, dosages, and schedules — add your first medication to
          keep everything in one place.
        </p>
        <div class="empty-state__actions">
          <a routerLink="/medications/new" class="btn btn-primary">+ Add your first medication</a>
        </div>
      </div>

      <!-- Medication grid -->
      <div class="med-grid" *ngIf="medications.length > 0">
        <div class="med-card" *ngFor="let m of medications">
          <div class="med-card__head">
            <span class="med-card__icon" aria-hidden="true">💊</span>
            <span [class]="'status-badge ' + badgeClass(m.status)">{{ statusLabel(m.status) }}</span>
          </div>
          <p class="med-card__name" [title]="m.name">{{ m.name }}</p>
          <p class="med-card__meta">{{ m.dosage }} · {{ m.frequency }}</p>
          <p class="med-card__doctor" *ngIf="m.prescribingDoctor">Prescribed by {{ m.prescribingDoctor }}</p>
          <p class="med-card__dates">
            {{ m.startDate | date:'d MMM y' }} – {{ m.endDate ? (m.endDate | date:'d MMM y') : 'Ongoing' }}
          </p>
          <p class="med-card__expiring" *ngIf="expiringSoon(m)">⚠ Ending within 7 days</p>
          <div class="med-card__foot">
            <div class="med-card__actions">
              <a [routerLink]="['/medications', m.id, 'edit']" class="btn btn-ghost btn-sm">Edit</a>
              <button class="btn btn-danger btn-sm" (click)="confirmDelete(m)">Delete</button>
            </div>
          </div>
        </div>
      </div>

      <!-- Pagination -->
      <div class="pagination" *ngIf="totalPages > 1">
        <button [disabled]="page === 0" (click)="changePage(page - 1)">‹ Prev</button>
        <span>{{ page + 1 }} / {{ totalPages }}</span>
        <button [disabled]="page >= totalPages - 1" (click)="changePage(page + 1)">Next ›</button>
      </div>
    </div>
  `,
  styles: [`
    .cat-pills {
      display: flex; flex-wrap: wrap; gap: .5rem; margin-bottom: 1.5rem;
    }
    .cat-pill {
      display: inline-flex; align-items: center; gap: .5rem;
      padding: .45rem 1rem; border-radius: var(--radius-pill);
      background: var(--color-surface-sub); border: none;
      color: var(--color-text-secondary); font-size: .8125rem; font-weight: 600;
      cursor: pointer; transition: background .12s, color .12s; font-family: inherit;
      white-space: nowrap;
    }
    .cat-pill:hover { background: var(--color-border); }
    .cat-pill.active { background: var(--color-primary); color: var(--color-text-on-primary); }
    .cat-pill__count {
      background: rgba(0,0,0,.08); border-radius: var(--radius-pill);
      padding: .05rem .45rem; font-size: .6875rem; font-weight: 700;
    }
    .cat-pill.active .cat-pill__count { background: rgba(255,255,255,.25); }

    .med-grid {
      display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
      gap: 1rem; margin-bottom: 1.5rem;
    }
    .med-card {
      background: var(--color-card); border: 1px solid var(--color-border);
      border-radius: var(--radius-lg); box-shadow: var(--shadow-sm);
      padding: 1.1rem; display: flex; flex-direction: column; gap: .35rem;
      transition: box-shadow .15s;
    }
    .med-card:hover { box-shadow: var(--shadow-md); }
    .med-card__head { display: flex; align-items: center; justify-content: space-between; }
    .med-card__icon {
      width: 34px; height: 34px; border-radius: var(--radius-md);
      background: var(--color-surface-sub); display: flex; align-items: center; justify-content: center;
      font-size: 1.05rem;
    }
    .med-card__name {
      margin: .3rem 0 0; font-weight: 700; font-size: .9375rem; color: var(--color-ink);
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .med-card__meta, .med-card__doctor, .med-card__dates { margin: 0; font-size: .8125rem; color: var(--color-text-secondary); }
    .med-card__expiring { margin: 0; font-size: .8125rem; font-weight: 600; color: var(--color-warning); }
    .med-card__foot {
      margin-top: .5rem; padding-top: .75rem; border-top: 1px solid var(--color-surface-sub);
      display: flex; align-items: center; justify-content: flex-end; gap: .5rem;
    }
    .med-card__actions { display: flex; gap: .4rem; }
  `]
})
export class MedicationsListComponent implements OnInit {

  readonly statuses = MEDICATION_STATUSES;
  statusLabel = (s: MedicationStatus) => STATUS_LABELS[s];
  badgeClass  = (s: MedicationStatus) => STATUS_BADGE_CLASS[s];
  expiringSoon = isExpiringSoon;

  medications: MedicationResponse[] = [];
  loading      = false;
  error:       string | null      = null;
  filterStatus: MedicationStatus | '' = '';
  page         = 0;
  totalPages   = 1;
  statusCounts: Partial<Record<MedicationStatus | 'ALL', number>> = {};

  constructor(private svc: MedicationsService) {}

  ngOnInit(): void {
    this.reload();
    this.loadStatusCounts();
  }

  reload(): void {
    this.loading = true;
    this.error   = null;
    const params: any = { page: this.page, size: 20 };
    if (this.filterStatus) params.status = this.filterStatus;

    this.svc.list(params).subscribe({
      next: resp => {
        this.medications = resp.content;
        this.totalPages  = resp.totalPages;
        this.loading     = false;
      },
      error: err => {
        this.loading = false;
        this.error   = err?.error?.message ?? 'Failed to load medications.';
      },
    });
  }

  /** Lightweight (size=1) count-only requests per status, purely for the filter-pill badges. */
  private loadStatusCounts(): void {
    forkJoin({
      ALL:          this.svc.list({ page: 0, size: 1 }),
      ACTIVE:       this.svc.list({ page: 0, size: 1, status: 'ACTIVE' }),
      COMPLETED:    this.svc.list({ page: 0, size: 1, status: 'COMPLETED' }),
      DISCONTINUED: this.svc.list({ page: 0, size: 1, status: 'DISCONTINUED' }),
    }).subscribe({
      next: (r) => {
        this.statusCounts = {
          ALL: r.ALL.totalElements,
          ACTIVE: r.ACTIVE.totalElements,
          COMPLETED: r.COMPLETED.totalElements,
          DISCONTINUED: r.DISCONTINUED.totalElements,
        };
      },
      error: () => { /* counts are decorative — silently skip on failure */ },
    });
  }

  setStatus(s: MedicationStatus | ''): void {
    this.filterStatus = s;
    this.page = 0;
    this.reload();
  }

  changePage(p: number): void {
    this.page = p;
    this.reload();
  }

  confirmDelete(m: MedicationResponse): void {
    if (!confirm(`Delete "${m.name}"? This cannot be undone.`)) return;
    this.svc.delete(m.id).subscribe({
      next: () => { this.reload(); this.loadStatusCounts(); },
      error: err => alert(err?.error?.message ?? 'Delete failed.'),
    });
  }
}
