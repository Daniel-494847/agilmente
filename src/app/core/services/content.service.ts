import { Injectable } from '@angular/core';
import { collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, where } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';

import { db, storage, NombreColeccion } from '../firebase';

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

  async eliminar(nombreColeccion: NombreColeccion, id: string): Promise<void> {
    await deleteDoc(doc(db, nombreColeccion, id));
  }

  async subirImagen(file: File): Promise<string> {
    const fileRef = ref(storage, `galeria/${Date.now()}-${file.name}`);
    await uploadBytes(fileRef, file);
    return getDownloadURL(fileRef);
  }
}
