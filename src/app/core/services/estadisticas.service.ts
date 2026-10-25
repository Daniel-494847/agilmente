import { Injectable, inject } from '@angular/core';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  where,
  type QueryConstraint
} from 'firebase/firestore';

import { db, NOMBRES_COLECCION } from '@core/firebase';
import { ResumenProgreso, fechaDesdeFirestore, resumenDesdeDoc } from '@core/models/usuario.model';
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
   * Agrega los intentos finalizados de los usuarios por `estudianteUid`.
   * Aplica un límite de consultas (por defecto 50) para proteger el rendimiento
   * y la cuota de lecturas en Firestore.
   */
  async resumenPorUsuario(limite = 50): Promise<Map<string, EstadisticasUsuario>> {
    const restricciones: QueryConstraint[] = [where('estado', '==', 'finalizado')];
    if (limite && limite > 0) {
      restricciones.push(limit(limite));
    }

    const snapshot = await getDocs(
      query(collection(db, NOMBRES_COLECCION.intentos), ...restricciones)
    );

    const acumulado = new Map<string, Acumulado>();
    snapshot.forEach((docSnap) => this.acumular(acumulado, docSnap.data()));

    const resultado = new Map<string, EstadisticasUsuario>();
    acumulado.forEach((acum, uid) => resultado.set(uid, this.aEstadisticas(acum)));
    return resultado;
  }

  /**
   * Estadísticas del propio usuario. Primero usa el `resumen` que mantiene el
   * trigger en el perfil (1 lectura); si aún no existe, recorre sus intentos.
   */
  async resumenDeUsuario(uid: string): Promise<EstadisticasUsuario> {
    if (!uid) {
      return crearEstadisticasVacias();
    }

    try {
      const perfil = await getDoc(doc(db, NOMBRES_COLECCION.usuarios, uid));
      if (perfil.exists()) {
        const datos = perfil.data();
        const resumen = resumenDesdeDoc(datos['resumen']);
        if (resumen) {
          return this.desdeResumen(resumen);
        }
      }
    } catch {
      // Sin permiso o sin conexión: se usa el historial de intentos.
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

  /**
   * Convierte el `resumen` del perfil en las estadísticas de la vista sin
   * consultar `intentos`. `puntos` es el total del perfil (si no se pasa, se
   * suma el de las actividades).
   */
  desdeResumen(resumen: ResumenProgreso | null | undefined, puntos?: number): EstadisticasUsuario {
    if (!resumen) {
      return crearEstadisticasVacias();
    }

    const total =
      puntos ?? resumen.porActividad.reduce((suma, actividad) => suma + actividad.puntos, 0);
    const progreso = this.progreso.calcularDesdePuntos(total);

    return {
      puntos: progreso.puntos,
      nivel: progreso.nivel,
      tituloNivel: progreso.tituloNivel,
      intentosFinalizados: resumen.intentosFinalizados,
      actividadesDistintas: resumen.porActividad.length,
      respuestasCorrectas: resumen.respuestasCorrectas,
      respuestasIncorrectas: resumen.respuestasIncorrectas,
      porcentajeAcierto: porcentaje(resumen.respuestasCorrectas, resumen.respuestasIncorrectas),
      tiempoTotalSegundos: resumen.tiempoTotalSegundos,
      ultimaActividadEn: resumen.ultimaActividadEn,
      actividadMasReciente: resumen.actividadMasReciente,
      porActividad: [...resumen.porActividad]
        .sort((a, b) => b.puntos - a.puntos)
        .map((actividad) => ({
          ...actividad,
          porcentajeAcierto: porcentaje(
            actividad.respuestasCorrectas,
            actividad.respuestasIncorrectas
          )
        }))
    };
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
    const fecha = fechaDesdeFirestore(data['horaFinalizacion']);

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
