import {
  Component,
  EventEmitter,
  Input,
  OnInit,
  Output,
  inject,
  signal,
} from '@angular/core';
import { HttpEventType } from '@angular/common/http';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Storage, ref as storageRef, getDownloadURL } from '@angular/fire/storage';
import { ProjectService } from '../../projects/project.service';
import type { TemplateMetadata } from '../../../../../../shared/src';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'application/pdf'] as const;
type AllowedMime = typeof ALLOWED_TYPES[number];
const MAX_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB

function getExtension(mimeType: string): string {
  const map: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'application/pdf': 'pdf',
  };
  return map[mimeType] ?? 'bin';
}

@Component({
  selector: 'app-template-upload',
  standalone: true,
  imports: [MatButtonModule, MatIconModule, MatProgressBarModule],
  template: `
    <div class="template-section">
      <div class="section-header">
        <h2 class="section-title">
          <mat-icon>image</mat-icon>
          Diploma Template
        </h2>
        @if (template()) {
          <button mat-stroked-button (click)="onReplaceClick()" [disabled]="isUploading()">
            <mat-icon>swap_horiz</mat-icon>
            Replace Template
          </button>
        }
      </div>

      @if (template()) {
        <!-- Template Preview -->
        <div class="preview-container">
          @if (previewUrl()) {
            <img [src]="previewUrl()" alt="Template preview" class="template-preview" />
          } @else {
            <div class="pdf-preview">
              @if (template()?.mimeType === 'application/pdf') {
                <mat-icon class="pdf-icon">picture_as_pdf</mat-icon>
                <span>PDF Template</span>
              } @else {
                <mat-icon class="pdf-icon">image</mat-icon>
                <span>Loading preview…</span>
              }
            </div>
          }
          <div class="template-info">
            <span class="dimension-badge">{{ template()!.widthPx }} × {{ template()!.heightPx }} px</span>
          </div>
        </div>
      } @else {
        <!-- Drop Zone -->
        <div
          class="drop-zone"
          [class.drag-over]="isDragOver()"
          [class.uploading]="isUploading()"
          (dragover)="onDragOver($event)"
          (dragleave)="onDragLeave()"
          (drop)="onDrop($event)"
          (click)="fileInput.click()"
          role="button"
          tabindex="0"
          (keydown.enter)="fileInput.click()"
          aria-label="Upload diploma template"
        >
          <input
            #fileInput
            type="file"
            accept=".pdf,.jpg,.jpeg,.png"
            style="display: none"
            (change)="onFileSelected($event)"
            id="template-file-input"
          />

          @if (isUploading()) {
            <div class="upload-progress">
              <mat-icon class="upload-icon spinning">sync</mat-icon>
              <p class="upload-label">Uploading... {{ uploadProgress() }}%</p>
              <mat-progress-bar
                mode="determinate"
                [value]="uploadProgress()"
                class="progress-bar"
              />
            </div>
          } @else {
            <mat-icon class="drop-icon">cloud_upload</mat-icon>
            <p class="drop-label">Drag & drop or <strong>click to select</strong></p>
            <p class="drop-hint">PDF, JPEG, PNG — max 20 MB</p>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .template-section {
      background: var(--mat-sys-surface-container-low);
      border-radius: 16px;
      padding: 24px;
    }

    .section-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 20px;
    }

    .section-title {
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 0;
      font-size: 1.1rem;
      font-weight: 600;
    }

    .drop-zone {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 48px 24px;
      border: 2px dashed var(--mat-sys-outline-variant);
      border-radius: 12px;
      cursor: pointer;
      transition: border-color 0.2s, background 0.2s;

      &:hover:not(.uploading) {
        border-color: var(--mat-sys-primary);
        background: color-mix(in srgb, var(--mat-sys-primary) 5%, transparent);
      }

      &.drag-over {
        border-color: var(--mat-sys-primary);
        background: color-mix(in srgb, var(--mat-sys-primary) 10%, transparent);
        transform: scale(1.01);
      }

      &.uploading {
        cursor: default;
        pointer-events: none;
      }
    }

    .drop-icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
      color: var(--mat-sys-on-surface-variant);
      opacity: 0.5;
    }

    .drop-label {
      margin: 0;
      font-size: 0.95rem;
      color: var(--mat-sys-on-surface-variant);
    }

    .drop-hint {
      margin: 0;
      font-size: 0.8rem;
      color: var(--mat-sys-on-surface-variant);
      opacity: 0.7;
    }

    .upload-progress {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      width: 100%;
      max-width: 280px;
    }

    .upload-icon {
      font-size: 40px;
      width: 40px;
      height: 40px;
      color: var(--mat-sys-primary);
    }

    .spinning {
      animation: spin 1.2s linear infinite;
    }

    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }

    .upload-label {
      margin: 0;
      font-size: 0.9rem;
      color: var(--mat-sys-on-surface-variant);
    }

    .progress-bar {
      width: 100%;
      border-radius: 4px;
    }

    .preview-container {
      position: relative;
      border-radius: 12px;
      overflow: hidden;
      background: var(--mat-sys-surface-container);
      border: 1px solid var(--mat-sys-outline-variant);
    }

    .template-preview {
      width: 100%;
      max-height: 360px;
      object-fit: contain;
      display: block;
    }

    .pdf-preview {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 60px;
      color: var(--mat-sys-on-surface-variant);
    }

    .pdf-icon {
      font-size: 64px;
      width: 64px;
      height: 64px;
      color: var(--mat-sys-primary);
      opacity: 0.7;
    }

    .template-info {
      position: absolute;
      bottom: 12px;
      right: 12px;
    }

    .dimension-badge {
      background: color-mix(in srgb, var(--mat-sys-inverse-surface) 80%, transparent);
      color: var(--mat-sys-inverse-on-surface);
      font-size: 0.75rem;
      padding: 4px 10px;
      border-radius: 999px;
      font-weight: 500;
    }
  `],
})
export class TemplateUploadComponent implements OnInit {
  @Input({ required: true }) projectId!: string;
  @Input() template: (() => TemplateMetadata | null) = () => null;
  @Output() templateUploaded = new EventEmitter<TemplateMetadata>();

