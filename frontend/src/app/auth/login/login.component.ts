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
          <svg class="auth-brand__icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M12 20.5C12 20.5 3.5 14.5 3.5 9a8.5 8.5 0 0117 0c0 5.5-8.5 11.5-8.5 11.5z"
                  stroke="currentColor" stroke-width="1.5" fill="none"/>
            <path d="M9 12h1.5l1-2.5 1 5 1-6 1 3.5H15" stroke="currentColor" stroke-width="1.5"
                  stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <span class="auth-brand__name">Health Vault</span>
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
      min-height:100vh;
      background: radial-gradient(ellipse at 60% 0%, #ccfbf1 0%, #f8fafc 60%);
      padding: 1.5rem;
    }
    .auth-card {
      background:#fff; border-radius:16px;
      box-shadow:0 4px 32px rgba(0,0,0,.09), 0 1px 4px rgba(0,0,0,.05);
      padding:2.5rem; width:100%; max-width:400px;
    }
    .auth-brand { display:flex; align-items:center; gap:.5rem; margin-bottom:1.75rem; }
    .auth-brand__icon { width:28px; height:28px; color:#0f766e; }
    .auth-brand__name { font-size:1rem; font-weight:700; color:#0f766e; letter-spacing:-.3px; }
    .auth-title { margin:0 0 .25rem; font-size:1.5rem; font-weight:700; color:#1e293b; }
    .auth-tagline { margin:0 0 1.75rem; font-size:.875rem; color:#64748b; }
    .field { display:flex; flex-direction:column; margin-bottom:1.25rem; gap:.35rem; }
    label { font-size:.8125rem; font-weight:600; color:#64748b; }
    input {
      padding:.6rem .8rem; border:1.5px solid #e2e8f0; border-radius:8px;
      font-size:.9375rem; outline:none; font-family:inherit;
      transition:border-color .15s, box-shadow .15s; color:#1e293b;
    }
    input:focus { border-color:#0f766e; box-shadow:0 0 0 3px rgba(15,118,110,.1); }
    input.invalid { border-color:#dc2626; }
    .hint { font-size:.8rem; color:#dc2626; }
    .auth-error { color:#dc2626; font-size:.875rem; margin:.25rem 0 .75rem; }
    .auth-submit {
      width:100%; padding:.75rem; background:#0f766e; color:#fff;
      border:none; border-radius:8px; font-size:.9375rem; font-weight:600;
      cursor:pointer; margin-top:.25rem; transition:background .15s; font-family:inherit;
    }
    .auth-submit:hover:not(:disabled) { background:#0d5f59; }
    .auth-submit:disabled { opacity:.55; cursor:not-allowed; }
    .auth-switch { text-align:center; margin-top:1.25rem; font-size:.875rem; color:#64748b; }
    .auth-switch a { color:#0f766e; font-weight:600; text-decoration:none; }
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
