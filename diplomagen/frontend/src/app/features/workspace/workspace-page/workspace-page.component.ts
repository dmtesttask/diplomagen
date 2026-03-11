import { Component, ElementRef, OnInit, OnDestroy, ViewChild, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Viewer } from '@pdfme/ui';
import { text } from '@pdfme/schemas';
import type { Template, Schema } from '@pdfme/common';
import { PDFDocument } from 'pdf-lib';
import { ProjectService } from '../../projects/project.service';
import { TemplateUploadComponent } from '../template-upload/template-upload.component';
import { ExcelUploadComponent } from '../excel-upload/excel-upload.component';
import { GenerationPanelComponent } from '../../generation/generation-panel/generation-panel.component';
import { loadPdfmeFonts } from '../../editor/editor-page/pdfme-fonts.loader';
import type { Project, TemplateMetadata, Field } from '../../../../../../shared/src';
import type { ExcelUploadResult } from '../../projects/project.service';

@Component({
  selector: 'app-workspace-page',
  standalone: true,
  imports: [
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    TemplateUploadComponent,
    ExcelUploadComponent,
    GenerationPanelComponent,
  ],
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
        </div>

        <!-- Normal setup view -->
        @if (!showSummary()) {
          <div class="workspace-content">
            <!-- Step 1: Template -->
            <app-template-upload
              [projectId]="project()!.id"
              [template]="getTemplate"
              (templateUploaded)="onTemplateUploaded($event)"
            />

            <!-- Step 2: Excel (shown once a template is set) -->
            @if (project()!.template) {
              <app-excel-upload
                [projectId]="project()!.id"
                [existingColumns]="project()!.excelColumns"
                [existingTotalRows]="project()!.totalRows"
                (excelUploaded)="onExcelUploaded($event)"
                (proceedToEditor)="openEditor()"
              />
            }
          </div>
        } @else {
          <!-- Summary view (shown after returning from editor with ?summary=1) -->
          <div class="summary-view">
            <div class="summary-header">
              <h2 class="summary-title">{{ project()!.name }}</h2>
              <p class="summary-subtitle">
                {{ project()!.excelColumns.length }} column(s) &nbsp;·&nbsp;
                {{ project()!.totalRows ?? 0 }} participant(s) &nbsp;·&nbsp;
                {{ (project()!.pdfmeSchemas?.length ?? 0) }} element(s) on canvas
              </p>
            </div>

            <!-- pdfme Viewer — shows the diploma with all text elements positioned -->
            @if (summaryLoading()) {
              <div class="summary-loader"><mat-spinner diameter="40" /></div>
            }
            <div #summaryViewerContainer class="summary-viewer-container"></div>

            <div class="summary-actions">
              <button mat-stroked-button (click)="openEditor()">
                <mat-icon>edit</mat-icon>
                Back to Editor
              </button>
              <app-generation-panel [project]="project()!" (generationDone)="onGenerationDone()" />
            </div>
          </div>
        }
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

    .workspace-content {
      display: flex;
      flex-direction: column;
      gap: 24px;
    }

    .summary-view {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 24px;
      padding: 16px 0;
    }

    .summary-header { text-align: center; }

    .summary-title {
      margin: 0 0 6px;
      font-size: 1.5rem;
      font-weight: 700;
    }

    .summary-subtitle {
      margin: 0;
      color: var(--mat-sys-on-surface-variant);
      font-size: 0.875rem;
    }

    .summary-loader {
      display: flex;
      justify-content: center;
      padding: 40px;
    }

    .summary-viewer-container {
      width: 100%;
      max-width: 700px;
      min-height: 200px;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 4px 20px rgba(0,0,0,0.12);
      border: 1px solid var(--mat-sys-outline-variant);
    }

    .summary-actions {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 16px;
      width: 100%;
      max-width: 700px;
    }
  `],
})
export class WorkspacePageComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly projectService = inject(ProjectService);
  private readonly snackBar = inject(MatSnackBar);

  @ViewChild('summaryViewerContainer') summaryViewerRef?: ElementRef<HTMLDivElement>;

  readonly project = signal<Project | null>(null);
  readonly isLoading = signal(true);
  readonly showSummary = signal(false);
  readonly summaryLoading = signal(false);
  private viewer: Viewer | null = null;

  /** Passed as a bound function to TemplateUploadComponent */
  readonly getTemplate = () => this.project()?.template ?? null;

  canOpenEditor(): boolean {
    const p = this.project();
    return !!(p?.template && p.excelColumns.length > 0);
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.router.navigate(['/projects']);
      return;
    }

    this.projectService.getProject(id).subscribe({
      next: (p) => {
        // Ensure fields introduced after project creation always exist
        this.project.set({
          ...p,
          excelColumns: p.excelColumns ?? [],
          excelDataPath: p.excelDataPath ?? null,
          totalRows: p.totalRows ?? null,
          fields: p.fields ?? [],
        });
        this.isLoading.set(false);

        const summary = this.route.snapshot.queryParamMap.get('summary');
        if (summary === '1') {
          this.showSummary.set(true);
          // Wait one tick so @ViewChild container is rendered before mounting Viewer
          setTimeout(() => this.mountSummaryViewer());
        }
      },
      error: () => {
        this.snackBar.open('Project not found.', 'Dismiss', { duration: 4000 });
        this.router.navigate(['/projects']);
      },
    });
  }

  ngOnDestroy(): void {
    this.viewer?.destroy();
  }

  onTemplateUploaded(template: TemplateMetadata | null): void {
    const current = this.project();
    if (current) {
      // Reset Excel and fields when template changes
      this.project.set({
        ...current,
        template: template ?? null,
        ...(template === null ? { excelColumns: [], excelDataPath: null, totalRows: null, fields: [] } : {}),
      });
    }
  }

  onExcelUploaded(result: ExcelUploadResult): void {
    const current = this.project();
    if (!current) return;

    // Auto-create one Field per Excel column.
    // Convention: id === column name — this is used in the editor to match schema.name.
    const autoFields: Field[] = result.columns.map((col) => ({
      id: col,
      label: col,
      excelColumn: col,
      staticValue: null,
    }));

    // Persist to backend, then update local signal.
    // This call completely replaces the previous field list — that is intentional.
    this.projectService.updateFields(current.id, autoFields).subscribe({
      next: (updated) => {
        this.project.set({
          ...updated,
          excelColumns: result.columns,
          totalRows: result.totalRows,
        });
      },
      error: () => {
        // Non-blocking: update local state so the user isn't stuck
        this.project.set({
          ...current,
          excelColumns: result.columns,
          totalRows: result.totalRows,
          fields: autoFields,
        });
      },
    });
  }

  openEditor(): void {
    const id = this.project()?.id;
    if (id) this.router.navigate(['/projects', id, 'editor']);
  }

  onGenerationDone(): void {
    this.router.navigate(['/projects']);
  }

  private async mountSummaryViewer(): Promise<void> {
    const container = this.summaryViewerRef?.nativeElement;
    const project   = this.project();
    if (!container || !project?.template) return;

    this.summaryLoading.set(true);
    try {
      const [templateBlob, fonts] = await Promise.all([
        firstValueFrom(this.projectService.getTemplateContent(project.id)),
        loadPdfmeFonts(),
      ]);
      const basePdf = await imageBlobToPdf(templateBlob);

      const schemas  = (project.pdfmeSchemas as Schema[] | null) ?? [];
      const template: Template = { basePdf, schemas: [schemas] };

      this.viewer?.destroy();
      this.viewer = new Viewer({
        domContainer: container,
        template,
        inputs: [{}],           // empty inputs — shows placeholders/content as-is
        options: { font: fonts },
        plugins: { text },
      });
    } catch {
      // Preview failed — not critical, user can still generate
    } finally {
      this.summaryLoading.set(false);
    }
  }
}

async function imageBlobToPdf(blob: Blob): Promise<ArrayBuffer> {
  const type = blob.type.toLowerCase();
  if (type === 'application/pdf') return blob.arrayBuffer();
  const PX_TO_PT = 72 / 96;
  const imgBytes = new Uint8Array(await blob.arrayBuffer());
  const pdfDoc   = await PDFDocument.create();
  const img      = type.includes('png')
    ? await pdfDoc.embedPng(imgBytes)
    : await pdfDoc.embedJpg(imgBytes);
  const page = pdfDoc.addPage([img.width * PX_TO_PT, img.height * PX_TO_PT]);
  page.drawImage(img, { x: 0, y: 0, width: img.width * PX_TO_PT, height: img.height * PX_TO_PT });
  return (await pdfDoc.save()).buffer as ArrayBuffer;
}

