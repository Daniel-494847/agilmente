import { Routes } from '@angular/router';

import { requireAdmin } from '../../core/guards/route-guards';
import { secciones } from '../../shared/data/section-pages.data';

export const PROGRESO_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('../../shared/components/section-page/section-page').then((m) => m.SectionPage),
    data: secciones.progreso
  },
  {
    path: 'administrar',
    loadComponent: () =>
      import('./admin/section-content-admin').then((m) => m.SectionContentAdmin),
    canActivate: [requireAdmin],
    data: { sectionId: 'progreso', ...secciones.progreso }
  }
];
