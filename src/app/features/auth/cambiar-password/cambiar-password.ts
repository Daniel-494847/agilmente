import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';

import { AuthService } from '@core/auth/auth.service';
import {
  PasswordService,
  mensajeErrorCambioPassword
} from '@core/services/password.service';

/**
 * Cambio obligatorio de la contraseña temporal que genera el administrador.
 * La nueva contraseña la guarda una función de Firebase, que además borra la
 * marca de cambio pendiente. La temporal deja de servir en ese momento.
 */
@Component({
  selector: 'app-cambiar-password',
  imports: [ReactiveFormsModule],
  templateUrl: './cambiar-password.html'
})
export class CambiarPassword {
  private readonly authService = inject(AuthService);
  private readonly passwords = inject(PasswordService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);

  readonly form = this.fb.nonNullable.group({
    nueva: ['', [Validators.required, Validators.minLength(8)]],
    confirmar: ['', [Validators.required, Validators.minLength(8)]]
  });
  readonly guardando = signal(false);
  readonly error = signal('');

  constructor() {
    // Esta página solo tiene sentido con un cambio pendiente.
    if (!this.authService.debeCambiarPassword()) {
      void this.router.navigateByUrl('/');
    }
  }

  async guardar(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.error.set('Escribe una contraseña de al menos 8 caracteres y repítela.');
      return;
    }

    const { nueva, confirmar } = this.form.getRawValue();
    if (nueva !== confirmar) {
      this.error.set('Las contraseñas no coinciden.');
      return;
    }

    this.guardando.set(true);
    this.error.set('');
    try {
      await this.passwords.cambiarPropia(nueva);
      await this.authService.refrescarPasswordFlag(true);

      if (this.authService.debeCambiarPassword()) {
        this.error.set(
          'La contraseña se guardó, pero el cambio aún no se refleja. Inténtalo de nuevo.'
        );
        return;
      }
      await this.router.navigateByUrl('/');
    } catch (error) {
      // Si la función sí guardó la contraseña pero se perdió la respuesta,
      // el token nuevo ya no tendrá la marca pendiente.
      await this.authService.refrescarPasswordFlag(true);
      if (!this.authService.debeCambiarPassword()) {
        await this.router.navigateByUrl('/');
        return;
      }
      this.error.set(mensajeErrorCambioPassword(error));
    } finally {
      this.guardando.set(false);
    }
  }

  async salir(): Promise<void> {
    await this.authService.cerrarSesion();
    await this.router.navigateByUrl('/login');
  }
}
