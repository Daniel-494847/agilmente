import { Injectable } from '@angular/core';
import {
  DocumentData,
  QueryDocumentSnapshot,
  Timestamp,
  addDoc,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where
} from 'firebase/firestore';

import { auth, colecciones } from '../../../core/firebase';
import { DatosMaterial, MaterialBiblioteca } from '../models/biblioteca.model';

@Injectable({ providedIn: 'root' })
export class BibliotecaService {
  private readonly coleccion = colecciones.biblioteca;

  async listarPublicados(): Promise<MaterialBiblioteca[]> {
    const snap = await getDocs(query(this.coleccion, where('publicado', '==', true)));
    return this.convertir(snap.docs);
  }

  async listarTodos(): Promise<MaterialBiblioteca[]> {
    const snap = await getDocs(query(this.coleccion, orderBy('creadoEn', 'desc')));
    return this.convertir(snap.docs);
  }

  async crear(datos: DatosMaterial): Promise<void> {
    await addDoc(this.coleccion, {
      ...datos,
      creadoPor: auth.currentUser?.uid ?? '',
      creadoEn: serverTimestamp()
    });
  }

  async actualizar(id: string, datos: Partial<DatosMaterial>): Promise<void> {
    await updateDoc(doc(this.coleccion, id), { ...datos });
  }

  async eliminar(id: string): Promise<void> {
    await deleteDoc(doc(this.coleccion, id));
  }

  private convertir(docs: QueryDocumentSnapshot<DocumentData>[]): MaterialBiblioteca[] {
    return docs
      .map((d): MaterialBiblioteca => {
        const data = d.data();
        const creado = data['creadoEn'];
        return {
          id: d.id,
          titulo: data['titulo'] ?? '',
          descripcion: data['descripcion'] ?? '',
          categoria: data['categoria'] ?? 'General',
          tipo: data['tipo'] ?? 'archivo',
          enlace: data['enlace'] ?? '',
          driveId: data['driveId'] ?? '',
          publicado: data['publicado'] === true,
          creadoEn: creado instanceof Timestamp ? creado.toMillis() : 0
        };
      })
      .sort((a, b) => b.creadoEn - a.creadoEn);
  }
}
