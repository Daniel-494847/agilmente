import { Component } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';

/**
 * Menú de Operaciones Básicas.
 *
 * Usa exactamente la misma estructura visual que `matematicas-interactivas`
 * (tarjetas de operación + outlet para el juego hijo). Cada tarjeta abre el
 * duelo en formato individual del tipo de operación correspondiente.
 */
@Component({
  selector: 'app-operaciones-basicas-menu',
  standalone: true,
  imports: [RouterLink, RouterOutlet],
  templateUrl: './operaciones-basicas-menu.html',
  styleUrl: './operaciones-basicas-menu.css'
})
export class OperacionesBasicasMenu {}
