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
    <div class="list-container">
      <div class="list-header">
        <h2>My Documents</h2>
        <a routerLink="/documents/upload" class="btn-primary">+ Upload</a>
      </div>

      <!-- Filters -->
      <div class="filters">
        <select [(ngModel)]="filterCategory" (change)="reload()">
          <option value="">All categories</option>
          <option *ngFor="let c of categories" [value]="c">{{ categoryLabel(c) }}</option>
        </select>
      </div>

      <div *ngIf="loading" class="loading">Loading…</div>
      <div *ngIf="error"   class="error-msg">{{ error }}</div>

      <div *ngIf="!loading && documents.length === 0 && !error" class="empty">
        No documents yet. <a routerLink="/documents/upload">Upload your first one.</a>
      </div>

      <table *ngIf="documents.length > 0">
        <thead>
          <tr>
            <th>Filename</th>
            <th>Category</th>
            <th>Type</th>
            <th>Size</th>
            <th>Uploaded</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let doc of documents">
            <td>{{ doc.filename }}</td>
            <td>{{ categoryLabel(doc.category) }}</td>
            <td>{{ mimeShort(doc.mimeType) }}</td>
            <td>{{ formatSize(doc.sizeBytes) }}</td>
            <td>{{ doc.uploadedAt | date:'short' }}</td>
            <td>
              <span [class]="'badge badge-' + doc.status.toLowerCase()">
                {{ statusLabel(doc.status) }}
              </span>
            </td>
            <td class="actions">
              <a [routerLink]="['/documents', doc.id, 'view']" class="btn-sm">View</a>
              <button class="btn-sm danger" (click)="confirmDelete(doc)">Delete</button>
            </td>
          </tr>
        </tbody>
      </table>

      <!-- Pagination -->
      <div class="pagination" *ngIf="totalPages > 1">
        <button [disabled]="page === 0" (click)="changePage(page - 1)">‹</button>
        <span>{{ page + 1 }} / {{ totalPages }}</span>
        <button [disabled]="page >= totalPages - 1" (click)="changePage(page + 1)">›</button>
      </div>
    </div>
  `,
  styles: [`
    .list-container { max-width: 960px; margin: 2rem auto; padding: 1rem; }
    .list-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem; }
    .filters { margin-bottom: 1rem; }
    select { padding: 0.4rem 0.6rem; border: 1px solid #ccc; border-radius: 4px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { text-align: left; padding: 0.6rem 0.75rem; border-bottom: 1px solid #e0e0e0; }
    th { background: #f5f5f5; font-weight: 600; }
    .actions { display: flex; gap: 0.5rem; }
    .btn-primary { background: #1565c0; color: #fff; padding: 0.4rem 1rem; border-radius: 4px; text-decoration: none; font-size: 0.9rem; }
    .btn-sm { padding: 0.3rem 0.7rem; border-radius: 4px; font-size: 0.8rem; cursor: pointer; border: none; text-decoration: none; display: inline-block; }
    .danger { background: #c62828; color: #fff; }
    a.btn-sm { background: #1565c0; color: #fff; }
    .loading { color: #555; padding: 1rem; }
    .empty { color: #777; padding: 1rem; }
    .error-msg { color: #c62828; padding: 0.5rem; }
    .pagination { display: flex; align-items: center; gap: 1rem; margin-top: 1rem; justify-content: center; }
    .pagination button { padding: 0.3rem 0.7rem; border: 1px solid #ccc; border-radius: 4px; cursor: pointer; }
    .pagination button:disabled { opacity: 0.4; cursor: default; }
    .badge { padding: 0.2rem 0.6rem; border-radius: 12px; font-size: 0.75rem; font-weight: 600; white-space: nowrap; }
    .badge-uploaded   { background: #e3f2fd; color: #1565c0; }
    .badge-processing { background: #fff8e1; color: #f57f17; }
    .badge-processed  { background: #e8f5e9; color: #2e7d32; }
    .badge-failed     { background: #ffebee; color: #c62828; }
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
