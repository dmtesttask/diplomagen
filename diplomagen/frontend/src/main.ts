import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';
import { FONT_REGISTRY } from '../../shared/src';

/**
 * Dynamically inject a Google Fonts <link> for all editor fonts that are
 * listed in the shared FONT_REGISTRY.  When a new font is added to the
 * registry its Google Fonts stylesheet is loaded automatically here.
 */
function loadEditorFonts(): void {
  const queries = (FONT_REGISTRY as readonly { googleFontsQuery: string | null }[])
    .filter((f): f is { googleFontsQuery: string } => f.googleFontsQuery !== null)
    .map(f => `family=${f.googleFontsQuery}`)
    .join('&');

  if (!queries) return;

  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?${queries}&display=swap`;
  document.head.appendChild(link);
}

loadEditorFonts();

bootstrapApplication(App, appConfig)
  .catch((err) => console.error(err));
