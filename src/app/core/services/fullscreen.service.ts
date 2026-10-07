import { DOCUMENT } from '@angular/common';
import { Injectable, inject, signal } from '@angular/core';

/**
 * Envoltura de la Fullscreen API del navegador con `signal`, para que la
 * interfaz (botón salir, icono, aviso) reaccione sola.
 *
 * Si el navegador no soporta la API (iPhone, WebViews), `soportado()` es
 * `false` y el juego sigue funcionando "a pantalla completa" gracias al layout
 * fijo de 100dvh que usan los juegos.
 */
@Injectable({ providedIn: 'root' })
export class FullscreenService {
  private readonly doc = inject(DOCUMENT);

  /** `true` mientras el documento está en pantalla completa. */
  readonly activo = signal(false);
  /** `false` cuando el navegador no expone la Fullscreen API. */
  readonly soportado = signal(false);

  constructor() {
    this.soportado.set(typeof this.doc.documentElement?.requestFullscreen === 'function');
    // El usuario puede salir con Esc: el estado se sincroniza solo.
    this.doc.addEventListener('fullscreenchange', () => this.activo.set(!!this.doc.fullscreenElement));
    this.activo.set(!!this.doc.fullscreenElement);
  }

  /** Entra en pantalla completa. Devuelve `false` si el navegador lo bloquea. */
  async activar(): Promise<boolean> {
    if (this.activo()) return true;
    if (!this.soportado()) return false;

    try {
      await this.doc.documentElement.requestFullscreen({ navigationUI: 'hide' });
    } catch {
      // Requiere un gesto de usuario y puede estar bloqueado por permisos.
    }
    this.activo.set(!!this.doc.fullscreenElement);
    return this.activo();
  }

  /** Sale de pantalla completa (no hace nada si ya se salió con Esc). */
  async salir(): Promise<void> {
    if (!this.activo() || typeof this.doc.exitFullscreen !== 'function') return;

    try {
      await this.doc.exitFullscreen();
    } catch {
      // Nada que hacer: el juego se cierra igualmente.
    }
    this.activo.set(!!this.doc.fullscreenElement);
  }
}
