import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { DocumentsService } from '../documents.service';
import { CATEGORY_LABELS, DOCUMENT_CATEGORIES, DocumentCategory, formatFileSize } from '../models';
import { ConnectivityService } from '../../core/connectivity.service';

@Component({
  selector: 'app-document-upload',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  template: `
    <div class="page-container" style="max-width:560px;">
      <div class="page-header">
        <h1 class="page-title">Upload Document</h1>
      </div>

      <!-- Offline guard -->
      <div *ngIf="!connectivity.isOnline()" class="card offline-notice">
        <span class="offline-icon">📵</span>
        <p>Connect to the internet to upload documents.</p>
        <a routerLink="/documents" class="btn btn-ghost btn-sm">← Back to Documents</a>
      </div>

      <div class="card" *ngIf="connectivity.isOnline()">
        <form [formGroup]="form" (ngSubmit)="submit()">

          <div class="field">
            <label for="category">Category</label>
            <select id="category" formControlName="category">
              <option value="">Select category…</option>
              <option *ngFor="let c of categories" [value]="c">{{ categoryLabel(c) }}</option>
            </select>
          </div>

          <div class="field">
            <label for="fileInput">
              File
              <span style="font-weight:400;color:#94a3b8;font-size:.8rem;"> — PDF, JPEG, PNG · max 25 MB</span>
            </label>
            <input id="fileInput" type="file" accept=".pdf,.jpg,.jpeg,.png"
                   (change)="onFileChange($event)" style="padding:.5rem;" />
            <span *ngIf="selectedFile" class="file-selected">
              {{ selectedFile.name }} · {{ formatSize(selectedFile.size) }}
            </span>
          </div>

          <div *ngIf="uploading" style="margin-bottom:1rem;">
            <div class="progress-bar">
              <div class="progress-fill" [style.width.%]="progress"></div>
            </div>
            <p style="text-align:center;font-size:.8125rem;color:#64748b;margin:.25rem 0 0;">{{ progress }}% uploaded</p>
          </div>

          <div *ngIf="error" class="upload-error" role="alert">{{ error }}</div>
          <div *ngIf="success" class="upload-success" role="status">Upload complete! Redirecting…</div>

          <div class="form-actions">
            <button type="submit" class="btn btn-primary"
                    [disabled]="uploading || !form.valid || !selectedFile">
              {{ uploading ? 'Uploading…' : 'Upload Document' }}
            </button>
            <a routerLink="/documents" class="btn btn-ghost">Cancel</a>
          </div>
        </form>
      </div>
    </div>
  `,
  styles: [`
    .offline-notice { text-align:center; padding:2.5rem; }
    .offline-icon { font-size:2rem; display:block; margin-bottom:.75rem; }
    .offline-notice p { margin:0 0 1.25rem; color:var(--color-text-secondary,#64748b); }
    .file-selected {
      font-size:.8125rem; color:var(--color-text-secondary,#64748b);
      margin-top:.25rem;
    }
    .form-actions { display:flex; gap:.75rem; margin-top:1.5rem; align-items:center; }
    .upload-error { color:var(--color-danger,#dc2626); font-size:.875rem; margin:.5rem 0; }
    .upload-success { color:var(--color-success,#059669); font-size:.875rem; margin:.5rem 0; font-weight:600; }
  `]
})
export class DocumentUploadComponent {

  readonly categories = DOCUMENT_CATEGORIES;
  categoryLabel = (c: DocumentCategory) => CATEGORY_LABELS[c];
  formatSize = formatFileSize;

  form = this.fb.group({ category: ['', Validators.required] });

  selectedFile: File | null = null;
  uploading = false;
  progress  = 0;
  error:   string | null = null;
  success  = false;

  constructor(
    private fb:           FormBuilder,
    private svc:          DocumentsService,
    private router:       Router,
    readonly connectivity: ConnectivityService,
  ) {}

  onFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.selectedFile = input.files?.[0] ?? null;
    this.error = null;
  }

  submit(): void {
    if (!this.selectedFile || this.form.invalid || !this.connectivity.isOnline()) return;

    this.uploading = true;
    this.error     = null;
    this.success   = false;
    this.progress  = 0;

    const category = this.form.value.category as DocumentCategory;

    this.svc.upload(this.selectedFile, category).subscribe({
      next: event => {
        if (event.type === 'progress') {
          this.progress = event.percent!;
        } else {
          this.success   = true;
          this.uploading = false;
          setTimeout(() => this.router.navigate(['/documents']), 1500);
        }
      },
      error: err => {
        this.uploading = false;
        const msg = err?.error?.message ?? err?.message;
        this.error = msg || 'Upload failed. Please try again.';
      },
    });
  }
}
