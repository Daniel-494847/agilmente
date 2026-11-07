import { Component, EventEmitter, Input, OnChanges, OnDestroy, Output, SimpleChanges, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { QuizViewModel } from './quiz.model';
import { SvgSeguroPipe } from '@shared/pipes/svg-seguro.pipe';
import { QuizSonidoService } from '@core/services/quiz-sonido.service';

/** Una pieza de una explosión de confeti. */
interface PiezaConfeti {
  dx: number;
  dy: number;
  giro: number;
  color: string;
  retraso: number;
  tamano: number;
  redonda: boolean;
}

/** Explosión de confeti lanzada al acertar una respuesta. */
interface ExplosionConfeti {
  id: number;
  piezas: PiezaConfeti[];
}

@Component({
  selector: 'app-quiz',
  standalone: true,
  imports: [RouterLink, SvgSeguroPipe],
  templateUrl: './quiz.html',
  styleUrl: './quiz.css'
})
export class Quiz implements OnChanges, OnDestroy {
  private readonly sonido = inject(QuizSonidoService);
  /** Vista previa a la última pintada, para detectar los cambios de estado. */
  private vistaAnterior: QuizViewModel | undefined;

  @Input() vm?: QuizViewModel;
  @Input() set vista(value: QuizViewModel) {
    this.vm = value;
  }
  get vista(): QuizViewModel {
    return this.vm as QuizViewModel;
  }
  @Input() rutaVolver = '/razonamiento-logico';
  @Output() volver = new EventEmitter<void>();
  @Output() nivelElegido = new EventEmitter<number>();
  @Output() empezar = new EventEmitter<void>();
  @Output() respuestaSeleccionada = new EventEmitter<string>();
  @Output() avanzar = new EventEmitter<void>();
  @Output() reiniciar = new EventEmitter<void>();
  @Output() alternarSonido = new EventEmitter<void>();

  /**
   * Explosiones de confeti de los aciertos. Se guardan en una lista para que
   * cada respuesta correcta cree nodos nuevos y la animación vuelva a empezar
   * (si solo se alternara un booleano, CSS no reiniciaría el keyframes).
   */
  readonly confetiAciertos = signal<ExplosionConfeti[]>([]);
  private siguienteExplosion = 0;
  private readonly temporizadoresConfeti = new Set<ReturnType<typeof setTimeout>>();

  /**
   * Toda la retroalimentación sonora vive en la plantilla (no en `QuizEngine`)
   * para que también la tengan los juegos que gestionan su propia vista
   * (Pirámides y Cuadrados Mágicos). Al responder se habla dentro del propio
   * clic (los navegadores exigen un gesto del usuario); aquí se detectan los
   * cambios de pantalla para los efectos y para cortar la frase al navegar.
   */
  ngOnChanges(changes: SimpleChanges): void {
    if (!changes['vm'] && !changes['vista']) return;
    const actual = this.vm;
    if (!actual) return;
    this.reproducirEfectos(this.vistaAnterior, actual);
    this.reproducirVoz(this.vistaAnterior, actual);
    this.detectarAcierto(this.vistaAnterior, actual);
    this.vistaAnterior = actual;
  }

  ngOnDestroy(): void {
    this.sonido.detenerVoz();
    for (const t of this.temporizadoresConfeti) clearTimeout(t);
    this.temporizadoresConfeti.clear();
  }

  /** Responde la opción y pronuncia el resultado dentro del gesto del clic. */
  seleccionar(opcionId: string): void {
    const vm = this.vm;
    const pregunta = vm?.preguntaActual;
    if (!vm || vm.estado !== 'jugando' || !pregunta) return;

    const esCorrecta = opcionId === pregunta.respuestaCorrectaId;
    this.respuestaSeleccionada.emit(opcionId);
    if (vm.sonidosActivos) {
      this.sonido.hablar(esCorrecta ? 'acierto' : 'error');
    }
  }

  /**
   * Detecta el paso de «jugando» a «feedback» con respuesta correcta y lanza
   * confeti. Vive en la plantilla (no en `QuizEngine`) para que también lo
   * tengan los juegos que gestionan su propia vista (Pirámides y Cuadrados
   * Mágicos) sin tocar cada juego.
   */
  private detectarAcierto(anterior: QuizViewModel | undefined, actual: QuizViewModel): void {
    if (
      actual.estado === 'feedback' &&
      anterior?.estado === 'jugando' &&
      actual.esCorrecta === true
    ) {
      this.lanzarConfeti();
    }
  }

  /** Crea una explosión de confeti con piezas en todas las direcciones. */
  private lanzarConfeti(): void {
    const id = ++this.siguienteExplosion;
    const cantidad = 28;
    const piezas = Array.from({ length: cantidad }, (_, i): PiezaConfeti => {
      const angulo = (i / cantidad) * Math.PI * 2 + (Math.random() - 0.5) * 0.35;
      const distancia = 110 + Math.random() * 150;
      return {
        dx: Math.round(Math.cos(angulo) * distancia),
        // +90 de sesgo hacia abajo: imita la gravedad del confeti real.
        dy: Math.round(Math.sin(angulo) * distancia + 90),
        giro: Math.round((Math.random() - 0.5) * 1080),
        color: `hsl(${Math.round(Math.random() * 360)}, 90%, 58%)`,
        retraso: Math.round(Math.random() * 90),
        tamano: 6 + Math.round(Math.random() * 6),
        redonda: Math.random() < 0.35
      };
    });

    this.confetiAciertos.update((lista) => [...lista, { id, piezas }]);
    const t = setTimeout(() => {
      this.confetiAciertos.update((lista) => lista.filter((e) => e.id !== id));
      this.temporizadoresConfeti.delete(t);
    }, 1300);
    this.temporizadoresConfeti.add(t);
  }

  /**
   * Efectos de la partida: inicio, respuesta, paso a la siguiente pregunta,
   * tic-tac de los últimos segundos y fanfarria del resultado.
   */
  private reproducirEfectos(anterior: QuizViewModel | undefined, actual: QuizViewModel): void {
    if (!actual.sonidosActivos) return;

    // Vista previa al volver a activar el sonido.
    if (anterior && !anterior.sonidosActivos) {
      this.sonido.tocar('inicio');
      return;
    }
    if (!anterior) return;

    // Empezar la partida.
    if (actual.estado === 'jugando' && anterior.estado === 'intro') {
      this.sonido.tocar('inicio');
      return;
    }

    // Respuesta elegida (también el tiempo agotado).
    if (actual.estado === 'feedback' && anterior.estado === 'jugando') {
      this.sonido.tocar(
        actual.esCorrecta ? 'acierto' : actual.seleccionada === null ? 'tiempo' : 'error'
      );
      return;
    }

    // Paso a la siguiente pregunta.
    if (actual.estado === 'jugando' && anterior.estado === 'feedback') {
      this.sonido.tocar('avanzar');
      return;
    }

    // Pantalla de resultados: fanfarria si aprobó, cierre suave si no.
    if (actual.estado === 'resultado' && anterior.estado !== 'resultado') {
      this.sonido.tocar(actual.resultado.porcentaje >= 70 ? 'resultado' : 'fin');
      return;
    }

    // Tic-tac de los últimos 5 segundos.
    if (
      actual.estado === 'jugando' &&
      anterior.estado === 'jugando' &&
      actual.segundosRestantes < anterior.segundosRestantes &&
      actual.segundosRestantes > 0 &&
      actual.segundosRestantes <= 5
    ) {
      this.sonido.tocar('tick');
    }
  }

  private reproducirVoz(anterior: QuizViewModel | undefined, actual: QuizViewModel): void {
    // Al silenciar se corta cualquier frase en curso.
    if (!actual.sonidosActivos) {
      if (anterior?.sonidosActivos !== false) this.sonido.detenerVoz();
      return;
    }

    // Al salir de «feedback» (avanzar, reiniciar, cambiar de nivel) se corta.
    if (actual.estado !== 'feedback') {
      if (anterior?.estado === 'feedback') this.sonido.detenerVoz();
      return;
    }

    // No repetir la frase si el mismo feedback se vuelve a pintar.
    if (anterior?.estado === 'feedback' && anterior.indice === actual.indice) return;

    // El tiempo agotado no pasa por `seleccionar()`: se avisa aquí.
    if (actual.esCorrecta === false && actual.seleccionada === null) {
      this.sonido.hablar('tiempo');
    }
  }

  /**
   * Tamaño del enunciado configurado por el juego (`config.escalaEnunciado`).
   * La plantilla lo publica como variable CSS en `.quiz-page`; sin valor queda
   * el 1.15 por defecto. Así cada juego ajusta su apariencia desde su
   * `ConfiguracionQuiz`, sin reglas CSS propias ni selectores por juego.
   */
  get estiloEnunciado(): string | null {
    const escala = this.vm?.config?.escalaEnunciado;
    return escala ? `calc(var(--qz-base) * ${escala})` : null;
  }

  /**
   * «Volver» baja un nivel dentro del juego en vez de salir de él:
   * desde «jugando», «feedback» o «resultado» regresa al menú del
   * juego (intro) sin abandonarlo; desde el menú pide al juego que
   * cierre y vuelva a la ventana anterior.
   */
  volverAtras(): void {
    if (this.vista.estado !== 'intro') {
      this.reiniciar.emit();
      return;
    }
    this.volver.emit();
  }
}
