import { FieldValue, Timestamp } from 'firebase/firestore';

export type RolUsuario = 'administrador' | 'docente' | 'estudiante';

/** Puntos necesarios por nivel (nivel N requiere (N-1)*PUNTOS_POR_NIVEL puntos). */
export const PUNTOS_POR_NIVEL = 100;

const TITULOS: { minNivel: number; titulo: string }[] = [
  { minNivel: 1, titulo: 'Explorador' },
  { minNivel: 3, titulo: 'Aprendiz' },
  { minNivel: 5, titulo: 'Pensador' },
  { minNivel: 8, titulo: 'Estratega' },
  { minNivel: 12, titulo: 'Maestro lógico' },
  { minNivel: 20, titulo: 'Leyenda' }
];

/** Nivel y título que corresponden a una cantidad de puntos (ambos derivados de `puntos`). */
export function calcularNivelYTitulo(puntos: number): { nivel: number; tituloNivel: string } {
  const seguros = Math.max(0, Math.floor(Number(puntos) || 0));
  const nivel = Math.max(1, Math.floor(seguros / PUNTOS_POR_NIVEL) + 1);
  let tituloNivel = TITULOS[0].titulo;
  for (const t of TITULOS) {
    if (nivel >= t.minNivel) {
      tituloNivel = t.titulo;
    }
  }
  return { nivel, tituloNivel };
}

/** Normaliza cualquier valor guardado a un rol válido (por defecto, estudiante). */
export function normalizarRol(rol: unknown): RolUsuario {
  const r = String(rol ?? '').trim().toLowerCase();
  return r === 'administrador' || r === 'docente' ? r : 'estudiante';
}

/**
 * Esquema completo de un documento en la colección `usuarios`.
 * Todos los campos son obligatorios; `avatarUrl` y `creadoEn` son opcionales.
 */
export interface UsuarioDocumento {
  email: string;
  nombreCompleto: string;
  rol: RolUsuario;
  puntos: number;
  nivel: number;
  tituloNivel: string;
  ultimoIngreso: Timestamp | FieldValue;
  creadoEn?: Timestamp | FieldValue;
  avatarUrl?: string;
}

/** Documento de usuario sin los campos de tiempo (los añade el servicio al escribir). */
export type UsuarioSinTiempo = Omit<UsuarioDocumento, 'ultimoIngreso' | 'creadoEn'>;

/**
 * Construye el documento completo con TODOS los campos obligatorios.
 * `nivel` y `tituloNivel` se derivan siempre de `puntos` para mantener la coherencia.
 * Los timestamps (`ultimoIngreso`, `creadoEn`) los añade `UsuarioService` al escribir.
 */
export function usuarioPorDefecto(base: {
  email: string;
  nombreCompleto: string;
  rol?: RolUsuario;
  avatarUrl?: string;
  puntos?: number;
}): UsuarioSinTiempo {
  const puntos = Math.max(0, Math.floor(Number(base.puntos) || 0));
  const { nivel, tituloNivel } = calcularNivelYTitulo(puntos);
  const doc: UsuarioSinTiempo = {
    email: base.email,
    nombreCompleto: base.nombreCompleto,
    rol: base.rol ?? 'estudiante',
    puntos,
    nivel,
    tituloNivel
  };
  if (base.avatarUrl) doc.avatarUrl = base.avatarUrl;
  return doc;
}

export interface UsuarioResumen {
  nombre: string;
  rol: RolUsuario;
  puntos: number;
  nivel: number;
  tituloNivel: string;
  avatarUrl?: string;
}

/** Usuario con su rol, para la gestión de usuarios del administrador. */
export interface UsuarioAdmin {
  uid: string;
  nombreCompleto: string;
  email: string;
  rol: RolUsuario;
  avatarUrl?: string;
  puntos?: number;
  nivel?: number;
  tituloNivel?: string;
}
