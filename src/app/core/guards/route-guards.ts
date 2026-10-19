import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AuthService } from '@core/auth/auth.service';

export const redirectIfAuthenticated: CanActivateFn = async () => {
  const router = inject(Router);
  const auth = inject(AuthService);
  await auth.ready;
  return auth.isAuthenticated() ? router.createUrlTree(['/']) : true;
};

export const requireAdmin: CanActivateFn = async () => {
  const router = inject(Router);
  const auth = inject(AuthService);
  await auth.ready;
  return auth.esAdministrador() ? true : router.createUrlTree(['/']);
};

/** Exige sesión iniciada (para páginas que solo editan datos propios, como el perfil). */
export const requireAuth: CanActivateFn = async () => {
  const router = inject(Router);
  const auth = inject(AuthService);
  await auth.ready;
  return auth.isAuthenticated() ? true : router.createUrlTree(['/login']);
};

/** Exige rol docente o administrador (para el módulo de fichas imprimibles). */
export const requireDocente: CanActivateFn = async () => {
  const router = inject(Router);
  const auth = inject(AuthService);
  await auth.ready;
  return auth.esDocente() ? true : router.createUrlTree(['/']);
};
