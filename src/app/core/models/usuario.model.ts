import { FieldValue, Timestamp } from 'firebase/firestore';

export type RolUsuario = 'administrador' | 'docente' | 'estudiante';

/** Cursos disponibles para el registro de estudiantes. */
export const CURSOS = [
  { valor: 1, etiqueta: 'Primero' },
  { valor: 2, etiqueta: 'Segundo' },
  { valor: 3, etiqueta: 'Tercero' },
  { valor: 4, etiqueta: 'Cuarto' },
  { valor: 5, etiqueta: 'Quinto' },
  { valor: 6, etiqueta: 'Sexto' }
] as const;

export type Paralelo = 'A' | 'B';

export const PARALELOS: readonly Paralelo[] = ['A', 'B'];

/** Dominio de los correos internos de las cuentas creadas por el administrador. */
export const DOMINIO_ESTUDIANTES = 'estudiantes.agilmente.app';

/** Devuelve un curso válido (1–6) o `undefined`. */
export function normalizarCurso(valor: unknown): number | undefined {
  const curso = Number(valor);
  return Number.isInteger(curso) && curso >= 1 && curso <= 6 ? curso : undefined;
}

/** Devuelve un paralelo válido (A/B) o `undefined`. */
export function normalizarParalelo(valor: unknown): Paralelo | undefined {
  const paralelo = String(valor ?? '').trim().toUpperCase();
  return paralelo === 'A' || paralelo === 'B' ? paralelo : undefined;
}

/** Texto legible del curso, por ejemplo «Primero A». */
export function nombreCurso(curso?: number, paralelo?: Paralelo): string {
  const encontrado = CURSOS.find((c) => c.valor === curso);
  return encontrado && paralelo ? `${encontrado.etiqueta} ${paralelo}` : '';
}

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
  /** Curso del estudiante: 1 (Primero) a 6 (Sexto). */
  curso?: number;
  /** Paralelo del curso: A o B. */
  paralelo?: Paralelo;
  rol: RolUsuario;
  puntos: number;
  nivel: number;
  tituloNivel: string;
  ultimoIngreso: Timestamp | FieldValue;
  creadoEn?: Timestamp | FieldValue;
  avatarUrl?: string;
  /** El administrador restableció la contraseña y el usuario debe cambiarla. */
  debeCambiarPassword?: boolean;
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
  curso?: number;
  paralelo?: Paralelo;
  debeCambiarPassword?: boolean;
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
  const curso = normalizarCurso(base.curso);
  const paralelo = normalizarParalelo(base.paralelo);
  if (curso !== undefined) doc.curso = curso;
  if (paralelo !== undefined) doc.paralelo = paralelo;
  if (base.avatarUrl) doc.avatarUrl = base.avatarUrl;
  if (base.debeCambiarPassword === true) doc.debeCambiarPassword = true;
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
  curso?: number;
  paralelo?: Paralelo;
  rol: RolUsuario;
  avatarUrl?: string;
  puntos?: number;
  nivel?: number;
  tituloNivel?: string;
  /** `true` si debe cambiar la contraseña al entrar. */
  debeCambiarPassword?: boolean;
}

/**
 * Convierte un documento de la colección `usuarios` al modelo que usan las
 * pantallas de gestión y el panel del docente.
 */
export function usuarioAdminDesdeDoc(
  uid: string,
  data: Record<string, unknown>
): UsuarioAdmin {
  return {
    uid,
    nombreCompleto: String(data['nombreCompleto'] ?? ''),
    email: String(data['email'] ?? ''),
    curso: normalizarCurso(data['curso']),
    paralelo: normalizarParalelo(data['paralelo']),
    rol: normalizarRol(data['rol']),
    avatarUrl: String(data['avatarUrl'] ?? '') || undefined,
    puntos: Math.max(0, Math.floor(Number(data['puntos']) || 0)),
    nivel: Number(data['nivel']) || 1,
    tituloNivel: String(data['tituloNivel'] ?? 'Explorador'),
    debeCambiarPassword: data['debeCambiarPassword'] === true
  };
}

/**
 * Administrador único de la aplicación. El rol «administrador» no se ofrece
 * a otros usuarios: Daniel Llanos Pallares es el único administrador.
 */
export const ADMINISTRADOR_UNICO = 'Daniel Llanos Pallares';

/** Correo del único administrador. */
export const ADMIN_EMAIL = 'pcdoctorbermejo@gmail.com';

/** `true` si el correo pertenece al administrador único (sin distinguir mayúsculas). */
export function esEmailAdministrador(email?: string | null): boolean {
  return String(email ?? '').trim().toLowerCase() === ADMIN_EMAIL;
}
