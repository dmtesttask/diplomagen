import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AuthService } from '../../../core/auth/auth.service';

@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [MatButtonModule, MatIconModule, MatProgressSpinnerModule],
  template: `
    <div class="login-wrapper">
      <!-- Background gradient blobs -->
      <div class="blob blob-1"></div>
      <div class="blob blob-2"></div>
      <div class="blob blob-3"></div>

      <div class="login-card">
        <!-- Logo -->
        <div class="logo-section">
          <div class="logo-icon">
            <mat-icon>workspace_premium</mat-icon>
          </div>
          <h1 class="app-title">DiplomaGen</h1>
          <p class="app-tagline">Bulk diploma generation for conference organizers</p>
        </div>

        <!-- Features list -->
        <ul class="features-list">
          @for (feature of features; track feature.text) {
            <li class="feature-item">
              <mat-icon class="feature-icon">{{ feature.icon }}</mat-icon>
              <span>{{ feature.text }}</span>
            </li>
          }
        </ul>

        <!-- Sign in button -->
        <div class="action-section">
          <button
            mat-raised-button
            class="sign-in-btn"
            (click)="signIn()"
            [disabled]="isLoading()"
            aria-label="Sign in with Google"
          >
            @if (isLoading()) {
              <mat-spinner diameter="20" />
            } @else {
              <svg class="google-icon" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Sign in with Google
            }
          </button>

          @if (errorMessage()) {
            <p class="error-message" role="alert">{{ errorMessage() }}</p>
          }

          <p class="terms">
            By signing in, you agree to our Terms of Service.
            Your data is protected by Google OAuth.
          </p>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .login-wrapper {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
      overflow: hidden;
      background: var(--mat-sys-surface);
      padding: 24px;
    }

    /* Animated background blobs */
    .blob {
      position: absolute;
      border-radius: 50%;
      filter: blur(80px);
      opacity: 0.15;
      animation: float 8s ease-in-out infinite;
    }

    .blob-1 {
      width: 500px;
      height: 500px;
      background: var(--mat-sys-primary);
      top: -100px;
      left: -100px;
      animation-delay: 0s;
    }

    .blob-2 {
      width: 400px;
      height: 400px;
      background: var(--mat-sys-tertiary);
      bottom: -80px;
      right: -80px;
      animation-delay: 3s;
    }

    .blob-3 {
      width: 300px;
      height: 300px;
      background: var(--mat-sys-secondary);
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      animation-delay: 5s;
    }

    @keyframes float {
      0%, 100% { transform: translate(0, 0) scale(1); }
      33% { transform: translate(20px, -20px) scale(1.05); }
      66% { transform: translate(-15px, 15px) scale(0.95); }
    }

    .blob-3 {
      animation-name: float3;
    }

    @keyframes float3 {
      0%, 100% { transform: translate(-50%, -50%) scale(1); }
      50% { transform: translate(-48%, -52%) scale(1.1); }
    }

    /* Card */
    .login-card {
      position: relative;
      width: 100%;
      max-width: 440px;
      background: var(--mat-sys-surface-container-low);
      border: 1px solid var(--mat-sys-outline-variant);
      border-radius: 24px;
      padding: 48px 40px;
      box-shadow: 0 8px 40px rgba(0, 0, 0, 0.15);
      backdrop-filter: blur(20px);
      display: flex;
      flex-direction: column;
      gap: 32px;
    }

    /* Logo */
    .logo-section {
      text-align: center;
    }

    .logo-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 72px;
      height: 72px;
      background: var(--mat-sys-primary-container);
      border-radius: 20px;
      margin-bottom: 16px;

      mat-icon {
        font-size: 36px;
        width: 36px;
        height: 36px;
        color: var(--mat-sys-on-primary-container);
      }
    }

    .app-title {
      margin: 0 0 8px;
      font-size: 2rem;
      font-weight: 700;
      letter-spacing: -0.03em;
      color: var(--mat-sys-on-surface);
    }

    .app-tagline {
      margin: 0;
      font-size: 0.9375rem;
      color: var(--mat-sys-on-surface-variant);
      line-height: 1.5;
    }

    /* Features */
    .features-list {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .feature-item {
      display: flex;
      align-items: center;
      gap: 12px;
      font-size: 0.875rem;
      color: var(--mat-sys-on-surface-variant);
    }

    .feature-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
      color: var(--mat-sys-primary);
      flex-shrink: 0;
    }

    /* Action */
    .action-section {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .sign-in-btn {
      width: 100%;
      height: 52px;
      font-size: 1rem;
      font-weight: 600;
      border-radius: 12px !important;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      background: var(--mat-sys-primary) !important;
      color: var(--mat-sys-on-primary) !important;
      transition: opacity 0.2s, transform 0.1s;

      &:hover:not([disabled]) {
        opacity: 0.9;
        transform: translateY(-1px);
      }

      &:active:not([disabled]) {
        transform: translateY(0);
      }
    }

    .google-icon {
      width: 20px;
      height: 20px;
      flex-shrink: 0;
    }

    .error-message {
      margin: 0;
      font-size: 0.875rem;
      color: var(--mat-sys-error);
      text-align: center;
    }

    .terms {
      margin: 0;
      font-size: 0.75rem;
      color: var(--mat-sys-on-surface-variant);
      text-align: center;
      line-height: 1.5;
    }
  `],
})
export class LoginPageComponent {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);

  readonly isLoading = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly features = [
    { icon: 'upload_file', text: 'Upload Excel participant lists instantly' },
    { icon: 'design_services', text: 'Visual drag-and-drop diploma editor' },
    { icon: 'picture_as_pdf', text: 'Generate personalized PDFs in bulk' },
    { icon: 'folder_zip', text: 'Download all diplomas as a single ZIP' },
  ];

  async signIn(): Promise<void> {
    if (this.isLoading()) return;

    this.isLoading.set(true);
    this.errorMessage.set(null);

    try {
      await this.authService.signInWithGoogle();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sign-in failed. Please try again.';
      this.errorMessage.set(message);
      this.snackBar.open('Failed to sign in. Please try again.', 'Dismiss', {
        duration: 5000,
        panelClass: ['snackbar-error'],
      });
    } finally {
      this.isLoading.set(false);
    }
  }
}
