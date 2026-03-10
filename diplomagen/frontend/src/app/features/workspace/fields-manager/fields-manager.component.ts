import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnInit,
  OnDestroy,
  Output,
  SimpleChanges,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { debounceTime, switchMap } from 'rxjs/operators';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { ProjectService } from '../../projects/project.service';
import type { Field, FontFamily, TextAlign } from '../../../../../../shared/src';

export interface FieldDraft {
  id: string;
  label: string;
  sourceType: 'excel' | 'static';
  excelColumn: string | null;
  staticValue: string | null;
  position: { x: number; y: number } | null;
  style: {
    fontFamily: FontFamily;
    fontSize: number;
    color: string;
    bold: boolean;
    italic: boolean;
    align: TextAlign;
  };
}

function draftFromField(field: Field): FieldDraft {
  return {
    id: field.id,
    label: field.label,
    sourceType: field.staticValue !== null ? 'static' : 'excel',
    excelColumn: field.excelColumn,
    staticValue: field.staticValue,
    position: field.position,
    style: { ...field.style },
  };
}

function fieldFromDraft(draft: FieldDraft): Field {
  return {
    id: draft.id,
    label: draft.label,
    excelColumn: draft.sourceType === 'excel' ? draft.excelColumn : null,
    staticValue: draft.sourceType === 'static' ? (draft.staticValue ?? '') : null,
    position: draft.position,
    style: { ...draft.style },
  };
}

function newDraft(): FieldDraft {
  return {
    id: `field_${Date.now()}`,
    label: 'New Field',
    sourceType: 'excel',
    excelColumn: null,
    staticValue: null,
    position: null,
    style: {
      fontFamily: 'PTSerif',
      fontSize: 48,
      color: '#1a1a1a',
      bold: false,
      italic: false,
      align: 'center',
    },
  };
}

