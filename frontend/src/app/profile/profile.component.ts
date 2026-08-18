import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../auth/auth.service';
import { UserProfile } from '../auth/models';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="page">
      <header class="topbar">
        <span class="logo">Health Vault</span>
        <button class="btn-logout" (click)="logout()" [disabled]="loggingOut()">
          {{ loggingOut() ? 'Signing out…' : 'Sign Out' }}
        </button>
      </header>

      <main class="content">
        <div *ngIf="loading()" class="state-msg">Loading your profile…</div>

        <div *ngIf="!loading() && error()" class="error-box">
          <p>{{ error() }}</p>
          <button (click)="reload()" class="btn-retry">Retry</button>
        </div>

        <div *ngIf="!loading() && user()" class="profile-card">
          <div class="avatar">{{ initials() }}</div>
          <h2 class="name">{{ user()!.fullName }}</h2>
          <p class="email">{{ user()!.email }}</p>
          <dl class="meta">
            <dt>User ID</dt>
            <dd class="mono">{{ user()!.id }}</dd>
          </dl>
          <div class="nav-links">
            <a routerLink="/metrics" class="nav-btn">My Metrics</a>
            <a routerLink="/dashboard" class="nav-btn">Dashboard</a>
            <a routerLink="/documents" class="nav-btn">Documents</a>
          </div>
        </div>
      </main>
    </div>
  `,
  styles: [`
    .page { min-height:100vh; background:#f5f7fb; display:flex; flex-direction:column; }
    .topbar { background:#4f46e5; color:#fff; padding:.9rem 1.5rem; display:flex; align-items:center; justify-content:space-between; box-shadow:0 2px 8px rgba(0,0,0,.15); }
    .logo { font-size:1.1rem; font-weight:700; letter-spacing:-.5px; }
    .btn-logout { background:rgba(255,255,255,.15); color:#fff; border:1px solid rgba(255,255,255,.3); border-radius:6px; padding:.4rem .9rem; font-size:.9rem; cursor:pointer; transition:background .15s; }
    .btn-logout:hover:not(:disabled) { background:rgba(255,255,255,.25); }
    .btn-logout:disabled { opacity:.6; cursor:not-allowed; }
    .content { flex:1; display:flex; align-items:center; justify-content:center; padding:2rem; }
    .state-msg { color:#6b7280; font-size:1rem; }
    .error-box { text-align:center; color:#ef4444; }
    .btn-retry { margin-top:.75rem; padding:.5rem 1.25rem; background:#4f46e5; color:#fff; border:none; border-radius:6px; cursor:pointer; }
    .profile-card { background:#fff; border-radius:16px; box-shadow:0 4px 24px rgba(0,0,0,.08); padding:2.5rem; text-align:center; min-width:320px; max-width:420px; width:100%; }
    .avatar { width:72px; height:72px; border-radius:50%; background:#4f46e5; color:#fff; font-size:1.75rem; font-weight:700; display:flex; align-items:center; justify-content:center; margin:0 auto 1rem; }
    .name { margin:0 0 .35rem; font-size:1.5rem; font-weight:600; color:#111; }
    .email { margin:0 0 1.5rem; color:#6b7280; font-size:.95rem; }
    dl.meta { text-align:left; border-top:1px solid #f3f4f6; padding-top:1.25rem; margin:0; }
    dt { font-size:.75rem; font-weight:600; color:#9ca3af; text-transform:uppercase; letter-spacing:.05em; margin-bottom:.25rem; }
    dd { margin:0 0 1rem; color:#374151; }
    .mono { font-family:monospace; font-size:.85rem; word-break:break-all; }
    .nav-links { display:flex; gap:.75rem; margin-top:1.5rem; justify-content:center; }
    .nav-btn { display:inline-block; padding:.5rem 1.2rem; background:#4f46e5; color:#fff;
      border-radius:6px; text-decoration:none; font-size:.9rem; }
    .nav-btn:hover { background:#4338ca; }
  `]
})
export class ProfileComponent implements OnInit {
  private auth = inject(AuthService);
  private router = inject(Router);

  user = signal<UserProfile | null>(null);
  loading = signal(true);
  error = signal<string | null>(null);
  loggingOut = signal(false);

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

  logout(): void {
    this.loggingOut.set(true);
    this.auth.logout().subscribe({
      next: () => this.router.navigate(['/login']),
      error: () => this.router.navigate(['/login'])
    });
  }
}
