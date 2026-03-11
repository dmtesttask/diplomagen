import { Component, ElementRef, OnInit, OnDestroy, ViewChild, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ProjectService } from '../../projects/project.service';
import { TemplateUploadComponent } from '../template-upload/template-upload.component';
import { ExcelUploadComponent } from '../excel-upload/excel-upload.component';
import { GenerationPanelComponent } from '../../generation/generation-panel/generation-panel.component';
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

            <!-- Canvas preview — shows the diploma with all text elements positioned -->
            @if (summaryLoading()) {
              <div class="summary-loader"><mat-spinner diameter="40" /></div>
            }
            <canvas #summaryCanvas class="summary-canvas"></canvas>

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

    .summary-canvas {
      display: block;
      width: 100%;
      max-width: 700px;
      height: auto;
      border-radius: 12px;
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

  @ViewChild('summaryCanvas') summaryCanvasRef?: ElementRef<HTMLCanvasElement>;

  readonly project = signal<Project | null>(null);
  readonly isLoading = signal(true);
  readonly showSummary = signal(false);
  readonly summaryLoading = signal(false);

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
          // Wait one tick so @ViewChild canvas is rendered before drawing
          setTimeout(() => this.renderPreviewCanvas());
        }
      },
      error: () => {
        this.snackBar.open('Project not found.', 'Dismiss', { duration: 4000 });
        this.router.navigate(['/projects']);
      },
    });
  }

  ngOnDestroy(): void {
    // nothing to destroy — canvas is cleaned up by Angular
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

  private async renderPreviewCanvas(): Promise<void> {
    const canvas = this.summaryCanvasRef?.nativeElement;
    const project = this.project();
    if (!canvas || !project?.template) return;

    this.summaryLoading.set(true);
    try {
      const blob = await firstValueFrom(this.projectService.getTemplateContent(project.id));
      const schemas = (project.pdfmeSchemas ?? []) as Array<Record<string, unknown>>;

      // Register any fonts referenced by schemas (skip already-loaded ones)
      const fontUrlMap: Record<string, string> = {
        PTSerif:           '/assets/fonts/PTSerif-Regular.ttf',
        PTSerifBold:       '/assets/fonts/PTSerif-Bold.ttf',
        PTSerifItalic:     '/assets/fonts/PTSerif-Italic.ttf',
        PTSerifBoldItalic: '/assets/fonts/PTSerif-BoldItalic.ttf',
        PTSans:            '/assets/fonts/PTSans-Regular.ttf',
        Roboto:            '/assets/fonts/Roboto-Regular.ttf',
        OpenSans:          '/assets/fonts/OpenSans-Regular.ttf',
        GreatVibes:        '/assets/fonts/GreatVibes-Regular.ttf',
      };

      const neededFonts = new Set(
        schemas
          .map((s) => s['fontName'] as string | undefined)
          .filter((n): n is string => !!n && n in fontUrlMap),
      );

      await Promise.all(
        [...neededFonts]
          .filter((name) => !document.fonts.check(`12px "${name}"`))
          .map(async (name) => {
            const face = new FontFace(name, `url(${fontUrlMap[name]})`);
            await face.load();
            document.fonts.add(face);
          }),
      );
      await document.fonts.ready;

      // Draw template image
      const blobUrl = URL.createObjectURL(blob);
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = reject;
        el.src = blobUrl;
      });
      URL.revokeObjectURL(blobUrl);

      canvas.width  = project.template!.widthPx;
      canvas.height = project.template!.heightPx;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      // mm → px at 96 DPI;  pt → px at 96 DPI
      const MM_TO_PX = 96 / 25.4;
      const PT_TO_PX = 96 / 72;

      for (const schema of schemas) {
        const content = (schema['content'] as string | undefined) ?? '';
        if (!content) continue;

        const pos      = schema['position'] as { x: number; y: number } | undefined;
        const xMm      = pos?.x ?? 0;
        const yMm      = pos?.y ?? 0;
        const fontSizePt = (schema['fontSize'] as number | undefined) ?? 12;
        const fontName   = (schema['fontName'] as string | undefined) ?? 'PTSerif';
        const fontColor  = (schema['fontColor'] as string | undefined) ?? '#000000';
        const alignment  = (schema['alignment'] as CanvasTextAlign | undefined) ?? 'left';
        const widthMm  = (schema['width'] as number | undefined) ?? 0;

        const xPx      = xMm * MM_TO_PX;
        const yPx      = yMm * MM_TO_PX;
        const fontPx   = fontSizePt * PT_TO_PX;
        const widthPx  = widthMm * MM_TO_PX;

        ctx.font        = `${fontPx}px "${fontName}"`;
        ctx.fillStyle   = fontColor;
        ctx.textAlign   = alignment;
        ctx.textBaseline = 'top';

        // Honour box width for centred/right alignment origin
        const originX = alignment === 'center' ? xPx + widthPx / 2
                       : alignment === 'right'  ? xPx + widthPx
                       : xPx;
        ctx.fillText(content, originX, yPx);
      }
    } catch {
      // Preview failed — not critical, user can still generate
    } finally {
      this.summaryLoading.set(false);
    }
  }
}

