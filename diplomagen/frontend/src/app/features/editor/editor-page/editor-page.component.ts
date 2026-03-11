import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, firstValueFrom, takeUntil } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Designer } from '@pdfme/ui';
import { text } from '@pdfme/schemas';
import type { Template, Schema } from '@pdfme/common';
import { PDFDocument } from 'pdf-lib';
import { ProjectService } from '../../projects/project.service';
import type { Field, PdfmeSchemaRecord, Project } from '../../../../../../shared/src';
import { loadPdfmeFonts } from './pdfme-fonts.loader';

@Component({
  selector: 'app-editor-page',
  standalone: true,
  imports: [
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
  ],
  template: `
    <div class="editor-root">

      <!-- Toolbar -->
      <div class="editor-toolbar">
        <button mat-icon-button (click)="goBack()" matTooltip="Back to workspace" aria-label="Back">
          <mat-icon>arrow_back</mat-icon>
        </button>
        <span class="toolbar-project-name">{{ project()?.name }}</span>

        <div class="toolbar-status">
          @if (saveStatus() === 'saving') {
            <mat-spinner diameter="16" />
            <span>Saving</span>
          } @else if (saveStatus() === 'saved') {
            <mat-icon class="saved-icon">check_circle</mat-icon>
            <span>Saved</span>
          }
        </div>
        <span class="spacer"></span>

        <!-- Columns removed from canvas — click to re-add -->
        @if (unplacedColumns().length > 0) {
          <div class="unplaced-cols">
            @for (col of unplacedColumns(); track col) {
              <button
                mat-stroked-button
                class="unplaced-col-btn"
                (click)="addColumnToDesigner(col)"
                [matTooltip]="'Re-add: ' + col"
              >
                <mat-icon>add</mat-icon>
                {{ col }}
              </button>
            }
          </div>
        }

        <button mat-stroked-button class="toolbar-action-btn" (click)="addStaticText()" matTooltip="Add a static text element">
          <mat-icon>text_fields</mat-icon>
          Add Static Text
        </button>

        <button mat-stroked-button class="toolbar-action-btn toolbar-action-btn--soon" disabled matTooltip="Coming soon">
          <mat-icon>qr_code_2</mat-icon>
          Add QR Code
          <span class="soon-badge">Soon</span>
        </button>

        <button mat-stroked-button (click)="doneEditing()" aria-label="Done editing">
          <mat-icon>done</mat-icon>
          Done
        </button>
      </div>

      <!-- Loading state -->
      @if (isLoading()) {
        <div class="loading-overlay">
          <mat-spinner diameter="48" />
        </div>
      }

      <div class="editor-body">
        <!-- pdfme Designer mounts here -->
        <div #designerContainer class="designer-container"></div>
      </div>

    </div>
  `,
  styles: [`
    :host { display: flex; flex-direction: column; height: 100%; overflow: hidden; }
    .editor-root { display: flex; flex-direction: column; height: 100%; overflow: hidden; }

    .editor-toolbar {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 16px;
      border-bottom: 1px solid var(--mat-sys-outline-variant);
      background: var(--mat-sys-surface-container);
      flex-shrink: 0;
      min-height: 56px;
      flex-wrap: wrap;
    }
    .toolbar-project-name {
      font-weight: 600;
      font-size: 1rem;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 200px;
    }
    .toolbar-status {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 0.8rem;
      color: var(--mat-sys-on-surface-variant);
    }
    .toolbar-status .saved-icon {
      color: var(--mat-sys-tertiary);
      font-size: 18px;
      width: 18px;
      height: 18px;
    }
    .spacer { flex: 1; }

    .unplaced-cols {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      align-items: center;
    }

    .unplaced-col-btn {
      font-size: 0.75rem;
      height: 32px;
      padding: 0 10px;
      border-style: dashed;
      opacity: 0.8;
      mat-icon { font-size: 14px; width: 14px; height: 14px; }
    }

    .toolbar-action-btn {
      font-size: 0.8rem;
      gap: 4px;
    }

    .toolbar-action-btn--soon {
      opacity: 0.55;
    }

    .soon-badge {
      margin-left: 4px;
      font-size: 0.65rem;
      background: var(--mat-sys-surface-variant);
      border-radius: 4px;
      padding: 1px 4px;
      color: var(--mat-sys-on-surface-variant);
    }

    .editor-body {
      display: flex;
      flex: 1;
      overflow: hidden;
    }

    .designer-container {
      flex: 1;
      overflow: hidden;
      min-width: 0;
    }

    .loading-overlay {
      position: absolute;
      inset: 56px 0 0 0;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(255,255,255,0.7);
      z-index: 10;
    }

    /* Hide pdfme Designer's built-in left-panel "add schema" side button */
    ::ng-deep .designer-container .right-sidebar-buttons,
    ::ng-deep .designer-container [class*="leftSidebar"],
    ::ng-deep .designer-container [class*="left-sidebar"] {
      display: none !important;
    }

    /**
     * Scale up react-moveable resize/rotation handles.
     * These elements are rendered OUTSIDE the Paper's transform:scale() div,
     * so their pixel size is already in screen pixels — just enlarge directly.
     */
    ::ng-deep .designer-container .moveable-control {
      width: 20px !important;
      height: 20px !important;
      margin-top: -10px !important;
      margin-left: -10px !important;
      border-width: 3px !important;
    }

    /**
     * The pdfme delete button is rendered INSIDE the Paper's transform:scale() div.
     * At low scale values (~0.3–0.5 for high-res templates) it becomes nearly invisible.
     * --pdfme-delete-scale is set at runtime (1/scale) to counteract the parent transform.
     */
    ::ng-deep .designer-container .pdfme-designer-delete-button {
      width: 20px !important;
      height: 20px !important;
      padding: 4px !important;
      transform: scale(var(--pdfme-delete-scale, 1)) !important;
      transform-origin: top left !important;
    }
  `],
})
export class EditorPageComponent implements AfterViewInit, OnDestroy {
  @ViewChild('designerContainer') containerRef!: ElementRef<HTMLDivElement>;

