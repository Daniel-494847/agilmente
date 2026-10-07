import { Injectable } from '@angular/core';
import { collection, deleteDoc, doc, getDocs, setDoc } from 'firebase/firestore';

import { db, NOMBRES_COLECCION } from '../../../core/firebase';
import { ActividadResumen } from '../../../core/models/actividad.model';
import { ACTIVIDADES_INICIALES } from '../data/actividades.data';

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
        .sort((a, b) => a.id - b.id);
      const ids = new Set(guardadas.map((a) => a.id));
      const faltantes = ACTIVIDADES_INICIALES.filter((a) => !ids.has(a.id));
      return [...guardadas, ...faltantes].sort((a, b) => a.id - b.id);
    } catch (error) {
      console.error('No se pudieron cargar las actividades:', error);
      return [...ACTIVIDADES_INICIALES];
    }
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
