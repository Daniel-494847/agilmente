import { Component, OnInit, inject, signal } from '@angular/core';

import { NOMBRES_COLECCION } from '@core/firebase';
import { ContentService } from '@core/services/content.service';
import { CloudinaryService } from '@core/services/cloudinary.service';
import { FotoGaleria } from './galeria.model';

@Component({
  selector: 'app-galeria',
  templateUrl: './galeria.html'
})
export class Galeria implements OnInit {
  private readonly content = inject(ContentService);
  private readonly cloudinary = inject(CloudinaryService);

  readonly fotos = signal<FotoGaleria[]>([]);
  readonly cargando = signal(true);
  readonly error = signal('');

  async ngOnInit(): Promise<void> {
    try {
      const lista = await this.content.listarPublicados<FotoGaleria>(NOMBRES_COLECCION.fotosGaleria);
      this.fotos.set(lista);
    } catch {
      this.error.set('No se pudo cargar la galería. Revisa tu conexión.');
    } finally {
      this.cargando.set(false);
    }
  }

  /** URL optimizada de Cloudinary con recorte 4:3; para URLs externas usa la original. */
  urlDe(foto: FotoGaleria): string {
    if (!foto.publicId) return foto.url;
    return this.cloudinary.urlOptimizada(foto.publicId, 800, 600);
  }
}