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
import { nombreCurso } from '@core/models/usuario.model';
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

  /** Menú de compartir abierto (se gestiona aquí porque Bootstrap JS no se carga). */
  readonly menuAbierto = signal(false);
  readonly asignando = signal(false);
  readonly errorAsignacion = signal('');

  /** El navegador puede abrir la hoja nativa de compartir. */
  readonly puedeCompartirNativo =
    typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  /** Grado asignado al docente, p. ej. «Primero A». Vacío si no tiene grado. */
  readonly gradoAsignado = computed(() => {
    const p = this.perfilDocente();
    if (!p || p.curso === undefined) return '';
    return nombreCurso(p.curso, p.paralelo);
  });

  /** Puede asignar cuando es docente y tiene un grado asignado. */
  readonly puedeAsignar = computed(() => this.esDocente() && this.gradoAsignado() !== '');

  /** `true` si esta actividad ya fue asignada al curso del docente. */
  readonly asignada = computed(() => {
    const p = this.perfilDocente();
    if (!p?.curso || !p.paralelo) return false;
    return this.asignaciones.estaAsignada(this.actividad.ruta, p.curso, p.paralelo);
  });

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
      if (perfil?.curso && perfil.paralelo) {
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

  /** Texto del botón de asignación, con el estado actual. */
  textoAsignar(): string {
    if (this.asignando()) {
      return 'Asignando…';
    }
    if (this.asignada()) {
      return `Asignada a ${this.gradoAsignado()}`;
    }
    return this.puedeAsignar() ? `Asignar a ${this.gradoAsignado()}` : 'Asignar';
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

  /** Asigna la actividad al grado del docente (curso + paralelo). */
  async asignar(evento: Event): Promise<void> {
    evento.preventDefault();
    evento.stopPropagation();

    if (this.asignando() || !this.puedeAsignar()) {
      return;
    }
    const uid = this.user()?.uid;
    if (!uid) {
      return;
    }

    let perfil = this.perfilDocente();
    if (!perfil) {
      try {
        perfil = await this.usuarios.obtenerPerfil(uid);
        this.perfilDocente.set(perfil ?? null);
      } catch {
        this.errorAsignacion.set('No se pudo leer tu perfil. Inténtalo de nuevo.');
        return;
      }
    }

    // El docente debe tener un curso y paralelo asignados para poder asignar.
    if (!perfil?.curso || !perfil.paralelo) {
      return;
    }

    this.asignando.set(true);
    this.errorAsignacion.set('');
    try {
      await this.asignaciones.asignar(
        {
          actividadId: this.actividad.id,
          ruta: this.actividad.ruta,
          titulo: this.actividad.titulo,
          curso: perfil.curso,
          paralelo: perfil.paralelo
        },
        uid
      );
    } catch {
      this.errorAsignacion.set('No se pudo asignar la actividad. Inténtalo de nuevo.');
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
