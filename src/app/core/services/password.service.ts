import { Injectable } from '@angular/core';
import { sendPasswordResetEmail } from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';

import { auth, functions } from '@core/firebase';
import {
  DOMINIO_ESTUDIANTES,
  DOMINIO_ESTUDIANTES_LEGADO,
  esEmailAdministrador
} from '@core/models/usuario.model';

/** Resultado de restablecer la contraseña de un usuario. */
export type ResultadoReset =
  | { tipo: 'correo'; email: string }
  | { tipo: 'temporal'; password: string };

/** `true` si la cuenta usa un correo interno generado por la importación. */
export function esCorreoInterno(email: string): boolean {
  const correo = email.trim().toLowerCase();
  return (
    correo.endsWith(`@${DOMINIO_ESTUDIANTES}`) ||
    correo.endsWith(`@${DOMINIO_ESTUDIANTES_LEGADO}`)
  );
}

/** Código de error de Firebase Auth o de una función invocable. */
function codigoDeError(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    return String((error as { code?: unknown }).code ?? '');
  }
  return '';
}

/** Mensaje del servidor sin el prefijo de Firebase. */
function mensajeDeError(error: unknown): string {
  if (!(error instanceof Error)) {
    return '';
  }
  return error.message.replace(/^FirebaseError:\s*/i, '').trim();
}

/**
 * Restablecimiento de contraseñas.
 *
 * - Cuentas con correo real: Firebase envía un enlace de un solo uso y el
 *   usuario elige su contraseña nueva. Funciona sin Cloud Functions.
 * - Cuentas con correo interno: una función de Firebase genera una contraseña
 *   temporal y marca el cambio obligatorio al entrar. Requiere que las
 *   funciones estén desplegadas (plan Blaze).
 */
@Injectable({ providedIn: 'root' })
export class PasswordService {
  private readonly resetearFn = httpsCallable<{ uid: string }, { password: string }>(
    functions,
    'resetearPasswordUsuario'
  );
  private readonly cambiarPropiaFn = httpsCallable<{ password: string }, { ok: boolean }>(
    functions,
    'cambiarPasswordPropia'
  );

  async resetear(uid: string, email: string): Promise<ResultadoReset> {
    const correo = email.trim();

    if (!correo) {
      throw new Error('El usuario no tiene un correo registrado.');
    }
    if (esEmailAdministrador(correo)) {
      throw new Error('No se puede restablecer la contraseña del administrador.');
    }
    if (!esCorreoInterno(correo)) {
      await sendPasswordResetEmail(auth, correo);
      return { tipo: 'correo', email: correo };
    }

    const resultado = await this.resetearFn({ uid });
    return { tipo: 'temporal', password: resultado.data.password };
  }

  async cambiarPropia(password: string): Promise<void> {
    await this.cambiarPropiaFn({ password });
  }
}

/** Traduce los errores del restablecimiento a mensajes para el administrador. */
export function mensajeErrorReset(error: unknown): string {
  const codigo = codigoDeError(error);
  const mensaje = mensajeDeError(error);

  switch (codigo) {
    case 'auth/user-not-found':
      return 'No existe una cuenta de acceso con ese correo.';
    case 'auth/invalid-email':
      return 'El correo del usuario no es válido.';
    case 'auth/too-many-requests':
      return 'Demasiados intentos. Espera un momento e inténtalo de nuevo.';
    case 'auth/network-request-failed':
      return 'Sin conexión. Revisa tu internet e inténtalo de nuevo.';
    case 'auth/operation-not-allowed':
      return 'El restablecimiento por correo no está habilitado en Firebase Authentication.';
    case 'functions/unauthenticated':
      return 'Tu sesión expiró. Vuelve a iniciar sesión.';
    case 'functions/permission-denied':
      return 'No tienes permiso para restablecer contraseñas.';
    case 'functions/not-found':
      return 'No se encontró la cuenta o el perfil del usuario. Si ambos existen, la función de restablecimiento no está desplegada: requiere el plan Blaze.';
    case 'functions/unavailable':
    case 'functions/deadline-exceeded':
    case 'functions/internal':
      return 'No se pudo conectar con la función de restablecimiento. Verifica que esté desplegada (requiere el plan Blaze).';
    case 'functions/failed-precondition':
    case 'functions/invalid-argument':
      return mensaje || 'No se pudo restablecer la contraseña.';
    default:
      return mensaje || 'No se pudo restablecer la contraseña. Inténtalo de nuevo.';
  }
}

/** Traduce los errores al guardar la contraseña nueva. */
export function mensajeErrorCambioPassword(error: unknown): string {
  const codigo = codigoDeError(error);
  const mensaje = mensajeDeError(error);

  switch (codigo) {
    case 'functions/unauthenticated':
      return 'Tu sesión expiró. Vuelve a iniciar sesión.';
    case 'functions/failed-precondition':
      return 'No hay un cambio de contraseña pendiente. Vuelve a iniciar sesión.';
    case 'functions/invalid-argument':
      return mensaje || 'La contraseña nueva no es válida.';
    case 'functions/not-found':
    case 'functions/unavailable':
    case 'functions/deadline-exceeded':
    case 'functions/internal':
      return 'No se pudo guardar la contraseña. Verifica que la función de Firebase esté desplegada (requiere el plan Blaze) e inténtalo de nuevo.';
    default:
      return mensaje || 'No se pudo guardar la contraseña. Inténtalo de nuevo.';
  }
}
