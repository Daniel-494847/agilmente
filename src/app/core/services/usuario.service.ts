import { Injectable } from '@angular/core';
import { User } from 'firebase/auth';
import {
  collection,
  deleteField,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where
} from 'firebase/firestore';

import { db, NOMBRES_COLECCION } from '@core/firebase';
import {
  CursoAsignado,
  Paralelo,
  ResumenProgreso,
  RolUsuario,
  UsuarioAdmin,
  UsuarioSinTiempo,
  calcularNivelYTitulo,
  claveCurso,
  cursosDe,
  esEmailAdministrador,
  normalizarCurso,
  normalizarCursos,
  normalizarParalelo,
  normalizarRol,
  resumenDesdeDoc,
  usuarioAdminDesdeDoc,
  usuarioPorDefecto
} from '@core/models/usuario.model';

/** Perfil leído de Firestore. `null` significa que el documento no existe. */
export interface PerfilUsuario {
  nombreCompleto: string;
  email: string;
  rol: RolUsuario;
  curso?: number;
  paralelo?: Paralelo;
  /** Cursos asignados (varios para un docente). */
  cursos: CursoAsignado[];
  avatarUrl?: string;
  /** `true` si debe cambiar la contraseña al entrar. */
  debeCambiarPassword?: boolean;
  /** Progreso del perfil (lo mantiene el trigger de intentos). */
  puntos: number;
  nivel: number;
  tituloNivel: string;
  /** Resumen agregado de intentos; `null` si aún no se ha calculado. */
  resumen: ResumenProgreso | null;
}

/**
 * Único punto de escritura de la colección `usuarios`.
 *
 * Garantiza que TODO documento tenga los campos obligatorios
 * (`email`, `nombreCompleto`, `rol`, `puntos`, `nivel`, `tituloNivel`,
 * `ultimoIngreso`), tanto al crear como al actualizar: si el documento
 * guardado está incompleto, se rellenan los que falten.
 *
 * `nivel` y `tituloNivel` se recalculan siempre a partir de `puntos`.
 */
@Injectable({ providedIn: 'root' })
export class UsuarioService {
  private ref(uid: string) {
    return doc(db, NOMBRES_COLECCION.usuarios, uid);
  }

  /**
   * Crea el documento de un usuario autenticado (o repara el existente)
   * y sella `ultimoIngreso`. Lo usa el inicio de sesión y la importación que
   * hace el administrador; no hay autorregistro público.
   */
  async crearOReparar(
    user: Pick<User, 'uid' | 'email'>,
    datos: {
      nombreCompleto?: string | null;
      rol?: RolUsuario;
      avatarUrl?: string | null;
      curso?: number;
      paralelo?: Paralelo;
      cursos?: CursoAsignado[];
    }
  ): Promise<void> {
    const actual = await this.leer(user.uid);
    const nombre =
      datos.nombreCompleto?.trim() || actual.nombreCompleto || user.email?.split('@')[0] || '';
    // El correo del administrador se toma de Auth para reparar documentos antiguos
    // con el correo mal escrito; el resto conserva el correo guardado.
    const email = esEmailAdministrador(user.email)
      ? (user.email ?? actual.email ?? '')
      : (actual.email || user.email || '');

    const base = usuarioPorDefecto({
      email,
      nombreCompleto: nombre,
      // El correo del administrador siempre conserva el rol «administrador».
      rol: esEmailAdministrador(email) ? 'administrador' : (datos.rol ?? actual.rol),
      puntos: actual.puntos,
      avatarUrl: datos.avatarUrl ?? actual.avatarUrl,
      curso: datos.curso ?? actual.curso,
      paralelo: datos.paralelo ?? actual.paralelo,
      cursos: datos.cursos ?? actual.cursos,
      debeCambiarPassword: actual.debeCambiarPassword
    });

    // En la creación se fija creadoEn; al reparar solo se conserva.
    // `merge` protege los campos que mantiene el servidor (p. ej. `resumen`),
    // que no vienen en `base`.
    await setDoc(
      this.ref(user.uid),
      {
        ...base,
        creadoEn: actual.creadoEn ?? serverTimestamp(),
        ultimoIngreso: serverTimestamp()
      },
      { merge: true }
    );
  }

  /** Actualiza `ultimoIngreso` (y el email, si cambió en Auth) al iniciar sesión. */
  async registrarIngreso(user: Pick<User, 'uid' | 'email'>): Promise<void> {
    const cambios: Record<string, unknown> = { ultimoIngreso: serverTimestamp() };
    if (user.email) {
      const actual = await this.leer(user.uid);
      if (!actual.email) cambios['email'] = user.email;
    }
    await setDoc(this.ref(user.uid), cambios, { merge: true });
  }

