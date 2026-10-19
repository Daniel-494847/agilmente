import { Injectable, OnInit, OnDestroy, inject } from '@angular/core';

import { GameUiService } from './game-ui.service';
import { QuizEngine } from './quiz-engine.service';
import { ConfiguracionQuiz, PreguntaQuiz } from '@shared/components/quiz/quiz.model';

/**
 * Clase base para los juegos construidos sobre la plantilla de Quiz.
 *
 * Aporta el ciclo de vida estándar (ngOnInit/ngOnDestroy) y la conexión con
 * el motor compartido: el juego solo declara su `config` (con las preguntas
 * ya generadas) y su `slug`, e implementa `generar()`. El resto (elegir
 * nivel, empezar, responder, avanzar, reiniciar, sonido, registrar intento,
 * modo juego) lo gestiona `QuizEngine`.
 *
 * El componente debe declarar `providers: [QuizEngine]` en su decorador.
 */
@Injectable()
export abstract class JuegoQuizBase implements OnInit, OnDestroy {
  protected readonly gameUi = inject(GameUiService);
  protected readonly engine = inject(QuizEngine);

  /** Configuración del juego (preguntas se asignan en ngOnInit). */
  protected abstract readonly config: ConfiguracionQuiz;

  /** Slug con el que se guarda el intento en Firestore. */
  protected abstract readonly slug: string;

  /** Genera las preguntas del juego (por nivel). */
  protected abstract generar(): PreguntaQuiz[];

  ngOnInit(): void {
    this.config.colorTema = this.config.colorTema ?? 'blue';
    this.config.preguntas = this.generar();
    this.engine.init(this.config, this.slug);
    this.gameUi.setJugando(true);
  }

  ngOnDestroy(): void {
    this.gameUi.setJugando(false);
    this.engine.finalizarIntento();
  }
}
