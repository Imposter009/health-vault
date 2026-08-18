import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { authInterceptor } from './auth.interceptor';
import { AuthService } from './auth.service';
import { AuthResponse, UserProfile } from './models';
import { environment } from '../../environments/environment';

const AT_KEY = 'hv_at';
const BASE = environment.apiBaseUrl;
const mockUser: UserProfile = { id: '1', email: 'a@b.com', fullName: 'Test' };
const mockAuth: AuthResponse = { accessToken: 'new-at', refreshToken: 'new-rt', expiresIn: 900 };

describe('authInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let authService: AuthService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting()
      ]
    });
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
    authService = TestBed.inject(AuthService);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('adds Authorization header when token is present', () => {
    localStorage.setItem(AT_KEY, 'my-token');
    http.get(`${BASE}/users/me`).subscribe();
    const req = httpMock.expectOne(`${BASE}/users/me`);
    expect(req.request.headers.get('Authorization')).toBe('Bearer my-token');
    req.flush(mockUser);
  });

  it('does NOT add Authorization header when no token', () => {
    http.get(`${BASE}/users/me`).subscribe();
    const req = httpMock.expectOne(`${BASE}/users/me`);
    expect(req.request.headers.get('Authorization')).toBeNull();
    req.flush(mockUser);
  });

  it('does NOT add Authorization header for /auth/login', () => {
    localStorage.setItem(AT_KEY, 'my-token');
    http.post(`${BASE}/auth/login`, {}).subscribe();
    const req = httpMock.expectOne(`${BASE}/auth/login`);
    expect(req.request.headers.get('Authorization')).toBeNull();
    req.flush(mockAuth);
  });

  it('does NOT add Authorization header for /auth/register', () => {
    localStorage.setItem(AT_KEY, 'my-token');
    http.post(`${BASE}/auth/register`, {}).subscribe();
    const req = httpMock.expectOne(`${BASE}/auth/register`);
    expect(req.request.headers.get('Authorization')).toBeNull();
    req.flush({}, { status: 201, statusText: 'Created' });
  });

  it('does NOT add Authorization header for /auth/refresh', () => {
    localStorage.setItem(AT_KEY, 'my-token');
    http.post(`${BASE}/auth/refresh`, {}).subscribe();
    const req = httpMock.expectOne(`${BASE}/auth/refresh`);
    expect(req.request.headers.get('Authorization')).toBeNull();
    req.flush(mockAuth);
  });

  it('retries with new token after 401 and successful refresh', fakeAsync(() => {
    localStorage.setItem(AT_KEY, 'old-at');
    localStorage.setItem('hv_rt', 'old-rt');

    let result: unknown;
    http.get(`${BASE}/users/me`).subscribe({ next: (v) => { result = v; } });

    // First attempt → 401
    const first = httpMock.expectOne(`${BASE}/users/me`);
    first.flush({ message: 'expired' }, { status: 401, statusText: 'Unauthorized' });

    // Interceptor calls refresh
    const refresh = httpMock.expectOne(`${BASE}/auth/refresh`);
    expect(refresh.request.headers.get('Authorization')).toBeNull(); // no token on refresh
    refresh.flush(mockAuth);

    // Retry with new token
    const retry = httpMock.expectOne(`${BASE}/users/me`);
    expect(retry.request.headers.get('Authorization')).toBe('Bearer new-at');
    retry.flush(mockUser);

    tick();
    expect(result).toEqual(mockUser);
  }));

  it('clears session and does NOT retry on double 401 (refresh also fails)', fakeAsync(() => {
    localStorage.setItem(AT_KEY, 'old-at');
    localStorage.setItem('hv_rt', 'old-rt');
    authService['_hasToken'].set(true);

    const router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.returnValue(Promise.resolve(true));

    let errored = false;
    http.get(`${BASE}/users/me`).subscribe({ error: () => { errored = true; } });

    httpMock.expectOne(`${BASE}/users/me`).flush({}, { status: 401, statusText: 'Unauthorized' });
    httpMock.expectOne(`${BASE}/auth/refresh`).flush({}, { status: 401, statusText: 'Unauthorized' });
    tick();

    expect(errored).toBeTrue();
    expect(authService.isAuthenticated()).toBeFalse();
    expect(router.navigate).toHaveBeenCalledWith(['/login']);
  }));
});
