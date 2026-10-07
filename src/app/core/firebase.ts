import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { collection, doc, getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: 'AIzaSyCxTzJALEOQfTwj7mxDF1QJJuQYHZtiIVA',
  authDomain: 'agilmente-123.firebaseapp.com',
  projectId: 'agilmente-123',
  storageBucket: 'agilmente-123.firebasestorage.app',
  messagingSenderId: '564872320995',
  appId: '1:564872320995:web:98efb20c86da9509ad72d6',
  measurementId: 'G-66K91Y93W4'
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

/** Nombres de colección tipados (una sola fuente de verdad). */
export const NOMBRES_COLECCION = {
  usuarios: 'usuarios',
  actividades: 'actividades',
  biblioteca: 'biblioteca',
  comunicados: 'comunicados',
  fotosGaleria: 'fotosGaleria',
  contenidoSecciones: 'contenidoSecciones',
  intentos: 'intentos',
  unidadEducativa: 'unidad-educativa'
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
