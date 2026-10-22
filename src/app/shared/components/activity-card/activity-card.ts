import {
  Component,
  ElementRef,
  HostListener,
  Input,
  ViewChild,
  computed,
  effect,
  inject,
  signal
} from '@angular/core';
import { Location } from '@angular/common';
import { RouterLink } from '@angular/router';

import { AuthService } from '@core/auth/auth.service';
import { ActividadResumen } from '@core/models/actividad.model';
import { CursoAsignado, codigoCurso } from '@core/models/usuario.model';
import { AsignacionesService } from '@core/services/asignaciones.service';
import { PerfilUsuario, UsuarioService } from '@core/services/usuario.service';

/** Mapa colorTema → clases Bootstrap */
const TEMA_CLASES: Record<ActividadResumen['colorTema'], string> = {
  purple: 'bg-primary-subtle border-primary-subtle text-primary',
  green: 'bg-success-subtle border-success-subtle text-success',
  amber: 'bg-warning-subtle border-warning-subtle text-warning',
  blue: 'bg-info-subtle border-info-subtle text-info',
  pink: 'bg-danger-subtle border-danger-subtle text-danger',
  orange: 'bg-warning-subtle border-warning-subtle text-warning-emphasis'
};

const TEMA_BTN: Record<ActividadResumen['colorTema'], string> = {
  purple: 'btn-primary',
  green: 'btn-success',
  amber: 'btn-warning',
  blue: 'btn-info',
  pink: 'btn-danger',
  orange: 'btn-warning'
};

@Component({
  selector: 'app-activity-card',
  imports: [RouterLink],
  templateUrl: './activity-card.html'
})
export class ActivityCard {
  @Input({ required: true }) actividad!: ActividadResumen;
  @Input({ required: true }) numero!: number;

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly auth = inject(AuthService);
  private readonly usuarios = inject(UsuarioService);
  private readonly asignaciones = inject(AsignacionesService);
  private readonly location = inject(Location);

  @ViewChild('menu') private menuRef?: ElementRef<HTMLElement>;

  /** Docente o administrador: ven «Asignar» en lugar de «Compartir». */
  readonly esDocente = computed(() => this.auth.esDocente());
  readonly user = this.auth.user;

  /** Perfil del docente (curso y paralelo asignados por el administrador). */
  readonly perfilDocente = signal<PerfilUsuario | null>(null);

  /** Expuesto a la plantilla para el menú de asignación. */
  readonly codigoCurso = codigoCurso;

  /** Menú de compartir abierto (se gestiona aquí porque Bootstrap JS no se carga). */
  readonly menuAbierto = signal(false);
  readonly asignando = signal(false);
  readonly errorAsignacion = signal('');

  /** El navegador puede abrir la hoja nativa de compartir. */
  readonly puedeCompartirNativo =
    typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  /** Cursos del docente (puede tener varios). */
  readonly cursosDocente = computed(() => this.perfilDocente()?.cursos ?? []);

  /** Puede asignar cuando es docente y tiene al menos un curso asignado. */
  readonly puedeAsignar = computed(
    () => this.esDocente() && this.cursosDocente().length > 0
  );

  /** `true` si la actividad está asignada a TODOS los cursos del docente. */
  readonly asignada = computed(() => {
    const cursos = this.cursosDocente();
    return cursos.length > 0 && cursos.every((c) => this.asignadaEn(c));
  });

  /** `true` si la actividad está asignada a ese curso. */
  asignadaEn(curso: CursoAsignado): boolean {
    return this.asignaciones.estaAsignada(
      this.actividad.ruta,
      curso.curso,
      curso.paralelo
    );
  }

  constructor() {
    // Carga el perfil del docente cuando hay sesión y el rol es docente/administrador.
    effect(() => {
      const u = this.user();
      if (u && this.esDocente()) {
        void this.cargarPerfilDocente(u.uid);
      } else {
        this.perfilDocente.set(null);
      }
    });
  }

  private async cargarPerfilDocente(uid: string): Promise<void> {
    try {
      const perfil = await this.usuarios.obtenerPerfil(uid);
      this.perfilDocente.set(perfil ?? null);
      if (perfil?.cursos?.length) {
        await this.asignaciones.cargarDelDocente(uid);
      }
    } catch {
      this.perfilDocente.set(null);
    }
  }

  clasesTema(): string {
    return TEMA_CLASES[this.actividad.colorTema] ?? TEMA_CLASES.blue;
  }

  claseBoton(): string {
    return TEMA_BTN[this.actividad.colorTema] ?? 'btn-primary';
  }

  /** Texto del botón principal según el rol del usuario. */
  textoBoton(): string {
    return this.esDocente() ? 'Asignar' : 'Compartir';
  }

