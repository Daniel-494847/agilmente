import { Injectable, inject } from '@angular/core';
import { collection, getDocs, query, where } from 'firebase/firestore';

import { db, NOMBRES_COLECCION } from '@core/firebase';
import { UserProgressService } from './user-progress.service';

/** Avance de un usuario resumido por actividad (para el desglose y la barra de progreso). */
export interface ActividadEstadistica {
  actividadId: string;
  intentos: number;
  puntos: number;
  mejorPuntaje: number;
  respuestasCorrectas: number;
  respuestasIncorrectas: number;
  /** 0–100 según respuestas correctas sobre respondidas (todas las partidas). */
  porcentajeAcierto: number;
  /** 0–100 de la mejor partida (equivalente al porcentaje que muestra el juego). */
  mejorPorcentaje: number;
  /** Nivel más alto alcanzado (el significado depende de cada juego). */
  mejorNivel: number;
  ultimaEn: Date | null;
}

/** Estadísticas de avance de un usuario, calculadas desde la colección `intentos`. */
export interface EstadisticasUsuario {
  puntos: number;
  nivel: number;
  tituloNivel: string;
  intentosFinalizados: number;
  actividadesDistintas: number;
  respuestasCorrectas: number;
  respuestasIncorrectas: number;
  /** 0–100. 0 cuando el usuario aún no respondió preguntas. */
  porcentajeAcierto: number;
  tiempoTotalSegundos: number;
  ultimaActividadEn: Date | null;
  /** Slug de la última actividad jugada (vacío si nunca jugó). */
  actividadMasReciente: string;
  porActividad: ActividadEstadistica[];
}

export function crearEstadisticasVacias(): EstadisticasUsuario {
  return {
    puntos: 0,
    nivel: 1,
    tituloNivel: 'Explorador',
    intentosFinalizados: 0,
    actividadesDistintas: 0,
    respuestasCorrectas: 0,
    respuestasIncorrectas: 0,
    porcentajeAcierto: 0,
    tiempoTotalSegundos: 0,
    ultimaActividadEn: null,
    actividadMasReciente: '',
    porActividad: []
  };
}

interface AcumuladoActividad {
  actividadId: string;
  intentos: number;
  puntos: number;
  mejorPuntaje: number;
  correctas: number;
  incorrectas: number;
  mejorPorcentaje: number;
  mejorNivel: number;
  ultima: Date | null;
}

interface Acumulado {
  puntos: number;
  intentos: number;
  correctas: number;
  incorrectas: number;
  segundos: number;
  ultima: Date | null;
  ultimaActividadId: string;
  porActividad: Map<string, AcumuladoActividad>;
}

@Injectable({ providedIn: 'root' })
export class EstadisticasService {
  private readonly progreso = inject(UserProgressService);

  /**
   * Agrega los intentos finalizados de TODOS los usuarios por `estudianteUid`.
   * Solo funciona con permisos de administrador (regla de Firestore sobre `intentos`).
   */
  async resumenPorUsuario(): Promise<Map<string, EstadisticasUsuario>> {
    const snapshot = await getDocs(
      query(collection(db, NOMBRES_COLECCION.intentos), where('estado', '==', 'finalizado'))
    );

    const acumulado = new Map<string, Acumulado>();
    snapshot.forEach((docSnap) => this.acumular(acumulado, docSnap.data()));

    const resultado = new Map<string, EstadisticasUsuario>();
    acumulado.forEach((acum, uid) => resultado.set(uid, this.aEstadisticas(acum)));
    return resultado;
  }

  /** Estadísticas del propio usuario (usa la regla de lectura del dueño del intento). */
  async resumenDeUsuario(uid: string): Promise<EstadisticasUsuario> {
    if (!uid) {
      return crearEstadisticasVacias();
    }

    const snapshot = await getDocs(
      query(
        collection(db, NOMBRES_COLECCION.intentos),
        where('estudianteUid', '==', uid),
        where('estado', '==', 'finalizado')
      )
    );

    const acumulado = new Map<string, Acumulado>();
    snapshot.forEach((docSnap) => this.acumular(acumulado, docSnap.data()));

    const acum = acumulado.get(uid);
    return acum ? this.aEstadisticas(acum) : crearEstadisticasVacias();
  }

