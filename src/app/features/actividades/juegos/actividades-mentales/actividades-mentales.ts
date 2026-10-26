import { Component } from "@angular/core";
import { QuizEngine } from '@core/services/quiz-engine.service';
import { JuegoQuizBase } from '@core/services/juego-quiz-base';
import { Quiz } from "@shared/components/quiz/quiz";
import {
  ConfiguracionQuiz,
  PreguntaQuiz,
  TipoPregunta,
} from "@shared/components/quiz/quiz.model";
import { EJERCICIOS } from "./actividades-mentales.data";

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
    descripcion: "Entrena tu agilidad mental con conteo rapido y comparaciones.",
    colorTema: "green",
    niveles: 3,
    preguntasPorNivel: 8,
    etiquetasNiveles: ["Inicial", "Intermedio", "Avanzado"],
    preguntas: [],
  };
  protected readonly slug = 'actividades-mentales';

  /**
   * Los 45 ejercicios (15 por nivel) ya vienen generados y con las opciones
   * barajadas en `actividades-mentales.data.ts`; aquí solo se traducen al
   * formato de la plantilla.
   */
  protected generar(): PreguntaQuiz[] {
    return EJERCICIOS.map((e) => {
      const opciones = e.opciones.map((texto, i) => ({
        id: String.fromCharCode(97 + i),
        texto
      }));
      // La opción correcta puede estar en cualquier posición: el barajado
      // ocurre al armar el ejercicio, no aquí.
      const indiceCorrecto = e.opciones.indexOf(e.correcta);
      return {
        id: e.id,
        enunciado: e.enunciado,
        imagen: e.imagen,
        tipo: "opcion-multiple" as TipoPregunta,
        nivel: e.nivel,
        opciones,
        respuestaCorrectaId: opciones[indiceCorrecto]?.id ?? opciones[0].id,
        explicacion: e.explicacion
      };
    });
  }
}
