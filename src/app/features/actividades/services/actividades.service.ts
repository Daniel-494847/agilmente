import { Injectable } from '@angular/core';
import { collection, deleteDoc, doc, getDocs, limit, query, setDoc, where } from 'firebase/firestore';

import { db, NOMBRES_COLECCION } from '@core/firebase';
import { ActividadResumen } from '@core/models/actividad.model';
import { ACTIVIDADES_INICIALES, compararActividades, fusionarActividades } from '@features/actividades/data/actividades.data';

/** Actividad con el slug con el que guarda sus intentos (lo que llega en `intentos.actividadId`). */
export interface ActividadJugable extends ActividadResumen {
  slug: string;
}

@Injectable({ providedIn: 'root' })
export class ActividadesService {
  private readonly collectionName = NOMBRES_COLECCION.actividades;

  /** Caché en memoria con TTL para evitar lecturas repetidas a Firestore. */
  private readonly TTL_MS = 5 * 60 * 1000;
  private cache: { data: ActividadResumen[]; ts: number } | null = null;
  /** Lectura en curso: dos pantallas no disparan dos consultas. */
  private enVuelo: Promise<ActividadResumen[]> | null = null;

  /**
   * Catálogo de actividades: el catálogo del código (`ACTIVIDADES_INICIALES`)
   * personalizado con lo que hay guardado en Firestore.
   *
   * La fusión la hace `fusionarActividades`, que usa la **ruta** como clave
   * (y no el número), de modo que una ficha de Firestore no puede tapar a
   * otra actividad por llevar un id repetido.
   */
  async listar(): Promise<ActividadResumen[]> {
    if (this.cache && Date.now() - this.cache.ts < this.TTL_MS) {
      return this.cache.data;
    }
    if (this.enVuelo) {
      return this.enVuelo;
    }

    this.enVuelo = this.cargarCatalogo().finally(() => {
      this.enVuelo = null;
    });
    return this.enVuelo;
  }

  private async cargarCatalogo(): Promise<ActividadResumen[]> {
    try {
      const snapshot = await getDocs(collection(db, this.collectionName));
      const resultado = fusionarActividades(snapshot.docs.map((item) => item.data() as ActividadResumen));
      this.cache = { data: resultado, ts: Date.now() };
      return resultado;
    } catch (error) {
      console.error('No se pudieron cargar las actividades:', error);
      const fallback = [...ACTIVIDADES_INICIALES].sort(compararActividades);
      this.cache = { data: fallback, ts: Date.now() };
      return fallback;
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
    await this.limpiarDuplicados(actividad.ruta, String(actividad.id));
    this.cache = null;
  }

  /**
   * Borra las fichas que apuntan a la misma ruta con otro id. Así una ficha
   * vieja (p. ej. `actividades/5` guardada como «Operadores Matemáticos»)
   * deja de aparecer duplicada cuando se guarda la actividad correcta.
   */
  private async limpiarDuplicados(ruta: string, conservarId: string): Promise<void> {
    if (!ruta) return;
    const snapshot = await getDocs(
      query(collection(db, this.collectionName), where('ruta', '==', ruta))
    );
    for (const item of snapshot.docs) {
      if (item.id === conservarId) continue;
      const data = item.data() as ActividadResumen;
      if ((data.ruta ?? '').trim() === ruta) {
        await deleteDoc(item.ref);
      }
    }
  }

  async eliminar(id: number): Promise<void> {
    await deleteDoc(doc(db, this.collectionName, String(id)));
    this.cache = null;
  }

  /** Vuelca el catálogo del código en Firestore (resuelve los ids descolocados). */
  async guardarIniciales(): Promise<void> {
    await Promise.all(ACTIVIDADES_INICIALES.map((a) => setDoc(doc(db, this.collectionName, String(a.id)), a)));
    this.cache = null;
  }

  async inicializarSiVacia(): Promise<void> {
    const snapshot = await getDocs(query(collection(db, this.collectionName), limit(1)));
    if (snapshot.empty) {
      await this.guardarIniciales();
    }
  }
}
