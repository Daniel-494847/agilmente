

// ====================== GENERADOR DE CUADRADOS MÁGICOS ======================
// En un cuadrado mágico, todas las filas, columnas y diagonales suman lo mismo
// (el número mágico). Cada nivel crea 25 ejercicios al azar, sin repetir, con
// retroalimentación paso a paso (solo con sumas, restas y una división).

export const CANTIDAD = 25; // ejercicios por nivel
export const PUNTOS: Record<number, number> = { 1: 10, 2: 15, 3: 20 };

export interface Celda { t: string; c: string } // texto y clases de Bootstrap
export type Meta = [number, number] | 'S'; // un casillero, o el número mágico

export interface Cuadrado {
  oculto: Celda[][];   // lo que se ve al jugar
  completo: Celda[][]; // el cuadrado resuelto (se muestra al responder)
  lineas: [number, number][][]; // filas/columnas/diagonales que se trazan como pista
  cabecera: string;    // qué se dice del número mágico
  pregunta: string;
  opciones: number[];
  correcta: number;
  texto: string;
  pasos: string[];
}

// Utilidades
export const azar = (a: number, b: number) => Math.floor(Math.random() * (b - a + 1)) + a;
export const mezclar = <T>(l: T[]) => [...l].sort(() => Math.random() - 0.5);
export const suma = (l: number[]) => l.reduce((s, x) => s + x, 0);

// Opciones: la correcta + 3 falsas. "extras" son errores típicos (se usan primero)
export function opcionesCerca(c: number, extras: number[] = []): number[] {
  const set = new Set<number>([c]);
  for (const v of mezclar(extras)) {
    if (set.size < 4 && Number.isInteger(v) && v >= 0) set.add(v);
  }
  let k = 1;
  while (set.size < 4) {
    const v = c + azar(1, Math.max(3, Math.ceil(c * 0.3))) * (Math.random() < 0.5 ? -1 : 1);
    set.add(v >= 0 ? v : c + k++);
  }
  return mezclar([...set]);
}

// ---------------------- CUADRADOS COMPLETOS ----------------------

// Gira 90° y/o refleja un cuadrado (sigue siendo mágico)
export function transformar(v: number[][]): number[][] {
  let m = v.map((f) => [...f]);
  for (let i = azar(0, 3); i > 0; i--) m = m[0].map((_, j) => m.map((f) => f[j]).reverse());
  if (Math.random() < 0.5) m = m.map((f) => [...f].reverse());
  return m;
}

// Orden 3: con centro c y dos números libres p y q salen TODOS los cuadrados mágicos 3×3
export function cuadrado3(rango: [number, number]): number[][] {
  for (;;) {
    const c = azar(rango[0], rango[1]), p = azar(1, c - 1), q = azar(1, c - 1);
    const v = [
      [c + p, c - p - q, c + q],
      [c - p + q, c, c + p - q],
      [c - q, c + p + q, c - p],
    ];
    const todos = v.flat();
    if (todos.every((x) => x >= 1) && new Set(todos).size === 9) return transformar(v);
  }
}

// Orden 4: el cuadrado de Durero (suma 34), girado y con un número sumado a todos
export function cuadrado4(): number[][] {
  const base = [[16, 3, 2, 13], [5, 10, 11, 8], [9, 6, 7, 12], [4, 15, 14, 1]];
  const k = azar(0, 12);
  return transformar(base.map((f) => f.map((x) => x + k)));
}

// Las filas, columnas y diagonales de un cuadrado de orden n
export function lineas(n: number): { nombre: string; celdas: [number, number][] }[] {
  const idx = Array.from({ length: n }, (_, i) => i);
  return [
    ...idx.map((i) => ({ nombre: `Fila ${i + 1}`, celdas: idx.map((j) => [i, j] as [number, number]) })),
    ...idx.map((j) => ({ nombre: `Columna ${j + 1}`, celdas: idx.map((i) => [i, j] as [number, number]) })),
    { nombre: 'Diagonal ↘', celdas: idx.map((i) => [i, i] as [number, number]) },
    { nombre: 'Diagonal ↙', celdas: idx.map((i) => [i, n - 1 - i] as [number, number]) },
  ];
}

