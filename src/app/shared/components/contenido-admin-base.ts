import { DestroyRef, inject } from '@angular/core';
import { ContentService } from '@core/services/content.service';
import { CloudinaryService } from '@core/services/cloudinary.service';
import { NombreColeccion } from '@core/firebase';

/**
 * Base reutilizable para las pantallas de administración de contenido.
 *
 * Las features (biblioteca, galería, avisos, contactos, unidad-educativa,
 * actividades) comparten el mismo flujo: listar documentos de una colección,
 * guardar/actualizar, eliminar y (opcionalmente) subir una imagen a Cloudinary.
 * En lugar de reimplementar ese flujo en cada admin, se extiende esta clase y
 * se aporta únicamente el modelo concreto y el template.
 *
 * Uso:
 *   export class AvisosAdmin extends ContenidoAdminBase<Aviso> {
 *     protected readonly coleccion = NOMBRES_COLECCION.comunicados;
 *     // métodos específicos...
 *   }
 */
export abstract class ContenidoAdminBase<T extends { id?: string }> {
  protected readonly content = inject(ContentService);
  protected readonly cloudinary = inject(CloudinaryService);
  protected readonly destroyRef = inject(DestroyRef);

  /** Colección de Firestore sobre la que opera este admin. */
  protected abstract coleccion: NombreColeccion;

  protected async listarItems(): Promise<T[]> {
    return this.content.listar<T>(this.coleccion);
  }

  protected async listarPublicadosItems(): Promise<T[]> {
    return this.content.listarPublicados<T>(this.coleccion);
  }

  protected async obtenerItem(id: string): Promise<T | null> {
    return this.content.obtener<T>(this.coleccion, id);
  }

  protected async guardarItem(contenido: T): Promise<void> {
    await this.content.guardar(this.coleccion, contenido);
  }

  protected async actualizarItem(id: string, datos: Partial<Record<string, unknown>>): Promise<void> {
    await this.content.actualizar(this.coleccion, id, datos);
  }

  protected async eliminarItem(id: string): Promise<void> {
    await this.content.eliminar(this.coleccion, id);
  }

  protected subiendoImagen(): boolean {
    return this.cloudinary.subiendo();
  }

  protected progresoSubida(): number {
    return this.cloudinary.progreso();
  }
}
