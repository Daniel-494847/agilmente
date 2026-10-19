// Punto único de composición de los bancos de ejercicios provenientes de los
// juegos. El servicio docente depende de esta barrera (y de la interfaz
// BancoEjercicios) en lugar de importar cada juego por separado, de modo que
// un cambio en la API de datos de un juego solo se propaga a este archivo.
export {
  EJERCICIOS as BANCO_CONTEO,
  svgDe as svgConteo
} from '@features/actividades/juegos/conteo-figuras/conteo-figuras.data';
export {
  EJERCICIOS as BANCO_SUCESIONES,
  svgDe as svgSucesion
} from '@features/actividades/juegos/sucesiones-patrones/sucesiones-patrones.data';
export {
  EJERCICIOS as BANCO_SERIACIONES,
  svgDe as svgSeriacion
} from '@features/actividades/juegos/seriaciones/seriaciones.data';
export {
  EJERCICIOS as BANCO_OPERADORES,
  svgDe as svgOperador
} from '@features/actividades/juegos/operadores-matematicos/operadores-matematicos.data';
export {
  EJERCICIOS as BANCO_OPERACIONES,
  svgDe as svgOperacion
} from '@features/actividades/juegos/operaciones-basicas/operaciones-numeros-naturales.data';
export {
  EJERCICIOS_GEO as BANCO_GEOMETRIA,
  svgDe as svgGeometria
} from '@features/actividades/juegos/geometria-basica/geometria-basica.data';
export {
  EJERCICIOS_POR_NIVEL,
  construirPregunta as preguntaDeConjuntos
} from '@features/actividades/juegos/conjuntos/conjuntos.data';
export { construirPregunta as preguntaDeLogica } from '@features/actividades/juegos/juegos-logicos/juegos-logicos.data';
export { construirPregunta as preguntaDeProblemas } from '@features/actividades/juegos/razonamiento-aplicado/razonamiento-aplicado.data';
export type { Celda, Cuadrado } from '@features/actividades/juegos/cuadrados-magicos/cuadrados-magicos.data';
export { crearNivel as cuadradosDeNivel } from '@features/actividades/juegos/cuadrados-magicos/cuadrados-magicos.data';

export interface BancoEjercicios {
  generar(nivel: number, cantidad: number): unknown;
}
