import { Injectable, inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';

export type ThemeMode = 'light' | 'dark' | 'system';

@Injectable({
  providedIn: 'root',
})
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly storageKey = 'diplomagen-theme';

  private _mode: ThemeMode = 'system';

  get currentMode(): ThemeMode {
    return this._mode;
  }

  get isDark(): boolean {
    if (this._mode === 'dark') return true;
    if (this._mode === 'light') return false;
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  /** Initialize theme from localStorage on app startup */
  init(): void {
    const saved = localStorage.getItem(this.storageKey) as ThemeMode | null;
    this.setMode(saved ?? 'system');
  }

  setMode(mode: ThemeMode): void {
    this._mode = mode;
    localStorage.setItem(this.storageKey, mode);

    const html = this.document.documentElement;
    html.classList.remove('dark-mode', 'light-mode');

    if (mode === 'dark') {
      html.classList.add('dark-mode');
    } else if (mode === 'light') {
      html.classList.add('light-mode');
    }
    // 'system' = no class, CSS media query handles it
  }

  toggle(): void {
    this.setMode(this.isDark ? 'light' : 'dark');
  }
}
