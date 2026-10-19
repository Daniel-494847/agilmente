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
import { EJERCICIOS, Nivel, svgDe } from "./conteo-figuras.data";

@Component({
  selector: "app-conteo-figuras",
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
export class ConteoFiguras extends JuegoQuizBase {

  protected readonly config: ConfiguracionQuiz = {
    titulo: "Conteo de Figuras",
    descripcion: "Cuenta figuras, segmentos, ángulos y triángulos.",
    colorTema: "green",
    niveles: 3,
    preguntasPorNivel: 25,
    etiquetasNiveles: ["Básico", "Intermedio", "Avanzado"],
    preguntas: [],
  };
  protected readonly slug = 'conteo-figuras';



// Convierte los 75 ejercicios (25 por nivel) al formato PreguntaQuiz
  protected generar(): PreguntaQuiz[] {
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



}
