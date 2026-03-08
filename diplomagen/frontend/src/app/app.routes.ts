import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';

export const routes: Routes = [
  // Public routes
  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/login-page/login-page.component').then(
        (m) => m.LoginPageComponent,
      ),
  },

  // Protected routes — wrapped in the layout shell
  {
    path: '',
    loadComponent: () =>
      import('./layout/layout.component').then((m) => m.LayoutComponent),
    canActivate: [authGuard],
    children: [
      {
        path: '',
        redirectTo: 'projects',
        pathMatch: 'full',
      },
      {
        path: 'projects',
        loadComponent: () =>
          import('./features/projects/project-list-page/project-list-page.component').then(
            (m) => m.ProjectListPageComponent,
          ),
      },
      {
        path: 'projects/:id',
        loadComponent: () =>
          import('./features/workspace/workspace-page/workspace-page.component').then(
            (m) => m.WorkspacePageComponent,
          ),
      },
      {
        path: 'projects/:id/editor',
        loadComponent: () =>
          import('./features/editor/editor-page/editor-page.component').then(
            (m) => m.EditorPageComponent,
          ),
      },
    ],
  },

  // Fallback
  {
    path: '**',
    redirectTo: 'projects',
  },
];
