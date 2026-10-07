import { Component, EventEmitter, Input, Output } from '@angular/core';
import { RouterLink } from '@angular/router';

import { QuizViewModel } from './quiz.model';

@Component({
  selector: 'app-quiz',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './quiz.html',
  styleUrl: './quiz.css'
})
export class Quiz {
  @Input() vm?: QuizViewModel;
  @Input() config?: QuizViewModel['config'];
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
}