  private readonly projectService = inject(ProjectService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly storage = inject(Storage);

  readonly isDragOver = signal(false);
  readonly isUploading = signal(false);
  readonly uploadProgress = signal(0);
  readonly previewUrl = signal<string | null>(null);

  ngOnInit(): void {
    // When navigating back to a project that already has a template, load
    // the persistent download URL so the preview is shown immediately.
    const t = this.template();
    if (t && t.mimeType !== 'application/pdf') {
      this.loadStoragePreview(t.storageUrl);
    }
  }

  private loadStoragePreview(gcsPath: string): void {
    getDownloadURL(storageRef(this.storage, gcsPath))
      .then(url => this.previewUrl.set(url))
      .catch(() => { /* storage not reachable — preview stays hidden */ });
  }

  // ─── Drag & Drop ───────────────────────────────────────────────────────────

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.isDragOver.set(true);
  }

  onDragLeave(): void {
    this.isDragOver.set(false);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.isDragOver.set(false);
    const file = event.dataTransfer?.files[0];
    if (file) this.handleFile(file);
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) this.handleFile(file);
    input.value = '';
  }

  onReplaceClick(): void {
    this.previewUrl.set(null);
    this.templateUploaded.emit(null as unknown as TemplateMetadata);
  }

  // ─── Upload Flow ───────────────────────────────────────────────────────────

  private handleFile(file: File): void {
    if (!ALLOWED_TYPES.includes(file.type as AllowedMime)) {
      this.snackBar.open('Unsupported file type. Use PDF, JPEG, or PNG.', 'Dismiss', { duration: 4000 });
      return;
    }
    if (file.size > MAX_SIZE_BYTES) {
      this.snackBar.open('File too large (max 20 MB).', 'Dismiss', { duration: 4000 });
      return;
    }
    if (file.type !== 'application/pdf') {
      this.previewUrl.set(URL.createObjectURL(file));
    } else {
      this.previewUrl.set(null);
    }
    this.uploadFile(file);
  }

  private uploadFile(file: File): void {
    this.isUploading.set(true);
    this.uploadProgress.set(0);

    const extension = getExtension(file.type);

    // Step 1: Request upload URL / mode from backend
    this.projectService.getUploadUrl(this.projectId, file.type, extension).subscribe({
      next: ({ uploadUrl, gcsPath, useDirectUpload }) => {
        if (useDirectUpload) {
          // Emulator path: upload via Cloud Function multipart
          this.uploadProgress.set(50);
          this.projectService.uploadFileMultipart(this.projectId, file).subscribe({
            next: ({ gcsPath: confirmedPath, mimeType }) => {
              this.uploadProgress.set(90);
              this.projectService.confirmTemplate(this.projectId, confirmedPath, mimeType).subscribe({
                next: (template) => this.onUploadSuccess(template),
                error: () => this.onUploadError('Failed to process template.'),
              });
            },
            error: () => this.onUploadError('Upload failed.'),
          });
        } else {
          // Production path: PUT directly to GCS via signed URL
          this.projectService.uploadFileDirect(uploadUrl as string, file).subscribe({
            next: (event) => {
              if (event.type === HttpEventType.UploadProgress) {
                const e = event as { loaded: number; total?: number };
                this.uploadProgress.set(e.total ? Math.round((e.loaded / e.total) * 100) : 0);
              } else if (event.type === HttpEventType.Response) {
                this.projectService.confirmTemplate(this.projectId, gcsPath, file.type).subscribe({
                  next: (template) => this.onUploadSuccess(template),
                  error: () => this.onUploadError('Failed to process template.'),
                });
              }
            },
            error: () => this.onUploadError('Upload failed.'),
          });
        }
      },
      error: () => this.onUploadError('Failed to start upload.'),
    });
  }

  private onUploadSuccess(template: TemplateMetadata): void {
    this.isUploading.set(false);
    this.uploadProgress.set(100);
    this.templateUploaded.emit(template);
    this.snackBar.open('Template uploaded successfully!', undefined, { duration: 3000 });
    // Replace the ephemeral createObjectURL blob with a persistent Storage URL
    // so the preview survives navigation and page reloads.
    if (template.mimeType !== 'application/pdf') {
      this.loadStoragePreview(template.storageUrl);
    }
  }

  private onUploadError(msg: string): void {
    this.isUploading.set(false);
    this.previewUrl.set(null);
    this.snackBar.open(`${msg} Please try again.`, 'Dismiss', { duration: 5000 });
  }
}
