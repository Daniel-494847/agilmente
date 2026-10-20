import { Component, EventEmitter, Output, computed, inject, input, signal } from '@angular/core';

import { UserRoleService } from '@core/auth/user-role.service';
import { Paralelo, nombreCurso } from '@core/models/usuario.model';

import {
  FilaImportacion,
  ResultadoImportacion
} from './importacion-estudiantes.model';
import { ImportacionEstudiantesService } from './importacion-estudiantes.service';

/**
 * Importación de estudiantes desde un archivo de Excel (.xlsx) o CSV.
 *
 * Flujo: elegir archivo → previsualizar y validar → importar → descargar
 * las credenciales generadas. Las cuentas nuevas se crean en Firebase Auth
 * y su perfil en `usuarios`; las que ya existen solo se actualizan de curso.
 */
@Component({
  selector: 'app-importar-estudiantes',
  standalone: true,
  templateUrl: './importar-estudiantes.html'
})
export class ImportarEstudiantes {
  private readonly servicio = inject(ImportacionEstudiantesService);
  private readonly roles = inject(UserRoleService);

  /** Avisa a la página de usuarios para que recargue la lista. */
  @Output() importados = new EventEmitter<void>();

  /** Curso seleccionado en Gestión de usuarios; todos se importan a este curso. */
  readonly curso = input.required<number>();
  readonly paralelo = input.required<Paralelo>();
  readonly destinoTexto = computed(() => nombreCurso(this.curso(), this.paralelo()));

  readonly archivoNombre = signal('');
  readonly filas = signal<FilaImportacion[]>([]);
  readonly resultados = signal<ResultadoImportacion[]>([]);
  readonly correosExistentes = signal<ReadonlySet<string>>(new Set<string>());
  readonly leyendo = signal(false);
  readonly importando = signal(false);
  readonly progreso = signal({ hecho: 0, total: 0 });
  readonly error = signal('');
  readonly mensaje = signal('');

  readonly validas = computed(() => this.filas().filter((fila) => fila.valida).length);
  readonly invalidas = computed(() => this.filas().filter((fila) => !fila.valida).length);
  readonly creados = computed(() => this.resultados().filter((r) => r.estado === 'creado').length);
  readonly actualizados = computed(
    () => this.resultados().filter((r) => r.estado === 'actualizado').length
  );
  readonly conError = computed(() => this.resultados().filter((r) => r.estado === 'error').length);

  async onArchivo(evento: Event): Promise<void> {
    const input = evento.target as HTMLInputElement;
    const archivo = input.files?.[0];
    // Permite volver a elegir el mismo archivo después de corregirlo.
    input.value = '';

    if (!archivo) {
      return;
    }

    this.leyendo.set(true);
    this.error.set('');
    this.mensaje.set('');
    this.resultados.set([]);
    this.filas.set([]);

    try {
      const matriz = await this.servicio.leerArchivo(archivo);
      const existentes = await this.roles.listarUsuarios();
      const correos = new Set(
        existentes.map((usuario) => usuario.email.trim().toLowerCase()).filter(Boolean)
      );
      const filas = this.servicio.prepararFilas(matriz, {
        curso: this.curso(),
        paralelo: this.paralelo()
      });

      if (!filas.length) {
        this.error.set('El archivo no tiene filas con datos. Revisa que no esté vacío.');
        return;
      }

      this.archivoNombre.set(archivo.name);
      this.correosExistentes.set(correos);
      this.filas.set(filas);
    } catch (error) {
      this.error.set(
        error instanceof Error
          ? error.message
          : 'No se pudo leer el archivo. Inténtalo de nuevo.'
      );
    } finally {
      this.leyendo.set(false);
    }
  }

  async importar(): Promise<void> {
    if (!this.validas() || this.importando()) {
      return;
    }

    this.importando.set(true);
    this.error.set('');
    this.mensaje.set('');
    this.progreso.set({ hecho: 0, total: this.validas() });

    try {
      const existentes = await this.roles.listarUsuarios();
      const resultados = await this.servicio.importar(
        this.filas(),
        existentes,
        (hecho, total) => this.progreso.set({ hecho, total })
      );

      this.resultados.set(resultados);
      this.filas.set([]);
      this.mensaje.set(
        `Importación terminada: ${this.creados()} creados, ${this.actualizados()} actualizados y ${this.conError()} con error.`
      );
      this.importados.emit();
    } catch {
      this.error.set('No se pudo completar la importación. Inténtalo de nuevo.');
    } finally {
      this.importando.set(false);
    }
  }

  reiniciar(): void {
    this.archivoNombre.set('');
    this.filas.set([]);
    this.resultados.set([]);
    this.correosExistentes.set(new Set<string>());
    this.error.set('');
    this.mensaje.set('');
    this.progreso.set({ hecho: 0, total: 0 });
  }

  descargarCsv(): void {
    const filas = this.resultados();
    if (!filas.length) {
      return;
    }

    const encabezado = ['Fila', 'Nombre', 'Curso', 'Usuario', 'Correo', 'Contraseña', 'Estado', 'Detalle'];
    const cuerpo = filas.map((r) => [
      String(r.fila),
      r.nombre,
      r.cursoTexto,
      r.usuario,
      r.correoInterno,
      r.estado === 'creado' ? r.password : '',
      this.etiquetaEstado(r.estado),
      r.detalle ?? ''
    ]);

    this.descargar('estudiantes-importados.csv', [encabezado, ...cuerpo]);
  }

  /** Plantilla CSV con las columnas que entiende el importador. */
  descargarPlantilla(): void {
    this.descargar('plantilla-estudiantes.csv', [
      ['Nombre', 'Correo', 'Usuario', 'Contraseña'],
      ['Ana Torres', '', '', ''],
      ['Luis Pérez', 'luis@correo.com', '', '']
    ]);
  }

  private descargar(nombre: string, filas: string[][]): void {
    const escapar = (valor: string) => `"${valor.replace(/"/g, '""')}"`;
    const contenido = filas.map((fila) => fila.map(escapar).join(';')).join('\r\n');

    // El BOM hace que Excel reconozca los acentos y las tildes.
    const blob = new Blob([`\uFEFF${contenido}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = nombre;
    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();
    URL.revokeObjectURL(url);
  }

  /** Texto del estado para la tabla de resultados. */
  etiquetaEstado(estado: ResultadoImportacion['estado']): string {
    switch (estado) {
      case 'creado':
        return 'Creado';
      case 'actualizado':
        return 'Actualizado';
      default:
        return 'Error';
    }
  }

  /** Clase Bootstrap del badge de estado. */
  claseEstado(estado: ResultadoImportacion['estado']): string {
    switch (estado) {
      case 'creado':
        return 'text-bg-success';
      case 'actualizado':
        return 'text-bg-primary';
      default:
        return 'text-bg-danger';
    }
  }
}
