import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { ContentService } from '../../../core/services/content.service';
import { NOMBRES_COLECCION } from '../../../core/firebase';

@Component({
  selector: 'app-section-content-admin',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './section-content-admin.html'
})
export class SectionContentAdmin implements OnInit {
  private readonly service = inject(ContentService);
  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(FormBuilder);
  private readonly sectionId = (this.route.snapshot.data['sectionId'] as string) || 'progreso';

  readonly saving = signal(false);
  readonly message = signal('');
  readonly error = signal('');
  readonly form = this.fb.nonNullable.group({
    title: ['', [Validators.required, Validators.maxLength(100)]],
    description: ['', [Validators.required, Validators.maxLength(500)]],
    badge: ['', [Validators.required, Validators.maxLength(40)]]
  });

  async ngOnInit(): Promise<void> {
    const defaults = this.route.snapshot.data;
    this.form.setValue({
      title: defaults['title'] ?? '',
      description: defaults['description'] ?? '',
      badge: defaults['badge'] ?? ''
    });
    try {
      const content = await this.service.obtener<{
        title: string;
        description: string;
        badge: string;
      }>(NOMBRES_COLECCION.contenidoSecciones, this.sectionId);
      if (content) this.form.setValue(content);
    } catch {
      this.error.set('No se pudo cargar el contenido.');
    }
  }

  async guardar(): Promise<void> {
    this.message.set('');
    this.error.set('');
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    try {
      await this.service.guardar(NOMBRES_COLECCION.contenidoSecciones, {
        id: this.sectionId,
        ...this.form.getRawValue()
      });
      this.message.set('Contenido guardado.');
    } catch {
      this.error.set('No se pudo guardar. Verifica rol administrador.');
    } finally {
      this.saving.set(false);
    }
  }
}
