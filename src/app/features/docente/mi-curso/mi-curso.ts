import { Component, OnInit, computed, inject, signal } from '@angular/core';

import { AuthService } from '@core/auth/auth.service';
import {
  Paralelo,
  UsuarioAdmin,
  nombreCurso
} from '@core/models/usuario.model';
import {
  EstadisticasService,
  EstadisticasUsuario,
  crearEstadisticasVacias
} from '@core/services/estadisticas.service';
import { UsuarioService } from '@core/services/usuario.service';
import { ActividadesService } from '@features/actividades/services/actividades.service';

interface EstudianteConEstadisticas extends UsuarioAdmin {
  stats: EstadisticasUsuario;
}

/**
 * Panel del docente: muestra únicamente los estudiantes del curso que el
 * administrador le asignó, con su puntaje y el desglose de su avance.
 *
 * El filtro real lo hacen las reglas de Firestore: el docente solo puede leer
 * los perfiles e intentos de los estudiantes de su mismo curso y paralelo.
 */
@Component({
  selector: 'app-mi-curso',
  standalone: true,
  templateUrl: './mi-curso.html'
})
export class MiCursoDocente implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly usuariosService = inject(UsuarioService);
  private readonly estadisticas = inject(EstadisticasService);
  private readonly actividades = inject(ActividadesService);

  readonly cargando = signal(true);
  readonly error = signal('');
  readonly curso = signal<number | undefined>(undefined);
  readonly paralelo = signal<Paralelo | undefined>(undefined);
  readonly estudiantes = signal<EstudianteConEstadisticas[]>([]);
  readonly titulos = signal<Map<string, string>>(new Map());
  readonly abiertos = signal<ReadonlySet<string>>(new Set<string>());
  readonly busqueda = signal('');

  readonly cursoTexto = computed(() => nombreCurso(this.curso(), this.paralelo()));

  readonly filtrados = computed<EstudianteConEstadisticas[]>(() => {
    const texto = this.busqueda().trim().toLowerCase();
    if (!texto) {
      return this.estudiantes();
    }
    return this.estudiantes().filter((u) =>
      `${u.nombreCompleto} ${u.email}`.toLowerCase().includes(texto)
    );
  });

  /** Totales del curso completo (no cambian al buscar). */
  readonly resumen = computed(() => {
    const lista = this.estudiantes();
    const total = lista.length;
    return {
      total,
      puntos: lista.reduce((suma, u) => suma + u.stats.puntos, 0),
      intentos: lista.reduce((suma, u) => suma + u.stats.intentosFinalizados, 0),
      aciertos: total
        ? Math.round(lista.reduce((suma, u) => suma + u.stats.porcentajeAcierto, 0) / total)
        : 0
    };
  });

  async ngOnInit(): Promise<void> {
    await this.cargar();
  }

  async cargar(): Promise<void> {
    this.cargando.set(true);
    this.error.set('');

    try {
      const uid = this.auth.user()?.uid;
      if (!uid) {
        this.error.set('Inicia sesión para ver tu curso.');
        return;
      }

      const perfil = await this.usuariosService.obtenerPerfil(uid);
      if (!perfil) {
        this.error.set('No se encontró tu perfil. Vuelve a iniciar sesión.');
        return;
      }

      this.curso.set(perfil.curso);
      this.paralelo.set(perfil.paralelo);

      if (!perfil.curso || !perfil.paralelo) {
        this.estudiantes.set([]);
        return;
      }

      const lista = await this.usuariosService.listarEstudiantesDeCurso(
        perfil.curso,
        perfil.paralelo
      );

      // Los títulos de las actividades son accesorios: si fallan, se usa el slug.
      const titulos = await this.actividades
        .titulosPorSlug()
        .catch(() => new Map<string, string>());

      const estadisticas = await Promise.all(
        lista.map(async (estudiante) => {
          try {
            return [estudiante.uid, await this.estadisticas.resumenDeUsuario(estudiante.uid)] as const;
          } catch {
            return [estudiante.uid, crearEstadisticasVacias()] as const;
          }
        })
      );
      const porUid = new Map(estadisticas);

      this.titulos.set(titulos);
      this.estudiantes.set(
        lista.map((estudiante) => {
          const stats = porUid.get(estudiante.uid) ?? crearEstadisticasVacias();
          if (estudiante.puntos !== undefined && estudiante.puntos > 0) {
            stats.puntos = Math.max(stats.puntos, estudiante.puntos);
            if (estudiante.nivel) stats.nivel = Math.max(stats.nivel, estudiante.nivel);
            if (estudiante.tituloNivel) stats.tituloNivel = estudiante.tituloNivel;
          }
          return { ...estudiante, stats };
        })
      );
    } catch {
      this.error.set('No se pudieron cargar los estudiantes de tu curso.');
    } finally {
      this.cargando.set(false);
    }
  }

  alternarDetalle(uid: string): void {
    this.abiertos.update((actuales) => {
      const copia = new Set(actuales);
      if (copia.has(uid)) {
        copia.delete(uid);
      } else {
        copia.add(uid);
      }
      return copia;
    });
  }

  estaAbierto(uid: string): boolean {
    return this.abiertos().has(uid);
  }

  /** Título legible de la actividad a partir del slug guardado en el intento. */
  tituloDe(slug: string): string {
    if (!slug) {
      return '—';
    }
    const titulo = this.titulos().get(slug);
    if (titulo) {
      return titulo;
    }
    return slug.replace(/-/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
  }

  formatoFecha(fecha: Date | null): string {
    if (!fecha) {
      return 'Sin actividad registrada';
    }
    return fecha.toLocaleString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
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
}
