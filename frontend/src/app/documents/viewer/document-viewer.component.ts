import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Subscription } from 'rxjs';
import { DocumentsService } from '../documents.service';
import { DocumentResponse, DocumentStatusResponse } from '../models';
import { OfflineDocumentCacheService } from '../../core/offline-document-cache.service';
import { ConnectivityService } from '../../core/connectivity.service';
import { AiService, SummarizeResponse } from '../../ai/ai.service';

@Component({
  selector: 'app-document-viewer',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="viewer-container">
      <div class="viewer-toolbar">
        <a routerLink="/documents" class="back-link">← Back to Documents</a>
        <span *ngIf="doc" class="doc-title">{{ doc.filename }}</span>

        <div *ngIf="isImage" class="zoom-controls">
          <button (click)="zoom(0.8)">−</button>
          <span>{{ (scale * 100).toFixed(0) }}%</span>
          <button (click)="zoom(1.25)">+</button>
          <button (click)="resetZoom()">Reset</button>
        </div>

        <a *ngIf="rawUrl && !offlineCopy" [href]="rawUrl" target="_blank" class="btn-sm">Open in new tab</a>
      </div>

      <!-- Offline copy banner -->
      <div *ngIf="offlineCopy" class="offline-copy-notice" role="status">
        📦 Viewing offline copy cached on {{ offlineCachedAt | date:'medium' }}. Connect to the internet to see the latest version.
      </div>

      <!-- Not available offline -->
      <div *ngIf="notAvailableOffline" class="not-available-offline">
        <p>📵 This document isn't available offline yet.</p>
        <p>View it once while online to enable offline access.</p>
      </div>

      <div *ngIf="loading" class="status">Fetching document…</div>
      <div *ngIf="error && !notAvailableOffline" class="error-msg">{{ error }}</div>

      <!-- OCR status panel -->
      <div *ngIf="!loading && docStatus && !offlineCopy" class="ocr-panel" [class]="'ocr-' + docStatus.status.toLowerCase()">
        <ng-container [ngSwitch]="docStatus.status">
          <span *ngSwitchCase="'UPLOADED'">⏳ Queued for OCR processing…</span>
          <span *ngSwitchCase="'PROCESSING'">🔄 Extracting health data…</span>
          <span *ngSwitchCase="'PROCESSED'">
            ✅ OCR complete —
            <ng-container *ngIf="docStatus.metricsExtracted > 0; else noMetrics">
              <strong>{{ docStatus.metricsExtracted }}</strong> metric{{ docStatus.metricsExtracted !== 1 ? 's' : '' }} extracted.
              <a routerLink="/metrics">View in Metrics →</a>
            </ng-container>
            <ng-template #noMetrics>no health data patterns found in this document.</ng-template>
          </span>
          <span *ngSwitchCase="'FAILED'">❌ Processing failed: {{ docStatus.processingError }}</span>
        </ng-container>

        <!-- AI Summarize button — only when PROCESSED and AI enabled -->
        <button
          *ngIf="docStatus.status === 'PROCESSED' && aiEnabled"
          class="ai-summarize-btn"
          [disabled]="summarizing"
          (click)="summarize()">
          {{ summarizing ? 'Summarizing…' : '✨ Summarize with AI' }}
        </button>
      </div>

      <!-- AI Summary panel -->
      <div *ngIf="summary" class="ai-summary-panel">
        <div class="ai-summary-header">AI-Generated Summary</div>
        <p class="ai-summary-text">{{ summary.summary }}</p>
        <p class="ai-disclaimer">This summary is AI-generated and should not replace professional medical advice.</p>
      </div>
      <div *ngIf="summaryError" class="ai-summary-panel ai-summary-error">{{ summaryError }}</div>

      <!-- PDF viewer -->
      <div *ngIf="!loading && !notAvailableOffline && isPdf" class="pdf-wrapper">
        <iframe [src]="safeUrl" class="pdf-iframe" title="PDF Viewer"></iframe>
      </div>

      <!-- Image viewer -->
      <div *ngIf="!loading && !notAvailableOffline && isImage" class="image-wrapper" (wheel)="onWheel($event)">
        <img [src]="rawUrl" [alt]="doc?.filename"
             [style.transform]="'scale(' + scale + ')'"
             [style.transform-origin]="'top left'" />
      </div>
    </div>
  `,
  styles: [`
    .viewer-container { display: flex; flex-direction: column; height: 100vh; }
    .viewer-toolbar {
      display: flex; align-items: center; gap: 1rem; padding: 0.5rem 1rem;
      background: var(--color-primary-dark, #0d5f59); color: #fff; flex-shrink: 0;
    }
    .back-link { color: rgba(255,255,255,.9); text-decoration: none; font-weight: 600; font-size: .875rem; }
    .back-link:hover { color: #fff; }
    .doc-title { flex: 1; font-size: 0.875rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .zoom-controls { display: flex; align-items: center; gap: 0.4rem; font-size: .875rem; }
    .zoom-controls button {
      background: rgba(255,255,255,.18); border: none; color: #fff;
      padding: 0.2rem 0.6rem; border-radius: 4px; cursor: pointer; font-size: .875rem;
    }
    .zoom-controls button:hover { background: rgba(255,255,255,.3); }
    .btn-sm {
      padding: 0.25rem 0.7rem; border-radius: 4px; font-size: 0.8rem;
      background: rgba(255,255,255,.18); color: rgba(255,255,255,.95); text-decoration: none;
    }
    .btn-sm:hover { background: rgba(255,255,255,.3); }
    .offline-copy-notice {
      background: #1e3a5f; color: #d4e6f8; padding: 0.5rem 1rem;
      font-size: 0.8125rem; text-align: center;
    }
    .not-available-offline {
      flex: 1; display: flex; flex-direction: column; align-items: center;
      justify-content: center; gap: 0.5rem; color: var(--color-text-secondary,#64748b); text-align: center; padding: 2rem;
    }
    .not-available-offline p { margin: 0; font-size: 1rem; }
    .status, .error-msg { padding: 2rem; text-align: center; color: var(--color-text-secondary,#64748b); }
    .error-msg { color: var(--color-danger,#dc2626); }
    .ocr-panel {
      padding: 0.6rem 1rem; font-size: 0.875rem; border-bottom: 1px solid var(--color-border,#e2e8f0);
      display: flex; align-items: center; gap: 0.5rem;
    }
    .ocr-panel a { color: var(--color-primary,#0f766e); font-weight: 600; }
    .ai-summarize-btn {
      margin-left: auto; padding: 0.3rem 0.75rem;
      background: var(--color-primary,#0f766e); color: #fff;
      border: none; border-radius: 4px; font-size: 0.8125rem; font-weight: 600;
      cursor: pointer; font-family: inherit;
    }
    .ai-summarize-btn:disabled { opacity: 0.6; cursor: not-allowed; }
    .ai-summary-panel {
      margin: 0; padding: 1rem 1.5rem;
      background: #f0fdf4; border-bottom: 1px solid var(--color-border,#e2e8f0);
    }
    .ai-summary-header { font-weight: 700; font-size: 0.875rem; color: #065f46; margin-bottom: 0.5rem; }
    .ai-summary-text { margin: 0 0 0.5rem; font-size: 0.9rem; color: #1e293b; white-space: pre-wrap; }
    .ai-disclaimer { margin: 0; font-size: 0.75rem; color: #94a3b8; font-style: italic; }
    .ai-summary-error { background: #fef2f2; }
    .ai-summary-error { color: #dc2626; font-size: 0.875rem; }
    .ocr-uploaded   { background: #e0f2fe; color: #0369a1; }
    .ocr-processing { background: #fef3c7; color: #d97706; }
    .ocr-processed  { background: var(--color-primary-light,#ccfbf1); color: var(--color-primary,#0f766e); }
    .ocr-failed     { background: var(--color-danger-bg,#fee2e2); color: var(--color-danger,#dc2626); }
    .pdf-wrapper { flex: 1; overflow: hidden; }
    .pdf-iframe { width: 100%; height: 100%; border: none; }
    .image-wrapper { flex: 1; overflow: auto; padding: 1rem; background: #374151; }
    img { transition: transform 0.2s; }
  `]
})
export class DocumentViewerComponent implements OnInit, OnDestroy {

  doc:       DocumentResponse | null       = null;
  docStatus: DocumentStatusResponse | null = null;
  rawUrl:    string | null                 = null;
  safeUrl:   SafeResourceUrl | null        = null;

  loading             = true;
  error:              string | null = null;
  offlineCopy         = false;
  offlineCachedAt:    number | null = null;
  notAvailableOffline = false;
  scale               = 1.0;

  private pollSub?: Subscription;
  private docId!: string;

  get isPdf():   boolean { return (this.doc?.mimeType ?? '') === 'application/pdf'; }
  get isImage(): boolean { return (this.doc?.mimeType ?? '').startsWith('image/'); }

  aiEnabled   = false;
  summarizing = false;
  summary:      SummarizeResponse | null = null;
  summaryError: string | null = null;

  constructor(
    private route:        ActivatedRoute,
    private svc:          DocumentsService,
    private sanitizer:    DomSanitizer,
    private offlineCache: OfflineDocumentCacheService,
    private connectivity: ConnectivityService,
    private ai:           AiService,
  ) {
    this.ai.getStatus().subscribe(s => this.aiEnabled = s.enabled);
  }

  ngOnInit(): void {
    this.docId = this.route.snapshot.paramMap.get('id')!;
    this.loadDocument();
  }

  ngOnDestroy(): void {
    this.pollSub?.unsubscribe();
  }

  private loadDocument(): void {
    this.svc.getById(this.docId).subscribe({
      next: doc => {
        this.doc = doc;
        this.fetchAndCacheBytes(doc);
        this.startPolling(this.docId, doc.status);
      },
      error: () => this.fallbackToOfflineCache(),
    });
  }

  private fetchAndCacheBytes(doc: DocumentResponse): void {
    this.svc.getDownloadUrl(this.docId).subscribe({
      next: resp => {
        // Fetch the actual file bytes to cache them in IndexedDB before displaying
        fetch(resp.url)
          .then(r => r.blob())
          .then(blob => {
            // Store in IndexedDB for offline access
            this.offlineCache.put(this.docId, blob, doc.mimeType, doc.filename);
            // Display using an object URL derived from the blob
            const objectUrl = URL.createObjectURL(blob);
            this.rawUrl  = objectUrl;
            this.safeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(objectUrl);
            this.loading = false;
          })
          .catch(() => {
            // File fetch failed (e.g. presigned URL expired) — try offline cache
            this.fallbackToOfflineCache();
          });
      },
      error: () => this.fallbackToOfflineCache(),
    });
  }

  private async fallbackToOfflineCache(): Promise<void> {
    const cached = await this.offlineCache.get(this.docId);
    if (cached) {
      // Synthesise a minimal DocumentResponse from cached metadata so the
      // template can determine isPdf / isImage correctly
      if (!this.doc) {
        this.doc = {
          id: this.docId,
          filename: cached.filename,
          mimeType: cached.mimeType,
          category: '',
          status: 'PROCESSED',
          uploadedAt: '',
          sizeBytes: cached.blob.size,
        } as unknown as DocumentResponse;
      }
      const objectUrl  = URL.createObjectURL(cached.blob);
      this.rawUrl      = objectUrl;
      this.safeUrl     = this.sanitizer.bypassSecurityTrustResourceUrl(objectUrl);
      this.offlineCopy    = true;
      this.offlineCachedAt = cached.cachedAt;
      this.loading        = false;
    } else {
      this.loading            = false;
      this.notAvailableOffline = true;
    }
  }

  private startPolling(id: string, initialStatus: string): void {
    this.svc.getStatus(id).subscribe({ next: s => { this.docStatus = s; } });
    if (initialStatus === 'PROCESSED' || initialStatus === 'FAILED') return;
    this.pollSub = this.svc.pollStatus(id).subscribe({ next: s => { this.docStatus = s; } });
  }

  zoom(factor: number): void {
    this.scale = Math.min(5, Math.max(0.25, this.scale * factor));
  }
  resetZoom(): void { this.scale = 1.0; }

  onWheel(event: WheelEvent): void {
    if (event.ctrlKey) {
      event.preventDefault();
      this.zoom(event.deltaY < 0 ? 1.1 : 0.9);
    }
  }

  summarize(): void {
    if (!this.docId || this.summarizing) return;
    this.summarizing  = true;
    this.summary      = null;
    this.summaryError = null;

    this.ai.summarize(this.docId).subscribe({
      next: r => { this.summary = r; this.summarizing = false; },
      error: err => {
        this.summaryError = err?.status === 503
          ? 'AI features are not available on this server.'
          : 'Failed to summarize document. Please try again.';
        this.summarizing = false;
      }
    });
  }
}
