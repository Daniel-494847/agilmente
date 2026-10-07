import { Component } from '@angular/core';
import { DueloMatematico } from '../duelo-matematico/duelo-matematico';

@Component({
  selector: 'app-sumas',
  standalone: true,
  imports: [DueloMatematico],
  templateUrl: './sumas.html'
})
export class Sumas {}
