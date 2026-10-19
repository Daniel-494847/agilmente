import { Injectable } from '@angular/core';

import { PreguntaQuiz } from '@shared/components/quiz/quiz.model';
import {
  EjercicioDocente,
  TipoEjercicioDocente
} from '../models/ejercicio-docente.model';

import {
  BANCO_CONTEO,
  svgConteo,
  BANCO_SUCESIONES,
  svgSucesion,
  BANCO_SERIACIONES,
  svgSeriacion,
  BANCO_OPERADORES,
  svgOperador,
  BANCO_OPERACIONES,
  svgOperacion,
  BANCO_GEOMETRIA,
  svgGeometria,
  EJERCICIOS_POR_NIVEL,
  preguntaDeConjuntos,
  preguntaDeLogica,
  preguntaDeProblemas,
  Celda,
  Cuadrado,
  cuadradosDeNivel
} from '../bancos';

/** Entero aleatorio entre min y max (ambos incluidos). */
const ent = (min: number, max: number): number =>
  Math.floor(Math.random() * (max - min + 1)) + min;

/** Elemento aleatorio de una lista. */
const elegir = <T>(valores: readonly T[]): T => valores[ent(0, valores.length - 1)];

/** true con la probabilidad indicada (por defecto 50 %). */
const si = (probabilidad = 0.5): boolean => Math.random() < probabilidad;

/** Intercala los elementos de una lista (Fisher–Yates, en el sitio). */
function mezclar<T>(valores: T[]): T[] {
  for (let i = valores.length - 1; i > 0; i--) {
    const j = ent(0, i);
    [valores[i], valores[j]] = [valores[j], valores[i]];
  }
  return valores;
}

/** Los tres niveles del módulo Docente equivalen a los niveles del juego. */
type NivelJuego = 'basico' | 'intermedio' | 'avanzado';
const NIVELES_JUEGO: NivelJuego[] = ['basico', 'intermedio', 'avanzado'];
const nivelJuego = (nivel: number): NivelJuego =>
  NIVELES_JUEGO[nivel - 1] ?? 'basico';

/** `cantidad` elementos al azar, sin repetir hasta agotar la lista. */
function tomar<T>(elementos: readonly T[], cantidad: number): T[] {
  if (elementos.length === 0) return [];
  const sobrantes = mezclar([...elementos]);
  const salida: T[] = [];
  while (salida.length < cantidad) {
    if (sobrantes.length === 0) sobrantes.push(...mezclar([...elementos]));
    salida.push(sobrantes.shift()!);
  }
  return salida;
}

/** Enunciado para la hoja impresa: una sola línea y espacio para responder. */
function enunciadoHoja(texto: string): string {
  return texto.replace(/\s*\n+\s*/g, ' ').trim() + '  ________';
}

/**
 * Genera los ejercicios del módulo Docente.
 *
 * Los tipos con figura usan los bancos y constructores de los propios
 * juegos, de modo que la hoja impresa muestra exactamente los mismos
 * gráficos, enunciados y respuestas que la actividad en pantalla. Los
 * tipos de cálculo puro (comparaciones, mentales, interactivas y
 * agilidad) se generan aquí al azar, como sus juegos, que no dibujan
 * figuras.
 */
