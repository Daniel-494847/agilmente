import { Component, DestroyRef, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';

import { UsuarioResumen } from '@core/models/usuario.model';
import { AuthService } from '@core/auth/auth.service';
import { GameUiService } from '@core/services/game-ui.service';
import { UserProgressService } from '@core/services/user-progress.service';
import { Sidebar } from '@layout/sidebar/sidebar';
import { Topbar } from '@layout/topbar/topbar';
import { FloatingContacts } from '@shared/components/floating-contacts/floating-contacts';

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, Sidebar, Topbar, FloatingContacts],
  templateUrl: './shell.html',
  styleUrl: './shell.css'
})
export class Shell {
  private readonly destroyRef = inject(DestroyRef);
  private readonly progress = inject(UserProgressService);
  private readonly gameUi = inject(GameUiService);
  private readonly auth = inject(AuthService);

  protected readonly isAuthenticated = this.auth.isAuthenticated;
  protected readonly jugando = this.gameUi.jugando;

  readonly usuario = signal<UsuarioResumen>({
    nombre: 'Usuario',
    rol: 'estudiante',
    puntos: 0,
    nivel: 1,
    tituloNivel: 'Explorador',
    avatarUrl: ''
  });

  constructor(private readonly router: Router) {
    effect(() => {
      const p = this.progress.progreso();
      this.usuario.update((u) => ({
        ...u,
        puntos: p.puntos,
        nivel: p.nivel,
        tituloNivel: p.tituloNivel
      }));
    });

    effect(() => {
      const u = this.auth.user();
      const rol = this.auth.rol();
      if (u) {
        const nombreGuardado =
          localStorage.getItem('agilmente_user_name') ?? u.displayName ?? 'Usuario';
        this.usuario.set({
          nombre: this.auth.formatearNombre(nombreGuardado),
          rol,
          puntos: this.progress.progreso().puntos,
          nivel: this.progress.progreso().nivel,
          tituloNivel: this.progress.progreso().tituloNivel,
          avatarUrl: u.photoURL ?? ''
        });
      } else {
        this.usuario.set({
          nombre: 'Usuario',
          rol: 'estudiante',
          puntos: 0,
          nivel: 1,
          tituloNivel: 'Explorador',
          avatarUrl: ''
        });
      }
    });

    this.router.events.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((event) => {
      if (event instanceof NavigationEnd) {
        // estado ya gestionado por AuthService; noop
      }
    });
  }
}
