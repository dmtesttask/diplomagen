import { Component, Input, Output, EventEmitter, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatDialog } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatChipsModule } from '@angular/material/chips';

import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import type { ProjectListItem } from '../../../../../../shared/src';

@Component({
  selector: 'app-project-card',
  standalone: true,
  imports: [
    DatePipe,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatTooltipModule,
    MatChipsModule,
  ],
  template: `
    <mat-card class="project-card" (click)="cardClick.emit()" tabindex="0" (keydown.enter)="cardClick.emit()">
      <!-- Template thumbnail / placeholder -->
      <div class="card-preview">
        @if (project.template) {
          <mat-icon class="preview-icon">picture_as_pdf</mat-icon>
          <span class="preview-label">Template uploaded</span>
        } @else {
          <mat-icon class="preview-icon empty">upload_file</mat-icon>
          <span class="preview-label empty">No template yet</span>
        }
      </div>

      <mat-card-content class="card-content">
        <div class="card-header">
          <h2 class="card-title" [matTooltip]="project.name">{{ project.name }}</h2>

          <!-- Actions menu (stops click propagation) -->
          <button
            mat-icon-button
            [matMenuTriggerFor]="cardMenu"
            (click)="$event.stopPropagation()"
            aria-label="Project actions"
          >
            <mat-icon>more_vert</mat-icon>
          </button>

          <mat-menu #cardMenu="matMenu">
            <button mat-menu-item (click)="openRenameDialog($event)">
              <mat-icon>edit</mat-icon>
              <span>Rename</span>
            </button>
            <button mat-menu-item class="delete-item" (click)="openDeleteDialog($event)">
              <mat-icon>delete</mat-icon>
              <span>Delete</span>
            </button>
          </mat-menu>
        </div>

        <div class="card-meta">
          @if (project.template) {
            <mat-chip class="status-chip ready">
              <mat-icon matChipAvatar>check_circle</mat-icon>
              Template ready
            </mat-chip>
          } @else {
            <mat-chip class="status-chip draft">
              <mat-icon matChipAvatar>pending</mat-icon>
              Draft
            </mat-chip>
          }
        </div>

        <div class="card-dates">
          <span class="date-item">
            <mat-icon class="date-icon">calendar_today</mat-icon>
            Created {{ project.createdAt | date:'mediumDate' }}
          </span>
          <span class="date-item">
            <mat-icon class="date-icon">update</mat-icon>
            Updated {{ project.updatedAt | date:'mediumDate' }}
          </span>
        </div>
      </mat-card-content>
    </mat-card>
  `,
  styles: [`
    .project-card {
      cursor: pointer;
      transition: transform 0.15s ease, box-shadow 0.15s ease;
      border: 1px solid var(--mat-sys-outline-variant);
      border-radius: 16px !important;
      overflow: hidden;

      &:hover {
        transform: translateY(-2px);
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12) !important;
      }

      &:focus-visible {
        outline: 2px solid var(--mat-sys-primary);
        outline-offset: 2px;
      }
    }

    .card-preview {
      height: 120px;
      background: var(--mat-sys-surface-container-high);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 6px;
      border-bottom: 1px solid var(--mat-sys-outline-variant);
    }

    .preview-icon {
      font-size: 40px;
      width: 40px;
      height: 40px;
      color: var(--mat-sys-primary);

      &.empty {
        color: var(--mat-sys-on-surface-variant);
        opacity: 0.4;
      }
    }

    .preview-label {
      font-size: 0.75rem;
      color: var(--mat-sys-on-surface-variant);

      &.empty {
        opacity: 0.6;
      }
    }

    .card-content {
      padding: 16px !important;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .card-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 8px;
    }

    .card-title {
      margin: 0;
      font-size: 1rem;
      font-weight: 600;
      line-height: 1.3;
      overflow: hidden;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      flex: 1;
    }

    .card-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .status-chip {
      font-size: 0.75rem;

      &.ready {
        background: var(--mat-sys-tertiary-container);
        color: var(--mat-sys-on-tertiary-container);
      }

      &.draft {
        background: var(--mat-sys-surface-variant);
        color: var(--mat-sys-on-surface-variant);
      }
    }

    .card-dates {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .date-item {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 0.75rem;
      color: var(--mat-sys-on-surface-variant);
    }

    .date-icon {
      font-size: 14px;
      width: 14px;
      height: 14px;
    }

    .delete-item {
      color: var(--mat-sys-error) !important;
    }
  `],
})
export class ProjectCardComponent {
  private readonly dialog = inject(MatDialog);

  @Input({ required: true }) project!: ProjectListItem;
  @Output() cardClick = new EventEmitter<void>();
  @Output() rename = new EventEmitter<string>();
  @Output() delete = new EventEmitter<void>();

  openRenameDialog(event: Event): void {
    event.stopPropagation();
    const ref = this.dialog.open(ConfirmDialogComponent, {
      width: '480px',
      data: {
        title: 'Rename project',
        message: 'Enter a new name for this project.',
        confirmLabel: 'Rename',
        inputField: {
          label: 'Project name',
          initialValue: this.project.name,
          maxLength: 100,
        },
      },
    });

    ref.afterClosed().subscribe((result?: string) => {
      if (result) this.rename.emit(result);
    });
  }

  openDeleteDialog(event: Event): void {
    event.stopPropagation();
    const ref = this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: 'Delete project',
        message: `Are you sure you want to delete "${this.project.name}"? This will permanently delete all uploaded files and field configurations.`,
        confirmLabel: 'Delete',
        confirmColor: 'warn',
      },
    });

    ref.afterClosed().subscribe((confirmed?: boolean) => {
      if (confirmed) this.delete.emit();
    });
  }
}
