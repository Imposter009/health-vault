import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AuthService } from './auth.service';
import { AuthResponse, UserProfile } from './models';
import { environment } from '../../environments/environment';

const AT_KEY = 'hv_at';
const RT_KEY = 'hv_rt';
const BASE = environment.apiBaseUrl;

const mockUser: UserProfile = { id: '00000000-0000-0000-0000-000000000001', email: 'a@b.com', fullName: 'Test User' };
const mockAuth: AuthResponse = { accessToken: 'access.token', refreshToken: 'refreshtoken', expiresIn: 900 };

describe('AuthService', () => {
  let service: AuthService;
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });
    service = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    localStorage.clear();
  });

  it('login stores tokens and sets authenticated', fakeAsync(() => {
    let done = false;
    service.login('a@b.com', 'password1').subscribe({ next: () => { done = true; } });

    http.expectOne(`${BASE}/auth/login`).flush(mockAuth);
    http.expectOne(`${BASE}/users/me`).flush(mockUser);
    tick();

    expect(done).toBeTrue();
    expect(service.getAccessToken()).toBe('access.token');
    expect(localStorage.getItem(RT_KEY)).toBe('refreshtoken');
    expect(service.isAuthenticated()).toBeTrue();
    expect(service.currentUser()).toEqual(mockUser);
  }));

  it('login fails → no tokens stored', fakeAsync(() => {
    let errored = false;
    service.login('a@b.com', 'wrong').subscribe({ error: () => { errored = true; } });

    http.expectOne(`${BASE}/auth/login`).flush({ message: 'INVALID_CREDENTIALS' }, { status: 401, statusText: 'Unauthorized' });
    tick();

    expect(errored).toBeTrue();
    expect(service.getAccessToken()).toBeNull();
    expect(service.isAuthenticated()).toBeFalse();
  }));

  it('register auto-logs in and sets user', fakeAsync(() => {
    let done = false;
    service.register('a@b.com', 'password1', 'Test User').subscribe({ next: () => { done = true; } });

    http.expectOne(`${BASE}/auth/register`).flush({}, { status: 201, statusText: 'Created' });
    http.expectOne(`${BASE}/auth/login`).flush(mockAuth);
    http.expectOne(`${BASE}/users/me`).flush(mockUser);
    tick();

    expect(done).toBeTrue();
    expect(service.isAuthenticated()).toBeTrue();
  }));

  it('register 409 → observable errors', fakeAsync(() => {
    let errored = false;
    service.register('dup@b.com', 'password1', 'Dup User').subscribe({ error: () => { errored = true; } });

    http.expectOne(`${BASE}/auth/register`).flush({ message: 'EMAIL_TAKEN' }, { status: 409, statusText: 'Conflict' });
    tick();

    expect(errored).toBeTrue();
  }));

  it('logout clears session regardless of server response', fakeAsync(() => {
    localStorage.setItem(AT_KEY, 'at');
    localStorage.setItem(RT_KEY, 'rt');
    service['_hasToken'].set(true);
    service['_user'].set(mockUser);

    service.logout().subscribe();
    http.expectOne(`${BASE}/auth/logout`).flush(null, { status: 204, statusText: 'No Content' });
    tick();

    expect(service.getAccessToken()).toBeNull();
    expect(service.isAuthenticated()).toBeFalse();
    expect(service.currentUser()).toBeNull();
  }));

  it('logout clears session even on server error', fakeAsync(() => {
    localStorage.setItem(AT_KEY, 'at');
    localStorage.setItem(RT_KEY, 'rt');
    service['_hasToken'].set(true);

    service.logout().subscribe();
    http.expectOne(`${BASE}/auth/logout`).flush(null, { status: 500, statusText: 'Error' });
    tick();

    expect(service.getAccessToken()).toBeNull();
    expect(service.isAuthenticated()).toBeFalse();
  }));

  it('logout is no-op when already logged out', fakeAsync(() => {
    let done = false;
    service.logout().subscribe({ next: () => { done = true; } });
    tick();

    http.expectNone(`${BASE}/auth/logout`);
    expect(done).toBeTrue();
  }));

  it('tryRefresh exchanges refresh token and stores new tokens', fakeAsync(() => {
    localStorage.setItem(RT_KEY, 'old-rt');
    let result = '';
    service.tryRefresh().subscribe({ next: (at) => { result = at; } });

    http.expectOne(`${BASE}/auth/refresh`).flush({ ...mockAuth, accessToken: 'new-at', refreshToken: 'new-rt' });
    tick();

    expect(result).toBe('new-at');
    expect(service.getAccessToken()).toBe('new-at');
    expect(localStorage.getItem(RT_KEY)).toBe('new-rt');
  }));

  it('tryRefresh clears session on failure', fakeAsync(() => {
    localStorage.setItem(AT_KEY, 'at');
    localStorage.setItem(RT_KEY, 'rt');
    service['_hasToken'].set(true);

    let errored = false;
    service.tryRefresh().subscribe({ error: () => { errored = true; } });

    http.expectOne(`${BASE}/auth/refresh`).flush({ message: 'EXPIRED' }, { status: 401, statusText: 'Unauthorized' });
    tick();

    expect(errored).toBeTrue();
    expect(service.isAuthenticated()).toBeFalse();
  }));

  it('clearSession removes all tokens and user', () => {
    localStorage.setItem(AT_KEY, 'at');
    localStorage.setItem(RT_KEY, 'rt');
    service['_hasToken'].set(true);
    service['_user'].set(mockUser);

    service.clearSession();

    expect(service.getAccessToken()).toBeNull();
    expect(service.getRefreshToken()).toBeNull();
    expect(service.isAuthenticated()).toBeFalse();
    expect(service.currentUser()).toBeNull();
  });
});
