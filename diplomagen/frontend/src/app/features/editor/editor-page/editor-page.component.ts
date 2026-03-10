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

        <!-- Buttons to add unplaced fields into the Designer -->
        @if (project()?.fields?.length) {
          <div class="field-buttons">
            @for (field of unplacedFields(); track field.id) {
              <button mat-stroked-button (click)="addFieldToDesigner(field)" [matTooltip]="'Add: ' + field.label">
                <mat-icon>add</mat-icon>
                {{ field.label }}
              </button>
            }
          </div>
        }

        <button mat-stroked-button (click)="goBack()" aria-label="Done editing">
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

      <!-- pdfme Designer mounts here -->
      <div #designerContainer class="designer-container"></div>

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
    .field-buttons { display: flex; gap: 4px; flex-wrap: wrap; }

    .designer-container { flex: 1; overflow: hidden; }

    .loading-overlay {
      position: absolute;
      inset: 56px 0 0 0;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(255,255,255,0.7);
      z-index: 10;
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
  readonly unplacedFields = signal<Field[]>([]);

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

      this.designer.onChangeTemplate((t) => {
        const schemas = (t.schemas[0] ?? []) as Schema[];
        this.updateUnplacedFields(schemas);
        this.saveSubject.next(schemas as PdfmeSchemaRecord[]);
      });

      this.updateUnplacedFields(existingSchemas);
      this.isLoading.set(false);
    } catch {
      this.isLoading.set(false);
      this.snackBar.open('Failed to load project.', 'Dismiss', { duration: 4000 });
      this.router.navigate(['/projects']);
    }
  }

  private placeholderForField(field: Field): string {
    if (field.staticValue !== null) return field.staticValue;
    const maxValues = this.project()?.columnMaxValues;
    if (field.excelColumn && maxValues?.[field.excelColumn]) {
      return maxValues[field.excelColumn];
    }
    return `{${field.label}}`;
  }

  addFieldToDesigner(field: Field): void {
    if (!this.designer) return;
    const current = this.designer.getTemplate();
    const currentSchemas = (current.schemas[0] ?? []) as Schema[];

    if (currentSchemas.some((s) => s.name === field.id)) return;

    const newSchema: Schema = {
      name: field.id,
      type: 'text',
      content: this.placeholderForField(field),
      position: { x: 50, y: 100 },
      width: 100,
      height: 15,
      fontSize: 18,
      fontName: 'PTSerif',
      fontColor: '#1a1a1a',
      alignment: 'center',
    } as Schema;

    this.designer.updateTemplate({
      ...current,
      schemas: [[...currentSchemas, newSchema]],
    });
  }

  private updateUnplacedFields(currentSchemas: Schema[]): void {
    const placedNames = new Set(currentSchemas.map((s) => s.name));
    const fields = this.project()?.fields ?? [];
    this.unplacedFields.set(fields.filter((f) => !placedNames.has(f.id)));
  }

  goBack(): void {
    const id = this.project()?.id;
    this.router.navigate(id ? ['/projects', id] : ['/projects']);
  }
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

