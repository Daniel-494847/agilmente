import { Injectable, signal } from '@angular/core';
import {
  Timestamp,
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where
} from 'firebase/firestore';

import { db, NOMBRES_COLECCION } from '@core/firebase';
import { Paralelo } from '@core/models/usuario.model';

/** Actividad que un docente asignó a un curso. */
export interface AsignacionActividad {
  id: string;
  actividadId: number;
  ruta: string;
  titulo: string;
  docenteUid: string;
  curso: number;
  paralelo: Paralelo;
  creadoEn: Date | null;
}

/** Datos mínimos para asignar una actividad. */
export interface DatosAsignacion {
  actividadId: number;
  ruta: string;
  titulo: string;
  curso: number;
  paralelo: Paralelo;
}

/**
 * Asignaciones de actividades que el docente hace a su curso.
 *
 * El id del documento es determinista (`<slug-actividad>-<curso><paralelo>`),
 * así que la misma actividad solo se asigna una vez por curso: volver a pulsar
 * «Asignar» actualiza la asignación en lugar de duplicarla.
 *
 * El estudiante lee las asignaciones de su propio curso (`listarDeCurso`) para
 * recibir la notificación; eso lo permite la regla de Firestore.
 */
@Injectable({ providedIn: 'root' })
export class AsignacionesService {
  /**
   * Asignaciones del docente con la sesión abierta. Es una caché compartida:
   * todas las tarjetas de actividad leen de aquí en lugar de consultar una vez
   * por tarjeta.
   */
  readonly delDocente = signal<AsignacionActividad[]>([]);

  private docenteCargado: string | null = null;

  /** Id determinista de una asignación. */
  idDe(ruta: string, curso: number, paralelo: Paralelo): string {
    const slug = ruta.split('/').filter(Boolean).pop() ?? 'actividad';
    return `${slug}-${curso}${paralelo}`;
  }

  /** Asigna la actividad al curso del docente y actualiza la caché local. */
  async asignar(datos: DatosAsignacion, docenteUid: string): Promise<AsignacionActividad> {
    const id = this.idDe(datos.ruta, datos.curso, datos.paralelo);

    await setDoc(doc(db, NOMBRES_COLECCION.asignaciones, id), {
      actividadId: datos.actividadId,
      ruta: datos.ruta,
      titulo: datos.titulo,
      docenteUid,
      curso: datos.curso,
      paralelo: datos.paralelo,
      creadoEn: serverTimestamp()
    });

    const asignacion: AsignacionActividad = {
      id,
      actividadId: datos.actividadId,
      ruta: datos.ruta,
      titulo: datos.titulo,
      docenteUid,
      curso: datos.curso,
      paralelo: datos.paralelo,
      creadoEn: new Date()
    };

    this.delDocente.update((lista) => [asignacion, ...lista.filter((a) => a.id !== id)]);
    return asignacion;
  }

  /** Quita una asignación (el docente solo puede quitar las suyas). */
  async quitar(id: string): Promise<void> {
    await deleteDoc(doc(db, NOMBRES_COLECCION.asignaciones, id));
    this.delDocente.update((lista) => lista.filter((a) => a.id !== id));
  }

  /** Carga las asignaciones del docente una sola vez por sesión. */
  async cargarDelDocente(docenteUid: string): Promise<void> {
    if (!docenteUid || this.docenteCargado === docenteUid) {
      return;
    }
    this.docenteCargado = docenteUid;

    try {
      this.delDocente.set(await this.listarDelDocente(docenteUid));
    } catch {
      // Se reintenta en la próxima tarjeta que se muestre.
      this.docenteCargado = null;
    }
  }

  /** `true` si el docente ya asignó esa actividad a ese curso. */
  estaAsignada(ruta: string, curso: number, paralelo: Paralelo): boolean {
    const id = this.idDe(ruta, curso, paralelo);
    return this.delDocente().some((a) => a.id === id);
  }

  /** Asignaciones de un curso; es lo que recibe el estudiante. */
  async listarDeCurso(curso: number, paralelo: Paralelo): Promise<AsignacionActividad[]> {
    const snapshot = await getDocs(
      query(
        collection(db, NOMBRES_COLECCION.asignaciones),
        where('curso', '==', curso),
        where('paralelo', '==', paralelo)
      )
    );
    return this.ordenar(snapshot.docs.map((d) => this.aAsignacion(d.id, d.data())));
  }

  /** Asignaciones hechas por un docente. */
  async listarDelDocente(docenteUid: string): Promise<AsignacionActividad[]> {
    const snapshot = await getDocs(
      query(
        collection(db, NOMBRES_COLECCION.asignaciones),
        where('docenteUid', '==', docenteUid)
      )
    );
    return this.ordenar(snapshot.docs.map((d) => this.aAsignacion(d.id, d.data())));
  }

  private ordenar(lista: AsignacionActividad[]): AsignacionActividad[] {
    return lista.sort(
      (a, b) => (b.creadoEn?.getTime() ?? 0) - (a.creadoEn?.getTime() ?? 0)
    );
  }

  private aAsignacion(id: string, data: Record<string, unknown>): AsignacionActividad {
    const paralelo = String(data['paralelo'] ?? '').trim().toUpperCase();
    return {
      id,
      actividadId: Number(data['actividadId']) || 0,
      ruta: String(data['ruta'] ?? ''),
      titulo: String(data['titulo'] ?? ''),
      docenteUid: String(data['docenteUid'] ?? ''),
      curso: Number(data['curso']) || 0,
      paralelo: paralelo === 'A' || paralelo === 'B' ? (paralelo as Paralelo) : 'A',
      creadoEn: data['creadoEn'] instanceof Timestamp ? data['creadoEn'].toDate() : null
    };
  }
}
