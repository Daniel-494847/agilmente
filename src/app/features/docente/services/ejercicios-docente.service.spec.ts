import { describe, expect, it } from 'vitest';

import { PreguntaQuiz } from '@shared/components/quiz/quiz.model';
import { EjerciciosDocenteService } from './ejercicios-docente.service';
import {
  TipoEjercicioDocente,
  TIPOS_ACTIVIDAD_DOCENTE
} from '../models/ejercicio-docente.model';

// Bancos y constructores de los juegos: la hoja impresa debe salir del
// MISMO material que el alumno ve al jugar (mismo gráfico → misma respuesta).
import {
  EJERCICIOS as BANCO_CONTEO,
  svgDe as svgConteo
} from '@features/actividades/juegos/conteo-figuras/conteo-figuras.data';
import {
  EJERCICIOS as BANCO_SUCESIONES,
  svgDe as svgSucesion
} from '@features/actividades/juegos/sucesiones-patrones/sucesiones-patrones.data';
import {
  EJERCICIOS as BANCO_SERIACIONES,
  svgDe as svgSeriacion
} from '@features/actividades/juegos/seriaciones/seriaciones.data';
import {
  EJERCICIOS as BANCO_OPERADORES,
  svgDe as svgOperador
} from '@features/actividades/juegos/operadores-matematicos/operadores-matematicos.data';
import {
  EJERCICIOS as BANCO_OPERACIONES,
  svgDe as svgOperacion
} from '@features/actividades/juegos/operaciones-basicas/operaciones-numeros-naturales.data';
import {
  EJERCICIOS_GEO as BANCO_GEOMETRIA,
  svgDe as svgGeometria
} from '@features/actividades/juegos/geometria-basica/geometria-basica.data';
import {
  EJERCICIOS_POR_NIVEL,
  construirPregunta as preguntaDeConjuntos
} from '@features/actividades/juegos/conjuntos/conjuntos.data';
import { construirPregunta as preguntaDeLogica } from '@features/actividades/juegos/juegos-logicos/juegos-logicos.data';
import { construirPregunta as preguntaDeProblemas } from '@features/actividades/juegos/razonamiento-aplicado/razonamiento-aplicado.data';

const servicio = new EjerciciosDocenteService();
const NIVELES = [1, 2, 3];

/** Evalúa «a + b», «a - b» o «a × b» (o el número tal cual). */
const evaluar = (lado: string): number => {
  const partes = lado.trim().split(/\s+/);
  if (partes.length === 1) return Number(partes[0]);
  const [a, simbolo, b] = partes;
  const x = Number(a);
  const y = Number(b);
  return simbolo === '+' ? x + y : simbolo === '-' ? x - y : x * y;
};

/**
 * Clave «enunciado|imagen» igual que la arma el servicio docente: una sola
 * línea (los `\n` de los juegos se colapsan) y sin el espacio final con
 * guiones bajos que se añade para la hoja impresa.
 */
const clave = (enunciado: string, imagen?: string): string =>
  `${enunciado
    .replace(/\s*\n+\s*/g, ' ')
    .trim()
    .replace(/\s+_+$/, '')}|${imagen ?? ''}`;

/** Mapa «enunciado|imagen» → respuesta de cada ejercicio de un banco de juego. */
function mapaBanco<T>(
  porNivel: { basico: readonly T[]; intermedio: readonly T[]; avanzado: readonly T[] },
  aClave: (e: T) => string,
  aRespuesta: (e: T) => string
): Map<string, string> {
  const mapa = new Map<string, string>();
  for (const banco of Object.values(porNivel)) {
    for (const e of banco) mapa.set(aClave(e), aRespuesta(e));
  }
  return mapa;
}

/** Mapa equivalente para el constructor de un quiz (EJERCICIOS_POR_NIVEL por nivel). */
function mapaQuiz(
  construir: (nivel: number, e: number) => PreguntaQuiz
): Map<string, string> {
  const mapa = new Map<string, string>();
  for (const nivel of NIVELES) {
    for (let e = 1; e <= EJERCICIOS_POR_NIVEL; e++) {
      const p = construir(nivel, e);
      const correcta = p.opciones.find((o) => o.id === p.respuestaCorrectaId);
      mapa.set(clave(p.enunciado, p.imagen), correcta?.texto ?? '');
    }
  }
  return mapa;
}

