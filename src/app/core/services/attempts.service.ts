import { Injectable, inject } from '@angular/core';
import { addDoc, collection, doc, serverTimestamp, updateDoc } from 'firebase/firestore';

import { auth, db, NOMBRES_COLECCION } from '../firebase';
import { UserProgressService } from './user-progress.service';

export interface ResultadoIntento {
  actividadId: string;
  puntaje: number;
  nivel: number;
  respuestasCorrectas?: number;
  respuestasIncorrectas?: number;
}

@Injectable({ providedIn: 'root' })
export class AttemptsService {
  private readonly progress = inject(UserProgressService);

  async iniciar(actividadId: string): Promise<{ id: string; inicio: number } | null> {
    const user = auth.currentUser;
    if (!user) {
      return null;
    }

    const intento = await addDoc(collection(db, NOMBRES_COLECCION.intentos), {
      estudianteUid: user.uid,
      actividadId,
      estado: 'en_progreso',
      horaIngreso: serverTimestamp()
    });

    return { id: intento.id, inicio: Date.now() };
  }

  async finalizar(
    intentoId: string,
    inicio: number,
    resultado: ResultadoIntento
  ): Promise<void> {
    await updateDoc(doc(db, NOMBRES_COLECCION.intentos, intentoId), {
      ...resultado,
      estado: 'finalizado',
      horaFinalizacion: serverTimestamp(),
      duracionSegundos: Math.max(0, Math.floor((Date.now() - inicio) / 1000))
    });

    // Actualiza puntos y nivel visibles en la topbar
    await this.progress.registrarPuntosDelIntento(resultado.puntaje);
  }
}
