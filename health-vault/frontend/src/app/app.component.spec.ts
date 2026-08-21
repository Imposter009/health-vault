import { TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { AppComponent } from './app.component';

describe('AppComponent', () => {
  beforeEach(() => TestBed.configureTestingModule({
    imports: [AppComponent, RouterTestingModule]
  }));

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should render router-outlet', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('router-outlet')).toBeTruthy();
  });

  it('should not show offline banner when online', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const banner = fixture.nativeElement.querySelector('.offline-banner');
    // navigator.onLine is true in jsdom — banner should be absent
    expect(banner).toBeNull();
  });
});
