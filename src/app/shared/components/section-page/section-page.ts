import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { ContentService } from '../../../core/services/content.service';
import { NOMBRES_COLECCION } from '../../../core/firebase';

interface SectionItem {
  title: string;
  description: string;
  icon: string;
  route: string;
  externalUrl?: string;
}

@Component({
  selector: 'app-section-page',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './section-page.html'
})
export class SectionPage implements OnInit {
  private readonly contentService = inject(ContentService);
  private readonly route = inject(ActivatedRoute);

  title = 'Sección';
  description = 'Contenido de la sección.';
  badge = 'Explora';
  items: SectionItem[] = [];

  async ngOnInit(): Promise<void> {
    const data = this.route.snapshot.data;
    this.title = data['title'] ?? this.title;
    this.description = data['description'] ?? this.description;
    this.badge = data['badge'] ?? this.badge;
    this.items = data['items'] ?? this.items;

    const contentId = data['contentId'];
    if (contentId) {
      try {
        const content = await this.contentService.obtener<{
          title?: string;
          description?: string;
          badge?: string;
        }>(NOMBRES_COLECCION.contenidoSecciones, contentId);
        if (content) {
          this.title = content.title ?? this.title;
          this.description = content.description ?? this.description;
          this.badge = content.badge ?? this.badge;
        }
      } catch (error) {
        console.error('No se pudo cargar el contenido de la sección:', error);
      }
    }
  }
}
