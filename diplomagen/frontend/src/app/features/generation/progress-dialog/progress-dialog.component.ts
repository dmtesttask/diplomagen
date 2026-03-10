import {
  Component,
  OnInit,
  OnDestroy,
  inject,
  signal,
  computed,
} from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatIconModule } from '@angular/material/icon';
import { Subject, takeUntil } from 'rxjs';
import { GenerationService } from '../generation.service';
import type { GenerationJob } from '../../../../../../shared/src';

export interface ProgressDialogData {
  projectId: string;
  jobId: string;
  totalCount: number;
  projectName: string;
}

@Component({
  selector: 'app-progress-dialog',
  standalone: true,
  imports: [
    MatDialogModule,
    MatButtonModule,
    MatProgressBarModule,
    MatIconModule,
  ],
  template: `
    <h2 mat-dialog-title>Generating Diplomas</h2>

    <mat-dialog-content>
      @switch (job()?.status) {
        @case ('pending') {
          <p class="status-text">Queued — waiting for generation to start…</p>
          <mat-progress-bar mode="indeterminate" />
        }
        @case ('processing') {
          <p class="status-text">
            Processing {{ job()?.processedCount ?? 0 }} of {{ data.totalCount }} diploma(s)…
          </p>
          <mat-progress-bar mode="determinate" [value]="progressPercent()" />
          <p class="progress-label">{{ progressPercent() }}%</p>
        }
        @case ('done') {
          <div class="result-block success">
            <mat-icon class="result-icon success-icon">check_circle</mat-icon>
            <div>
              <p class="result-title">{{ job()?.processedCount }} diploma(s) generated!</p>
              <p class="result-subtitle">Click Download to save the ZIP archive.</p>
            </div>
          </div>
        }
        @case ('error') {
          <div class="result-block error">
            <mat-icon class="result-icon error-icon">error</mat-icon>
            <div>
              <p class="result-title">Generation failed</p>
              <p class="result-subtitle">{{ job()?.errorMessage ?? 'Unknown error.' }}</p>
            </div>
          </div>
        }
        @default {
          <p class="status-text">Connecting…</p>
          <mat-progress-bar mode="indeterminate" />
        }
      }
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      @if (job()?.status === 'done') {
        <button mat-stroked-button (click)="close()">Close</button>
        <button
          mat-raised-button
          color="primary"
          [disabled]="downloadBusy()"
          (click)="download()"
        >
          <mat-icon>download</mat-icon>
          Download ZIP
        </button>
      } @else if (job()?.status === 'error') {
        <button mat-raised-button (click)="close()">Close</button>
      } @else {
        <button mat-stroked-button (click)="close()" [disabled]="isRunning()">
          Cancel
        </button>
      }
    </mat-dialog-actions>
  `,
  styles: [`
    mat-dialog-content {
      min-width: 360px;
      padding-top: 8px;
    }

    .status-text {
      margin: 0 0 16px;
      color: var(--mat-sys-on-surface-variant);
    }

    .progress-label {
      margin: 6px 0 0;
      font-size: 0.8rem;
      text-align: right;
      color: var(--mat-sys-on-surface-variant);
    }

    .result-block {
      display: flex;
      align-items: flex-start;
      gap: 16px;
      padding: 16px;
      border-radius: 8px;
    }

    .result-block.success {
      background: var(--mat-sys-secondary-container);
      color: var(--mat-sys-on-secondary-container);
    }

    .result-block.error {
      background: var(--mat-sys-error-container);
      color: var(--mat-sys-on-error-container);
    }

    .result-icon {
      font-size: 2rem;
      width: 2rem;
      height: 2rem;
      flex-shrink: 0;
    }

    .success-icon { color: var(--mat-sys-primary); }
    .error-icon   { color: var(--mat-sys-error); }

    .result-title {
      margin: 0 0 4px;
      font-weight: 600;
    }

    .result-subtitle {
      margin: 0;
      font-size: 0.875rem;
    }
  `],
})
export class ProgressDialogComponent implements OnInit, OnDestroy {
  readonly data = inject<ProgressDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<ProgressDialogComponent>);
  private readonly generationService = inject(GenerationService);

  readonly job = signal<GenerationJob | undefined>(undefined);
  readonly downloadBusy = signal(false);

  readonly progressPercent = computed(() => {
    const j = this.job();
    if (!j || !j.totalCount) return 0;
    return Math.round((j.processedCount / j.totalCount) * 100);
  });

  readonly isRunning = computed(() => {
    const s = this.job()?.status;
    return s === 'pending' || s === 'processing';
  });

  private readonly destroy$ = new Subject<void>();

  ngOnInit(): void {
    this.generationService
      .watchJob(this.data.projectId, this.data.jobId)
      .pipe(takeUntil(this.destroy$))
      .subscribe((j) => this.job.set(j));
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  close(): void {
    this.dialogRef.close(this.job()?.status);
  }

  download(): void {
    if (this.downloadBusy()) return;
    this.downloadBusy.set(true);
    this.generationService
      .downloadZip(this.data.projectId, this.data.jobId)
      .subscribe({
        next: (blob) => {
          this.downloadBusy.set(false);
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${this.data.projectName}_diplomas.zip`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          setTimeout(() => URL.revokeObjectURL(url), 10_000);
        },
        error: (err: { error?: { error?: { message?: string } } }) => {
          this.downloadBusy.set(false);
          console.error('Download error:', err?.error?.error?.message ?? err);
        },
      });
  }
}
