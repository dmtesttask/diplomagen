import { Injectable, inject } from '@angular/core';
import { Firestore, doc, docData } from '@angular/fire/firestore';
import { Auth } from '@angular/fire/auth';
import { Observable, switchMap, of } from 'rxjs';
import { user } from '@angular/fire/auth';
import { ApiService } from '../../core/api/api.service';
import type { GenerationJob } from '../../../../../shared/src';

export interface StartGenerationResponse {
  jobId: string;
  totalCount: number;
}

@Injectable({
  providedIn: 'root',
})
export class GenerationService {
  private readonly api = inject(ApiService);
  private readonly firestore = inject(Firestore);
  private readonly auth = inject(Auth);

  /**
   * POST /projects/:id/generate
   * Creates a GenerationJob and starts async generation on the backend.
   * Returns the job ID and total diploma count immediately.
   */
  startGeneration(projectId: string): Observable<StartGenerationResponse> {
    return this.api.post<StartGenerationResponse>(`/projects/${projectId}/generate`, {});
  }

  /**
   * GET /projects/:id/jobs
   * Returns the list of recent generation jobs for a project (latest first, max 10).
   */
  listJobs(projectId: string): Observable<{ jobs: GenerationJob[] }> {
    return this.api.get<{ jobs: GenerationJob[] }>(`/projects/${projectId}/jobs`);
  }

  /**
   * Subscribes to the GenerationJob document in Firestore for real-time updates.
   * Emits every time the job's status, processedCount, or other fields change.
   */
  watchJob(projectId: string, jobId: string): Observable<GenerationJob | undefined> {
    return user(this.auth).pipe(
      switchMap((currentUser) => {
        if (!currentUser) return of(undefined);
        const path = `users/${currentUser.uid}/projects/${projectId}/jobs/${jobId}`;
        return docData<GenerationJob>(
          doc(this.firestore, path) as Parameters<typeof docData<GenerationJob>>[0],
          { idField: 'id' },
        );
      }),
    );
  }

  /**
   * GET /projects/:id/jobs/:jobId/download
   * Streams the ZIP binary through the authenticated API and returns it as a Blob.
   * Use URL.createObjectURL() on the result to trigger a browser download.
   */
  downloadZip(projectId: string, jobId: string): Observable<Blob> {
    return this.api.getBlob(`/projects/${projectId}/jobs/${jobId}/download`);
  }
}
