import { Component, Input, inject, computed } from '@angular/core';
import { RouterLink } from '@angular/router';

import { AuthService } from '@core/auth/auth.service';
import { UsuarioResumen } from '@core/models/usuario.model';
import { NotificacionesAsignaciones } from '@shared/components/notificaciones-asignaciones/notificaciones-asignaciones';

@Component({
  selector: 'app-topbar',
  standalone: true,
  imports: [RouterLink, NotificacionesAsignaciones],
  templateUrl: './topbar.html',
  styleUrl: './topbar.css'
})
export class Topbar {
  private readonly auth = inject(AuthService);

  /** Puntos, nivel y título vienen del progreso real del usuario. */
  @Input({ required: true }) usuario!: UsuarioResumen;
  readonly esVisitante = computed(() => !this.auth.isAuthenticated());
  readonly esAdministrador = this.auth.esAdministrador;

  constructor() {
    // AuthService gestiona la sesión; nada que suscribir aquí.
  }
}