  private acumular(acumulado: Map<string, Acumulado>, data: Record<string, unknown>): void {
    const uid = String(data['estudianteUid'] ?? '');
    if (!uid) {
      return;
    }

    const acum = acumulado.get(uid) ?? crearAcumulado();
    const puntos = numero(data['puntaje']);
    const correctas = numero(data['respuestasCorrectas']);
    const incorrectas = numero(data['respuestasIncorrectas']);
    const segundos = numero(data['duracionSegundos']);
    const nivel = numero(data['nivel']);
    const actividadId = String(data['actividadId'] ?? '');
    const fecha = aFecha(data['horaFinalizacion']);

    acum.puntos += puntos;
    acum.intentos += 1;
    acum.correctas += correctas;
    acum.incorrectas += incorrectas;
    acum.segundos += segundos;

    if (actividadId) {
      const porActividad = acum.porActividad.get(actividadId) ?? crearAcumuladoActividad(actividadId);
      porActividad.intentos += 1;
      porActividad.puntos += puntos;
      porActividad.mejorPuntaje = Math.max(porActividad.mejorPuntaje, puntos);
      porActividad.correctas += correctas;
      porActividad.incorrectas += incorrectas;
      porActividad.mejorPorcentaje = Math.max(
        porActividad.mejorPorcentaje,
        porcentaje(correctas, incorrectas)
      );
      porActividad.mejorNivel = Math.max(porActividad.mejorNivel, nivel);
      if (fecha && (!porActividad.ultima || fecha.getTime() > porActividad.ultima.getTime())) {
        porActividad.ultima = fecha;
      }
      acum.porActividad.set(actividadId, porActividad);
    }

    if (fecha && (!acum.ultima || fecha.getTime() > acum.ultima.getTime())) {
      acum.ultima = fecha;
      acum.ultimaActividadId = actividadId;
    }

    acumulado.set(uid, acum);
  }

  private aEstadisticas(acum: Acumulado): EstadisticasUsuario {
    const progreso = this.progreso.calcularDesdePuntos(acum.puntos);
    const porActividad = [...acum.porActividad.values()]
      .map((a) => ({
        actividadId: a.actividadId,
        intentos: a.intentos,
        puntos: a.puntos,
        mejorPuntaje: a.mejorPuntaje,
        respuestasCorrectas: a.correctas,
        respuestasIncorrectas: a.incorrectas,
        porcentajeAcierto: porcentaje(a.correctas, a.incorrectas),
        mejorPorcentaje: a.mejorPorcentaje,
        mejorNivel: a.mejorNivel,
        ultimaEn: a.ultima
      }))
      .sort((a, b) => b.puntos - a.puntos);

    return {
      puntos: progreso.puntos,
      nivel: progreso.nivel,
      tituloNivel: progreso.tituloNivel,
      intentosFinalizados: acum.intentos,
      actividadesDistintas: acum.porActividad.size,
      respuestasCorrectas: acum.correctas,
      respuestasIncorrectas: acum.incorrectas,
      porcentajeAcierto: porcentaje(acum.correctas, acum.incorrectas),
      tiempoTotalSegundos: acum.segundos,
      ultimaActividadEn: acum.ultima,
      actividadMasReciente: acum.ultimaActividadId,
      porActividad
    };
  }
}

function crearAcumulado(): Acumulado {
  return {
    puntos: 0,
    intentos: 0,
    correctas: 0,
    incorrectas: 0,
    segundos: 0,
    ultima: null,
    ultimaActividadId: '',
    porActividad: new Map()
  };
}

function crearAcumuladoActividad(actividadId: string): AcumuladoActividad {
  return {
    actividadId,
    intentos: 0,
    puntos: 0,
    mejorPuntaje: 0,
    correctas: 0,
    incorrectas: 0,
    mejorPorcentaje: 0,
    mejorNivel: 0,
    ultima: null
  };
}

function porcentaje(correctas: number, incorrectas: number): number {
  const total = correctas + incorrectas;
  return total > 0 ? Math.round((correctas / total) * 100) : 0;
}

/** Normaliza a un número no negativo (evita NaN, null y valores corruptos). */
function numero(valor: unknown): number {
  const n = Number(valor ?? 0);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Acepta Timestamp de Firestore, Date, número o cadena ISO. */
function aFecha(valor: unknown): Date | null {
  if (!valor) {
    return null;
  }
  if (valor instanceof Date) {
    return valor;
  }
  if (typeof valor === 'object' && valor !== null && 'toDate' in valor) {
    const toDate = (valor as { toDate?: unknown }).toDate;
    if (typeof toDate === 'function') {
      return (toDate as () => Date).call(valor);
    }
  }
  if (typeof valor === 'number') {
    return new Date(valor);
  }
  if (typeof valor === 'string') {
    const fecha = new Date(valor);
    return Number.isNaN(fecha.getTime()) ? null : fecha;
  }
  return null;
}
