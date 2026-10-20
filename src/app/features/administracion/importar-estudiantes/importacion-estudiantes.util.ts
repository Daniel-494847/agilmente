import { Paralelo } from '@core/models/usuario.model';

import { DOMINIO_ESTUDIANTES, DestinoImportacion, FilaImportacion } from './importacion-estudiantes.model';

/** Alias de cabeceras aceptadas (sin acentos ni signos). */
const CABECERAS: Record<'nombre' | 'curso' | 'paralelo' | 'correo' | 'usuario' | 'password', string[]> = {
  nombre: [
    'nombre',
    'nombrecompleto',
    'nombres',
    'estudiante',
    'alumno',
    'alumnos',
    'nombredelestudiante',
    'apellidosynombres',
    'apellidoynombre'
  ],
  curso: ['curso', 'grado', 'nivel', 'ano', 'cursooparalelo', 'cursoyparalelo'],
  paralelo: ['paralelo', 'seccion', 'division', 'letra'],
  correo: ['correo', 'email', 'correoelectronico', 'correoinstitucional', 'mail'],
  usuario: ['usuario', 'user', 'nombredeusuario', 'login'],
  password: ['contrasena', 'contrasenia', 'clave', 'password']
};

const PALABRAS_CURSO: Record<string, number> = {
  primero: 1,
  primer: 1,
  segundo: 2,
  tercero: 3,
  tercer: 3,
  cuarto: 4,
  quinto: 5,
  sexto: 6
};

