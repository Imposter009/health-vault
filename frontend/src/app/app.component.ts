import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { ConnectivityService } from './core/connectivity.service';
import { AuthService } from './auth/auth.service';
import { AiService } from './ai/ai.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <!-- Navigation shell — only when authenticated -->
    <header class="app-nav" *ngIf="auth.isAuthenticated()">
      <a routerLink="/profile" class="app-nav__logo" aria-label="Health Vault home">
        <svg class="app-nav__logo-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 20.5C12 20.5 3.5 14.5 3.5 9a8.5 8.5 0 0117 0c0 5.5-8.5 11.5-8.5 11.5z"
                stroke="currentColor" stroke-width="1.5" fill="none"/>
          <path d="M9 12h1.5l1-2.5 1 5 1-6 1 3.5H15" stroke="currentColor" stroke-width="1.5"
                stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <span class="app-nav__logo-text">Health Vault</span>
      </a>

      <nav class="app-nav__links" aria-label="Main navigation">
        <a routerLink="/profile"   routerLinkActive="active"
           [routerLinkActiveOptions]="{exact:true}" class="app-nav__link">Profile</a>
        <a routerLink="/metrics"   routerLinkActive="active" class="app-nav__link">Metrics</a>
        <a routerLink="/dashboard" routerLinkActive="active" class="app-nav__link">Dashboard</a>
        <a routerLink="/documents" routerLinkActive="active" class="app-nav__link">Documents</a>
        <a routerLink="/audit-log" routerLinkActive="active" class="app-nav__link">Activity Log</a>
        <a *ngIf="aiEnabled()" routerLink="/ai/chat" routerLinkActive="active" class="app-nav__link app-nav__link--ai">AI Chat</a>
      </nav>

      <button class="app-nav__signout" (click)="signOut()" [disabled]="signingOut()">
        {{ signingOut() ? 'Signing out…' : 'Sign Out' }}
      </button>
    </header>

    <!-- Offline bar — calm, informational -->
    <div class="offline-bar" *ngIf="!connectivity.isOnline()" role="status" aria-live="polite">
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5"
           class="offline-bar__icon" aria-hidden="true">
        <path stroke-linecap="round" stroke-linejoin="round"
              d="M3 3l14 14M8.5 8.5A5 5 0 0115 13m-9-5A9 9 0 0118 16.5m-14 0A9 9 0 019 8.5"/>
      </svg>
      No internet connection — showing cached data. Some features are unavailable.
    </div>

    <main [class.has-nav]="auth.isAuthenticated()">
      <router-outlet></router-outlet>
    </main>

    <footer class="app-footer" *ngIf="auth.isAuthenticated()">
      <span>© 2026 health-vault</span>
      <span class="app-footer__sep" aria-hidden="true">·</span>
      <span>Created by Sumit</span>
    </footer>
  `,
  styles: [`
    /* ── Nav shell */
    .app-nav {
      position: sticky; top: 0; z-index: 100;
      height: var(--nav-height, 56px);
      background: var(--color-card, #fff);
      border-bottom: 1px solid var(--color-border, #e2e8f0);
      display: flex; align-items: center;
      padding: 0 1.5rem; gap: 1.5rem;
      box-shadow: 0 1px 3px rgba(0,0,0,0.06);
    }
    .app-nav__logo {
      display: flex; align-items: center; gap: 0.5rem;
      font-weight: 700; font-size: 0.9375rem;
      color: var(--color-text, #1e293b);
      text-decoration: none; flex-shrink: 0;
    }
    .app-nav__logo:hover { color: var(--color-primary, #0f766e); }
    .app-nav__logo-icon { width: 26px; height: 26px; color: var(--color-primary, #0f766e); }
    .app-nav__logo-text { letter-spacing: -0.3px; }
    .app-nav__links {
      display: flex; align-items: center; gap: 0.25rem; flex: 1;
      overflow-x: auto; scrollbar-width: none;
    }
    .app-nav__links::-webkit-scrollbar { display: none; }
    .app-nav__link {
      padding: 0.35rem 0.75rem;
      border-radius: var(--radius-md, 8px);
      font-size: 0.875rem; font-weight: 500;
      color: var(--color-text-secondary, #64748b);
      text-decoration: none; white-space: nowrap;
      transition: color 0.1s, background 0.1s;
    }
    .app-nav__link:hover { color: var(--color-text, #1e293b); background: var(--color-surface, #f8fafc); }
    .app-nav__link.active {
      color: var(--color-primary, #0f766e);
      background: var(--color-primary-light, #ccfbf1);
    }
    .app-nav__link--ai {
      border: 1px solid var(--color-primary, #0f766e);
    }
    .app-nav__link--ai.active, .app-nav__link--ai:hover {
      background: var(--color-primary-light, #ccfbf1);
    }
    .app-nav__signout {
      flex-shrink: 0;
      background: transparent;
      border: 1px solid var(--color-border, #e2e8f0);
      border-radius: var(--radius-md, 8px);
      padding: 0.35rem 0.85rem;
      font-size: 0.8125rem; font-weight: 500;
      cursor: pointer; color: var(--color-text-secondary, #64748b);
      font-family: var(--font-sans, system-ui, sans-serif);
      transition: border-color 0.15s, color 0.15s;
    }
    .app-nav__signout:hover:not(:disabled) {
      border-color: var(--color-danger, #dc2626);
      color: var(--color-danger, #dc2626);
    }
    .app-nav__signout:disabled { opacity: 0.5; cursor: not-allowed; }

    /* ── Offline bar — calm navy, not alarming */
    .offline-bar {
      position: fixed; bottom: 0; left: 0; right: 0; z-index: 9999;
      background: #1e3a5f; color: #d4e6f8;
      text-align: center; padding: 0.55rem 1rem;
      font-size: 0.8125rem; font-weight: 500;
      display: flex; align-items: center; justify-content: center; gap: 0.5rem;
    }
    .offline-bar__icon { width: 16px; height: 16px; flex-shrink: 0; }

    /* ── Main content */
    main { min-height: 100vh; }
    main.has-nav { min-height: calc(100vh - var(--nav-height, 56px) - 40px); }

    /* ── Footer */
    .app-footer {
      display: flex; align-items: center; justify-content: center;
      gap: 0.5rem; padding: 1rem;
      font-size: 0.8125rem; color: var(--color-text-muted, #94a3b8);
      border-top: 1px solid var(--color-border, #e2e8f0);
    }
    .app-footer__sep { color: var(--color-border, #e2e8f0); }
  `]
})
export class AppComponent {
  readonly connectivity = inject(ConnectivityService);
  readonly auth         = inject(AuthService);
  private  router       = inject(Router);
  private  aiSvc        = inject(AiService);

  signingOut = signal(false);
  aiEnabled  = signal(false);

  constructor() {
    this.aiSvc.getStatus().subscribe(s => this.aiEnabled.set(s.enabled));
  }

  signOut(): void {
    this.signingOut.set(true);
    this.auth.logout().subscribe({
      next:  () => { this.signingOut.set(false); this.router.navigate(['/login']); },
      error: () => { this.signingOut.set(false); this.router.navigate(['/login']); }
    });
  }
}
