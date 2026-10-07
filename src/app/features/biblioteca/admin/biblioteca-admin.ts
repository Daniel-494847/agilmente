import { Component, OnInit, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators
} from '@angular/forms';
import { RouterLink } from '@angular/router';

import {
  CATEGORIAS_MATERIAL,
  CategoriaMaterial,
  DatosMaterial,
  ETIQUETA_TIPO,
  ICONO_TIPO,
  MaterialBiblioteca,
  analizarEnlaceDrive
} from '../models/biblioteca.model';
import { BibliotecaService } from '../services/biblioteca.service';

function enlaceDriveValido(control: AbstractControl): ValidationErrors | null {
  const valor = String(control.value ?? '').trim();
  return !valor || analizarEnlaceDrive(valor) ? null : { enlaceDrive: true };
}

@Component({
  selector: 'app-biblioteca-admin',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './biblioteca-admin.html'
})
export class BibliotecaAdmin implements OnInit {
  private readonly servicio = inject(BibliotecaService);
  private readonly fb = inject(FormBuilder);

  readonly categorias = CATEGORIAS_MATERIAL;
  readonly icono = ICONO_TIPO;
  readonly etiqueta = ETIQUETA_TIPO;

  readonly materiales = signal<MaterialBiblioteca[]>([]);
  readonly cargando = signal(true);
  readonly guardando = signal(false);
  readonly editandoId = signal<string | null>(null);
  readonly mensaje = signal('');
  readonly error = signal('');

  readonly form = this.fb.nonNullable.group({
    titulo: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(100)]],
    descripcion: ['', [Validators.maxLength(200)]],
    categoria: this.fb.nonNullable.control<CategoriaMaterial>('General'),
    enlace: ['', [Validators.required, enlaceDriveValido]],
    publicado: [true]
  });

  ngOnInit(): void {
    this.cargar();
  }

  async guardar(): Promise<void> {
    this.mensaje.set('');
    this.error.set('');

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { titulo, descripcion, categoria, enlace, publicado } = this.form.getRawValue();
    const drive = analizarEnlaceDrive(enlace);
    if (!drive) return;

    const datos: DatosMaterial = {
      titulo: titulo.trim(),
      descripcion: descripcion.trim(),
      categoria,
      tipo: drive.tipo,
      enlace: drive.enlace,
      driveId: drive.driveId,
      publicado
    };

    this.guardando.set(true);
    try {
      const id = this.editandoId();
      if (id) {
        await this.servicio.actualizar(id, datos);
        this.mensaje.set('Cambios guardados.');
      } else {
        await this.servicio.crear(datos);
        this.mensaje.set(publicado ? 'Material publicado.' : 'Material guardado como borrador.');
      }
      this.limpiarFormulario();
      await this.cargar();
    } catch {
      this.error.set('No se pudo guardar. Revisa tu conexión y que tu cuenta sea de administrador.');
    } finally {
      this.guardando.set(false);
    }
  }

  editar(material: MaterialBiblioteca): void {
    this.mensaje.set('');
    this.error.set('');
    this.editandoId.set(material.id);
    this.form.setValue({
      titulo: material.titulo,
      descripcion: material.descripcion,
      categoria: material.categoria,
      enlace: material.enlace,
      publicado: material.publicado
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  cancelarEdicion(): void {
    this.limpiarFormulario();
  }

  async cambiarPublicacion(material: MaterialBiblioteca): Promise<void> {
    this.mensaje.set('');
    this.error.set('');
    try {
      await this.servicio.actualizar(material.id, { publicado: !material.publicado });
      await this.cargar();
    } catch {
      this.error.set('No se pudo cambiar el estado del material.');
    }
  }

  async eliminar(material: MaterialBiblioteca): Promise<void> {
    if (!confirm(`¿Quitar «${material.titulo}» de la biblioteca?\nEl archivo seguirá en tu Google Drive.`)) {
      return;
    }
    this.mensaje.set('');
    this.error.set('');
    try {
      await this.servicio.eliminar(material.id);
      if (this.editandoId() === material.id) this.limpiarFormulario();
      await this.cargar();
    } catch {
      this.error.set('No se pudo eliminar el material.');
    }
  }

  private limpiarFormulario(): void {
    this.editandoId.set(null);
    this.form.reset();
  }

  private async cargar(): Promise<void> {
    try {
      this.materiales.set(await this.servicio.listarTodos());
    } catch {
      this.error.set('No se pudo cargar la lista de materiales.');
    } finally {
      this.cargando.set(false);
    }
  }
}
