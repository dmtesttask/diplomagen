/**
 * pdf.service.ts
 * Core diploma generation logic.
 * Produces a single PDF buffer for one participant row by overlaying
 * styled text fields onto a template (PDF or JPEG/PNG).
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  PDFDocument,
  PDFFont,
  rgb,
  StandardFonts,
  type PDFPage,
} from 'pdf-lib';
import * as fontkit from '@pdf-lib/fontkit';
import { FONT_FILE_MAP, type FontFamilyKey } from '../fonts.config';

export type { FontFamilyKey };

export interface FieldStyle {
  fontFamily: FontFamilyKey;
  fontSize: number; // CSS pixels in the editor; we scale to PDF points
  color: string;    // hex, e.g. '#1a1a1a'
  bold: boolean;
  italic: boolean;
  align: 'left' | 'center' | 'right';
}

export interface FieldPosition {
  x: number; // template pixels from left
  y: number; // template pixels from top
}

export interface DiplomaField {
  id: string;
  label: string;
  excelColumn: string | null;
  staticValue: string | null;
  position: FieldPosition | null;
  style: FieldStyle;
}

export interface TemplateInfo {
  mimeType: 'application/pdf' | 'image/jpeg' | 'image/png';
  widthPx: number;
  heightPx: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

/** Scale factor: template pixels → PDF points (assuming 96 DPI screen) */
const PX_TO_PT = 72 / 96; // 0.75

/** Path to bundled font assets (relative from compiled dist/services/) */
const FONTS_DIR = path.join(__dirname, '..', '..', 'assets', 'fonts');

// ─── Font cache ───────────────────────────────────────────────────────────────

const fontBytesCache = new Map<string, Uint8Array>();

/**
 * Returns the font file bytes. Falls back to null if the file does not exist
 * so the caller can substitute a standard PDF font.
 */
function getFontBytes(
  family: FontFamilyKey,
  bold: boolean,
  italic: boolean,
): Uint8Array | null {
  const cacheKey = `${family}-${bold ? 'B' : ''}${italic ? 'I' : ''}`;
  if (fontBytesCache.has(cacheKey)) return fontBytesCache.get(cacheKey)!;

  const fontPath = resolveFontPath(family, bold, italic);
  if (!fontPath || !fs.existsSync(fontPath)) return null;

  const bytes = new Uint8Array(fs.readFileSync(fontPath));
  fontBytesCache.set(cacheKey, bytes);
  return bytes;
}

