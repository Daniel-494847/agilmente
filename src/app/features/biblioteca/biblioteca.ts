import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

import {
  CATEGORIAS_MATERIAL,
  ETIQUETA_TIPO,
  ICONO_TIPO,
  MaterialBiblioteca
} from './models/biblioteca.model';
import { BibliotecaService } from './services/biblioteca.service';

@Component({
  selector: 'app-biblioteca',
  templateUrl: './biblioteca.html'
})
export class Biblioteca implements OnInit {
  private readonly servicio = inject(BibliotecaService);
  private readonly sanitizer = inject(DomSanitizer);

  readonly categorias = CATEGORIAS_MATERIAL;
  readonly icono = ICONO_TIPO;
  readonly etiqueta = ETIQUETA_TIPO;

  readonly materiales = signal<MaterialBiblioteca[]>([]);
  readonly cargando = signal(true);
  readonly error = signal('');
  readonly busqueda = signal('');
  readonly categoria = signal('Todas');

  portada(material: MaterialBiblioteca): SafeResourceUrl {
    const rutas: Record<MaterialBiblioteca['tipo'], string> = {
      archivo: `https://drive.google.com/file/d/${material.driveId}/preview`,
      documento: `https://docs.google.com/document/d/${material.driveId}/preview`,
      hoja: `https://docs.google.com/spreadsheets/d/${material.driveId}/preview`,
      presentacion: `https://docs.google.com/presentation/d/${material.driveId}/preview`,
      carpeta: `https://drive.google.com/drive/folders/${material.driveId}`
    };
    return this.sanitizer.bypassSecurityTrustResourceUrl(rutas[material.tipo]);
  }

  readonly filtrados = computed(() => {
    const texto = this.busqueda().trim().toLowerCase();
    const categoria = this.categoria();
    return this.materiales().filter(
      (m) =>
        (categoria === 'Todas' || m.categoria === categoria) &&
        (!texto || `${m.titulo} ${m.descripcion}`.toLowerCase().includes(texto))
    );
  });

  async ngOnInit(): Promise<void> {
    try {
      this.materiales.set(await this.servicio.listarPublicados());
    } catch {
      this.error.set('No se pudo cargar la biblioteca. Intenta nuevamente.');
    } finally {
      this.cargando.set(false);
    }
  }
}
