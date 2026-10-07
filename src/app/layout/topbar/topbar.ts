import { Component, Input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { onAuthStateChanged } from 'firebase/auth';

import { auth } from '../../core/firebase';
import { UserRoleService } from '../../core/auth/user-role.service';
import { UsuarioResumen } from '../../core/models/usuario.model';

@Component({
  selector: 'app-topbar',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './topbar.html'
})
export class Topbar {
  /** Puntos, nivel y título vienen del progreso real del usuario. */
  @Input({ required: true }) usuario!: UsuarioResumen;
  readonly esVisitante = signal(true);
  readonly esAdministrador = signal(false);

  constructor(private readonly userRoleService: UserRoleService) {
    onAuthStateChanged(auth, async (user) => {
      this.esVisitante.set(!user);
      if (!user) {
        this.esAdministrador.set(false);
        return;
      }
      try {
        this.esAdministrador.set(await this.userRoleService.esAdministrador(user));
      } catch {
        this.esAdministrador.set(false);
      }
    });
  }
}