function resolveFontPath(
  family: FontFamilyKey,
  bold: boolean,
  italic: boolean,
): string | null {
  const variants = FONT_FILE_MAP[family];
  if (!variants) return null;

  const variant = bold && italic ? 'boldItalic'
    : bold                       ? 'bold'
    : italic                     ? 'italic'
    :                              'base';

  return path.join(FONTS_DIR, variants[variant]);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Parse a CSS hex color string to pdf-lib rgb values (0–1 range). */
function hexToRgb(hex: string): ReturnType<typeof rgb> {
  const clean = hex.replace('#', '');
  const expanded =
    clean.length === 3
      ? clean.split('').map((c) => c + c).join('')
      : clean;
  const r = parseInt(expanded.slice(0, 2), 16) / 255;
  const g = parseInt(expanded.slice(2, 4), 16) / 255;
  const b = parseInt(expanded.slice(4, 6), 16) / 255;
  return rgb(
    isNaN(r) ? 0 : r,
    isNaN(g) ? 0 : g,
    isNaN(b) ? 0 : b,
  );
}

/**
 * Embed the correct custom font into the pdfDoc, or fall back to a
 * built-in standard font that pdf-lib ships with (Latin-only).
 */
async function embedFont(
  pdfDoc: PDFDocument,
  style: FieldStyle,
): Promise<PDFFont> {
  const bytes = getFontBytes(style.fontFamily, style.bold, style.italic);
  if (bytes) {
    // subset: true — embed only the glyphs actually used; keeps output PDF small
    return pdfDoc.embedFont(bytes, { subset: true });
  }
  // Fallback: choose the closest standard font
  if (style.fontFamily === 'TimesNewRoman') {
    if (style.bold && style.italic) return pdfDoc.embedFont(StandardFonts.TimesRomanBoldItalic);
    if (style.bold)                  return pdfDoc.embedFont(StandardFonts.TimesRomanBold);
    if (style.italic)                return pdfDoc.embedFont(StandardFonts.TimesRomanItalic);
    return pdfDoc.embedFont(StandardFonts.TimesRoman);
  }
  if (style.bold && style.italic) return pdfDoc.embedFont(StandardFonts.HelveticaBoldOblique);
  if (style.bold)                  return pdfDoc.embedFont(StandardFonts.HelveticaBold);
  if (style.italic)                return pdfDoc.embedFont(StandardFonts.HelveticaOblique);
  return pdfDoc.embedFont(StandardFonts.Helvetica);
}

/** Draw a text field onto a PDF page. */
async function drawField(
  pdfDoc: PDFDocument,
  page: PDFPage,
  field: DiplomaField,
  value: string,
  pageHeightPts: number,
): Promise<void> {
  const font = await embedFont(pdfDoc, field.style);
  const sizePts = field.style.fontSize * PX_TO_PT;
  const color = hexToRgb(field.style.color);

  const xPts = (field.position!.x) * PX_TO_PT;
  // Convert top-left editor y → PDF baseline y (bottom-left origin)
  const yPts = pageHeightPts - (field.position!.y + field.style.fontSize) * PX_TO_PT;

  // Horizontal alignment offset
  let drawX = xPts;
  if (field.style.align === 'center') {
    const textWidth = font.widthOfTextAtSize(value, sizePts);
    drawX = xPts - textWidth / 2;
  } else if (field.style.align === 'right') {
    const textWidth = font.widthOfTextAtSize(value, sizePts);
    drawX = xPts - textWidth;
  }

  page.drawText(value, {
    x: drawX,
    y: yPts,
    size: sizePts,
    font,
    color,
  });
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Generates a single PDF diploma by combining a template with the text fields
 * populated from one Excel data row.
 *
 * @param templateBuffer  Raw bytes of the template file (PDF / JPEG / PNG).
 * @param template        Metadata describing the template dimensions and type.
 * @param fields          Configured fields with positions and styles.
 * @param rowData         Key-value map for one Excel row (column name → value).
 * @returns               PDF bytes as a Buffer.
 */
export async function generateDiplomaPdf(
  templateBuffer: Buffer,
  template: TemplateInfo,
  fields: DiplomaField[],
  rowData: Record<string, string>,
): Promise<Buffer> {
  const pageWidthPts  = template.widthPx  * PX_TO_PT;
  const pageHeightPts = template.heightPx * PX_TO_PT;

  let pdfDoc: PDFDocument;
  let page: PDFPage;

  if (template.mimeType === 'application/pdf') {
    // Load original PDF and use its first page
    pdfDoc = await PDFDocument.load(templateBuffer);
    pdfDoc.registerFontkit(fontkit);
    page = pdfDoc.getPage(0);
  } else {
    // JPEG / PNG → embed as background image on a new page
    pdfDoc = await PDFDocument.create();
    pdfDoc.registerFontkit(fontkit);
    page = pdfDoc.addPage([pageWidthPts, pageHeightPts]);

    const embeddedImage =
      template.mimeType === 'image/png'
        ? await pdfDoc.embedPng(templateBuffer)
        : await pdfDoc.embedJpg(templateBuffer);

    page.drawImage(embeddedImage, {
      x: 0,
      y: 0,
      width:  pageWidthPts,
      height: pageHeightPts,
    });
  }

  // Draw each field that has a position
  const placedFields = fields.filter((f) => f.position !== null);

  for (const field of placedFields) {
    // Resolve value from row data or static override
    const rawValue: string =
      field.excelColumn && Object.prototype.hasOwnProperty.call(rowData, field.excelColumn)
        ? String(rowData[field.excelColumn] ?? '')
        : (field.staticValue ?? '');

    // Skip empty values as per the spec
    if (!rawValue.trim()) continue;

    await drawField(pdfDoc, page, field, rawValue, pageHeightPts);
  }

  return Buffer.from(await pdfDoc.save());
}
