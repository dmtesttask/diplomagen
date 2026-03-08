import { Component, inject, signal, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';

import { ProjectService } from '../project.service';
import { ProjectCardComponent } from '../project-card/project-card.component';
import { CreateProjectDialogComponent } from '../create-project-dialog/create-project-dialog.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import type { ProjectListItem } from '../../../../../../shared/src';


@Component({
  selector: 'app-project-list-page',
  standalone: true,
  imports: [
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    ProjectCardComponent,
    EmptyStateComponent,
  ],
  template: `
    <div class="page-container">
      <!-- Header -->
      <div class="page-header">
        <div>
          <h1 class="page-title">My Projects</h1>
          <p class="page-subtitle">Manage your diploma generation projects</p>
        </div>
        <button
          mat-raised-button
          color="primary"
          (click)="openCreateDialog()"
          [disabled]="isLoading()"
        >
          <mat-icon>add</mat-icon>
          New Project
        </button>
      </div>

      <!-- Loading state -->
      @if (isLoading()) {
        <div class="loading-state">
          <mat-spinner diameter="48" />
          <p>Loading projects…</p>
        </div>
      }

      <!-- Empty state -->
      @else if (projects().length === 0) {
        <app-empty-state
          icon="folder_open"
          title="No projects yet"
          description="Create your first diploma project to get started. Upload a template, configure fields, and generate beautiful diplomas in minutes."
          actionLabel="Create your first project"
          (actionClick)="openCreateDialog()"
        />
      }

      <!-- Project grid -->
      @else {
        <div class="projects-grid">
          @for (project of projects(); track project.id) {
            <app-project-card
              [project]="project"
              (cardClick)="openProject(project.id)"
              (rename)="onRename(project, $event)"
              (delete)="onDelete(project)"
            />
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .page-header {
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
      letter-spacing: -0.02em;
    }

    .page-subtitle {
      margin: 0;
      color: var(--mat-sys-on-surface-variant);
      font-size: 0.9375rem;
    }

    .loading-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 80px 0;
      gap: 16px;
      color: var(--mat-sys-on-surface-variant);
    }

    .projects-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
      gap: 20px;
    }

    @media (max-width: 600px) {
      .page-header {
        flex-direction: column;
        align-items: stretch;
      }

      .projects-grid {
        grid-template-columns: 1fr;
      }
    }
  `],
})
export class ProjectListPageComponent implements OnInit {
  private readonly projectService = inject(ProjectService);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  readonly projects = signal<ProjectListItem[]>([]);
  readonly isLoading = signal(false);

  ngOnInit(): void {
    this.loadProjects();
  }

  private loadProjects(): void {
    this.isLoading.set(true);
    this.projectService.getUserProjects().subscribe({
      next: ({ projects }) => {
        this.projects.set(projects);
        this.isLoading.set(false);
      },
      error: () => {
        this.snackBar.open('Failed to load projects. Please refresh.', 'Retry', {
          duration: 6000,
          panelClass: ['snackbar-error'],
        }).onAction().subscribe(() => this.loadProjects());
        this.isLoading.set(false);
      },
    });
  }

  openCreateDialog(): void {
    const ref = this.dialog.open(CreateProjectDialogComponent, {
      width: '480px',
      disableClose: false,
    });

    ref.afterClosed().subscribe((name?: string) => {
      if (!name) return;
      this.projectService.createProject({ name }).subscribe({
        next: (project) => {
          this.router.navigate(['/projects', project.id]);
        },
        error: () => {
          this.snackBar.open('Failed to create project. Please try again.', 'Dismiss', {
            duration: 5000,
            panelClass: ['snackbar-error'],
          });
        },
      });
    });
  }

  openProject(id: string): void {
    this.router.navigate(['/projects', id]);
  }

  onRename(project: ProjectListItem, newName: string): void {
    const prev = this.projects();
    this.projects.update((list) =>
      list.map((p) => (p.id === project.id ? { ...p, name: newName } : p))
    );

    this.projectService.renameProject(project.id, newName).subscribe({
      error: () => {
        this.projects.set(prev);
        this.snackBar.open('Failed to rename project.', 'Dismiss', {
          duration: 4000,
          panelClass: ['snackbar-error'],
        });
      },
    });
  }

  onDelete(project: ProjectListItem): void {
    // Optimistic removal
    this.projects.update((list) => list.filter((p) => p.id !== project.id));

    this.projectService.deleteProject(project.id).subscribe({
      next: () => {
        this.snackBar.open(`"${project.name}" deleted.`, 'Dismiss', { duration: 3000 });
      },
      error: () => {
        this.loadProjects(); // Reload on failure
        this.snackBar.open('Failed to delete project.', 'Dismiss', {
          duration: 4000,
          panelClass: ['snackbar-error'],
        });
      },
    });
  }
}
