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
export const DOMINIO_ESTUDIANTES = 'agilmente.com';

/**
 * Dominio anterior de los correos internos. Se conserva para que las cuentas
 * creadas antes del cambio sigan pudiendo entrar escribiendo solo su usuario.
 */
export const DOMINIO_ESTUDIANTES_LEGADO = 'estudiantes.agilmente.app';

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

/** Un curso con su paralelo (lo que se asigna a un docente). */
export interface CursoAsignado {
  curso: number;
  paralelo: Paralelo;
}

/** Clave estable de un curso, por ejemplo «1-A». */
export function claveCurso(curso?: number, paralelo?: Paralelo): string {
  return curso !== undefined && paralelo ? `${curso}-${paralelo}` : '';
}

/** Nombre corto y numeral de un curso, por ejemplo «5 A». */
export function codigoCurso(curso?: number, paralelo?: Paralelo): string {
  return curso !== undefined && paralelo ? `${curso} ${paralelo}` : '';
}

/**
 * Devuelve la lista de cursos con uno agregado o quitado. Se usa para
 * asignar y desasignar a un docente sin tocar sus demás cursos.
 */
export function conCursoAsignado(
  cursos: CursoAsignado[],
  curso: number,
  paralelo: Paralelo,
  asignar: boolean
): CursoAsignado[] {
  const clave = claveCurso(curso, paralelo);
  const resto = cursos.filter((c) => claveCurso(c.curso, c.paralelo) !== clave);
  return asignar ? [...resto, { curso, paralelo }] : resto;
}

/** Normaliza una lista de cursos: quita inválidos y duplicados. */
export function normalizarCursos(valor: unknown): CursoAsignado[] {
  if (!Array.isArray(valor)) {
    return [];
  }
  const vistos = new Set<string>();
  const cursos: CursoAsignado[] = [];
  for (const item of valor) {
    const registro = (item ?? {}) as Record<string, unknown>;
    const curso = normalizarCurso(registro['curso']);
    const paralelo = normalizarParalelo(registro['paralelo']);
    if (curso === undefined || paralelo === undefined) {
      continue;
    }
    const clave = claveCurso(curso, paralelo);
    if (vistos.has(clave)) {
      continue;
    }
    vistos.add(clave);
    cursos.push({ curso, paralelo });
  }
  return cursos;
}

/**
 * Cursos de un usuario. Los docentes pueden tener varios; si el documento
 * solo tiene `curso`/`paralelo` (formato anterior) se devuelve ese único curso.
 */
