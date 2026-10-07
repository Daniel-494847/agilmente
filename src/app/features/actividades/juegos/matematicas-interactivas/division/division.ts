import { Component } from '@angular/core';
import { DueloMatematico } from '../duelo-matematico/duelo-matematico';

@Component({
  selector: 'app-division',
  standalone: true,
  imports: [DueloMatematico],
  templateUrl: './division.html'
})
export class Division {}
