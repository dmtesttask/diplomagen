import { Component, Input, Output, EventEmitter } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-empty-state',
  standalone: true,
  imports: [MatIconModule, MatButtonModule],
  template: `
    <div class="empty-state">
      <div class="icon-container">
        <mat-icon class="empty-icon">{{ icon }}</mat-icon>
      </div>
      <h3 class="empty-title">{{ title }}</h3>
      <p class="empty-description">{{ description }}</p>
      @if (actionLabel) {
        <button mat-raised-button color="primary" (click)="actionClick.emit()">
          {{ actionLabel }}
        </button>
      }
    </div>
  `,
  styles: [`
    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      padding: 80px 40px;
      gap: 16px;
    }

    .icon-container {
      width: 80px;
      height: 80px;
      border-radius: 20px;
      background: var(--mat-sys-surface-container-high);
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 8px;
    }

    .empty-icon {
      font-size: 40px;
      width: 40px;
      height: 40px;
      color: var(--mat-sys-on-surface-variant);
      opacity: 0.5;
    }

    .empty-title {
      margin: 0;
      font-size: 1.25rem;
      font-weight: 600;
    }

    .empty-description {
      margin: 0;
      font-size: 0.9375rem;
      color: var(--mat-sys-on-surface-variant);
      max-width: 480px;
      line-height: 1.6;
    }
  `],
})
export class EmptyStateComponent {
  @Input({ required: true }) icon!: string;
  @Input({ required: true }) title!: string;
  @Input({ required: true }) description!: string;
  @Input() actionLabel?: string;
  @Output() actionClick = new EventEmitter<void>();
}
