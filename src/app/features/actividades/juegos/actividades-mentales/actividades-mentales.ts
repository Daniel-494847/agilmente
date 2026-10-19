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

@Component({
  selector: "app-actividades-mentales",
  standalone: true,
  imports: [Quiz],
  providers: [QuizEngine],
  template: `
    <app-quiz
      [vista]="engine.vista()"
      rutaVolver="/razonamiento-logico"
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
export class ActividadesMentales extends JuegoQuizBase {

  protected readonly config: ConfiguracionQuiz = {
    titulo: "Actividades Mentales",
    descripcion: "Entrena tu cálculo mental.",
    colorTema: "green",
    niveles: 3,
    preguntasPorNivel: 5,
    etiquetasNiveles: ["Inicial", "Práctica", "Intermedio"],
    preguntas: [],
  };
  protected readonly slug = 'actividades-mentales';



protected generar(): PreguntaQuiz[] {
    const out: PreguntaQuiz[] = [];
    for (let n = 1; n <= 3; n++) {
      for (let i = 0; i < 5; i++) {
        const a = 5 + i + n;
        const b = 3 + i;
        out.push({
          id: `am-${n}-${i}`,
          enunciado: `Calcula mentalmente: ${a} + ${b}`,
          tipo: "opcion-multiple" as TipoPregunta,
          nivel: n,
          opciones: [
            { id: "a", texto: String(a + b) },
            { id: "b", texto: String(a + b + 2) },
            { id: "c", texto: String(a + b - 1) },
            { id: "d", texto: String(a * 2) },
          ],
          respuestaCorrectaId: "a",
          explicacion: `${a} + ${b} = ${a + b}.`,
        });
      }
    }
    return out;
  }

  /** Baraja el orden de una lista (Fisher-Yates) con el azar de la partida. */
  private mezclar<T>(a: T[]): T[] {
    const c = [...a];
    for (let i = c.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [c[i], c[j]] = [c[j], c[i]];
    }
    return c;
  }



}