  /** Texto del botón de asignación: solo «Asignada» o «Asignar». */
  textoAsignar(): string {
    if (this.asignando()) {
      return 'Guardando…';
    }
    return this.asignada() ? 'Asignada' : 'Asignar';
  }

  /** Etiqueta de accesibilidad del botón principal. */
  ariaBoton(): string {
    return `${this.textoBoton()} actividad ${this.actividad.titulo}`;
  }

  /** Etiqueta de accesibilidad del grupo de acciones. */
  ariaGrupo(): string {
    return this.esDocente() ? 'Asignar actividad' : 'Compartir actividad';
  }

  /**
   * URL absoluta de la actividad, apta para compartir.
   *
   * Usa `Location.prepareExternalUrl`, que antepone el `<base href>` igual que
   * el router. Sin eso, en GitHub Pages el enlace perdía el prefijo
   * `/agilmente/` y abría un 404.
   */
  urlCompartible(): string {
    const ruta = this.location.prepareExternalUrl(this.actividad.ruta);
    return new URL(ruta, window.location.origin).toString();
  }

  textoCompartir(): string {
    return `${this.actividad.titulo}: ${this.actividad.descripcion}`;
  }

  /** Abre o cierra el menú de compartir. */
  alternarMenu(evento: Event): void {
    evento.preventDefault();
    evento.stopPropagation();
    this.menuAbierto.update((abierto) => !abierto);
  }

  /** Cierra el menú al hacer clic fuera o sobre una de sus opciones. */
  @HostListener('document:click', ['$event'])
  cerrarMenu(evento: Event): void {
    if (!this.menuAbierto()) {
      return;
    }
    const objetivo = evento.target as Node | null;
    if (objetivo && this.menuRef?.nativeElement.contains(objetivo)) {
      this.menuAbierto.set(false);
      return;
    }
    if (objetivo && this.host.nativeElement.contains(objetivo)) {
      return;
    }
    this.menuAbierto.set(false);
  }

  @HostListener('document:keydown.escape')
  cerrarMenuConEscape(): void {
    this.menuAbierto.set(false);
  }

  /** Comparte con la API nativa si existe; si no, abre WhatsApp como respaldo. */
  async compartir(evento: Event): Promise<void> {
    evento.preventDefault();
    evento.stopPropagation();
    this.menuAbierto.set(false);

    const url = this.urlCompartible();
    const texto = this.textoCompartir();

    if (navigator.share) {
      try {
        await navigator.share({ title: this.actividad.titulo, text: texto, url });
      } catch {
        // El usuario canceló el compartir nativo: no hace nada más.
      }
      return;
    }
    window.open(
      `https://api.whatsapp.com/send?text=${encodeURIComponent(`${texto} ${url}`)}`,
      '_blank',
      'noopener'
    );
  }

  /**
   * Asigna o quita la actividad en un curso del docente. Con varios cursos,
   * cada uno se marca por separado; volver a pulsar el mismo curso la quita.
   */
  async alternarAsignacion(evento: Event, curso: CursoAsignado): Promise<void> {
    evento.preventDefault();
    evento.stopPropagation();

    if (this.asignando() || !this.puedeAsignar()) {
      return;
    }
    const uid = this.user()?.uid;
    if (!uid) {
      return;
    }

    this.asignando.set(true);
    this.errorAsignacion.set('');
    try {
      if (this.asignadaEn(curso)) {
        await this.asignaciones.quitar(
          this.asignaciones.idDe(this.actividad.ruta, curso.curso, curso.paralelo)
        );
      } else {
        await this.asignaciones.asignar(
          {
            actividadId: this.actividad.id,
            ruta: this.actividad.ruta,
            titulo: this.actividad.titulo,
            curso: curso.curso,
            paralelo: curso.paralelo
          },
          uid
        );
      }
    } catch (error) {
      console.error('No se pudo actualizar la asignación', error);
      this.errorAsignacion.set(
        'No se pudo actualizar la asignación. Inténtalo de nuevo.'
      );
    } finally {
      this.asignando.set(false);
    }
  }

  enlaceWhatsapp(): string {
    return `https://api.whatsapp.com/send?text=${encodeURIComponent(
      `${this.textoCompartir()} ${this.urlCompartible()}`
    )}`;
  }

  /** Copia el enlace al portapapeles y evita abrir WhatsApp. */
  async copiar(evento: Event): Promise<void> {
    evento.preventDefault();
    this.menuAbierto.set(false);
    try {
      await navigator.clipboard.writeText(this.urlCompartible());
    } catch {
      // Sin permisos de portapapeles: no hace nada.
    }
  }

  enlaceFacebook(): string {
    return `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(this.urlCompartible())}`;
  }

  enlaceTelegram(): string {
    return `https://t.me/share/url?url=${encodeURIComponent(this.urlCompartible())}&text=${encodeURIComponent(this.textoCompartir())}`;
  }
}
