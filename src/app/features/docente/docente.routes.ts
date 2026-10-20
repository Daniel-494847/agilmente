import { Routes } from '@angular/router';

import { requireDocente } from '@core/guards/route-guards';
import { secciones } from '@shared/data/section-pages.data';

/**
 * Módulo Docente: generación de hojas de ejercicios imprimibles.
 * Solo docentes y administradores (guard requireDocente).
 */
export const DOCENTE_ROUTES: Routes = [
  {
    path: 'mi-curso',
    loadComponent: () => import('./mi-curso/mi-curso').then((m) => m.MiCursoDocente),
    canActivate: [requireDocente],
    data: {
      title: 'Mi curso',
      description: 'Avance de los estudiantes del curso que tienes asignado.'
    }
  },
  {
    path: '',
    loadComponent: () => import('./docente').then((m) => m.Docente),
    canActivate: [requireDocente],
    data: secciones.docente
  }
];