@Injectable({ providedIn: 'root' })
export class EjerciciosDocenteService {
  /** Genera `cantidad` ejercicios del tipo y nivel pedidos. */
  generar(
    tipo: TipoEjercicioDocente,
    nivel: number,
    cantidad: number
  ): EjercicioDocente[] {
    switch (tipo) {
      // ── Bancos de juegos con figuras SVG (los mismos gráficos en pantalla) ──
      case 'operaciones':
        return this.banco(BANCO_OPERACIONES, nivel, cantidad, (e, i) => ({
          id: `e${i}`,
          enunciado: enunciadoHoja(e.pregunta),
          respuesta: String(e.correcta),
          imagen: svgOperacion(e.trazos)
        }));
      case 'sucesiones':
        return this.banco(BANCO_SUCESIONES, nivel, cantidad, (e, i) => ({
          id: `e${i}`,
          enunciado: enunciadoHoja(e.pregunta),
          respuesta: String(e.correcta),
          imagen: svgSucesion(e.trazos)
        }));
      case 'conteo':
        return this.banco(BANCO_CONTEO, nivel, cantidad, (e, i) => ({
          id: `e${i}`,
          enunciado: enunciadoHoja(e.pregunta),
          respuesta: String(e.correcta),
          imagen: svgConteo(e.trazos)
        }));
      case 'operadores':
        return this.banco(BANCO_OPERADORES, nivel, cantidad, (e, i) => ({
          id: `e${i}`,
          enunciado: enunciadoHoja(e.pregunta),
          respuesta: String(e.correcta),
          imagen: svgOperador(e.trazos)
        }));
      case 'geometria':
        return this.banco(BANCO_GEOMETRIA, nivel, cantidad, (e, i) => ({
          id: `e${i}`,
          enunciado: enunciadoHoja(e.pregunta),
          respuesta: e.correcta,
          imagen: svgGeometria(e.trazos)
        }));
      case 'seriaciones':
        return this.banco(BANCO_SERIACIONES, nivel, cantidad, (e, i) => ({
          id: `e${i}`,
          enunciado: enunciadoHoja(e.pregunta),
          respuesta: String(e.correcta),
          imagen: svgSeriacion(e.trazos)
        }));

      // ── Constructores de quizzes: enunciado + diagrama + opción correcta ──
      case 'conjuntos':
        return this.desdeQuiz(preguntaDeConjuntos, nivel, cantidad);
      case 'logicos':
        return this.desdeQuiz(preguntaDeLogica, nivel, cantidad);
      case 'problemas':
        return this.desdeQuiz(preguntaDeProblemas, nivel, cantidad);

      // ── Cuadrados mágicos: el cuadrado del juego, dibujado aquí en SVG ──
      case 'cuadrados':
        return this.cuadrados(nivel, cantidad);

      // ── Cálculo puro (los juegos de estas actividades no dibujan figuras) ──
      case 'comparaciones':
        return this.varios((i) => this.comparacion(nivel, i), cantidad);
      case 'mentales':
        return this.varios((i) => this.mental(nivel, i), cantidad);
      case 'piramides':
        return this.varios((i) => this.piramide(nivel, i), cantidad);
      case 'interactivas':
        return this.varios((i) => this.interactiva(nivel, i), cantidad);
      case 'agilidad':
        return this.varios((i) => this.agilidad(nivel, i), cantidad);
    }
  }

  /** Ejercicios al azar del banco de un juego, con su gráfico SVG. */
  private banco<T>(
    porNivel: Record<NivelJuego, readonly T[]>,
    nivel: number,
    cantidad: number,
    aEjercicio: (e: T, i: number) => EjercicioDocente
  ): EjercicioDocente[] {
    return tomar(porNivel[nivelJuego(nivel)], cantidad).map(aEjercicio);
  }

  /**
   * Preguntas al azar del constructor de un juego: el enunciado y el
   * diagrama salen del quiz y la respuesta es la opción correcta.
   */
  private desdeQuiz(
    construir: (nivel: number, e: number) => PreguntaQuiz,
    nivel: number,
    cantidad: number
  ): EjercicioDocente[] {
    return tomar(
      Array.from({ length: EJERCICIOS_POR_NIVEL }, (_, k) => k + 1),
      cantidad
    ).map((e, i) => {
      const p = construir(nivel, e);
      const correcta = p.opciones.find((o) => o.id === p.respuestaCorrectaId);
      return {
        id: `e${i}`,
        enunciado: enunciadoHoja(p.enunciado),
        respuesta: correcta?.texto ?? '',
        imagen: p.imagen || undefined
      };
    });
  }

  /** Aplica un generador individual `cantidad` veces (tipos sin banco de juego). */
  private varios(
    generar: (i: number) => EjercicioDocente,
    cantidad: number
  ): EjercicioDocente[] {
    return Array.from({ length: cantidad }, (_, i) => generar(i));
  }

  // ── Cuadrados Mágicos ────────────────────────────────────────────────────

  /**
   * El cuadrado mágico del juego (crearNivel arma los ejercicios al azar),
   * dibujado aquí en SVG porque el juego lo muestra como tabla HTML: el
   * casillero por completar queda marcado con «?», igual que en pantalla.
   */
  private cuadrados(nivel: number, cantidad: number): EjercicioDocente[] {
    const salida: EjercicioDocente[] = [];
    let pendientes: Cuadrado[] = [];
    while (salida.length < cantidad) {
      if (pendientes.length === 0) pendientes = cuadradosDeNivel(nivel);
      const cuadrado = pendientes.shift();
      if (!cuadrado) break;
      // Cuando el objetivo es el casillero, la hoja lleva además la pista
      // del número mágico («Número mágico = 15»); si la pregunta es el
      // número mágico directamente, esa pista sería redundante.
      const pista = /casillero/i.test(cuadrado.pregunta)
        ? `${cuadrado.cabecera}. `
        : '';
      salida.push({
        id: `e${salida.length}`,
        enunciado: enunciadoHoja(pista + cuadrado.pregunta),
        respuesta: String(cuadrado.correcta),
        imagen: this.svgCuadrado(cuadrado.oculto)
      });
    }
    return salida;
  }

