import { Routes } from '@angular/router';

import { requireAdmin } from '../../core/guards/route-guards';
import { secciones } from '../../shared/data/section-pages.data';

export const PERFIL_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('../../shared/components/section-page/section-page').then((m) => m.SectionPage),
    data: secciones.perfil
  },
  {
    path: 'administrar',
    loadComponent: () => import('./perfil/perfil-admin').then((m) => m.PerfilAdmin),
    canActivate: [requireAdmin]
  }
];
