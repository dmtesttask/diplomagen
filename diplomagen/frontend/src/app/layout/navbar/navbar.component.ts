import { Component, OnDestroy, inject, signal, computed } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AsyncPipe } from '@angular/common';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatChipsModule } from '@angular/material/chips';

import { Firestore, doc, docData } from '@angular/fire/firestore';
import { Auth } from '@angular/fire/auth';
import { user } from '@angular/fire/auth';
import { Subject, switchMap, of, takeUntil } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { ThemeService } from '../../core/auth/theme.service';
import type { User } from '../../../../../shared/src';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [
    AsyncPipe,
    RouterLink,
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatDividerModule,
    MatTooltipModule,
    MatChipsModule,
  ],
  template: `
    <mat-toolbar class="navbar">
      <!-- Logo & Brand -->
      <a routerLink="/projects" class="brand">
        <mat-icon class="brand-icon">workspace_premium</mat-icon>
        <span class="brand-name">DiplomaGen</span>
      </a>

      <span class="spacer"></span>

      @if (currentUser$ | async; as user) {
        <!-- Balance chip -->
        <mat-chip class="balance-chip" [matTooltip]="'Available generations'">
          <mat-icon matChipAvatar>generating_tokens</mat-icon>
          {{ availableGenerations() }}
        </mat-chip>

        <!-- Dark/light mode toggle -->
        <button
          mat-icon-button
          (click)="toggleTheme()"
          [matTooltip]="isDark() ? 'Switch to light mode' : 'Switch to dark mode'"
          aria-label="Toggle color theme"
        >
          <mat-icon>{{ isDark() ? 'light_mode' : 'dark_mode' }}</mat-icon>
        </button>

        <!-- User avatar menu -->
        <button
          mat-icon-button
          [matMenuTriggerFor]="userMenu"
          aria-label="User menu"
          class="avatar-button"
        >
          @if (user.photoURL) {
            <img [src]="user.photoURL" [alt]="user.displayName ?? 'User'" class="avatar-img" />
          } @else {
            <mat-icon>account_circle</mat-icon>
          }
        </button>

        <mat-menu #userMenu="matMenu">
          <div class="menu-user-info">
            <div class="menu-user-name">{{ user.displayName }}</div>
            <div class="menu-user-email">{{ user.email }}</div>
          </div>

          <mat-divider />

          <button mat-menu-item (click)="topUpBalance()">
            <mat-icon>add_card</mat-icon>
            <span>Top up balance</span>
          </button>

          <mat-divider />

          <button mat-menu-item (click)="signOut()">
            <mat-icon>logout</mat-icon>
            <span>Sign out</span>
          </button>
        </mat-menu>
      }
    </mat-toolbar>
  `,
  styles: [`
    .navbar {
      position: sticky;
      top: 0;
      z-index: 100;
      background: var(--mat-sys-surface-container);
      border-bottom: 1px solid var(--mat-sys-outline-variant);
      gap: 8px;
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 8px;
      text-decoration: none;
      color: var(--mat-sys-on-surface);
    }

    .brand-icon {
      color: var(--mat-sys-primary);
    }

    .brand-name {
      font-size: 1.125rem;
      font-weight: 600;
      letter-spacing: -0.02em;
    }

    .spacer {
      flex: 1;
    }

    .balance-chip {
      background: var(--mat-sys-primary-container);
      color: var(--mat-sys-on-primary-container);
      font-weight: 600;
    }

    .avatar-button {
      padding: 0;
      width: 40px;
      height: 40px;
    }

    .avatar-img {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      object-fit: cover;
    }

    .menu-user-info {
      padding: 12px 16px 8px;
    }

    .menu-user-name {
      font-weight: 600;
      font-size: 0.9rem;
    }

    .menu-user-email {
      font-size: 0.8rem;
      color: var(--mat-sys-on-surface-variant);
    }
  `],
})
export class NavbarComponent implements OnDestroy {
  private readonly router = inject(Router);
  private readonly auth = inject(Auth);
  private readonly firestore = inject(Firestore);
  private readonly destroy$ = new Subject<void>();

  protected readonly authService = inject(AuthService);
  protected readonly themeService = inject(ThemeService);

  readonly currentUser$ = this.authService.currentUser$;
  readonly isDark = computed(() => this.themeService.isDark);
  readonly availableGenerations = signal(0);

  constructor() {
    // Subscribe to the Firestore user document for live balance updates
    user(this.auth).pipe(
      switchMap((u) =>
        u
          ? docData<User>(doc(this.firestore, `users/${u.uid}`) as Parameters<typeof docData<User>>[0])
          : of(undefined),
      ),
      takeUntil(this.destroy$),
    ).subscribe((userData) => {
      this.availableGenerations.set(userData?.availableGenerations ?? 0);
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  toggleTheme(): void {
    this.themeService.toggle();
  }

  async signOut(): Promise<void> {
    await this.authService.signOut();
  }

  topUpBalance(): void {
    // TODO: Epic 10 — open TopUpBalanceModal
  }
}
