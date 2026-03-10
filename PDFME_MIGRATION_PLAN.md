# DiplomaGen  Инструкция миграции на pdfme

> Этот документ является **пошаговой инструкцией для AI-агента**.
> Выполняй фазы строго по порядку. Перед началом каждой фазы прочитай все затрагиваемые файлы целиком.
> После каждого шага проверяй ошибки компиляции TypeScript.

---

## Контекст: зачем эта миграция

Текущий стек использует три независимые системы координат:
- Fabric.js canvas  `display px`
- Firestore  `template px` (деление на `scaleFactor`)
- pdf-lib  `PDF points` (умножение на `PX_TO_PT = 72/96`, инверсия Y)

Это источник потенциальных ошибок позиционирования. **pdfme** использует единую систему координат  миллиметры с origin верхний-левый  одинаково в браузерном Designer и в серверном Generator. Конвертаций нет.

---

## Рабочие директории

- Frontend: `diplomagen/frontend/`
- Functions: `diplomagen/functions/`
- Shared: `diplomagen/shared/`

---

## ФАЗА 0  Proof of Concept

**Выполнить первой, до любых изменений в коде.**
Если шаги 0.2 или 0.3 завершились с ошибкой  дальнейшую миграцию не выполнять, доложить о причине.

### Шаг 0.1  установить зависимости

В `diplomagen/frontend/` выполни:
```
npm install @pdfme/ui@latest @pdfme/common@latest @pdfme/schemas@latest
```

В `diplomagen/functions/` выполни:
```
npm install @pdfme/generator@latest @pdfme/common@latest @pdfme/schemas@latest
```

### Шаг 0.2  проверить Generator в Node.js

Создай временный файл `diplomagen/functions/src/_poc_test.ts` и запусти его (`ts-node` или скомпилируй + `node`). Файл должен создать `poc_output.pdf` без ошибок.

```typescript
import { generate } from '@pdfme/generator';
import { text } from '@pdfme/schemas';
import type { Template } from '@pdfme/common';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  const fontPath = path.join(__dirname, '../../assets/fonts/PTSerif/PTSerif-Regular.ttf');
  const fontData = new Uint8Array(fs.readFileSync(fontPath));

  const template: Template = {
    basePdf: { width: 297, height: 210, padding: [0, 0, 0, 0] },
    schemas: [[{
      name: 'studentName',
      type: 'text',
      position: { x: 80, y: 90 },
      width: 140,
      height: 20,
      fontSize: 24,
      alignment: 'center',
      fontColor: '#1a1a1a',
    }]],
  };

  const pdfBytes = await generate({
    template,
    inputs: [{ studentName: 'Тестовий Студент Іванович' }],
    options: { font: { PTSerif: { data: fontData, fallback: true } } },
    plugins: { text },
  });

  fs.writeFileSync(path.join(__dirname, 'poc_output.pdf'), pdfBytes);
  console.log('POC SUCCESS: poc_output.pdf created');
}

main().catch(e => { console.error('POC FAILED:', e); process.exit(1); });
```

### Шаг 0.3  проверить Designer в Angular

Создай временный компонент `diplomagen/frontend/src/app/features/editor/poc-designer/poc-designer.component.ts`:

```typescript
import { Component, ElementRef, ViewChild, AfterViewInit, OnDestroy } from '@angular/core';
import { Designer } from '@pdfme/ui';
import { text } from '@pdfme/schemas';

@Component({
  selector: 'app-poc-designer',
  standalone: true,
  template: `<div #container style="width:100%;height:600px;"></div>`,
})
export class PocDesignerComponent implements AfterViewInit, OnDestroy {
  @ViewChild('container') containerRef!: ElementRef<HTMLDivElement>;
  private designer?: Designer;

  ngAfterViewInit(): void {
    this.designer = new Designer({
      domContainer: this.containerRef.nativeElement,
      template: {
        basePdf: { width: 297, height: 210, padding: [0, 0, 0, 0] },
        schemas: [[{
          name: 'studentName',
          type: 'text',
          position: { x: 80, y: 90 },
          width: 140,
          height: 20,
          fontSize: 24,
          alignment: 'center',
        }]],
      },
      plugins: { text },
    });
    console.log('POC Designer initialized', this.designer);
  }