const ALFABETO_PASSWORD = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** Texto limpio: recorta y quita espacios repetidos. */
export function limpiarTexto(valor: unknown): string {
  return String(valor ?? '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Minúsculas, sin acentos y sin signos (para comparar cabeceras). */
export function normalizarCabecera(valor: unknown): string {
  return limpiarTexto(valor)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/** Curso 1–6 a partir de «1», «1ro», «primero», «1A»… */
export function extraerCurso(valor: unknown): number | undefined {
  const texto = normalizarCabecera(valor);
  const digito = texto.match(/[1-6]/);
  if (digito) {
    return Number(digito[0]);
  }
  for (const palabra of Object.keys(PALABRAS_CURSO)) {
    if (texto.includes(palabra)) {
      return PALABRAS_CURSO[palabra];
    }
  }
  return undefined;
}

/** Paralelo A/B a partir de «A», «paralelo A», «1A»… */
export function extraerParalelo(valor: unknown): Paralelo | undefined {
  const texto = limpiarTexto(valor)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  const letra = texto.match(/(?:^|[^a-z])([ab])(?=$|[^a-z])/);
  return letra ? (letra[1].toUpperCase() as Paralelo) : undefined;
}

/** Convierte un nombre en un usuario válido: «Juan Pérez» → «juan.perez». */
export function slugUsuario(valor: unknown): string {
  const base = limpiarTexto(valor)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '')
    .slice(0, 24);
  return base || 'estudiante';
}

/** Contraseña temporal legible, por ejemplo «ABCD-2345». */
export function generarPassword(): string {
  let salida = '';
  for (let i = 0; i < 8; i += 1) {
    salida += ALFABETO_PASSWORD[Math.floor(Math.random() * ALFABETO_PASSWORD.length)];
  }
  return `${salida.slice(0, 4)}-${salida.slice(4)}`;
}

/** Correo interno de acceso para un usuario. */
export function correoDeUsuario(usuario: string): string {
  return `${slugUsuario(usuario)}@${DOMINIO_ESTUDIANTES}`;
}

/** Lee un CSV (separador `,` o `;`) y devuelve una matriz de celdas. */
export function parsearCsv(texto: string): string[][] {
  const lineas = texto.replace(/^\uFEFF/, '').split(/\r?\n/).filter((linea) => linea.trim() !== '');
  if (!lineas.length) {
    return [];
  }
  const primera = lineas[0];
  const separador =
    (primera.match(/;/g)?.length ?? 0) > (primera.match(/,/g)?.length ?? 0) ? ';' : ',';

  return lineas.map((linea) => dividirLinea(linea, separador));
}

function dividirLinea(linea: string, separador: string): string[] {
  const celdas: string[] = [];
  let actual = '';
  let entreComillas = false;

  for (let i = 0; i < linea.length; i += 1) {
    const caracter = linea[i];
    if (caracter === '"') {
      if (entreComillas && linea[i + 1] === '"') {
        actual += '"';
        i += 1;
      } else {
        entreComillas = !entreComillas;
      }
    } else if (caracter === separador && !entreComillas) {
      celdas.push(actual);
      actual = '';
    } else {
      actual += caracter;
    }
  }
  celdas.push(actual);
  return celdas;
}

/** Índice de cada columna a partir de la fila de cabeceras. */
function indicesDeCabecera(cabecera: string[]): {
  nombre: number;
  curso: number;
  paralelo: number;
  correo: number;
  usuario: number;
  password: number;
} {
  const buscar = (claves: string[]) => cabecera.findIndex((celda) => claves.includes(celda));
  return {
    nombre: buscar(CABECERAS.nombre),
    curso: buscar(CABECERAS.curso),
    paralelo: buscar(CABECERAS.paralelo),
    correo: buscar(CABECERAS.correo),
    usuario: buscar(CABECERAS.usuario),
    password: buscar(CABECERAS.password)
  };
}

/**
 * Interpreta la matriz del Excel/CSV y devuelve las filas listas para previsualizar.
 * Si la primera fila tiene cabeceras conocidas se usan; si no, se asume el orden
 * Nombre, Curso, Paralelo, Correo, Usuario, Contraseña.
 *
 * Los usuarios sin correo reciben uno interno determinista a partir del nombre;
 * así, al volver a importar la misma lista se actualizan en vez de duplicarse.
 */
export function procesarFilas(
  matriz: string[][],
  destino?: DestinoImportacion
): FilaImportacion[] {
  const filas = matriz
    .map((celdas, indice) => ({ celdas: celdas.map(limpiarTexto), indice }))
    .filter(({ celdas }) => celdas.some((celda) => celda !== ''));

  if (!filas.length) {
    return [];
  }

  const cabecera = filas[0].celdas.map(normalizarCabecera);
  const tieneCabecera =
    cabecera.some((celda) => CABECERAS.nombre.includes(celda)) ||
    cabecera.some((celda) => CABECERAS.curso.includes(celda));

  const indices = tieneCabecera
    ? indicesDeCabecera(cabecera)
    : destino && filas[0].celdas.length <= 4
      // Sin cabeceras y con el curso ya elegido, el archivo solo necesita
      // Nombre, Correo, Usuario y Contraseña (la plantilla nueva).
      ? { nombre: 0, curso: -1, paralelo: -1, correo: 1, usuario: 2, password: 3 }
      // Formato antiguo sin cabeceras: Nombre, Curso, Paralelo, Correo, Usuario, Contraseña.
      : { nombre: 0, curso: 1, paralelo: 2, correo: 3, usuario: 4, password: 5 };

  // Si hay cabeceras pero falta la columna de nombre, se usa la primera.
  // `curso` y `paralelo` NO se rellenan con otras columnas: cuando el archivo
  // no los trae, los pone el curso seleccionado en `destino`.
  if (indices.nombre < 0) indices.nombre = 0;
  // Sin columna de paralelo, la letra se busca dentro de la celda del curso («1A»).

  const datos = tieneCabecera ? filas.slice(1) : filas;
  const usados = new Set<string>();
  const vistos = new Set<string>();

  return datos.map(({ celdas, indice }) => {
    const nombre = celdas[indices.nombre] ?? '';
    const cursoTexto = celdas[indices.curso] ?? '';
    const paraleloTexto = indices.paralelo >= 0 ? (celdas[indices.paralelo] ?? '') : '';
    const correo = indices.correo >= 0 ? (celdas[indices.correo] ?? '') : '';
    const usuarioTexto = indices.usuario >= 0 ? (celdas[indices.usuario] ?? '') : '';
    const passwordTexto = indices.password >= 0 ? (celdas[indices.password] ?? '') : '';

    const curso = destino
      ? destino.curso
      : extraerCurso(`${cursoTexto} ${paraleloTexto}`);
    const paralelo = destino
      ? destino.paralelo
      : extraerParalelo(`${paraleloTexto} ${cursoTexto}`) ?? extraerParalelo(cursoTexto);

    let usuario = slugUsuario(usuarioTexto || nombre);
    let correoInterno = correo.toLowerCase();

    if (correoInterno) {
      // La cuenta se crea con el correo real, así que ese es el dato de acceso.
      usuario = correoInterno;
    } else {
      let intento = usuario;
      let numero = 2;
      while (usados.has(`${intento}@${DOMINIO_ESTUDIANTES}`)) {
        intento = `${usuario}${numero}`;
        numero += 1;
      }
      usuario = intento;
      correoInterno = `${usuario}@${DOMINIO_ESTUDIANTES}`;
    }

    const password = passwordTexto.length >= 6 ? passwordTexto : generarPassword();
    const errores: string[] = [];

    if (!nombre) {
      errores.push('Falta el nombre.');
    }
    if (!curso) {
      errores.push('Curso inválido (1 a 6).');
    }
    if (!paralelo) {
      errores.push('Paralelo inválido (A o B).');
    }
    if (correoInterno && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correoInterno)) {
      errores.push('Correo inválido.');
    }
    if (vistos.has(correoInterno)) {
      errores.push('Duplicado en el archivo.');
    }

    const fila: FilaImportacion = {
      fila: indice + 1,
      nombre,
      curso,
      paralelo,
      correo: correo || undefined,
      usuario,
      correoInterno,
      password,
      valida: errores.length === 0,
      error: errores.join(' ')
    };

    vistos.add(correoInterno);
    usados.add(correoInterno);
    return fila;
  });
}
