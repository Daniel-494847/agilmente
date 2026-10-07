import { Component, OnInit, inject, signal } from '@angular/core';

import { NOMBRES_COLECCION } from '../../core/firebase';
import { ContentService } from '../../core/services/content.service';

interface Comunicado {
  id: string;
  titulo: string;
  fecha: string;
  colorDot?: 'red' | 'blue' | 'green';
  publicado?: boolean;
  destacado?: boolean;
}

@Component({
  selector: 'app-avisos',
  templateUrl: './avisos.html'
})
export class Avisos implements OnInit {
  private readonly content = inject(ContentService);

  readonly items = signal<Comunicado[]>([]);
  readonly cargando = signal(true);
  readonly error = signal('');

  async ngOnInit(): Promise<void> {
    try {
      const lista = await this.content.listarPublicados<Comunicado>(NOMBRES_COLECCION.comunicados);
      this.items.set(lista);
    } catch {
      this.error.set('No se pudieron cargar los avisos.');
    } finally {
      this.cargando.set(false);
    }
  }

  colorClass(dot?: string): string {
    if (dot === 'red') return 'bg-danger';
    if (dot === 'green') return 'bg-success';
    return 'bg-primary';
  }
}