  ngOnDestroy(): void { this.designer?.destroy(); }
}
```

Временно зарегистрируй компонент на любом маршруте. Открой браузер  убедись что Designer отображается без ошибок в консоли.

### Шаг 0.4  удалить POC-файлы

После успешной проверки удали: `_poc_test.ts`, `poc_output.pdf`, `poc-designer/` и их регистрации в маршрутах.

---

## ФАЗА 1  Обновление Data Model

**Читай перед началом:** `shared/src/models/project.model.ts`, `shared/src/index.ts`, `shared/src/fonts.ts`  полностью.

### Шаг 1.1  полностью заменить содержимое `shared/src/models/project.model.ts`

```typescript
/**
 * project.model.ts
 * Shared data models used by both the Angular frontend and Cloud Functions backend.
 */

export interface Field {
  id: string;
  label: string;
  excelColumn: string | null;
  staticValue: string | null;
}

/**
 * One element of the pdfme schemas array.
 * Stored verbatim in Firestore and passed directly to @pdfme/generator and @pdfme/ui Designer.
 * Using Record<string, unknown> to avoid importing pdfme types into the shared package.
 */
export type PdfmeSchemaRecord = Record<string, unknown>;

export interface TemplateMetadata {
  storageUrl: string;
  mimeType: 'application/pdf' | 'image/jpeg' | 'image/png';
  widthPx: number;
  heightPx: number;
}

export interface Project {
  id: string;
  ownerId: string;
  name: string;
  createdAt: Date | string;
  updatedAt: Date | string;
  template: TemplateMetadata | null;
  excelColumns: string[];
  excelDataPath: string | null;
  totalRows: number | null;
  /** Longest string value found in each column (for pdfme Designer preview content) */
  columnMaxValues: Record<string, string> | null;
  fields: Field[];
  /**
   * pdfme schema array for the first (and only) page.
   * null means the editor has never been opened for this project.
   * Each element's `name` field equals a Field.id from the fields array above.
   */
  pdfmeSchemas: PdfmeSchemaRecord[] | null;
}

/** Lightweight version returned in project list */
export interface ProjectListItem {
  id: string;
  name: string;
  createdAt: Date | string;
  updatedAt: Date | string;
  template: Omit<TemplateMetadata, 'storageUrl'> | null;
}
```

### Шаг 1.2  обновить `shared/src/index.ts`

Убери все экспорты связанные с `FontFamily`, `TextAlign`, `FieldStyle`, `FieldPosition`, `FONT_REGISTRY`, `FontEntry` и файл `fonts.ts`.
Добавь экспорт нового типа: `export type { PdfmeSchemaRecord } from './models/project.model';`

### Шаг 1.3  обновить валидатор полей в `functions/src/routes/projects.router.ts`

Прочитай файл полностью. Выполни следующие изменения:

**Удалить** весь блок `FieldStyleSchema`.

**Заменить** `FieldSchema` на:
```typescript
const FieldSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1).max(100),
  excelColumn: z.string().nullable().optional(),
  staticValue: z.string().nullable().optional(),
});
```

**Заменить** `UpdateFieldsSchema` на:
```typescript
const UpdateFieldsSchema = z.object({
  fields: z.array(FieldSchema).max(20),
  pdfmeSchemas: z.array(z.record(z.unknown())).nullable().optional(),
});
```

**В обработчике `PATCH /:id/fields`** заменить строку `ref.update({ fields: ... })` на:
```typescript
await ref.update({
  fields: parsed.data.fields,
  pdfmeSchemas: parsed.data.pdfmeSchemas ?? null,
  updatedAt: Timestamp.now(),
});
```

**Убрать импорт** `FONT_KEYS` из `fonts.config`  он больше не используется в валидаторе.

### Шаг 1.4  добавить новый endpoint в `functions/src/routes/projects.router.ts`

Добавь маршрут после существующего `PATCH /:id/fields`:

```typescript
//  PATCH /projects/:id/pdfme-template 
const UpdatePdfmeSchemasSchema = z.object({
  pdfmeSchemas: z.array(z.record(z.unknown())),
});

