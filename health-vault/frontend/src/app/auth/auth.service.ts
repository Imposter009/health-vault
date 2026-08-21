import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, throwError, shareReplay, finalize } from 'rxjs';
import { catchError, map, switchMap, tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { AuthResponse, UserProfile } from './models';

const AT_KEY = 'hv_at';
const RT_KEY = 'hv_rt';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/auth`;
  private readonly meUrl = `${environment.apiBaseUrl}/users/me`;

  private readonly _user = signal<UserProfile | null>(null);
  private readonly _hasToken = signal(!!this.getAccessToken());

  readonly currentUser = this._user.asReadonly();
  readonly isAuthenticated = computed(() => this._hasToken());

  private _refreshObs: Observable<string> | null = null;

  getAccessToken(): string | null {
    try { return localStorage.getItem(AT_KEY); } catch { return null; }
  }

  getRefreshToken(): string | null {
    try { return localStorage.getItem(RT_KEY); } catch { return null; }
  }

  loadCurrentUser(): Observable<UserProfile> {
    return this.http.get<UserProfile>(this.meUrl).pipe(
      tap((u) => this._user.set(u))
    );
  }

  login(email: string, password: string): Observable<void> {
    return this.http.post<AuthResponse>(`${this.base}/login`, { email, password }).pipe(
      switchMap((resp) => this.handleAuth(resp))
    );
  }

  register(email: string, password: string, fullName: string): Observable<void> {
    return this.http.post(`${this.base}/register`, { email, password, fullName }).pipe(
      switchMap(() => this.login(email, password))
    );
  }

  logout(): Observable<void> {
    const rt = this.getRefreshToken();
    const at = this.getAccessToken();
    if (!at || !rt) {
      this.clearSession();
      return of(void 0);
    }
    return this.http.post(`${this.base}/logout`, { refreshToken: rt }).pipe(
      finalize(() => this.clearSession()),
      map(() => void 0),
      catchError(() => of(void 0))
    );
  }

  tryRefresh(): Observable<string> {
    if (this._refreshObs) return this._refreshObs;
    const rt = this.getRefreshToken();
    if (!rt) {
      this.clearSession();
      return throwError(() => new Error('No refresh token'));
    }
    this._refreshObs = this.http.post<AuthResponse>(`${this.base}/refresh`, { refreshToken: rt }).pipe(
      tap((resp) => this.storeTokens(resp.accessToken, resp.refreshToken)),
      map((resp) => resp.accessToken),
      catchError((err) => {
        this.clearSession();
        return throwError(() => err);
      }),
      shareReplay(1),
      finalize(() => { this._refreshObs = null; })
    );
    return this._refreshObs;
  }

  clearSession(): void {
    try {
      localStorage.removeItem(AT_KEY);
      localStorage.removeItem(RT_KEY);
    } catch { /* ignore */ }
    this._user.set(null);
    this._hasToken.set(false);
  }

  private handleAuth(resp: AuthResponse): Observable<void> {
    this.storeTokens(resp.accessToken, resp.refreshToken);
    return this.http.get<UserProfile>(this.meUrl).pipe(
      tap((u) => this._user.set(u)),
      map(() => void 0),
      catchError(() => of(void 0))
    );
  }

  private storeTokens(at: string, rt: string): void {
    try {
      localStorage.setItem(AT_KEY, at);
      localStorage.setItem(RT_KEY, rt);
      this._hasToken.set(true);
    } catch { /* ignore */ }
  }
}
