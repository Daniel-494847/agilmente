import { Routes } from '@angular/router';

import { redirectIfAuthenticated } from './core/guards/route-guards';

/**
 * Rutas raíz.
 * - /login fuera del shell
 * - El resto dentro de layout/shell (sidebar + topbar)
 */
export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/login/login').then((m) => m.Login),
    canActivate: [redirectIfAuthenticated]
  },
  {
    path: '',
    loadComponent: () => import('./layout/shell/shell').then((m) => m.Shell),
    children: [
      {
        path: 'inicio',
        loadChildren: () =>
          import('./features/dashboard/dashboard.routes').then((m) => m.DASHBOARD_ROUTES)
      },
      {
        path: 'razonamiento-logico',
        loadChildren: () =>
          import('./features/actividades/actividades.routes').then((m) => m.ACTIVIDADES_ROUTES)
      },
      {
        path: 'biblioteca',
        loadChildren: () =>
          import('./features/biblioteca/biblioteca.routes').then((m) => m.BIBLIOTECA_ROUTES)
      },
      {
        path: 'galeria',
        loadChildren: () =>
          import('./features/galeria/galeria.routes').then((m) => m.GALERIA_ROUTES)
      },
      {
        path: 'progreso',
        loadChildren: () =>
          import('./features/progreso/progreso.routes').then((m) => m.PROGRESO_ROUTES)
      },
      {
        path: 'avisos',
        loadChildren: () =>
          import('./features/avisos/avisos.routes').then((m) => m.AVISOS_ROUTES)
      },
      {
        path: 'unidad-educativa',
        loadChildren: () =>
          import('./features/unidad-educativa/unidad-educativa.routes').then(
            (m) => m.UNIDAD_EDUCATIVA_ROUTES
          )
      },
      {
        path: 'perfil',
        loadChildren: () =>
          import('./features/auth/auth.routes').then((m) => m.PERFIL_ROUTES)
      },
      {
        path: 'administracion',
        loadChildren: () =>
          import('./features/administracion/administracion.routes').then(
            (m) => m.ADMINISTRACION_ROUTES
          )
      },
      { path: '', redirectTo: 'inicio', pathMatch: 'full' }
    ]
  },
  { path: '**', redirectTo: 'inicio' }
];
