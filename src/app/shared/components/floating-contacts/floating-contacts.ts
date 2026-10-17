import { Component, OnInit, computed, inject, signal } from '@angular/core';

import { NOMBRES_COLECCION } from '@core/firebase';
import { ContentService } from '@core/services/content.service';
import { GameUiService } from '@core/services/game-ui.service';
import { Contacto } from '@features/contactos/models/contacto.model';
import { ContactoService } from '@features/contactos/services/contacto.service';

/**
 * Botones flotantes (FAB) de contacto, visibles en toda la app.
 *
 * Muestra el canal principal (WhatsApp si existe, si no el primero) como
 * botón circular fijo en la esquina inferior derecha. Si hay más canales,
 * un segundo botón los despliega hacia arriba.
 *
 * Reglas del proyecto:
 * - Los colores los ponen las variantes `.btn-*` de Bootstrap según el tipo
 *   de contacto; el CSS propio solo toca tamaño y movimiento.
 * - Se oculta en modo juego (GameUiService.jugando), como el topbar.
 */
@Component({
  selector: 'app-floating-contacts',
  imports: [],
  templateUrl: './floating-contacts.html',
  styleUrl: './floating-contacts.css'
})
export class FloatingContacts implements OnInit {
  private readonly content = inject(ContentService);
  readonly contacto = inject(ContactoService);
  private readonly gameUi = inject(GameUiService);

  readonly jugando = this.gameUi.jugando;
  readonly cargando = signal(true);
  readonly abierto = signal(false);
  private readonly contactosPrivados = signal<Contacto[]>([]);

  /** Solo se pinta si no se está jugando y hay canales publicados. */
  readonly visible = computed(
    () => !this.jugando() && !this.cargando() && this.contactosPrivados().length > 0
  );

  /** WhatsApp primero (el canal más usado); luego teléfono, correo y el resto. */
  private readonly ordenados = computed<Contacto[]>(() => {
    const prioridad = (c: Contacto): number => {
      if (c.tipo === 'whatsapp') return 0;
      if (c.tipo === 'telefono') return 1;
      if (c.tipo === 'correo') return 2;
      return 3;
    };
    return [...this.contactosPrivados()].sort(
      (a, b) => prioridad(a) - prioridad(b) || a.nombre.localeCompare(b.nombre)
    );
  });

  /** Botón principal: el primero de la lista ordenada. */
  readonly principal = computed<Contacto | null>(() => this.ordenados()[0] ?? null);

  /** Canales que se despliegan al abrir el menú (todos menos el principal). */
  readonly secundarios = computed<Contacto[]>(() => this.ordenados().slice(1));

  async ngOnInit(): Promise<void> {
    try {
      const lista = await this.content.listarPublicados<Contacto>(NOMBRES_COLECCION.contactos);
      this.contactosPrivados.set(lista);
    } finally {
      this.cargando.set(false);
    }
  }

  alternar(): void {
    this.abierto.update((v) => !v);
  }

  cerrar(): void {
    this.abierto.set(false);
  }
}
