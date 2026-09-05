import { TestBed } from '@angular/core/testing';
import { Router, UrlTree } from '@angular/router';
import { Observable } from 'rxjs';
import { authGuard } from './auth.guard';
import { AuthService } from './auth.service';

describe('authGuard', () => {
  let authService: jasmine.SpyObj<AuthService>;
  let router: jasmine.SpyObj<Router>;

  beforeEach(() => {
    authService = jasmine.createSpyObj('AuthService', [], {
      isAuthenticated: jasmine.createSpy('isAuthenticated')
    });
    router = jasmine.createSpyObj('Router', ['createUrlTree']);

    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: Router,      useValue: router },
      ]
    });
  });

  function runGuard(): boolean | UrlTree | Promise<boolean | UrlTree> | Observable<boolean | UrlTree> {
    return TestBed.runInInjectionContext(() => authGuard({} as any, {} as any));
  }

  it('returns true when user is authenticated', () => {
    (authService.isAuthenticated as jasmine.Spy).and.returnValue(true);

    const result = runGuard();

    expect(result).toBeTrue();
    expect(router.createUrlTree).not.toHaveBeenCalled();
  });

  it('redirects to /login when user is not authenticated', () => {
    (authService.isAuthenticated as jasmine.Spy).and.returnValue(false);
    const loginTree = {} as UrlTree;
    router.createUrlTree.and.returnValue(loginTree);

    const result = runGuard();

    expect(result).toBe(loginTree);
    expect(router.createUrlTree).toHaveBeenCalledWith(['/login']);
  });
});
