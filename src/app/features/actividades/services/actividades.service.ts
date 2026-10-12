import { Injectable } from '@angular/core';
import { collection, deleteDoc, doc, getDocs, setDoc } from 'firebase/firestore';

import { db, NOMBRES_COLECCION } from '@core/firebase';
import { ActividadResumen } from '@core/models/actividad.model';
import { ACTIVIDADES_INICIALES, compararActividades } from '@features/actividades/data/actividades.data';

/** Actividad con el slug con el que guarda sus intentos (lo que llega en `intentos.actividadId`). */
export interface ActividadJugable extends ActividadResumen {
  slug: string;
}

@Injectable({ providedIn: 'root' })
export class ActividadesService {
  private readonly collectionName = NOMBRES_COLECCION.actividades;

  async listar(): Promise<ActividadResumen[]> {
    try {
      const snapshot = await getDocs(collection(db, this.collectionName));
      const porId = new Map(ACTIVIDADES_INICIALES.map((a) => [a.id, a]));
      const guardadas = snapshot.docs
        .map((item) => {
          const data = item.data() as ActividadResumen;
          const inicial = porId.get(data.id);
          return { ...inicial, ...data, imagen: inicial?.imagen ?? data.imagen };
        })
        .sort(compararActividades);
      const ids = new Set(guardadas.map((a) => a.id));
      const faltantes = ACTIVIDADES_INICIALES.filter((a) => !ids.has(a.id));
      return [...guardadas, ...faltantes].sort(compararActividades);
    } catch (error) {
      console.error('No se pudieron cargar las actividades:', error);
      return [...ACTIVIDADES_INICIALES].sort(compararActividades);
    }
  }

  /** Slugs de intento que no coinciden con el último segmento de la ruta del catálogo. */
  private static readonly SLUG_POR_RUTA: Record<string, string> = {
    '/razonamiento-logico/operaciones-basicas': 'operaciones-naturales'
  };

  /**
   * Juegos jugables que no tienen ficha propia en el catálogo (son hijos de
   * Matemáticas Interactivas y guardan sus intentos con el nombre del modo).
   */
  private static readonly SUBACTIVIDADES: Record<string, Omit<ActividadJugable, 'id' | 'slug'>> = {
    sumas: {
      titulo: 'Duelo de sumas',
      descripcion: 'Compite por equipos resolviendo sumas.',
      icono: 'bi-plus-lg',
      colorTema: 'green',
      ruta: '/razonamiento-logico/matematicas-interactivas/sumas'
    },
    restas: {
      titulo: 'Duelo de restas',
      descripcion: 'Compite por equipos resolviendo restas.',
      icono: 'bi-dash-lg',
      colorTema: 'green',
      ruta: '/razonamiento-logico/matematicas-interactivas/restas'
    },
    multiplicacion: {
      titulo: 'Duelo de multiplicación',
      descripcion: 'Compite por equipos resolviendo multiplicaciones.',
      icono: 'bi-x-lg',
      colorTema: 'green',
      ruta: '/razonamiento-logico/matematicas-interactivas/multiplicacion'
    },
    division: {
      titulo: 'Duelo de división',
      descripcion: 'Compite por equipos resolviendo divisiones.',
      icono: 'bi-slash-lg',
      colorTema: 'green',
      ruta: '/razonamiento-logico/matematicas-interactivas/division'
    },
    combinadas: {
      titulo: 'Duelo de operaciones combinadas',
      descripcion: 'Compite por equipos con operaciones combinadas.',
      icono: 'bi-calculator',
      colorTema: 'green',
      ruta: '/razonamiento-logico/matematicas-interactivas/combinadas'
    }
  };

  /** Catálogo jugable indexado por el slug con el que se guardan los intentos. */
  async catalogoPorSlug(): Promise<Map<string, ActividadJugable>> {
    const catalogo = new Map<string, ActividadJugable>();

    for (const actividad of await this.listar()) {
      const derivado = actividad.ruta.split('/').filter(Boolean).pop() ?? '';
      const slug = ActividadesService.SLUG_POR_RUTA[actividad.ruta] ?? derivado;
      if (slug) {
        catalogo.set(slug, { ...actividad, slug });
      }
    }

    for (const [slug, extra] of Object.entries(ActividadesService.SUBACTIVIDADES)) {
      if (!catalogo.has(slug)) {
        catalogo.set(slug, { id: 0, slug, ...extra });
      }
    }

    return catalogo;
  }

  /** Mapa slug de intento (actividadId) → título legible, para las estadísticas. */
  async titulosPorSlug(): Promise<Map<string, string>> {
    const titulos = new Map<string, string>();
    (await this.catalogoPorSlug()).forEach((actividad, slug) => titulos.set(slug, actividad.titulo));
    return titulos;
  }

  async guardar(actividad: ActividadResumen): Promise<void> {
    await setDoc(doc(db, this.collectionName, String(actividad.id)), actividad);
  }

  async eliminar(id: number): Promise<void> {
    await deleteDoc(doc(db, this.collectionName, String(id)));
  }

  async guardarIniciales(): Promise<void> {
    await Promise.all(ACTIVIDADES_INICIALES.map((a) => this.guardar(a)));
  }

  async inicializarSiVacia(): Promise<void> {
    const snapshot = await getDocs(collection(db, this.collectionName));
    if (snapshot.empty) {
      await this.guardarIniciales();
    }
  }
}
