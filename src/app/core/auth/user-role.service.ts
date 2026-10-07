import { Injectable } from '@angular/core';
import { User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

import { db, NOMBRES_COLECCION } from '../firebase';

@Injectable({ providedIn: 'root' })
export class UserRoleService {
  async esAdministrador(user: User | null): Promise<boolean> {
    if (!user) {
      return false;
    }

    const userDoc = await getDoc(doc(db, NOMBRES_COLECCION.usuarios, user.uid));
    return userDoc.exists() && this.esRolAdministrador(userDoc.data()['rol']);
  }

  private esRolAdministrador(rol: unknown): boolean {
    return String(rol ?? '').trim().toLowerCase() === 'administrador';
  }
}
