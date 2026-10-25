import { Injectable, signal, computed, inject } from '@angular/core';
import { User, onAuthStateChanged, signOut } from 'firebase/auth';

import { auth } from '@core/firebase';
import { RolUsuario, esEmailAdministrador } from '@core/models/usuario.model';
import { ContentService } from '@core/services/content.service';
import { PerfilUsuario, UsuarioService } from '@core/services/usuario.service';
import { UserProgressService } from '@core/services/user-progress.service';

/**
 * Fuente única de verdad de la sesión. Inicializa `onAuthStateChanged` una
 * sola vez y expone el usuario y su rol como signals para que Shell, Sidebar,
 * Topbar, Dashboard y los guards los consuman sin duplicar suscripciones.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly usuarios = inject(UsuarioService);
  private readonly progress = inject(UserProgressService);
  private readonly content = inject(ContentService);

  /** Se resuelve tras el primer `onAuthStateChanged`. */
  readonly ready: Promise<void>;

  private resolveReady!: () => void;

  readonly user = signal<User | null>(null);
  /** Perfil completo ya leído al entrar (evita releerlo en cada pantalla). */
  readonly perfil = signal<PerfilUsuario | null>(null);
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
          this.limpiarSesion();
          this.resolveReady();
          return;
        }

        this.user.set(u);
        this.perfil.set(perfil);
        // La caché de contenido es por sesión: no debe reutilizarse entre cuentas.
        this.content.limpiarCache();
        this.debeCambiarPassword.set(
          perfil?.debeCambiarPassword === true || (await this.tieneCambioPendiente(u))
        );
        // El rol ya viene en el perfil: no hace falta una segunda lectura.
        this.rol.set(perfil?.rol ?? 'estudiante');

        // Con el resumen del servidor los puntos ya están en el perfil; si aún
        // no existe, se calculan desde los intentos (una sola lectura).
        this.progress.seguir();
        if (perfil?.resumen) {
          // Los puntos se derivan del resumen para que coincidan con el desglose.
          const puntos = perfil.resumen.porActividad.length
            ? perfil.resumen.porActividad.reduce(
                (suma, actividad) => suma + actividad.puntos,
                0
              )
            : perfil.puntos;
          this.progress.establecerDesdePuntos(puntos);
        } else {
          await this.progress.refrescar();
        }
      } else {
        this.limpiarSesion();
      }
      this.resolveReady();
    });
  }

  /** Cierra sesión y deja los signals como recién cargados. */
  private limpiarSesion(): void {
    this.user.set(null);
    this.perfil.set(null);
    this.rol.set('estudiante');
    this.debeCambiarPassword.set(false);
    this.content.limpiarCache();
    this.progress.reset();
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
      const perfil = await this.usuarios.obtenerPerfil(u.uid);
      this.perfil.set(perfil);
      this.rol.set(perfil?.rol ?? 'estudiante');
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
    if (perfil) {
      this.perfil.set(perfil);
    }
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
