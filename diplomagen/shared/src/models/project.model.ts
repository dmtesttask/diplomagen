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
