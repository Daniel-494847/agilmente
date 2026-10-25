import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { RouterLink } from '@angular/router';

import { NOMBRES_COLECCION } from '@core/firebase';
import { ActividadResumen } from '@core/models/actividad.model';
import { AuthService } from '@core/auth/auth.service';
import { ContentService } from '@core/services/content.service';
import { ActividadesService } from '@features/actividades/services/actividades.service';
import { Contacto } from '@features/contactos/models/contacto.model';
import { ContactoService } from '@features/contactos/services/contacto.service';
import { ActivityCard } from '@shared/components/activity-card/activity-card';

@Component({
  selector: 'app-dashboard',
  imports: [ActivityCard, RouterLink],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css'
})
export class Dashboard implements OnInit {
  private readonly activitiesService = inject(ActividadesService);
  private readonly content = inject(ContentService);
  private readonly auth = inject(AuthService);
  readonly contacto = inject(ContactoService);

  readonly esVisitante = computed(() => !this.auth.isAuthenticated());
  // Zoneless: los datos asíncronos se guardan en signals para repintar la vista.
  readonly actividades = signal<ActividadResumen[]>([]);
  readonly comunicados = signal<{ id: string; titulo: string; fecha: string }[]>([]);
  readonly fotos = signal<{ id: string; url: string; alt: string }[]>([]);
  readonly contactos = signal<Contacto[]>([]);

  async ngOnInit(): Promise<void> {
    this.actividades.set(await this.activitiesService.listar());

    const [com, fotos, contactos] = await Promise.allSettled([
      this.content.listarPublicados<{ id: string; titulo: string; fecha: string }>(
        NOMBRES_COLECCION.comunicados,
        5
      ),
      this.content.listarPublicados<{ id: string; url: string; alt: string }>(
        NOMBRES_COLECCION.fotosGaleria,
        4
      ),
      this.content.listarPublicados<Contacto>(NOMBRES_COLECCION.contactos, 4)
    ]);

    if (com.status === 'fulfilled' && com.value.length) this.comunicados.set(com.value);
    if (fotos.status === 'fulfilled' && fotos.value.length) this.fotos.set(fotos.value);
    if (contactos.status === 'fulfilled' && contactos.value.length) this.contactos.set(contactos.value);
  }
}
