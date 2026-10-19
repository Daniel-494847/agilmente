import { Routes } from '@angular/router';

import { requireDocente } from '@core/guards/route-guards';
import { secciones } from '@shared/data/section-pages.data';

/**
 * Módulo Docente: generación de hojas de ejercicios imprimibles.
 * Solo docentes y administradores (guard requireDocente).
 */
export const DOCENTE_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./docente').then((m) => m.Docente),
    canActivate: [requireDocente],
    data: secciones.docente
  }
];
