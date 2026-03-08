import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { from, switchMap } from 'rxjs';
import { AuthService } from '../auth/auth.service';

/**
 * Attaches the Firebase ID token as a Bearer token to all outgoing HTTP requests.
 * Skips requests that go to external URLs (Google Fonts, etc.) or that already
 * have an Authorization header.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);

  // Skip if already has Authorization or if it's an external URL
  if (req.headers.has('Authorization') || req.url.startsWith('https://storage.googleapis.com')) {
    return next(req);
  }

  return from(authService.getIdToken()).pipe(
    switchMap((token) => {
      if (!token) return next(req);

      const authReq = req.clone({
        headers: req.headers.set('Authorization', `Bearer ${token}`),
      });
      return next(authReq);
    }),
  );
};
