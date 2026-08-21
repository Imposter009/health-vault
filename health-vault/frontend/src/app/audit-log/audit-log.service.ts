import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuditLogFilter, PagedAuditLog } from './models';

@Injectable({ providedIn: 'root' })
export class AuditLogService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/audit-log`;

  getMyLog(filter: AuditLogFilter = {}): Observable<PagedAuditLog> {
    let params = new HttpParams();
    if (filter.action)  params = params.set('action', filter.action);
    if (filter.from)    params = params.set('from', filter.from);
    if (filter.to)      params = params.set('to', filter.to);
    if (filter.page != null) params = params.set('page', String(filter.page));
    if (filter.size != null) params = params.set('size', String(filter.size));
    return this.http.get<PagedAuditLog>(`${this.base}/me`, { params });
  }
}
