import { Component, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormControl, Validators } from '@angular/forms';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-create-project-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
  ],
  template: `
    <div class="dialog-header">
      <mat-icon class="header-icon">folder_open</mat-icon>
      <div>
        <h2 mat-dialog-title>Create new project</h2>
        <p class="dialog-subtitle">Give your project a name to get started.</p>
      </div>
    </div>

    <mat-dialog-content>
      <mat-form-field appearance="outline" class="full-width">
        <mat-label>Project name</mat-label>
        <input
          matInput
          [formControl]="nameControl"
          placeholder="e.g. Regional Math Olympiad 2026"
          maxlength="100"
          (keydown.enter)="onCreate()"
          autofocus
          id="project-name-input"
          aria-label="Project name"
        />
        <mat-hint align="end">{{ nameControl.value.length || 0 }}/100</mat-hint>

        @if (nameControl.hasError('required') && nameControl.touched) {
          <mat-error>Project name is required.</mat-error>
        }
        @if (nameControl.hasError('maxlength')) {
          <mat-error>Name must be 100 characters or fewer.</mat-error>
        }
      </mat-form-field>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button
        mat-raised-button
        color="primary"
        [disabled]="nameControl.invalid"
        (click)="onCreate()"
      >
        Create Project
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .dialog-header {
      display: flex;
      align-items: flex-start;
      gap: 16px;
      padding: 24px 24px 0;
    }

    .header-icon {
      font-size: 32px;
      width: 32px;
      height: 32px;
      color: var(--mat-sys-primary);
      margin-top: 4px;
      flex-shrink: 0;
    }

    h2[mat-dialog-title] {
      margin: 0 0 4px;
      padding: 0;
    }

    .dialog-subtitle {
      margin: 0;
      font-size: 0.875rem;
      color: var(--mat-sys-on-surface-variant);
    }

    mat-dialog-content {
      padding-top: 16px !important;
    }
  `],
})
export class CreateProjectDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<CreateProjectDialogComponent>);

  readonly nameControl = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.maxLength(100)],
  });

  onCreate(): void {
    if (this.nameControl.invalid) {
      this.nameControl.markAsTouched();
      return;
    }
    this.dialogRef.close(this.nameControl.value.trim());
  }
}
