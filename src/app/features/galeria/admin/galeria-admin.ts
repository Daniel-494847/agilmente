import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { NOMBRES_COLECCION } from '@core/firebase';
import { ContentService } from '@core/services/content.service';
import { CloudinaryService } from '@core/services/cloudinary.service';
import { FotoGaleria } from '@features/galeria/galeria.model';

@Component({
  selector: 'app-galeria-admin',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './galeria-admin.html'
})
export class GaleriaAdmin implements OnInit {
  private readonly content = inject(ContentService);
  private readonly cloudinary = inject(CloudinaryService);
  private readonly fb = inject(FormBuilder);

  readonly fotos = signal<FotoGaleria[]>([]);
  readonly cargando = signal(true);
  readonly guardando = signal(false);
  readonly editandoId = signal<string | null>(null);
  readonly mensaje = signal('');
  readonly error = signal('');
  readonly previewUrl = signal('');
  readonly archivoSeleccionado = signal<File | null>(null);

  readonly form = this.fb.nonNullable.group({
    alt: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(120)]],
    url: [''],
    publicado: [true]
  });

  async ngOnInit(): Promise<void> {
    await this.cargar();
  }

  /** Previsualiza el archivo elegido o restaura la imagen actual si no eligió nada. */
  onFileChange(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0] ?? null;
    this.archivoSeleccionado.set(file);
    this.error.set('');

    if (!file) {
      this.previewUrl.set(this.form.controls.url.value);
      return;
    }
    if (!file.type.startsWith('image/')) {
      this.error.set('Solo se permiten archivos de imagen.');
      this.archivoSeleccionado.set(null);
      this.previewUrl.set(this.form.controls.url.value);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => this.previewUrl.set(String(reader.result ?? ''));
    reader.readAsDataURL(file);
  }

  editar(foto: FotoGaleria): void {
    this.editandoId.set(foto.id);
    this.form.setValue({
      alt: foto.alt,
      url: foto.url,
      publicado: foto.publicado !== false
    });
    this.previewUrl.set(foto.url);
    this.archivoSeleccionado.set(null);
    this.mensaje.set('');
    this.error.set('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  cancelar(): void {
    this.editandoId.set(null);
    this.archivoSeleccionado.set(null);
    this.previewUrl.set('');
    this.form.reset({ alt: '', url: '', publicado: true });
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

    // Nueva foto: exige archivo o URL. Edición: usa la URL existente.
    const esNueva = !this.editandoId();
    const archivo = this.archivoSeleccionado();
    const urlFormulario = this.form.controls.url.value.trim();
    if (esNueva && !archivo && !urlFormulario) {
      this.error.set('Sube una imagen o indica una URL.');
      return;
    }

    this.guardando.set(true);
    try {
      const datos: Partial<FotoGaleria> & { id?: string } = {
        alt: this.form.controls.alt.value.trim(),
        url: urlFormulario,
        publicado: this.form.controls.publicado.value
      };

      if (archivo) {
        const resultado = await this.cloudinary.subirImagen(archivo, 'galeria');
        datos.url = resultado.secure_url;
        datos.publicId = resultado.public_id;
        if (!this.editandoId()) datos.creadoEn = Date.now();
      }

      if (this.editandoId()) {
        datos.id = this.editandoId()!;
      }

      await this.content.guardar(NOMBRES_COLECCION.fotosGaleria, datos);
      this.mensaje.set(
        this.editandoId() ? 'Foto actualizada.' : datos.publicado ? 'Foto publicada.' : 'Foto guardada como borrador.'
      );
      this.cancelar();
      await this.cargar();
    } catch (err) {
      console.error(err);
      this.error.set(
        this.cloudinary.error() ?? 'No se pudo guardar la foto. Verifica conexión y rol administrador.'
      );
    } finally {
      this.guardando.set(false);
    }
  }

  async cambiarPublicacion(foto: FotoGaleria): Promise<void> {
    try {
      await this.content.actualizar(NOMBRES_COLECCION.fotosGaleria, foto.id, {
        publicado: !foto.publicado
      });
      await this.cargar();
    } catch {
      this.error.set('No se pudo cambiar el estado de publicación.');
    }
  }

  async eliminar(foto: FotoGaleria): Promise<void> {
    if (!confirm(`¿Eliminar la foto «${foto.alt}» de la galería?`)) {
      return;
    }
    try {
      await this.content.eliminar(NOMBRES_COLECCION.fotosGaleria, foto.id);
      if (this.editandoId() === foto.id) this.cancelar();
      await this.cargar();
      this.mensaje.set('Foto eliminada.');
    } catch {
      this.error.set('No se pudo eliminar la foto.');
    }
  }

  private async cargar(): Promise<void> {
    this.cargando.set(true);
    try {
      this.fotos.set(await this.content.listar<FotoGaleria>(NOMBRES_COLECCION.fotosGaleria));
    } catch {
      this.error.set('No se pudo cargar la lista de fotos.');
    } finally {
      this.cargando.set(false);
    }
  }
}