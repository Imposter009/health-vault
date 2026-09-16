import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  template: `
    <div class="auth-wrap">
      <div class="auth-card">
        <div class="auth-brand">
          <svg class="auth-brand__icon" viewBox="0 0 40 40" fill="none" aria-hidden="true">
            <rect width="40" height="40" rx="10" fill="#0d9488"/>
            <path d="M20 10v20M10 20h20" stroke="#fff" stroke-width="4" stroke-linecap="round"/>
            <path d="M13 20h3l2-6 4 12 2-6h3" stroke="#ccfbf1" stroke-width="2.2"
                  stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <span class="auth-brand__name">Health<b>Vault</b></span>
        </div>
        <h2 class="auth-title">Sign In</h2>
        <p class="auth-tagline">Track your health, privately and securely.</p>
        <form [formGroup]="form" (ngSubmit)="submit()">
          <div class="field">
            <label for="email">Email</label>
            <input id="email" type="email" formControlName="email"
                   placeholder="you@example.com" autocomplete="email"
                   [class.invalid]="f['email'].invalid && f['email'].touched" />
            <span class="hint" *ngIf="f['email'].invalid && f['email'].touched">Valid email required</span>
          </div>
          <div class="field">
            <label for="password">Password</label>
            <input id="password" type="password" formControlName="password"
                   placeholder="••••••••" autocomplete="current-password"
                   [class.invalid]="f['password'].invalid && f['password'].touched" />
            <span class="hint" *ngIf="f['password'].invalid && f['password'].touched">Password required</span>
          </div>
          <p class="auth-error" *ngIf="serverError()" role="alert">{{ serverError() }}</p>
          <button type="submit" [disabled]="loading() || form.invalid" class="auth-submit">
            {{ loading() ? 'Signing in…' : 'Sign In' }}
          </button>
        </form>
        <p class="auth-switch">No account? <a routerLink="/register">Create one</a></p>
      </div>
    </div>
  `,
  styles: [`
    .auth-wrap {
      display:flex; align-items:center; justify-content:center;
      min-height:100vh; font-family: var(--font-sans);
      background: radial-gradient(ellipse at 60% 0%, var(--color-primary-light) 0%, var(--color-surface) 60%);
      padding: 1.5rem;
    }
    .auth-card {
      background: var(--color-card); border-radius: var(--radius-xl);
      box-shadow: var(--shadow-lg);
      padding:2.5rem; width:100%; max-width:400px;
    }
    .auth-brand { display:flex; align-items:center; gap:.6rem; margin-bottom:1.75rem; }
    .auth-brand__icon { width:32px; height:32px; flex-shrink:0; }
    .auth-brand__name { font-size:1.0625rem; font-weight:800; color: var(--color-ink); letter-spacing:-.02em; }
    .auth-brand__name b { color: var(--color-primary); font-weight:800; }
    .auth-title { margin:0 0 .25rem; font-size:1.5rem; font-weight:700; color: var(--color-ink); }
    .auth-tagline { margin:0 0 1.75rem; font-size:.875rem; color: var(--color-text-secondary); }
    .field { display:flex; flex-direction:column; margin-bottom:1.25rem; gap:.35rem; }
    label { font-size:.8125rem; font-weight:600; color: var(--color-text-secondary); }
    input {
      padding:.6rem .8rem; border:1.5px solid var(--color-border); border-radius: var(--radius-md);
      font-size:.9375rem; outline:none; font-family:inherit;
      transition:border-color .15s, box-shadow .15s; color: var(--color-text);
    }
    input:focus { border-color: var(--color-primary); box-shadow: 0 0 0 3px var(--color-primary-glow); }
    input.invalid { border-color: var(--color-danger); }
    .hint { font-size:.8rem; color: var(--color-danger); }
    .auth-error { color: var(--color-danger); font-size:.875rem; margin:.25rem 0 .75rem; }
    .auth-submit {
      width:100%; padding:.75rem; background: var(--color-primary); color:var(--color-text-on-primary);
      border:none; border-radius: var(--radius-md); font-size:.9375rem; font-weight:600;
      cursor:pointer; margin-top:.25rem; transition:background .15s; font-family:inherit;
    }
    .auth-submit:hover:not(:disabled) { background: var(--color-primary-dark); }
    .auth-submit:disabled { opacity:.55; cursor:not-allowed; }
    .auth-switch { text-align:center; margin-top:1.25rem; font-size:.875rem; color: var(--color-text-secondary); }
    .auth-switch a { color: var(--color-primary); font-weight:600; text-decoration:none; }
    .auth-switch a:hover { text-decoration:underline; }
  `]
})
export class LoginComponent {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private router = inject(Router);

  form = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]]
  });

  loading = signal(false);
  serverError = signal<string | null>(null);

  get f() { return this.form.controls; }

  submit(): void {
    if (this.form.invalid || this.loading()) return;
    this.loading.set(true);
    this.serverError.set(null);
    const { email, password } = this.form.value;
    this.auth.login(email!, password!).subscribe({
      next: () => this.router.navigate(['/profile']),
      error: (err) => {
        this.loading.set(false);
        this.serverError.set(err?.error?.message ?? 'Invalid credentials');
      }
    });
  }
}
