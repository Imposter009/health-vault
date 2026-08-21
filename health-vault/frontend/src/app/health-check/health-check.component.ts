import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { environment } from '../../environments/environment';

interface HealthStatus {
  status: string;
  service: string;
}

@Component({
  selector: 'app-health-check',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="health-check-container">
      <h1>Health Vault</h1>
      <p class="subtitle">Personal Health Record Vault — Phase 0 Scaffold</p>

      <div class="status-card" [class.up]="healthStatus?.status === 'UP'" [class.error]="!!error">
        <ng-container *ngIf="loading">
          <p class="loading">Checking backend…</p>
        </ng-container>

        <ng-container *ngIf="!loading && healthStatus">
          <div class="status-row">
            <span class="label">Status</span>
            <span class="value status-up">{{ healthStatus.status }}</span>
          </div>
          <div class="status-row">
            <span class="label">Service</span>
            <span class="value">{{ healthStatus.service }}</span>
          </div>
          <div class="status-row">
            <span class="label">API Base</span>
            <span class="value api-url">{{ apiBaseUrl }}</span>
          </div>
        </ng-container>

        <ng-container *ngIf="!loading && error">
          <p class="error-msg">⚠ Backend unreachable</p>
          <p class="error-detail">{{ error }}</p>
          <p class="hint">Make sure the Spring Boot backend is running on port 8080.</p>
        </ng-container>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      min-height: 100vh;
      background: #f5f7fa;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }
    .health-check-container {
      max-width: 540px;
      margin: 0 auto;
      padding: 60px 24px;
    }
    h1 {
      font-size: 2rem;
      font-weight: 700;
      color: #1a202c;
      margin: 0 0 4px;
    }
    .subtitle {
      color: #718096;
      font-size: 0.9rem;
      margin: 0 0 32px;
    }
    .status-card {
      background: #fff;
      border-radius: 10px;
      padding: 28px;
      box-shadow: 0 1px 3px rgba(0,0,0,.12), 0 1px 2px rgba(0,0,0,.08);
      border-left: 4px solid #cbd5e0;
    }
    .status-card.up    { border-left-color: #48bb78; }
    .status-card.error { border-left-color: #f56565; }
    .status-row {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      padding: 8px 0;
      border-bottom: 1px solid #f0f0f0;
    }
    .status-row:last-child { border-bottom: none; }
    .label { color: #718096; font-size: 0.85rem; }
    .value { font-weight: 600; color: #2d3748; }
    .status-up { color: #38a169; }
    .api-url   { font-family: monospace; font-size: 0.85rem; }
    .loading   { color: #718096; margin: 0; animation: pulse 1.5s infinite; }
    @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.5} }
    .error-msg  { color: #e53e3e; font-weight: 600; margin: 0 0 8px; }
    .error-detail { font-family: monospace; font-size: 0.8rem; color: #718096; word-break: break-all; }
    .hint { font-size: 0.8rem; color: #a0aec0; margin-top: 12px; }
  `]
})
export class HealthCheckComponent implements OnInit {
  healthStatus: HealthStatus | null = null;
  loading = true;
  error: string | null = null;
  apiBaseUrl = environment.apiBaseUrl;

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.http.get<HealthStatus>(`${environment.apiBaseUrl}/health`).subscribe({
      next: (data) => {
        this.healthStatus = data;
        this.loading = false;
      },
      error: (err: HttpErrorResponse) => {
        this.error = err.message;
        this.loading = false;
      }
    });
  }
}
