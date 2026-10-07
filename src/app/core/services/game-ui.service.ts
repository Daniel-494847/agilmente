import { Injectable, signal } from '@angular/core';

/** Controla el modo pantalla completa de juegos (sidebar compacto). */
@Injectable({ providedIn: 'root' })
export class GameUiService {
  readonly jugando = signal(false);

  setJugando(jugando: boolean): void {
    this.jugando.set(jugando);
  }
}
