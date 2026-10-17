import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { onAuthStateChanged } from 'firebase/auth';

import { auth, NOMBRES_COLECCION } from '@core/firebase';
import { ActividadResumen } from '@core/models/actividad.model';
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
  private readonly destroyRef = inject(DestroyRef);
  private readonly activitiesService = inject(ActividadesService);
  private readonly content = inject(ContentService);
  readonly contacto = inject(ContactoService);

  readonly esVisitante = signal(true);
  // Zoneless: los datos asíncronos se guardan en signals para repintar la vista.
  readonly actividades = signal<ActividadResumen[]>([]);
  readonly comunicados = signal<{ id: string; titulo: string; fecha: string }[]>([]);
  readonly fotos = signal<{ id: string; url: string; alt: string }[]>([]);
  readonly contactos = signal<Contacto[]>([]);

  constructor() {
    const unsub = onAuthStateChanged(auth, (user) => this.esVisitante.set(!user));
    this.destroyRef.onDestroy(() => unsub());
  }

  async ngOnInit(): Promise<void> {
    this.actividades.set(await this.activitiesService.listar());

    const [com, fotos, contactos] = await Promise.allSettled([
      this.content.listarPublicados<{ id: string; titulo: string; fecha: string }>(
        NOMBRES_COLECCION.comunicados
      ),
      this.content.listarPublicados<{ id: string; url: string; alt: string }>(
        NOMBRES_COLECCION.fotosGaleria
      ),
      this.content.listarPublicados<Contacto>(NOMBRES_COLECCION.contactos)
    ]);

    if (com.status === 'fulfilled' && com.value.length) this.comunicados.set(com.value);
    if (fotos.status === 'fulfilled' && fotos.value.length) this.fotos.set(fotos.value);
    if (contactos.status === 'fulfilled' && contactos.value.length) this.contactos.set(contactos.value);
  }
}
