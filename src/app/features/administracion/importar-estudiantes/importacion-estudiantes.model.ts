import { DOMINIO_ESTUDIANTES, Paralelo } from '@core/models/usuario.model';

/** Dominio de los correos internos que se generan cuando el Excel no trae correo. */
export { DOMINIO_ESTUDIANTES };

/** Curso al que se importa la lista (se elige antes de subir el archivo). */
export interface DestinoImportacion {
  curso: number;
  paralelo: Paralelo;
}

/** Una fila del Excel ya interpretada y validada. */
export interface FilaImportacion {
  /** Número de fila en el archivo (para poder corregirla). */
  fila: number;
  nombre: string;
  curso?: number;
  paralelo?: Paralelo;
  /** Correo real escrito en el Excel, si lo hay. */
  correo?: string;
  /** Dato de acceso: el correo real o el usuario interno generado. */
  usuario: string;
  /** Correo con el que se crea la cuenta en Firebase Auth. */
  correoInterno: string;
  /** Contraseña (del Excel o generada). */
  password: string;
  valida: boolean;
  error?: string;
}

/** Resultado de importar una fila. */
export interface ResultadoImportacion {
  fila: number;
  nombre: string;
  cursoTexto: string;
  usuario: string;
  correoInterno: string;
  password: string;
  estado: 'creado' | 'actualizado' | 'error';
  detalle?: string;
}
