import {
  Component,
  EventEmitter,
  Input,
  OnInit,
  OnChanges,
  Output,
  SimpleChanges,
  inject,
  signal,
  computed,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { GenerationService } from '../generation.service';
import {
  ProgressDialogComponent,
} from '../progress-dialog/progress-dialog.component';
import type { ProgressDialogData } from '../progress-dialog/progress-dialog.component';
import {
  ConfirmDialogComponent,
} from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import type { ConfirmDialogData } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import type { Project, GenerationJob } from '../../../../../../shared/src';

@Component({
  selector: 'app-generation-panel',
  standalone: true,
  imports: [
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    MatTooltipModule,
  ],
  template: `
    <div class="gen-panel">
      <div class="gen-header">
        <div>
          <h3 class="gen-title">Generate Diplomas</h3>
          <p class="gen-subtitle">
            @if (!project.template) {
              Upload a template first.
            } @else if (!project.excelColumns.length) {
              Upload an Excel file with participant data.
            } @else if (!hasPlacedFields()) {
              Place at least one field on the canvas.
            } @else {
              Ready — {{ project.totalRows ?? 0 }} diploma(s) will be generated.
            }
          </p>
        </div>

        <button
          mat-raised-button
          color="primary"
          [disabled]="!canGenerate() || isBusy()"
          (click)="confirmAndGenerate()"
          [matTooltip]="generateTooltip()"
          aria-label="Generate all diplomas"
        >
          <mat-icon>picture_as_pdf</mat-icon>
          Generate All
        </button>
      </div>

      <!-- Last job status -->
      @if (lastJob()) {
        <div class="last-job" [class]="'last-job--' + lastJob()!.status">
          @switch (lastJob()!.status) {
            @case ('pending') {
              <mat-icon class="job-icon">hourglass_empty</mat-icon>
              <span>Queued…</span>
              <mat-progress-bar mode="indeterminate" class="job-bar" />
            }
            @case ('processing') {
              <mat-icon class="job-icon">autorenew</mat-icon>
              <span>Processing {{ lastJob()!.processedCount }} / {{ lastJob()!.totalCount }}…</span>
              <mat-progress-bar
                mode="determinate"
                [value]="lastJobProgress()"
                class="job-bar"
              />
            }
            @case ('done') {
              <mat-icon class="job-icon">check_circle</mat-icon>
              <span>{{ lastJob()!.processedCount }} diploma(s) generated.</span>
              <button
                mat-stroked-button
                class="download-btn"
                [disabled]="downloadBusy()"
                (click)="downloadZip(lastJob()!.id)"
              >
                <mat-icon>download</mat-icon>
                Download ZIP
              </button>
            }
            @case ('error') {
              <mat-icon class="job-icon error">error</mat-icon>
              <span class="error-text">{{ lastJob()!.errorMessage ?? 'Generation failed.' }}</span>
            }
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .gen-panel {
      border: 1px solid var(--mat-sys-outline-variant);
      border-radius: 12px;
      padding: 20px 24px;
      background: var(--mat-sys-surface-container-low);
    }

    .gen-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 16px;
    }

    .gen-title {
      margin: 0 0 4px;
      font-size: 1rem;
      font-weight: 600;
    }

    .gen-subtitle {
      margin: 0;
      font-size: 0.875rem;
      color: var(--mat-sys-on-surface-variant);
    }

    .last-job {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-top: 16px;
      padding: 12px 16px;
      border-radius: 8px;
      font-size: 0.875rem;
      flex-wrap: wrap;

      &--pending, &--processing {
        background: var(--mat-sys-surface-variant);
        color: var(--mat-sys-on-surface-variant);
      }

      &--done {
        background: var(--mat-sys-secondary-container);
        color: var(--mat-sys-on-secondary-container);
      }

      &--error {
        background: var(--mat-sys-error-container);
        color: var(--mat-sys-on-error-container);
      }
    }

    .job-icon {
      font-size: 1.2rem;
      width: 1.2rem;
      height: 1.2rem;
      flex-shrink: 0;
    }

    .job-icon.error { color: var(--mat-sys-error); }

    .job-bar {
      flex: 1;
      min-width: 120px;
    }

    .download-btn {
      margin-left: auto;
    }

    .error-text {
      font-size: 0.85rem;
    }
  `],
})
export class GenerationPanelComponent implements OnInit, OnChanges {
  @Input({ required: true }) project!: Project;
  @Output() generationDone = new EventEmitter<void>();

