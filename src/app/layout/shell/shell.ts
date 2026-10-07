import { Component, effect, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { onAuthStateChanged } from 'firebase/auth';

import { auth } from '../../core/firebase';
import { UsuarioResumen } from '../../core/models/usuario.model';
import { GameUiService } from '../../core/services/game-ui.service';
import { UserProgressService } from '../../core/services/user-progress.service';
import { Sidebar } from '../sidebar/sidebar';
import { Topbar } from '../topbar/topbar';

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, Sidebar, Topbar],
  templateUrl: './shell.html',
  styleUrl: './shell.css'
})
export class Shell {
  private readonly progress = inject(UserProgressService);
  private readonly gameUi = inject(GameUiService);

  protected readonly isAuthenticated = signal(false);
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
    // Cuando el progreso se actualiza (tras un juego), reflejar en topbar
    effect(() => {
      const p = this.progress.progreso();
      this.usuario.update((u) => ({
        ...u,
        puntos: p.puntos,
        nivel: p.nivel,
        tituloNivel: p.tituloNivel
      }));
    });

    this.router.events.subscribe((event) => {
      if (event instanceof NavigationEnd) {
        this.isAuthenticated.set(!!auth.currentUser);
      }
    });

    onAuthStateChanged(auth, async (user) => {
      this.isAuthenticated.set(!!user);
      if (user) {
        const nombreGuardado =
          localStorage.getItem('agilmente_user_name') ?? user.displayName ?? 'Usuario';
        this.usuario.set({
          nombre: this.formatearNombre(nombreGuardado),
          rol: 'estudiante',
          puntos: this.progress.progreso().puntos,
          nivel: this.progress.progreso().nivel,
          tituloNivel: this.progress.progreso().tituloNivel,
          avatarUrl: user.photoURL ?? ''
        });
        await this.progress.refrescar();
      } else {
        this.progress.reset();
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
  }

  private formatearNombre(nombre: string): string {
    return nombre
      .trim()
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean)
      .map((parte) => parte.charAt(0).toUpperCase() + parte.slice(1))
      .join(' ');
  }
}
