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
    <div class="upload-container">
      <h2>Upload Document</h2>

      <!-- Offline guard — shown instead of form when offline -->
      <div *ngIf="!connectivity.isOnline()" class="offline-notice">
        <span class="offline-icon">📵</span>
        <p>Connect to the internet to upload documents.</p>
        <a routerLink="/documents">← Back to Documents</a>
      </div>

      <form *ngIf="connectivity.isOnline()" [formGroup]="form" (ngSubmit)="submit()">

        <div class="field">
          <label>Category</label>
          <select formControlName="category">
            <option value="">Select category…</option>
            <option *ngFor="let c of categories" [value]="c">{{ categoryLabel(c) }}</option>
          </select>
        </div>

        <div class="field">
          <label>File <span class="hint">(PDF, JPEG, PNG · max 25 MB)</span></label>
          <input type="file" accept=".pdf,.jpg,.jpeg,.png"
                 (change)="onFileChange($event)" />
          <span *ngIf="selectedFile" class="file-name">
            {{ selectedFile.name }} ({{ formatSize(selectedFile.size) }})
          </span>
        </div>

        <div *ngIf="uploading" class="progress-bar">
          <div class="progress-fill" [style.width.%]="progress"></div>
          <span>{{ progress }}%</span>
        </div>

        <div *ngIf="error" class="error-msg">{{ error }}</div>
        <div *ngIf="success" class="success-msg">Upload complete! Redirecting…</div>

        <div class="actions">
          <button type="submit" [disabled]="uploading || !form.valid || !selectedFile">
            {{ uploading ? 'Uploading…' : 'Upload' }}
          </button>
          <button type="button" routerLink="/documents">Cancel</button>
        </div>
      </form>
    </div>
  `,
  styles: [`
    .upload-container { max-width: 500px; margin: 2rem auto; padding: 1.5rem; }
    h2 { margin-bottom: 1.5rem; }
    .offline-notice {
      text-align: center; padding: 2rem; border: 1px solid #e0e0e0;
      border-radius: 8px; color: #555;
    }
    .offline-notice .offline-icon { font-size: 2rem; display: block; margin-bottom: 0.75rem; }
    .offline-notice p { margin: 0 0 1rem; }
    .offline-notice a { color: #1565c0; text-decoration: none; font-weight: 600; }
    .field { display: flex; flex-direction: column; gap: 4px; margin-bottom: 1rem; }
    label { font-weight: 600; font-size: 0.9rem; }
    .hint { font-weight: normal; color: #666; font-size: 0.8rem; }
    select, input[type=file] { padding: 0.5rem; border: 1px solid #ccc; border-radius: 4px; }
    .file-name { font-size: 0.85rem; color: #555; margin-top: 4px; }
    .progress-bar {
      height: 20px; background: #e0e0e0; border-radius: 10px; overflow: hidden;
      position: relative; margin-bottom: 1rem;
    }
    .progress-fill { height: 100%; background: #2196f3; transition: width 0.2s; }
    .progress-bar span { position: absolute; top: 1px; left: 50%; transform: translateX(-50%); font-size: 0.8rem; }
    .error-msg { color: #c62828; margin-bottom: 0.75rem; }
    .success-msg { color: #2e7d32; margin-bottom: 0.75rem; }
    .actions { display: flex; gap: 0.75rem; margin-top: 1rem; }
    button { padding: 0.5rem 1.25rem; border: none; border-radius: 4px; cursor: pointer; }
    button[type=submit] { background: #1565c0; color: #fff; }
    button[type=submit]:disabled { background: #90a4ae; cursor: not-allowed; }
    button[type=button] { background: #e0e0e0; }
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