  private readonly generationService = inject(GenerationService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  readonly lastJob = signal<GenerationJob | null>(null);
  readonly isBusy = signal(false);
  readonly downloadBusy = signal(false);

  readonly hasPlacedFields = computed(
    () => (this.project?.pdfmeSchemas?.length ?? 0) > 0,
  );

  readonly canGenerate = computed(
    () =>
      !!(
        this.project?.template &&
        this.project.excelColumns.length > 0 &&
        this.hasPlacedFields() &&
        (this.project.totalRows ?? 0) > 0
      ),
  );

  readonly generateTooltip = computed(() => {
    if (!this.project?.template) return 'Upload a template first';
    if (!this.project.excelColumns.length) return 'Upload an Excel file first';
    if (!this.hasPlacedFields()) return 'Place at least one field in the editor';
    return '';
  });

  readonly lastJobProgress = computed(() => {
    const j = this.lastJob();
    if (!j || !j.totalCount) return 0;
    return Math.round((j.processedCount / j.totalCount) * 100);
  });

  ngOnInit(): void {
    this.loadLastJob();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['project'] && changes['project'].currentValue?.id !== changes['project'].previousValue?.id) {
      this.loadLastJob();
    }
  }

  private loadLastJob(): void {
    if (!this.project?.id) return;
    this.generationService.listJobs(this.project.id).subscribe({
      next: ({ jobs }) => {
        const latest = jobs?.[0] ?? null;
        this.lastJob.set(latest as GenerationJob | null);
      },
      error: () => { /* non-critical, ignore */ },
    });
  }

  confirmAndGenerate(): void {
    const count = this.project.totalRows ?? 0;
    const hasExistingJob = this.lastJob() !== null;

    const dialogRef = this.dialog.open<ConfirmDialogComponent, ConfirmDialogData, boolean>(
      ConfirmDialogComponent,
      {
        data: {
          title: 'Generate All Diplomas',
          message: `This will generate ${count} diploma(s).${
            hasExistingJob
              ? ' Any existing generated ZIP will be replaced.'
              : ''
          } This will deduct ${count} generation(s) from your balance.`,
          confirmLabel: 'Generate',
          confirmColor: 'primary',
        },
        width: '420px',
      },
    );

    dialogRef.afterClosed().subscribe((confirmed) => {
      if (confirmed) this.triggerGeneration();
    });
  }

  private triggerGeneration(): void {
    this.isBusy.set(true);

    this.generationService.startGeneration(this.project.id).subscribe({
      next: ({ jobId, totalCount }) => {
        this.isBusy.set(false);

        // Open real-time progress dialog
        const dialogRef = this.dialog.open<ProgressDialogComponent, ProgressDialogData>(
          ProgressDialogComponent,
          {
            data: {
              projectId: this.project.id,
              jobId,
              totalCount,
              projectName: this.project.name,
            },
            width: '480px',
            disableClose: true,
          },
        );

        dialogRef.afterClosed().subscribe((result: string | undefined) => {
          this.loadLastJob();
          // Only emit (and redirect) when the job completed successfully.
          // 'background' means user dismissed the dialog while still running — do nothing.
          // If the dialog was closed on error, cancel, or mid-generation, do NOT redirect.
          if (result === 'done') {
            this.generationDone.emit();
          }
        });
      },
      error: (err: { error?: { error?: { message?: string; code?: string } } }) => {
        this.isBusy.set(false);
        const apiError = err?.error?.error;
        const code = apiError?.code;
        const msg = apiError?.message ?? 'Failed to start generation.';
        if (code === 'INSUFFICIENT_BALANCE') {
          this.snackBar.open(msg, 'Top Up', { duration: 8000 });
        } else {
          this.snackBar.open(msg, 'Dismiss', { duration: 6000 });
        }
      },
    });
  }

  downloadZip(jobId: string | undefined): void {
    if (!jobId || this.downloadBusy()) return;
    this.downloadBusy.set(true);

    this.generationService.downloadZip(this.project.id, jobId).subscribe({
      next: (blob) => {
        this.downloadBusy.set(false);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${this.project.name}_diplomas.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 10_000);
      },
      error: (err: { error?: { error?: { message?: string; code?: string } } }) => {
        this.downloadBusy.set(false);
        const code = err?.error?.error?.code;
        if (code === 'ZIP_EXPIRED') {
          this.snackBar.open('The ZIP has expired. Please regenerate.', 'Dismiss', { duration: 6000 });
          this.lastJob.set(null);
        } else {
          this.snackBar.open(err?.error?.error?.message ?? 'Download failed.', 'Dismiss', { duration: 4000 });
        }
      },
    });
  }
}
