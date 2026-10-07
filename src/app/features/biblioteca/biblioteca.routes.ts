import { Routes } from '@angular/router';

import { requireAdmin } from '../../core/guards/route-guards';

export const BIBLIOTECA_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./biblioteca').then((m) => m.Biblioteca)
  },
  {
    path: 'administrar',
    loadComponent: () => import('./admin/biblioteca-admin').then((m) => m.BibliotecaAdmin),
    canActivate: [requireAdmin]
  }
];