projectsRouter.patch('/:id/pdfme-template', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { uid } = req as AuthedRequest;
    const parsed = UpdatePdfmeSchemasSchema.safeParse(req.body);
    if (!parsed.success) {
      return next(createError(422, parsed.error.message, 'VALIDATION_ERROR'));
    }

    const ref = projectRef(uid, req.params['id']);
    const snap = await ref.get();
    if (!snap.exists) return next(createError(404, 'Project not found.', 'NOT_FOUND'));

    await ref.update({ pdfmeSchemas: parsed.data.pdfmeSchemas, updatedAt: Timestamp.now() });

    const updated = await ref.get();
    res.json({ ...updated.data(), id: updated.id });
  } catch (err) {
    next(err);
  }
});
```

### Шаг 1.5  добавить метод в `frontend/src/app/features/projects/project.service.ts`

Прочитай файл полностью. Добавь метод в класс `ProjectService`:

```typescript
updatePdfmeTemplate(projectId: string, pdfmeSchemas: Record<string, unknown>[]): Observable<Project> {
  return this.api.patch<Project>(`/projects/${projectId}/pdfme-template`, { pdfmeSchemas })
    .pipe(map(normalizeDates));
}
```

### Шаг 1.6  проверить компиляцию

```
cd diplomagen/functions && npm run build
cd diplomagen/frontend && npx tsc --noEmit
cd diplomagen/shared && npx tsc --noEmit
```

Исправь все ошибки. Не переходи к следующей фазе пока есть ошибки компиляции.

---

## ФАЗА 2  Замена pdf-lib на @pdfme/generator (Backend)

**Читай перед началом:** `functions/src/services/pdf.service.ts`, `functions/src/fonts.config.ts`, `functions/src/routes/generate.router.ts`  полностью.

### Шаг 2.1  создать `functions/src/services/fonts.loader.ts`

**Важно:** перед созданием файла выполни `Get-ChildItem -Recurse diplomagen/functions/assets/fonts/ -Filter *.ttf` и включай только реально существующие файлы.

```typescript
/**
 * fonts.loader.ts
 * Loads font files from assets/fonts/ for use with @pdfme/generator.
 */
import * as fs from 'fs';
import * as path from 'path';
import type { Font } from '@pdfme/common';

const FONTS_DIR = path.join(__dirname, '..', '..', 'assets', 'fonts');

let cachedFonts: Font | null = null;

function readFontIfExists(relativePath: string): Uint8Array | null {
  const fullPath = path.join(FONTS_DIR, relativePath);
  if (!fs.existsSync(fullPath)) return null;
  return new Uint8Array(fs.readFileSync(fullPath));
}

export function loadFonts(): Font {
  if (cachedFonts) return cachedFonts;

  const fonts: Font = {};

  // PTSerif  основной шрифт с поддержкой кириллицы
  const ptSerifRegular = readFontIfExists('PTSerif/PTSerif-Regular.ttf');
  if (ptSerifRegular) fonts['PTSerif'] = { data: ptSerifRegular, fallback: true };

  const ptSerifBold = readFontIfExists('PTSerif/PTSerif-Bold.ttf');
  if (ptSerifBold) fonts['PTSerifBold'] = { data: ptSerifBold };

  const ptSerifItalic = readFontIfExists('PTSerif/PTSerif-Italic.ttf');
  if (ptSerifItalic) fonts['PTSerifItalic'] = { data: ptSerifItalic };

  const ptSerifBoldItalic = readFontIfExists('PTSerif/PTSerif-BoldItalic.ttf');
  if (ptSerifBoldItalic) fonts['PTSerifBoldItalic'] = { data: ptSerifBoldItalic };

  // Добавь остальные шрифты по тому же паттерну, проверяя реальные файлы в assets/fonts/
  // PTSans, Roboto, OpenSans, GreatVibes, TimesNewRoman  если файлы существуют

  cachedFonts = fonts;
  return cachedFonts;
}
```

### Шаг 2.2  создать `functions/src/services/template-to-pdf.ts`

```typescript
/**
 * template-to-pdf.ts
 * Wraps JPEG/PNG template buffers in a minimal PDF page so pdfme/generator
 * can use them as basePdf. PDF templates are passed through unchanged.
 */
