import { Injectable, signal } from '@angular/core';

export interface CloudinaryUploadResult {
  secure_url: string;
  public_id: string;
  format: string;
  width: number;
  height: number;
  bytes: number;
}

@Injectable({ providedIn: 'root' })
export class CloudinaryService {
  private readonly cloudName = 'kww1uxz3';
  private readonly uploadPreset = 'images-agilmente';

  readonly subiendo = signal(false);
  readonly progreso = signal(0);
  readonly error = signal<string | null>(null);

  /**
   * Sube una imagen a Cloudinary usando unsigned upload.
   * @param file Archivo de imagen a subir
   * @param folder Carpeta opcional en Cloudinary (ej: 'biblioteca', 'galeria')
   */
  async subirImagen(file: File, folder?: string): Promise<CloudinaryUploadResult> {
    this.subiendo.set(true);
    this.progreso.set(0);
    this.error.set(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_preset', this.uploadPreset);
      if (folder) formData.append('folder', folder);

      const url = `https://api.cloudinary.com/v1_1/${this.cloudName}/image/upload`;

      const result = await new Promise<CloudinaryUploadResult>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', url);

        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            this.progreso.set(Math.round((event.loaded / event.total) * 100));
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(JSON.parse(xhr.responseText));
          } else {
            reject(new Error(this.extraerMensajeError(xhr)));
          }
        };

        xhr.onerror = () => reject(new Error('Error de red al subir la imagen'));
        xhr.send(formData);
      });

      this.progreso.set(100);
      return result;
    } catch (err) {
      const mensaje = err instanceof Error ? err.message : 'Error desconocido';
      this.error.set(mensaje);
      throw err;
    } finally {
      this.subiendo.set(false);
    }
  }

  /** Extrae el mensaje de error real que devuelve Cloudinary en el body de la respuesta. */
  private extraerMensajeError(xhr: XMLHttpRequest): string {
    const cuerpo = this.intentarParsear(xhr.responseText);
    const mensajeCloudinary =
      cuerpo?.error?.message ?? cuerpo?.message ?? cuerpo?.error ?? xhr.statusText;
    return `Error ${xhr.status}: ${mensajeCloudinary}`;
  }

  private intentarParsear(texto: string): { error?: { message?: string }; message?: string } | null {
    if (!texto) return null;
    try {
      return JSON.parse(texto) as { error?: { message?: string }; message?: string };
    } catch {
      return null;
    }
  }

  /**
   * Genera una URL optimizada de Cloudinary.
   * @param publicId ID público de la imagen en Cloudinary
   * @param width Ancho opcional
   * @param height Alto opcional
   */
  urlOptimizada(publicId: string, width?: number, height?: number): string {
    let transformations = 'f_auto,q_auto';
    if (width) transformations += `,w_${width}`;
    if (height) transformations += `,h_${height}`;

    return `https://res.cloudinary.com/${this.cloudName}/image/upload/${transformations}/${publicId}`;
  }

  /**
   * Genera una URL con crop automático a cuadrado.
   * @param publicId ID público de la imagen
   * @param size Tamaño del cuadrado
   */
  urlCuadrado(publicId: string, size = 500): string {
    return `https://res.cloudinary.com/${this.cloudName}/image/upload/c_fill,g_auto,w_${size},h_${size},f_auto,q_auto/${publicId}`;
  }
}
