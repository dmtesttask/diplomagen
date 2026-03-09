import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  inject,
  signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatChipsModule } from '@angular/material/chips';
import { MatTableModule } from '@angular/material/table';
import { ProjectService, ExcelUploadResult } from '../../projects/project.service';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

@Component({
  selector: 'app-excel-upload',
  standalone: true,
  imports: [
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatChipsModule,
    MatTableModule,
  ],
  template: `
    <div class="excel-section">
      <div class="section-header">
        <div class="section-title-row">
          <mat-icon class="section-icon">table_chart</mat-icon>
          <h2 class="section-title">Participants (Excel)</h2>
          @if (totalRows() !== null) {
            <span class="row-badge">{{ totalRows() }} rows</span>
          }
        </div>
        <p class="section-desc">
          Upload an .xlsx file. Row 1 must be the header row with column names.
        </p>
      </div>

      <div class="upload-row">
        <button
          mat-stroked-button
          [color]="columns().length ? 'accent' : 'primary'"
          (click)="fileInput.click()"
          [disabled]="isUploading()"
          aria-label="Select Excel file"
        >
          @if (isUploading()) {
            <mat-spinner diameter="20" />
          } @else {
            <mat-icon>upload_file</mat-icon>
          }
          {{ columns().length ? 'Replace Excel File' : 'Upload Excel File' }}
        </button>
        <input
          #fileInput
          type="file"
          accept=".xlsx,.xls"
          style="display:none"
          (change)="onFileSelected($event)"
        />
        <span class="upload-hint">Max 10 MB · .xlsx or .xls</span>
      </div>

      @if (columns().length > 0) {
        <div class="columns-preview">
          <p class="preview-label">
            Detected <strong>{{ columns().length }}</strong> columns · showing first 5 rows:
          </p>
          <div class="table-scroll">
            <table mat-table [dataSource]="previewRows()" class="preview-table">
              @for (col of columns(); track col) {
                <ng-container [matColumnDef]="col">
                  <th mat-header-cell *matHeaderCellDef>{{ col }}</th>
                  <td mat-cell *matCellDef="let row">{{ row[col] }}</td>
                </ng-container>
              }
              <tr mat-header-row *matHeaderRowDef="columns()"></tr>
              <tr mat-row *matRowDef="let row; columns: columns()"></tr>
            </table>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .excel-section {
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

    .row-badge {
      background: var(--mat-sys-primary-container);
      color: var(--mat-sys-on-primary-container);
      border-radius: 12px;
      padding: 2px 10px;
      font-size: 0.75rem;
      font-weight: 600;
      line-height: 1.6;
    }

    .section-desc {
      margin: 0;
      color: var(--mat-sys-on-surface-variant);
      font-size: 0.875rem;
    }

    .upload-row {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
    }

    .upload-hint {
      font-size: 0.8rem;
      color: var(--mat-sys-on-surface-variant);
    }

    .columns-preview {
      margin-top: 20px;
    }

    .preview-label {
      margin: 0 0 12px;
      font-size: 0.875rem;
      color: var(--mat-sys-on-surface-variant);
    }

    .table-scroll {
      overflow-x: auto;
      border-radius: 8px;
      border: 1px solid var(--mat-sys-outline-variant);
    }

    .preview-table {
      width: 100%;
      min-width: 400px;
    }

    mat-spinner {
      display: inline-block;
      margin-right: 8px;
    }
  `],
})
export class ExcelUploadComponent implements OnChanges {
  @Input() projectId!: string;
  @Input() existingColumns: string[] = [];
  @Input() existingTotalRows: number | null = null;
  @Output() excelUploaded = new EventEmitter<ExcelUploadResult>();

  private readonly projectService = inject(ProjectService);
  private readonly snackBar = inject(MatSnackBar);

  readonly isUploading = signal(false);
  readonly columns = signal<string[]>([]);
  readonly totalRows = signal<number | null>(null);
  readonly previewRows = signal<Record<string, string>[]>([]);

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['existingColumns'] || changes['existingTotalRows']) {
      this.columns.set(this.existingColumns ?? []);
      this.totalRows.set(this.existingTotalRows ?? null);
    }
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';

    if (!file) return;

    if (!this.projectId) {
      this.snackBar.open('Project ID is missing — please refresh the page.', 'Dismiss', { duration: 5000 });
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      this.snackBar.open('File is too large. Maximum size is 10 MB.', 'Dismiss', { duration: 4000 });
      return;
    }

    this.isUploading.set(true);
    this.projectService.uploadExcel(this.projectId, file).subscribe({
      next: (result) => {
        this.isUploading.set(false);
        this.columns.set(result.columns);
        this.totalRows.set(result.totalRows);
        this.previewRows.set(result.preview);
        this.excelUploaded.emit(result);
        this.snackBar.open(
          `Excel uploaded successfully — ${result.totalRows} participants, ${result.columns.length} columns.`,
          'OK',
          { duration: 5000 },
        );
      },
      error: (err) => {
        this.isUploading.set(false);
        const msg = err?.error?.message ?? 'Failed to upload Excel file.';
        this.snackBar.open(msg, 'Dismiss', { duration: 5000 });
      },
    });
  }
}