  private readonly route      = inject(ActivatedRoute);
  private readonly router     = inject(Router);
  private readonly projectService = inject(ProjectService);
  private readonly snackBar   = inject(MatSnackBar);

  readonly project        = signal<Project | null>(null);
  readonly isLoading      = signal(true);
  readonly saveStatus     = signal<'idle' | 'saving' | 'saved'>('idle');
  readonly unplacedColumns = signal<string[]>([]);

  private designer: Designer | null = null;
  private readonly saveSubject = new Subject<PdfmeSchemaRecord[]>();
  private readonly destroy$    = new Subject<void>();

  ngAfterViewInit(): void {
    this.setupAutoSave();
    const projectId = this.route.snapshot.paramMap.get('id');
    if (!projectId) { this.router.navigate(['/projects']); return; }
    this.loadProject(projectId);
  }

  ngOnDestroy(): void {
    this.designer?.destroy();
    this.destroy$.next();
    this.destroy$.complete();
  }

  private setupAutoSave(): void {
    this.saveSubject.pipe(
      debounceTime(1000),
      takeUntil(this.destroy$),
    ).subscribe((schemas) => {
      this.saveStatus.set('saving');
      this.projectService.updatePdfmeTemplate(this.project()!.id, schemas).subscribe({
        next: (updated) => {
          this.project.set(updated);
          this.saveStatus.set('saved');
          setTimeout(() => { if (this.saveStatus() === 'saved') this.saveStatus.set('idle'); }, 2000);
        },
        error: (err) => {
          this.saveStatus.set('idle');
          this.snackBar.open(err?.error?.error?.message ?? 'Auto-save failed.', 'Dismiss', { duration: 4000 });
        },
      });
    });
  }

  private async loadProject(projectId: string): Promise<void> {
    try {
      const project = await firstValueFrom(this.projectService.getProject(projectId));
      this.project.set(project);

      if (!project.template) {
        this.isLoading.set(false);
        this.snackBar.open(
          'No template uploaded. Go back and upload a template first.',
          'Back',
          { duration: 6000 },
        ).onAction().subscribe(() => this.goBack());
        return;
      }

      const [templateBlob, fonts] = await Promise.all([
        firstValueFrom(this.projectService.getTemplateContent(projectId)),
        loadPdfmeFonts(),
      ]);
      const basePdf = await imageBlobToPdf(templateBlob);

      const existingSchemas = (project.pdfmeSchemas as Schema[] | null) ?? [];

      const template: Template = {
        basePdf,
        schemas: [existingSchemas],
      };

      this.designer = new Designer({
        domContainer: this.containerRef.nativeElement,
        template,
        options: { font: fonts },
        plugins: { text },
      });

      this.applyCanvasControlScale();

      this.designer.onChangeTemplate((t) => {
        const schemas = (t.schemas[0] ?? []) as Schema[];
        this.updateUnplacedColumns(schemas);
        this.saveSubject.next(schemas as PdfmeSchemaRecord[]);
      });

      // Auto-add all Excel columns not yet on the canvas
      this.autoAddMissingColumns(project, existingSchemas);

      this.isLoading.set(false);
    } catch {
      this.isLoading.set(false);
      this.snackBar.open('Failed to load project.', 'Dismiss', { duration: 4000 });
      this.router.navigate(['/projects']);
    }
  }

