import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { NOMBRES_COLECCION } from '../../../core/firebase';
import { ContentService } from '../../../core/services/content.service';

export interface ComunicadoAdmin {
  id?: string;
  titulo: string;
  fecha: string;
  colorDot: 'red' | 'blue' | 'green';
  publicado: boolean;
  destacado?: boolean;
}

@Component({
  selector: 'app-avisos-admin',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './avisos-admin.html'
})
export class AvisosAdmin implements OnInit {
  private readonly content = inject(ContentService);
  private readonly fb = inject(FormBuilder);

  readonly items = signal<ComunicadoAdmin[]>([]);
  readonly cargando = signal(true);
  readonly guardando = signal(false);
  readonly editandoId = signal<string | null>(null);
  readonly mensaje = signal('');
  readonly error = signal('');

  readonly form = this.fb.nonNullable.group({
    titulo: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(120)]],
    fecha: ['Hoy', [Validators.required, Validators.maxLength(40)]],
    colorDot: this.fb.nonNullable.control<'red' | 'blue' | 'green'>('blue'),
    publicado: [true],
    destacado: [false]
  });

  async ngOnInit(): Promise<void> {
    await this.cargar();
  }

  async cargar(): Promise<void> {
    this.cargando.set(true);
    try {
      const lista = await this.content.listar<ComunicadoAdmin>(NOMBRES_COLECCION.comunicados);
      this.items.set(lista);
    } catch {
      this.error.set('No se pudieron cargar los avisos.');
    } finally {
      this.cargando.set(false);
    }
  }

  editar(item: ComunicadoAdmin): void {
    this.editandoId.set(item.id ?? null);
    this.form.setValue({
      titulo: item.titulo,
      fecha: item.fecha || 'Hoy',
      colorDot: item.colorDot || 'blue',
      publicado: item.publicado !== false,
      destacado: item.destacado === true
    });
    this.mensaje.set('');
    this.error.set('');
  }

  cancelar(): void {
    this.editandoId.set(null);
    this.form.reset({
      titulo: '',
      fecha: 'Hoy',
      colorDot: 'blue',
      publicado: true,
      destacado: false
    });
  }

  async guardar(): Promise<void> {
    this.mensaje.set('');
    this.error.set('');
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.guardando.set(true);
    try {
      const datos = this.form.getRawValue();
      const id = this.editandoId() ?? undefined;
      await this.content.guardar(NOMBRES_COLECCION.comunicados, { id, ...datos });
      this.mensaje.set(id ? 'Aviso actualizado.' : 'Aviso creado.');
      this.cancelar();
      await this.cargar();
    } catch {
      this.error.set('No se pudo guardar. Verifica permisos de administrador.');
    } finally {
      this.guardando.set(false);
    }
  }

  async eliminar(item: ComunicadoAdmin): Promise<void> {
    if (!item.id || !confirm(`¿Eliminar «${item.titulo}»?`)) return;
    try {
      await this.content.eliminar(NOMBRES_COLECCION.comunicados, item.id);
      await this.cargar();
    } catch {
      this.error.set('No se pudo eliminar.');
    }
  }

  async togglePublicado(item: ComunicadoAdmin): Promise<void> {
    if (!item.id) return;
    try {
      await this.content.guardar(NOMBRES_COLECCION.comunicados, {
        ...item,
        publicado: !item.publicado
      });
      await this.cargar();
    } catch {
      this.error.set('No se pudo cambiar el estado.');
    }
  }
}
