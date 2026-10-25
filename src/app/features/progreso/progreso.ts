import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { AuthService } from '@core/auth/auth.service';
import { NOMBRES_COLECCION } from '@core/firebase';
import { ColorTema } from '@core/models/actividad.model';
import { ContentService } from '@core/services/content.service';
import {
  EstadisticasService,
  EstadisticasUsuario,
  crearEstadisticasVacias
} from '@core/services/estadisticas.service';
import {
  ActividadJugable,
  ActividadesService
} from '@features/actividades/services/actividades.service';

interface EnlaceSeccion {
  title: string;
  description: string;
  icon: string;
  route: string;
  externalUrl?: string;
}

/** Fila de avance de un juego para la vista del estudiante. */
interface JuegoProgreso {
  slug: string;
  titulo: string;
  imagen?: string;
  icono: string;
  colorTema: ColorTema;
  ruta: string;
  jugado: boolean;
  intentos: number;
  puntos: number;
  /** Mejor porcentaje de aciertos logrado (0–100). */
  porcentaje: number;
  /** Porcentaje de aciertos acumulado de todas las partidas (0–100). */
  porcentajeGlobal: number;
  mejorNivel: number;
  correctas: number;
  incorrectas: number;
  ultimaEn: Date | null;
}

/** Clases Bootstrap por color de tema. */
const TEMA_CAJA: Record<ColorTema, string> = {
  purple: 'bg-primary-subtle text-primary',
  green: 'bg-success-subtle text-success',
  amber: 'bg-warning-subtle text-warning',
  blue: 'bg-info-subtle text-info',
  pink: 'bg-danger-subtle text-danger',
  orange: 'bg-warning-subtle text-warning-emphasis'
};

const TEMA_BARRA: Record<ColorTema, string> = {
  purple: 'bg-primary',
  green: 'bg-success',
  amber: 'bg-warning',
  blue: 'bg-info',
  pink: 'bg-danger',
  orange: 'bg-warning'
};

const TEMA_BOTON: Record<ColorTema, string> = {
  purple: 'btn-primary',
  green: 'btn-success',
  amber: 'btn-warning',
  blue: 'btn-info',
  pink: 'btn-danger',
  orange: 'btn-warning'
};

/**
 * Mi Progreso del estudiante: resume sus puntos, nivel y el avance (porcentaje)
 * que ha logrado en cada juego, calculado desde la colección `intentos`.
 */
