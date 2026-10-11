import { Component } from '@angular/core';
import { DueloMatematico } from '@features/actividades/juegos/matematicas-interactivas/duelo-matematico/duelo-matematico';

@Component({
  selector: 'app-restas',
  standalone: true,
  imports: [DueloMatematico],
  templateUrl: './restas.html'
})
export class Restas {}
