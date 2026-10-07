import { Component } from '@angular/core';
import { DueloMatematico } from '../duelo-matematico/duelo-matematico';

@Component({
  selector: 'app-multiplicacion',
  standalone: true,
  imports: [DueloMatematico],
  templateUrl: './multiplicacion.html'
})
export class Multiplicacion {}
