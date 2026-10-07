import { Injectable, signal } from '@angular/core';
import { collection, doc, getDocs, query, updateDoc, where } from 'firebase/firestore';

import { auth, db, NOMBRES_COLECCION } from '../firebase';

export interface ProgresoUsuario {
  puntos: number;
  nivel: number;
  tituloNivel: string;
}

/** Puntos necesarios por nivel (nivel N requiere (N-1)*100 puntos acumulados). */
const PUNTOS_POR_NIVEL = 100;

const TITULOS: { minNivel: number; titulo: string }[] = [
  { minNivel: 1, titulo: 'Explorador' },
  { minNivel: 3, titulo: 'Aprendiz' },
  { minNivel: 5, titulo: 'Pensador' },
  { minNivel: 8, titulo: 'Estratega' },
  { minNivel: 12, titulo: 'Maestro lógico' },
  { minNivel: 20, titulo: 'Leyenda' }
];

@Injectable({ providedIn: 'root' })
export class UserProgressService {
  /** Estado reactivo para la topbar y otras vistas. */
  readonly progreso = signal<ProgresoUsuario>({
    puntos: 0,
    nivel: 1,
    tituloNivel: 'Explorador'
  });

  /** Suma puntajes de intentos finalizados y actualiza signal + doc usuario. */
  async refrescar(): Promise<ProgresoUsuario> {
    const user = auth.currentUser;
    if (!user) {
      const vacio: ProgresoUsuario = { puntos: 0, nivel: 1, tituloNivel: 'Explorador' };
      this.progreso.set(vacio);
      return vacio;
    }

    try {
      const snap = await getDocs(
        query(
          collection(db, NOMBRES_COLECCION.intentos),
          where('estudianteUid', '==', user.uid),
          where('estado', '==', 'finalizado')
        )
      );

      let puntos = 0;
      snap.forEach((d) => {
        const p = Number(d.data()['puntaje'] ?? 0);
        if (!Number.isNaN(p) && p > 0) {
          puntos += p;
        }
      });

      const calculado = this.calcularDesdePuntos(puntos);
      this.progreso.set(calculado);

      // Persistir en el perfil para lecturas rápidas y consistencia
      try {
        await updateDoc(doc(db, NOMBRES_COLECCION.usuarios, user.uid), {
          puntos: calculado.puntos,
          nivel: calculado.nivel,
          tituloNivel: calculado.tituloNivel
        });
      } catch {
        // Puede fallar si el doc no existe aún; no bloquear la UI
      }

      return calculado;
    } catch (error) {
      console.error('No se pudo cargar el progreso:', error);
      return this.progreso();
    }
  }

  /** Tras finalizar un quiz: suma puntos del intento y refresca totales. */
  async registrarPuntosDelIntento(puntajeObtenido: number): Promise<ProgresoUsuario> {
    // El intento ya se guardó en Firestore; recalcular suma real
    void puntajeObtenido;
    return this.refrescar();
  }

  calcularDesdePuntos(puntos: number): ProgresoUsuario {
    const puntosSeguros = Math.max(0, Math.floor(puntos));
    const nivel = Math.max(1, Math.floor(puntosSeguros / PUNTOS_POR_NIVEL) + 1);
    let tituloNivel = TITULOS[0].titulo;
    for (const t of TITULOS) {
      if (nivel >= t.minNivel) {
        tituloNivel = t.titulo;
      }
    }
    return { puntos: puntosSeguros, nivel, tituloNivel };
  }

  reset(): void {
    this.progreso.set({ puntos: 0, nivel: 1, tituloNivel: 'Explorador' });
  }
}