  /** Cuadrícula n×n con el mismo lenguaje de trazo que los juegos. */
  private svgCuadrado(celdas: Celda[][]): string {
    const n = celdas.length;
    const lado = 40;
    const hueco = 4;
    const margen = 6;
    const ancho = n * (lado + hueco) - hueco + margen * 2;
    const piezas: string[] = [];
    celdas.forEach((fila, f) =>
      fila.forEach((celda, c) => {
        const x = margen + c * (lado + hueco);
        const y = margen + f * (lado + hueco);
        // Amarillo = casillero a completar; gris claro = sin dato; blanco = dado.
        const relleno =
          celda.t === '?' ? '#fff3cd' : celda.t === '' ? '#f8f9fa' : '#ffffff';
        piezas.push(
          `<rect x="${x}" y="${y}" width="${lado}" height="${lado}" rx="6" fill="${relleno}" stroke="#212529" stroke-width="3"/>`
        );
        if (celda.t) {
          piezas.push(
            `<text x="${x + lado / 2}" y="${y + lado / 2 + 6}" text-anchor="middle" font-size="18" font-weight="bold" font-family="sans-serif" fill="#212529">${celda.t}</text>`
          );
        }
      })
    );
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${ancho} ${ancho}">${piezas.join('')}</svg>`;
  }

  // ── Comparaciones (signo mayor, menor o igual) ────────────────────────────

  private comparacion(nivel: number, i: number): EjercicioDocente {
    const tope = nivel === 1 ? 20 : nivel === 2 ? 50 : 100;
    const a = ent(1, tope);
    const b = ent(1, tope);
    const respuesta = a > b ? '>' : a < b ? '<' : '=';
    return {
      id: `e${i}`,
      enunciado: `${a} ○ ${b}`,
      respuesta
    };
  }

  // ── Actividades Mentales (cálculo mental + conteo rápido + comparaciones) ──

  private mental(nivel: number, i: number): EjercicioDocente {
    const dado = Math.random();
    if (dado < 0.4) return this.calculoMental(nivel, i);
    if (dado < 0.7) return this.comparacion(nivel, i);
    return this.conteoRapido(nivel, i);
  }

  private calculoMental(nivel: number, i: number): EjercicioDocente {
    const tope = nivel === 1 ? 10 : nivel === 2 ? 50 : 200;
    const a = ent(2, tope);
    const b = ent(2, tope);
    if (si()) {
      return {
        id: `e${i}`,
        enunciado: `Calcula mentalmente: ${a} + ${b} = ___`,
        respuesta: String(a + b)
      };
    }
    const mayor = Math.max(a, b);
    const menor = Math.min(a, b);
    return {
      id: `e${i}`,
      enunciado: `Calcula mentalmente: ${mayor} − ${menor} = ___`,
      respuesta: String(mayor - menor)
    };
  }

  private conteoRapido(nivel: number, i: number): EjercicioDocente {
    const total = nivel === 1 ? ent(4, 9) : nivel === 2 ? ent(8, 15) : ent(12, 20);
    const figura = elegir(['●', '▲', '■', '★'] as const);
    return {
      id: `e${i}`,
      enunciado: `Cuenta rápido: ${Array.from({ length: total }, () => figura).join(' ')}  ¿Cuántos hay?  ___`,
      respuesta: String(total)
    };
  }

  // ── Pirámides numéricas ──────────────────────────────────────────────────

