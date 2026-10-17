import { Injectable } from '@angular/core';
import { User } from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';

import { db, NOMBRES_COLECCION } from '@core/firebase';
import {
  RolUsuario,
  UsuarioDocumento,
  UsuarioSinTiempo,
  calcularNivelYTitulo,
  normalizarRol,
  usuarioPorDefecto
} from '@core/models/usuario.model';

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
   * y sella `ultimoIngreso`. Es el que llaman login/registro/Google.
   */
  async crearOReparar(
    user: Pick<User, 'uid' | 'email'>,
    datos: { nombreCompleto?: string | null; rol?: RolUsuario; avatarUrl?: string | null }
  ): Promise<void> {
    const actual = await this.leer(user.uid);
    const nombre =
      datos.nombreCompleto?.trim() || actual.nombreCompleto || user.email?.split('@')[0] || '';

    const base = usuarioPorDefecto({
      email: actual.email || user.email || '',
      nombreCompleto: nombre,
      rol: datos.rol ?? actual.rol,
      puntos: actual.puntos,
      avatarUrl: datos.avatarUrl ?? actual.avatarUrl
    });

    // En la creación se fija creadoEn; al reparar solo se conserva.
    await setDoc(this.ref(user.uid), {
      ...base,
      creadoEn: actual.creadoEn ?? serverTimestamp(),
      ultimoIngreso: serverTimestamp()
    });
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

  /** Actualiza puntos/nivel/título del propio usuario. Crea el doc si no existe. */
  async guardarProgreso(
    uid: string,
    progreso: { puntos: number; nivel: number; tituloNivel: string }
  ): Promise<void> {
    await setDoc(this.ref(uid), progreso, { merge: true });
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
      avatarUrl: datos.avatarUrl ?? actual.avatarUrl
    });
    const cambios: Record<string, unknown> = { ...base, ...datos };
    if (!actual.email) cambios['ultimoIngreso'] = serverTimestamp();
    await setDoc(this.ref(uid), cambios, { merge: true });
  }

  /** Cambia el rol. Rellena campos faltantes del usuario afectado. */
  async cambiarRol(uid: string, rol: RolUsuario): Promise<void> {
    const actual = await this.leer(uid);
    const base = usuarioPorDefecto({
      email: actual.email,
      nombreCompleto: actual.nombreCompleto,
      rol,
      puntos: actual.puntos,
      avatarUrl: actual.avatarUrl
    });
    await updateDoc(this.ref(uid), base);
  }

  /** Garantiza el esquema completo de un documento ya existente (auto-reparación). */
  async reparar(uid: string): Promise<void> {
    const actual = await this.leer(uid);
    const base = usuarioPorDefecto({
      email: actual.email,
      nombreCompleto: actual.nombreCompleto,
      rol: actual.rol,
      puntos: actual.puntos,
      avatarUrl: actual.avatarUrl
    });
    const cambios: Record<string, unknown> = { ...base };
    if (!actual.ultimoIngreso) cambios['ultimoIngreso'] = serverTimestamp();
    await setDoc(this.ref(uid), cambios, { merge: true });
  }

  /** Lee el documento y devuelve un esquema completo con valores por defecto. */
  async leerCompleto(uid: string): Promise<Required<Pick<UsuarioDocumento, 'email' | 'nombreCompleto' | 'rol' | 'puntos' | 'nivel' | 'tituloNivel'>>> {
    const actual = await this.leer(uid);
    const { nivel, tituloNivel } = calcularNivelYTitulo(actual.puntos);
    return {
      email: actual.email,
      nombreCompleto: actual.nombreCompleto,
      rol: actual.rol,
      puntos: actual.puntos,
      nivel,
      tituloNivel
    };
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
      if (d['avatarUrl']) base.avatarUrl = String(d['avatarUrl']);
      return { ...base, creadoEn: d['creadoEn'], ultimoIngreso: d['ultimoIngreso'] };
    } catch {
      return this.vacio();
    }
  }

  private vacio(): UsuarioSinTiempo {
    return usuarioPorDefecto({ email: '', nombreCompleto: '' });
  }
}
