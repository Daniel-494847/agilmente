import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { onAuthStateChanged } from 'firebase/auth';

import { auth } from '@core/firebase';
import { UserRoleService } from '@core/auth/user-role.service';
import {
  ADMIN_EMAIL,
  CURSOS,
  DOMINIO_ESTUDIANTES,
  PARALELOS,
  Paralelo,
  RolUsuario,
  UsuarioAdmin,
  nombreCurso
} from '@core/models/usuario.model';
import { UsuarioService } from '@core/services/usuario.service';
import {
  PasswordService,
  esCorreoInterno,
  mensajeErrorReset
} from '@core/services/password.service';
import { ActividadesService } from '@features/actividades/services/actividades.service';
import {
  EstadisticasService,
  EstadisticasUsuario,
  crearEstadisticasVacias
} from '@core/services/estadisticas.service';
import { ImportarEstudiantes } from '../importar-estudiantes/importar-estudiantes';
import { ResultadoImportacion } from '../importar-estudiantes/importacion-estudiantes.model';
import { ImportacionEstudiantesService } from '../importar-estudiantes/importacion-estudiantes.service';

interface UsuarioConEstadisticas extends UsuarioAdmin {
  stats: EstadisticasUsuario;
}

interface ResetCredenciales {
  usuario: UsuarioConEstadisticas;
  tipo: 'correo' | 'temporal';
  email: string;
  /** Nombre con el que se entra: usuario interno sin dominio o correo real. */
  acceso: string;
  password?: string;
}

interface GrupoCurso {
  curso: number;
  etiqueta: string;
  paralelo: Paralelo;
  total: number;
}

type FiltroCurso =
  | { tipo: 'curso'; curso: number; paralelo: Paralelo }
  | { tipo: 'sin-curso' };

/**
 * Gestión de usuarios (solo administrador).
 * Muestra el avance de cada usuario (puntos, nivel, intentos, aciertos y tiempo)
 * y permite cambiar su rol. El permiso real lo ponen las reglas de Firestore.
 */
