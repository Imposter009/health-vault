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
        <div>
          <h1 class="page-title">Upload Document</h1>
          <p class="page-subtitle">Encrypted, OCR'd automatically, and cross-checked for any health metrics it contains.</p>
        </div>
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
            <label>File</label>
            <div class="dropzone"
                 [class.dropzone--active]="isDragging"
                 [class.dropzone--filled]="selectedFile"
                 (click)="fileInput.click()"
                 (dragover)="onDragOver($event)"
                 (dragleave)="onDragLeave($event)"
                 (drop)="onDrop($event)">
              <span class="dropzone__icon" aria-hidden="true">{{ selectedFile ? '📄' : '⬆' }}</span>
              <ng-container *ngIf="!selectedFile">
                <p class="dropzone__text">
                  Drag and drop your file here, or <b>browse</b>
                </p>
                <p class="dropzone__hint">PDF, JPEG, or PNG · max 25 MB</p>
              </ng-container>
              <ng-container *ngIf="selectedFile">
                <p class="dropzone__text">{{ selectedFile.name }}</p>
                <p class="dropzone__hint">{{ formatSize(selectedFile.size) }} · click or drop to replace</p>
              </ng-container>
            </div>
            <input #fileInput type="file" accept=".pdf,.jpg,.jpeg,.png" hidden
                   (change)="onFileChange($event)" />
          </div>

          <div *ngIf="uploading" style="margin-bottom:1rem;">
            <div class="progress-bar">
              <div class="progress-fill" [style.width.%]="progress"></div>
            </div>
            <p style="text-align:center;font-size:.8125rem;color:var(--color-text-secondary);margin:.25rem 0 0;">{{ progress }}% uploaded</p>
          </div>

          <div *ngIf="error" class="entry-error" role="alert">{{ error }}</div>
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
    .dropzone {
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      gap: .4rem; text-align: center; cursor: pointer;
      padding: 2rem 1rem; border-radius: var(--radius-lg);
      border: 2px dashed var(--color-border-strong);
      background: var(--color-surface-sub);
      transition: background .15s, border-color .15s;
    }
    .dropzone:hover, .dropzone--active {
      background: var(--color-primary-muted); border-color: var(--color-primary);
    }
    .dropzone--filled { border-style: solid; background: var(--color-card); }
    .dropzone__icon {
      width: 44px; height: 44px; border-radius: 50%;
      background: var(--color-primary-light); color: var(--color-primary-dark);
      display: flex; align-items: center; justify-content: center;
      font-size: 1.3rem;
    }
    .dropzone__text { margin: 0; font-weight: 700; color: var(--color-ink); font-size: .9375rem; }
    .dropzone__text b { color: var(--color-primary); text-decoration: underline; }
    .dropzone__hint { margin: 0; font-size: .8125rem; color: var(--color-text-secondary); }

    .upload-success { color: var(--color-success); font-size:.875rem; margin:.5rem 0; font-weight:600; }
  `]
})
export class DocumentUploadComponent {

  readonly categories = DOCUMENT_CATEGORIES;
  categoryLabel = (c: DocumentCategory) => CATEGORY_LABELS[c];
  formatSize = formatFileSize;

  form = this.fb.group({ category: ['', Validators.required] });

  selectedFile: File | null = null;
  isDragging = false;
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

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.isDragging = true;
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.isDragging = false;
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.isDragging = false;
    const file = event.dataTransfer?.files?.[0];
    if (file) {
      this.selectedFile = file;
      this.error = null;
    }
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
