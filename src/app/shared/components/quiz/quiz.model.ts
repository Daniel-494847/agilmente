export type TipoPregunta =
  | "opcion-multiple"
  | "verdadero-falso"
  | "completar"
  | "personalizado";

export interface OpcionRespuesta {
  id: string;
  texto: string;
  ariaLabel?: string;
  imagen?: string;
}

export interface CeldaRejilla {
  texto: string;
  /** Clases de Bootstrap de la celda (colores y bordes). */
  clase?: string;
  ariaLabel?: string;
}

/** Rejilla cuadrada u oblonga para retos de tabla (cuadrados mágicos, sudokus…). */
export interface RejillaQuiz {
  /** Celdas en orden de lectura, de izquierda a derecha y de arriba abajo. */
  celdas: CeldaRejilla[];
  /** Número de columnas (y de filas si es cuadrada). */
  lado: number;
  /** Descripción de la rejilla para lectores de pantalla. */
  descripcion?: string;
}

export interface PreguntaQuiz {
  id: string;
  enunciado: string;
  /** Imagen de la pregunta (URL o data URI, p. ej. el SVG de Conteo de
      Figuras). La plantilla la dibuja sobre el enunciado. */
  imagen?: string;
  /** Rejilla de casilleros (se dibuja encima del enunciado). */
  rejilla?: RejillaQuiz;
  tipo: TipoPregunta;
  opciones: OpcionRespuesta[];
  respuestaCorrectaId: string;
  explicacion?: string;
  puntos?: number;
  /** Nivel (1-based) al que pertenece la pregunta. Por defecto 1. */
  nivel?: number;
  /** Contenido HTML personalizado para renderizar dentro del quiz en estado 'jugando'. */
  contenidoHtml?: string;
  /** Datos arbitrarios para lógica personalizada. */
  datos?: any;
}

export interface ConfiguracionQuiz {
  titulo: string;
  descripcion?: string;
  niveles?: number;
  preguntasPorNivel?: number;
  etiquetasNiveles?: string[];
  colorTema?: "purple" | "green" | "amber" | "blue" | "pink" | "orange";
  preguntas: PreguntaQuiz[];
  tiempoLimiteSegundos?: number;
}

export interface ResultadoQuiz {
  correctas: number;
  incorrectas: number;
  total: number;
  puntaje: number;
  porcentaje: number;
  respuestas: { preguntaId: string; opcionId: string; correcta: boolean }[];
}

export type EstadoQuiz = "intro" | "jugando" | "feedback" | "resultado";

export interface QuizViewModel {
  config: ConfiguracionQuiz;
  estado: EstadoQuiz;
  indice: number;
  nivelSeleccionado: number;
  preguntaActual: PreguntaQuiz | null;
  total: number;
  etiquetasNiveles: string[];
  resultado: ResultadoQuiz;
  estrellas: number;
  colorTema: string;
  seleccionada: string | null;
  esCorrecta: boolean | null;
  mostrarConfeti: boolean;
  sonidosActivos: boolean;
  segundosRestantes: number;
}
