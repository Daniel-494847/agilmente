import { Injectable, signal, computed, inject } from '@angular/core';
import { User, onAuthStateChanged, signOut } from 'firebase/auth';

import { auth } from '@core/firebase';
import { UserRoleService } from './user-role.service';
import { RolUsuario, esEmailAdministrador } from '@core/models/usuario.model';
import { UsuarioService } from '@core/services/usuario.service';
import { UserProgressService } from '@core/services/user-progress.service';

/**
 * Fuente única de verdad de la sesión. Inicializa `onAuthStateChanged` una
 * sola vez y expone el usuario y su rol como signals para que Shell, Sidebar,
 * Topbar, Dashboard y los guards los consuman sin duplicar suscripciones.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly userRole = inject(UserRoleService);
  private readonly usuarios = inject(UsuarioService);
  private readonly progress = inject(UserProgressService);

  /** Se resuelve tras el primer `onAuthStateChanged`. */
  readonly ready: Promise<void>;

  private resolveReady!: () => void;

  readonly user = signal<User | null>(null);
  readonly rol = signal<RolUsuario>('estudiante');
  /** `true` cuando el administrador restableció la contraseña y debe cambiarla. */
  readonly debeCambiarPassword = signal(false);

  readonly isAuthenticated = computed(() => !!this.user());
  // Solo el correo del administrador único puede ejercer como administrador,
  // aunque un documento antiguo conserve el rol «administrador».
  readonly esAdministrador = computed(
    () => this.rol() === 'administrador' && esEmailAdministrador(this.user()?.email)
  );
  readonly esDocente = computed(() => this.rol() === 'docente' || this.esAdministrador());

  constructor() {
    this.ready = new Promise<void>((resolve) => (this.resolveReady = resolve));

    onAuthStateChanged(auth, async (u) => {
      if (u) {
        // Solo entran las cuentas creadas por el administrador. Si una cuenta
        // de Auth no tiene perfil, se cierra la sesión: no hay autorregistro.
        const perfil = await this.usuarios.obtenerPerfil(u.uid).catch(() => null);
        if (!perfil && !esEmailAdministrador(u.email)) {
          await signOut(auth).catch(() => undefined);
          this.user.set(null);
          this.rol.set('estudiante');
          this.debeCambiarPassword.set(false);
          this.progress.reset();
          this.resolveReady();
          return;
        }

        this.user.set(u);
        this.debeCambiarPassword.set(
          perfil?.debeCambiarPassword === true || (await this.tieneCambioPendiente(u))
        );
        try {
          this.rol.set(await this.userRole.obtenerRol(u));
        } catch {
          this.rol.set('estudiante');
        }
        await this.progress.refrescar();
      } else {
        this.user.set(null);
        this.rol.set('estudiante');
        this.debeCambiarPassword.set(false);
        this.progress.reset();
      }
      this.resolveReady();
    });
  }

  async cerrarSesion(): Promise<void> {
    try {
      if (auth.currentUser) await signOut(auth);
      localStorage.removeItem('agilmente_user_name');
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    }
  }

  /**
   * Vuelve a leer el rol del usuario actual. Se usa después de crear o reparar
   * el perfil (por ejemplo, para reconocer al administrador único al entrar).
   */
  async refrescarRol(): Promise<void> {
    const u = this.user();
    if (!u) {
      this.rol.set('estudiante');
      return;
    }
    try {
      this.rol.set(await this.userRole.obtenerRol(u));
    } catch {
      this.rol.set('estudiante');
    }
  }

  /**
   * Vuelve a leer la marca de cambio de contraseña del token. Con `force`
   * pide un token nuevo, necesario después de cambiarla.
   */
  async refrescarPasswordFlag(force = false): Promise<void> {
    const u = this.user() ?? auth.currentUser;
    if (!u) {
      this.debeCambiarPassword.set(false);
      return;
    }

    const tokenPendiente = await this.tieneCambioPendiente(u, force, true);
    if (tokenPendiente) {
      this.debeCambiarPassword.set(true);
      return;
    }

    // El perfil es el respaldo si la función alcanzó a marcarlo pero el token
    // todavía no trae la reclamación.
    const perfil = await this.usuarios.obtenerPerfil(u.uid).catch(() => null);
    this.debeCambiarPassword.set(perfil?.debeCambiarPassword === true);
  }

  private async tieneCambioPendiente(
    u: User,
    force = false,
    conservarEnError = false
  ): Promise<boolean> {
    try {
      const token = await u.getIdTokenResult(force);
      return token.claims['debeCambiarPassword'] === true;
    } catch {
      // Al cambiar la contraseña es más seguro conservar la marca si el token
      // no se puede leer; en el inicio de sesión se parte de cero.
      return conservarEnError ? this.debeCambiarPassword() : false;
    }
  }

  formatearNombre(nombre: string): string {
    return nombre
      .trim()
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean)
      .map((parte) => parte.charAt(0).toUpperCase() + parte.slice(1))
      .join(' ');
  }
}
