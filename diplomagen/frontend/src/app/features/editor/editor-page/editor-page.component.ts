import { Component } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-editor-page',
  standalone: true,
  imports: [MatIconModule],
  template: `
    <div class="page-container">
      <div class="coming-soon">
        <mat-icon>design_services</mat-icon>
        <h2>Canvas Editor</h2>
        <p>The visual field placement editor with Fabric.js is coming in Epic 6.</p>
      </div>
    </div>
  `,
  styles: [`
    .coming-soon {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 16px;
      padding: 80px;
      text-align: center;

      mat-icon {
        font-size: 56px;
        width: 56px;
        height: 56px;
        color: var(--mat-sys-primary);
        opacity: 0.5;
      }

      h2 { margin: 0; }
      p { margin: 0; color: var(--mat-sys-on-surface-variant); }
    }
  `],
})
export class EditorPageComponent {}
