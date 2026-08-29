import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from '../auth/auth.service';
import { UserProfile } from '../auth/models';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="profile-page">
      <div *ngIf="loading()" class="state-msg">Loading your profile…</div>

      <div *ngIf="!loading() && error()" class="state-msg error">
        <p>{{ error() }}</p>
        <button (click)="reload()" class="btn-retry">Retry</button>
      </div>

      <div *ngIf="!loading() && user()" class="profile-card">
        <div class="avatar" aria-hidden="true">{{ initials() }}</div>
        <h1 class="profile-name">{{ user()!.fullName }}</h1>
        <p class="profile-email">{{ user()!.email }}</p>

        <dl class="profile-meta">
          <dt>User ID</dt>
          <dd class="mono">{{ user()!.id }}</dd>
        </dl>

        <nav class="profile-nav" aria-label="Quick links">
          <a routerLink="/metrics"   class="profile-nav__btn">My Metrics</a>
          <a routerLink="/dashboard" class="profile-nav__btn">Dashboard</a>
          <a routerLink="/documents" class="profile-nav__btn">Documents</a>
          <a routerLink="/audit-log" class="profile-nav__btn profile-nav__btn--ghost">Activity Log</a>
        </nav>
      </div>
    </div>
  `,
  styles: [`
    .profile-page {
      display: flex; align-items: center; justify-content: center;
      min-height: calc(100vh - 56px);
      padding: 2rem 1rem;
    }
    .state-msg { text-align:center; color:#64748b; font-size:1rem; }
    .state-msg.error { color:#dc2626; }
    .btn-retry {
      margin-top:.75rem; padding:.5rem 1.25rem;
      background:#0f766e; color:#fff; border:none; border-radius:8px;
      cursor:pointer; font-family:inherit; font-size:.9rem;
    }
    .profile-card {
      background:#fff; border:1px solid #e2e8f0;
      border-radius:16px; box-shadow:0 4px 24px rgba(0,0,0,.07);
      padding:2.5rem; text-align:center;
      min-width:300px; max-width:420px; width:100%;
    }
    .avatar {
      width:68px; height:68px; border-radius:50%;
      background:#0f766e; color:#fff;
      font-size:1.625rem; font-weight:700;
      display:flex; align-items:center; justify-content:center;
      margin:0 auto 1rem;
    }
    .profile-name { margin:0 0 .3rem; font-size:1.375rem; font-weight:700; color:#1e293b; }
    .profile-email { margin:0 0 1.5rem; color:#64748b; font-size:.9rem; }
    .profile-meta { text-align:left; border-top:1px solid #f1f5f9; padding-top:1.25rem; margin:0 0 1.5rem; }
    dt { font-size:.75rem; font-weight:600; color:#94a3b8; text-transform:uppercase; letter-spacing:.05em; margin-bottom:.25rem; }
    dd { margin:0; color:#374151; }
    .mono { font-family:ui-monospace,Consolas,monospace; font-size:.8125rem; word-break:break-all; }
    .profile-nav { display:flex; flex-wrap:wrap; gap:.6rem; justify-content:center; }
    .profile-nav__btn {
      padding:.5rem 1.1rem; background:#0f766e; color:#fff;
      border-radius:8px; text-decoration:none; font-size:.875rem; font-weight:600;
      transition:background .15s;
    }
    .profile-nav__btn:hover { background:#0d5f59; }
    .profile-nav__btn--ghost {
      background:transparent; color:#64748b;
      border:1px solid #e2e8f0;
    }
    .profile-nav__btn--ghost:hover { background:#f1f5f9; color:#1e293b; }
  `]
})
export class ProfileComponent implements OnInit {
  private auth = inject(AuthService);

  user    = signal<UserProfile | null>(null);
  loading = signal(true);
  error   = signal<string | null>(null);

  initials = () => {
    const name = this.user()?.fullName ?? '';
    return name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  };

  ngOnInit(): void {
    this.reload();
  }

  reload(): void {
    this.loading.set(true);
    this.error.set(null);
    this.auth.loadCurrentUser().subscribe({
      next: (u) => {
        this.user.set(u);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Could not load profile. Please try again.');
        this.loading.set(false);
      }
    });
  }

}
