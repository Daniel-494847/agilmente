import { Routes } from '@angular/router';

import { requireAdmin } from '@core/guards/route-guards';
import { secciones } from '@shared/data/section-pages.data';

export const CONTACTOS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./contactos').then((m) => m.Contactos),
    data: secciones.contactos
  },
  {
    path: 'administrar',
    loadComponent: () =>
      import('./admin/contactos-admin').then((m) => m.ContactosAdmin),
    canActivate: [requireAdmin]
  }
];
