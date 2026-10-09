import { Component, OnDestroy, OnInit, inject, signal } from "@angular/core";
import { Router } from "@angular/router";
import { AttemptsService } from "../../../../core/services/attempts.service";
import { GameUiService } from "../../../../core/services/game-ui.service";
import { Quiz } from "../../../../shared/components/quiz/quiz";
import {
  ConfiguracionQuiz,
  PreguntaQuiz,
  QuizViewModel,
  TipoPregunta,
} from "../../../../shared/components/quiz/quiz.model";
import { EJERCICIOS, Nivel, svgDe } from "./conteo-figuras.data";

@Component({
  selector: "app-conteo-figuras",
  standalone: true,
  imports: [Quiz],
  template: `
    <app-quiz
      [vista]="vista()"
      rutaVolver="/razonamiento-logico"
      (volver)="volver()"
      (nivelElegido)="nivelElegido($event)"
      (empezar)="empezar()"
      (respuestaSeleccionada)="respuestaSeleccionada($event)"
      (avanzar)="avanzar()"
      (reiniciar)="reiniciar()"
      (alternarSonido)="alternarSonido()"
    />
  `,
})
export class ConteoFiguras implements OnInit, OnDestroy {
  private readonly gameUi = inject(GameUiService);
  private readonly attempts = inject(AttemptsService);
  private readonly router = inject(Router);
  private intentoId: string | null = null;
  private intentoInicio = 0;

  readonly config: ConfiguracionQuiz = {
    titulo: "Conteo de Figuras",
    descripcion: "Cuenta figuras, segmentos, ángulos y triángulos.",
    colorTema: "green",
    niveles: 3,
    preguntasPorNivel: 25,
    etiquetasNiveles: ["Básico", "Intermedio", "Avanzado"],
    preguntas: [],
  };

  readonly vista = signal<QuizViewModel>({
    config: this.config,
    estado: "intro",
    indice: 0,
    nivelSeleccionado: 1,
    preguntaActual: null,
    total: 0,
    etiquetasNiveles: this.config.etiquetasNiveles ?? [],
    resultado: {
      correctas: 0,
      incorrectas: 0,
      total: 0,
      puntaje: 0,
      porcentaje: 0,
      respuestas: [],
    },
    estrellas: 0,
    colorTema: "green",
    seleccionada: null,
    esCorrecta: null,
    mostrarConfeti: false,
    sonidosActivos: true,
    segundosRestantes: 0,
  });

  ngOnInit(): void {
    this.config.preguntas = this.generar();
    this.vista.set(this.inicial(1));
    this.gameUi.setJugando(true);
    void this.attempts.iniciar("conteo-figuras").then((s) => {
      this.intentoId = s?.id ?? null;
      this.intentoInicio = s?.inicio ?? Date.now();
    });
  }
  ngOnDestroy(): void {
    this.gameUi.setJugando(false);
    if (this.intentoId)
      void this.attempts.finalizar(this.intentoId, this.intentoInicio, {
        actividadId: "conteo-figuras",
        puntaje: this.vista().resultado.puntaje,
        nivel: this.vista().nivelSeleccionado,
        respuestasCorrectas: this.vista().resultado.correctas,
        respuestasIncorrectas: this.vista().resultado.incorrectas,
      });
  }
  private inicial(n: number): QuizViewModel {
    // Cada vez que se elige o reinicia un nivel, se mezcla el orden de sus 25 ejercicios
    const list = this.mezclar(this.config.preguntas.filter((p) => p.nivel === n));
    this.config.preguntas = [
      ...this.config.preguntas.filter((p) => p.nivel !== n),
      ...list,
    ];
    const total = list.length;
    return {
      config: this.config,
      estado: "intro",
      indice: 0,
      nivelSeleccionado: n,
      preguntaActual: list[0] ?? null,
      total,
      etiquetasNiveles: this.config.etiquetasNiveles ?? [],
      resultado: {
        correctas: 0,
        incorrectas: 0,
        total,
        puntaje: 0,
        porcentaje: 0,
        respuestas: [],
      },
      estrellas: 0,
      colorTema: "green",
      seleccionada: null,
      esCorrecta: null,
      mostrarConfeti: false,
      sonidosActivos: true,
      segundosRestantes: 0,
    };
  }

