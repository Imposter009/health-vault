import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map, shareReplay } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface AiStatus {
  enabled: boolean;
}

export interface SummarizeResponse {
  documentId: string;
  summary: string;
  fromCache: boolean;
}

export interface ChatSource {
  documentId: string;
  chunkIndex: number;
}

export interface ChatResponse {
  conversationId: string;
  answer: string;
  sources: ChatSource[];
}

export interface NarrationResponse {
  hasTrend: boolean;
  narration: string;
  direction: string | null;
  percentChange: number;
  fromCache: boolean;
}

@Injectable({ providedIn: 'root' })
export class AiService {

  private readonly base = `${environment.apiBaseUrl}/ai`;

  /** Cached status observable — only one HTTP call per app session. */
  private readonly status$: Observable<AiStatus>;

  constructor(private http: HttpClient) {
    this.status$ = this.http.get<AiStatus>(`${this.base}/status`).pipe(
      catchError(() => of({ enabled: false } as AiStatus)),
      shareReplay(1)
    );
  }

  /** Whether AI features are enabled on the server. */
  getStatus(): Observable<AiStatus> {
    return this.status$;
  }

  /** Summarize a document. Only callable when AI is enabled. */
  summarize(documentId: string): Observable<SummarizeResponse> {
    return this.http.get<SummarizeResponse>(`${this.base}/documents/${documentId}/summary`);
  }

  /** Send a chat message. Returns the model's answer with source citations. */
  chat(question: string, conversationId?: string): Observable<ChatResponse> {
    return this.http.post<ChatResponse>(`${this.base}/chat`, { question, conversationId });
  }

  /** Get trend narration for a metric type (WEIGHT, HEART_RATE, etc.). */
  getTrendNarration(metricType: string): Observable<NarrationResponse> {
    return this.http.get<NarrationResponse>(`${this.base}/metrics/trend/${metricType}`);
  }
}
