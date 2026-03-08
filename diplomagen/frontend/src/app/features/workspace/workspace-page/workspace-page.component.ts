import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ProjectService } from '../../projects/project.service';
import type { Project } from '../../../../../../shared/src';

@Component({
  selector: 'app-workspace-page',
  standalone: true,
  imports: [MatButtonModule, MatIconModule, MatProgressSpinnerModule],
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
          >
            <mat-icon>design_services</mat-icon>
            Open Editor
          </button>
        </div>

        <div class="coming-soon">
          <mat-icon>construction</mat-icon>
          <p>Template upload, Excel upload and field mapping coming in the next implementation phase.</p>
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

    .coming-soon {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 16px;
      padding: 60px;
      text-align: center;
      background: var(--mat-sys-surface-container);
      border-radius: 16px;
      border: 1px dashed var(--mat-sys-outline-variant);

      mat-icon {
        font-size: 48px;
        width: 48px;
        height: 48px;
        color: var(--mat-sys-on-surface-variant);
        opacity: 0.4;
      }

      p {
        margin: 0;
        color: var(--mat-sys-on-surface-variant);
        max-width: 480px;
      }
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

  openEditor(): void {
    const id = this.project()?.id;
    if (id) this.router.navigate(['/projects', id, 'editor']);
  }
}
