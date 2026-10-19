import { Injectable, signal, computed, inject } from '@angular/core';
import { User, onAuthStateChanged, signOut } from 'firebase/auth';

import { auth } from '@core/firebase';
import { UserRoleService } from './user-role.service';
import { RolUsuario, normalizarRol } from '@core/models/usuario.model';
import { UserProgressService } from '@core/services/user-progress.service';

/**
 * Fuente única de verdad de la sesión. Inicializa `onAuthStateChanged` una
 * sola vez y expone el usuario y su rol como signals para que Shell, Sidebar,
 * Topbar, Dashboard y los guards los consuman sin duplicar suscripciones.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly userRole = inject(UserRoleService);
  private readonly progress = inject(UserProgressService);

  /** Se resuelve tras el primer `onAuthStateChanged`. */
  readonly ready: Promise<void>;

  private resolveReady!: () => void;

  readonly user = signal<User | null>(null);
  readonly rol = signal<RolUsuario>('estudiante');

  readonly isAuthenticated = computed(() => !!this.user());
  readonly esAdministrador = computed(() => this.rol() === 'administrador');
  readonly esDocente = computed(() => this.rol() === 'docente' || this.rol() === 'administrador');

  constructor() {
    this.ready = new Promise<void>((resolve) => (this.resolveReady = resolve));

    onAuthStateChanged(auth, async (u) => {
      this.user.set(u);
      if (u) {
        try {
          this.rol.set(await this.userRole.obtenerRol(u));
        } catch {
          this.rol.set('estudiante');
        }
        await this.progress.refrescar();
      } else {
        this.rol.set('estudiante');
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
