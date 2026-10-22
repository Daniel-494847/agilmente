import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFunctions } from 'firebase/functions';
import { collection, doc, getFirestore } from 'firebase/firestore';

import { environment } from '../../environments/environment';

const app = initializeApp(environment.firebase);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app);

/** Nombres de colección tipados (una sola fuente de verdad). */
export const NOMBRES_COLECCION = {
  usuarios: 'usuarios',
  actividades: 'actividades',
  biblioteca: 'biblioteca',
  comunicados: 'comunicados',
  fotosGaleria: 'fotosGaleria',
  contenidoSecciones: 'contenidoSecciones',
  intentos: 'intentos',
  unidadEducativa: 'unidad-educativa',
  contactos: 'contactos',
  asignaciones: 'asignaciones'
} as const;

export type NombreColeccion = (typeof NOMBRES_COLECCION)[keyof typeof NOMBRES_COLECCION];

/** Colecciones de uso frecuente. El resto se pide por nombre a `ContentService`. */
export const colecciones = {
  usuarios: collection(db, NOMBRES_COLECCION.usuarios),
  biblioteca: collection(db, NOMBRES_COLECCION.biblioteca)
} as const;

export const referencias = {
  unidadEducativaPrincipal: doc(db, NOMBRES_COLECCION.unidadEducativa, 'principal')
} as const;
