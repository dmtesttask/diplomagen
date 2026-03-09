import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

/**
 * Base HTTP service. All feature services should inject this (or HttpClient)
 * rather than calling the API URL directly. This provides a single place to
 * change the base URL and add request/response transforms.
 */
@Injectable({
  providedIn: 'root',
})
export class ApiService {
  private readonly http = inject(HttpClient);
  readonly baseUrl = environment.apiBaseUrl;

  get<T>(path: string) {
    return this.http.get<T>(`${this.baseUrl}${path}`);
  }

  post<T>(path: string, body: unknown) {
    return this.http.post<T>(`${this.baseUrl}${path}`, body);
  }

  patch<T>(path: string, body: unknown) {
    return this.http.patch<T>(`${this.baseUrl}${path}`, body);
  }

  delete<T>(path: string) {
    return this.http.delete<T>(`${this.baseUrl}${path}`);
  }

  /** POST with FormData (no Content-Type header — browser sets boundary automatically) */
  postFormData<T>(path: string, body: FormData) {
    return this.http.post<T>(`${this.baseUrl}${path}`, body);
  }

  /** Direct PUT to a URL (used for GCS signed upload URLs) */
  putDirect(url: string, body: Blob | File, contentType: string) {
    return this.http.put(url, body, {
      headers: {
        'Content-Type': contentType,
      },
      reportProgress: true,
      observe: 'events',
    });
  }
}
