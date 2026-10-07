import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { ActividadResumen } from '../../../core/models/actividad.model';
import { ActivityCard } from '../../../shared/components/activity-card/activity-card';
import { ActividadesService } from '../services/actividades.service';

@Component({
  selector: 'app-actividades',
  imports: [ActivityCard, RouterLink],
  templateUrl: './actividades.html'
})
export class Actividades implements OnInit {
  private readonly service = inject(ActividadesService);

  // La app es zoneless: la carga asíncrona debe vivir en signals para que
  // la vista se vuelva a renderizar cuando llegan las actividades.
  readonly actividades = signal<ActividadResumen[]>([]);
  readonly cargando = signal(true);

  async ngOnInit(): Promise<void> {
    try {
      this.actividades.set(await this.service.listar());
    } finally {
      this.cargando.set(false);
    }
  }
}
