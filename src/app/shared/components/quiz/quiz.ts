import { Component, EventEmitter, Input, Output } from '@angular/core';
import { RouterLink } from '@angular/router';

import { QuizViewModel } from './quiz.model';
import { SvgSeguroPipe } from '../../pipes/svg-seguro.pipe';

@Component({
  selector: 'app-quiz',
  standalone: true,
  imports: [RouterLink, SvgSeguroPipe],
  templateUrl: './quiz.html',
  styleUrl: './quiz.css'
})
export class Quiz {
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
