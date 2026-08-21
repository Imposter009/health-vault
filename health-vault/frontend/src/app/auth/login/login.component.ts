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
        <h1>Health Vault</h1>
        <h2>Sign In</h2>
        <form [formGroup]="form" (ngSubmit)="submit()">
          <div class="field">
            <label for="email">Email</label>
            <input id="email" type="email" formControlName="email" placeholder="you@example.com" autocomplete="email" />
            <span class="hint" *ngIf="f['email'].invalid && f['email'].touched">Valid email required</span>
          </div>
          <div class="field">
            <label for="password">Password</label>
            <input id="password" type="password" formControlName="password" placeholder="••••••••" autocomplete="current-password" />
            <span class="hint" *ngIf="f['password'].invalid && f['password'].touched">Password required</span>
          </div>
          <p class="error" *ngIf="serverError()">{{ serverError() }}</p>
          <button type="submit" [disabled]="loading() || form.invalid" class="btn-primary">
            {{ loading() ? 'Signing in…' : 'Sign In' }}
          </button>
        </form>
        <p class="nav-link">No account? <a routerLink="/register">Register</a></p>
      </div>
    </div>
  `,
  styles: [`
    .auth-wrap { display:flex; align-items:center; justify-content:center; min-height:100vh; background:#f5f7fb; }
    .auth-card { background:#fff; border-radius:12px; box-shadow:0 4px 24px rgba(0,0,0,.08); padding:2.5rem; width:100%; max-width:400px; }
    h1 { margin:0 0 .25rem; font-size:1.25rem; color:#4f46e5; font-weight:700; letter-spacing:-.5px; }
    h2 { margin:0 0 1.75rem; font-size:1.5rem; font-weight:600; color:#111; }
    .field { display:flex; flex-direction:column; margin-bottom:1.25rem; }
    label { font-size:.875rem; font-weight:500; color:#374151; margin-bottom:.4rem; }
    input { padding:.65rem .85rem; border:1.5px solid #d1d5db; border-radius:8px; font-size:1rem; outline:none; transition:border-color .15s; }
    input:focus { border-color:#4f46e5; }
    .hint { font-size:.8rem; color:#ef4444; margin-top:.3rem; }
    .error { color:#ef4444; font-size:.875rem; margin:.5rem 0; }
    .btn-primary { width:100%; padding:.75rem; background:#4f46e5; color:#fff; border:none; border-radius:8px; font-size:1rem; font-weight:600; cursor:pointer; margin-top:.5rem; transition:background .15s; }
    .btn-primary:hover:not(:disabled) { background:#4338ca; }
    .btn-primary:disabled { opacity:.6; cursor:not-allowed; }
    .nav-link { text-align:center; margin-top:1.25rem; font-size:.9rem; color:#6b7280; }
    .nav-link a { color:#4f46e5; font-weight:500; text-decoration:none; }
    .nav-link a:hover { text-decoration:underline; }
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
