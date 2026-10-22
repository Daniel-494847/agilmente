import { Injectable, inject } from '@angular/core';
import { FirebaseError, initializeApp, deleteApp } from 'firebase/app';
import {
  createUserWithEmailAndPassword,
  deleteUser,
  getAuth,
  signOut
} from 'firebase/auth';
import { readSheet } from 'read-excel-file/browser';

import { UsuarioAdmin, nombreCurso, RolUsuario, cursosDe } from '@core/models/usuario.model';
import { UsuarioService } from '@core/services/usuario.service';
import { environment } from '../../../../environments/environment';

import {
  DestinoImportacion,
  FilaImportacion,
  ResultadoImportacion
} from './importacion-estudiantes.model';
import { parsearCsv, procesarFilas } from './importacion-estudiantes.util';

/**
 * Lee el archivo (.xlsx o .csv) y crea las cuentas de los estudiantes.
 *
 * Las cuentas se crean con una app secundaria de Firebase para no cerrar
 * la sesión del administrador. El documento de Firestore lo escribe la app
 * principal (con la sesión del administrador).
 */
@Injectable({ providedIn: 'root' })
export class ImportacionEstudiantesService {
  private readonly usuarios = inject(UsuarioService);

  /** Devuelve la matriz de celdas del archivo. */
  async leerArchivo(archivo: File): Promise<string[][]> {
    const nombre = archivo.name.toLowerCase();

    if (nombre.endsWith('.csv')) {
      return parsearCsv(await archivo.text());
    }
    if (!nombre.endsWith('.xlsx')) {
      throw new Error('Formato no soportado. Guarda el archivo como .xlsx o .csv.');
    }

    const filas = await readSheet(archivo);
    return filas.map((fila) =>
      fila.map((celda) => (celda === null || celda === undefined ? '' : String(celda)))
    );
  }

  /** Interpreta la matriz y valida cada fila (sin escribir nada). */
  prepararFilas(matriz: string[][], destino?: DestinoImportacion): FilaImportacion[] {
    return procesarFilas(matriz, destino);
  }

  /**
   * Importa las filas válidas. Si el correo ya pertenece a un usuario de
   * Firestore, solo actualiza su curso, paralelo y rol; si no, crea la cuenta.
   *
   * `rol` permite usar el mismo flujo para «Añadir docente»; por defecto crea
   * estudiantes.
   */
  async importar(
    filas: FilaImportacion[],
    existentes: UsuarioAdmin[],
    onProgreso?: (hecho: number, total: number) => void,
    rol: RolUsuario = 'estudiante'
  ): Promise<ResultadoImportacion[]> {
    const validas = filas.filter((fila) => fila.valida);
    const resultados: ResultadoImportacion[] = [];
    const porCorreo = new Map(
      existentes.map((usuario) => [usuario.email.trim().toLowerCase(), usuario])
    );

    // Si no hay filas válidas no se inicializa una app de Firebase innecesaria.
    if (!validas.length) {
      return filas
        .filter((fila) => !fila.valida)
        .map((fila) => this.resultado(fila, 'error', fila.error));
    }

    const appSecundaria = initializeApp(environment.firebase, `importador-${Date.now()}`);
    const authSecundaria = getAuth(appSecundaria);

    try {
      let hechas = 0;

      for (const fila of validas) {
        try {
          const existente = porCorreo.get(fila.correoInterno.toLowerCase());

          if (existente) {
            // A un docente se le suma el curso; un estudiante conserva uno solo.
            const cursos =
              rol === 'docente'
                ? [
                    ...cursosDe(existente).filter(
                      (c) => c.curso !== fila.curso || c.paralelo !== fila.paralelo
                    ),
                    { curso: fila.curso!, paralelo: fila.paralelo! }
                  ]
                : [{ curso: fila.curso!, paralelo: fila.paralelo! }];
            await this.usuarios.asignarCursos(existente.uid, cursos);
            if (existente.rol !== rol) {
              await this.usuarios.cambiarRol(existente.uid, rol);
            }
            resultados.push(this.resultado(fila, 'actualizado'));
          } else {
            const credencial = await createUserWithEmailAndPassword(
              authSecundaria,
              fila.correoInterno,
              fila.password
            );
            try {
              await this.usuarios.crearOReparar(credencial.user, {
                nombreCompleto: fila.nombre,
                rol,
                curso: fila.curso,
                paralelo: fila.paralelo
              });
            } catch (error) {
              // Si no se pudo guardar el perfil, se elimina la cuenta recién creada
              // para que el administrador pueda volver a intentarlo.
              await deleteUser(credencial.user).catch(() => undefined);
              throw error;
            }
            resultados.push(this.resultado(fila, 'creado'));
          }
        } catch (error) {
          resultados.push(this.resultado(fila, 'error', this.mensajeError(error)));
        }

        hechas += 1;
        onProgreso?.(hechas, validas.length);
      }
    } finally {
      await signOut(authSecundaria).catch(() => undefined);
      await deleteApp(appSecundaria).catch(() => undefined);
    }

    const invalidas = filas
      .filter((fila) => !fila.valida)
      .map((fila) => this.resultado(fila, 'error', fila.error));

    return [...resultados, ...invalidas].sort((a, b) => a.fila - b.fila);
  }

  private resultado(
    fila: FilaImportacion,
    estado: ResultadoImportacion['estado'],
    detalle?: string
  ): ResultadoImportacion {
    return {
      fila: fila.fila,
      nombre: fila.nombre || 'Sin nombre',
      cursoTexto: nombreCurso(fila.curso, fila.paralelo) || 'Sin curso',
      usuario: fila.usuario,
      correoInterno: fila.correoInterno,
      password: fila.password,
      estado,
      detalle
    };
  }

  private mensajeError(error: unknown): string {
    if (error instanceof FirebaseError) {
      switch (error.code) {
        case 'auth/email-already-in-use':
          return 'El correo ya está registrado en Firebase Auth.';
        case 'auth/invalid-email':
          return 'El correo no es válido.';
        case 'auth/weak-password':
          return 'La contraseña debe tener al menos 6 caracteres.';
        case 'auth/network-request-failed':
          return 'Sin conexión. Revisa internet e inténtalo de nuevo.';
        case 'auth/too-many-requests':
          return 'Demasiados intentos. Espera un momento y vuelve a intentarlo.';
        default:
          return `No se pudo crear la cuenta (${error.code}).`;
      }
    }
    if (error instanceof Error && error.message) {
      return error.message;
    }
    return 'No se pudo crear la cuenta.';
  }
}
