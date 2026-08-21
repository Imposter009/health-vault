import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AuditLogComponent } from './audit-log.component';
import { AuditLogService } from './audit-log.service';
import { RouterTestingModule } from '@angular/router/testing';
import { of, throwError, Subject } from 'rxjs';
import { PagedAuditLog, AuditLogEntry } from './models';
import { By } from '@angular/platform-browser';

const makePage = (entries: Partial<AuditLogEntry>[] = []): PagedAuditLog => ({
  content: entries.map((e, i) => ({
    id: `id-${i}`,
    action: e.action ?? 'LOGIN_SUCCESS',
    resourceType: e.resourceType ?? null,
    resourceId: null,
    ipAddress: e.ipAddress ?? '127.0.0.1',
    metadata: null,
    createdAt: e.createdAt ?? new Date().toISOString(),
  })),
  totalElements: entries.length,
  totalPages: 1,
  number: 0,
  size: 20,
});

describe('AuditLogComponent', () => {
  let fixture: ComponentFixture<AuditLogComponent>;
  let svc: jasmine.SpyObj<AuditLogService>;

  beforeEach(async () => {
    svc = jasmine.createSpyObj('AuditLogService', ['getMyLog']);

    await TestBed.configureTestingModule({
      imports: [AuditLogComponent, RouterTestingModule],
      providers: [{ provide: AuditLogService, useValue: svc }],
    }).compileComponents();

    fixture = TestBed.createComponent(AuditLogComponent);
  });

  it('renders a list of entries from the service', () => {
    svc.getMyLog.and.returnValue(of(makePage([
      { action: 'LOGIN_SUCCESS', createdAt: '2024-06-01T10:00:00Z' },
      { action: 'DOCUMENT_UPLOADED', createdAt: '2024-06-01T11:00:00Z' },
    ])));

    fixture.detectChanges();

    const items = fixture.debugElement.queryAll(By.css('.entry'));
    expect(items.length).toBe(2);
  });

  it('shows loading indicator while request is in flight', () => {
    // Never resolves
    svc.getMyLog.and.returnValue(new Subject<PagedAuditLog>().asObservable());
    fixture.detectChanges();
    const msg = fixture.nativeElement.querySelector('.state-message');
    expect(msg?.textContent).toContain('Loading');
  });

  it('shows error message when service fails', () => {
    svc.getMyLog.and.returnValue(throwError(() => new Error('network')));
    fixture.detectChanges();
    const msg = fixture.nativeElement.querySelector('.state-message.error');
    expect(msg).toBeTruthy();
    expect(msg?.textContent).toContain('Failed');
  });

  it('shows "No activity found" when result is empty', () => {
    svc.getMyLog.and.returnValue(of(makePage([])));
    fixture.detectChanges();
    const msg = fixture.nativeElement.querySelector('.state-message');
    expect(msg?.textContent).toContain('No activity found');
  });

  it('calls service again with filter when action changes', () => {
    svc.getMyLog.and.returnValue(of(makePage([])));
    fixture.detectChanges();

    fixture.componentInstance.filter.action = 'LOGOUT';
    fixture.componentInstance.onFilterChange();
    fixture.detectChanges();

    expect(svc.getMyLog).toHaveBeenCalledTimes(2);
    const lastCall = svc.getMyLog.calls.mostRecent()?.args[0];
    expect(lastCall?.action).toBe('LOGOUT');
  });

  it('clears filters and reloads when clearFilters is called', () => {
    svc.getMyLog.and.returnValue(of(makePage([])));
    fixture.detectChanges();

    fixture.componentInstance.filter.action = 'LOGOUT';
    fixture.componentInstance.clearFilters();

    const lastCall = svc.getMyLog.calls.mostRecent()?.args[0];
    expect(lastCall?.action).toBeUndefined();
  });
});
