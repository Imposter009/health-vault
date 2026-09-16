import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { ConnectivityService } from './core/connectivity.service';
import { AuthService } from './auth/auth.service';
import { AiService } from './ai/ai.service';
import { ThemeService } from './core/theme.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <!-- Sidebar nav shell — only when authenticated -->
    <ng-container *ngIf="auth.isAuthenticated()">
      <button class="sidebar-toggle" (click)="sidebarOpen.set(!sidebarOpen())"
              aria-label="Toggle navigation">
        <span class="sidebar-toggle__icon" aria-hidden="true">
          <span></span><span></span><span></span>
        </span>
      </button>

      <div class="sidebar-scrim" *ngIf="sidebarOpen()" (click)="sidebarOpen.set(false)"></div>

      <aside class="sidebar" [class.sidebar--open]="sidebarOpen()">
        <a routerLink="/dashboard" class="sidebar__brand" aria-label="Health Vault home">
          <svg class="sidebar__logo" viewBox="0 0 40 40" fill="none" aria-hidden="true">
            <rect width="40" height="40" rx="10" fill="#0d9488"/>
            <path d="M20 10v20M10 20h20" stroke="#fff" stroke-width="4" stroke-linecap="round"/>
            <path d="M13 20h3l2-6 4 12 2-6h3" stroke="#ccfbf1" stroke-width="2.2"
                  stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <span class="sidebar__wordmark">Health<b>Vault</b></span>
        </a>

        <nav class="sidebar__nav" aria-label="Main navigation" (click)="sidebarOpen.set(false)">
          <a routerLink="/dashboard" routerLinkActive="active" class="sidebar__link">
            <span class="sidebar__icon" aria-hidden="true">▦</span>
            <span>Dashboard</span>
          </a>
          <a routerLink="/metrics" routerLinkActive="active" class="sidebar__link">
            <span class="sidebar__icon" aria-hidden="true">♡</span>
            <span>Metrics</span>
          </a>
          <a routerLink="/medications" routerLinkActive="active" class="sidebar__link">
            <span class="sidebar__icon" aria-hidden="true">💊</span>
            <span>Medications</span>
          </a>
          <a routerLink="/documents" routerLinkActive="active" class="sidebar__link">
            <span class="sidebar__icon" aria-hidden="true">🗂</span>
            <span>Documents</span>
          </a>
          <a routerLink="/audit-log" routerLinkActive="active" class="sidebar__link">
            <span class="sidebar__icon" aria-hidden="true">◷</span>
            <span>Activity Log</span>
          </a>
          <a *ngIf="aiEnabled()" routerLink="/ai/chat" routerLinkActive="active"
             class="sidebar__link sidebar__link--ai">
            <span class="sidebar__icon" aria-hidden="true">✦</span>
            <span>AI Chat</span>
          </a>
        </nav>

        <div class="sidebar__footer">
          <button type="button" class="sidebar__theme-toggle"
                  (click)="theme.toggle()"
                  [attr.aria-label]="theme.theme() === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'">
            <span aria-hidden="true">{{ theme.theme() === 'dark' ? '☀' : '☾' }}</span>
            <span>{{ theme.theme() === 'dark' ? 'Light mode' : 'Dark mode' }}</span>
          </button>
          <a routerLink="/profile" routerLinkActive="active" class="sidebar__user"
             (click)="sidebarOpen.set(false)">
            <span class="sidebar__avatar">{{ initials() }}</span>
            <span class="sidebar__user-info">
              <span class="sidebar__user-name">{{ auth.currentUser()?.fullName ?? 'My Profile' }}</span>
              <span class="sidebar__user-email">{{ auth.currentUser()?.email ?? '' }}</span>
            </span>
          </a>
          <button class="sidebar__signout" (click)="signOut()" [disabled]="signingOut()">
            {{ signingOut() ? 'Signing out…' : 'Sign Out' }}
          </button>
        </div>
      </aside>
    </ng-container>

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

    <footer class="app-footer" [class.has-nav]="auth.isAuthenticated()" *ngIf="auth.isAuthenticated()">
      <span>© 2026 health-vault</span>
      <span class="app-footer__sep" aria-hidden="true">·</span>
      <span>Created by Sumit</span>
    </footer>
  `,
  styles: [`
    /* ── Sidebar */
    .sidebar {
      position: fixed; top: 0; left: 0; bottom: 0; z-index: 100;
      width: var(--sidebar-width, 272px);
      background: var(--color-card, #fff);
      border-right: 1px solid var(--color-border, #e2e8f0);
      box-shadow: var(--shadow-sm);
      display: flex; flex-direction: column;
      transition: transform 0.2s ease;
    }
    .sidebar__brand {
      display: flex; align-items: center; gap: 0.6rem;
      height: 72px; padding: 0 1.5rem; flex-shrink: 0;
      text-decoration: none;
      border-bottom: 1px solid var(--color-border, #e2e8f0);
    }
    .sidebar__logo { width: 32px; height: 32px; flex-shrink: 0; }
    .sidebar__wordmark {
      font-size: 1.0625rem; font-weight: 800; letter-spacing: -0.02em;
      color: var(--color-ink, #0f172a);
    }
    .sidebar__wordmark b { color: var(--color-primary, #0d9488); font-weight: 800; }

    .sidebar__nav {
      flex: 1; overflow-y: auto;
      padding: 1rem 0.75rem; display: flex; flex-direction: column; gap: 0.15rem;
    }
    .sidebar__link {
      display: flex; align-items: center; gap: 0.75rem;
      padding: 0.6rem 0.85rem; border-radius: var(--radius-md, 8px);
      font-size: 0.9rem; font-weight: 500;
      color: var(--color-text-secondary, #64748b);
      text-decoration: none;
      transition: background 0.12s, color 0.12s;
    }
    .sidebar__icon { font-size: 1.05rem; width: 22px; text-align: center; flex-shrink: 0; }
    .sidebar__link:hover { background: var(--color-surface-sub, #f1f5f9); color: var(--color-text, #0f172a); }
    .sidebar__link.active {
      background: var(--color-surface-sub, #f1f5f9);
      color: var(--color-ink, #0f172a);
      font-weight: 700;
    }
    .sidebar__link--ai:not(.active) { color: var(--color-primary, #0d9488); }

    .sidebar__footer {
      flex-shrink: 0; padding: 0.85rem 0.75rem;
      border-top: 1px solid var(--color-border, #e2e8f0);
      display: flex; flex-direction: column; gap: 0.6rem;
    }
    .sidebar__user {
      display: flex; align-items: center; gap: 0.65rem;
      padding: 0.4rem 0.5rem; border-radius: var(--radius-md, 8px);
      text-decoration: none; transition: background 0.12s;
    }
    .sidebar__user:hover, .sidebar__user.active { background: var(--color-surface-sub, #f1f5f9); }
    .sidebar__avatar {
      width: 34px; height: 34px; border-radius: 50%; flex-shrink: 0;
      background: var(--color-primary, #0d9488); color: var(--color-text-on-primary, #fff);
      display: flex; align-items: center; justify-content: center;
      font-size: 0.75rem; font-weight: 700;
    }
    .sidebar__user-info { display: flex; flex-direction: column; min-width: 0; }
    .sidebar__user-name {
      font-size: 0.8125rem; font-weight: 600; color: var(--color-text, #0f172a);
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .sidebar__user-email {
      font-size: 0.75rem; color: var(--color-text-muted, #94a3b8);
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .sidebar__signout {
      background: transparent;
      border: 1px solid var(--color-border, #e2e8f0);
      border-radius: var(--radius-md, 8px);
      padding: 0.4rem 0.75rem;
      font-size: 0.8125rem; font-weight: 600;
      cursor: pointer; color: var(--color-text-secondary, #64748b);
      font-family: var(--font-sans, system-ui, sans-serif);
      transition: border-color 0.15s, color 0.15s;
    }
    .sidebar__signout:hover:not(:disabled) {
      border-color: var(--color-danger, #dc2626);
      color: var(--color-danger, #dc2626);
    }
    .sidebar__signout:disabled { opacity: 0.5; cursor: not-allowed; }

    .sidebar__theme-toggle {
      display: flex; align-items: center; gap: 0.6rem;
      background: transparent;
      border: 1px solid var(--color-border, #e2e8f0);
      border-radius: var(--radius-md, 8px);
      padding: 0.45rem 0.75rem;
      font-size: 0.8125rem; font-weight: 600;
      cursor: pointer; color: var(--color-text-secondary, #64748b);
      font-family: var(--font-sans, system-ui, sans-serif);
      transition: border-color 0.15s, color 0.15s, background 0.15s;
    }
    .sidebar__theme-toggle:hover {
      border-color: var(--color-primary, #0d9488);
      color: var(--color-primary, #0d9488);
      background: var(--color-primary-muted, rgba(13,148,136,.08));
    }

    /* ── Mobile toggle + scrim (hidden on desktop) */
    .sidebar-toggle {
      display: none;
      position: fixed; top: 0; left: 0; z-index: 110;
      width: var(--nav-height, 48px); height: var(--nav-height, 48px);
      background: var(--color-card, #fff);
      border: none; border-bottom: 1px solid var(--color-border, #e2e8f0);
      border-right: 1px solid var(--color-border, #e2e8f0);
      align-items: center; justify-content: center;
      cursor: pointer;
    }
    .sidebar-toggle__icon { display: flex; flex-direction: column; gap: 4px; }
    .sidebar-toggle__icon span {
      display: block; width: 18px; height: 2px;
      background: var(--color-ink, #0f172a); border-radius: 2px;
    }
    .sidebar-scrim {
      display: none;
      position: fixed; inset: 0; z-index: 99;
      background: rgba(15, 23, 42, 0.4);
    }

    @media (max-width: 768px) {
      .sidebar {
        transform: translateX(-100%);
        top: var(--nav-height, 48px);
      }
      .sidebar.sidebar--open { transform: translateX(0); }
      .sidebar-toggle { display: flex; }
      .sidebar-scrim { display: block; }
      main.has-nav, .app-footer.has-nav { margin-left: 0 !important; }
    }

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
    main.has-nav {
      margin-left: var(--sidebar-width, 272px);
      padding-top: var(--nav-height, 0px);
      min-height: calc(100vh - 40px);
    }

    /* ── Footer */
    .app-footer {
      display: flex; align-items: center; justify-content: center;
      gap: 0.5rem; padding: 1rem;
      font-size: 0.8125rem; color: var(--color-text-muted, #94a3b8);
      border-top: 1px solid var(--color-border, #e2e8f0);
    }
    .app-footer.has-nav { margin-left: var(--sidebar-width, 272px); }
    .app-footer__sep { color: var(--color-border, #e2e8f0); }
  `]
})
export class AppComponent {
  readonly connectivity = inject(ConnectivityService);
  readonly auth         = inject(AuthService);
  readonly theme        = inject(ThemeService);
  private  router       = inject(Router);
  private  aiSvc        = inject(AiService);

  signingOut  = signal(false);
  aiEnabled   = signal(false);
  sidebarOpen = signal(false);

  constructor() {
    this.aiSvc.getStatus().subscribe(s => this.aiEnabled.set(s.enabled));

    // currentUser is only populated right after a fresh login/register — on a
    // page reload with an existing token we still need to fetch it once so the
    // sidebar (and dashboard greeting) can show the signed-in user's name.
    if (this.auth.isAuthenticated() && !this.auth.currentUser()) {
      this.auth.loadCurrentUser().subscribe({ error: () => {} });
    }
  }

  initials(): string {
    const name = this.auth.currentUser()?.fullName ?? '';
    return name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map(w => w[0]?.toUpperCase() ?? '')
      .join('');
  }

  signOut(): void {
    this.signingOut.set(true);
    this.auth.logout().subscribe({
      next:  () => { this.signingOut.set(false); this.router.navigate(['/login']); },
      error: () => { this.signingOut.set(false); this.router.navigate(['/login']); }
    });
  }
}
