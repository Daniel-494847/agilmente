import { ColorTema } from '@core/models/actividad.model';

export type TipoEjercicioDocente =
  | 'operaciones'
  | 'sucesiones'
  | 'conteo'
  | 'comparaciones'
  | 'mentales'
  | 'piramides'
  | 'problemas'
  | 'operadores'
  | 'geometria'
  | 'conjuntos'
  | 'logicos'
  | 'seriaciones'
  | 'cuadrados'
  | 'interactivas'
  | 'agilidad';

export interface EjercicioDocente {
  id: string;
  /** Texto del ejercicio; los espacios para responder van con guiones bajos. */
  enunciado: string;
  /** SVG crudo (se pasa por el pipe svgSeguro antes de pintarlo). */
  imagen?: string;
  /** Solución para la hoja de respuestas. */
  respuesta: string;
}

export interface HojaDocente {
  /** Número de hoja (1-based). */
  indice: number;
  /** Número del primer ejercicio de la hoja (numeración continua en el cuadernillo). */
  inicio: number;
  ejercicios: EjercicioDocente[];
}

export interface RespuestaDocente {
  numero: number;
  texto: string;
}

export interface TipoActividadDocente {
  id: TipoEjercicioDocente;
  nombre: string;
  descripcion: string;
  /** Icono bootstrap-icons, el mismo de la actividad de juego de la que proviene. */
  icono: string;
  /** Tema de color de la actividad de juego de la que proviene (mismo colorTema). */
  colorTema: ColorTema;
  /** Máximo de ejercicios por hoja carta (según el largo de cada tipo). */
  porHoja: number;
}

/**
 * Catálogo de tipos imprimibles. Los ejercicios con figura salen de los
 * bancos de los propios juegos (mismos gráficos que en pantalla), y
 * `porHoja` se ajusta a una imagen por fila: 5 con la imagen a 85 × 38 mm
 * caben en la hoja carta con margen (3 en pirámides, que son altas).
 */
export const TIPOS_ACTIVIDAD_DOCENTE: TipoActividadDocente[] = [
  {
    id: 'sucesiones',
    nombre: 'Sucesiones y Patrones',
    descripcion: 'Descubre qué elemento sigue en cada secuencia de figuras y números.',
    icono: 'bi-diagram-3',
    colorTema: 'purple',
    porHoja: 5
  },
  {
    id: 'conteo',
    nombre: 'Conteo de Figuras',
    descripcion: 'Cuenta figuras, segmentos y cuadrados en un dibujo.',
    icono: 'bi-shapes',
    colorTema: 'green',
    porHoja: 5
  },
  {
    id: 'operaciones',
    nombre: 'Operaciones Básicas',
    descripcion: 'Sumas, restas y multiplicaciones con distinto nivel de complejidad.',
    icono: 'bi-plus-slash-minus',
    colorTema: 'blue',
    porHoja: 5
  },
  {
    id: 'operadores',
    nombre: 'Operadores Matemáticos',
    descripcion: 'Descubre el valor de cada figura resolviendo las operaciones.',
    icono: 'bi-calculator-fill',
    colorTema: 'blue',
    porHoja: 5
  },
  {
    id: 'mentales',
    nombre: 'Actividades Mentales',
    descripcion: 'Cálculo mental, conteo rápido y comparaciones con >, < o =.',
    icono: 'bi-brain',
    colorTema: 'green',
    porHoja: 12
  },
  {
    id: 'geometria',
    nombre: 'Geometría Básica',
    descripcion: 'Perímetros y lados que faltan en figuras.',
    icono: 'bi-triangle',
    colorTema: 'orange',
    porHoja: 5
  },
  {
    id: 'conjuntos',
    nombre: 'Conjuntos',
    descripcion: 'Pertenencia, unión e intersección con números y vocales.',
    icono: 'bi-union',
    colorTema: 'pink',
    porHoja: 5
  },
  {
    id: 'logicos',
    nombre: 'Juegos Lógicos',
    descripcion: 'Sudoku: completa filas, columnas y bloques sin repetir.',
    icono: 'bi-grid-3x3',
    colorTema: 'orange',
    porHoja: 5
  },
  {
    id: 'problemas',
    nombre: 'Razonamiento Aplicado',
    descripcion: 'Problemas cortos de la vida diaria.',
    icono: 'bi-lightbulb',
    colorTema: 'purple',
    porHoja: 5
  },
  {
    id: 'seriaciones',
    nombre: 'Seriaciones',
    descripcion: 'Completa series de letras, números y figuras siguiendo su regla.',
    icono: 'bi-sort-down',
    colorTema: 'green',
    porHoja: 5
  },
  {
    id: 'piramides',
    nombre: 'Pirámides',
    descripcion: 'Completa los números que faltan en cada pirámide.',
    icono: 'bi-triangle',
    colorTema: 'amber',
    porHoja: 3
  },
  {
    id: 'cuadrados',
    nombre: 'Cuadrados Mágicos',
    descripcion: 'Completa el casillero que falta o descubre el número mágico.',
    icono: 'bi-grid-3x3-gap',
    colorTema: 'purple',
    porHoja: 5
  },
  {
    id: 'interactivas',
    nombre: 'Matemáticas Interactivas',
    descripcion: 'Duelo de operaciones: sumas, restas, multiplicación y división.',
    icono: 'bi-joystick',
    colorTema: 'green',
    porHoja: 12
  },
  {
    id: 'agilidad',
    nombre: 'Juegos Mentales',
    descripcion: 'Agilidad mental con positivos y negativos.',
    icono: 'bi-calculator',
    colorTema: 'pink',
    porHoja: 12
  }
];

export const NIVELES_DOCENTE = [
  { nivel: 1, etiqueta: 'Básico' },
  { nivel: 2, etiqueta: 'Intermedio' },
  { nivel: 3, etiqueta: 'Avanzado' }
] as const;