  private piramide(nivel: number, i: number): EjercicioDocente {
    const filas = nivel === 3 ? 4 : 3;
    const topeBase = nivel === 1 ? 9 : nivel === 2 ? 12 : 15;
    const base = Array.from({ length: filas }, () => ent(1, topeBase));

    // niveles[0] es la base y niveles[filas - 1] la cima (suma de los dos de abajo).
    const niveles: number[][] = [base];
    for (let f = 1; f < filas; f++) {
      const abajo = niveles[f - 1];
      niveles.push(abajo.slice(0, -1).map((valor, p) => valor + abajo[p + 1]));
    }
    // Celdas de arriba hacia abajo (fila 0 = cima).
    const celdas = [...niveles].reverse();

    // Huecos: todas las celdas menos la base. Como la base siempre se muestra,
    // la pirámide se resuelve siempre de abajo hacia arriba con sumas.
    const candidatos: [number, number][] = [];
    for (let f = 0; f < filas - 1; f++) {
      for (let p = 0; p <= f; p++) candidatos.push([f, p]);
    }
    const cantHuecos = Math.min(
      nivel === 1 ? 1 : nivel === 2 ? 2 : 3,
      candidatos.length
    );
    const huecos = new Set(
      mezclar([...candidatos]).slice(0, cantHuecos).map(([f, p]) => `${f},${p}`)
    );
    // Etiqueta numérica de cada hueco siguiendo el orden de lectura.
    const etiquetas = new Map<string, number>();
    candidatos
      .filter(([f, p]) => huecos.has(`${f},${p}`))
      .sort((a, b) => a[0] - b[0] || a[1] - b[1])
      .forEach(([f, p], idx) => etiquetas.set(`${f},${p}`, idx + 1));

    const ladoCelda = 46;
    const altoCelda = 26;
    const hueco = 6;
    const margen = 8;
    const ancho = filas * (ladoCelda + hueco) + margen * 2;
    const alto = filas * (altoCelda + hueco) + margen * 2;

    // Mismo lenguaje de trazo que los juegos: tinta gruesa redonda y texto
    // grueso; los huecos quedan en blanco para escribir a mano.
    const piezas: string[] = [];
    for (let f = 0; f < filas; f++) {
      const anchoFila = (f + 1) * (ladoCelda + hueco) - hueco;
      const x0 = (ancho - anchoFila) / 2;
      for (let p = 0; p <= f; p++) {
        const clave = `${f},${p}`;
        const x = x0 + p * (ladoCelda + hueco);
        const y = margen + f * (altoCelda + hueco);
        const texto = huecos.has(clave) ? '' : String(celdas[f][p]);
        piezas.push(
          `<rect x="${x}" y="${y}" width="${ladoCelda}" height="${altoCelda}" rx="6" fill="#ffffff" stroke="#212529" stroke-width="3"/>`,
          `<text x="${x + ladoCelda / 2}" y="${y + altoCelda / 2 + 5}" text-anchor="middle" font-family="sans-serif" font-size="14" font-weight="bold" fill="#212529" stroke="#ffffff" stroke-width="4" paint-order="stroke">${texto}</text>`
        );
      }
    }

    const respuestas = [...etiquetas.entries()]
      .sort((a, b) => a[1] - b[1])
      .map(([clave, n]) => {
        const [f, p] = clave.split(',').map(Number);
        return `${n} = ${celdas[f][p]}`;
      })
      .join('   ');

    return {
      id: `e${i}`,
      enunciado: 'Completa la pirámide numérica con los números que faltan.',
      respuesta: respuestas,
      imagen: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${ancho} ${alto}">${piezas.join('')}</svg>`
    };
  }

  // ── Matemáticas Interactivas (operaciones mixtas, división exacta) ────────

  private interactiva(nivel: number, i: number): EjercicioDocente {
    const tope = nivel === 1 ? 12 : nivel === 2 ? 30 : 60;
    const op = elegir(['+', '-', '×', '÷'] as const);
    let a: number, b: number, resultado: number;
    if (op === '÷') {
      const cociente = ent(2, Math.floor(tope / 2));
      b = ent(2, Math.floor(tope / cociente));
      a = b * cociente;
      resultado = cociente;
    } else {
      a = ent(1, tope);
      b = ent(1, tope);
      if (op === '-' && a < b) [a, b] = [b, a];
      resultado = op === '+' ? a + b : op === '-' ? a - b : a * b;
    }
    const simbolo = op === '×' ? '×' : op === '÷' ? '÷' : op;
    return {
      id: `e${i}`,
      enunciado: `${a} ${simbolo} ${b} =  ___`,
      respuesta: String(resultado)
    };
  }

  // ── Juegos Mentales (cálculo con positivos y negativos) ───────────────────

  private agilidad(nivel: number, i: number): EjercicioDocente {
    const tope = nivel === 1 ? 10 : nivel === 2 ? 25 : 50;
    const a = ent(-tope, tope);
    const b = ent(-tope, tope);
    const op = elegir(['+', '-']);
    const resultado = op === '+' ? a + b : a - b;
    const signoB = b < 0 ? '(' + b + ')' : String(b);
    return {
      id: `e${i}`,
      enunciado: `${a} ${op} ${signoB} =  ___`,
      respuesta: String(resultado)
    };
  }
}
