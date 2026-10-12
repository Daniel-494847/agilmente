import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { User, onAuthStateChanged } from 'firebase/auth';

import { auth } from '@core/firebase';
import { UserRoleService } from '@core/auth/user-role.service';

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

/** Exige sesión iniciada (para páginas que solo editan datos propios, como el perfil). */
export const requireAuth: CanActivateFn = async () => {
  const router = inject(Router);
  const user = await obtenerUsuarioActual();
  return user ? true : router.createUrlTree(['/login']);
};
