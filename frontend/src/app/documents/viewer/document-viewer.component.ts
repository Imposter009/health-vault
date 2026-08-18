import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Subscription } from 'rxjs';
import { DocumentsService } from '../documents.service';
import { DocumentResponse, DocumentStatusResponse } from '../models';

@Component({
  selector: 'app-document-viewer',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="viewer-container">
      <div class="viewer-toolbar">
        <a routerLink="/documents" class="back-link">← Back to Documents</a>
        <span *ngIf="doc" class="doc-title">{{ doc.filename }}</span>

        <!-- Image zoom controls -->
        <div *ngIf="isImage" class="zoom-controls">
          <button (click)="zoom(0.8)">−</button>
          <span>{{ (scale * 100).toFixed(0) }}%</span>
          <button (click)="zoom(1.25)">+</button>
          <button (click)="resetZoom()">Reset</button>
        </div>

        <a *ngIf="rawUrl" [href]="rawUrl" target="_blank" class="btn-sm">Open in new tab</a>
      </div>

      <div *ngIf="loading" class="status">Fetching document…</div>
      <div *ngIf="error"   class="error-msg">{{ error }}</div>

      <!-- OCR status panel — shown while document is processing or after completion -->
      <div *ngIf="!loading && docStatus" class="ocr-panel" [class]="'ocr-' + docStatus.status.toLowerCase()">
        <ng-container [ngSwitch]="docStatus.status">
          <span *ngSwitchCase="'UPLOADED'">
            ⏳ Queued for OCR processing…
          </span>
          <span *ngSwitchCase="'PROCESSING'">
            🔄 Extracting health data…
          </span>
          <span *ngSwitchCase="'PROCESSED'">
            ✅ OCR complete —
            <ng-container *ngIf="docStatus.metricsExtracted > 0; else noMetrics">
              <strong>{{ docStatus.metricsExtracted }}</strong> metric{{ docStatus.metricsExtracted !== 1 ? 's' : '' }} extracted.
              <a routerLink="/metrics">View in Metrics →</a>
            </ng-container>
            <ng-template #noMetrics>no health data patterns found in this document.</ng-template>
          </span>
          <span *ngSwitchCase="'FAILED'">
            ❌ Processing failed: {{ docStatus.processingError }}
          </span>
        </ng-container>
      </div>

      <!-- PDF: iframe (browser native PDF renderer — provides zoom natively) -->
      <div *ngIf="!loading && !error && isPdf" class="pdf-wrapper">
        <iframe [src]="safeUrl" class="pdf-iframe" title="PDF Viewer"></iframe>
      </div>

      <!-- Image: img + CSS scale transform -->
      <div *ngIf="!loading && !error && isImage" class="image-wrapper" (wheel)="onWheel($event)">
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

  loading  = true;
  error:   string | null = null;
  scale    = 1.0;

  private pollSub?: Subscription;

  get isPdf():   boolean { return this.doc?.mimeType === 'application/pdf'; }
  get isImage(): boolean { return this.doc?.mimeType.startsWith('image/') ?? false; }

  constructor(
    private route:     ActivatedRoute,
    private svc:       DocumentsService,
    private sanitizer: DomSanitizer,
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id')!;

    this.svc.getById(id).subscribe({
      next: doc => {
        this.doc = doc;
        this.svc.getDownloadUrl(id).subscribe({
          next: resp => {
            this.rawUrl  = resp.url;
            this.safeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(resp.url);
            this.loading = false;
          },
          error: err => this.handleError(err),
        });
        // Start polling status if not already terminal
        this.startPolling(id, doc.status);
      },
      error: err => this.handleError(err),
    });
  }

  ngOnDestroy(): void {
    this.pollSub?.unsubscribe();
  }

  private startPolling(id: string, initialStatus: string): void {
    // Do one immediate fetch to show initial status in the panel
    this.svc.getStatus(id).subscribe({
      next: s => { this.docStatus = s; },
    });

    // Then poll while non-terminal (stops automatically at PROCESSED/FAILED via takeWhile)
    if (initialStatus === 'PROCESSED' || initialStatus === 'FAILED') return;
    this.pollSub = this.svc.pollStatus(id).subscribe({
      next: s => { this.docStatus = s; },
    });
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

  private handleError(err: any): void {
    this.loading = false;
    this.error   = err?.error?.message ?? 'Failed to load document.';
  }
}
