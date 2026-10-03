import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { forkJoin } from 'rxjs';
import { DocumentsService } from '../documents.service';
import {
  DocumentResponse, DocumentCategory, CATEGORY_LABELS, DOCUMENT_CATEGORIES, formatFileSize
} from '../models';

const CATEGORY_ICONS: Record<DocumentCategory, string> = {
  LAB_REPORT:   '🧪',
  PRESCRIPTION: '💊',
  SCAN:         '🩻',
  INSURANCE:    '🛡',
  OTHER:        '📄',
};

@Component({
  selector: 'app-documents-list',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="page-container">
      <div class="page-header">
        <div>
          <h1 class="page-title">My Documents</h1>
          <p class="page-subtitle">Lab results, imaging, prescriptions, and more — all in one encrypted vault.</p>
        </div>
        <a routerLink="/documents/upload" class="btn btn-primary">+ Upload</a>
      </div>

      <!-- Category filter pills -->
      <div class="cat-pills">
        <button class="cat-pill" [class.active]="filterCategory === ''" (click)="setCategory('')">
          <span>All Documents</span>
          <span class="cat-pill__count">{{ categoryCounts['ALL'] ?? '–' }}</span>
        </button>
        <button class="cat-pill" *ngFor="let c of categories"
                [class.active]="filterCategory === c" (click)="setCategory(c)">
          <span>{{ categoryLabel(c) }}</span>
          <span class="cat-pill__count">{{ categoryCounts[c] ?? '–' }}</span>
        </button>
      </div>

      <div *ngIf="loading" class="state-msg">Loading…</div>
      <div *ngIf="error" class="state-msg error">{{ error }}</div>

      <div *ngIf="!loading && documents.length === 0 && !error" class="card empty-state">
        <span class="empty-state__icon" aria-hidden="true">🗂</span>
        <h2 class="empty-state__title">Your vault is empty</h2>
        <p class="empty-state__text">
          Upload lab reports, prescriptions, scans, or insurance documents — we'll OCR
          them automatically and try to extract any health metrics they contain.
        </p>
        <div class="empty-state__actions">
          <a routerLink="/documents/upload" class="btn btn-primary">+ Upload your first document</a>
        </div>
      </div>

      <!-- Document grid -->
      <div class="doc-grid" *ngIf="documents.length > 0">
        <div class="doc-card" *ngFor="let doc of documents">
          <div class="doc-card__head">
            <span class="doc-card__icon">{{ categoryIcon(doc.category) }}</span>
            <span class="mime-chip">{{ mimeShort(doc.mimeType) }}</span>
          </div>
          <p class="doc-card__filename" [title]="doc.filename">{{ doc.filename }}</p>
          <p class="doc-card__meta">{{ categoryLabel(doc.category) }} · {{ formatSize(doc.sizeBytes) }}</p>
          <p class="doc-card__date">Uploaded {{ doc.uploadedAt | date:'d MMM y' }}</p>
          <div class="doc-card__foot">
            <span [class]="'badge badge-' + doc.status.toLowerCase()">{{ statusLabel(doc.status) }}</span>
            <div class="doc-card__actions">
              <a [routerLink]="['/documents', doc.id, 'view']" class="btn btn-ghost btn-sm">View</a>
              <button class="btn btn-danger btn-sm" (click)="confirmDelete(doc)">Delete</button>
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
    .doc-grid {
      display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
      gap: 1rem; margin-bottom: 1.5rem;
    }
    .doc-card {
      background: var(--color-card); border: 1px solid var(--color-border);
      border-radius: var(--radius-lg); box-shadow: var(--shadow-sm);
      padding: 1.1rem; display: flex; flex-direction: column; gap: .4rem;
      transition: box-shadow .15s;
    }
    .doc-card:hover { box-shadow: var(--shadow-md); }
    .doc-card__head { display: flex; align-items: center; justify-content: space-between; }
    .doc-card__icon {
      width: 34px; height: 34px; border-radius: var(--radius-md);
      background: var(--color-surface-sub); display: flex; align-items: center; justify-content: center;
      font-size: 1.05rem;
    }
    .mime-chip {
      display:inline-block; padding:.15rem .5rem;
      background: var(--color-surface-sub); border:1px solid var(--color-border);
      border-radius: 4px; font-size:.6875rem;
      font-weight:700; color: var(--color-text-secondary);
      font-family: var(--font-mono); letter-spacing: .02em;
    }
    .doc-card__filename {
      margin: .3rem 0 0; font-weight: 700; font-size: .9375rem; color: var(--color-ink);
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .doc-card__meta, .doc-card__date { margin: 0; font-size: .8125rem; color: var(--color-text-secondary); }
    .doc-card__foot {
      margin-top: .5rem; padding-top: .75rem; border-top: 1px solid var(--color-surface-sub);
      display: flex; align-items: center; justify-content: space-between; gap: .5rem;
    }
    .doc-card__actions { display: flex; gap: .4rem; }
  `]
})
export class DocumentsListComponent implements OnInit {

  readonly categories = DOCUMENT_CATEGORIES;
  categoryLabel = (c: DocumentCategory) => CATEGORY_LABELS[c];
  categoryIcon  = (c: DocumentCategory) => CATEGORY_ICONS[c];
  formatSize    = formatFileSize;

  documents:   DocumentResponse[] = [];
  loading      = false;
  error:       string | null      = null;
  filterCategory: DocumentCategory | '' = '';
  page         = 0;
  totalPages   = 1;
  categoryCounts: Partial<Record<DocumentCategory | 'ALL', number>> = {};

  constructor(private svc: DocumentsService) {}

  ngOnInit(): void {
    this.reload();
    this.loadCategoryCounts();
  }

  reload(): void {
    this.loading = true;
    this.error   = null;
    const params: any = { page: this.page, size: 20 };
    if (this.filterCategory) params.category = this.filterCategory;

    this.svc.list(params).subscribe({
      next: resp => {
        this.documents   = resp.content;
        this.totalPages  = resp.totalPages;
        this.loading     = false;
      },
      error: err => {
        this.loading = false;
        this.error   = err?.error?.message ?? 'Failed to load documents.';
      },
    });
  }

  /** Lightweight (size=1) count-only requests per category, purely for the filter-pill badges. */
  private loadCategoryCounts(): void {
    forkJoin({
      ALL:          this.svc.list({ page: 0, size: 1 }),
      LAB_REPORT:   this.svc.list({ page: 0, size: 1, category: 'LAB_REPORT' }),
      PRESCRIPTION: this.svc.list({ page: 0, size: 1, category: 'PRESCRIPTION' }),
      SCAN:         this.svc.list({ page: 0, size: 1, category: 'SCAN' }),
      INSURANCE:    this.svc.list({ page: 0, size: 1, category: 'INSURANCE' }),
      OTHER:        this.svc.list({ page: 0, size: 1, category: 'OTHER' }),
    }).subscribe({
      next: (r) => {
        this.categoryCounts = {
          ALL: r.ALL.totalElements,
          LAB_REPORT: r.LAB_REPORT.totalElements,
          PRESCRIPTION: r.PRESCRIPTION.totalElements,
          SCAN: r.SCAN.totalElements,
          INSURANCE: r.INSURANCE.totalElements,
          OTHER: r.OTHER.totalElements,
        };
      },
      error: () => { /* counts are decorative — silently skip on failure */ },
    });
  }

  setCategory(c: DocumentCategory | ''): void {
    this.filterCategory = c;
    this.page = 0;
    this.reload();
  }

  changePage(p: number): void {
    this.page = p;
    this.reload();
  }

  confirmDelete(doc: DocumentResponse): void {
    if (!confirm(`Delete "${doc.filename}"? This cannot be undone.`)) return;
    this.svc.delete(doc.id).subscribe({
      next: () => { this.reload(); this.loadCategoryCounts(); },
      error: err => alert(err?.error?.message ?? 'Delete failed.'),
    });
  }

  mimeShort(mime: string): string {
    switch (mime) {
      case 'application/pdf': return 'PDF';
      case 'image/jpeg':      return 'JPEG';
      case 'image/png':       return 'PNG';
      default:                return mime;
    }
  }

  statusLabel(status: string): string {
    switch (status) {
      case 'UPLOADED':   return 'Uploaded';
      case 'PROCESSING': return 'Processing…';
      case 'PROCESSED':  return 'Processed';
      case 'FAILED':     return 'Failed';
      default:           return status;
    }
  }
}
