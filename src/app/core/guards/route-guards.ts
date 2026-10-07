import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { User, onAuthStateChanged } from 'firebase/auth';

import { auth } from '../firebase';
import { UserRoleService } from '../auth/user-role.service';

const obtenerUsuarioActual = (): Promise<User | null> =>
  new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe();
      resolve(user);
    });
  });

export const redirectIfAuthenticated: CanActivateFn = async () => {
  const router = inject(Router);
  const user = await obtenerUsuarioActual();
  return user ? router.createUrlTree(['/inicio']) : true;
};

export const requireAdmin: CanActivateFn = async () => {
  const router = inject(Router);
  const userRoleService = inject(UserRoleService);
  const user = await obtenerUsuarioActual();
  return user && (await userRoleService.esAdministrador(user))
    ? true
    : router.createUrlTree(['/inicio']);
};
