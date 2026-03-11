/**
 * pdf.service.ts
 * Generates a single diploma PDF using @pdfme/generator.
 * No coordinate conversion — pdfme uses mm throughout (same as Designer).
 */
import { generate } from '@pdfme/generator';
import { text } from '@pdfme/schemas';
import type { Template, Schema } from '@pdfme/common';
import { loadFonts } from './fonts.loader';
import { ensurePdfBuffer } from './template-to-pdf';

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
    basePdf: basePdf as Uint8Array<ArrayBuffer>,
    schemas: [pdfmeSchemas as Schema[]],
  };

  // Build inputs: schema.name == field.id → resolved value from rowData or staticValue
  // NEW — build a lookup of schema content by schema name for static fields
  const schemaContentMap: Record<string, string> = {};
  for (const schema of pdfmeSchemas) {
    const name = (schema as Record<string, unknown>)['name'] as string | undefined;
    const content = (schema as Record<string, unknown>)['content'] as string | undefined;
    if (name !== undefined && content !== undefined) {
      schemaContentMap[name] = content;
    }
  }

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