export function cursosDe(usuario: {
  curso?: number;
  paralelo?: Paralelo;
  cursos?: CursoAsignado[];
}): CursoAsignado[] {
  const lista = normalizarCursos(usuario.cursos);
  if (lista.length) {
    return lista;
  }
  const curso = normalizarCurso(usuario.curso);
  const paralelo = normalizarParalelo(usuario.paralelo);
  return curso !== undefined && paralelo !== undefined
    ? [{ curso, paralelo }]
    : [];
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

function enteroNoNegativo(valor: unknown): number {
  const n = Number(valor ?? 0);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

/** Acepta Timestamp de Firestore, Date, número o cadena ISO. */
export function fechaDesdeFirestore(valor: unknown): Date | null {
  if (!valor) {
    return null;
  }
  if (valor instanceof Date) {
    return valor;
  }
  if (typeof valor === 'object' && valor !== null && 'toDate' in valor) {
    const toDate = (valor as { toDate?: unknown }).toDate;
    if (typeof toDate === 'function') {
      return (toDate as () => Date).call(valor);
    }
  }
  if (typeof valor === 'number') {
    return new Date(valor);
  }
  if (typeof valor === 'string') {
    const fecha = new Date(valor);
    return Number.isNaN(fecha.getTime()) ? null : fecha;
  }
  return null;
}

/** Avance acumulado de una actividad, mantenido por el trigger del servidor. */
export interface ResumenActividad {
  actividadId: string;
  intentos: number;
  puntos: number;
  mejorPuntaje: number;
  respuestasCorrectas: number;
  respuestasIncorrectas: number;
  mejorPorcentaje: number;
  mejorNivel: number;
  ultimaEn: Date | null;
}

/**
 * Resumen acumulado del avance de un usuario. Lo escribe el trigger
 * `procesarIntentoFinalizado` en el campo `resumen` del documento `usuarios`.
 * Se usa para no releer todo el historial de intentos en cada pantalla.
 */
export interface ResumenProgreso {
  /** `true` cuando se calculó sobre todo el historial (backfill ejecutado). */
  completo: boolean;
  intentosFinalizados: number;
  respuestasCorrectas: number;
  respuestasIncorrectas: number;
  tiempoTotalSegundos: number;
  ultimaActividadEn: Date | null;
  actividadMasReciente: string;
  porActividad: ResumenActividad[];
}

/**
 * Normaliza el campo `resumen` de un documento de usuario. Devuelve `null` si
 * no existe o si aún no está completo (así las pantallas usan el historial).
 */
export function resumenDesdeDoc(valor: unknown): ResumenProgreso | null {
  if (!valor || typeof valor !== 'object') {
    return null;
  }
  const datos = valor as Record<string, unknown>;
  if (datos['completo'] !== true) {
    return null;
  }

  const porActividad: ResumenActividad[] = [];
  const mapa = datos['porActividad'];
  if (mapa && typeof mapa === 'object') {
    for (const [actividadId, item] of Object.entries(mapa as Record<string, unknown>)) {
      if (!item || typeof item !== 'object') {
        continue;
      }
      const actividad = item as Record<string, unknown>;
      porActividad.push({
        actividadId,
        intentos: enteroNoNegativo(actividad['intentos']),
        puntos: enteroNoNegativo(actividad['puntos']),
        mejorPuntaje: enteroNoNegativo(actividad['mejorPuntaje']),
        respuestasCorrectas: enteroNoNegativo(actividad['respuestasCorrectas']),
        respuestasIncorrectas: enteroNoNegativo(actividad['respuestasIncorrectas']),
        mejorPorcentaje: enteroNoNegativo(actividad['mejorPorcentaje']),
        mejorNivel: enteroNoNegativo(actividad['mejorNivel']),
        ultimaEn: fechaDesdeFirestore(actividad['ultimaEn'])
      });
    }
  }

  return {
    completo: true,
    intentosFinalizados: enteroNoNegativo(datos['intentosFinalizados']),
    respuestasCorrectas: enteroNoNegativo(datos['respuestasCorrectas']),
    respuestasIncorrectas: enteroNoNegativo(datos['respuestasIncorrectas']),
    tiempoTotalSegundos: enteroNoNegativo(datos['tiempoTotalSegundos']),
    ultimaActividadEn: fechaDesdeFirestore(datos['ultimaActividadEn']),
    actividadMasReciente: String(datos['actividadMasReciente'] ?? ''),
    porActividad
  };
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
  /** Cursos asignados (varios para un docente). */
  cursos?: CursoAsignado[];
  /** Claves de `cursos` (p. ej. «1-A»), para las reglas de Firestore. */
  cursosClaves?: string[];
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
  cursos?: CursoAsignado[];
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
  // Los cursos múltiples (docentes) mandan sobre el curso único.
  const cursos = normalizarCursos(base.cursos);
  const primero = cursos[0] ?? {
    curso: normalizarCurso(base.curso),
    paralelo: normalizarParalelo(base.paralelo)
  };
  const curso = primero.curso;
  const paralelo = primero.paralelo;
  if (curso !== undefined) doc.curso = curso;
  if (paralelo !== undefined) doc.paralelo = paralelo;
  if (cursos.length) {
    doc.cursos = cursos;
    doc.cursosClaves = cursos.map((c) => claveCurso(c.curso, c.paralelo));
  }
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
  /** Cursos asignados (un docente puede tener varios). */
  cursos: CursoAsignado[];
  rol: RolUsuario;
  avatarUrl?: string;
  puntos?: number;
  nivel?: number;
  tituloNivel?: string;
  /** Resumen de avance mantenido por el servidor (0 lecturas extra). */
  resumen?: ResumenProgreso | null;
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
  const curso = normalizarCurso(data['curso']);
  const paralelo = normalizarParalelo(data['paralelo']);
  return {
    uid,
    nombreCompleto: String(data['nombreCompleto'] ?? ''),
    email: String(data['email'] ?? ''),
    curso,
    paralelo,
    cursos: cursosDe({
      curso,
      paralelo,
      cursos: normalizarCursos(data['cursos'])
    }),
    rol: normalizarRol(data['rol']),
    avatarUrl: String(data['avatarUrl'] ?? '') || undefined,
    puntos: Math.max(0, Math.floor(Number(data['puntos']) || 0)),
    nivel: Number(data['nivel']) || 1,
    tituloNivel: String(data['tituloNivel'] ?? 'Explorador'),
    resumen: resumenDesdeDoc(data['resumen']),
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