@Component({
  selector: 'app-usuarios-admin',
  standalone: true,
  imports: [RouterLink, ImportarEstudiantes],
  templateUrl: './usuarios-admin.html'
})
export class UsuariosAdmin implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly roles = inject(UserRoleService);
  private readonly usuariosService = inject(UsuarioService);
  private readonly actividades = inject(ActividadesService);
  private readonly estadisticas = inject(EstadisticasService);
  private readonly importacion = inject(ImportacionEstudiantesService);
  private readonly passwords = inject(PasswordService);

  readonly usuarios = signal<UsuarioConEstadisticas[]>([]);
  readonly titulos = signal<Map<string, string>>(new Map());
  readonly cargando = signal(true);
  readonly mensaje = signal('');
  readonly error = signal('');
  readonly avisoEstadisticas = signal('');
  readonly busqueda = signal('');
  readonly abiertos = signal<ReadonlySet<string>>(new Set<string>());
  readonly mostrarImportador = signal(false);
  /** Formulario para crear un estudiante dentro del curso abierto. */
  readonly mostrarNuevo = signal(false);
  /** Selector para mover un estudiante existente al curso abierto. */
  readonly mostrarExistente = signal(false);
  readonly creando = signal(false);
  readonly errorFormulario = signal('');
  readonly credenciales = signal<ResultadoImportacion | null>(null);
  /** Restablecimiento en curso (UID) y credenciales temporales generadas. */
  readonly reseteando = signal<string | null>(null);
  readonly resetCredenciales = signal<ResetCredenciales | null>(null);
  /** Curso seleccionado para ver solo a sus estudiantes. */
  readonly cursoSeleccionado = signal<FiltroCurso | null>(null);
  /** UID del administrador que ve la página (no puede cambiarse el propio rol). */
  readonly miUid = signal<string | null>(null);
  readonly rolesOpciones: readonly RolUsuario[] = ['estudiante', 'docente'];
  readonly cursos = CURSOS;
  readonly paralelos = PARALELOS;
  /** Correo del administrador único (se muestra en la página). */
  readonly adminEmail = ADMIN_EMAIL;
  /** Expuesto a la plantilla para elegir entre enlace por correo y temporal. */
  readonly esCorreoInterno = esCorreoInterno;

  /** Los 12 cursos (Primero A … Sexto B) con su cantidad de estudiantes. */
  readonly gruposCurso = computed<GrupoCurso[]>(() => {
    const lista = this.usuarios();
    return CURSOS.flatMap((curso) =>
      PARALELOS.map((paralelo) => ({
        curso: curso.valor,
        etiqueta: curso.etiqueta,
        paralelo,
        total: lista.filter(
          (u) => u.rol === 'estudiante' && u.curso === curso.valor && u.paralelo === paralelo
        ).length
      }))
    );
  });

  /** Estudiantes sin curso o sin paralelo (pendientes de asignar). */
  readonly estudiantesSinCurso = computed(
    () =>
      this.usuarios().filter(
        (u) => u.rol === 'estudiante' && (!u.curso || !u.paralelo)
      ).length
  );

  /** Usuarios filtrados por el curso seleccionado y por la búsqueda. */
  readonly filtrados = computed<UsuarioConEstadisticas[]>(() => {
    const seleccion = this.cursoSeleccionado();
    let lista = this.usuarios();

    if (seleccion?.tipo === 'curso') {
      lista = lista.filter(
        (u) =>
          u.rol === 'estudiante' &&
          u.curso === seleccion.curso &&
          u.paralelo === seleccion.paralelo
      );
    } else if (seleccion?.tipo === 'sin-curso') {
      lista = lista.filter((u) => u.rol === 'estudiante' && (!u.curso || !u.paralelo));
    }

    const texto = this.busqueda().trim().toLowerCase();
    if (!texto) {
      return lista;
    }
    return lista.filter((u) =>
      `${u.nombreCompleto} ${u.email} ${this.cursoTexto(u)}`.toLowerCase().includes(texto)
    );
  });

  /** Título legible del filtro activo. */
  readonly tituloFiltro = computed(() => {
    const seleccion = this.cursoSeleccionado();
    if (!seleccion) {
      return '';
    }
    return seleccion.tipo === 'sin-curso'
      ? 'Estudiantes sin curso'
      : nombreCurso(seleccion.curso, seleccion.paralelo);
  });

  /** `true` cuando se entró a un curso concreto (no a «Sin curso»). */
  readonly esModuloCurso = computed(() => this.cursoSeleccionado()?.tipo === 'curso');

  /** Datos del curso abierto, o `null` si no hay ninguno. */
  readonly cursoActivo = computed(() => {
    const seleccion = this.cursoSeleccionado();
    return seleccion?.tipo === 'curso' ? seleccion : null;
  });

  /** Total de estudiantes matriculados en el curso abierto (sin aplicar la búsqueda). */
  readonly totalCurso = computed(() => {
    const seleccion = this.cursoSeleccionado();
    if (seleccion?.tipo !== 'curso') {
      return 0;
    }
    return this.usuarios().filter(
      (u) =>
        u.rol === 'estudiante' &&
        u.curso === seleccion.curso &&
        u.paralelo === seleccion.paralelo
    ).length;
  });

  /** Estudiantes que no están en el curso abierto (para poder añadirlos). */
  readonly estudiantesDisponibles = computed<UsuarioConEstadisticas[]>(() => {
    const seleccion = this.cursoSeleccionado();
    if (seleccion?.tipo !== 'curso') {
      return [];
    }
    return this.usuarios().filter(
      (u) =>
        u.rol === 'estudiante' &&
        !(u.curso === seleccion.curso && u.paralelo === seleccion.paralelo)
    );
  });

  /** Docentes asignados al curso abierto. */
  readonly docentesDelCurso = computed<UsuarioConEstadisticas[]>(() => {
    const curso = this.cursoActivo();
    if (!curso) {
      return [];
    }
    return this.usuarios().filter(
      (u) =>
        u.rol === 'docente' &&
        u.curso === curso.curso &&
        u.paralelo === curso.paralelo
    );
  });

  /** Docentes que aún no están asignados al curso abierto (pueden estar en otro). */
  readonly docentesDisponibles = computed<UsuarioConEstadisticas[]>(() => {
    const curso = this.cursoActivo();
    if (!curso) {
      return [];
    }
    return this.usuarios().filter(
      (u) =>
        u.rol === 'docente' &&
        !(u.curso === curso.curso && u.paralelo === curso.paralelo)
    );
  });

  /** Totales de los usuarios visibles (cabecera de la página). */
  readonly resumen = computed(() => {
    const lista = this.filtrados();
    return {
      total: lista.length,
      estudiantes: lista.filter((u) => u.rol === 'estudiante').length,
      intentos: lista.reduce((suma, u) => suma + u.stats.intentosFinalizados, 0),
      puntos: lista.reduce((suma, u) => suma + u.stats.puntos, 0)
    };
  });

  async ngOnInit(): Promise<void> {
    this.miUid.set(auth.currentUser?.uid ?? null);
    const unsub = onAuthStateChanged(auth, (user) => this.miUid.set(user?.uid ?? null));
    this.destroyRef.onDestroy(() => unsub());
    await this.cargar();
  }

  async cargar(mostrarCargando = true): Promise<void> {
    if (mostrarCargando) {
      this.cargando.set(true);
    }
    this.error.set('');
    this.avisoEstadisticas.set('');
    try {
      const lista = await this.roles.listarUsuarios();

      // Las estadísticas y los títulos son accesorios: si fallan, se muestran
      // los usuarios igualmente con valores en cero.
      const [resTitulos, resEstadisticas] = await Promise.allSettled([
        this.actividades.titulosPorSlug(),
        this.estadisticas.resumenPorUsuario()
      ]);

      const titulos =
        resTitulos.status === 'fulfilled' ? resTitulos.value : new Map<string, string>();
      let stats = new Map<string, EstadisticasUsuario>();
      if (resEstadisticas.status === 'fulfilled') {
        stats = resEstadisticas.value;
      } else {
        this.avisoEstadisticas.set(
          'No se pudieron cargar las estadísticas de avance. Verifica tu rol de administrador.'
        );
      }

      this.titulos.set(titulos);
      this.usuarios.set(
        lista.map((u) => {
          const s = stats.get(u.uid) ?? crearEstadisticasVacias();
          if (u.puntos !== undefined && u.puntos > 0) {
            s.puntos = Math.max(s.puntos, u.puntos);
            if (u.nivel) s.nivel = Math.max(s.nivel, u.nivel);
            if (u.tituloNivel) s.tituloNivel = u.tituloNivel;
          }
          return { ...u, stats: s };
        })
      );
    } catch {
      this.error.set('No se pudieron cargar los usuarios.');
    } finally {
      if (mostrarCargando) {
        this.cargando.set(false);
      }
    }
  }

  async cambiarRol(usuario: UsuarioConEstadisticas, nuevo: RolUsuario): Promise<void> {
    if (nuevo === usuario.rol || usuario.uid === this.miUid()) {
      return;
    }
    if (nuevo === 'administrador') {
      this.error.set(
        `El administrador es único (${ADMIN_EMAIL}); no se puede asignar a otro usuario.`
      );
      return;
    }
    try {
      await this.roles.cambiarRol(usuario.uid, nuevo);
      this.usuarios.update((lista) =>
        lista.map((u) => (u.uid === usuario.uid ? { ...u, rol: nuevo } : u))
      );
      this.mensaje.set(`Rol de ${usuario.nombreCompleto || usuario.email} actualizado a «${nuevo}».`);
      this.error.set('');
    } catch {
      this.error.set('No se pudo cambiar el rol (¿eres administrador?).');
    }
  }

  /** Asigna o corrige el curso y el paralelo de un estudiante. */
  async guardarCurso(
    usuario: UsuarioConEstadisticas,
    curso: string | number,
    paralelo: string
  ): Promise<void> {
    const cursoValido = Number(curso);
    const paraleloValido = paralelo.trim().toUpperCase();
    if (!Number.isInteger(cursoValido) || cursoValido < 1 || cursoValido > 6) {
      this.error.set('Selecciona un curso válido (Primero a Sexto).');
      return;
    }
    if (paraleloValido !== 'A' && paraleloValido !== 'B') {
      this.error.set('Selecciona un paralelo válido (A o B).');
      return;
    }
    try {
      await this.usuariosService.asignarCurso(
        usuario.uid,
        cursoValido,
        paraleloValido as Paralelo
      );
      this.usuarios.update((lista) =>
        lista.map((u) =>
          u.uid === usuario.uid
            ? { ...u, curso: cursoValido, paralelo: paraleloValido as Paralelo }
            : u
        )
      );
      const cursoTexto = nombreCurso(cursoValido, paraleloValido as Paralelo);
      this.mensaje.set(
        `Curso de ${usuario.nombreCompleto || usuario.email} actualizado a «${cursoTexto}».`
      );
      this.error.set('');
    } catch {
      this.error.set('No se pudo asignar el curso (¿eres administrador?).');
    }
  }

  alternarDetalle(uid: string): void {
    this.abiertos.update((actuales) => {
      const copia = new Set(actuales);
      if (copia.has(uid)) {
        copia.delete(uid);
      } else {
        copia.add(uid);
      }
      return copia;
    });
  }

  alternarImportador(): void {
    this.mostrarImportador.update((visible) => !visible);
    this.mostrarNuevo.set(false);
    this.mostrarExistente.set(false);
    this.errorFormulario.set('');
    this.credenciales.set(null);
  }

  alternarNuevo(): void {
    this.mostrarNuevo.update((visible) => !visible);
    this.mostrarExistente.set(false);
    this.mostrarImportador.set(false);
    this.errorFormulario.set('');
    this.credenciales.set(null);
  }

  cerrarNuevo(): void {
    this.mostrarNuevo.set(false);
    this.errorFormulario.set('');
  }

  alternarExistente(): void {
    this.mostrarExistente.update((visible) => !visible);
    this.mostrarNuevo.set(false);
    this.mostrarImportador.set(false);
    this.errorFormulario.set('');
    this.credenciales.set(null);
  }

  cerrarExistente(): void {
    this.mostrarExistente.set(false);
  }

  /** Crea un estudiante nuevo y lo matricula en el curso abierto. */
  async crearEstudiante(nombre: string, correo: string, password: string): Promise<void> {
    const seleccion = this.cursoSeleccionado();
    if (seleccion?.tipo !== 'curso' || this.creando()) {
      return;
    }

    const nombreLimpio = nombre.trim();
    const correoLimpio = correo.trim();
    const passwordLimpio = password.trim();

    if (!nombreLimpio) {
      this.errorFormulario.set('Escribe el nombre del estudiante.');
      return;
    }
    if (passwordLimpio && passwordLimpio.length < 6) {
      this.errorFormulario.set(
        'La contraseña debe tener al menos 6 caracteres o dejarse vacía para generarla.'
      );
      return;
    }

    this.creando.set(true);
    this.errorFormulario.set('');
    this.credenciales.set(null);

    try {
      const existentes = await this.roles.listarUsuarios();
      const filas = this.importacion.prepararFilas([
        ['Nombre', 'Curso', 'Paralelo', 'Correo', 'Usuario', 'Contraseña'],
        [
          nombreLimpio,
          String(seleccion.curso),
          seleccion.paralelo,
          correoLimpio,
          '',
          passwordLimpio
        ]
      ]);
      const fila = filas[0];

      if (!fila || !fila.valida) {
        this.errorFormulario.set(fila?.error ?? 'Revisa los datos del estudiante.');
        return;
      }

      const correoNormalizado = fila.correoInterno.trim().toLowerCase();
      const yaExiste = existentes.some(
        (usuario) => usuario.email.trim().toLowerCase() === correoNormalizado
      );
      if (yaExiste) {
        this.errorFormulario.set(
          'Ya existe un estudiante con ese correo o nombre. Usa «Añadir existente» o escribe un correo distinto.'
        );
        return;
      }

      const [resultado] = await this.importacion.importar([fila], existentes);
      if (!resultado || resultado.estado === 'error') {
        this.errorFormulario.set(resultado?.detalle ?? 'No se pudo añadir al estudiante.');
        return;
      }

      this.credenciales.set(resultado);
      this.mostrarNuevo.set(false);
      this.mensaje.set(
        resultado.estado === 'creado'
          ? `${resultado.nombre} añadido a ${this.tituloFiltro()}.`
          : `${resultado.nombre} ya existía; se actualizó su curso a ${this.tituloFiltro()}.`
      );
      this.error.set('');
      await this.cargar(false);
    } catch {
      this.errorFormulario.set('No se pudo añadir al estudiante. Inténtalo de nuevo.');
    } finally {
      this.creando.set(false);
    }
  }

  /** Mueve un estudiante existente (sin curso o de otro curso) al curso abierto. */
  async agregarExistente(uid: string): Promise<void> {
    const seleccion = this.cursoSeleccionado();
    if (seleccion?.tipo !== 'curso' || !uid) {
      return;
    }

    const usuario = this.usuarios().find((u) => u.uid === uid);
    if (!usuario) {
      return;
    }

    const destino = nombreCurso(seleccion.curso, seleccion.paralelo);
    if (usuario.curso && usuario.paralelo) {
      const origen = this.cursoTexto(usuario);
      if (
        !window.confirm(
          `¿Mover a ${usuario.nombreCompleto || usuario.email} de «${origen}» a «${destino}»?`
        )
      ) {
        return;
      }
    }

    try {
      await this.usuariosService.asignarCurso(uid, seleccion.curso, seleccion.paralelo);
      this.usuarios.update((lista) =>
        lista.map((u) =>
          u.uid === uid ? { ...u, curso: seleccion.curso, paralelo: seleccion.paralelo } : u
        )
      );
      this.mensaje.set(`${usuario.nombreCompleto || usuario.email} añadido a «${destino}».`);
      this.error.set('');
      this.mostrarExistente.set(false);
    } catch {
      this.error.set('No se pudo añadir al curso (¿eres administrador?).');
    }
  }

  /** Saca al estudiante del curso sin borrar su cuenta. */
  async quitarDelCurso(usuario: UsuarioConEstadisticas): Promise<void> {
    const curso = this.cursoTexto(usuario);
    const nombre = usuario.nombreCompleto || usuario.email;
    const rol = usuario.rol === 'docente' ? 'docente' : 'estudiante';

    if (
      !window.confirm(
        `¿Quitar a ${nombre} de «${curso}»? El ${rol} quedará sin curso asignado y su cuenta no se elimina.`
      )
    ) {
      return;
    }

    try {
      await this.usuariosService.quitarCurso(usuario.uid);
      this.usuarios.update((lista) =>
        lista.map((u) =>
          u.uid === usuario.uid ? { ...u, curso: undefined, paralelo: undefined } : u
        )
      );
      this.mensaje.set(`${nombre} quedó fuera de «${curso}».`);
      this.error.set('');
    } catch {
      this.error.set('No se pudo quitar del curso (¿eres administrador?).');
    }
  }

  /**
   * Restablece la contraseña de un usuario.
   * - Correo real: Firebase envía un enlace de un solo uso.
   * - Correo interno: se genera una contraseña temporal y deberá cambiarla al entrar.
   */
  async resetearPassword(usuario: UsuarioConEstadisticas): Promise<void> {
    const nombre = usuario.nombreCompleto || usuario.email;

    if (usuario.uid === this.miUid() || this.esAdminEmail(usuario.email)) {
      this.error.set('No se puede restablecer la contraseña del administrador.');
      return;
    }
    if (!usuario.email.trim()) {
      this.error.set('El usuario no tiene un correo registrado.');
      return;
    }

    const interno = this.esCorreoInterno(usuario.email);
    const confirmacion = interno
      ? `¿Generar una contraseña temporal para ${nombre}? Se mostrará aquí mismo y deberá cambiarla al entrar.`
      : `¿Enviar un enlace de restablecimiento a ${usuario.email}? El enlace es de un solo uso y el usuario elegirá su nueva contraseña.`;

    if (!window.confirm(confirmacion)) {
      return;
    }

    this.reseteando.set(usuario.uid);
    this.resetCredenciales.set(null);
    this.error.set('');
    this.mensaje.set('');

    try {
      const resultado = await this.passwords.resetear(usuario.uid, usuario.email);
      this.resetCredenciales.set({
        usuario,
        tipo: resultado.tipo,
        email: resultado.tipo === 'correo' ? resultado.email : usuario.email,
        acceso: this.usuarioTexto(usuario.email),
        password: resultado.tipo === 'temporal' ? resultado.password : undefined
      });

      if (resultado.tipo === 'temporal') {
        this.usuarios.update((lista) =>
          lista.map((u) =>
            u.uid === usuario.uid ? { ...u, debeCambiarPassword: true } : u
          )
        );
        this.mensaje.set(
          `Contraseña temporal generada para ${nombre}. Entrégasela; al entrar deberá cambiarla.`
        );
      } else {
        this.mensaje.set(
          `Enlace de restablecimiento enviado a ${resultado.email}. Es de un solo uso.`
        );
      }
      this.abiertos.update((actuales) => new Set(actuales).add(usuario.uid));
    } catch (error) {
      this.error.set(mensajeErrorReset(error));
    } finally {
      this.reseteando.set(null);
    }
  }

  /** Copia la contraseña temporal al portapapeles. */
  async copiarPassword(password: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(password);
      this.mensaje.set('Contraseña temporal copiada.');
      this.error.set('');
    } catch {
      this.error.set('No se pudo copiar. Selecciona la contraseña manualmente.');
    }
  }

  /** Asigna un docente al curso abierto (lo mueve si ya tenía otro curso). */
  async asignarDocente(uid: string): Promise<void> {
    const curso = this.cursoActivo();
    if (!curso || !uid) {
      return;
    }

    const docente = this.usuarios().find((u) => u.uid === uid && u.rol === 'docente');
    if (!docente) {
      return;
    }

    const destino = nombreCurso(curso.curso, curso.paralelo);
    if (docente.curso && docente.paralelo) {
      if (
        !window.confirm(
          `¿Mover a ${docente.nombreCompleto || docente.email} de «${this.cursoTexto(
            docente
          )}» a «${destino}»?`
        )
      ) {
        return;
      }
    }

    try {
      await this.usuariosService.asignarCurso(uid, curso.curso, curso.paralelo);
      this.usuarios.update((lista) =>
        lista.map((u) =>
          u.uid === uid ? { ...u, curso: curso.curso, paralelo: curso.paralelo } : u
        )
      );
      this.mensaje.set(
        `${docente.nombreCompleto || docente.email} asignado como docente de «${destino}».`
      );
      this.error.set('');
    } catch {
      this.error.set('No se pudo asignar al docente (¿eres administrador?).');
    }
  }

  /** Quita al docente del curso abierto sin borrar su cuenta. */
  async quitarDocenteDelCurso(docente: UsuarioConEstadisticas): Promise<void> {
    const nombre = docente.nombreCompleto || docente.email;
    const curso = this.tituloFiltro();

    if (
      !window.confirm(
        `¿Quitar a ${nombre} como docente de «${curso}»? Su cuenta no se elimina.`
      )
    ) {
      return;
    }

    try {
      await this.usuariosService.quitarCurso(docente.uid);
      this.usuarios.update((lista) =>
        lista.map((u) =>
          u.uid === docente.uid ? { ...u, curso: undefined, paralelo: undefined } : u
        )
      );
      this.mensaje.set(`${nombre} quedó sin curso asignado.`);
      this.error.set('');
    } catch {
      this.error.set('No se pudo quitar al docente (¿eres administrador?).');
    }
  }

  /** Entra al curso indicado; si ya estaba abierto, lo cierra. */
  seleccionarCurso(curso: number, paralelo: Paralelo): void {
    this.mostrarNuevo.set(false);
    this.mostrarExistente.set(false);
    this.mostrarImportador.set(false);
    this.errorFormulario.set('');
    this.credenciales.set(null);
    this.resetCredenciales.set(null);

    const actual = this.cursoSeleccionado();
    if (actual?.tipo === 'curso' && actual.curso === curso && actual.paralelo === paralelo) {
      this.cursoSeleccionado.set(null);
      return;
    }
    this.cursoSeleccionado.set({ tipo: 'curso', curso, paralelo });
    this.busqueda.set('');
  }

  seleccionarSinCurso(): void {
    this.mostrarNuevo.set(false);
    this.mostrarExistente.set(false);
    this.mostrarImportador.set(false);
    this.errorFormulario.set('');
    this.credenciales.set(null);
    this.resetCredenciales.set(null);
    this.cursoSeleccionado.set(
      this.estaSeleccionadoSinCurso() ? null : { tipo: 'sin-curso' }
    );
    this.busqueda.set('');
  }

  estaSeleccionado(curso: number, paralelo: Paralelo): boolean {
    const actual = this.cursoSeleccionado();
    return actual?.tipo === 'curso' && actual.curso === curso && actual.paralelo === paralelo;
  }

  estaSeleccionadoSinCurso(): boolean {
    return this.cursoSeleccionado()?.tipo === 'sin-curso';
  }

  verTodos(): void {
    this.cursoSeleccionado.set(null);
    this.mostrarNuevo.set(false);
    this.mostrarExistente.set(false);
    this.mostrarImportador.set(false);
    this.errorFormulario.set('');
    this.credenciales.set(null);
    this.resetCredenciales.set(null);
  }

  estaAbierto(uid: string): boolean {
    return this.abiertos().has(uid);
  }

  /** Curso y paralelo legibles («Primero A») o «Sin curso». */
  cursoTexto(usuario: Pick<UsuarioAdmin, 'curso' | 'paralelo'>): string {
    return nombreCurso(usuario.curso, usuario.paralelo) || 'Sin curso';
  }

  /** `true` si el correo es el del administrador único. */
  esAdminEmail(email: string): boolean {
    return email.trim().toLowerCase() === ADMIN_EMAIL;
  }

  /** Nombre de acceso: usuario interno sin dominio, o correo real. */
  usuarioTexto(email: string): string {
    const correo = email.trim().toLowerCase();
    const sufijo = `@${DOMINIO_ESTUDIANTES}`;
    return correo.endsWith(sufijo) ? correo.slice(0, -sufijo.length) : correo;
  }

  /** Título legible de la actividad a partir del slug guardado en el intento. */
  tituloDe(slug: string): string {
    if (!slug) {
      return '—';
    }
    const titulo = this.titulos().get(slug);
    if (titulo) {
      return titulo;
    }
    return slug.replace(/-/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
  }

  formatoFecha(fecha: Date | null): string {
    if (!fecha) {
      return 'Sin actividad registrada';
    }
    return fecha.toLocaleString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  formatoTiempo(segundos: number): string {
    if (!segundos || segundos <= 0) {
      return '—';
    }
    const horas = Math.floor(segundos / 3600);
    const minutos = Math.floor((segundos % 3600) / 60);
    if (horas > 0) {
      return `${horas} h ${minutos} min`;
    }
    if (minutos > 0) {
      return `${minutos} min`;
    }
    return `${segundos} s`;
  }
}
