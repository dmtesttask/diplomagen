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