  /** Guarda nombre y avatar del propio usuario (rellena campos faltantes). */
  async guardarPerfil(
    uid: string,
    datos: { nombreCompleto: string; avatarUrl?: string }
  ): Promise<void> {
    const actual = await this.leer(uid);
    const base = usuarioPorDefecto({
      email: actual.email,
      nombreCompleto: datos.nombreCompleto,
      rol: actual.rol,
      puntos: actual.puntos,
      avatarUrl: datos.avatarUrl ?? actual.avatarUrl,
      curso: actual.curso,
      paralelo: actual.paralelo,
      cursos: actual.cursos
    });
    const cambios: Record<string, unknown> = { ...base, ...datos };
    if (!actual.email) cambios['ultimoIngreso'] = serverTimestamp();
    await setDoc(this.ref(uid), cambios, { merge: true });
  }

  /** Cambia el rol. Rellena campos faltantes del usuario afectado. */
  async cambiarRol(uid: string, rol: RolUsuario): Promise<void> {
    const actual = await this.leer(uid);
    // El administrador único conserva siempre su rol, aunque se llame al servicio.
    const rolFinal = esEmailAdministrador(actual.email) ? 'administrador' : rol;
    const base = usuarioPorDefecto({
      email: actual.email,
      nombreCompleto: actual.nombreCompleto,
      rol: rolFinal,
      puntos: actual.puntos,
      avatarUrl: actual.avatarUrl,
      curso: actual.curso,
      paralelo: actual.paralelo,
      cursos: actual.cursos
    });
    await updateDoc(this.ref(uid), base);
  }

  /**
   * Asigna los cursos del usuario. Es la vía del administrador para los
   * docentes con varios cursos: `cursos` es la lista completa (asignar y
   * desasignar se hace enviando la lista que queda). Con la lista vacía se
   * quita el curso.
   */
  async asignarCursos(uid: string, cursos: CursoAsignado[]): Promise<void> {
    const validos = normalizarCursos(cursos);
    if (!validos.length) {
      await this.quitarCurso(uid);
      return;
    }
    const [principal] = validos;
    if (validos.length === 1) {
      // Un solo curso: se guarda en `curso`/`paralelo` (formato de siempre).
      await updateDoc(this.ref(uid), {
        curso: principal.curso,
        paralelo: principal.paralelo,
        cursos: deleteField(),
        cursosClaves: deleteField()
      });
      return;
    }
    await updateDoc(this.ref(uid), {
      curso: principal.curso,
      paralelo: principal.paralelo,
      cursos: validos,
      cursosClaves: validos.map((c) => claveCurso(c.curso, c.paralelo))
    });
  }

  /** Asigna (o corrige) el curso y el paralelo de un usuario. Solo lo usa el administrador. */
  async asignarCurso(uid: string, curso: number, paralelo: Paralelo): Promise<void> {
    const cursoValido = normalizarCurso(curso);
    const paraleloValido = normalizarParalelo(paralelo);
    if (!cursoValido || !paraleloValido) {
      throw new Error('Curso o paralelo inválido');
    }
    await updateDoc(this.ref(uid), { curso: cursoValido, paralelo: paraleloValido });
  }

  /**
   * Quita al usuario de su curso (lo deja «Sin curso») sin borrar su cuenta.
   * Solo lo usa el administrador.
   */
  async quitarCurso(uid: string): Promise<void> {
    await updateDoc(this.ref(uid), {
      curso: deleteField(),
      paralelo: deleteField(),
      cursos: deleteField(),
      cursosClaves: deleteField()
    });
  }

  /**
   * Estudiantes matriculados en un curso. La consulta la permite la regla de
   * Firestore únicamente al administrador y al docente asignado a ese curso.
   */
  async listarEstudiantesDeCurso(
    curso: number,
    paralelo: Paralelo
  ): Promise<UsuarioAdmin[]> {
    const cursoValido = normalizarCurso(curso);
    const paraleloValido = normalizarParalelo(paralelo);
    if (!cursoValido || !paraleloValido) {
      return [];
    }

    const snapshot = await getDocs(
      query(
        collection(db, NOMBRES_COLECCION.usuarios),
        where('rol', '==', 'estudiante'),
        where('curso', '==', cursoValido),
        where('paralelo', '==', paraleloValido)
      )
    );

    return snapshot.docs
      .map((d) => usuarioAdminDesdeDoc(d.id, d.data()))
      .sort((a, b) => a.nombreCompleto.localeCompare(b.nombreCompleto));
  }

