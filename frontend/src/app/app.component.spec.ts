import { TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { signal } from '@angular/core';
import { AppComponent } from './app.component';
import { AuthService } from './auth/auth.service';
import { ConnectivityService } from './core/connectivity.service';

describe('AppComponent', () => {
  let authSpy: jasmine.SpyObj<AuthService>;

  beforeEach(() => {
    authSpy = jasmine.createSpyObj('AuthService', ['logout'], {
      isAuthenticated: signal(false),
    });

    const connectivityStub = { isOnline: signal(true) };

    TestBed.configureTestingModule({
      imports: [AppComponent, RouterTestingModule],
      providers: [
        { provide: AuthService,       useValue: authSpy },
        { provide: ConnectivityService, useValue: connectivityStub },
      ],
    });
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should render router-outlet', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('router-outlet')).toBeTruthy();
  });

  it('should not show offline banner when online', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.offline-banner')).toBeNull();
  });
});
