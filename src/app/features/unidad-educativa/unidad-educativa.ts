import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { onAuthStateChanged } from 'firebase/auth';

import { auth } from '@core/firebase';
import { UserRoleService } from '@core/auth/user-role.service';
import { DatosUnidadEducativa } from '@features/unidad-educativa/models/unidad-educativa.model';
import { UnidadEducativaService } from '@features/unidad-educativa/services/unidad-educativa.service';

interface EnlaceSeccion {
  title: string;
  description: string;
  icon: string;
  route: string;
  externalUrl?: string;
}

/**
 * Vista institucional para estudiantes: muestra la información de la Unidad
 * Educativa publicada por el administrador (colección `unidad-educativa`).
 */
@Component({
  selector: 'app-unidad-educativa',
  imports: [RouterLink],
  templateUrl: './unidad-educativa.html'
})
export class UnidadEducativa implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly servicio = inject(UnidadEducativaService);
  private readonly roles = inject(UserRoleService);

  readonly cargando = signal(true);
  readonly error = signal('');
  readonly datos = signal<DatosUnidadEducativa | null>(null);
  readonly titulo = signal('Unidad Educativa');
  readonly descripcion = signal('Conoce la comunidad, valores y espacios de aprendizaje.');
  readonly badge = signal('Institución');
  readonly enlaces = signal<EnlaceSeccion[]>([]);
  readonly esAdmin = signal(false);

  async ngOnInit(): Promise<void> {
    const data = this.route.snapshot.data;
    this.titulo.set((data['title'] as string) ?? this.titulo());
    this.descripcion.set((data['description'] as string) ?? this.descripcion());
    this.badge.set((data['badge'] as string) ?? this.badge());
    this.enlaces.set((data['items'] as EnlaceSeccion[]) ?? []);

    onAuthStateChanged(auth, async (user) => {
      this.esAdmin.set(user ? await this.roles.esAdministrador(user) : false);
    });

    try {
      this.datos.set(await this.servicio.obtener());
    } catch {
      this.error.set('No se pudo cargar la información institucional. Revisa tu conexión.');
    } finally {
      this.cargando.set(false);
    }
  }
}
