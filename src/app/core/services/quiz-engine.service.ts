import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import { AttemptsService } from './attempts.service';
import { GameUiService } from './game-ui.service';
import {
  ConfiguracionQuiz,
  PreguntaQuiz,
  QuizViewModel
} from '@shared/components/quiz/quiz.model';

const VISTA_INICIAL: QuizViewModel = {
  config: {} as ConfiguracionQuiz,
  estado: 'intro',
  indice: 0,
  nivelSeleccionado: 1,
  preguntaActual: null,
  total: 0,
  etiquetasNiveles: [],
  resultado: {
    correctas: 0,
    incorrectas: 0,
    total: 0,
    puntaje: 0,
    porcentaje: 0,
    respuestas: []
  },
  estrellas: 0,
  colorTema: 'blue',
  seleccionada: null,
  esCorrecta: null,
  mostrarConfeti: false,
  sonidosActivos: true,
  segundosRestantes: 0
};

/**
 * Motor compartido de los quizzes. Encapsula el estado (`vista`) y toda la
 * lógica repetida entre juegos: elegir nivel, empezar, responder, avanzar,
 * reiniciar, mezclar preguntas, calcular porcentaje/estrellas y registrar
 * el intento en Firestore. El juego solo aporta su `ConfiguracionQuiz`
 * (con las preguntas ya generadas) y la generación de preguntas.
 *
 * Se provee a nivel de componente (`providers: [QuizEngine]`) para que cada
 * juego tenga su propia instancia.
 */
@Injectable()
export class QuizEngine {
  private readonly gameUi = inject(GameUiService);
  private readonly attempts = inject(AttemptsService);
  private readonly router = inject(Router);

  readonly vista = signal<QuizViewModel>({ ...VISTA_INICIAL });

  private config!: ConfiguracionQuiz;
  private actividadId = '';
  private intentoId: string | null = null;
  private intentoInicio = 0;

  /** Inicializa el motor con la configuración del juego y el slug de intento. */
  init(config: ConfiguracionQuiz, actividadId: string, nivel = 1): void {
    this.config = config;
    this.actividadId = actividadId;
    this.config.preguntas = this.config.preguntas ?? [];
    this.vista.set(this.inicial(nivel));
    void this.attempts.iniciar(actividadId).then((s) => {
      this.intentoId = s?.id ?? null;
      this.intentoInicio = s?.inicio ?? Date.now();
    });
  }

  /** El juego puede actualizar la config (p. ej. preguntas) antes de init. */
  getConfig(): ConfiguracionQuiz {
    return this.config;
  }

  private inicial(n: number): QuizViewModel {
    const list = this.mezclar(
      this.config.preguntas.filter((p) => p.nivel === n)
    );
    this.config.preguntas = [
      ...this.config.preguntas.filter((p) => p.nivel !== n),
      ...list
    ];
    return {
      config: this.config,
      estado: 'intro',
      indice: 0,
      nivelSeleccionado: n,
      preguntaActual: list[0] ?? null,
      total: list.length,
      etiquetasNiveles: this.config.etiquetasNiveles ?? [],
      resultado: {
        correctas: 0,
        incorrectas: 0,
        total: list.length,
        puntaje: 0,
        porcentaje: 0,
        respuestas: []
      },
      estrellas: 0,
      colorTema: this.config.colorTema ?? 'blue',
      seleccionada: null,
      esCorrecta: null,
      mostrarConfeti: false,
      sonidosActivos: this.vista().sonidosActivos ?? true,
      segundosRestantes: 0
    };
  }

  empezar(): void {
    this.vista.update((s) => ({ ...s, estado: 'jugando' }));
  }

  responder(id: string): void {
    const v = this.vista();
    const p = v.preguntaActual;
    if (!p) return;
    const es = id === p.respuestaCorrectaId;
    this.vista.update((s) => ({
      ...s,
      seleccionada: id,
      esCorrecta: es,
      estado: 'feedback',
      resultado: {
        ...s.resultado,
        correctas: s.resultado.correctas + (es ? 1 : 0),
        incorrectas: s.resultado.incorrectas + (es ? 0 : 1),
        puntaje: s.resultado.puntaje + (es ? (p.puntos ?? 10) : 0),
        respuestas: [
          ...s.resultado.respuestas,
          { preguntaId: p.id, opcionId: id, correcta: es }
        ]
      }
    }));
  }

  avanzar(): void {
    const v = this.vista();
    const list = this.config.preguntas.filter(
      (p) => p.nivel === v.nivelSeleccionado
    );
    const sig = v.indice + 1;
    if (sig < list.length) {
      this.vista.update((s) => ({
        ...s,
        indice: sig,
        preguntaActual: list[sig],
        estado: 'jugando',
        seleccionada: null,
        esCorrecta: null
      }));
    } else {
      const c = v.resultado.correctas;
      const t = list.length;
      const pct = t === 0 ? 0 : Math.round((c / t) * 100);
      this.vista.update((s) => ({
        ...s,
        estado: 'resultado',
        resultado: {
          ...s.resultado,
          correctas: c,
          incorrectas: t - c,
          total: t,
          porcentaje: pct
        },
        estrellas: pct >= 90 ? 3 : pct >= 70 ? 2 : pct >= 50 ? 1 : 0,
        mostrarConfeti: pct >= 70
      }));
    }
  }

  reiniciar(): void {
    this.vista.set(this.inicial(this.vista().nivelSeleccionado));
  }

  nivelElegido(n: number): void {
    this.vista.set(this.inicial(n));
  }

  alternarSonido(): void {
    this.vista.update((s) => ({ ...s, sonidosActivos: !s.sonidosActivos }));
  }

  volver(): void {
    void this.router.navigateByUrl('/razonamiento-logico');
  }

  finalizarIntento(): void {
    if (this.intentoId) {
      void this.attempts.finalizar(this.intentoId, this.intentoInicio, {
        actividadId: this.actividadId,
        puntaje: this.vista().resultado.puntaje,
        nivel: this.vista().nivelSeleccionado,
        respuestasCorrectas: this.vista().resultado.correctas,
        respuestasIncorrectas: this.vista().resultado.incorrectas
      });
    }
  }

  private mezclar<T>(a: T[]): T[] {
    const c = [...a];
    for (let i = c.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [c[i], c[j]] = [c[j], c[i]];
    }
    return c;
  }
}
