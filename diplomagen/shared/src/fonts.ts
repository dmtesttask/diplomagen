/**
 * fonts.ts — Single source of truth for supported font families.
 *
 * HOW TO ADD A NEW FONT
 * ─────────────────────
 * 1. Add one entry to FONT_REGISTRY below (this file).
 * 2. Add the matching entry to  functions/src/fonts.config.ts  (TTF file paths).
 * 3. Copy four TTF files into  functions/assets/fonts/<key>/
 *    (Regular, Bold, Italic, BoldItalic — or duplicate Regular if a variant is missing).
 *
 * That's it. The TypeScript types, Zod validation, font-picker options
 * and browser font loading all derive automatically from these two registries.
 */

export interface FontEntry {
  /** Key stored in Firestore and used by the PDF service */
  readonly key: string;
  /** Label shown in the font picker UI */
  readonly label: string;
  /** CSS font-family value for browser rendering */
  readonly cssName: string;
  /**
   * Google Fonts URL query fragment (everything after `family=`).
   * Set to null for system fonts that don't need to be loaded from Google.
   */
  readonly googleFontsQuery: string | null;
}

export const FONT_REGISTRY = [
  {
    key:              'PTSerif',
    label:            'PT Serif',
    cssName:          'PT Serif',
    googleFontsQuery: 'PT+Serif:ital,wght@0,400;0,700;1,400;1,700',
  },
  {
    key:              'PTSans',
    label:            'PT Sans',
    cssName:          'PT Sans',
    googleFontsQuery: 'PT+Sans:ital,wght@0,400;0,700;1,400;1,700',
  },
  {
    key:              'Roboto',
    label:            'Roboto',
    cssName:          'Roboto',
    googleFontsQuery: 'Roboto:ital,wght@0,400;0,500;0,700;1,400',
  },
  {
    key:              'OpenSans',
    label:            'Open Sans',
    cssName:          'Open Sans',
    googleFontsQuery: 'Open+Sans:ital,wght@0,400;0,600;0,700;1,400',
  },
  {
    key:              'TimesNewRoman',
    label:            'Times New Roman',
    cssName:          'Times New Roman',
    googleFontsQuery: null,
  },
    {
    key:              'GreatVibes',
    label:            'Great Vibes',
    cssName:          'Great Vibes',
    googleFontsQuery: 'Great+Vibes:ital,wght@0,400;0,700;1,400;1,700',
  },
] as const satisfies ReadonlyArray<FontEntry>;

/** Union type of all supported font family keys. */
export type FontFamily = (typeof FONT_REGISTRY)[number]['key'];
