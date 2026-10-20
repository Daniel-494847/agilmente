import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AuthService } from '@core/auth/auth.service';

export const redirectIfAuthenticated: CanActivateFn = async () => {
  const router = inject(Router);
  const auth = inject(AuthService);
  await auth.ready;
  if (!auth.isAuthenticated()) {
    return true;
  }
  return router.createUrlTree([auth.debeCambiarPassword() ? '/cambiar-password' : '/']);
};

/**
 * Si el administrador restableció la contraseña, obliga a cambiarla antes de
 * entrar al shell. Sin sesión no interviene: la app sigue siendo pública.
 */
export const requirePasswordChanged: CanActivateFn = async () => {
  const router = inject(Router);
  const auth = inject(AuthService);
  await auth.ready;
  return auth.debeCambiarPassword() ? router.createUrlTree(['/cambiar-password']) : true;
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
