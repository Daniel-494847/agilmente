import { Injectable } from '@angular/core';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where
} from 'firebase/firestore';

import { db, NombreColeccion } from '@core/firebase';

@Injectable({ providedIn: 'root' })
export class ContentService {
  async obtener<T>(nombreColeccion: NombreColeccion, id: string): Promise<T | null> {
    const snapshot = await getDoc(doc(db, nombreColeccion, id));
    return snapshot.exists() ? (snapshot.data() as T) : null;
  }

  async listar<T>(nombreColeccion: NombreColeccion): Promise<T[]> {
    const snapshot = await getDocs(collection(db, nombreColeccion));
    return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as T);
  }

  async listarPublicados<T>(nombreColeccion: NombreColeccion): Promise<T[]> {
    const snapshot = await getDocs(
      query(collection(db, nombreColeccion), where('publicado', '==', true))
    );
    return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as T);
  }

  async guardar<T extends { id?: string }>(
    nombreColeccion: NombreColeccion,
    contenido: T
  ): Promise<void> {
    const contenidoRef = contenido.id
      ? doc(db, nombreColeccion, contenido.id)
      : doc(collection(db, nombreColeccion));

    await setDoc(contenidoRef, { ...contenido, id: contenidoRef.id });
  }

  async actualizar(
    nombreColeccion: NombreColeccion,
    id: string,
    datos: Partial<Record<string, unknown>>
  ): Promise<void> {
    await updateDoc(doc(db, nombreColeccion, id), datos);
  }

  async eliminar(nombreColeccion: NombreColeccion, id: string): Promise<void> {
    await deleteDoc(doc(db, nombreColeccion, id));
  }
}
