import { Injectable, signal } from '@angular/core';
import {
  collection,
  doc,
  getAggregateFromServer,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  sum,
  where
} from 'firebase/firestore';

import { auth, db, NOMBRES_COLECCION } from '@core/firebase';
import { calcularNivelYTitulo, resumenDesdeDoc } from '@core/models/usuario.model';

export interface ProgresoUsuario {
  puntos: number;
  nivel: number;
  tituloNivel: string;
}

@Injectable({ providedIn: 'root' })
export class UserProgressService {
  /** Estado reactivo para la topbar y otras vistas. */
  readonly progreso = signal<ProgresoUsuario>({
    puntos: 0,
    nivel: 1,
    tituloNivel: 'Explorador'
  });

  /** `onSnapshot` activo sobre el documento del usuario. */
  private detenerSuscripcion: (() => void) | null = null;

  /**
   * Carga los puntos sumando los intentos finalizados del usuario. Así el
   * progreso depende de las partidas guardadas y no de un campo que el
   * estudiante pudiera editar. Si la suma no está disponible (por ejemplo,
   * una regla o un índice), se usa `puntos` del documento como respaldo.
   */
  async refrescar(): Promise<ProgresoUsuario> {
    const user = auth.currentUser;
    if (!user) {
      const vacio: ProgresoUsuario = { puntos: 0, nivel: 1, tituloNivel: 'Explorador' };
      this.progreso.set(vacio);
      return vacio;
    }

    try {
      const puntos = await this.puntosDeIntentos(user.uid);
      const calculado = this.calcularDesdePuntos(puntos);
      this.progreso.set(calculado);
      return calculado;
    } catch (error) {
      console.error('No se pudo sumar el progreso de los intentos:', error);
    }

    try {
      const snap = await getDoc(doc(db, NOMBRES_COLECCION.usuarios, user.uid));
      if (snap.exists()) {
        const d = snap.data();
        const puntos = Math.max(0, Math.floor(Number(d['puntos']) || 0));
        const calculado = this.calcularDesdePuntos(puntos);
        this.progreso.set(calculado);
        return calculado;
      }

      const inicial = this.calcularDesdePuntos(0);
      this.progreso.set(inicial);
      return inicial;
    } catch (error) {
      console.error('No se pudo cargar el progreso:', error);
      return this.progreso();
    }
  }

  /**
   * Escucha el documento del usuario: cuando el trigger termina de sumar los
   * puntos de una partida, el cambio llega solo (sin reconsultar el historial).
   */
  seguir(): void {
    const user = auth.currentUser;
    if (!user) {
      return;
    }
    this.detener();
    this.detenerSuscripcion = onSnapshot(
      doc(db, NOMBRES_COLECCION.usuarios, user.uid),
      (snap) => {
        if (!snap.exists()) {
          return;
        }
        const datos = snap.data();
        const resumen = resumenDesdeDoc(datos['resumen']);
        // El desglose manda para que el total coincida con las tarjetas; si el
        // resumen aún no tiene actividades, se usa el acumulado del perfil.
        const puntos = resumen?.porActividad.length
          ? resumen.porActividad.reduce((suma, actividad) => suma + actividad.puntos, 0)
          : Math.max(0, Math.floor(Number(datos['puntos']) || 0));
        this.progreso.set(this.calcularDesdePuntos(puntos));
      },
      (error) => console.error('No se pudo seguir el progreso del usuario:', error)
    );
  }

  /** Cancela la escucha del perfil (al cerrar sesión o cambiar de usuario). */
  detener(): void {
    this.detenerSuscripcion?.();
    this.detenerSuscripcion = null;
  }

  /** Fija el progreso con los puntos que ya vienen en el perfil (sin lecturas). */
  establecerDesdePuntos(puntos: number): void {
    this.progreso.set(this.calcularDesdePuntos(puntos));
  }

  /**
   * Tras finalizar un intento se recalcula el progreso desde los intentos.
   * El listener del perfil ya recibe el cambio del trigger; este único
   * reintento cubre el caso de que el trigger tarde o no esté desplegado.
   */
  refrescarTrasIntento(): void {
    setTimeout(() => void this.refrescar(), 2500);
  }

  /**
   * Suma `puntaje` de los intentos finalizados. Primero con una agregación
   * (barata); si el índice no está disponible, lee los documentos.
   */
  private async puntosDeIntentos(uid: string): Promise<number> {
    const intentos = query(
      collection(db, NOMBRES_COLECCION.intentos),
      where('estudianteUid', '==', uid),
      where('estado', '==', 'finalizado')
    );

    try {
      const total = await getAggregateFromServer(intentos, { puntos: sum('puntaje') });
      return Math.max(0, Math.floor(Number(total.data()['puntos']) || 0));
    } catch (error) {
      console.error('No se pudo agregar el progreso; se leen los intentos:', error);
    }

    const snapshot = await getDocs(intentos);
    let puntos = 0;
    snapshot.forEach((intento) => {
      const valor = Number(intento.data()['puntaje'] ?? 0);
      if (Number.isFinite(valor) && valor > 0) {
        puntos += Math.floor(valor);
      }
    });
    return puntos;
  }

  calcularDesdePuntos(puntos: number): ProgresoUsuario {
    const puntosSeguros = Math.max(0, Math.floor(puntos));
    const { nivel, tituloNivel } = calcularNivelYTitulo(puntosSeguros);
    return { puntos: puntosSeguros, nivel, tituloNivel };
  }

  reset(): void {
    this.detener();
    this.progreso.set({ puntos: 0, nivel: 1, tituloNivel: 'Explorador' });
  }
}