  private updateUnplacedColumns(currentSchemas: Schema[]): void {
    const placed = new Set(currentSchemas.map((s) => s.name));
    const allCols = this.project()?.excelColumns ?? [];
    this.unplacedColumns.set(allCols.filter((col) => !placed.has(col)));
  }

  /**
   * Computes pdfme's initial canvas scale factor (paper px / container px)
   * and stores the inverse as a CSS variable so the delete button can
   * counter-scale itself to an absolute screen-pixel size.
   *
   * Formula mirrors pdfme's internal getScale():
   *   scale = Math.floor(min(containerW/widthPx, (containerH-30)/heightPx, 1) * 100) / 100
   */
  private applyCanvasControlScale(): void {
    const tmpl = this.project()?.template;
    if (!tmpl) return;
    const RULER = 30; // pdfme RULER_HEIGHT constant
    const el = this.containerRef.nativeElement;
    const scaleW = (el.clientWidth  - RULER) / tmpl.widthPx;
    const scaleH = (el.clientHeight - RULER) / tmpl.heightPx;
    const scale  = Math.floor(Math.min(scaleW, scaleH, 1) * 100) / 100;
    el.style.setProperty('--pdfme-delete-scale', String(scale > 0 ? 1 / scale : 1));
  }

  addColumnToDesigner(col: string): void {
    if (!this.designer) return;
    const current = this.designer.getTemplate();
    const schemas = (current.schemas[0] ?? []) as Schema[];
    if (schemas.some((s) => s.name === col)) return;

    const tmpl = this.project()?.template;
    const { fontSize, itemH, itemW, canvasW, canvasH } = tmpl
      ? defaultTextDims(tmpl.widthPx, tmpl.heightPx)
      : { fontSize: 18, itemH: 15, itemW: 120, canvasW: 210, canvasH: 297 };

    const maxValues = this.project()?.columnMaxValues;
    const newSchema: Schema = {
      name: col,
      type: 'text',
      content: (maxValues && maxValues[col]) ? maxValues[col] : col,
      position: { x: (canvasW - itemW) / 2, y: (canvasH - itemH) / 2 },
      width: itemW,
      height: itemH,
      fontSize,
      fontName: 'PTSerif',
      fontColor: '#1a1a1a',
      alignment: 'center',
    } as Schema;

    this.designer.updateTemplate({
      ...current,
      schemas: [[...schemas, newSchema]],
    });
  }

  private autoAddMissingColumns(project: Project, existingSchemas: Schema[]): void {
    if (!this.designer) return;
    const cols = project.excelColumns ?? [];
    if (cols.length === 0) return;

    const placedNames = new Set(existingSchemas.map((s) => s.name));
    const missing = cols.filter((col) => !placedNames.has(col));
    if (missing.length === 0) return;

    const tmpl = project.template;
    const { fontSize, itemH, itemW, canvasW, canvasH } = tmpl
      ? defaultTextDims(tmpl.widthPx, tmpl.heightPx)
      : { fontSize: 18, itemH: 15, itemW: 120, canvasW: 210, canvasH: 297 };

    const gap = Math.round(itemH * 0.3);
    const groupH = missing.length * itemH + (missing.length - 1) * gap;
    const startX = (canvasW - itemW) / 2;
    const startY = Math.max(10, (canvasH - groupH) / 2);

    const maxValues = project.columnMaxValues;
    const newSchemas: Schema[] = missing.map((col, i) => ({
      name: col,
      type: 'text',
      content: (maxValues && maxValues[col]) ? maxValues[col] : col,
      position: { x: startX, y: startY + i * (itemH + gap) },
      width: itemW,
      height: itemH,
      fontSize,
      fontName: 'PTSerif',
      fontColor: '#1a1a1a',
      alignment: 'center',
    } as Schema));

    const current = this.designer.getTemplate();
    this.designer.updateTemplate({
      ...current,
      schemas: [[...existingSchemas, ...newSchemas]],
    });
  }