// Las líneas que conviene sumar para resolver el ejercicio, usadas como pista visual.
export function lineasPista(dados: boolean[][], meta: Meta): [number, number][][] {
  const ls = lineas(dados.length);
  if (meta !== 'S') {
    const [r, c] = meta;
    return ls.filter((l) => l.celdas.some(([a, b]) => a === r && b === c)).map((l) => l.celdas);
  }
  const completa = ls.find((l) => l.celdas.every(([a, b]) => dados[a][b]));
  return completa ? [completa.celdas] : [];
}

// ---------------------- DIBUJO (clases de Bootstrap) ----------------------

export function celdasDe(v: number[][], dados: boolean[][], meta: Meta | null, revelar: boolean): Celda[][] {
  return v.map((fila, r) =>
    fila.map((x, c) => {
      if (meta && meta !== 'S' && meta[0] === r && meta[1] === c) {
        return revelar
          ? { t: String(x), c: 'bg-success border-success text-white' }
          : { t: '?', c: 'bg-warning-subtle border-warning text-warning-emphasis' };
      }
      if (dados[r][c]) return { t: String(x), c: 'bg-body border-success text-success-emphasis' };
      return revelar
        ? { t: String(x), c: 'bg-success-subtle border-success-subtle text-success-emphasis' }
        : { t: '', c: 'bg-body-tertiary border-secondary-subtle' };
    })
  );
}

// ---------------------- RESOLVER COMO UNA PERSONA ----------------------
export function resolver(v: number[][], dados: boolean[][], sDada: boolean, meta: Meta): string[] | null {
  const n = v.length, S = suma(v[0]);
  const sabe: (number | null)[][] = v.map((f, r) => f.map((x, c) => (dados[r][c] ? x : null)));
  let s: number | null = sDada ? S : null;
  const razon = new Map<string, { paso: string; deps: string[] }>();
  const k = (r: number, c: number) => `${r},${c}`;
  const ls = lineas(n);
  const centro = (n - 1) / 2;

  let cambio = true;
  while (cambio) {
    cambio = false;
    if (s === null) {
      for (const l of ls) {
        const vals = l.celdas.map(([r, c]) => sabe[r][c]);
        if (vals.every((x) => x !== null)) {
          s = suma(vals as number[]);
          razon.set('S', { paso: `${l.nombre}: ${vals.join(' + ')} = ${s}`, deps: l.celdas.map(([r, c]) => k(r, c)) });
          cambio = true;
          break;
        }
      }
      if (s === null && n === 3 && sabe[1][1] !== null) {
        s = 3 * (sabe[1][1] as number);
        razon.set('S', { paso: `Número mágico = 3 × centro = 3 × ${sabe[1][1]} = ${s}`, deps: [k(1, 1)] });
        cambio = true;
      }
    }
    if (s !== null) {
      for (const l of ls) {
        const vacios = l.celdas.filter(([r, c]) => sabe[r][c] === null);
        if (vacios.length !== 1) continue;
        const conocidos = l.celdas.filter(([r, c]) => sabe[r][c] !== null);
        const vals = conocidos.map(([r, c]) => sabe[r][c] as number);
        const [r, c] = vacios[0];
        sabe[r][c] = s - suma(vals);
        razon.set(k(r, c), {
          paso: `${l.nombre}: ${s} − (${vals.join(' + ')}) = ${sabe[r][c]}`,
          deps: ['S', ...conocidos.map(([a, b]) => k(a, b))]
        });
        cambio = true;
      }
      if (n === 3 && sabe[centro][centro] === null) {
        sabe[1][1] = s / 3;
        razon.set(k(1, 1), { paso: `Centro = ${s} ÷ 3 = ${s / 3}`, deps: ['S'] });
        cambio = true;
      }
    }
  }

  const clave = meta === 'S' ? 'S' : k(meta[0], meta[1]);
  if (meta === 'S' ? s === null : sabe[meta[0]][meta[1]] === null) return null;

  const pasos: string[] = [];
  const visto = new Set<string>();
  const visitar = (c: string) => {
    if (visto.has(c)) return;
    visto.add(c);
    const rz = razon.get(c);
    if (!rz) return;
    rz.deps.forEach(visitar);
    pasos.push(rz.paso);
  };
  visitar(clave);
  return pasos;
}

