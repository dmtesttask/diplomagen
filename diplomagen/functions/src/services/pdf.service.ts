/**
 * pdf.service.ts
 * Generates a single diploma PDF using @pdfme/generator.
 * No coordinate conversion — pdfme uses mm throughout (same as Designer).
 */
import { generate } from '@pdfme/generator';
import { text } from '@pdfme/schemas';
import type { Template, Schema } from '@pdfme/common';
import { loadFonts } from './fonts.loader';

export interface Field {
  id: string;
  label: string;
  excelColumn: string | null;
  staticValue: string | null;
}

export type PdfmeSchemaRecord = Record<string, unknown>;

export interface TemplateInfo {
  mimeType: 'application/pdf' | 'image/jpeg' | 'image/png';
  widthPx: number;
  heightPx: number;
}

/**
 * Pre-computes a map of schema name → content from the stored pdfme schemas.
 * Call this ONCE before processing multiple rows to avoid redundant iteration.
 */
export function buildSchemaContentMap(pdfmeSchemas: PdfmeSchemaRecord[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const schema of pdfmeSchemas) {
    const name = (schema as Record<string, unknown>)['name'] as string | undefined;
    const content = (schema as Record<string, unknown>)['content'] as string | undefined;
    if (name !== undefined && content !== undefined) {
      map[name] = content;
    }
  }
  return map;
}

/**
 * Generates a single diploma PDF.
 * @param basePdf  Already-converted PDF bytes (call ensurePdfBuffer once before the loop).
 * @param schemaContentMap  Pre-built map from buildSchemaContentMap (call once before the loop).
 */
export async function generateDiplomaPdf(
  basePdf: Uint8Array<ArrayBuffer>,
  pdfmeSchemas: PdfmeSchemaRecord[],
  fields: Field[],
  rowData: Record<string, string>,
  schemaContentMap: Record<string, string>,
): Promise<Buffer> {
  const template: Template = {
    basePdf,
    schemas: [pdfmeSchemas as Schema[]],
  };

  const input: Record<string, string> = {};
  for (const field of fields) {
    if (field.excelColumn) {
      input[field.id] = String(rowData[field.excelColumn] ?? '');
    } else {
      // Prefer the content the user typed in the Designer over the stored staticValue
      input[field.id] = schemaContentMap[field.id] ?? field.staticValue ?? '';
    }
  }

  const pdfBytes = await generate({
    template,
    inputs: [input],
    options: { font: loadFonts() },
    plugins: { text },
  });

  return Buffer.from(pdfBytes);
}