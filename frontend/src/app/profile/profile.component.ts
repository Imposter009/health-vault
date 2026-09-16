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
      </div>
    </div>
  `,
  styles: [`
    .profile-page {
      display: flex; align-items: center; justify-content: center;
      min-height: 70vh;
      padding: 2rem 1rem;
    }
    .state-msg { text-align:center; color: var(--color-text-secondary); font-size:1rem; }
    .state-msg.error { color: var(--color-danger); }
    .btn-retry {
      margin-top:.75rem; padding:.5rem 1.25rem;
      background: var(--color-primary); color:var(--color-text-on-primary); border:none; border-radius: var(--radius-md);
      cursor:pointer; font-family:inherit; font-size:.9rem;
    }
    .profile-card {
      background: var(--color-card); border:1px solid var(--color-border);
      border-radius: var(--radius-xl); box-shadow: var(--shadow-lg);
      padding:2.5rem; text-align:center;
      min-width:300px; max-width:420px; width:100%;
    }
    .avatar {
      width:68px; height:68px; border-radius:50%;
      background: var(--color-primary); color:var(--color-text-on-primary);
      font-size:1.625rem; font-weight:700;
      display:flex; align-items:center; justify-content:center;
      margin:0 auto 1rem;
    }
    .profile-name { margin:0 0 .3rem; font-size:1.375rem; font-weight:700; color: var(--color-ink); }
    .profile-email { margin:0 0 1.5rem; color: var(--color-text-secondary); font-size:.9rem; }
    .profile-meta { text-align:left; border-top:1px solid var(--color-surface-sub); padding-top:1.25rem; margin:0; }
    dt { font-size:.75rem; font-weight:600; color: var(--color-text-muted); text-transform:uppercase; letter-spacing:.05em; margin-bottom:.25rem; }
    dd { margin:0; color: var(--color-text); }
    .mono { font-family: var(--font-mono); font-size:.8125rem; word-break:break-all; }
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