import { PDFDocument } from 'pdf-lib';

export async function ensurePdfBuffer(
  buffer: Buffer,
  mimeType: 'application/pdf' | 'image/jpeg' | 'image/png',
  widthPx: number,
  heightPx: number,
): Promise<Uint8Array> {
  if (mimeType === 'application/pdf') {
    return new Uint8Array(buffer);
  }

  // 96 DPI assumed for raster images (same assumption as the template upload logic)
  const PX_TO_PT = 72 / 96;
  const widthPt  = widthPx  * PX_TO_PT;
  const heightPt = heightPx * PX_TO_PT;

  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([widthPt, heightPt]);

  const embeddedImage = mimeType === 'image/png'
    ? await pdfDoc.embedPng(buffer)
    : await pdfDoc.embedJpg(buffer);

  page.drawImage(embeddedImage, { x: 0, y: 0, width: widthPt, height: heightPt });

  return pdfDoc.save();
}
```

### Шаг 2.3  полностью заменить `functions/src/services/pdf.service.ts`

```typescript
/**
 * pdf.service.ts
 * Generates a single diploma PDF using @pdfme/generator.
 * No coordinate conversion  pdfme uses mm throughout (same as Designer).
 */
import { generate } from '@pdfme/generator';
import { text } from '@pdfme/schemas';
import type { Template } from '@pdfme/common';
import type { Field, PdfmeSchemaRecord } from '../../../../shared/src';
import { loadFonts } from './fonts.loader';
import { ensurePdfBuffer } from './template-to-pdf';

export interface TemplateInfo {
  mimeType: 'application/pdf' | 'image/jpeg' | 'image/png';
  widthPx: number;
  heightPx: number;
}

export async function generateDiplomaPdf(
  templateBuffer: Buffer,
  templateInfo: TemplateInfo,
  pdfmeSchemas: PdfmeSchemaRecord[],
  fields: Field[],
  rowData: Record<string, string>,
): Promise<Buffer> {
  const basePdf = await ensurePdfBuffer(
    templateBuffer,
    templateInfo.mimeType,
    templateInfo.widthPx,
    templateInfo.heightPx,
  );

  const template: Template = {
    basePdf,
    schemas: [pdfmeSchemas],
  };

  // Build inputs: schema.name == field.id  resolved value from rowData or staticValue
  const input: Record<string, string> = {};
  for (const field of fields) {
    const value = field.excelColumn
      ? String(rowData[field.excelColumn] ?? '')
      : (field.staticValue ?? '');
    input[field.id] = value;
  }

  const pdfBytes = await generate({
    template,
    inputs: [input],
    options: { font: loadFonts() },
    plugins: { text },
  });

  return Buffer.from(pdfBytes);
}
```

### Шаг 2.4  обновить `functions/src/routes/generate.router.ts`

Прочитай файл полностью. Внеси следующие изменения:

**1. Обнови импорты:**
```typescript
// Удали: import type { DiplomaField, TemplateInfo } from '../services/pdf.service';
// Замени на:
import { generateDiplomaPdf, type TemplateInfo } from '../services/pdf.service';
import type { Field, PdfmeSchemaRecord } from '../../../../shared/src';
```

**2. Обнови тип проекта** в `runGenerationJob`  добавь `pdfmeSchemas`:
```typescript
const project = projectSnap.data() as {
  name: string;
  template: (TemplateInfo & { storageUrl: string }) | null;
  fields: Field[];
  pdfmeSchemas: PdfmeSchemaRecord[] | null;
  excelDataPath: string | null;
  totalRows: number | null;
};
```

**3. Добавь проверку** после `if (!project.template)`:
```typescript
if (!project.pdfmeSchemas || project.pdfmeSchemas.length === 0) {
  throw new Error('No field layout found. Open the editor and place the fields first.');
}
```

**4. Замени вызов** `generateDiplomaPdf`:
```typescript
// Было:
const pdfBuffer = await generateDiplomaPdf(templateBuffer, project.template, project.fields, row);

