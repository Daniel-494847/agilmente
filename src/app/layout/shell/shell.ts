import { Component, DestroyRef, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';

import { UsuarioResumen } from '@core/models/usuario.model';
import { AuthService } from '@core/auth/auth.service';
import { GameUiService } from '@core/services/game-ui.service';
import { UsuarioService } from '@core/services/usuario.service';
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
  private readonly usuarios = inject(UsuarioService);

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
        // Nombre provisional (caché o Auth) para pintar de inmediato; luego se
        // sustituye por el `nombreCompleto` real del documento `usuarios`.
        this.usuario.update((actual) => ({
          ...actual,
          nombre: this.nombreProvisional(u.displayName, u.email),
          rol,
          avatarUrl: u.photoURL ?? actual.avatarUrl
        }));
        void this.cargarPerfilReal(u.uid);
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

  /**
   * Nombre que se pinta antes de leer Firestore: la caché local, el
   * `displayName` de Auth o la parte local del correo. Nunca queda vacío.
   */
  private nombreProvisional(displayName: string | null, email: string | null): string {
    let guardado: string | null = null;
    try {
      guardado = localStorage.getItem('agilmente_user_name');
    } catch {
      guardado = null;
    }
    const crudo =
      guardado?.trim() || displayName?.trim() || (email ? email.split('@')[0] : '') || 'Usuario';
    return this.auth.formatearNombre(crudo);
  }

  /**
   * Lee el `nombreCompleto` del documento `usuarios`.
   *
   * Es la fuente real del nombre (el docente creado por el administrador no
   * tiene `displayName` en Auth), así que la topbar deja de mostrar «Usuario».
   */
  private async cargarPerfilReal(uid: string): Promise<void> {
    const perfil = await this.usuarios.obtenerPerfil(uid).catch(() => null);
    // Si la sesión cambió mientras se leía, se descarta el resultado.
    if (!perfil || this.auth.user()?.uid !== uid) {
      return;
    }

    const nombre = perfil.nombreCompleto?.trim();
    if (nombre) {
      try {
        localStorage.setItem('agilmente_user_name', nombre);
      } catch {
        // Sin almacenamiento local: solo se pierde la caché del nombre.
      }
      this.usuario.update((actual) => ({
        ...actual,
        nombre: this.auth.formatearNombre(nombre)
      }));
    }

    if (perfil.avatarUrl) {
      const avatar = perfil.avatarUrl;
      this.usuario.update((actual) => ({ ...actual, avatarUrl: avatar }));
    }
  }
}
