import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DocumentsService } from '../documents.service';
import {
  DocumentResponse, DocumentCategory, CATEGORY_LABELS, DOCUMENT_CATEGORIES, formatFileSize
} from '../models';

@Component({
  selector: 'app-documents-list',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  template: `
    <div class="page-container">
      <div class="page-header">
        <div>
          <h1 class="page-title">My Documents</h1>
        </div>
        <a routerLink="/documents/upload" class="btn btn-primary">+ Upload</a>
      </div>

      <!-- Filters -->
      <div class="filters" style="margin-bottom:1rem;">
        <label>
          Category
          <select [(ngModel)]="filterCategory" (change)="reload()">
            <option value="">All categories</option>
            <option *ngFor="let c of categories" [value]="c">{{ categoryLabel(c) }}</option>
          </select>
        </label>
      </div>

      <div *ngIf="loading" class="state-msg">Loading…</div>
      <div *ngIf="error" class="state-msg error">{{ error }}</div>

      <div *ngIf="!loading && documents.length === 0 && !error" class="state-msg empty">
        No documents yet.
        <a routerLink="/documents/upload" class="btn btn-primary btn-sm" style="margin-top:.75rem;">Upload your first one</a>
      </div>

      <div class="card" style="padding:0;overflow:hidden;" *ngIf="documents.length > 0">
        <table class="data-table">
          <thead>
            <tr>
              <th>Filename</th>
              <th>Category</th>
              <th>Type</th>
              <th class="num">Size</th>
              <th>Uploaded</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let doc of documents">
              <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">{{ doc.filename }}</td>
              <td style="color:var(--color-text-secondary,#64748b);">{{ categoryLabel(doc.category) }}</td>
              <td>
                <span class="mime-chip">{{ mimeShort(doc.mimeType) }}</span>
              </td>
              <td class="num" style="color:var(--color-text-secondary,#64748b);font-size:.875rem;">{{ formatSize(doc.sizeBytes) }}</td>
              <td style="font-size:.875rem;color:var(--color-text-secondary,#64748b);">{{ doc.uploadedAt | date:'d MMM y' }}</td>
              <td>
                <span [class]="'badge badge-' + doc.status.toLowerCase()">
                  {{ statusLabel(doc.status) }}
                </span>
              </td>
              <td>
                <div style="display:flex;gap:.4rem;justify-content:flex-end;">
                  <a [routerLink]="['/documents', doc.id, 'view']" class="btn btn-ghost btn-sm">View</a>
                  <button class="btn btn-danger btn-sm" (click)="confirmDelete(doc)">Delete</button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
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
    .num { text-align:right; }
    .data-table th:last-child,
    .data-table td:last-child { text-align:right; }
    .mime-chip {
      display:inline-block; padding:.15rem .5rem;
      background:var(--color-surface,#f8fafc);
      border:1px solid var(--color-border,#e2e8f0);
      border-radius:4px; font-size:.75rem;
      font-weight:600; color:var(--color-text-secondary,#64748b);
      font-family:ui-monospace,Consolas,monospace;
    }
  `]
})
export class DocumentsListComponent implements OnInit {

  readonly categories = DOCUMENT_CATEGORIES;
  categoryLabel = (c: DocumentCategory) => CATEGORY_LABELS[c];
  formatSize    = formatFileSize;

  documents:   DocumentResponse[] = [];
  loading      = false;
  error:       string | null      = null;
  filterCategory: DocumentCategory | '' = '';
  page         = 0;
  totalPages   = 1;

  constructor(private svc: DocumentsService) {}

  ngOnInit(): void { this.reload(); }

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

  changePage(p: number): void {
    this.page = p;
    this.reload();
  }

  confirmDelete(doc: DocumentResponse): void {
    if (!confirm(`Delete "${doc.filename}"? This cannot be undone.`)) return;
    this.svc.delete(doc.id).subscribe({
      next: () => this.reload(),
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
