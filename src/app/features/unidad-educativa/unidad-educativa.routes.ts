import { Routes } from '@angular/router';

import { requireAdmin } from '../../core/guards/route-guards';
import { secciones } from '../../shared/data/section-pages.data';

export const UNIDAD_EDUCATIVA_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('../../shared/components/section-page/section-page').then((m) => m.SectionPage),
    data: secciones.unidadEducativa
  },
  {
    path: 'administrar',
    loadComponent: () =>
      import('./admin/unidad-educativa-admin').then((m) => m.UnidadEducativaAdmin),
    canActivate: [requireAdmin]
  }
];
