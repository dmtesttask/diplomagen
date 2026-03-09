import {
  AfterViewInit,
  Component,
  ElementRef,
  NgZone,
  OnDestroy,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { debounceTime, switchMap } from 'rxjs/operators';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
// Fabric.js v7 named exports
import { Canvas as FabricCanvas, FabricImage, IText } from 'fabric';
import type { FabricObject } from 'fabric';
import { ProjectService } from '../../projects/project.service';
import type { Field, FontFamily, Project, TextAlign } from '../../../../../../shared/src';

// Map stored font family keys → CSS / Google Fonts names
const FONT_CSS_MAP: Record<FontFamily, string> = {
  PTSerif: 'PT Serif',
  PTSans: 'PT Sans',
  Roboto: 'Roboto',
  OpenSans: 'Open Sans',
  TimesNewRoman: 'Times New Roman',
};

const FONT_OPTIONS: { value: FontFamily; label: string }[] = [
  { value: 'PTSerif', label: 'PT Serif' },
  { value: 'PTSans', label: 'PT Sans' },
  { value: 'Roboto', label: 'Roboto' },
  { value: 'OpenSans', label: 'Open Sans' },
  { value: 'TimesNewRoman', label: 'Times New Roman' },
];

@Component({
  selector: 'app-editor-page',
  standalone: true,
  imports: [
    FormsModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatTooltipModule,
  ],
  template: `
    <!-- Canvas wrapper is always rendered so @ViewChild resolves immediately -->
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
            <span>Saving…</span>
          } @else if (saveStatus() === 'saved') {
            <mat-icon class="saved-icon">check_circle</mat-icon>
            <span>Saved</span>
          }
        </div>

        <span class="spacer"></span>

        <button mat-stroked-button (click)="goBack()" aria-label="Done editing">
          <mat-icon>done</mat-icon>
          Done
        </button>
      </div>

      <!-- Main body -->
      <div class="editor-body">

        <!-- Left sidebar: fields list -->
        <div class="fields-sidebar">
          <div class="sidebar-header">
            <span class="sidebar-title">Fields</span>
            <span class="sidebar-hint">Click to place / select</span>
          </div>

          @if (isLoading()) {
            <div class="sidebar-loading"><mat-spinner diameter="32" /></div>
          } @else if (!project()?.fields?.length) {
            <p class="sidebar-empty">No fields defined. Add fields in the workspace first.</p>
          } @else {
            <div class="field-items">
              @for (field of project()!.fields; track field.id) {
                <div
                  class="field-item"
                  [class.selected]="selectedFieldId() === field.id"
                  [class.is-placed]="fieldObjects.has(field.id)"
                  (click)="onFieldSidebarClick(field)"
                  role="button"
                  [attr.aria-label]="'Select field ' + field.label"
                >
                  <div class="field-dot" [class.placed]="fieldObjects.has(field.id)"></div>
                  <div class="field-item-body">
                    <span class="field-label">{{ field.label }}</span>
                    <span class="field-src">
                      {{ field.excelColumn ? '[' + field.excelColumn + ']' : (field.staticValue ?? '—') }}
                    </span>
                  </div>
                  @if (fieldObjects.has(field.id)) {
                    <button
                      mat-icon-button
                      class="remove-btn"
                      (click)="removeFieldFromCanvas($event, field)"
                      matTooltip="Remove from canvas"
                      aria-label="Remove from canvas"
                    >
                      <mat-icon>close</mat-icon>
                    </button>
                  }
                </div>
              }
            </div>
          }
        </div>

        <!-- Canvas area -->
        <div class="canvas-area" #canvasContainer>
          @if (isLoading()) {
            <div class="canvas-loading">
              <mat-spinner diameter="48" />
              <span>Loading template…</span>
            </div>
          }
          <canvas #editorCanvas></canvas>
        </div>

        <!-- Right sidebar: style panel -->
        <div class="style-sidebar" [class.visible]="selectedFieldId() !== null">
          <div class="sidebar-header">
            <span class="sidebar-title">Style</span>
          </div>

          @if (selectedFieldId() !== null) {
            <div class="style-panel">

              <mat-form-field appearance="outline" class="style-field">
                <mat-label>Font Family</mat-label>
                <mat-select [(ngModel)]="styleFontFamily" (ngModelChange)="onStyleChanged()">
                  @for (opt of fontOptions; track opt.value) {
                    <mat-option [value]="opt.value">
                      <span [style.fontFamily]="opt.label">{{ opt.label }}</span>
                    </mat-option>
                  }
                </mat-select>
              </mat-form-field>

              <mat-form-field appearance="outline" class="style-field">
                <mat-label>Font Size (px)</mat-label>
                <input
                  matInput
                  type="number"
                  [(ngModel)]="styleFontSize"
                  (ngModelChange)="onStyleChanged()"
                  min="8"
                  max="500"
                />
              </mat-form-field>

              <div class="style-row">
                <label class="style-label">Color</label>
                <input
                  type="color"
                  class="color-picker"
                  [(ngModel)]="styleColor"
                  (ngModelChange)="onStyleChanged()"
                />
              </div>

              <div class="style-row">
                <label class="style-label">Style</label>
                <mat-button-toggle-group [multiple]="true" class="style-toggles">
                  <mat-button-toggle
                    [checked]="styleBold"
                    (change)="styleBold = !styleBold; onStyleChanged()"
                    matTooltip="Bold"
                  >
                    <mat-icon>format_bold</mat-icon>
                  </mat-button-toggle>
                  <mat-button-toggle
                    [checked]="styleItalic"
                    (change)="styleItalic = !styleItalic; onStyleChanged()"
                    matTooltip="Italic"
                  >
                    <mat-icon>format_italic</mat-icon>
                  </mat-button-toggle>
                </mat-button-toggle-group>
              </div>

              <div class="style-row">
                <label class="style-label">Align</label>
                <mat-button-toggle-group [(ngModel)]="styleAlign" (ngModelChange)="onStyleChanged()">
                  <mat-button-toggle value="left" matTooltip="Left">
                    <mat-icon>format_align_left</mat-icon>
                  </mat-button-toggle>
                  <mat-button-toggle value="center" matTooltip="Center">
                    <mat-icon>format_align_center</mat-icon>
                  </mat-button-toggle>
                  <mat-button-toggle value="right" matTooltip="Right">
                    <mat-icon>format_align_right</mat-icon>
                  </mat-button-toggle>
                </mat-button-toggle-group>
              </div>

            </div>
          } @else {
            <p class="style-empty">Select a field on the canvas to edit its style.</p>
          }
        </div>

      </div>
    </div>
  `,
  styles: [`
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
      overflow: hidden;
    }

    .editor-root {
      display: flex;
      flex-direction: column;
      height: 100%;
      overflow: hidden;
    }

    /* ─── Toolbar ──────────────────────────────────── */
    .editor-toolbar {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 8px 16px;
      border-bottom: 1px solid var(--mat-sys-outline-variant);
      background: var(--mat-sys-surface-container);
      flex-shrink: 0;
      min-height: 56px;
    }

    .toolbar-project-name {
      font-weight: 600;
      font-size: 1rem;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 240px;
    }

    .toolbar-status {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 0.8rem;
      color: var(--mat-sys-on-surface-variant);

      .saved-icon {
        color: var(--mat-sys-tertiary);
        font-size: 18px;
        width: 18px;
        height: 18px;
      }
    }

    .spacer { flex: 1; }

    /* ─── Body ─────────────────────────────────────── */
    .editor-body {
      display: flex;
      flex: 1;
      overflow: hidden;
    }

    /* ─── Left sidebar ─────────────────────────────── */
    .fields-sidebar {
      width: 220px;
      flex-shrink: 0;
      display: flex;
      flex-direction: column;
      border-right: 1px solid var(--mat-sys-outline-variant);
      background: var(--mat-sys-surface-container-low);
      overflow-y: auto;
    }

    .sidebar-header {
      padding: 12px 14px 6px;
      border-bottom: 1px solid var(--mat-sys-outline-variant);
    }

    .sidebar-title {
      font-weight: 600;
      font-size: 0.85rem;
      display: block;
    }

    .sidebar-hint {
      font-size: 0.72rem;
      color: var(--mat-sys-on-surface-variant);
      display: block;
    }

    .sidebar-loading {
      display: flex;
      justify-content: center;
      padding: 32px;
    }

    .sidebar-empty {
      padding: 14px;
      font-size: 0.8rem;
      color: var(--mat-sys-on-surface-variant);
      margin: 0;
    }

    .field-items {
      display: flex;
      flex-direction: column;
      padding: 6px;
      gap: 4px;
    }

    .field-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 6px 8px 10px;
      border-radius: 6px;
      cursor: pointer;
      transition: background 0.15s;

      &:hover { background: var(--mat-sys-surface-container); }
      &.selected { background: var(--mat-sys-primary-container); }
    }

    .field-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      flex-shrink: 0;
      background: var(--mat-sys-outline);
      &.placed { background: var(--mat-sys-tertiary); }
    }

    .field-item-body {
      flex: 1;
      min-width: 0;
    }

    .field-label {
      display: block;
      font-size: 0.82rem;
      font-weight: 500;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .field-src {
      display: block;
      font-size: 0.72rem;
      color: var(--mat-sys-on-surface-variant);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .remove-btn {
      width: 28px;
      height: 28px;
      line-height: 28px;
      flex-shrink: 0;

      mat-icon { font-size: 16px; width: 16px; height: 16px; }
    }

    /* ─── Canvas area ──────────────────────────────── */
    .canvas-area {
      flex: 1;
      overflow: auto;
      background: #6e6e6e;
      display: flex;
      align-items: flex-start;
      justify-content: center;
      position: relative;
      padding: 24px;
    }

    .canvas-loading {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 12px;
      background: rgba(0, 0, 0, 0.4);
      color: #fff;
      z-index: 10;
      font-size: 0.9rem;
    }

    canvas {
      display: block;
      box-shadow: 0 4px 32px rgba(0, 0, 0, 0.4);
    }

    /* ─── Right sidebar (style panel) ─────────────── */
    .style-sidebar {
      width: 0;
      overflow: hidden;
      flex-shrink: 0;
      border-left: 1px solid var(--mat-sys-outline-variant);
      background: var(--mat-sys-surface-container-low);
      transition: width 0.2s ease;
      display: flex;
      flex-direction: column;

      &.visible { width: 264px; overflow-y: auto; }
    }

    .style-panel {
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding: 14px;
    }

    .style-field { width: 100%; }

    .style-row {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .style-label {
      font-size: 0.8rem;
      color: var(--mat-sys-on-surface-variant);
      min-width: 44px;
    }

    .color-picker {
      width: 44px;
      height: 38px;
      border: 1px solid var(--mat-sys-outline-variant);
      border-radius: 6px;
      padding: 2px;
      cursor: pointer;
      background: transparent;
    }

    .style-empty {
      padding: 14px;
      font-size: 0.8rem;
      color: var(--mat-sys-on-surface-variant);
      margin: 0;
    }
  `],
})
export class EditorPageComponent implements AfterViewInit, OnDestroy {
  @ViewChild('editorCanvas') canvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('canvasContainer') containerRef!: ElementRef<HTMLDivElement>;

  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly projectService = inject(ProjectService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly zone = inject(NgZone);

  // ─── State signals ────────────────────────────────────────────────────────────
  readonly project = signal<Project | null>(null);
  readonly isLoading = signal(true);
  readonly selectedFieldId = signal<string | null>(null);
  readonly saveStatus = signal<'idle' | 'saving' | 'saved'>('idle');

  readonly fontOptions = FONT_OPTIONS;

  // Style panel values (two-way ngModel bound)
  styleFontFamily: FontFamily = 'PTSerif';
  styleFontSize = 48;
  styleColor = '#1a1a1a';
  styleBold = false;
  styleItalic = false;
  styleAlign: TextAlign = 'center';

  // ─── Canvas state ─────────────────────────────────────────────────────────────
  private canvas!: FabricCanvas;
  private scaleFactor = 1;
  private templateBlobUrl: string | null = null;
  /** fieldId → Fabric IText object currently on canvas */
  readonly fieldObjects = new Map<string, IText>();

  private readonly saveSubject = new Subject<void>();
  private readonly destroy$ = new Subject<void>();

  // ─── Lifecycle ────────────────────────────────────────────────────────────────
  ngAfterViewInit(): void {
    this.canvas = new FabricCanvas(this.canvasRef.nativeElement, {
      selection: true,
      preserveObjectStacking: true,
    });
    this.setupCanvasEvents();
    this.setupAutoSave();

    const projectId = this.route.snapshot.paramMap.get('id');
    if (!projectId) { this.router.navigate(['/projects']); return; }

    this.projectService.getProject(projectId).subscribe({
      next: (p) => {
        this.project.set({ ...p, fields: p.fields ?? [] });
        if (!p.template) {
          this.isLoading.set(false);
          this.snackBar.open(
            'No template uploaded. Go back and upload a template first.',
            'Back',
            { duration: 6000 },
          ).onAction().subscribe(() => this.goBack());
          return;
        }
        this.loadTemplateAndFields(p);
      },
      error: () => {
        this.isLoading.set(false);
        this.snackBar.open('Project not found.', 'Dismiss', { duration: 4000 });
        this.router.navigate(['/projects']);
      },
    });
  }

  ngOnDestroy(): void {
    this.canvas?.dispose();
    if (this.templateBlobUrl) URL.revokeObjectURL(this.templateBlobUrl);
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ─── Canvas events ────────────────────────────────────────────────────────────
  private setupCanvasEvents(): void {
    this.canvas.on('selection:created', (e) =>
      this.zone.run(() => this.onSelectionChange(e.selected ?? [])),
    );
    this.canvas.on('selection:updated', (e) =>
      this.zone.run(() => this.onSelectionChange(e.selected ?? [])),
    );
    this.canvas.on('selection:cleared', () =>
      this.zone.run(() => this.selectedFieldId.set(null)),
    );
    this.canvas.on('object:modified', () => this.saveSubject.next());
  }

  // ─── Auto-save ────────────────────────────────────────────────────────────────
  private setupAutoSave(): void {
    this.saveSubject.pipe(
      debounceTime(1000),
      switchMap(() => {
        this.saveStatus.set('saving');
        return this.projectService.updateFields(this.project()!.id, this.buildFieldsFromCanvas());
      }),
      takeUntil(this.destroy$),
    ).subscribe({
      next: (updated) => {
        this.project.set(updated);
        this.saveStatus.set('saved');
        setTimeout(() => { if (this.saveStatus() === 'saved') this.saveStatus.set('idle'); }, 2000);
      },
      error: (err) => {
        this.saveStatus.set('idle');
        this.snackBar.open(err?.error?.message ?? 'Auto-save failed.', 'Dismiss', { duration: 4000 });
      },
    });
  }

  // ─── Template loading ─────────────────────────────────────────────────────────
  private loadTemplateAndFields(project: Project): void {
    this.projectService.getTemplateContent(project.id).subscribe({
      next: (blob) => {
        this.templateBlobUrl = URL.createObjectURL(blob);
        this.loadTemplateImage(this.templateBlobUrl, project)
          .then(() => {
            project.fields
              .filter((f) => f.position !== null)
              .forEach((f) => this.addFieldToCanvas(f, false));
            this.isLoading.set(false);
          })
          .catch(() => {
            if (this.templateBlobUrl) { URL.revokeObjectURL(this.templateBlobUrl); this.templateBlobUrl = null; }
            this.isLoading.set(false);
            this.snackBar.open('Failed to load template image.', 'Dismiss', { duration: 4000 });
          });
      },
      error: () => {
        this.isLoading.set(false);
        this.snackBar.open('Failed to fetch template.', 'Dismiss', { duration: 4000 });
      },
    });
  }

  private async loadTemplateImage(signedUrl: string, project: Project): Promise<void> {
    const template = project.template!;
    const containerW = Math.max(this.containerRef.nativeElement.clientWidth - 48, 200);
    this.scaleFactor = containerW / template.widthPx;
    const cw = Math.round(template.widthPx * this.scaleFactor);
    const ch = Math.round(template.heightPx * this.scaleFactor);
    this.canvas.setDimensions({ width: cw, height: ch });

    const img = await FabricImage.fromURL(signedUrl);
    img.set({
      left: 0,
      top: 0,
      originX: 'left',
      originY: 'top',
      scaleX: cw / (img.width || cw),
      scaleY: ch / (img.height || ch),
      selectable: false,
      evented: false,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (this.canvas as any).backgroundImage = img;
    this.canvas.renderAll();
  }

  // ─── Field object management ──────────────────────────────────────────────────
  /** Add (or place at center) a field on the canvas */
  private addFieldToCanvas(field: Field, center: boolean): void {
    const columnMaxValues = this.project()?.columnMaxValues;
    const label = field.excelColumn
      ? (columnMaxValues?.[field.excelColumn] || `{ ${field.excelColumn} }`)
      : (field.staticValue ?? field.label);

    const left = center
      ? (this.canvas.width ?? 400) / 2
      : (field.position?.x ?? 0) * this.scaleFactor;
    const top = center
      ? (this.canvas.height ?? 300) / 3
      : (field.position?.y ?? 0) * this.scaleFactor;

    const obj = new IText(label, {
      left,
      top,
      fontFamily: FONT_CSS_MAP[field.style.fontFamily] ?? 'PT Serif',
      fontSize: field.style.fontSize,
      fill: field.style.color,
      fontWeight: field.style.bold ? 'bold' : 'normal',
      fontStyle: field.style.italic ? 'italic' : 'normal',
      textAlign: field.style.align,
      editable: false,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (obj as any).data = { fieldId: field.id };

    this.fieldObjects.set(field.id, obj);
    this.canvas.add(obj);
    this.canvas.renderAll();
  }

  onFieldSidebarClick(field: Field): void {
    const existing = this.fieldObjects.get(field.id);
    if (existing) {
      this.canvas.setActiveObject(existing);
      this.canvas.renderAll();
    } else {
      this.addFieldToCanvas(field, true);
      const obj = this.fieldObjects.get(field.id)!;
      this.canvas.setActiveObject(obj);
      this.canvas.renderAll();
      this.saveSubject.next();
    }
  }

  removeFieldFromCanvas(event: Event, field: Field): void {
    event.stopPropagation();
    const obj = this.fieldObjects.get(field.id);
    if (obj) {
      this.canvas.remove(obj);
      this.fieldObjects.delete(field.id);
      if (this.selectedFieldId() === field.id) this.selectedFieldId.set(null);
      this.canvas.renderAll();
      this.saveSubject.next();
    }
  }

  // ─── Selection & style ────────────────────────────────────────────────────────
  private onSelectionChange(selected: FabricObject[]): void {
    const obj = selected?.[0];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fieldId: string | undefined = (obj as any)?.data?.fieldId;
    if (!obj || !fieldId) { this.selectedFieldId.set(null); return; }

    this.selectedFieldId.set(fieldId);
    const t = obj as IText;
    this.styleFontFamily = this.cssToFontKey(t.fontFamily ?? 'PT Serif');
    this.styleFontSize = t.fontSize ?? 48;
    this.styleColor = (t.fill as string) ?? '#1a1a1a';
    this.styleBold = t.fontWeight === 'bold';
    this.styleItalic = t.fontStyle === 'italic';
    this.styleAlign = (t.textAlign ?? 'center') as TextAlign;
  }

  onStyleChanged(): void {
    const id = this.selectedFieldId();
    if (!id) return;
    const obj = this.fieldObjects.get(id);
    if (!obj) return;
    obj.set({
      fontFamily: FONT_CSS_MAP[this.styleFontFamily] ?? 'PT Serif',
      fontSize: this.styleFontSize,
      fill: this.styleColor,
      fontWeight: this.styleBold ? 'bold' : 'normal',
      fontStyle: this.styleItalic ? 'italic' : 'normal',
      textAlign: this.styleAlign,
    });
    this.canvas.requestRenderAll();
    this.saveSubject.next();
  }

  // ─── Build fields array ───────────────────────────────────────────────────────
  private buildFieldsFromCanvas(): Field[] {
    return (this.project()?.fields ?? []).map((field) => {
      const obj = this.fieldObjects.get(field.id);
      if (!obj) return { ...field, position: null };
      return {
        ...field,
        position: {
          x: Math.round((obj.left ?? 0) / this.scaleFactor),
          y: Math.round((obj.top ?? 0) / this.scaleFactor),
        },
        style: {
          fontFamily: this.cssToFontKey(obj.fontFamily ?? 'PT Serif'),
          fontSize: obj.fontSize ?? 48,
          color: (obj.fill as string) ?? '#1a1a1a',
          bold: obj.fontWeight === 'bold',
          italic: obj.fontStyle === 'italic',
          align: (obj.textAlign ?? 'center') as TextAlign,
        },
      };
    });
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────────
  private cssToFontKey(cssName: string): FontFamily {
    const hit = Object.entries(FONT_CSS_MAP).find(([, v]) => v === cssName);
    return (hit?.[0] as FontFamily) ?? 'PTSerif';
  }

  goBack(): void {
    const id = this.project()?.id;
    this.router.navigate(id ? ['/projects', id] : ['/projects']);
  }
}

