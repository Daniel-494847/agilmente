// Relaciones y Analogías: banco de 75 ejercicios (25 por nivel) de razonamiento
// LÓGICO-MATEMÁTICO con dibujos SVG. No hay analogías verbales: todos los pares
// se relacionan con una regla matemática (suma, resta, multiplicación, división,
// potencias, raíces o el número de lados de una figura). Cada respuesta y cada
// explicación se CALCULAN a partir de los datos del ejercicio.
//
// El nivel Intermedio usa el formato clásico de la ficha de razonamiento: una
// GRILLA de 3 filas × 3 columnas donde cada fila es una analogía  A ( B ) C  con
// la MISMA operación. Dos filas van resueltas y en UNA de ellas hay que hallar el
// número que debe ir en el paréntesis (el «?» resaltado)
//
//        14 ( 28 ) 2        14 ( 28 ) 2        14 ( ?  ) 2
//        15 ( 45 ) 3        15 ( ?  ) 3        15 ( 45 ) 3
//        12 ( ?  ) 4        12 ( 48 ) 4        12 ( 48 ) 4
//
// El banco se exporta para que otros consumidores (p. ej. el Módulo Docente)
// reutilicen exactamente los mismos gráficos y enunciados.

export type Nivel = "basico" | "intermedio" | "avanzado";

// ================== Dibujo (trazos SVG) ==================
// Un trazo es una pieza del dibujo: línea (l), polígono (p), círculo (c) o texto (x)
export interface Trazo {
  t: "l" | "p" | "c" | "x";
  x1?: number; y1?: number; x2?: number; y2?: number; // línea
  pts?: string; // polígono
  cx?: number; cy?: number; r?: number; // círculo
  x?: number; y?: number; s?: string; size?: number; // texto
  fill?: string;
  stroke?: string;
}

const INK = "#212529";
const CAJA = "#e7f1ff";
const HUECO = "#fff3cd";
const RELLENO = "#dbe9ff";
const r1 = (n: number) => Math.round(n * 10) / 10;
const poligono = (p: number[][], fill = "none"): Trazo =>
  ({ t: "p", pts: p.map(q => `${r1(q[0])},${r1(q[1])}`).join(" "), fill, stroke: INK });
const texto = (x: number, y: number, s: string, size = 13, fill = INK): Trazo =>
  ({ t: "x", x: r1(x), y: r1(y), s, size, fill });

// El lienzo es FIJO (no se recorta al dibujo): así las figuras y las casillas
// conservan su tamaño y su posición dentro de la analogía.
const ANCHO = 428;
const ALTO = 120;

