import { HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

/**
 * Logs the X-Request-ID response header on error responses (dev only).
 * The ID is the Micrometer trace ID shared by both gateway and Core API,
 * so you can use it directly in Zipkin or grep the structured logs.
 *
 * Only active when environment.production === false to avoid any console
 * output reaching the browser in production builds.
 */
export const requestIdInterceptor: HttpInterceptorFn = (req, next) => {
  if (environment.production) {
    return next(req);
  }

  return next(req).pipe(
    tap({
      error: (err) => {
        const requestId =
          err?.headers?.get?.('X-Request-ID') ??
          (err?.error instanceof HttpResponse ? err.error.headers?.get?.('X-Request-ID') : null);

        if (requestId) {
          console.warn(
            `[Health Vault] Request failed — X-Request-ID: ${requestId}`,
            `\n  URL   : ${req.url}`,
            `\n  Status: ${err?.status ?? 'unknown'}`,
            `\n  Trace : http://localhost:9411/zipkin/traces/${requestId}`
          );
        }
      },
    })
  );
};
