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
  const [
    ptSerifData,
    ptSerifBoldData,
    ptSerifItalicData,
    ptSerifBoldItalicData,
    ptSansData,
    robotoData,
    openSansData,
    greatVibesData,
  ] = await Promise.all([
    fetchFont('/assets/fonts/PTSerif-Regular.ttf'),
    fetchFont('/assets/fonts/PTSerif-Bold.ttf'),
    fetchFont('/assets/fonts/PTSerif-Italic.ttf'),
    fetchFont('/assets/fonts/PTSerif-BoldItalic.ttf'),
    fetchFont('/assets/fonts/PTSans-Regular.ttf'),
    fetchFont('/assets/fonts/Roboto-Regular.ttf'),
    fetchFont('/assets/fonts/OpenSans-Regular.ttf'),
    fetchFont('/assets/fonts/GreatVibes-Regular.ttf'),
  ]);

  return {
    PTSerif:          { data: ptSerifData,          fallback: true },
    PTSerifBold:      { data: ptSerifBoldData },
    PTSerifItalic:    { data: ptSerifItalicData },
    PTSerifBoldItalic:{ data: ptSerifBoldItalicData },
    PTSans:           { data: ptSansData },
    Roboto:           { data: robotoData },
    OpenSans:         { data: openSansData },
    GreatVibes:       { data: greatVibesData },
  };
}
