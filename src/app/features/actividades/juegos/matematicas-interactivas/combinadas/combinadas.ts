import { Component } from '@angular/core';
import { DueloMatematico } from '@features/actividades/juegos/matematicas-interactivas/duelo-matematico/duelo-matematico';

@Component({
  selector: 'app-combinadas',
  standalone: true,
  imports: [DueloMatematico],
  templateUrl: './combinadas.html'
})
export class Combinadas {}
