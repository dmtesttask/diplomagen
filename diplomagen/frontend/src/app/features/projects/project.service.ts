import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { HttpEventType } from '@angular/common/http';
import { ApiService } from '../../core/api/api.service';
import type { Project, ProjectListItem, TemplateMetadata } from '../../../../../shared/src';

export interface CreateProjectDto {
  name: string;
}

export interface UploadUrlResponse {
  uploadUrl: string | null;
  gcsPath: string;
  useDirectUpload: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class ProjectService {
  private readonly api = inject(ApiService);

  /** Fetch all projects for the currently authenticated user */
  getUserProjects(): Observable<{ projects: ProjectListItem[] }> {
    return this.api.get<{ projects: ProjectListItem[] }>('/projects');
  }

  /** Fetch a single project by ID */
  getProject(projectId: string): Observable<Project> {
    return this.api.get<Project>(`/projects/${projectId}`);
  }

  /** Create a new project */
  createProject(dto: CreateProjectDto): Observable<Project> {
    return this.api.post<Project>('/projects', dto);
  }

  /** Rename an existing project */
  renameProject(projectId: string, name: string): Observable<Project> {
    return this.api.patch<Project>(`/projects/${projectId}`, { name });
  }

  /** Delete a project and all its associated files */
  deleteProject(projectId: string): Observable<void> {
    return this.api.delete<void>(`/projects/${projectId}`);
  }

  /** Step 1: Get a signed URL for direct file upload to GCS */
  getUploadUrl(projectId: string, mimeType: string, extension: string): Observable<UploadUrlResponse> {
    return this.api.post<UploadUrlResponse>(`/projects/${projectId}/upload-url`, { mimeType, extension });
  }

  /** Step 2: Upload file directly to GCS using signed URL (with progress events) */
  uploadFileDirect(uploadUrl: string, file: File) {
    return this.api.putDirect(uploadUrl, file, file.type);
  }

  /** Step 2 (emulator): Upload file via multipart to the Cloud Function */
  uploadFileMultipart(projectId: string, file: File): Observable<{ gcsPath: string; mimeType: string }> {
    const ext = file.name.split('.').pop() ?? 'bin';
    const formData = new FormData();
    formData.append('file', file);
    return this.api.postFormData<{ gcsPath: string; mimeType: string }>(
      `/projects/${projectId}/upload?ext=${ext}`,
      formData,
    );
  }

  /** Step 3: Confirm upload and let backend resolve dimensions */
  confirmTemplate(projectId: string, gcsPath: string, mimeType: string): Observable<TemplateMetadata> {
    return this.api.post<TemplateMetadata>(`/projects/${projectId}/template`, { gcsPath, mimeType });
  }
}