// Стало:
const pdfBuffer = await generateDiplomaPdf(
  templateBuffer,
  project.template,
  project.pdfmeSchemas,
  project.fields,
  row,
);
```

### Шаг 2.5  проверить компиляцию backend

```
cd diplomagen/functions && npm run build
```

Исправь все ошибки.

---

## ФАЗА 3  Замена Fabric.js на pdfme Designer (Frontend)

**Читай перед началом:** `frontend/src/app/features/editor/editor-page/editor-page.component.ts`  полностью (все строки).

### Шаг 3.1  скопировать шрифтовые файлы в public/assets

Выполни:
```
New-Item -ItemType Directory -Force "diplomagen/frontend/public/assets/fonts"
```

Скопируй из `diplomagen/functions/assets/fonts/` все TTF файлы которые хочешь сделать доступными в браузере. Минимум: `PTSerif-Regular.ttf`, `PTSerif-Bold.ttf`.

### Шаг 3.2  создать `frontend/src/app/features/editor/editor-page/pdfme-fonts.loader.ts`

```typescript
/**
 * pdfme-fonts.loader.ts
 * Loads font files for @pdfme/ui Designer in the browser via fetch().
 * Font files must be placed in public/assets/fonts/.
 */
import type { Font } from '@pdfme/common';

async function fetchFont(url: string): Promise<ArrayBuffer> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to load font: ${url}`);
  return response.arrayBuffer();
}

export async function loadPdfmeFonts(): Promise<Font> {
  const [ptSerifData, ptSerifBoldData] = await Promise.all([
    fetchFont('/assets/fonts/PTSerif-Regular.ttf'),
    fetchFont('/assets/fonts/PTSerif-Bold.ttf'),
  ]);

  return {
    PTSerif: { data: ptSerifData, fallback: true },
    PTSerifBold: { data: ptSerifBoldData },
  };
}
```

Добавляй сюда только те шрифты, файлы которых реально скопированы в `public/assets/fonts/`.

### Шаг 3.3  полностью заменить `editor-page.component.ts`

Замени содержимое файла целиком:

```typescript
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
  private readonly zone       = inject(NgZone);

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
      const basePdf = await templateBlob.arrayBuffer();

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

      this.updateUnplacedFields(existingSchemas);

      this.designer.onChangeTemplate((t) => {
        const schemas = (t.schemas[0] ?? []) as Schema[];
        this.updateUnplacedFields(schemas);
        this.zone.run(() => this.saveSubject.next(schemas as PdfmeSchemaRecord[]));
      });

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
    };

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
```

---

## ФАЗА 4  Упрощение FieldsManager

**Читай перед началом:** `frontend/src/app/features/workspace/fields-manager/fields-manager.component.ts`  полностью.

### Шаг 4.1  заменить интерфейс `FieldDraft`

```typescript
// Было:
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

// Стало:
export interface FieldDraft {
  id: string;
  label: string;
  sourceType: 'excel' | 'static';
  excelColumn: string | null;
  staticValue: string | null;
}
```

### Шаг 4.2  заменить функции `draftFromField` и `fieldFromDraft`

```typescript
function draftFromField(field: Field): FieldDraft {
  return {
    id: field.id,
    label: field.label,
    sourceType: field.staticValue !== null ? 'static' : 'excel',
    excelColumn: field.excelColumn,
    staticValue: field.staticValue,
  };
}

function fieldFromDraft(draft: FieldDraft): Field {
  return {
    id: draft.id,
    label: draft.label,
    excelColumn: draft.sourceType === 'excel' ? (draft.excelColumn ?? null) : null,
    staticValue: draft.sourceType === 'static' ? (draft.staticValue ?? null) : null,
  };
}
```

