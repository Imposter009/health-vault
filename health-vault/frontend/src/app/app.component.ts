import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { ConnectivityService } from './core/connectivity.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet],
  template: `
    <div class="offline-banner" *ngIf="!connectivity.isOnline()" role="status" aria-live="polite">
      <span class="offline-icon">⚡</span>
      You're offline — showing cached data. Some features are unavailable.
    </div>
    <router-outlet></router-outlet>
  `,
  styles: [`
    .offline-banner {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      z-index: 9999;
      background: #e65100;
      color: #fff;
      text-align: center;
      padding: 0.6rem 1rem;
      font-size: 0.9rem;
      font-weight: 500;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      box-shadow: 0 -2px 8px rgba(0,0,0,0.2);
    }
    .offline-icon { font-size: 1rem; }
  `]
})
export class AppComponent {
  constructor(readonly connectivity: ConnectivityService) {}
}
