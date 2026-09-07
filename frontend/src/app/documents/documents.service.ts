import { Injectable } from '@angular/core';
import {
  HttpClient, HttpEventType, HttpRequest, HttpResponse
} from '@angular/common/http';
import { Observable, interval, map, filter, switchMap, takeWhile, take } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  DocumentCategory, DocumentResponse, DocumentStatusResponse, DownloadUrlResponse, PageResponse
} from './models';

export interface UploadProgress {
  type:       'progress' | 'complete';
  percent?:   number;
  document?:  DocumentResponse;
}

@Injectable({ providedIn: 'root' })
export class DocumentsService {

  private readonly base = `${environment.apiBaseUrl}/documents`;

  constructor(private http: HttpClient) {}

  upload(
    file: File,
    category: DocumentCategory
  ): Observable<UploadProgress> {
    const form = new FormData();
    form.append('file', file, file.name);

    const req = new HttpRequest('POST', this.base, form, {
      params:       { category } as any,
      reportProgress: true,
    });

    return this.http.request<DocumentResponse>(req).pipe(
      filter(event =>
        event.type === HttpEventType.UploadProgress ||
        event instanceof HttpResponse
      ),
      map(event => {
        if (event.type === HttpEventType.UploadProgress) {
          const total   = (event as any).total ?? 1;
          const loaded  = (event as any).loaded ?? 0;
          return { type: 'progress' as const, percent: Math.round(100 * loaded / total) };
        }
        return {
          type:     'complete' as const,
          document: (event as HttpResponse<DocumentResponse>).body!,
        };
      })
    );
  }

  list(params: {
    category?: DocumentCategory;
    status?:   string;
    page?:     number;
    size?:     number;
  } = {}): Observable<PageResponse<DocumentResponse>> {
    const query: Record<string, string> = {};
    if (params.category) query['category'] = params.category;
    if (params.status)   query['status']   = params.status;
    if (params.page !== undefined) query['page'] = String(params.page);
    if (params.size !== undefined) query['size'] = String(params.size);
    return this.http.get<PageResponse<DocumentResponse>>(this.base, { params: query });
  }

  getById(id: string): Observable<DocumentResponse> {
    return this.http.get<DocumentResponse>(`${this.base}/${id}`);
  }

  getDownloadUrl(id: string): Observable<DownloadUrlResponse> {
    return this.http.get<DownloadUrlResponse>(`${this.base}/${id}/download-url`);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }

  getStatus(id: string): Observable<DocumentStatusResponse> {
    return this.http.get<DocumentStatusResponse>(`${this.base}/${id}/status`);
  }

  /**
   * Polls GET /{id}/status every ~2.5 s until the document reaches a terminal state
   * (PROCESSED or FAILED) or maxAttempts is reached.
   *
   * @param id          document UUID
   * @param maxAttempts cap at 40 polls (~100 s) to avoid infinite polls
   */
  pollStatus(
    id: string,
    maxAttempts = 40,
  ): Observable<DocumentStatusResponse> {
    const TERMINAL: DocumentStatusResponse['status'][] = ['PROCESSED', 'FAILED'];
    return interval(2500).pipe(
      take(maxAttempts),
      switchMap(() => this.getStatus(id)),
      takeWhile(s => !TERMINAL.includes(s.status), true),  // emit terminal event then complete
    );
  }
}
