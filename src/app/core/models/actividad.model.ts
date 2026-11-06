export type ColorTema = 'purple' | 'green' | 'amber' | 'blue' | 'pink' | 'orange';

export interface ActividadResumen {
  id: number;
  titulo: string;
  descripcion: string;
  icono: string;
  imagen?: string;
  colorTema: ColorTema;
  ruta: string;
  /** `false` cuando el administrador la ocultó del catálogo público. */
  publicado?: boolean;
}

/**
 * Una actividad se considera publicada salvo que el administrador la haya
 * despublicado explícitamente. Así las fichas antiguas (sin el campo) siguen
 * visibles sin necesidad de migrarlas.
 */
export function estaPublicada(
  actividad: Pick<ActividadResumen, 'publicado'>
): boolean {
  return actividad.publicado !== false;
}
