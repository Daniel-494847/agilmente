import { Injectable, inject } from '@angular/core';
import { User } from 'firebase/auth';
import { collection, doc, getDoc, getDocs } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';

import { db, functions, NOMBRES_COLECCION } from '@core/firebase';
import {
  RolUsuario,
  UsuarioAdmin,
  normalizarRol,
  usuarioAdminDesdeDoc
} from '@core/models/usuario.model';
import { UsuarioService } from '@core/services/usuario.service';

@Injectable({ providedIn: 'root' })
export class UserRoleService {
  private readonly usuarios = inject(UsuarioService);

  /** Función de Firebase que borra la cuenta de acceso y sus datos. */
  private readonly eliminarFn = httpsCallable<{ uid: string }, { ok: boolean }>(
    functions,
    'eliminarUsuario'
  );

  /** Rol del usuario según su documento en Firestore. Por defecto «estudiante». */
  async obtenerRol(user: User | null): Promise<RolUsuario> {
    if (!user) {
      return 'estudiante';
    }
    try {
      const userDoc = await getDoc(doc(db, NOMBRES_COLECCION.usuarios, user.uid));
      return normalizarRol(userDoc.data()?.['rol']);
    } catch {
      return 'estudiante';
    }
  }

  async esAdministrador(user: User | null): Promise<boolean> {
    return (await this.obtenerRol(user)) === 'administrador';
  }

  /** Lista todos los usuarios con su rol. Solo la pueden leer los administradores (reglas de Firestore). */
  async listarUsuarios(): Promise<UsuarioAdmin[]> {
    const snapshot = await getDocs(collection(db, NOMBRES_COLECCION.usuarios));
    return snapshot.docs
      .map((d) => usuarioAdminDesdeDoc(d.id, d.data()))
      .sort((a, b) => a.nombreCompleto.localeCompare(b.nombreCompleto));
  }

  /** Cambia el rol de un usuario. El permiso lo pone la regla de Firestore (solo administrador). */
  async cambiarRol(uid: string, rol: RolUsuario): Promise<void> {
    await this.usuarios.cambiarRol(uid, rol);
  }

  /**
   * Elimina definitivamente una cuenta: su acceso, su perfil y su historial.
   * La función de Firebase comprueba que quien llama sea el administrador.
   */
  async eliminarUsuario(uid: string): Promise<void> {
    await this.eliminarFn({ uid });
  }
}

