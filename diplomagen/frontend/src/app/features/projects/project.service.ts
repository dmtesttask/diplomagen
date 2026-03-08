import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../core/api/api.service';
import type { Project, ProjectListItem } from '../../../../../shared/src';

export interface CreateProjectDto {
  name: string;
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
}
