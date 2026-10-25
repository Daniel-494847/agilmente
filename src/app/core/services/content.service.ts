import { Injectable } from '@angular/core';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  setDoc,
  updateDoc,
  where,
  type QueryConstraint
} from 'firebase/firestore';

import { db, NombreColeccion } from '@core/firebase';

interface EntradaCache {
  data: unknown[];
  ts: number;
}

/**
 * CRUD de contenido con caché en memoria para las lecturas de listas.
 *
 * El contenido público (avisos, galería, contactos) cambia poco y se pide en
 * varias pantallas; sin caché, cada navegación volvía a leer la colección
 * completa. La caché se invalida en cada escritura del propio servicio.
 */
@Injectable({ providedIn: 'root' })
export class ContentService {
  /** Tiempo de vida de una lista cacheada. */
  private readonly TTL_MS = 3 * 60 * 1000;
  private readonly cache = new Map<string, EntradaCache>();
  /** Evita dos lecturas simultáneas de la misma consulta. */
  private readonly enVuelo = new Map<string, Promise<unknown[]>>();

  async obtener<T>(nombreColeccion: NombreColeccion, id: string): Promise<T | null> {
    const snapshot = await getDoc(doc(db, nombreColeccion, id));
    return snapshot.exists() ? (snapshot.data() as T) : null;
  }

  async listar<T>(nombreColeccion: NombreColeccion): Promise<T[]> {
    return this.leerUnaVez<T>(`todo:${nombreColeccion}`, async () => {
      const snapshot = await getDocs(collection(db, nombreColeccion));
      return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as T);
    });
  }

  /**
   * Lista solo los documentos publicados. `limite` permite pedir únicamente
   * los que se van a mostrar (por ejemplo, la vista previa del inicio).
   */
  async listarPublicados<T>(nombreColeccion: NombreColeccion, limite?: number): Promise<T[]> {
    const tope = limite && limite > 0 ? Math.floor(limite) : undefined;
    return this.leerUnaVez<T>(`pub:${nombreColeccion}:${tope ?? 'todos'}`, async () => {
      const restricciones: QueryConstraint[] = [where('publicado', '==', true)];
      if (tope) {
        restricciones.push(limit(tope));
      }
      const snapshot = await getDocs(query(collection(db, nombreColeccion), ...restricciones));
      return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as T);
    });
  }

  async guardar<T extends { id?: string }>(
    nombreColeccion: NombreColeccion,
    contenido: T
  ): Promise<void> {
    const contenidoRef = contenido.id
      ? doc(db, nombreColeccion, contenido.id)
      : doc(collection(db, nombreColeccion));

    await setDoc(contenidoRef, { ...contenido, id: contenidoRef.id });
    this.invalidar(nombreColeccion);
  }

  async actualizar(
    nombreColeccion: NombreColeccion,
    id: string,
    datos: Partial<Record<string, unknown>>
  ): Promise<void> {
    await updateDoc(doc(db, nombreColeccion, id), datos);
    this.invalidar(nombreColeccion);
  }

  async eliminar(nombreColeccion: NombreColeccion, id: string): Promise<void> {
    await deleteDoc(doc(db, nombreColeccion, id));
    this.invalidar(nombreColeccion);
  }

  /**
   * Vacía la caché. Se llama al iniciar y cerrar sesión para que una lista
   * cargada por un administrador no quede visible para la siguiente cuenta.
   */
  limpiarCache(): void {
    this.cache.clear();
  }

  /** Devuelve la lista cacheada o la carga una sola vez (aunque se pida en paralelo). */
  private leerUnaVez<T>(clave: string, cargar: () => Promise<T[]>): Promise<T[]> {
    const cacheado = this.cache.get(clave);
    if (cacheado && Date.now() - cacheado.ts < this.TTL_MS) {
      return Promise.resolve(cacheado.data as T[]);
    }

    const pendiente = this.enVuelo.get(clave);
    if (pendiente) {
      return pendiente as Promise<T[]>;
    }

    const promesa = cargar()
      .then((datos) => {
        this.cache.set(clave, { data: datos, ts: Date.now() });
        return datos;
      })
      .finally(() => this.enVuelo.delete(clave));

    this.enVuelo.set(clave, promesa);
    return promesa;
  }

  /** Borra las listas cacheadas de una colección tras escribir en ella. */
  private invalidar(nombreColeccion: NombreColeccion): void {
    for (const clave of [...this.cache.keys()]) {
      if (clave === `todo:${nombreColeccion}` || clave.startsWith(`pub:${nombreColeccion}:`)) {
        this.cache.delete(clave);
      }
    }
  }
}
