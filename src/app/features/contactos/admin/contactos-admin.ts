import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { NOMBRES_COLECCION } from '@core/firebase';
import { ContentService } from '@core/services/content.service';
import { Contacto, TipoContacto } from '@features/contactos/models/contacto.model';
import { ContactoService } from '@features/contactos/services/contacto.service';

@Component({
  selector: 'app-contactos-admin',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './contactos-admin.html'
})
export class ContactosAdmin implements OnInit {
  private readonly content = inject(ContentService);
  private readonly fb = inject(FormBuilder);
  readonly contacto = inject(ContactoService);

  readonly contactos = signal<Contacto[]>([]);
  readonly cargando = signal(true);
  readonly guardando = signal(false);
  readonly editandoId = signal<string | null>(null);
  readonly mensaje = signal('');
  readonly error = signal('');

  readonly form = this.fb.nonNullable.group({
    nombre: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(80)]],
    tipo: ['whatsapp' as TipoContacto, [Validators.required]],
    valor: ['', [Validators.required, Validators.maxLength(200)]],
    descripcion: ['', [Validators.maxLength(200)]],
    publicado: [true]
  });

  async ngOnInit(): Promise<void> {
    await this.cargar();
  }

  editar(contacto: Contacto): void {
    this.editandoId.set(contacto.id);
    this.form.setValue({
      nombre: contacto.nombre,
      tipo: contacto.tipo,
      valor: contacto.valor,
      descripcion: contacto.descripcion ?? '',
      publicado: contacto.publicado !== false
    });
    this.mensaje.set('');
    this.error.set('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  cancelar(): void {
    this.editandoId.set(null);
    this.form.reset({ nombre: '', tipo: 'whatsapp', valor: '', descripcion: '', publicado: true });
    this.mensaje.set('');
    this.error.set('');
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
      const datos: Partial<Contacto> & { id?: string } = {
        nombre: this.form.controls.nombre.value.trim(),
        tipo: this.form.controls.tipo.value,
        valor: this.form.controls.valor.value.trim(),
        descripcion: this.form.controls.descripcion.value.trim(),
        publicado: this.form.controls.publicado.value
      };
      if (this.editandoId()) {
        datos.id = this.editandoId()!;
      } else {
        datos.creadoEn = Date.now();
      }

      await this.content.guardar(NOMBRES_COLECCION.contactos, datos);
      this.mensaje.set(this.editandoId() ? 'Contacto actualizado.' : 'Contacto agregado.');
      this.cancelar();
      await this.cargar();
    } catch (e) {
      console.error('No se pudo guardar el contacto:', e);
      this.error.set('No se pudo guardar. Verifica conexión y rol administrador.');
    } finally {
      this.guardando.set(false);
    }
  }

  async cambiarPublicacion(contacto: Contacto): Promise<void> {
    try {
      await this.content.actualizar(NOMBRES_COLECCION.contactos, contacto.id, {
        publicado: !contacto.publicado
      });
      await this.cargar();
    } catch (e) {
      console.error('No se pudo cambiar la publicación del contacto:', e);
      this.error.set('No se pudo cambiar el estado de publicación.');
    }
  }

  async eliminar(contacto: Contacto): Promise<void> {
    if (!confirm(`¿Eliminar el contacto «${contacto.nombre}»?`)) {
      return;
    }
    try {
      await this.content.eliminar(NOMBRES_COLECCION.contactos, contacto.id);
      if (this.editandoId() === contacto.id) this.cancelar();
      await this.cargar();
      this.mensaje.set('Contacto eliminado.');
    } catch (e) {
      console.error('No se pudo eliminar el contacto:', e);
      this.error.set('No se pudo eliminar el contacto.');
    }
  }

  private async cargar(): Promise<void> {
    this.cargando.set(true);
    try {
      this.contactos.set(await this.content.listar<Contacto>(NOMBRES_COLECCION.contactos));
    } catch (e) {
      console.error('No se pudo cargar la lista de contactos:', e);
      this.error.set('No se pudo cargar la lista de contactos.');
    } finally {
      this.cargando.set(false);
    }
  }
}