  /** Garantiza el esquema completo de un documento ya existente (auto-reparación). */
  async reparar(uid: string): Promise<void> {
    const actual = await this.leer(uid);
    const base = usuarioPorDefecto({
      email: actual.email,
      nombreCompleto: actual.nombreCompleto,
      rol: actual.rol,
      puntos: actual.puntos,
      avatarUrl: actual.avatarUrl,
      curso: actual.curso,
      paralelo: actual.paralelo,
      cursos: actual.cursos
    });
    const cambios: Record<string, unknown> = { ...base };
    if (!actual.ultimoIngreso) cambios['ultimoIngreso'] = serverTimestamp();
    await setDoc(this.ref(uid), cambios, { merge: true });
  }

  /** Lee el documento y devuelve un esquema completo con valores por defecto. */
  async leerCompleto(uid: string): Promise<{
    email: string;
    nombreCompleto: string;
    rol: RolUsuario;
    puntos: number;
    nivel: number;
    tituloNivel: string;
    curso?: number;
    paralelo?: Paralelo;
  }> {
    const actual = await this.leer(uid);
    const { nivel, tituloNivel } = calcularNivelYTitulo(actual.puntos);
    return {
      email: actual.email,
      nombreCompleto: actual.nombreCompleto,
      rol: actual.rol,
      puntos: actual.puntos,
      nivel,
      tituloNivel,
      curso: actual.curso,
      paralelo: actual.paralelo
    };
  }

  /**
   * Lee el perfil de un usuario y devuelve `null` si el documento no existe.
   * Sirve para comprobar que la cuenta fue creada por el administrador.
   */
  async obtenerPerfil(uid: string): Promise<PerfilUsuario | null> {
    try {
      const snap = await getDoc(this.ref(uid));
      if (!snap.exists()) return null;
      const d = snap.data();
      const puntos = Math.max(0, Math.floor(Number(d['puntos']) || 0));
      return {
        nombreCompleto: String(d['nombreCompleto'] ?? ''),
        email: String(d['email'] ?? ''),
        rol: normalizarRol(d['rol']),
        curso: normalizarCurso(d['curso']),
        paralelo: normalizarParalelo(d['paralelo']),
        cursos: cursosDe({
          curso: normalizarCurso(d['curso']),
          paralelo: normalizarParalelo(d['paralelo']),
          cursos: normalizarCursos(d['cursos'])
        }),
        avatarUrl: d['avatarUrl'] ? String(d['avatarUrl']) : undefined,
        debeCambiarPassword: d['debeCambiarPassword'] === true,
        puntos,
        nivel: Number(d['nivel']) || 1,
        tituloNivel: String(d['tituloNivel'] ?? 'Explorador'),
        resumen: resumenDesdeDoc(d['resumen'])
      };
    } catch {
      return null;
    }
  }

  /** Lee el documento y normaliza sus campos (no lanza si no existe). */
  private async leer(uid: string): Promise<
    UsuarioSinTiempo & { creadoEn?: unknown; ultimoIngreso?: unknown }
  > {
    try {
      const snap = await getDoc(this.ref(uid));
      if (!snap.exists()) return this.vacio();
      const d = snap.data();
      const puntos = Math.max(0, Math.floor(Number(d['puntos']) || 0));
      const base: UsuarioSinTiempo = {
        email: String(d['email'] ?? ''),
        nombreCompleto: String(d['nombreCompleto'] ?? ''),
        rol: normalizarRol(d['rol']),
        puntos,
        nivel: Number(d['nivel']) || 1,
        tituloNivel: String(d['tituloNivel'] ?? 'Explorador')
      };
      const curso = normalizarCurso(d['curso']);
      const paralelo = normalizarParalelo(d['paralelo']);
      const cursos = normalizarCursos(d['cursos']);
      if (curso !== undefined) base.curso = curso;
      if (paralelo !== undefined) base.paralelo = paralelo;
      if (cursos.length) {
        base.cursos = cursos;
        base.cursosClaves = cursos.map((c) => claveCurso(c.curso, c.paralelo));
      }
      if (d['avatarUrl']) base.avatarUrl = String(d['avatarUrl']);
      if (d['debeCambiarPassword'] === true) base.debeCambiarPassword = true;
      return { ...base, creadoEn: d['creadoEn'], ultimoIngreso: d['ultimoIngreso'] };
    } catch {
      return this.vacio();
    }
  }

  private vacio(): UsuarioSinTiempo {
    return usuarioPorDefecto({ email: '', nombreCompleto: '' });
  }
}
