import { Routes } from '@angular/router';

import { requireAuth } from '@core/guards/route-guards';
import { secciones } from '@shared/data/section-pages.data';

export const PERFIL_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./perfil/perfil').then((m) => m.Perfil),
    data: secciones.perfil
  },
  {
    path: 'administrar',
    loadComponent: () => import('./perfil/perfil-admin').then((m) => m.PerfilAdmin),
    canActivate: [requireAuth]
  }
];
