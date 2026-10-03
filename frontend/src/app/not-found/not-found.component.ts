import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthService } from '../auth/auth.service';

@Component({
  selector: 'app-not-found',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="not-found-wrap">
      <div class="card not-found-card">
        <span class="not-found-code">404</span>
        <h1 class="not-found-title">Page not found</h1>
        <p class="not-found-text">
          The page you're looking for doesn't exist or may have been moved.
        </p>
        <a [routerLink]="auth.isAuthenticated() ? '/dashboard' : '/login'" class="btn btn-primary">
          {{ auth.isAuthenticated() ? 'Back to Dashboard' : 'Back to Sign In' }}
        </a>
      </div>
    </div>
  `,
  styles: [`
    .not-found-wrap {
      display: flex; align-items: center; justify-content: center;
      min-height: 100vh; padding: 1.5rem;
    }
    .not-found-card {
      text-align: center; max-width: 420px; padding: 3rem 2.5rem;
    }
    .not-found-code {
      display: block; font-size: 3.5rem; font-weight: 800;
      color: var(--color-primary); letter-spacing: -0.03em; line-height: 1;
    }
    .not-found-title {
      margin: 0.75rem 0 0.5rem; font-size: 1.375rem; font-weight: 700;
      color: var(--color-ink);
    }
    .not-found-text {
      margin: 0 0 1.75rem; font-size: 0.9375rem; color: var(--color-text-secondary);
    }
  `]
})
export class NotFoundComponent {
  readonly auth = inject(AuthService);
}
