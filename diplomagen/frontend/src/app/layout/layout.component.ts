import { Component, OnInit, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NavbarComponent } from './navbar/navbar.component';
import { ThemeService } from '../core/auth/theme.service';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [RouterOutlet, NavbarComponent],
  template: `
    <div class="layout-shell">
      <app-navbar />
      <main class="layout-content">
        <router-outlet />
      </main>
    </div>
  `,
  styles: [`
    .layout-shell {
      display: flex;
      flex-direction: column;
      height: 100%;
    }
    .layout-content {
      flex: 1;
      overflow: auto;
    }
  `],
})
export class LayoutComponent implements OnInit {
  private readonly themeService = inject(ThemeService);

  ngOnInit(): void {
    this.themeService.init();
  }
}
