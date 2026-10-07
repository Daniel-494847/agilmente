import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { ActividadResumen } from '../../../core/models/actividad.model';
import { ActividadesService } from '../services/actividades.service';

@Component({
  selector: 'app-actividades-admin',
  imports: [FormsModule, RouterLink],
  templateUrl: './actividades-admin.html'
})
export class ActividadesAdmin implements OnInit {
  private readonly service = inject(ActividadesService);

  // Zoneless: la lista y los mensajes asíncronos viven en signals.
  readonly actividades = signal<ActividadResumen[]>([]);
  readonly cargando = signal(true);
  readonly mensaje = signal('');
  actividad: ActividadResumen = this.nuevaActividad();
  editando = false;

  async ngOnInit(): Promise<void> {
    await this.cargar();
  }

  async cargar(): Promise<void> {
    this.cargando.set(true);
    await this.service.inicializarSiVacia();
    this.actividades.set(await this.service.listar());
    this.cargando.set(false);
  }

  nueva(): void {
    this.actividad = this.nuevaActividad();
    this.editando = false;
    this.mensaje.set('');
  }

  editar(a: ActividadResumen): void {
    this.actividad = { ...a };
    this.editando = true;
    this.mensaje.set('');
  }

  async guardar(): Promise<void> {
    if (!this.actividad.titulo.trim() || !this.actividad.descripcion.trim() || !this.actividad.ruta.trim()) {
      this.mensaje.set('Completa el título, la descripción y la ruta.');
      return;
    }
    try {
      await this.service.guardar({
        ...this.actividad,
        titulo: this.actividad.titulo.trim(),
        descripcion: this.actividad.descripcion.trim(),
        ruta: this.actividad.ruta.trim()
      });
      this.mensaje.set('Actividad guardada correctamente.');
      await this.cargar();
      this.nueva();
    } catch {
      this.mensaje.set('No se pudo guardar la actividad.');
    }
  }

  async eliminar(a: ActividadResumen): Promise<void> {
    if (!confirm(`¿Eliminar "${a.titulo}"?`)) return;
    try {
      await this.service.eliminar(a.id);
      this.mensaje.set('Actividad eliminada.');
      await this.cargar();
    } catch {
      this.mensaje.set('No se pudo eliminar.');
    }
  }

  async cargarIniciales(): Promise<void> {
    try {
      await this.service.guardarIniciales();
      this.mensaje.set('Actividades iniciales guardadas en Firebase.');
      await this.cargar();
    } catch {
      this.mensaje.set('No se pudieron guardar las actividades iniciales.');
    }
  }

  private nuevaActividad(): ActividadResumen {
    return {
      id: Date.now(),
      titulo: '',
      descripcion: '',
      icono: 'bi-lightbulb',
      colorTema: 'blue',
      ruta: '/razonamiento-logico/nueva-actividad'
    };
  }
}
