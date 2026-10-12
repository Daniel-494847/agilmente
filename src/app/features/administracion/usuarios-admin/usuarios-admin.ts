import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { onAuthStateChanged } from 'firebase/auth';

import { auth } from '@core/firebase';
import { UserRoleService } from '@core/auth/user-role.service';
import { RolUsuario, UsuarioAdmin } from '@core/models/usuario.model';
import { ActividadesService } from '@features/actividades/services/actividades.service';
import {
  EstadisticasService,
  EstadisticasUsuario,
  crearEstadisticasVacias
} from '@core/services/estadisticas.service';

interface UsuarioConEstadisticas extends UsuarioAdmin {
  stats: EstadisticasUsuario;
}

/**
 * Gestión de usuarios (solo administrador).
 * Muestra el avance de cada usuario (puntos, nivel, intentos, aciertos y tiempo)
 * y permite cambiar su rol. El permiso real lo ponen las reglas de Firestore.
 */
@Component({
  selector: 'app-usuarios-admin',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './usuarios-admin.html'
})
export class UsuariosAdmin implements OnInit {
  private readonly roles = inject(UserRoleService);
  private readonly actividades = inject(ActividadesService);
  private readonly estadisticas = inject(EstadisticasService);

  readonly usuarios = signal<UsuarioConEstadisticas[]>([]);
  readonly titulos = signal<Map<string, string>>(new Map());
  readonly cargando = signal(true);
  readonly mensaje = signal('');
  readonly error = signal('');
  readonly avisoEstadisticas = signal('');
  readonly busqueda = signal('');
  readonly abiertos = signal<ReadonlySet<string>>(new Set<string>());
  /** UID del administrador que ve la página (no puede cambiarse el propio rol). */
  readonly miUid = signal<string | null>(null);
  readonly rolesOpciones: readonly RolUsuario[] = ['estudiante', 'docente', 'administrador'];

  /** Usuarios filtrados por la búsqueda de nombre/correo. */
  readonly filtrados = computed<UsuarioConEstadisticas[]>(() => {
    const texto = this.busqueda().trim().toLowerCase();
    const lista = this.usuarios();
    if (!texto) {
      return lista;
    }
    return lista.filter((u) => `${u.nombreCompleto} ${u.email}`.toLowerCase().includes(texto));
  });

  /** Totales de todos los usuarios (cabecera de la página). */
  readonly resumen = computed(() => {
    const lista = this.usuarios();
    return {
      total: lista.length,
      estudiantes: lista.filter((u) => u.rol === 'estudiante').length,
      intentos: lista.reduce((suma, u) => suma + u.stats.intentosFinalizados, 0),
      puntos: lista.reduce((suma, u) => suma + u.stats.puntos, 0)
    };
  });

  async ngOnInit(): Promise<void> {
    onAuthStateChanged(auth, (user) => this.miUid.set(user?.uid ?? null));
    await this.cargar();
  }

  async cargar(): Promise<void> {
    this.cargando.set(true);
    this.error.set('');
    this.avisoEstadisticas.set('');
    try {
      const lista = await this.roles.listarUsuarios();

      // Las estadísticas y los títulos son accesorios: si fallan, se muestran
      // los usuarios igualmente con valores en cero.
      const [resTitulos, resEstadisticas] = await Promise.allSettled([
        this.actividades.titulosPorSlug(),
        this.estadisticas.resumenPorUsuario()
      ]);

      const titulos =
        resTitulos.status === 'fulfilled' ? resTitulos.value : new Map<string, string>();
      let stats = new Map<string, EstadisticasUsuario>();
      if (resEstadisticas.status === 'fulfilled') {
        stats = resEstadisticas.value;
      } else {
        this.avisoEstadisticas.set(
          'No se pudieron cargar las estadísticas de avance. Verifica tu rol de administrador.'
        );
      }

      this.titulos.set(titulos);
      this.usuarios.set(
        lista.map((u) => ({ ...u, stats: stats.get(u.uid) ?? crearEstadisticasVacias() }))
      );
    } catch {
      this.error.set('No se pudieron cargar los usuarios.');
    } finally {
      this.cargando.set(false);
    }
  }

  async cambiarRol(usuario: UsuarioConEstadisticas, nuevo: RolUsuario): Promise<void> {
    if (nuevo === usuario.rol || usuario.uid === this.miUid()) {
      return;
    }
    try {
      await this.roles.cambiarRol(usuario.uid, nuevo);
      this.usuarios.update((lista) =>
        lista.map((u) => (u.uid === usuario.uid ? { ...u, rol: nuevo } : u))
      );
      this.mensaje.set(`Rol de ${usuario.nombreCompleto || usuario.email} actualizado a «${nuevo}».`);
      this.error.set('');
    } catch {
      this.error.set('No se pudo cambiar el rol (¿eres administrador?).');
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