### Шаг 4.3  удалить style-контролы из template

Из HTML-шаблона компонента убери полностью следующие элементы и всю их разметку:
- `mat-select` или dropdown для `fontFamily`
- `input` / `mat-input` для `fontSize`
- Color picker для `color`
- Toggle кнопки `bold` и `italic`
- `mat-button-toggle-group` для `align`

### Шаг 4.4  убрать неиспользуемые импорты

Удали из `fields-manager.component.ts`:
- `import type { FontFamily, TextAlign }`  эти типы удалены из shared
- `MatButtonToggleModule` если использовался только для align
- `MatSelectModule` если использовался только для fontFamily

### Шаг 4.5  проверить что `updateFields` не передаёт стили

Найди метод который вызывает `PATCH /projects/:id/fields`. Убедись что он передаёт только массив `fields` (без `pdfmeSchemas`). Схемы pdfme обновляются отдельно через `updatePdfmeTemplate`.

---

## ФАЗА 5  Очистка

### Шаг 5.1  удалить устаревшие файлы

Удали следующие файлы:
- `diplomagen/functions/src/fonts.config.ts`
- `diplomagen/shared/src/fonts.ts` (если на него не осталось импортов  проверь через grep)

### Шаг 5.2  убрать Fabric.js из frontend

```
cd diplomagen/frontend && npm uninstall fabric @types/fabric
```

Проверь есть ли другие файлы в проекте с `import ... from 'fabric'`. Если есть  исправь или удали.

Проверь используется ли `pdfjs-dist` где-либо ещё (`Select-String -Path "diplomagen/frontend/src/**" -Pattern "pdfjs"`).
Если нигде не используется  удали: `npm uninstall pdfjs-dist`.

### Шаг 5.3  убрать @pdf-lib/fontkit из functions

`pdf-lib` оставить (используется в `template-to-pdf.ts`). Удалить только fontkit:
```
cd diplomagen/functions && npm uninstall @pdf-lib/fontkit
```

### Шаг 5.4  финальная проверка компиляции всего монорепо

```
cd diplomagen/shared && npx tsc --noEmit
cd diplomagen/functions && npm run build
cd diplomagen/frontend && npx tsc --noEmit
```

### Шаг 5.5  E2E проверка

1. Запусти `./start-local.ps1` из `diplomagen/`
2. Войди в приложение, создай новый проект
3. Загрузи PNG или PDF шаблон
4. Загрузи Excel с кириллическими данными (минимум 1 строка, 1 колонка)
5. Определи поля в Workspace  убедись что style-контролов нет
6. Открой `/editor/:id`  убедись что pdfme Designer загружается с шаблоном как фоном
7. Добавь 2 поля через кнопки в toolbar. Перемести их.
8. Убедись что auto-save работает  появляется индикатор "Saved"
9. Закрой и снова открой редактор  поля должны быть на тех же позициях
10. Запусти генерацию дипломов
11. Скачай ZIP, открой первый PDF  убедись что текст стоит там где было в Designer
12. Убедись что кириллица отображается корректно

---

## Критичные правила для AI-агента

1. **Никогда не угадывай пути к файлам**  всегда читай реальную структуру директорий через `Get-ChildItem` перед созданием файлов
2. **Всегда читай файл полностью** перед любым его изменением
3. **После каждой фазы** проверяй компиляцию TypeScript перед переходом к следующей
4. **Шрифтовые файлы в `fonts.loader.ts`**  включай только те TTF, которые реально существуют на диске; несуществующие пути вызовут ошибку при старте функции
5. **Не трогай** без необходимости: структуру Firestore collections, auth middleware, signed URL логику, storage сервис, Excel-парсинг, ZIP-генерацию, job flow  они не меняются в этой миграции
6. **Существующие проекты** в Firestore имеют старый формат (`fields[].position`, `fields[].style`). Это нормально: при открытии в новом редакторе `pdfmeSchemas` будет `null`, Designer откроется пустым, пользователь расставит поля заново. Никакого migration script не требуется.
