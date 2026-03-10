/**
 * fonts.loader.ts
 * Loads font files from assets/fonts/ for use with @pdfme/generator.
 */
import * as fs from 'fs';
import * as path from 'path';
import type { Font } from '@pdfme/common';

const FONTS_DIR = path.join(__dirname, '..', '..', 'assets', 'fonts');

let cachedFonts: Font | null = null;

function readFontIfExists(relativePath: string): Buffer | null {
  const fullPath = path.join(FONTS_DIR, relativePath);
  if (!fs.existsSync(fullPath)) return null;
  return fs.readFileSync(fullPath);
}

export function loadFonts(): Font {
  if (cachedFonts) return cachedFonts;

  // Use a looser local type — Buffer is Uint8Array subclass, pdfme accepts it at runtime
  const fonts: Record<string, { data: Buffer; fallback?: boolean }> = {};

  // PTSerif — основной шрифт с поддержкой кириллицы
  const ptSerifRegular = readFontIfExists('PTSerif/PTSerif-Regular.ttf');
  if (ptSerifRegular) fonts['PTSerif'] = { data: ptSerifRegular, fallback: true };

  const ptSerifBold = readFontIfExists('PTSerif/PTSerif-Bold.ttf');
  if (ptSerifBold) fonts['PTSerifBold'] = { data: ptSerifBold };

  const ptSerifItalic = readFontIfExists('PTSerif/PTSerif-Italic.ttf');
  if (ptSerifItalic) fonts['PTSerifItalic'] = { data: ptSerifItalic };

  const ptSerifBoldItalic = readFontIfExists('PTSerif/PTSerif-BoldItalic.ttf');
  if (ptSerifBoldItalic) fonts['PTSerifBoldItalic'] = { data: ptSerifBoldItalic };

  // PTSans
  const ptSansRegular = readFontIfExists('PTSans/PTSans-Regular.ttf');
  if (ptSansRegular) fonts['PTSans'] = { data: ptSansRegular };

  const ptSansBold = readFontIfExists('PTSans/PTSans-Bold.ttf');
  if (ptSansBold) fonts['PTSansBold'] = { data: ptSansBold };

  const ptSansItalic = readFontIfExists('PTSans/PTSans-Italic.ttf');
  if (ptSansItalic) fonts['PTSansItalic'] = { data: ptSansItalic };

  const ptSansBoldItalic = readFontIfExists('PTSans/PTSans-BoldItalic.ttf');
  if (ptSansBoldItalic) fonts['PTSansBoldItalic'] = { data: ptSansBoldItalic };

  // Roboto
  const robotoRegular = readFontIfExists('Roboto/Roboto-Regular.ttf');
  if (robotoRegular) fonts['Roboto'] = { data: robotoRegular };

  const robotoBold = readFontIfExists('Roboto/Roboto-Bold.ttf');
  if (robotoBold) fonts['RobotoBold'] = { data: robotoBold };

  const robotoItalic = readFontIfExists('Roboto/Roboto-Italic.ttf');
  if (robotoItalic) fonts['RobotoItalic'] = { data: robotoItalic };

  const robotoBoldItalic = readFontIfExists('Roboto/Roboto-BoldItalic.ttf');
  if (robotoBoldItalic) fonts['RobotoBoldItalic'] = { data: robotoBoldItalic };

  // OpenSans
  const openSansRegular = readFontIfExists('OpenSans/OpenSans-Regular.ttf');
  if (openSansRegular) fonts['OpenSans'] = { data: openSansRegular };

  const openSansBold = readFontIfExists('OpenSans/OpenSans-Bold.ttf');
  if (openSansBold) fonts['OpenSansBold'] = { data: openSansBold };

  const openSansItalic = readFontIfExists('OpenSans/OpenSans-Italic.ttf');
  if (openSansItalic) fonts['OpenSansItalic'] = { data: openSansItalic };

  const openSansBoldItalic = readFontIfExists('OpenSans/OpenSans-BoldItalic.ttf');
  if (openSansBoldItalic) fonts['OpenSansBoldItalic'] = { data: openSansBoldItalic };

  // GreatVibes
  const greatVibesRegular = readFontIfExists('GreatVibes/GreatVibes-Regular.ttf');
  if (greatVibesRegular) fonts['GreatVibes'] = { data: greatVibesRegular };

  // TimesNewRoman
  const timesRegular = readFontIfExists('TimesNewRoman/times.ttf');
  if (timesRegular) fonts['TimesNewRoman'] = { data: timesRegular };

  const timesBold = readFontIfExists('TimesNewRoman/timesbd.ttf');
  if (timesBold) fonts['TimesNewRomanBold'] = { data: timesBold };

  const timesItalic = readFontIfExists('TimesNewRoman/timesi.ttf');
  if (timesItalic) fonts['TimesNewRomanItalic'] = { data: timesItalic };

  const timesBoldItalic = readFontIfExists('TimesNewRoman/timesbi.ttf');
  if (timesBoldItalic) fonts['TimesNewRomanBoldItalic'] = { data: timesBoldItalic };

  cachedFonts = fonts as unknown as Font;
  return cachedFonts;
}
