import { Component, DestroyRef, Input, inject, computed } from '@angular/core';
import { RouterLink } from '@angular/router';

import { AuthService } from '@core/auth/auth.service';
import { UsuarioResumen } from '@core/models/usuario.model';

@Component({
  selector: 'app-topbar',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './topbar.html',
  styleUrl: './topbar.css'
})
export class Topbar {
  private readonly destroyRef = inject(DestroyRef);
  private readonly auth = inject(AuthService);

  /** Puntos, nivel y título vienen del progreso real del usuario. */
  @Input({ required: true }) usuario!: UsuarioResumen;
  readonly esVisitante = computed(() => !this.auth.isAuthenticated());
  readonly esAdministrador = this.auth.esAdministrador;

  constructor() {
    // AuthService gestiona la sesión; nada que suscribir aquí.
  }
}
