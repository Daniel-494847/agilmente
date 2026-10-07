import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { UnidadEducativaService } from '../services/unidad-educativa.service';

@Component({
  selector: 'app-unidad-educativa-admin',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './unidad-educativa-admin.html'
})
export class UnidadEducativaAdmin implements OnInit {
  private readonly servicio = inject(UnidadEducativaService);
  private readonly fb = inject(FormBuilder);

  readonly cargando = signal(true);
  readonly guardando = signal(false);
  readonly mensaje = signal('');
  readonly error = signal('');

  readonly form = this.fb.nonNullable.group({
    titulo: ['', [Validators.required, Validators.maxLength(100)]],
    descripcion: ['', [Validators.required, Validators.maxLength(500)]],
    badge: ['Institución', [Validators.required, Validators.maxLength(40)]]
  });

  async ngOnInit(): Promise<void> {
    try {
      const datos = await this.servicio.obtener();
      if (datos) this.form.setValue(datos);
    } catch {
      this.error.set('No se pudo cargar la información institucional.');
    } finally {
      this.cargando.set(false);
    }
  }

  async guardar(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.guardando.set(true);
    this.mensaje.set('');
    this.error.set('');
    try {
      await this.servicio.guardar(this.form.getRawValue());
      this.mensaje.set('Información institucional actualizada.');
    } catch {
      this.error.set('No se pudo guardar. Verifica que tu cuenta sea administradora.');
    } finally {
      this.guardando.set(false);
    }
  }
}