// ---------------------- RECETAS POR NIVEL ----------------------

export interface Receta {
  n: 3 | 4;
  vacios: [number, number];
  objetivo: 'celda' | 'suma';
  sDada: boolean;
  minPasos: number;
  c?: [number, number];
}

export const RECETAS: Record<number, Receta[]> = {
  1: [
    { n: 3, vacios: [1, 1], objetivo: 'celda', sDada: true, minPasos: 1, c: [5, 12] },
    { n: 3, vacios: [1, 1], objetivo: 'celda', sDada: false, minPasos: 2, c: [5, 12] },
    { n: 3, vacios: [0, 1], objetivo: 'suma', sDada: false, minPasos: 1, c: [5, 12] },
  ],
  2: [
    { n: 3, vacios: [2, 3], objetivo: 'celda', sDada: true, minPasos: 2, c: [8, 25] },
    { n: 3, vacios: [2, 3], objetivo: 'celda', sDada: false, minPasos: 3, c: [8, 25] },
    { n: 3, vacios: [2, 3], objetivo: 'suma', sDada: false, minPasos: 1, c: [8, 25] },
  ],
  3: [
    { n: 3, vacios: [4, 5], objetivo: 'celda', sDada: false, minPasos: 3, c: [10, 40] },
    { n: 3, vacios: [4, 5], objetivo: 'suma', sDada: false, minPasos: 1, c: [10, 40] },
    { n: 4, vacios: [2, 4], objetivo: 'celda', sDada: true, minPasos: 2 },
    { n: 4, vacios: [2, 4], objetivo: 'suma', sDada: false, minPasos: 1 },
  ],
};

export function crearCuadrado(rc: Receta): Cuadrado | null {
  const v = rc.n === 3 ? cuadrado3(rc.c!) : cuadrado4();
  const S = suma(v[0]);
  const todas: [number, number][] = [];
  v.forEach((f, r) => f.forEach((_, c) => todas.push([r, c])));

  for (let intento = 0; intento < 80; intento++) {
    const k = azar(rc.vacios[0], rc.vacios[1]);
    const vacias = mezclar(todas).slice(0, k);
    const dados = v.map((f) => f.map(() => true));
    vacias.forEach(([r, c]) => (dados[r][c] = false));

    let meta: Meta;
    if (rc.objetivo === 'celda') {
      if (k === 0) continue;
      meta = vacias[0];
    } else {
      meta = 'S';
    }
    const pasos = resolver(v, dados, rc.sDada, meta);
    if (!pasos || pasos.length < rc.minPasos) continue;

    const resp = meta === 'S' ? S : v[meta[0]][meta[1]];
    const vistos = [...new Set(todas.filter(([r, c]) => dados[r][c]).map(([r, c]) => v[r][c]))];
    return {
      oculto: celdasDe(v, dados, meta, false),
      completo: celdasDe(v, dados, meta, true),
      lineas: lineasPista(dados, meta),
      cabecera: rc.sDada ? `Número mágico = ${S}` : rc.objetivo === 'suma' ? 'Número mágico = ?' : 'El número mágico no se indica',
      pregunta: rc.objetivo === 'suma' ? '¿Cuál es el número mágico?' : '¿Qué número va en el casillero marcado (?)',
      opciones: opcionesCerca(resp, [resp + 1, resp - 1, resp + 2, resp - 2, ...vistos.slice(0, 3)]),
      correcta: resp,
      texto: 'En un cuadrado mágico, todas las filas, columnas y diagonales suman lo mismo: ese es el número mágico.'
        + (rc.n === 3 ? ' En los de orden 3, además, el número mágico es 3 veces el número del centro.' : ''),
      pasos,
    };
  }
  return null;
}

export function crearNivel(nivel: number): Cuadrado[] {
  const recetas = RECETAS[nivel];
  const vistos = new Set<string>();
  const lista: Cuadrado[] = [];
  for (let i = 0; i < 800 && lista.length < CANTIDAD; i++) {
    const q = crearCuadrado(recetas[lista.length % recetas.length]);
    if (!q) continue;
    const clave = JSON.stringify(q.oculto) + q.pregunta + q.cabecera;
    if (vistos.has(clave)) continue;
    vistos.add(clave);
    lista.push(q);
  }
  return mezclar(lista);
}

