import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  MedicationRequest, MedicationResponse, MedicationStatus, MedicationUpdateRequest, PageResponse
} from './models';

@Injectable({ providedIn: 'root' })
export class MedicationsService {

  private readonly base = `${environment.apiBaseUrl}/medications`;

  constructor(private http: HttpClient) {}

  list(params: {
    status?: MedicationStatus;
    page?:   number;
    size?:   number;
  } = {}): Observable<PageResponse<MedicationResponse>> {
    const query: Record<string, string> = {};
    if (params.status) query['status'] = params.status;
    if (params.page !== undefined) query['page'] = String(params.page);
    if (params.size !== undefined) query['size'] = String(params.size);
    return this.http.get<PageResponse<MedicationResponse>>(this.base, { params: query });
  }

  getById(id: string): Observable<MedicationResponse> {
    return this.http.get<MedicationResponse>(`${this.base}/${id}`);
  }

  create(req: MedicationRequest): Observable<MedicationResponse> {
    return this.http.post<MedicationResponse>(this.base, req);
  }

  update(id: string, req: MedicationUpdateRequest): Observable<MedicationResponse> {
    return this.http.put<MedicationResponse>(`${this.base}/${id}`, req);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }
}