  // Convierte los 75 ejercicios (25 por nivel) al formato PreguntaQuiz
  private generar(): PreguntaQuiz[] {
    const niveles: Nivel[] = ["basico", "intermedio", "avanzado"];
    const ids = ["a", "b", "c", "d"];
    const out: PreguntaQuiz[] = [];
    niveles.forEach((nombre, idx) => {
      for (const e of EJERCICIOS[nombre]) {
        out.push({
          id: `cf-${e.id}`,
          enunciado: e.pregunta,
          imagen: svgDe(e.trazos), // gráfico del ejercicio (ver nota en quiz.model)
          tipo: "opcion-multiple" as TipoPregunta,
          nivel: idx + 1,
          opciones: e.opciones.map((o, i) => ({ id: ids[i], texto: String(o) })),
          respuestaCorrectaId: ids[e.opciones.indexOf(e.correcta)],
          explicacion: e.explicacion,
        });
      }
    });
    return out;
  }

  private mezclar<T>(a: T[]): T[] {
    const c = [...a];
    for (let i = c.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [c[i], c[j]] = [c[j], c[i]];
    }
    return c;
  }

  volver() {
    void this.router.navigateByUrl("/razonamiento-logico");
  }
  nivelElegido(n: number) {
    this.vista.set(this.inicial(n));
  }
  empezar() {
    this.vista.update((s) => ({
      ...s,
      estado: "jugando",
      seleccionada: null,
      esCorrecta: null,
    }));
  }
  respuestaSeleccionada(id: string) {
    const v = this.vista();
    const p = v.preguntaActual;
    if (!p || v.estado !== "jugando") return;
    const es = id === p.respuestaCorrectaId;
    this.vista.update((s) => ({
      ...s,
      seleccionada: id,
      esCorrecta: es,
      estado: "feedback",
      // El marcador se acumula aqui: avanzar() solo cierra la partida.
      resultado: {
        ...s.resultado,
        correctas: s.resultado.correctas + (es ? 1 : 0),
        incorrectas: s.resultado.incorrectas + (es ? 0 : 1),
        puntaje: s.resultado.puntaje + (es ? (p.puntos ?? 10) : 0),
        respuestas: [
          ...s.resultado.respuestas,
          { preguntaId: p.id, opcionId: id, correcta: es },
        ],
      },
    }));
  }
  avanzar() {
    const v = this.vista();
    const list = this.config.preguntas.filter(
      (p) => p.nivel === v.nivelSeleccionado,
    );
    const sig = v.indice + 1;
    if (sig < list.length) {
      this.vista.update((s) => ({
        ...s,
        indice: sig,
        preguntaActual: list[sig],
        estado: "jugando",
        seleccionada: null,
        esCorrecta: null,
      }));
    } else {
      const c = v.resultado.correctas;
      const t = list.length;
      const pct = t === 0 ? 0 : Math.round((c / t) * 100);
      this.vista.update((s) => ({
        ...s,
        estado: "resultado",
        resultado: {
          ...s.resultado,
          correctas: c,
          incorrectas: t - c,
          total: t,
          porcentaje: pct,
        },
        estrellas: pct >= 90 ? 3 : pct >= 70 ? 2 : pct >= 50 ? 1 : 0,
        mostrarConfeti: pct >= 70,
      }));
    }
  }
  reiniciar() {
    this.vista.set(this.inicial(this.vista().nivelSeleccionado));
  }
  alternarSonido() {
    this.vista.update((s) => ({ ...s, sonidosActivos: !s.sonidosActivos }));
  }
}
