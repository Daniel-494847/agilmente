import {
  Component,
  ElementRef,
  HostListener,
  computed,
  effect,
  inject,
  signal
} from '@angular/core';
import { RouterLink } from '@angular/router';

import { AuthService } from '@core/auth/auth.service';
import { AsignacionActividad, AsignacionesService } from '@core/services/asignaciones.service';
import { UsuarioService } from '@core/services/usuario.service';

/** Prefijo de la clave con la que se recuerdan las tareas ya vistas. */
const CLAVE_LEIDAS = 'agilmente_asignaciones_leidas:';

/**
 * Campana de notificaciones del estudiante.
 *
 * Muestra cuántas actividades le asignó su docente y las lista en un panel.
 * Solo aparece para estudiantes con perfil: el docente ve sus asignaciones en
 * la propia tarjeta de la actividad y el administrador las gestiona desde su
 * módulo.
 *
 * Las tareas ya vistas se recuerdan en `localStorage` por usuario; así el
 * contador no vuelve a subir al recargar la página.
 */
@Component({
  selector: 'app-notificaciones-asignaciones',
  imports: [RouterLink],
  templateUrl: './notificaciones-asignaciones.html'
})
export class NotificacionesAsignaciones {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly auth = inject(AuthService);
  private readonly usuarios = inject(UsuarioService);
  private readonly asignaciones = inject(AsignacionesService);

  readonly cargando = signal(true);
  readonly asignadas = signal<AsignacionActividad[]>([]);
  readonly abierto = signal(false);
  readonly leidas = signal<ReadonlySet<string>>(new Set());
  readonly error = signal('');

  /** La campana solo existe para estudiantes con sesión. */
  readonly visible = computed(() => this.auth.rol() === 'estudiante' && !!this.auth.user());

  /** Tareas que el estudiante todavía no ha abierto. */
  readonly noLeidas = computed(() => {
    const leidas = this.leidas();
    return this.asignadas().filter((a) => !leidas.has(a.id)).length;
  });

  readonly etiqueta = computed(() => {
    const total = this.asignadas().length;
    const nuevas = this.noLeidas();
    if (!total) {
      return 'No tienes actividades asignadas';
    }
    return nuevas
      ? `${nuevas} actividad(es) nueva(s) asignada(s)`
      : 'Actividades asignadas por tu docente';
  });

  constructor() {
    effect(() => {
      const user = this.auth.user();
      if (!user || this.auth.rol() !== 'estudiante') {
        this.asignadas.set([]);
        this.abierto.set(false);
        this.cargando.set(false);
        return;
      }
      this.leidas.set(this.leerLeidas(user.uid));
      void this.cargar(user.uid);
    });
  }

  private async cargar(uid: string): Promise<void> {
    this.cargando.set(true);
    this.error.set('');
    try {
      const perfil = await this.usuarios.obtenerPerfil(uid);
      if (!perfil?.curso || !perfil.paralelo) {
        this.asignadas.set([]);
        return;
      }
      this.asignadas.set(await this.asignaciones.listarDeCurso(perfil.curso, perfil.paralelo));
    } catch {
      this.error.set('No se pudieron cargar tus actividades asignadas.');
    } finally {
      this.cargando.set(false);
    }
  }

  /** Abre o cierra el panel y, al abrirlo, marca las tareas como vistas. */
  alternar(): void {
    this.abierto.update((visible) => !visible);
    if (this.abierto()) {
      this.marcarLeidas();
    }
  }

  marcarLeidas(): void {
    const uid = this.auth.user()?.uid;
    if (!uid) {
      return;
    }
    const ids = new Set(this.leidas());
    for (const asignacion of this.asignadas()) {
      ids.add(asignacion.id);
    }
    this.leidas.set(ids);
    try {
      localStorage.setItem(CLAVE_LEIDAS + uid, JSON.stringify([...ids]));
    } catch {
      // Sin almacenamiento local: la marca queda solo en esta sesión.
    }
  }

  /** Fecha corta de la asignación. */
  formatoFecha(fecha: Date | null): string {
    if (!fecha) {
      return '';
    }
    return fecha.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
  }

  @HostListener('document:click', ['$event'])
  alHacerClicFuera(evento: Event): void {
    if (!this.abierto()) {
      return;
    }
    const objetivo = evento.target as Node | null;
    if (objetivo && this.host.nativeElement.contains(objetivo)) {
      return;
    }
    this.abierto.set(false);
  }

  @HostListener('document:keydown.escape')
  alPulsarEscape(): void {
    this.abierto.set(false);
  }

  private leerLeidas(uid: string): ReadonlySet<string> {
    try {
      const crudo = localStorage.getItem(CLAVE_LEIDAS + uid);
      const lista: unknown = crudo ? JSON.parse(crudo) : [];
      return new Set(Array.isArray(lista) ? lista.map(String) : []);
    } catch {
      return new Set();
    }
  }
}
