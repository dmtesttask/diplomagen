import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ProjectService } from '../../projects/project.service';
import { TemplateUploadComponent } from '../template-upload/template-upload.component';
import type { Project, TemplateMetadata } from '../../../../../../shared/src';

@Component({
  selector: 'app-workspace-page',
  standalone: true,
  imports: [MatButtonModule, MatIconModule, MatProgressSpinnerModule, TemplateUploadComponent],
  template: `
    <div class="page-container">
      @if (isLoading()) {
        <div class="loading-state">
          <mat-spinner diameter="48" />
        </div>
      } @else if (project()) {
        <div class="workspace-header">
          <div>
            <h1 class="page-title">{{ project()!.name }}</h1>
            <p class="page-subtitle">Workspace — configure your diploma project</p>
          </div>
          <button
            mat-raised-button
            color="primary"
            (click)="openEditor()"
            [disabled]="!project()!.template"
            aria-label="Open canvas editor"
          >
            <mat-icon>design_services</mat-icon>
            Open Editor
          </button>
        </div>

        <div class="workspace-content">
          <app-template-upload
            [projectId]="project()!.id"
            [template]="getTemplate"
            (templateUploaded)="onTemplateUploaded($event)"
          />
        </div>
      }
    </div>
  `,
  styles: [`
    .loading-state {
      display: flex;
      justify-content: center;
      padding: 80px;
    }

    .workspace-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      margin-bottom: 32px;
      gap: 16px;
    }

    .page-title {
      margin: 0 0 4px;
      font-size: 1.75rem;
      font-weight: 700;
    }

    .page-subtitle {
      margin: 0;
      color: var(--mat-sys-on-surface-variant);
    }

    .workspace-content {
      display: flex;
      flex-direction: column;
      gap: 24px;
    }
  `],
})
export class WorkspacePageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly projectService = inject(ProjectService);
  private readonly snackBar = inject(MatSnackBar);

  readonly project = signal<Project | null>(null);
  readonly isLoading = signal(true);

  /** Passed as a bound function to TemplateUploadComponent */
  readonly getTemplate = () => this.project()?.template ?? null;

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.router.navigate(['/projects']);
      return;
    }

    this.projectService.getProject(id).subscribe({
      next: (p) => {
        this.project.set(p);
        this.isLoading.set(false);
      },
      error: () => {
        this.snackBar.open('Project not found.', 'Dismiss', { duration: 4000 });
        this.router.navigate(['/projects']);
      },
    });
  }

  onTemplateUploaded(template: TemplateMetadata | null): void {
    const current = this.project();
    if (current) {
      this.project.set({ ...current, template: template ?? null });
    }
  }

  openEditor(): void {
    const id = this.project()?.id;
    if (id) this.router.navigate(['/projects', id, 'editor']);
  }
}

