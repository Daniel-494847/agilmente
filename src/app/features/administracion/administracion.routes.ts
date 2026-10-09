import { Routes } from '@angular/router';

import { requireAdmin } from '../../core/guards/route-guards';

/** Rutas de la zona de administración (todas protegidas por requireAdmin). */
export const ADMINISTRACION_ROUTES: Routes = [
  {
    path: 'usuarios',
    loadComponent: () =>
      import('./usuarios-admin/usuarios-admin').then((m) => m.UsuariosAdmin),
    canActivate: [requireAdmin]
  }
];
