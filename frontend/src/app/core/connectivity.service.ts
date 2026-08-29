import { Injectable, signal, OnDestroy } from '@angular/core';
import { Subject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ConnectivityService implements OnDestroy {

  /** True when the browser believes it has network access. */
  readonly isOnline = signal(typeof navigator !== 'undefined' ? navigator.onLine : true);

  /**
   * Emits once each time connectivity is restored after having been lost.
   * Components that want to auto-refresh on reconnect subscribe to this.
   */
  readonly reconnected$ = new Subject<void>();

  private wasPreviouslyOffline = false;

  private readonly onlineHandler  = () => this.handleOnline();
  private readonly offlineHandler = () => this.handleOffline();

  constructor() {
    window.addEventListener('online',  this.onlineHandler);
    window.addEventListener('offline', this.offlineHandler);
  }

  ngOnDestroy(): void {
    window.removeEventListener('online',  this.onlineHandler);
    window.removeEventListener('offline', this.offlineHandler);
    this.reconnected$.complete();
  }

  private handleOnline(): void {
    this.isOnline.set(true);
    if (this.wasPreviouslyOffline) {
      this.reconnected$.next();
    }
    this.wasPreviouslyOffline = false;
  }

  private handleOffline(): void {
    this.isOnline.set(false);
    this.wasPreviouslyOffline = true;
  }
}
