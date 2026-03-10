/**
 * fonts.config.ts — Backend font registry: TTF file paths for PDF generation.
 *
 * HOW TO ADD A NEW FONT
 * ─────────────────────
 * 1. Add one entry to  shared/src/fonts.ts  (key, label, cssName, googleFontsQuery).
 * 2. Add the matching entry here with the four file paths.
 * 3. Copy the TTF files to  functions/assets/fonts/<key>/
 *    (Regular, Bold, Italic, BoldItalic — duplicate Regular if a variant is missing).
 *
 * The FontFamilyKey type and Zod validation enum are derived automatically
 * from the keys of FONT_FILE_MAP — you do not need to update them manually.
 */

export const FONT_FILE_MAP = {
  PTSerif: {
    base:       'PTSerif/PTSerif-Regular.ttf',
    bold:       'PTSerif/PTSerif-Bold.ttf',
    italic:     'PTSerif/PTSerif-Italic.ttf',
    boldItalic: 'PTSerif/PTSerif-BoldItalic.ttf',
  },
  PTSans: {
    base:       'PTSans/PTSans-Regular.ttf',
    bold:       'PTSans/PTSans-Bold.ttf',
    italic:     'PTSans/PTSans-Italic.ttf',
    boldItalic: 'PTSans/PTSans-BoldItalic.ttf',
  },
  Roboto: {
    base:       'Roboto/Roboto-Regular.ttf',
    bold:       'Roboto/Roboto-Bold.ttf',
    italic:     'Roboto/Roboto-Italic.ttf',
    boldItalic: 'Roboto/Roboto-BoldItalic.ttf',
  },
  OpenSans: {
    base:       'OpenSans/OpenSans-Regular.ttf',
    bold:       'OpenSans/OpenSans-Bold.ttf',
    italic:     'OpenSans/OpenSans-Italic.ttf',
    boldItalic: 'OpenSans/OpenSans-BoldItalic.ttf',
  },
  TimesNewRoman: {
    base:       'TimesNewRoman/times.ttf',
    bold:       'TimesNewRoman/timesbd.ttf',
    italic:     'TimesNewRoman/timesi.ttf',
    boldItalic: 'TimesNewRoman/timesbi.ttf',
  },
    GreatVibes: {
    base:       'GreatVibes/GreatVibes-Regular.ttf',
    bold:       'GreatVibes/GreatVibes-Bold.ttf',
    italic:     'GreatVibes/GreatVibes-Italic.ttf',
    boldItalic: 'GreatVibes/GreatVibes-BoldItalic.ttf',
  },
} as const;

/** Union type of all font family keys — derived from FONT_FILE_MAP. */
export type FontFamilyKey = keyof typeof FONT_FILE_MAP;

/** Non-empty tuple of all font keys, ready for use with z.enum(FONT_KEYS). */
export const FONT_KEYS = Object.keys(FONT_FILE_MAP) as [FontFamilyKey, ...FontFamilyKey[]];
