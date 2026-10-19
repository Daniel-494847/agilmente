import { Injectable, inject, signal } from '@angular/core';
import { doc, getDoc, increment, updateDoc } from 'firebase/firestore';

import { auth, db, NOMBRES_COLECCION } from '@core/firebase';
import { calcularNivelYTitulo } from '@core/models/usuario.model';
import { UsuarioService } from './usuario.service';

export interface ProgresoUsuario {
  puntos: number;
  nivel: number;
  tituloNivel: string;
}

@Injectable({ providedIn: 'root' })
export class UserProgressService {
  private readonly usuarios = inject(UsuarioService);

  /** Estado reactivo para la topbar y otras vistas. */
  readonly progreso = signal<ProgresoUsuario>({
    puntos: 0,
    nivel: 1,
    tituloNivel: 'Explorador'
  });

  /** Carga puntos/nivel directo del documento del usuario (1 sola lectura en Firestore). */
  async refrescar(): Promise<ProgresoUsuario> {
    const user = auth.currentUser;
    if (!user) {
      const vacio: ProgresoUsuario = { puntos: 0, nivel: 1, tituloNivel: 'Explorador' };
      this.progreso.set(vacio);
      return vacio;
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

  /** Tras finalizar un quiz: incrementa puntos atómicamente y actualiza signal + doc. */
  async registrarPuntosDelIntento(puntajeObtenido: number): Promise<ProgresoUsuario> {
    const user = auth.currentUser;
    const puntosGanados = Math.max(0, Math.floor(Number(puntajeObtenido) || 0));
    if (!user || puntosGanados <= 0) {
      return this.progreso();
    }

    try {
      const userRef = doc(db, NOMBRES_COLECCION.usuarios, user.uid);
      await updateDoc(userRef, {
        puntos: increment(puntosGanados),
        nivel: this.calcularDesdePuntos(this.progreso().puntos + puntosGanados).nivel,
        tituloNivel: this.calcularDesdePuntos(this.progreso().puntos + puntosGanados).tituloNivel
      });

      // Releer el documento para sincronizar el signal con el estado real de Firestore.
      const snap = await getDoc(userRef);
      const puntos = snap.exists()
        ? Math.max(0, Math.floor(Number(snap.data()['puntos']) || 0))
        : this.progreso().puntos + puntosGanados;
      const nuevoProgreso = this.calcularDesdePuntos(puntos);
      this.progreso.set(nuevoProgreso);
      return nuevoProgreso;
    } catch (error) {
      console.error('No se pudo actualizar progreso atómicamente:', error);
      return this.refrescar();
    }
  }

  calcularDesdePuntos(puntos: number): ProgresoUsuario {
    const puntosSeguros = Math.max(0, Math.floor(puntos));
    const { nivel, tituloNivel } = calcularNivelYTitulo(puntosSeguros);
    return { puntos: puntosSeguros, nivel, tituloNivel };
  }

  reset(): void {
    this.progreso.set({ puntos: 0, nivel: 1, tituloNivel: 'Explorador' });
  }
}
