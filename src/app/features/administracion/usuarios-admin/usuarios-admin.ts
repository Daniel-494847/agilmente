import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { onAuthStateChanged } from 'firebase/auth';

import { auth } from '../../../core/firebase';
import { UserRoleService } from '../../../core/auth/user-role.service';
import { RolUsuario, UsuarioAdmin } from '../../../core/models/usuario.model';

/**
 * Gestión de usuarios (solo administrador).
 * Lista los usuarios y permite cambiar su rol. El permiso real
 * lo ponen las reglas de Firestore, no este componente.
 */
@Component({
  selector: 'app-usuarios-admin',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './usuarios-admin.html'
})
export class UsuariosAdmin implements OnInit {
  private readonly roles = inject(UserRoleService);

  readonly usuarios = signal<UsuarioAdmin[]>([]);
  readonly cargando = signal(true);
  readonly mensaje = signal('');
  readonly error = signal('');
  /** UID del administrador que ve la página (no puede cambiarse el propio rol). */
  readonly miUid = signal<string | null>(null);
  readonly rolesOpciones: readonly RolUsuario[] = ['estudiante', 'docente', 'administrador'];

  async ngOnInit(): Promise<void> {
    onAuthStateChanged(auth, (user) => this.miUid.set(user?.uid ?? null));
    await this.cargar();
  }

  async cargar(): Promise<void> {
    this.cargando.set(true);
    this.error.set('');
    try {
      this.usuarios.set(await this.roles.listarUsuarios());
    } catch {
      this.error.set('No se pudieron cargar los usuarios.');
    } finally {
      this.cargando.set(false);
    }
  }

  async cambiarRol(usuario: UsuarioAdmin, nuevo: RolUsuario): Promise<void> {
    if (nuevo === usuario.rol || usuario.uid === this.miUid()) {
      return;
    }
    try {
      await this.roles.cambiarRol(usuario.uid, nuevo);
      this.usuarios.update((lista) =>
        lista.map((u) => (u.uid === usuario.uid ? { ...u, rol: nuevo } : u))
      );
      this.mensaje.set(`Rol de ${usuario.nombreCompleto || usuario.email} actualizado a «${nuevo}».`);
      this.error.set('');
    } catch {
      this.error.set('No se pudo cambiar el rol (¿eres administrador?).');
    }
  }
}