// Convierte los trazos en una imagen SVG (data URI) para el quiz.
// El ancho es fijo (las columnas de la analogía no se mueven), pero el ALTO crece
// con el contenido: las analogías de una sola fila conservan el lienzo original
// de 120 y la grilla de 3 filas del nivel Intermedio sale completa.
export function svgDe(trazos: Trazo[]): string {
  const fondo = trazos.reduce((max, t) => {
    if (t.t === "x") return Math.max(max, (t.y ?? 0) + (t.size ?? 20) / 2);
    if (t.t === "c") return Math.max(max, (t.cy ?? 0) + (t.r ?? 0));
    return Math.max(max, t.y1 ?? 0, t.y2 ?? 0);
  }, 0);
  const alto = Math.max(ALTO, Math.ceil(fondo + 14));
  const piezas = trazos.map(t => {
    if (t.t === "l") return `<line x1="${t.x1}" y1="${t.y1}" x2="${t.x2}" y2="${t.y2}" stroke="${t.stroke}" stroke-width="3" stroke-linecap="round"/>`;
    if (t.t === "p") return `<polygon points="${t.pts}" fill="${t.fill}" stroke="${t.stroke}" stroke-width="3" stroke-linejoin="round"/>`;
    if (t.t === "c") return `<circle cx="${t.cx}" cy="${t.cy}" r="${t.r}" fill="${t.fill}" stroke="${t.stroke}" stroke-width="3"/>`;
    return `<text x="${t.x}" y="${t.y}" text-anchor="middle" font-size="${t.size ?? 20}" font-weight="bold" font-family="sans-serif" fill="${t.fill}" stroke="#ffffff" stroke-width="4" paint-order="stroke">${t.s}</text>`;
  });
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${ANCHO} ${alto}">${piezas.join("")}</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

// Números pseudoaleatorios con semilla (las opciones siempre salen igual)
function rng(semilla: number) {
  let a = semilla >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function mezclar<T>(a: T[], r: () => number): T[] {
  const c = [...a];
  for (let k = c.length - 1; k > 0; k--) {
    const j = Math.floor(r() * (k + 1));
    [c[k], c[j]] = [c[j], c[k]];
  }
  return c;
}

// ================== Ítems y diagramas ==================
// Cada posición de la analogía es un número o una figura geométrica.
interface Figura { lados: number }
type Item = Figura | number;

const fig = (lados: number): Figura => ({ lados });
const NOMBRE: Record<number, string> = {
  3: "Triángulo", 4: "Cuadrado", 5: "Pentágono", 6: "Hexágono", 7: "Heptágono", 8: "Octágono",
};
const esFigura = (x: Item): x is Figura => typeof x !== "number";
const textoItem = (x: Item): string => (esFigura(x) ? NOMBRE[x.lados] ?? "Figura" : String(x));

const CENTROS = [46, 158, 270, 382];
const CENTRO_Y = 60;
const SEPARADORES = [102, 214, 326];
const SEPARADOR_Y = 68;

// Vértices de un polígono regular de `n` lados.
function puntos(n: number, cx: number, cy: number, r: number): number[][] {
  const salida: number[][] = [];
  for (let i = 0; i < n; i++) {
    const a = (-90 + (360 * i) / n) * (Math.PI / 180);
    salida.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return salida;
}

// Dibuja un ítem en la posición indicada: casilla (número) o figura.
function trazosItem(it: Item, cx: number, cy: number): Trazo[] {
  if (esFigura(it)) return [poligono(puntos(it.lados, cx, cy, 30), RELLENO)];
  const w = 62, h = 46, x = cx - w / 2, y = cy - h / 2;
  return [
    poligono([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], CAJA),
    texto(cx, cy + 6, String(it), 18),
  ];
}

// A : B ∴ C : ?
function filaAnalogia(a: Item, b: Item, c: Item): Trazo[] {
  const t: Trazo[] = [
    ...trazosItem(a, CENTROS[0], CENTRO_Y),
    ...trazosItem(b, CENTROS[1], CENTRO_Y),
    ...trazosItem(c, CENTROS[2], CENTRO_Y),
  ];
  const s = 62;
  t.push(poligono([
    [CENTROS[3] - s / 2, CENTRO_Y - s / 2], [CENTROS[3] + s / 2, CENTRO_Y - s / 2],
    [CENTROS[3] + s / 2, CENTRO_Y + s / 2], [CENTROS[3] - s / 2, CENTRO_Y + s / 2],
  ], HUECO), texto(CENTROS[3], CENTRO_Y + 8, "?", 26));
  t.push(texto(SEPARADORES[0], SEPARADOR_Y, ":", 24));
  t.push(texto(SEPARADORES[1], SEPARADOR_Y, "∴", 24));
  t.push(texto(SEPARADORES[2], SEPARADOR_Y, ":", 24));
  return t;
}

// ================== Tipos de los ejercicios ==================
export interface Ejercicio {
  id: string;
  nivel: Nivel;
  tema: string;
  pregunta: string;
  trazos: Trazo[];
  opciones: string[];
  correcta: string; // uno de los textos de opciones
  explicacion: string;
}

interface Base {
  tema: string;
  pregunta: string;
  trazos: Trazo[];
  opcionesTexto: string[];
  correctaTexto: string;
  explicacion: string;
}

// Analogía: la regla que lleva de `a` a `b` se repite de `c` a la respuesta `d`.
// `distractores` son tres respuestas falsas del mismo tipo que `d`.
function analogia(tema: string, a: Item, b: Item, c: Item, d: Item, distractores: Item[], explicacion: string): Base {
  const correcta = textoItem(d);
  return {
    tema,
    pregunta: esFigura(d) ? "¿Qué figura completa la analogía?" : "¿Qué número completa la analogía?",
    trazos: filaAnalogia(a, b, c),
    opcionesTexto: [correcta, ...distractores.map(textoItem)],
    correctaTexto: correcta,
    explicacion,
  };
}

// ================== Analogías con paréntesis (nivel Intermedio) ==================
// Formato clásico de la ficha de razonamiento lógico-matemático: una GRILLA de
// 3 filas × 3 columnas donde cada fila es una analogía  A ( B ) C  y las tres
// siguen la MISMA operación. Dos filas van resueltas y en UNA de ellas hay que
// descubrir el número del paréntesis, que se dibuja como «?» resaltada (el signo
// del número que debe ir ahí). Todo es lógico-matemático: solo números ligados
// por suma, resta, multiplicación o división (no hay analogías verbales ni de
// objetos).
const CENTROS_PAR = [70, 148, 214, 280, 358];
const Y_GRILLA = [72, 166, 260];

function grillaAnalogias(filas: { a: number; b?: number; c: number }[]): Trazo[] {
  const trazos: Trazo[] = [];
  filas.forEach((fila, i) => {
    const y = Y_GRILLA[i];
    trazos.push(
      texto(CENTROS_PAR[0], y, String(fila.a), 46),
      texto(CENTROS_PAR[1], y, "(", 60),
      fila.b === undefined
        ? texto(CENTROS_PAR[2], y, "?", 46, "#fd7e14")
        : texto(CENTROS_PAR[2], y, String(fila.b), 46),
      texto(CENTROS_PAR[3], y, ")", 60),
      texto(CENTROS_PAR[4], y, String(fila.c), 46),
    );
  });
  return trazos;
}

type Operacion = "suma" | "resta" | "multiplicacion" | "division";

// Operación que liga los dos extremos (A y C) con el número del centro (B).
const OPERACION: Record<Operacion, { calcular: (a: number, c: number) => number; signo: string }> = {
  suma: { calcular: (a, c) => a + c, signo: "+" },
  resta: { calcular: (a, c) => a - c, signo: "−" },
  multiplicacion: { calcular: (a, c) => a * c, signo: "×" },
  division: { calcular: (a, c) => a / c, signo: "÷" },
};

// Rangos de los extremos por operación (propios del nivel Intermedio).
const RANGOS: Record<Operacion, { a: [number, number]; c: [number, number] }> = {
  multiplicacion: { a: [11, 24], c: [2, 5] },
  suma: { a: [12, 46], c: [11, 38] },
  resta: { a: [34, 78], c: [12, 27] },
  division: { a: [9, 81], c: [3, 9] },
};

// Todos los pares (A, C) válidos de la operación: en la división solo los
// repartos exactos con cociente de una cifra. Sirven para armar las tres filas
// distintas de cada grilla sin sorteo ni reintentos.
function paresDe(op: Operacion): [number, number][] {
  const [amin, amax] = RANGOS[op].a;
  const [cmin, cmax] = RANGOS[op].c;
  const salida: [number, number][] = [];
  for (let a = amin; a <= amax; a++) {
    for (let c = cmin; c <= cmax; c++) {
      const b = OPERACION[op].calcular(a, c);
      const exacto = op !== "division" || (Number.isInteger(a / c) && a / c >= 3 && a / c <= 9);
      if (Number.isInteger(b) && b > 0 && a !== c && exacto) salida.push([a, c]);
    }
  }
  return salida;
}

// Tres respuestas falsas: primero las que salen de las OTRAS operaciones con los
// mismos extremos (las más didácticas: sumar en vez de multiplicar…), y luego
// valores cercanos a la respuesta correcta.
function opcionesFalsas(a: number, c: number, b: number, op: Operacion): number[] {
  const otras = (Object.keys(OPERACION) as Operacion[])
    .filter((o) => o !== op)
    .map((o) => OPERACION[o].calcular(a, c))
    .filter((v) => Number.isInteger(v) && v > 0 && v !== b)
    .filter((v) => Math.abs(v - b) <= Math.max(20, b * 3, 2 * Math.max(a, c) + 20))
    .sort((x, y) => Math.abs(x - b) - Math.abs(y - b))
    .slice(0, 2);
  const salida = [...otras];
  for (const paso of [1, -1, 2, -2, 3, -3, 5, -5, 10, -10]) {
    if (salida.length >= 3) break;
    const v = b + paso;
    if (v > 0 && !salida.includes(v)) salida.push(v);
  }
  return salida.slice(0, 3);
}

// Las 25 preguntas del nivel: cada una es una grilla 3 × 3 con tres analogías de
// la misma operación, dos resueltas y la «x» en una de las filas (se alterna).
// La respuesta (y su explicación) se CALCULAN de los dos extremos de esa fila.
function preguntasParentesis(): Base[] {
  const operaciones: Operacion[] = ["multiplicacion", "suma", "division", "resta"];
  const salida: Base[] = [];
  for (let i = 0; i < 25; i++) {
    const op = operaciones[i % operaciones.length];
    const r = rng(7000 + i * 13);
    const filas = mezclar(paresDe(op), r)
      .slice(0, 3)
      .map(([a, c]) => ({ a, b: OPERACION[op].calcular(a, c), c }));
    const hueco = i % filas.length; // la fila que hay que descubrir
    const { a, b, c } = filas[hueco];
    salida.push({
      tema: T_PAR,
      pregunta: "Completa la analogía: ¿qué número debe ir en el paréntesis?",
      trazos: grillaAnalogias(
        filas.map((f, k) => (k === hueco ? { a: f.a, c: f.c } : { a: f.a, b: f.b, c: f.c })),
      ),
      opcionesTexto: [String(b), ...opcionesFalsas(a, c, b, op).map(String)],
      correctaTexto: String(b),
      explicacion: `Las tres filas siguen la misma operación con los extremos: ${a} ${OPERACION[op].signo} ${c} = ${b}.`,
    });
  }
  return salida;
}

// ================== Armado de los tres niveles ==================
function armar(nivel: Nivel, bases: Base[]): Ejercicio[] {
  return bases.map((b, i) => {
    const r = rng(nivel.length * 1000 + i * 7 + 1);
    return {
      id: `${nivel}-${i + 1}`,
      nivel,
      tema: b.tema,
      pregunta: b.pregunta,
      trazos: b.trazos,
      opciones: mezclar([...new Set(b.opcionesTexto)], r),
      correcta: b.correctaTexto,
      explicacion: b.explicacion,
    };
  });
}

const T_NUM = "Analogías numéricas";
const T_FIG = "Analogías con figuras";
const T_PAR = "Analogías con paréntesis";

const BASICO = armar("basico", [
  // ── Números: la regla se repite en la segunda pareja ──
  analogia(T_NUM, 2, 4, 3, 6, [5, 8, 9], "La segunda pareja es el doble de la primera: 3 × 2 = 6."),
  analogia(T_NUM, 3, 6, 5, 10, [12, 15, 8], "La segunda pareja es el doble de la primera: 5 × 2 = 10."),
  analogia(T_NUM, 4, 8, 7, 14, [12, 16, 21], "La segunda pareja es el doble de la primera: 7 × 2 = 14."),
  analogia(T_NUM, 10, 20, 15, 30, [25, 35, 45], "La segunda pareja es el doble de la primera: 15 × 2 = 30."),
  analogia(T_NUM, 5, 8, 9, 12, [14, 11, 15], "A la primera pareja se le suman 3: 5 + 3 = 8 y 9 + 3 = 12."),
  analogia(T_NUM, 2, 5, 6, 9, [8, 12, 11], "A la primera pareja se le suman 3: 2 + 3 = 5 y 6 + 3 = 9."),
  analogia(T_NUM, 7, 10, 1, 4, [3, 7, 5], "A la primera pareja se le suman 3: 7 + 3 = 10 y 1 + 3 = 4."),
  analogia(T_NUM, 6, 18, 8, 24, [16, 26, 21], "La segunda pareja es el triple de la primera: 8 × 3 = 24."),
  analogia(T_NUM, 20, 19, 40, 39, [38, 41, 40], "A la primera pareja se le quita 1: 20 − 1 = 19 y 40 − 1 = 39."),
  analogia(T_NUM, 35, 30, 50, 45, [40, 55, 44], "A la primera pareja se le quitan 5: 35 − 5 = 30 y 50 − 5 = 45."),
  analogia(T_NUM, 9, 3, 12, 4, [5, 6, 36], "La segunda pareja es la primera dividida entre 3: 12 ÷ 3 = 4."),
  analogia(T_NUM, 8, 4, 20, 10, [8, 12, 5], "La segunda pareja es la mitad de la primera: 20 ÷ 2 = 10."),
  analogia(T_NUM, 1, 5, 4, 8, [9, 7, 12], "A la primera pareja se le suman 4: 1 + 4 = 5 y 4 + 4 = 8."),
  analogia(T_NUM, 6, 4, 9, 7, [6, 8, 5], "A la primera pareja se le quitan 2: 6 − 2 = 4 y 9 − 2 = 7."),
  analogia(T_NUM, 3, 9, 2, 6, [5, 8, 4], "La segunda pareja es el triple de la primera: 2 × 3 = 6."),
  analogia(T_NUM, 15, 5, 21, 7, [6, 8, 9], "La segunda pareja es la primera dividida entre 3: 21 ÷ 3 = 7."),
  analogia(T_NUM, 25, 50, 40, 80, [60, 70, 90], "La segunda pareja es el doble de la primera: 40 × 2 = 80."),
  analogia(T_NUM, 12, 2, 18, 3, [4, 5, 6], "La segunda pareja es la primera dividida entre 6: 18 ÷ 6 = 3."),

  // ── Figuras: el número de lados sigue una regla ──
  analogia(T_FIG, fig(3), fig(4), fig(5), fig(6), [fig(5), fig(4), fig(3)], "Cada figura gana un lado: triángulo (3) → cuadrado (4) y pentágono (5) → hexágono (6)."),
  analogia(T_FIG, fig(4), fig(5), fig(3), fig(4), [fig(6), fig(5), fig(3)], "Cada figura gana un lado: cuadrado (4) → pentágono (5) y triángulo (3) → cuadrado (4)."),
  analogia(T_FIG, fig(4), fig(3), fig(5), fig(4), [fig(5), fig(3), fig(6)], "Cada figura pierde un lado: cuadrado (4) → triángulo (3) y pentágono (5) → cuadrado (4)."),
  analogia(T_FIG, fig(6), fig(5), fig(5), fig(4), [fig(6), fig(3), fig(5)], "Cada figura pierde un lado: hexágono (6) → pentágono (5) y pentágono (5) → cuadrado (4)."),

  // ── Figuras y su número de lados ──
  analogia(T_FIG, fig(3), 3, fig(4), 4, [5, 6, 2], "A cada figura le corresponde su número de lados: el cuadrado tiene 4 lados."),
  analogia(T_FIG, fig(4), 4, fig(5), 5, [6, 3, 7], "A cada figura le corresponde su número de lados: el pentágono tiene 5 lados."),
  analogia(T_FIG, fig(5), 5, fig(6), 6, [7, 4, 5], "A cada figura le corresponde su número de lados: el hexágono tiene 6 lados."),
]);

const INTERMEDIO = armar("intermedio", preguntasParentesis());

const AVANZADO = armar("avanzado", [
  // ── Números con reglas compuestas ──
  analogia(T_NUM, 3, 7, 6, 13, [12, 14, 18], "El segundo es el primero por 2 más 1: 3 × 2 + 1 = 7 y 6 × 2 + 1 = 13."),
  analogia(T_NUM, 4, 17, 5, 26, [25, 20, 30], "El segundo es el primero por sí mismo más 1: 4 × 4 + 1 = 17 y 5 × 5 + 1 = 26."),
  analogia(T_NUM, 2, 8, 5, 17, [15, 20, 12], "El segundo es el primero por 3 más 2: 2 × 3 + 2 = 8 y 5 × 3 + 2 = 17."),
  analogia(T_NUM, 5, 24, 7, 48, [49, 42, 36], "El segundo es el primero por sí mismo menos 1: 5 × 5 − 1 = 24 y 7 × 7 − 1 = 48."),
  analogia(T_NUM, 4, 11, 6, 17, [18, 12, 15], "El segundo es el primero por 3 menos 1: 4 × 3 − 1 = 11 y 6 × 3 − 1 = 17."),
  analogia(T_NUM, 3, 12, 5, 30, [25, 20, 35], "El segundo es el primero por el siguiente: 3 × 4 = 12 y 5 × 6 = 30."),
  analogia(T_NUM, 20, 80, 35, 65, [55, 75, 60], "El segundo es 100 menos el primero: 100 − 20 = 80 y 100 − 35 = 65."),
  analogia(T_NUM, 10, 10, 20, 15, [12, 25, 18], "El segundo es la mitad del primero más 5: 10 ÷ 2 + 5 = 10 y 20 ÷ 2 + 5 = 15."),
  analogia(T_NUM, 7, 11, 10, 17, [13, 20, 23], "El segundo es el primero por 2 menos 3: 7 × 2 − 3 = 11 y 10 × 2 − 3 = 17."),
  analogia(T_NUM, 2, 4, 5, 25, [10, 20, 30], "El segundo es el primero multiplicado por sí mismo: 2 × 2 = 4 y 5 × 5 = 25."),
  analogia(T_NUM, 3, 27, 2, 8, [6, 9, 16], "El segundo es el primero al cubo: 3 × 3 × 3 = 27 y 2 × 2 × 2 = 8."),
  analogia(T_NUM, 9, 3, 25, 5, [4, 6, 12], "El segundo es la raíz cuadrada del primero: 3 × 3 = 9 y 5 × 5 = 25."),
  analogia(T_NUM, 6, 21, 4, 15, [12, 18, 24], "El segundo es el primero por 3 más 3: 6 × 3 + 3 = 21 y 4 × 3 + 3 = 15."),
  analogia(T_NUM, 8, 4, 18, 9, [6, 12, 36], "El segundo es la mitad del primero: 8 ÷ 2 = 4 y 18 ÷ 2 = 9."),
  analogia(T_NUM, 5, 30, 3, 18, [12, 21, 24], "El segundo es el primero multiplicado por 6: 5 × 6 = 30 y 3 × 6 = 18."),
  analogia(T_NUM, 1, 2, 9, 18, [10, 16, 20], "El segundo es el doble del primero: 1 × 2 = 2 y 9 × 2 = 18."),
  analogia(T_NUM, 4, 13, 6, 19, [18, 21, 15], "El segundo es el primero por 3 más 1: 4 × 3 + 1 = 13 y 6 × 3 + 1 = 19."),
  analogia(T_NUM, 7, 20, 5, 14, [15, 12, 16], "El segundo es el primero por 3 menos 1: 7 × 3 − 1 = 20 y 5 × 3 − 1 = 14."),

  // ── Figuras: lados ──
  analogia(T_FIG, fig(3), fig(6), fig(4), fig(7), [fig(6), fig(5), fig(8)], "Cada figura gana tres lados: triángulo (3) → hexágono (6) y cuadrado (4) → heptágono (7)."),
  analogia(T_FIG, fig(6), fig(3), fig(7), fig(4), [fig(5), fig(6), fig(3)], "Cada figura pierde tres lados: hexágono (6) → triángulo (3) y heptágono (7) → cuadrado (4)."),
  analogia(T_FIG, fig(6), fig(4), fig(8), fig(6), [fig(5), fig(7), fig(4)], "Cada figura pierde dos lados: hexágono (6) → cuadrado (4) y octágono (8) → hexágono (6)."),
  analogia(T_FIG, fig(5), fig(7), fig(6), fig(8), [fig(7), fig(4), fig(5)], "Cada figura gana dos lados: pentágono (5) → heptágono (7) y hexágono (6) → octágono (8)."),

  // ── Figuras y números (potencias y múltiplos de los lados) ──
  analogia(T_FIG, fig(4), 16, fig(3), 9, [12, 6, 3], "El número es el cuadrado de los lados: el triángulo tiene 3 lados y 3 × 3 = 9."),
  analogia(T_FIG, fig(3), 9, fig(5), 25, [20, 10, 15], "El número es el cuadrado de los lados: el pentágono tiene 5 lados y 5 × 5 = 25."),
  analogia(T_FIG, fig(6), 18, fig(3), 9, [12, 6, 15], "El número es el triple de los lados: el triángulo tiene 3 lados y 3 × 3 = 9."),
]);

export const EJERCICIOS: Record<Nivel, Ejercicio[]> = {
  basico: BASICO,
  intermedio: INTERMEDIO,
  avanzado: AVANZADO,
};
