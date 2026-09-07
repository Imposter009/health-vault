import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  DashboardGranularity,
  DashboardResponse,
  MetricRequest,
  MetricResponse,
  MetricType,
  MetricUpdateRequest,
  PageResponse,
} from './models';

@Injectable({ providedIn: 'root' })
export class MetricsService {
  private http = inject(HttpClient);
  private base = `${environment.apiBaseUrl}/metrics`;

  create(req: MetricRequest): Observable<MetricResponse> {
    return this.http.post<MetricResponse>(this.base, req);
  }

  list(options: {
    metricType?: MetricType;
    from?: string;
    to?: string;
    page?: number;
    size?: number;
  } = {}): Observable<PageResponse<MetricResponse>> {
    let params = new HttpParams();
    if (options.metricType) params = params.set('metricType', options.metricType);
    if (options.from)       params = params.set('from', options.from);
    if (options.to)         params = params.set('to', options.to);
    if (options.page != null) params = params.set('page', String(options.page));
    if (options.size != null) params = params.set('size', String(options.size));
    return this.http.get<PageResponse<MetricResponse>>(this.base, { params });
  }

  getById(id: string): Observable<MetricResponse> {
    return this.http.get<MetricResponse>(`${this.base}/${id}`);
  }

  update(id: string, req: MetricUpdateRequest): Observable<MetricResponse> {
    return this.http.put<MetricResponse>(`${this.base}/${id}`, req);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }

  dashboard(options: {
    metricType: MetricType;
    from: string;
    to: string;
    granularity?: DashboardGranularity;
  }): Observable<DashboardResponse> {
    let params = new HttpParams()
      .set('metricType', options.metricType)
      .set('from', options.from)
      .set('to', options.to)
      .set('granularity', options.granularity ?? 'DAY');
    return this.http.get<DashboardResponse>(`${this.base}/dashboard`, { params });
  }
}
