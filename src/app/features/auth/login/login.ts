import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { FirebaseError } from 'firebase/app';
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut
} from 'firebase/auth';

import { auth } from '@core/firebase';
import { UsuarioService } from '@core/services/usuario.service';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule],
  templateUrl: './login.html'
})
export class Login {
  private readonly usuarios = inject(UsuarioService);
  readonly form;
  readonly isSubmitting = signal(false);
  readonly errorMessage = signal('');
  readonly modoRegistro = signal(false);

  constructor(
    private readonly fb: FormBuilder,
    private readonly router: Router,
    private readonly route: ActivatedRoute
  ) {
    this.form = this.fb.nonNullable.group({
      nombreCompleto: ['', [Validators.required, Validators.minLength(3)]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]]
    });
    this.modoRegistro.set(this.route.snapshot.queryParamMap.get('registro') === '1');
    this.actualizarCampoNombre();
  }

  toggleModo(): void {
    this.modoRegistro.update((v) => !v);
    this.errorMessage.set('');
    this.actualizarCampoNombre();
  }

  async iniciarSesion(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.errorMessage.set('Ingresa un correo y una contraseña válidos.');
      return;
    }
    const { email, password } = this.form.getRawValue();
    this.isSubmitting.set(true);
    this.errorMessage.set('');
    try {
      const credential = await signInWithEmailAndPassword(auth, email, password);
      const user = credential.user;
      // Crea el documento si falta o completa los campos obligatorios si está incompleto.
      await this.usuarios.crearOReparar(user, {
        nombreCompleto: localStorage.getItem('agilmente_user_name')
      });
      this.router.navigateByUrl('/');
    } catch (error) {
      this.errorMessage.set(this.mensajeError(error, 'sesion'));
    } finally {
      this.isSubmitting.set(false);
    }
  }

  async registrarUsuario(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.errorMessage.set('Completa todos los campos.');
      return;
    }
    const { nombreCompleto, email, password } = this.form.getRawValue();
    this.isSubmitting.set(true);
    this.errorMessage.set('');
    try {
      const credential = await createUserWithEmailAndPassword(auth, email, password);
      await this.usuarios.crearOReparar(
        { uid: credential.user.uid, email },
        { nombreCompleto: nombreCompleto.trim(), rol: 'estudiante' }
      );
      localStorage.setItem('agilmente_user_name', nombreCompleto.trim());
      this.router.navigateByUrl('/');
    } catch (error) {
      this.errorMessage.set(this.mensajeError(error, 'registro'));
    } finally {
      this.isSubmitting.set(false);
    }
  }

  async iniciarConGoogle(): Promise<void> {
    this.isSubmitting.set(true);
    this.errorMessage.set('');
    try {
      if (auth.currentUser) await signOut(auth);
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const credential = await signInWithPopup(auth, provider);
      const nombre = credential.user.displayName ?? 'Usuario';
      await this.usuarios.crearOReparar(
        { uid: credential.user.uid, email: credential.user.email },
        { nombreCompleto: nombre, avatarUrl: credential.user.photoURL }
      );
      localStorage.setItem('agilmente_user_name', nombre);
      this.router.navigateByUrl('/');
    } catch (error) {
      this.errorMessage.set(this.mensajeError(error, 'google'));
    } finally {
      this.isSubmitting.set(false);
    }
  }

  /**
   * Traduce el error de Firebase Auth a un mensaje claro. El caso más común en
   * un sitio publicado (GitHub Pages, Netlify…) es `auth/unauthorized-domain`:
   * Google solo responde si el dominio del sitio está en la lista
   * Authentication → Settings → Authorized domains de la consola de Firebase.
   */
  private mensajeError(
    error: unknown,
    contexto: 'sesion' | 'registro' | 'google'
  ): string {
    const codigo = error instanceof FirebaseError ? error.code : '';

    switch (codigo) {
      case 'auth/unauthorized-domain':
        return 'Este dominio no está autorizado en Firebase. Añádelo en Consola → Authentication → Settings → Authorized domains.';
      case 'auth/popup-blocked':
        return 'El navegador bloqueó la ventana de Google. Permite las ventanas emergentes e inténtalo otra vez.';
      case 'auth/popup-closed-by-user':
      case 'auth/cancelled-popup-request':
        return 'Se canceló el inicio de sesión con Google.';
      case 'auth/account-exists-with-different-credential':
        return 'Ese correo ya está registrado con otro método de inicio de sesión.';
      case 'auth/operation-not-allowed':
        return 'El proveedor de Google no está habilitado en Firebase Authentication.';
      case 'auth/too-many-requests':
        return 'Demasiados intentos. Espera un momento e inténtalo de nuevo.';
      case 'auth/network-request-failed':
        return 'Sin conexión. Revisa tu internet e inténtalo de nuevo.';
      case 'auth/invalid-credential':
      case 'auth/wrong-password':
      case 'auth/user-not-found':
        return 'Credenciales incorrectas o error de conexión.';
    }

    const porDefecto =
      contexto === 'google'
        ? 'No se pudo iniciar con Google.'
        : contexto === 'registro'
          ? 'No se pudo completar el registro.'
          : 'Credenciales incorrectas o error de conexión.';
    return codigo ? `${porDefecto} (${codigo})` : porDefecto;
  }

  private actualizarCampoNombre(): void {
    const nombre = this.form.controls.nombreCompleto;
    if (this.modoRegistro()) nombre.enable();
    else nombre.disable();
  }
}
