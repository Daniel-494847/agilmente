import { Routes } from '@angular/router';

import { requireAdmin } from '../../core/guards/route-guards';

export const AVISOS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./avisos').then((m) => m.Avisos)
  },
  {
    path: 'administrar',
    loadComponent: () => import('./admin/avisos-admin').then((m) => m.AvisosAdmin),
    canActivate: [requireAdmin]
  }
];
