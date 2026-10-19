import { Component } from "@angular/core";
import { Router } from "@angular/router";
import { AttemptsService } from "@core/services/attempts.service";
import { GameUiService } from "@core/services/game-ui.service";
import { QuizEngine } from '@core/services/quiz-engine.service';
import { JuegoQuizBase } from '@core/services/juego-quiz-base';
import { Quiz } from "@shared/components/quiz/quiz";
import {
  ConfiguracionQuiz,
  PreguntaQuiz,
  TipoPregunta,
} from "@shared/components/quiz/quiz.model";

import { EJERCICIOS, Nivel, svgDe } from "./relaciones-analogias.data";

// Relaciones y Analogías: 25 ejercicios por nivel, todos de razonamiento
// lógico-matemático (analogías numéricas y analogías de figuras por su número
// de lados). Toda la partida se juega sobre la plantilla compartida `app-quiz`;
// lo único propio del juego es la generación de `preguntas`, que sale del banco
// de ejercicios (relaciones-analogias.data.ts).
@Component({
  selector: "app-relaciones-analogias",
  standalone: true,
  imports: [Quiz],
  providers: [QuizEngine],
  template: `
    <app-quiz
      [vista]="engine.vista()"
      (volver)="engine.volver()"
      (nivelElegido)="engine.nivelElegido($event)"
      (empezar)="engine.empezar()"
      (respuestaSeleccionada)="engine.responder($event)"
      (avanzar)="engine.avanzar()"
      (reiniciar)="engine.reiniciar()"
      (alternarSonido)="engine.alternarSonido()"
    />
  `,
})
export class RelacionesAnalogias extends JuegoQuizBase {

  protected readonly config: ConfiguracionQuiz = {
    titulo: "Relaciones y Analogías",
    descripcion:
      "Completa analogías numéricas y con figuras descubriendo la regla matemática que las relaciona.",
    colorTema: "purple",
    niveles: 3,
    preguntasPorNivel: 25,
    etiquetasNiveles: ["Básico", "Intermedio", "Avanzado"],
    escalaEnunciado: 1.4,
    preguntas: [],
  };
  protected readonly slug = 'relaciones-analogias';



// Convierte los 75 ejercicios (25 por nivel) al formato PreguntaQuiz
  protected generar(): PreguntaQuiz[] {
    const niveles: Nivel[] = ["basico", "intermedio", "avanzado"];
    const ids = ["a", "b", "c", "d"];
    const out: PreguntaQuiz[] = [];
    niveles.forEach((nombre, idx) => {
      for (const e of EJERCICIOS[nombre]) {
        out.push({
          id: `ra-${e.id}`,
          enunciado: e.pregunta,
          imagen: e.trazos.length ? svgDe(e.trazos) : undefined,
          tipo: "opcion-multiple" as TipoPregunta,
          nivel: idx + 1,
          opciones: e.opciones.map((o, i) => ({ id: ids[i], texto: o })),
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



}
