import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { NOMBRES_COLECCION } from '../../../core/firebase';
import { ContentService } from '../../../core/services/content.service';
import { FotoGaleria } from '../galeria.model';

@Component({
  selector: 'app-galeria-admin',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './galeria-admin.html'
})
export class GaleriaAdmin implements OnInit {
  private readonly content = inject(ContentService);
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
    facebookUrl: ['', [Validators.maxLength(300)]],
    url: [''],
    publicado: [true]
  });

  async ngOnInit(): Promise<void> {
    await this.cargar();
  }

  onFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    this.archivoSeleccionado.set(file);
    this.error.set('');

    if (file) {
      if (!file.type.startsWith('image/')) {
        this.error.set('Solo se permiten archivos de imagen.');
        this.archivoSeleccionado.set(null);
        this.previewUrl.set('');
        return;
      }
      const reader = new FileReader();
      reader.onload = () => this.previewUrl.set(String(reader.result ?? ''));
      reader.readAsDataURL(file);
    } else {
      this.previewUrl.set('');
    }
  }

  editar(foto: FotoGaleria): void {
    this.editandoId.set(foto.id);
    this.form.setValue({
      alt: foto.alt,
      facebookUrl: foto.facebookUrl ?? '',
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
    this.form.reset({ alt: '', facebookUrl: '', url: '', publicado: true });
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

    const { alt, facebookUrl, url, publicado } = this.form.getRawValue();
    const archivo = this.archivoSeleccionado();
    const id = this.editandoId();

    // Nueva foto: requiere archivo. Edición: archivo opcional si ya hay url.
    if (!id && !archivo && !url.trim()) {
      this.error.set('Selecciona una imagen o indica una URL.');
      return;
    }

    this.guardando.set(true);
    try {
      let imageUrl = url.trim();

      if (archivo) {
        imageUrl = await this.content.subirImagen(archivo);
      }

      if (!imageUrl) {
        this.error.set('No hay URL de imagen válida.');
        return;
      }

      const datos: Partial<FotoGaleria> & { id?: string } = {
        alt: alt.trim(),
        url: imageUrl,
        facebookUrl: facebookUrl.trim() || undefined,
        publicado
      };

      if (id) {
        datos.id = id;
      }

      await this.content.guardar(NOMBRES_COLECCION.fotosGaleria, datos);
      this.mensaje.set(id ? 'Foto actualizada.' : publicado ? 'Foto publicada.' : 'Foto guardada como borrador.');
      this.cancelar();
      await this.cargar();
    } catch (e) {
      console.error(e);
      this.error.set('No se pudo guardar. Verifica conexión, Storage y rol administrador.');
    } finally {
      this.guardando.set(false);
    }
  }

  async cambiarPublicacion(foto: FotoGaleria): Promise<void> {
    try {
      await this.content.guardar(NOMBRES_COLECCION.fotosGaleria, {
        id: foto.id,
        alt: foto.alt,
        url: foto.url,
        facebookUrl: foto.facebookUrl,
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
      const lista = await this.content.listar<FotoGaleria>(NOMBRES_COLECCION.fotosGaleria);
      this.fotos.set(lista);
    } catch {
      this.error.set('No se pudo cargar la lista de fotos.');
    } finally {
      this.cargando.set(false);
    }
  }
}
