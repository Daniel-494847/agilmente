import { Component } from '@angular/core';
import { DueloMatematico } from '../duelo-matematico/duelo-matematico';

@Component({
  selector: 'app-restas',
  standalone: true,
  imports: [DueloMatematico],
  templateUrl: './restas.html'
})
export class Restas {}
