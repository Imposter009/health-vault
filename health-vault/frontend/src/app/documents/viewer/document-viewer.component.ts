import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Subscription } from 'rxjs';
import { DocumentsService } from '../documents.service';
import { DocumentResponse, DocumentStatusResponse } from '../models';
import { OfflineDocumentCacheService } from '../../core/offline-document-cache.service';
import { ConnectivityService } from '../../core/connectivity.service';

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
      </div>

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
      background: #1565c0; color: #fff; flex-shrink: 0;
    }
    .back-link { color: #fff; text-decoration: none; font-weight: 600; }
    .doc-title { flex: 1; font-size: 0.9rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .zoom-controls { display: flex; align-items: center; gap: 0.4rem; }
    .zoom-controls button {
      background: rgba(255,255,255,0.2); border: none; color: #fff;
      padding: 0.2rem 0.5rem; border-radius: 4px; cursor: pointer; font-size: 1rem;
    }
    .btn-sm {
      padding: 0.3rem 0.7rem; border-radius: 4px; font-size: 0.8rem;
      background: rgba(255,255,255,0.2); color: #fff; text-decoration: none;
    }
    .offline-copy-notice {
      background: #e65100; color: #fff; padding: 0.5rem 1rem;
      font-size: 0.85rem; text-align: center;
    }
    .not-available-offline {
      flex: 1; display: flex; flex-direction: column; align-items: center;
      justify-content: center; gap: 0.5rem; color: #555; text-align: center; padding: 2rem;
    }
    .not-available-offline p { margin: 0; font-size: 1rem; }
    .status, .error-msg { padding: 2rem; text-align: center; }
    .error-msg { color: #c62828; }
    .ocr-panel {
      padding: 0.6rem 1rem; font-size: 0.9rem; border-bottom: 1px solid #e0e0e0;
      display: flex; align-items: center; gap: 0.5rem;
    }
    .ocr-panel a { color: #1565c0; font-weight: 600; }
    .ocr-uploaded   { background: #e3f2fd; color: #1565c0; }
    .ocr-processing { background: #fff8e1; color: #f57f17; }
    .ocr-processed  { background: #e8f5e9; color: #2e7d32; }
    .ocr-failed     { background: #ffebee; color: #c62828; }
    .pdf-wrapper { flex: 1; overflow: hidden; }
    .pdf-iframe { width: 100%; height: 100%; border: none; }
    .image-wrapper { flex: 1; overflow: auto; padding: 1rem; background: #424242; }
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

  constructor(
    private route:        ActivatedRoute,
    private svc:          DocumentsService,
    private sanitizer:    DomSanitizer,
    private offlineCache: OfflineDocumentCacheService,
    private connectivity: ConnectivityService,
  ) {}

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
}
