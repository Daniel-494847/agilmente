export type ColorTema = 'purple' | 'green' | 'amber' | 'blue' | 'pink' | 'orange';

export interface ActividadResumen {
  id: number;
  titulo: string;
  descripcion: string;
  icono: string;
  imagen?: string;
  colorTema: ColorTema;
  ruta: string;
}
