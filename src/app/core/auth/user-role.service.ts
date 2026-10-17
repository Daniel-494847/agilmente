import { Injectable, inject } from '@angular/core';
import { User } from 'firebase/auth';
import { collection, doc, getDoc, getDocs } from 'firebase/firestore';

import { db, NOMBRES_COLECCION } from '@core/firebase';
import { RolUsuario, UsuarioAdmin, normalizarRol } from '@core/models/usuario.model';
import { UsuarioService } from '@core/services/usuario.service';

@Injectable({ providedIn: 'root' })
export class UserRoleService {
  private readonly usuarios = inject(UsuarioService);

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
      .map((d) => {
        const data = d.data();
        const puntos = Math.max(0, Math.floor(Number(data['puntos']) || 0));
        return {
          uid: d.id,
          nombreCompleto: String(data['nombreCompleto'] ?? ''),
          email: String(data['email'] ?? ''),
          rol: normalizarRol(data['rol']),
          avatarUrl: String(data['avatarUrl'] ?? '') || undefined,
          puntos,
          nivel: Number(data['nivel']) || 1,
          tituloNivel: String(data['tituloNivel'] ?? 'Explorador')
        };
      })
      .sort((a, b) => a.nombreCompleto.localeCompare(b.nombreCompleto));
  }

  /** Cambia el rol de un usuario. El permiso lo pone la regla de Firestore (solo administrador). */
  async cambiarRol(uid: string, rol: RolUsuario): Promise<void> {
    await this.usuarios.cambiarRol(uid, rol);
  }
}