@Component({
  selector: 'app-fields-manager',
  standalone: true,
  imports: [
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatTooltipModule,
    MatButtonToggleModule,
  ],
  template: `
    <div class="fields-section">
      <div class="section-header">
        <div class="section-title-row">
          <mat-icon class="section-icon">text_fields</mat-icon>
          <h2 class="section-title">Diploma Fields</h2>
          @if (saveStatus() === 'saving') {
            <span class="save-indicator saving">Saving…</span>
          } @else if (saveStatus() === 'saved') {
            <span class="save-indicator saved">
              <mat-icon inline>check_circle</mat-icon> Saved
            </span>
          }
        </div>
        <p class="section-desc">
          Define what text fields appear on each diploma. Map each field to an Excel column or set a fixed value.
        </p>
      </div>

      @if (drafts().length === 0) {
        <p class="empty-hint">No fields yet. Add your first field below.</p>
      }

      <div class="fields-list">
        @for (draft of drafts(); track draft.id; let i = $index) {
          <div class="field-card" [class.placed]="draft.position !== null">
            <div class="field-card-header">
              <span class="field-index">{{ i + 1 }}</span>
              <mat-form-field appearance="outline" class="label-field">
                <mat-label>Field Label</mat-label>
                <input
                  matInput
                  [(ngModel)]="draft.label"
                  (ngModelChange)="onChanged()"
                  placeholder="e.g. Full Name"
                  maxlength="100"
                />
              </mat-form-field>

              <mat-button-toggle-group
                [(ngModel)]="draft.sourceType"
                (ngModelChange)="onChanged()"
                class="source-toggle"
                aria-label="Source type"
              >
                <mat-button-toggle value="excel" matTooltip="Use Excel column">
                  <mat-icon>table_rows</mat-icon>
                </mat-button-toggle>
                <mat-button-toggle value="static" matTooltip="Use fixed text">
                  <mat-icon>edit_note</mat-icon>
                </mat-button-toggle>
              </mat-button-toggle-group>

              <button
                mat-icon-button
                color="warn"
                (click)="removeField(i)"
                matTooltip="Delete field"
                aria-label="Delete field"
              >
                <mat-icon>delete_outline</mat-icon>
              </button>
            </div>

            <div class="field-source">
              @if (draft.sourceType === 'excel') {
                <mat-form-field appearance="outline" class="full-width">
                  <mat-label>Map to Excel Column</mat-label>
                  <mat-select
                    [(ngModel)]="draft.excelColumn"
                    (ngModelChange)="onChanged()"
                    [disabled]="excelColumns.length === 0"
                  >
                    <mat-option [value]="null">— Not mapped —</mat-option>
                    @for (col of excelColumns; track col) {
                      <mat-option [value]="col">{{ col }}</mat-option>
                    }
                  </mat-select>
                  @if (excelColumns.length === 0) {
                    <mat-hint>Upload an Excel file first to see available columns.</mat-hint>
                  }
                </mat-form-field>
              } @else {
                <mat-form-field appearance="outline" class="full-width">
                  <mat-label>Fixed Text Value</mat-label>
                  <input
                    matInput
                    [(ngModel)]="draft.staticValue"
                    (ngModelChange)="onChanged()"
                    placeholder="e.g. Certificate of Achievement"
                  />
                </mat-form-field>
              }
            </div>

            @if (draft.position) {
              <div class="placed-badge">
                <mat-icon inline>pin_drop</mat-icon> Placed on canvas
              </div>
            } @else {
              <div class="unplaced-badge">
                <mat-icon inline>location_off</mat-icon> Not yet placed — open the editor
              </div>
            }
          </div>
        }
      </div>

      <button
        mat-stroked-button
        color="primary"
        (click)="addField()"
        class="add-btn"
      >
        <mat-icon>add</mat-icon>
        Add Field
      </button>
    </div>
  `,
  styles: [`
    .fields-section {
      background: var(--mat-sys-surface-container-low);
      border-radius: 12px;
      padding: 24px;
    }

    .section-header {
      margin-bottom: 20px;
    }

    .section-title-row {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 6px;
    }

    .section-icon {
      color: var(--mat-sys-primary);
    }

    .section-title {
      margin: 0;
      font-size: 1.1rem;
      font-weight: 600;
    }

    .save-indicator {
      font-size: 0.8rem;
      display: flex;
      align-items: center;
      gap: 4px;

      &.saving { color: var(--mat-sys-on-surface-variant); }
      &.saved { color: var(--mat-sys-tertiary); }

      mat-icon { font-size: 16px; width: 16px; height: 16px; }
    }

    .section-desc {
      margin: 0;
      color: var(--mat-sys-on-surface-variant);
      font-size: 0.875rem;
    }

    .empty-hint {
      color: var(--mat-sys-on-surface-variant);
      font-size: 0.9rem;
      margin: 0 0 16px;
    }

    .fields-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
      margin-bottom: 16px;
    }

    .field-card {
      border: 1px solid var(--mat-sys-outline-variant);
      border-radius: 8px;
      padding: 16px;
      background: var(--mat-sys-surface);

      &.placed {
        border-color: var(--mat-sys-tertiary);
      }
    }

    .field-card-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 12px;
    }

    .field-index {
      font-size: 0.8rem;
      font-weight: 600;
      background: var(--mat-sys-surface-container);
      border-radius: 50%;
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .label-field {
      flex: 1;
      margin-bottom: -1.25em;
    }

    .source-toggle {
      flex-shrink: 0;
    }

    .field-source {
      .full-width {
        width: 100%;
        margin-bottom: -1.25em;
      }
    }

    .placed-badge,
    .unplaced-badge {
      margin-top: 12px;
      font-size: 0.78rem;
      display: flex;
      align-items: center;
      gap: 4px;

      mat-icon { font-size: 14px; width: 14px; height: 14px; }
    }

    .placed-badge {
      color: var(--mat-sys-tertiary);
    }

    .unplaced-badge {
      color: var(--mat-sys-on-surface-variant);
    }

    .add-btn {
      margin-top: 4px;
    }
  `],
})
export class FieldsManagerComponent implements OnChanges, OnInit, OnDestroy {
  @Input() projectId!: string;
  @Input() fields: Field[] = [];
  @Input() excelColumns: string[] = [];
  @Output() fieldsChanged = new EventEmitter<Field[]>();

  private readonly projectService = inject(ProjectService);
  private readonly snackBar = inject(MatSnackBar);

  readonly drafts = signal<FieldDraft[]>([]);
  readonly saveStatus = signal<'idle' | 'saving' | 'saved'>('idle');

  private readonly changeSubject = new Subject<void>();
  private readonly destroy$ = new Subject<void>();

  ngOnInit(): void {
    this.changeSubject
      .pipe(
        debounceTime(800),
        switchMap(() => {
          this.saveStatus.set('saving');
          const fields = this.drafts().map(fieldFromDraft);
          return this.projectService.updateFields(this.projectId, fields);
        }),
        takeUntil(this.destroy$),
      )
      .subscribe({
        next: (project) => {
          this.saveStatus.set('saved');
          this.fieldsChanged.emit(project.fields);
          setTimeout(() => this.saveStatus.set('idle'), 2000);
        },
        error: (err) => {
          this.saveStatus.set('idle');
          const msg = err?.error?.error?.message ?? 'Failed to save fields.';
          this.snackBar.open(msg, 'Dismiss', { duration: 4000 });
        },
      });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['fields']) {
      this.drafts.set(this.fields.map(draftFromField));
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onChanged(): void {
    this.changeSubject.next();
  }

  addField(): void {
    this.drafts.update((prev) => [...prev, newDraft()]);
    this.onChanged();
  }

  removeField(index: number): void {
    this.drafts.update((prev) => prev.filter((_, i) => i !== index));
    this.onChanged();
  }
}