  addStaticText(): void {
    if (!this.designer) return;
    const current = this.designer.getTemplate();
    const schemas = (current.schemas[0] ?? []) as Schema[];

    const tmpl = this.project()?.template;
    const { fontSize, itemH, itemW, canvasW, canvasH } = tmpl
      ? defaultTextDims(tmpl.widthPx, tmpl.heightPx)
      : { fontSize: 16, itemH: 15, itemW: 120, canvasW: 210, canvasH: 297 };

    const staticId = `static_${Date.now()}`;
    const newSchema: Schema = {
      name: staticId,
      type: 'text',
      content: 'Static Text',
      position: { x: (canvasW - itemW) / 2, y: (canvasH - itemH) / 2 },
      width: itemW,
      height: itemH,
      fontSize,
      fontName: 'PTSerif',
      fontColor: '#1a1a1a',
      alignment: 'center',
    } as Schema;

    this.designer.updateTemplate({
      ...current,
      schemas: [[...schemas, newSchema]],
    });

    // Also persist a Field record for this static schema so PDF generation works
    const newField: Field = {
      id: staticId,
      label: 'Static Text',
      excelColumn: null,
      staticValue: 'Static Text',
    };
    const existing = this.project()?.fields ?? [];
    if (!existing.some((f) => f.id === staticId)) {
      const updated = [...existing, newField];
      this.projectService.updateFields(this.project()!.id, updated).subscribe({
        next: (p) => this.project.set(p),
        error: () => { /* non-critical: schema is already on canvas */ },
      });
    }
  }

  doneEditing(): void {
    const id = this.project()?.id;
    this.router.navigate(id ? ['/projects', id] : ['/projects'], {
      queryParams: { summary: '1' },
    });
  }

  goBack(): void {
    const id = this.project()?.id;
    this.router.navigate(id ? ['/projects', id] : ['/projects']);
  }
}

/**
 * Compute default text element dimensions based on the template pixel size.
 * pdfme uses mm as its coordinate unit. Conversion: mm = px * (25.4 / 96).
 * For a 3508×2480px template this yields ~928×656mm, and a fontSize of ~66pt —
 * squarely within the visible 55-75 range on the pdfme Size panel.
 */
function defaultTextDims(widthPx: number, heightPx: number) {
  const PX_TO_MM = 25.4 / 96;
  const canvasW = widthPx  * PX_TO_MM;
  const canvasH = heightPx * PX_TO_MM;
  const fontSize = Math.round(canvasH * 0.1);
  const itemH    = Math.round(fontSize * 0.85);
  const itemW    = Math.min(Math.round(canvasW * 0.65), canvasW - 20);
  return { fontSize, itemH, itemW, canvasW, canvasH };
}

async function imageBlobToPdf(blob: Blob): Promise<ArrayBuffer> {
  const type = blob.type.toLowerCase();
  if (type === 'application/pdf') {
    return blob.arrayBuffer();
  }
  // Image (image/jpeg, image/png, …) — embed in a PDF page the same size as the image.
  // Must use the same px→pt conversion as the backend (ensurePdfBuffer: 72/96),
  // so that pdfme Designer and Generator share identical mm coordinate spaces.
  const PX_TO_PT = 72 / 96;
  const imgBytes = new Uint8Array(await blob.arrayBuffer());
  const pdfDoc = await PDFDocument.create();
  const img = type.includes('png')
    ? await pdfDoc.embedPng(imgBytes)
    : await pdfDoc.embedJpg(imgBytes);
  const widthPt  = img.width  * PX_TO_PT;
  const heightPt = img.height * PX_TO_PT;
  const page = pdfDoc.addPage([widthPt, heightPt]);
  page.drawImage(img, { x: 0, y: 0, width: widthPt, height: heightPt });
  const pdfBytes = await pdfDoc.save();
  return pdfBytes.buffer as ArrayBuffer;
}

