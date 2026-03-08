import { Component, Inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormControl, Validators } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';

export interface ConfirmDialogData {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmColor?: 'primary' | 'accent' | 'warn';
  /** When set, shows a text input and returns its value (for rename flows) */
  inputField?: {
    label: string;
    initialValue?: string;
    maxLength?: number;
  };
}

@Component({
  selector: 'app-confirm-dialog',
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
    <h2 mat-dialog-title>{{ data.title }}</h2>

    <mat-dialog-content>
      <p class="dialog-message">{{ data.message }}</p>

      @if (data.inputField) {
        <mat-form-field appearance="outline" class="full-width" style="margin-top: 8px">
          <mat-label>{{ data.inputField.label }}</mat-label>
          <input
            matInput
            [formControl]="inputControl"
            [maxlength]="data.inputField.maxLength ?? 200"
            (keydown.enter)="onConfirm()"
            autofocus
            [attr.aria-label]="data.inputField.label"
          />
          @if (inputControl.hasError('required') && inputControl.touched) {
            <mat-error>This field is required.</mat-error>
          }
        </mat-form-field>
      }
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>
        {{ data.cancelLabel ?? 'Cancel' }}
      </button>
      <button
        mat-raised-button
        [color]="data.confirmColor ?? 'primary'"
        [disabled]="data.inputField && inputControl.invalid"
        (click)="onConfirm()"
      >
        {{ data.confirmLabel ?? 'Confirm' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .dialog-message {
      margin: 0;
      color: var(--mat-sys-on-surface-variant);
      line-height: 1.6;
    }

    h2[mat-dialog-title] {
      padding-top: 8px;
    }
  `],
})
export class ConfirmDialogComponent {
  readonly inputControl: FormControl<string>;

  constructor(
    public readonly dialogRef: MatDialogRef<ConfirmDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public readonly data: ConfirmDialogData,
  ) {
    this.inputControl = new FormControl(data.inputField?.initialValue ?? '', {
      nonNullable: true,
      validators: data.inputField ? [Validators.required] : [],
    });
  }

  onConfirm(): void {
    if (this.data.inputField && this.inputControl.invalid) {
      this.inputControl.markAsTouched();
      return;
    }

    if (this.data.inputField) {
      this.dialogRef.close(this.inputControl.value.trim());
    } else {
      this.dialogRef.close(true);
    }
  }
}
