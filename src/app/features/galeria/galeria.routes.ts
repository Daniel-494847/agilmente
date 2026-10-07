import { Routes } from '@angular/router';

import { requireAdmin } from '../../core/guards/route-guards';

export const GALERIA_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./galeria').then((m) => m.Galeria)
  },
  {
    path: 'administrar',
    loadComponent: () => import('./admin/galeria-admin').then((m) => m.GaleriaAdmin),
    canActivate: [requireAdmin]
  }
];
