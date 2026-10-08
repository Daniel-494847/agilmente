import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { onAuthStateChanged } from 'firebase/auth';

import { auth, NOMBRES_COLECCION } from '../../core/firebase';
import { ActividadResumen } from '../../core/models/actividad.model';
import { ContentService } from '../../core/services/content.service';
import { ActividadesService } from '../actividades/services/actividades.service';
import { ActivityCard } from '../../shared/components/activity-card/activity-card';

@Component({
  selector: 'app-dashboard',
  imports: [ActivityCard, RouterLink],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css'
})
export class Dashboard implements OnInit {
  private readonly activitiesService = inject(ActividadesService);
  private readonly content = inject(ContentService);

  readonly esVisitante = signal(true);
  // Zoneless: los datos asíncronos se guardan en signals para repintar la vista.
  readonly actividades = signal<ActividadResumen[]>([]);
  readonly comunicados = signal<{ id: string; titulo: string; fecha: string }[]>([]);
  readonly fotos = signal<{ id: string; url: string; alt: string }[]>([]);

  constructor() {
    onAuthStateChanged(auth, (user) => this.esVisitante.set(!user));
  }

  async ngOnInit(): Promise<void> {
    this.actividades.set(await this.activitiesService.listar());

    const [com, fotos] = await Promise.allSettled([
      this.content.listarPublicados<{ id: string; titulo: string; fecha: string }>(
        NOMBRES_COLECCION.comunicados
      ),
      this.content.listarPublicados<{ id: string; url: string; alt: string }>(
        NOMBRES_COLECCION.fotosGaleria
      )
    ]);

    if (com.status === 'fulfilled' && com.value.length) this.comunicados.set(com.value);
    if (fotos.status === 'fulfilled' && fotos.value.length) this.fotos.set(fotos.value);
  }
}
