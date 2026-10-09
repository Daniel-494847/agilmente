import { Injectable } from '@angular/core';
import { User } from 'firebase/auth';
import { collection, doc, getDoc, getDocs, updateDoc } from 'firebase/firestore';

import { db, NOMBRES_COLECCION } from '../firebase';
import { RolUsuario, UsuarioAdmin } from '../models/usuario.model';

@Injectable({ providedIn: 'root' })
export class UserRoleService {
  /** Rol del usuario según su documento en Firestore. Por defecto «estudiante». */
  async obtenerRol(user: User | null): Promise<RolUsuario> {
    if (!user) {
      return 'estudiante';
    }
    try {
      const userDoc = await getDoc(doc(db, NOMBRES_COLECCION.usuarios, user.uid));
      return this.normalizarRol(userDoc.data()?.['rol']);
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
      .map((d) => {
        const data = d.data();
        return {
          uid: d.id,
          nombreCompleto: String(data['nombreCompleto'] ?? ''),
          email: String(data['email'] ?? ''),
          rol: this.normalizarRol(data['rol'])
        };
      })
      .sort((a, b) => a.nombreCompleto.localeCompare(b.nombreCompleto));
  }

  /** Cambia el rol de un usuario. El permiso lo pone la regla de Firestore (solo administrador). */
  async cambiarRol(uid: string, rol: RolUsuario): Promise<void> {
    await updateDoc(doc(db, NOMBRES_COLECCION.usuarios, uid), { rol });
  }

  private normalizarRol(rol: unknown): RolUsuario {
    const r = String(rol ?? '').trim().toLowerCase();
    return r === 'administrador' || r === 'docente' ? r : 'estudiante';
  }
}