/**
 * Cada ejercicio generado debe pertenecer a la fuente: si el gráfico coincide
 * con uno de la fuente, la respuesta impresa debe ser exactamente la suya.
 */
function comprobarFuente(tipo: TipoEjercicioDocente, mapa: Map<string, string>): void {
  for (const nivel of NIVELES) {
    for (const e of servicio.generar(tipo, nivel, 30)) {
      expect(e.imagen, `${tipo}: ejercicio sin figura`).toBeTruthy();
      expect(
        mapa.get(clave(e.enunciado, e.imagen)),
        `${tipo}: no sale de la fuente → ${e.enunciado}`
      ).toBe(e.respuesta);
    }
  }
}

describe('EjerciciosDocenteService', () => {
  it('genera exactamente la cantidad pedida con ids únicos', () => {
    for (const { id } of TIPOS_ACTIVIDAD_DOCENTE) {
      const ejercicios = servicio.generar(id, 2, 17);
      expect(ejercicios).toHaveLength(17);
      expect(new Set(ejercicios.map((e) => e.id)).size).toBe(17);
      for (const e of ejercicios) {
        expect(e.enunciado.length).toBeGreaterThan(0);
        expect(e.respuesta.length).toBeGreaterThan(0);
      }
    }
  });

  // ── Bancos de juegos: la hoja repite los ejercicios del propio juego ──

  it('operaciones: cada ejercicio sale del banco del juego', () => {
    comprobarFuente(
      'operaciones',
      mapaBanco(
        BANCO_OPERACIONES,
        (e) => clave(e.pregunta, svgOperacion(e.trazos)),
        (e) => String(e.correcta)
      )
    );
  });

  it('sucesiones: cada ejercicio sale del banco del juego', () => {
    comprobarFuente(
      'sucesiones',
      mapaBanco(
        BANCO_SUCESIONES,
        (e) => clave(e.pregunta, svgSucesion(e.trazos)),
        (e) => String(e.correcta)
      )
    );
  });

  it('conteo: cada ejercicio sale del banco del juego', () => {
    comprobarFuente(
      'conteo',
      mapaBanco(
        BANCO_CONTEO,
        (e) => clave(e.pregunta, svgConteo(e.trazos)),
        (e) => String(e.correcta)
      )
    );
  });

  it('operadores: cada ejercicio sale del banco del juego', () => {
    comprobarFuente(
      'operadores',
      mapaBanco(
        BANCO_OPERADORES,
        (e) => clave(e.pregunta, svgOperador(e.trazos)),
        (e) => String(e.correcta)
      )
    );
  });

  it('geometria: cada ejercicio sale del banco del juego', () => {
    comprobarFuente(
      'geometria',
      mapaBanco(
        BANCO_GEOMETRIA,
        (e) => clave(e.pregunta, svgGeometria(e.trazos)),
        (e) => e.correcta
      )
    );
  });

  it('seriaciones: cada ejercicio sale del banco del juego', () => {
    comprobarFuente(
      'seriaciones',
      mapaBanco(
        BANCO_SERIACIONES,
        (e) => clave(e.pregunta, svgSeriacion(e.trazos)),
        (e) => String(e.correcta)
      )
    );
  });

  // ── Constructores de quizzes: enunciado, diagrama y opción correcta ──

  it('conjuntos: cada diagrama sale del constructor del juego', () => {
    comprobarFuente('conjuntos', mapaQuiz(preguntaDeConjuntos));
  });

  it(
    'logicos: cada sudoku sale del constructor del juego',
    () => {
      comprobarFuente('logicos', mapaQuiz(preguntaDeLogica));
    },
    30_000
  );

  it('problemas: cada problema sale del constructor del juego', () => {
    comprobarFuente('problemas', mapaQuiz(preguntaDeProblemas));
  });

  // ── Cuadrados mágicos: cuadrícula dibujada en SVG por el servicio ──

  it('cuadrados: la cuadrícula impresa cuadra con la respuesta', () => {
    for (const nivel of NIVELES) {
      for (const e of servicio.generar('cuadrados', nivel, 12)) {
        const svg = e.imagen ?? '';
        expect(svg).toContain('<svg');
        const celdas = [
          ...svg.matchAll(/<rect [^>]*\/>(?:<text[^>]*>([^<]*)<\/text>)?/g)
        ].map((m) => m[1] ?? '');
        const n = Math.round(Math.sqrt(celdas.length));
        expect(n * n, `no es una cuadrícula n×n: ${celdas.length} casilleros`).toBe(
          celdas.length
        );

        // El casillero por completar queda marcado con «?» (como en pantalla).
        const casillero = /casillero/i.test(e.enunciado);
        expect(celdas.filter((c) => c === '?')).toHaveLength(casillero ? 1 : 0);
        const r = Number(e.respuesta);
        expect(Number.isInteger(r)).toBe(true);
        expect(r).toBeGreaterThan(0);

        // Con todos los casilleros dados (niveles 1 y 2) la suma es comprobable.
        if (nivel < 3 && celdas.every((c) => c !== '')) {
          const objetivo = Math.floor(celdas.indexOf('?') / n);
          // Fila de referencia sin hueco (todas las filas suman lo mismo);
          // el casillero a completar puede estar en cualquier fila.
          const ref = celdas.indexOf('?') < 0 ? 0 : (objetivo + 1) % n;
          const magico = celdas.slice(ref * n, (ref + 1) * n).reduce((s, v) => s + Number(v), 0);
          if (casillero) {
            // La fila del «?» suma lo mismo que la de referencia… poniendo la
            // respuesta en el hueco.
            const suma = celdas
              .slice(objetivo * n, (objetivo + 1) * n)
              .reduce((s, v) => s + (v === '?' ? r : Number(v)), 0);
            expect(suma).toBe(magico);
          } else {
            // Piden el número mágico: cualquier fila lo da.
            expect(magico).toBe(r);
          }
        }
      }
    }
  });

  // ── Tipos de cálculo puro (los juegos no dibujan figuras) ──

  it('comparaciones: el símbolo corresponde a los valores comparados', () => {
    for (const nivel of NIVELES) {
      for (const e of servicio.generar('comparaciones', nivel, 60)) {
        const m = e.enunciado.match(/^(.+?)\s+○\s+(.+)$/);
        expect(m, `enunciado inesperado: ${e.enunciado}`).not.toBeNull();
        const izq = evaluar(m![1]);
        const der = evaluar(m![2]);
        const esperado = izq > der ? '>' : izq < der ? '<' : '=';
        expect(e.respuesta).toBe(esperado);
      }
    }
  });

  it('pirámides: cada celda (mostrada o hueco) vale la suma de las dos de abajo', () => {
    for (const nivel of NIVELES) {
      for (const e of servicio.generar('piramides', nivel, 40)) {
        const textos = [...(e.imagen ?? '').matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map(
          (m) => m[1]
        );
        // La base mide lo mismo que las filas: 1 + 2 + … + filas celdas.
        // Los huecos (casilleros en blanco para escribir a mano) salen con
        // texto vacío, así que también cuentan como celda.
        const filas = Math.round((-1 + Math.sqrt(1 + 8 * textos.length)) / 2);
        expect(filas * (filas + 1) / 2).toBe(textos.length);

        // Valores resueltos de abajo hacia arriba: vacío = hueco = NaN.
        const celdas: string[][] = [];
        let pos = 0;
        for (let f = 0; f < filas; f++) {
          celdas.push(textos.slice(pos, pos + f + 1));
          pos += f + 1;
        }
        const resueltas: number[][] = celdas.map((fila) =>
          fila.map((c) => (c === '' || c.startsWith('?') ? NaN : Number(c)))
        );
        for (let f = filas - 2; f >= 0; f--) {
          for (let p = 0; p <= f; p++) {
            if (Number.isNaN(resueltas[f][p])) {
              resueltas[f][p] = resueltas[f + 1][p] + resueltas[f + 1][p + 1];
            }
          }
        }
        // Toda celda debe valer la suma de sus dos soportes.
        for (let f = 0; f < filas - 1; f++) {
          for (let p = 0; p <= f; p++) {
            expect(resueltas[f][p]).toBe(resueltas[f + 1][p] + resueltas[f + 1][p + 1]);
          }
        }
        // La hoja de respuestas lista cada hueco (en orden de lectura) con su valor.
        const huecos = celdas
          .flatMap((fila, f) => fila.map((c, p) => ({ c, f, p })))
          .filter(({ c }) => c === '' || c.startsWith('?'));
        expect(huecos.length).toBeGreaterThan(0);
        huecos.forEach(({ f, p }, idx) => {
          expect(e.respuesta).toContain(`${idx + 1} = ${resueltas[f][p]}`);
        });
      }
    }
  });
});