@Component({
  selector: 'app-progreso',
  imports: [RouterLink],
  templateUrl: './progreso.html'
})
export class Progreso implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly authService = inject(AuthService);
  private readonly actividades = inject(ActividadesService);
  private readonly estadisticas = inject(EstadisticasService);
  private readonly content = inject(ContentService);

  readonly cargando = signal(true);
  readonly error = signal('');
  readonly necesitaSesion = signal(false);
  readonly titulo = signal('Mi Progreso');
  readonly descripcion = signal('Visualiza tus logros, metas y evolución en cada reto.');
  readonly badge = signal('Estadísticas');
  readonly enlaces = signal<EnlaceSeccion[]>([]);
  readonly avance = signal<EstadisticasUsuario>(crearEstadisticasVacias());
  readonly juegos = signal<JuegoProgreso[]>([]);

  readonly resumen = computed(() => {
    const avance = this.avance();
    const juegos = this.juegos();
    return {
      puntos: avance.puntos,
      nivel: avance.nivel,
      tituloNivel: avance.tituloNivel,
      intentos: avance.intentosFinalizados,
      jugados: juegos.filter((j) => j.jugado).length,
      total: juegos.length,
      porcentaje: avance.porcentajeAcierto,
      tiempo: avance.tiempoTotalSegundos
    };
  });

  async ngOnInit(): Promise<void> {
    const data = this.route.snapshot.data;
    this.titulo.set((data['title'] as string) ?? this.titulo());
    this.descripcion.set((data['description'] as string) ?? this.descripcion());
    this.badge.set((data['badge'] as string) ?? this.badge());
    this.enlaces.set((data['items'] as EnlaceSeccion[]) ?? []);

    const contentId = data['contentId'] as string | undefined;
    if (contentId) {
      void this.aplicarContenido(contentId);
    }

    await this.authService.ready;
    const user = this.authService.user();
    if (!user) {
      this.necesitaSesion.set(true);
      this.cargando.set(false);
      return;
    }

    try {
      // El perfil ya trae el resumen; si aún no se calculó, se leen los intentos.
      const perfil = this.authService.perfil();
      const catalogoPendiente = this.actividades.catalogoPorSlug();
      const avance = perfil?.resumen
        ? this.estadisticas.desdeResumen(perfil.resumen)
        : await this.estadisticas.resumenDeUsuario(user.uid);
      const catalogo = await catalogoPendiente;

      this.avance.set(avance);
      this.juegos.set(this.construirJuegos(catalogo, avance));
    } catch {
      this.error.set('No se pudo cargar tu progreso. Revisa tu conexión e inténtalo de nuevo.');
    } finally {
      this.cargando.set(false);
    }
  }

  private async aplicarContenido(contentId: string): Promise<void> {
    try {
      const contenido = await this.content.obtener<{
        title?: string;
        description?: string;
        badge?: string;
      }>(NOMBRES_COLECCION.contenidoSecciones, contentId);
      if (contenido?.title) this.titulo.set(contenido.title);
      if (contenido?.description) this.descripcion.set(contenido.description);
      if (contenido?.badge) this.badge.set(contenido.badge);
    } catch {
      // Contenido opcional: si falla, se usa el texto por defecto.
    }
  }

  private construirJuegos(
    catalogo: Map<string, ActividadJugable>,
    avance: EstadisticasUsuario
  ): JuegoProgreso[] {
    const pendientes = new Map(avance.porActividad.map((a) => [a.actividadId, a]));
    const lista: JuegoProgreso[] = [];

    catalogo.forEach((actividad, slug) => {
      const registro = pendientes.get(slug);
      lista.push({
        slug,
        titulo: actividad.titulo,
        imagen: actividad.imagen,
        icono: actividad.icono,
        colorTema: actividad.colorTema,
        ruta: actividad.ruta,
        jugado: !!registro,
        intentos: registro?.intentos ?? 0,
        puntos: registro?.puntos ?? 0,
        porcentaje: registro?.mejorPorcentaje ?? 0,
        porcentajeGlobal: registro?.porcentajeAcierto ?? 0,
        mejorNivel: registro?.mejorNivel ?? 0,
        correctas: registro?.respuestasCorrectas ?? 0,
        incorrectas: registro?.respuestasIncorrectas ?? 0,
        ultimaEn: registro?.ultimaEn ?? null
      });
      pendientes.delete(slug);
    });

    // Intentos de juegos que ya no están en el catálogo: se muestran igualmente.
    pendientes.forEach((registro, slug) => {
      lista.push({
        slug,
        titulo: this.prettify(slug),
        icono: 'bi-controller',
        colorTema: 'blue',
        ruta: '',
        jugado: true,
        intentos: registro.intentos,
        puntos: registro.puntos,
        porcentaje: registro.mejorPorcentaje,
        porcentajeGlobal: registro.porcentajeAcierto,
        mejorNivel: registro.mejorNivel,
        correctas: registro.respuestasCorrectas,
        incorrectas: registro.respuestasIncorrectas,
        ultimaEn: registro.ultimaEn
      });
    });

    return lista.sort(
      (a, b) =>
        Number(b.jugado) - Number(a.jugado) ||
        b.porcentaje - a.porcentaje ||
        a.titulo.localeCompare(b.titulo)
    );
  }

  clasesTema(color: ColorTema): string {
    return TEMA_CAJA[color] ?? TEMA_CAJA.blue;
  }

  claseBarra(color: ColorTema): string {
    return TEMA_BARRA[color] ?? TEMA_BARRA.blue;
  }

  claseBoton(color: ColorTema): string {
    return TEMA_BOTON[color] ?? TEMA_BOTON.blue;
  }

  formatoFecha(fecha: Date | null): string {
    if (!fecha) {
      return '';
    }
    return fecha.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  formatoTiempo(segundos: number): string {
    if (!segundos || segundos <= 0) {
      return '—';
    }
    const horas = Math.floor(segundos / 3600);
    const minutos = Math.floor((segundos % 3600) / 60);
    if (horas > 0) {
      return `${horas} h ${minutos} min`;
    }
    if (minutos > 0) {
      return `${minutos} min`;
    }
    return `${segundos} s`;
  }

  private prettify(slug: string): string {
    return slug.replace(/-/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
  }
}
