import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { FirebaseError } from 'firebase/app';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';

import { AuthService } from '@core/auth/auth.service';
import { auth } from '@core/firebase';
import { esEmailAdministrador } from '@core/models/usuario.model';
import { UsuarioService } from '@core/services/usuario.service';
import { correoDeUsuario } from '@features/administracion/importar-estudiantes/importacion-estudiantes.util';

/**
 * Inicio de sesión. Las cuentas las crea el administrador (importación o
 * «Añadir estudiante»); aquí nadie se registra. El usuario puede escribir su
 * nombre de usuario (se convierte a su correo interno) o un correo completo.
 */
@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './login.html'
})
export class Login {
  private readonly usuarios = inject(UsuarioService);
  private readonly authService = inject(AuthService);
  readonly form;
  readonly isSubmitting = signal(false);
  readonly errorMessage = signal('');

  constructor(
    private readonly fb: FormBuilder,
    private readonly router: Router
  ) {
    this.form = this.fb.nonNullable.group({
      usuario: ['', [Validators.required]],
      password: ['', [Validators.required, Validators.minLength(6)]]
    });
  }

  async iniciarSesion(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.errorMessage.set('Escribe el usuario (o correo) y la contraseña que te dio el administrador.');
      return;
    }

    const { usuario, password } = this.form.getRawValue();
    const texto = usuario.trim();
    // Sin «@» se asume el usuario interno: ana.torres → ana.torres@estudiantes.agilmente.app
    const email = texto.includes('@') ? texto : correoDeUsuario(texto);

    this.isSubmitting.set(true);
    this.errorMessage.set('');
    try {
      const credential = await signInWithEmailAndPassword(auth, email, password);
      const user = credential.user;
      const perfil = await this.usuarios.obtenerPerfil(user.uid);

      // Solo entran las cuentas que el administrador ya creó. El administrador
      // único puede reparar/crear su propio perfil si hiciera falta.
      if (!perfil && !esEmailAdministrador(user.email)) {
        await signOut(auth);
        this.errorMessage.set(
          'Tu cuenta no tiene acceso. Pide tus credenciales al administrador.'
        );
        return;
      }

      await this.usuarios.crearOReparar(user, {
        nombreCompleto: perfil?.nombreCompleto ?? user.displayName ?? ''
      });
      await this.authService.refrescarRol();
      await this.authService.refrescarPasswordFlag();
      this.router.navigateByUrl(
        this.authService.debeCambiarPassword() ? '/cambiar-password' : '/'
      );
    } catch (error) {
      this.errorMessage.set(this.mensajeError(error));
    } finally {
      this.isSubmitting.set(false);
    }
  }

  /** Traduce el error de Firebase Auth a un mensaje claro. */
  private mensajeError(error: unknown): string {
    const codigo = error instanceof FirebaseError ? error.code : '';

    switch (codigo) {
      case 'auth/invalid-credential':
      case 'auth/invalid-login-credentials':
      case 'auth/wrong-password':
      case 'auth/user-not-found':
        return 'Usuario o contraseña incorrectos. Revisa los datos que te dio el administrador.';
      case 'auth/invalid-email':
        return 'El usuario no es válido. Escríbelo tal como te lo entregó el administrador.';
      case 'auth/user-disabled':
        return 'Tu cuenta está deshabilitada. Pide ayuda al administrador.';
      case 'auth/too-many-requests':
        return 'Demasiados intentos. Espera un momento e inténtalo de nuevo.';
      case 'auth/network-request-failed':
        return 'Sin conexión. Revisa tu internet e inténtalo de nuevo.';
      case 'auth/operation-not-allowed':
        return 'El inicio con usuario y contraseña no está habilitado. Avisa al administrador.';
      default:
        return codigo
          ? `No se pudo iniciar sesión (${codigo}).`
          : 'No se pudo iniciar sesión. Inténtalo de nuevo.';
    }
  }
}
