import { Component, Input, computed, effect, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

import { AuthService } from '@core/auth/auth.service';
import { db, NOMBRES_COLECCION } from '@core/firebase';
import { ActividadResumen } from '@core/models/actividad.model';
import { nombreCurso } from '@core/models/usuario.model';
import { PerfilUsuario } from '@core/services/usuario.service';
import { UsuarioService } from '@core/services/usuario.service';

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

  private readonly auth = inject(AuthService);
  private readonly usuarios = inject(UsuarioService);

  /** Docente o administrador: ven «Asignar» en lugar de «Compartir». */
  readonly esDocente = computed(() => this.auth.esDocente());
  readonly user = this.auth.user;

  /** Perfil del docente (curso y paralelo asignados por el administrador). */
  readonly perfilDocente = signal<PerfilUsuario | null>(null);

  /** Grado asignado al docente, p. ej. «Primero A». Vacío si no tiene grado. */
  readonly gradoAsignado = computed(() => {
    const p = this.perfilDocente();
    if (!p || p.curso === undefined) return '';
    return nombreCurso(p.curso, p.paralelo);
  });

  /** Puede asignar cuando es docente y tiene un grado asignado. */
  readonly puedeAsignar = computed(() => this.esDocente() && this.gradoAsignado() !== '');

  constructor() {
    // Carga el perfil del docente cuando hay sesión y el rol es docente/administrador.
    effect(() => {
      const u = this.user();
      if (u && this.esDocente()) {
        this.cargarPerfilDocente(u.uid);
      } else {
        this.perfilDocente.set(null);
      }
    });
  }

  private async cargarPerfilDocente(uid: string): Promise<void> {
    try {
      const p = await this.usuarios.obtenerPerfil(uid);
      this.perfilDocente.set(p ?? null);
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

  /** Etiqueta de accesibilidad del botón principal. */
  ariaBoton(): string {
    return `${this.textoBoton()} actividad ${this.actividad.titulo}`;
  }

  /** Etiqueta de accesibilidad del grupo de acciones. */
  ariaGrupo(): string {
    return this.esDocente() ? 'Asignar actividad' : 'Compartir actividad';
  }

  /** URL absoluta de la actividad, apta para compartir. */
  urlCompartible(): string {
    const base = `${window.location.origin}${window.location.pathname}`;
    return new URL(this.actividad.ruta, base).toString();
  }

  textoCompartir(): string {
    return `${this.actividad.titulo}: ${this.actividad.descripcion}`;
  }

  /** Comparte con la API nativa si existe; si no, abre WhatsApp como respaldo. */
  async compartir(evento: Event): Promise<void> {
    evento.preventDefault();
    evento.stopPropagation();

    const url = this.urlCompartible();
    const texto = this.textoCompartir();

    if (navigator.share) {
      try {
        await navigator.share({ title: this.actividad.titulo, text: texto, url });
        return;
      } catch {
        // El usuario canceló el compartir nativo: no hace nada más.
        return;
      }
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

    const uid = this.user()?.uid;
    if (!uid) return;

    let perfil = this.perfilDocente();
    if (!perfil) {
      try {
        perfil = await this.usuarios.obtenerPerfil(uid);
        this.perfilDocente.set(perfil ?? null);
      } catch {
        return;
      }
    }

    // El docente debe tener un curso y paralelo asignados para poder asignar.
    if (!perfil?.curso || !perfil.paralelo) {
      return;
    }

    await this.registrarAsignacion(perfil.curso, perfil.paralelo);
  }

  /** Guarda la asignación de la actividad al grado del docente. */
  private async registrarAsignacion(curso: number, paralelo: 'A' | 'B'): Promise<void> {
    const uid = this.user()!.uid;
    await setDoc(doc(db, NOMBRES_COLECCION.asignaciones), {
      actividadId: this.actividad.id,
      ruta: this.actividad.ruta,
      titulo: this.actividad.titulo,
      docenteUid: uid,
      curso,
      paralelo,
      creadoEn: serverTimestamp()
    });
  }

  enlaceWhatsapp(): string {
    return `https://api.whatsapp.com/send?text=${encodeURIComponent(
      `${this.textoCompartir()} ${this.urlCompartible()}`
    )}`;
  }

  /** Copia el enlace al portapapeles y evita abrir WhatsApp. */
  async copiar(evento: Event): Promise<void> {
    evento.preventDefault();
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
