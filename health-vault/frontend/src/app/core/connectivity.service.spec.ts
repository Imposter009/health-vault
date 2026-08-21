import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { ConnectivityService } from './connectivity.service';

describe('ConnectivityService', () => {
  let svc: ConnectivityService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [ConnectivityService] });
    svc = TestBed.inject(ConnectivityService);
  });

  afterEach(() => svc.ngOnDestroy());

  it('initialises isOnline to navigator.onLine', () => {
    // jsdom sets navigator.onLine = true by default
    expect(svc.isOnline()).toBeTrue();
  });

  it('sets isOnline to false when the offline event fires', () => {
    window.dispatchEvent(new Event('offline'));
    expect(svc.isOnline()).toBeFalse();
  });

  it('sets isOnline to true when the online event fires', () => {
    window.dispatchEvent(new Event('offline'));
    window.dispatchEvent(new Event('online'));
    expect(svc.isOnline()).toBeTrue();
  });

  it('emits on reconnected$ only when coming back online after being offline', () => {
    let count = 0;
    svc.reconnected$.subscribe(() => count++);

    // Going online without having been offline first — should NOT emit
    window.dispatchEvent(new Event('online'));
    expect(count).toBe(0);

    // Go offline then online — should emit once
    window.dispatchEvent(new Event('offline'));
    window.dispatchEvent(new Event('online'));
    expect(count).toBe(1);

    // Going offline again without reconnecting — no emission
    window.dispatchEvent(new Event('offline'));
    expect(count).toBe(1);

    // Reconnect again — emits a second time
    window.dispatchEvent(new Event('online'));
    expect(count).toBe(2);
  });

  it('completes reconnected$ on ngOnDestroy', () => {
    let completed = false;
    svc.reconnected$.subscribe({ complete: () => { completed = true; } });
    svc.ngOnDestroy();
    expect(completed).toBeTrue();
  });
});
