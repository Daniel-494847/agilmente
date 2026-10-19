import { Component, OnDestroy, OnInit, inject, signal } from "@angular/core";
import { Router } from "@angular/router";
import { AttemptsService } from "@core/services/attempts.service";
import { GameUiService } from "@core/services/game-ui.service";
import { Quiz } from "@shared/components/quiz/quiz";
import {
  ConfiguracionQuiz,
  PreguntaQuiz,
  QuizViewModel,
  TipoPregunta,
} from "@shared/components/quiz/quiz.model";

// Operadores Matemáticos: 25 ejercicios por nivel con gráficos SVG (banco
// compartido por la actividad y el Módulo Docente).
// Cada operador se define con su regla escrita (por ejemplo "2a + b"); el MISMO texto se dibuja
// en el cuadro y se usa para calcular, así que la respuesta y la explicación siempre coinciden.

// ================== Dibujo (trazos SVG) ==================
export type Nivel = "basico" | "intermedio" | "avanzado";

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

export const INK = "#212529";
export const GRIS = "#6c757d";
export const CAJA = "#e7f1ff";
export const HUECO = "#fff3cd";
export const r1 = (n: number) => Math.round(n * 10) / 10;
export const poligono = (p: number[][], fill = "none"): Trazo =>
  ({ t: "p", pts: p.map(q => `${r1(q[0])},${r1(q[1])}`).join(" "), fill, stroke: INK });
export const texto = (x: number, y: number, s: string, size = 13, fill = INK): Trazo =>
  ({ t: "x", x: r1(x), y: r1(y), s, size, fill });
export const caja = (x: number, y: number, w: number, h: number, fill: string): Trazo =>
  poligono([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], fill);

// Números pseudoaleatorios con semilla (cada ejercicio siempre se ve igual)
export function rng(semilla: number) {
  let a = semilla >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Convierte los trazos en una imagen SVG (data URI) para el quiz.
// Sin fondo propio (se pinta sobre el del tema) y con trazo/etiqueta más grandes:
// en móvil la figura se reduce y a 13px las medidas no se leían.
export function svgDe(trazos: Trazo[]): string {
  const piezas = trazos.map(t => {
    if (t.t === "l") return `<line x1="${t.x1}" y1="${t.y1}" x2="${t.x2}" y2="${t.y2}" stroke="${t.stroke}" stroke-width="3" stroke-linecap="round"/>`;
    if (t.t === "p") return `<polygon points="${t.pts}" fill="${t.fill}" stroke="${t.stroke}" stroke-width="3" stroke-linejoin="round"/>`;
    if (t.t === "c") return `<circle cx="${t.cx}" cy="${t.cy}" r="${t.r}" fill="${t.fill}" stroke="${t.stroke}" stroke-width="3"/>`;
    return `<text x="${t.x}" y="${t.y}" text-anchor="middle" font-size="${t.size ?? 20}" font-weight="bold" font-family="sans-serif" fill="${t.fill}" stroke="#ffffff" stroke-width="4" paint-order="stroke">${t.s}</text>`;
  });
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 200">${piezas.join("")}</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

// ================== Tipos de los ejercicios ==================
export interface Ejercicio {
  id: string;
  nivel: Nivel;
  tema: string;
  pregunta: string;
  trazos: Trazo[];
  opciones: string[];
  correcta: string;
  explicacion: string;
}

export interface Base {
  tema: string;
  pregunta: string;
  trazos: Trazo[];
  explicacion: string;
  valor: number;
  paso: number; // separación de las opciones cercanas
  trampas?: number[]; // errores típicos
  min?: number; // menor opción permitida (por defecto 1)
  verif?: { exs: number[][]; q: number[] }; // @verif (solo para pruebas)
}

export const pasoPara = (v: number) => (v < 20 ? 1 : v < 60 ? 2 : v < 200 ? 5 : v < 800 ? 20 : 50);

// ================== Reglas escritas como texto ==================
// "2a + b" se dibuja tal cual y también se calcula: admite + − × ( ) ², letras como variables y
// multiplicación implícita (2a = 2 × a)
export function tokenizar(s: string): string[] {
  return s.replace(/-/g, "−").match(/\d+|[a-z]|[+−×()²]/g) ?? [];
}
export const esOperando = (x?: string) => x !== undefined && (/^\d+$/.test(x) || /^[a-z]$/.test(x) || x === "(");

export function evalRhs(rhs: string, env: Record<string, number>): number {
  const t = tokenizar(rhs);
  let i = 0;
  const atomo = (): number => {
    const x = t[i++];
    let v: number;
    if (x === "(") { v = expr(); i++; } else v = /^\d+$/.test(x) ? Number(x) : env[x];
    if (t[i] === "²") { i++; v = v * v; }
    return v;
  };
  const termino = (): number => {
    let v = atomo();
    while (t[i] === "×" || esOperando(t[i])) { if (t[i] === "×") i++; v *= atomo(); }
    return v;
  };
  const expr = (): number => {
    let v = termino();
    while (t[i] === "+" || t[i] === "−") { const o = t[i++]; const w = termino(); v = o === "+" ? v + w : v - w; }
    return v;
  };
  return expr();
}

// Escribe la regla con los números ya puestos: "2a + b" con a = 3 y b = 4 → "2 × 3 + 4"
export function sust(rhs: string, env: Record<string, number>): string {
  const t = tokenizar(rhs);
  const out: string[] = [];
  t.forEach((x, i) => {
    const antes = t[i - 1];
    const terminaOperando = antes !== undefined && (/^\d+$/.test(antes) || /^[a-z]$/.test(antes) || antes === ")" || antes === "²");
    if (terminaOperando && esOperando(x)) out.push("×");
    out.push(/^[a-z]$/.test(x) ? String(env[x]) : x);
  });
  return out.join(" ").replace(/\( /g, "(").replace(/ \)/g, ")").replace(/ ²/g, "²");
}

// Un operador: símbolo, regla y líneas que se muestran en el cuadro
export interface Op { sim: string; rhs: string; f: (a: number, b: number) => number; lineas: string[]; expl?: (a: number, b: number) => string }
export const op = (sim: string, rhs: string): Op => ({ sim, rhs, f: (a, b) => evalRhs(rhs, { a, b }), lineas: [`a ${sim} b = ${rhs}`] });

// ================== Gráficos ==================
// Fila de símbolos centrada: números, símbolos, "?" (cuadro amarillo)
export function fila(tokens: string[], y: number, tam = 26): Trazo[] {
  const ancho = (t: string, k: number) =>
    t === "?" ? k * 1.7 : t === "(" || t === ")" ? k * 0.55 : /^\d+$/.test(t) ? t.length * k * 0.62 + 6 : k * 0.95;
  let k = tam;
  const total = (z: number) => tokens.reduce((a, t) => a + ancho(t, z), 0) + (tokens.length - 1) * 6;
  if (total(k) > 272) k = Math.max(14, (k * 272) / total(k));
  let x = 150 - total(k) / 2;
  const out: Trazo[] = [];
  tokens.forEach(t => {
    const w = ancho(t, k), cx = x + w / 2;
    if (t === "?") out.push(caja(x, y - k * 0.8, w, k * 1.6, HUECO), texto(cx, y + k * 0.35, "?", k));
    else out.push(texto(cx, y + k * 0.35, t, k));
    x += w + 6;
  });
  return out;
}

// Cuadro con la definición del operador y, debajo, la operación por resolver
export function conDefinicion(lineas: string[], tokens: string[]): Trazo[] {
  const alto = lineas.length * 32 + 16;
  const t: Trazo[] = [caja(18, 12, 264, alto, "#f8f9fa")];
  lineas.forEach((l, i) => t.push(texto(150, 12 + 30 + i * 32, l, l.length > 26 ? 15 : 18)));
  t.push(...fila(tokens, Math.max(12 + alto + 55, 135), 28));
  return t;
}

// Tabla de doble entrada del operador (fila = primer número, columna = segundo número)
export function dibujarTabla(E: number[], f: (a: number, b: number) => number, sim: string): Trazo[] {
  const n = E.length, cw = 44, ch = 32, x0 = (300 - (n + 1) * cw) / 2, y0 = (200 - (n + 1) * ch) / 2;
  const t: Trazo[] = [];
  for (let r = 0; r <= n; r++) for (let c = 0; c <= n; c++) {
    const x = x0 + c * cw, y = y0 + r * ch;
    const cab = r === 0 || c === 0;
    t.push(caja(x, y, cw, ch, cab ? CAJA : "#ffffff"));
    const s = r === 0 && c === 0 ? sim : r === 0 ? String(E[c - 1]) : c === 0 ? String(E[r - 1]) : String(f(E[r - 1], E[c - 1]));
    t.push(texto(x + cw / 2, y + 22, s, 16));
  }
  return t;
}

// Tres triángulos: abajo a la izquierda (a), abajo a la derecha (b) y arriba el resultado
export function dibujarTriangulos(trios: (number | string)[][]): Trazo[] {
  const xs = [52, 150, 248];
  const t: Trazo[] = [];
  trios.forEach(([a, b, c], i) => {
    const cx = xs[i], top = 32, bot = 172, hw = 46;
    t.push(poligono([[cx, top], [cx - hw, bot], [cx + hw, bot]], "#e7f1ff"));
    if (c === "?") t.push(caja(cx - 15, top + 56, 30, 30, HUECO), texto(cx, top + 78, "?", 20));
    else t.push(texto(cx, top + 78, String(c), 20));
    t.push(texto(cx - 27, bot - 10, String(a), 18), texto(cx + 27, bot - 10, String(b), 18));
  });
  return t;
}

// ================== Constructores de ejercicios ==================
// Aplicar la regla escrita en el cuadro
export function aplicar(o: Op, a: number, b: number): Base {
  const v = o.f(a, b);
  return {
    tema: "Operadores con fórmula", pregunta: `Con la regla del cuadro, ¿cuánto vale ${a} ${o.sim} ${b}?`,
    trazos: conDefinicion(o.lineas, [String(a), o.sim, String(b), "=", "?"]), valor: v, paso: pasoPara(v), trampas: [o.f(b, a)],
    explicacion: o.expl ? o.expl(a, b) : `Se reemplaza a = ${a} y b = ${b} en ${o.rhs}: ${sust(o.rhs, { a, b })} = ${v}.`,
  };
}

// Operador de una sola variable: Δ(n) = ...
export function unaVariable(sim: string, rhs: string, n: number): Base {
  const v = evalRhs(rhs, { n });
  return {
    tema: "Operadores con fórmula", pregunta: `Con la regla del cuadro, ¿cuánto vale ${sim}(${n})?`,
    trazos: conDefinicion([`${sim}(n) = ${rhs}`], [sim, "(", String(n), ")", "=", "?"]), valor: v, paso: pasoPara(v), trampas: [n * 2],
    explicacion: `Se reemplaza n = ${n} en ${rhs}: ${sust(rhs, { n })} = ${v}.`,
  };
}

// Operador que se descubre con ejemplos
export function ejemplos(o: Op, exs: number[][], q: number[]): Base {
  const lineas = [...exs.map(([a, b]) => [String(a), o.sim, String(b), "=", String(o.f(a, b))]), [String(q[0]), o.sim, String(q[1]), "=", "?"]];
  const y0 = 100 - ((lineas.length - 1) * 38) / 2 + 8;
  const t: Trazo[] = [texto(150, 22, "El operador es el mismo en todas las líneas", 12, GRIS)];
  lineas.forEach((l, i) => t.push(...fila(l, y0 + i * 38, 26)));
  const [a, b] = exs[0], v = o.f(q[0], q[1]);
  return {
    tema: "Descubrir el operador", pregunta: "Descubre la regla del operador con los ejemplos. ¿Qué número va en el cuadro amarillo?", trazos: t,
    valor: v, paso: pasoPara(v), trampas: [o.f(q[1], q[0])],
    explicacion: `La regla es a ${o.sim} b = ${o.rhs}. Se comprueba: ${a} ${o.sim} ${b} = ${sust(o.rhs, { a, b })} = ${o.f(a, b)}. Entonces ${q[0]} ${o.sim} ${q[1]} = ${sust(o.rhs, { a: q[0], b: q[1] })} = ${v}.`,
    verif: { exs, q }, // @verif
  };
}

// Triángulos: arriba va el resultado de operar los dos números de abajo
export function triangulos(o: Op, exs: number[][], q: number[]): Base {
  const trios: (number | string)[][] = [...exs.map(([a, b]) => [a, b, o.f(a, b)]), [q[0], q[1], "?"]];
  const [a, b] = exs[0], v = o.f(q[0], q[1]);
  return {
    tema: "Triángulos con operador", pregunta: "En cada triángulo, el número de arriba sale de operar los dos de abajo con la misma regla. ¿Qué número falta?",
    trazos: dibujarTriangulos(trios), valor: v, paso: pasoPara(v), trampas: [o.f(q[1], q[0])],
    explicacion: `La regla es: arriba = ${o.rhs} (a es el número de abajo a la izquierda y b el de abajo a la derecha). Se comprueba: ${sust(o.rhs, { a, b })} = ${o.f(a, b)}. Entonces: ${sust(o.rhs, { a: q[0], b: q[1] })} = ${v}.`,
    verif: { exs, q }, // @verif
  };
}

// Operaciones con paréntesis (de adentro hacia afuera, de izquierda a derecha)
export function reducir(tk: string[], ops: Record<string, Op>) {
  const t = [...tk];
  const pasos: string[] = [];
  const calc = (seg: string[]) => {
    let v = Number(seg[0]);
    for (let k = 1; k < seg.length; k += 2) {
      const r = ops[seg[k]].f(v, Number(seg[k + 1]));
      pasos.push(`${v} ${seg[k]} ${seg[k + 1]} = ${r}`);
      v = r;
    }
    return v;
  };
  while (t.includes("(")) {
    const c = t.indexOf(")"), a = t.lastIndexOf("(", c);
    t.splice(a, c - a + 1, String(calc(t.slice(a + 1, c))));
  }
  return { valor: calc(t), pasos };
}

export function anidado(operadores: Op[], tokens: string[]): Base {
  const ops: Record<string, Op> = {};
  operadores.forEach(o => (ops[o.sim] = o));
  const { valor, pasos } = reducir(tokens, ops);
  return {
    tema: "Operaciones anidadas", pregunta: `Con ${operadores.length > 1 ? "las reglas" : "la regla"} del cuadro, ¿cuánto vale la operación?`,
    trazos: conDefinicion(operadores.flatMap(o => o.lineas), [...tokens, "=", "?"]), valor, paso: pasoPara(valor),
    explicacion: `Se resuelve de adentro hacia afuera: ${pasos.join(", luego ")}.`,
  };
}

// Hallar el número que falta: a ★ x = resultado (x en la posición indicada)
export function inversa(o: Op, conocido: number, res: number, lado: "der" | "izq"): Base {
  const sol: number[] = [];
  for (let x = 0; x <= 100; x++) if ((lado === "der" ? o.f(conocido, x) : o.f(x, conocido)) === res) sol.push(x);
  if (sol.length !== 1) throw new Error("la ecuación no tiene una sola solución");
  const x = sol[0];
  const [a, b] = lado === "der" ? [conocido, x] : [x, conocido];
  return {
    tema: "Hallar un número", pregunta: `Con la regla del cuadro, ¿qué valor de x cumple ${lado === "der" ? `${conocido} ${o.sim} x` : `x ${o.sim} ${conocido}`} = ${res}?`,
    trazos: conDefinicion(o.lineas, lado === "der" ? [String(conocido), o.sim, "x", "=", String(res)] : ["x", o.sim, String(conocido), "=", String(res)]),
    valor: x, paso: pasoPara(x), trampas: [res - conocido, res + conocido],
    explicacion: `Se prueba qué número da ${res}: con x = ${x}, ${a} ${o.sim} ${b} = ${sust(o.rhs, { a, b })} = ${res}. Por eso x = ${x}.`,
  };
}

// Operador definido por casos
export function condicional(o: Op, a: number, b: number): Base {
  const v = o.f(a, b);
  return {
    tema: "Operador por casos", pregunta: `Con la regla del cuadro, ¿cuánto vale ${a} ${o.sim} ${b}?`,
    trazos: conDefinicion(o.lineas, [String(a), o.sim, String(b), "=", "?"]), valor: v, paso: pasoPara(v), trampas: [o.f(b, a)],
    explicacion: o.expl!(a, b),
  };
}

// --- Tablas de doble entrada ---
export const textoTabla = "En la tabla, el primer número se busca en la fila y el segundo en la columna.";

export function tablaBuscar(E: number[], f: (a: number, b: number) => number, sim: string, a: number, b: number): Base {
  const v = f(a, b);
  return {
    tema: "Operador en tabla", pregunta: `${textoTabla} ¿Cuánto vale ${a} ${sim} ${b}?`, trazos: dibujarTabla(E, f, sim), valor: v, paso: pasoPara(v), trampas: [f(b, a)],
    explicacion: `Se busca la fila del ${a} y la columna del ${b}: ${a} ${sim} ${b} = ${v}.`,
  };
}

export function tablaDoble(E: number[], f: (a: number, b: number) => number, sim: string, tokens: string[]): Base {
  const ops: Record<string, Op> = { [sim]: { sim, rhs: "", f, lineas: [] } };
  const { valor, pasos } = reducir(tokens, ops);
  return {
    tema: "Operador en tabla", pregunta: `${textoTabla} ¿Cuánto vale ${tokens.join(" ").replace(/\( /g, "(").replace(/ \)/g, ")")}?`, trazos: dibujarTabla(E, f, sim),
    valor, paso: pasoPara(valor), explicacion: `Se resuelve de adentro hacia afuera, leyendo cada resultado en la tabla: ${pasos.join(", luego ")}.`,
  };
}

export function tablaIncognita(E: number[], f: (a: number, b: number) => number, sim: string, conocido: number, res: number, lado: "der" | "izq"): Base {
  const sol = E.filter(x => (lado === "der" ? f(conocido, x) : f(x, conocido)) === res);
  if (sol.length !== 1) throw new Error("la tabla no tiene una sola solución");
  const x = sol[0];
  return {
    tema: "Operador en tabla", pregunta: `${textoTabla} ¿Qué valor de x cumple ${lado === "der" ? `${conocido} ${sim} x` : `x ${sim} ${conocido}`} = ${res}?`,
    trazos: dibujarTabla(E, f, sim), valor: x, paso: 1, trampas: [res],
    explicacion: lado === "der" ? `En la fila del ${conocido} se busca el ${res}; está en la columna del ${x}.` : `En la columna del ${conocido} se busca el ${res}; está en la fila del ${x}.`,
  };
}

export function tablaNeutro(E: number[], f: (a: number, b: number) => number, sim: string): Base {
  const e = E.filter(c => E.every(x => f(c, x) === x && f(x, c) === x));
  if (e.length !== 1) throw new Error("no hay un único elemento neutro");
  return {
    tema: "Elemento neutro", pregunta: `¿Cuál es el elemento neutro de ${sim} (el que, al operarlo con cualquier otro, lo deja igual)?`, trazos: dibujarTabla(E, f, sim),
    valor: e[0], paso: 1, min: 0, trampas: [E[E.length - 1]],
    explicacion: `La fila y la columna del ${e[0]} repiten los números de los encabezados, así que ${e[0]} ${sim} x = x y x ${sim} ${e[0]} = x.`,
  };
}

// Operaciones de las tablas (cerradas: el resultado siempre está en la tabla)
export const ciclica = (n: number) => (a: number, b: number) => ((a + b - 2) % n) + 1;
export const modulo5 = (a: number, b: number) => (a * b) % 5;

// ================== Armado de los tres niveles ==================
export function armar(nivel: Nivel, bases: Base[]): Ejercicio[] {
  return bases.map((b, i) => {
    const r = rng(nivel.length * 1000 + i);
    const lo = b.min ?? 1;
    const set = new Set<number>([b.valor]);
    (b.trampas ?? []).forEach(t => { if (t >= lo && t <= 2 * b.valor + 12 && Number.isInteger(t) && set.size < 4) set.add(t); });
    const cand = [-3, -2, -1, 1, 2, 3].map(d => b.valor + d * b.paso).filter(v => v >= lo);
    for (let k = cand.length - 1; k > 0; k--) { const j = Math.floor(r() * (k + 1)); [cand[k], cand[j]] = [cand[j], cand[k]]; }
    cand.forEach(v => { if (set.size < 4) set.add(v); });
    const opciones = [...set].sort((x, y) => x - y).map(String);
    return { id: `${nivel}-${i + 1}`, nivel, tema: b.tema, pregunta: b.pregunta, trazos: b.trazos, opciones, correcta: String(b.valor), explicacion: b.explicacion };
  });
}

export const BASICO = armar("basico", [
  // aplicar la regla del cuadro
  aplicar(op("★", "a + b + 1"), 3, 4), aplicar(op("♦", "2a + b"), 3, 4), aplicar(op("⊕", "a × b − 1"), 5, 3), aplicar(op("★", "a + 2b"), 4, 3),
  aplicar(op("♦", "3a − b"), 6, 4), aplicar(op("⊕", "a × b + a"), 4, 5), aplicar(op("⊗", "2a + 3b"), 2, 5), aplicar(op("★", "a + b + a × b"), 2, 3),
  // operador de una variable
  unaVariable("Δ", "2n + 3", 5), unaVariable("Ω", "n² − 1", 6), unaVariable("Δ", "3n − 4", 7),
  // leer una tabla
  tablaBuscar([1, 2, 3, 4], (a, b) => a + b - 1, "★", 3, 2), tablaBuscar([1, 2, 3], (a, b) => a * b, "♦", 3, 2),
  tablaBuscar([1, 2, 3, 4], (a, b) => Math.abs(a - b), "⊕", 4, 1), tablaBuscar([2, 4, 6], (a, b) => a + b, "⊗", 6, 4),
  // descubrir la regla con ejemplos
  ejemplos(op("★", "2a + b"), [[1, 2], [3, 1]], [4, 3]), ejemplos(op("♦", "a + 3b"), [[2, 1], [4, 2]], [3, 3]),
  ejemplos(op("⊕", "a × b + 1"), [[2, 3], [4, 2]], [5, 3]), ejemplos(op("⊗", "3a − b"), [[4, 2], [5, 1]], [6, 3]),
  ejemplos(op("★", "a + b + 2"), [[1, 1], [3, 2]], [5, 4]),
  // triángulos
  triangulos(op("", "a + b"), [[3, 4], [5, 6]], [8, 2]), triangulos(op("", "a × b"), [[2, 3], [4, 5]], [3, 6]),
  triangulos(op("", "a + b + 1"), [[2, 3], [4, 4]], [5, 6]), triangulos(op("", "2a + b"), [[1, 2], [3, 2]], [4, 5]),
  triangulos(op("", "a × b − 1"), [[3, 4], [2, 5]], [6, 3]),
]);

export const INTERMEDIO = armar("intermedio", [
  // fórmulas con cuadrados y productos
  aplicar(op("★", "a² + b"), 4, 3), aplicar(op("♦", "a² + 2b"), 5, 3), aplicar(op("⊕", "a × b + 2a"), 4, 5),
  aplicar(op("⊗", "(a + b)²"), 3, 4), aplicar(op("★", "a × (a + b)"), 3, 4),
  // fórmulas con paréntesis
  aplicar(op("♦", "(a + b) × (a − b)"), 9, 5), aplicar(op("⊕", "a × b − (a + b)"), 6, 4), aplicar(op("⊗", "(a + 2b) × (b − 1)"), 3, 4),
  // operaciones anidadas
  anidado([op("★", "a + 2b")], ["(", "2", "★", "3", ")", "★", "1"]),
  anidado([op("♦", "a × b − 1")], ["(", "3", "♦", "2", ")", "♦", "4"]),
  anidado([op("⊕", "2a + b")], ["1", "⊕", "(", "2", "⊕", "3", ")"]),
  anidado([op("★", "a² − b")], ["(", "3", "★", "2", ")", "★", "4"]),
  // hallar el número que falta
  inversa(op("★", "2a + b"), 5, 17, "der"), inversa(op("♦", "a × b − 3"), 4, 21, "izq"), inversa(op("⊕", "a + 2b"), 3, 15, "der"),
  // tablas
  tablaDoble([1, 2, 3, 4], ciclica(4), "★", ["(", "2", "★", "3", ")", "★", "4"]),
  tablaDoble([1, 2, 3, 4], modulo5, "♦", ["(", "2", "♦", "3", ")", "♦", "4"]),
  tablaIncognita([1, 2, 3, 4], (a, b) => a + b - 1, "⊕", 3, 5, "der"),
  tablaIncognita([1, 2, 3, 4], (a, b) => a * b, "⊗", 3, 9, "izq"),
  // descubrir la regla con ejemplos
  ejemplos(op("★", "a² + b"), [[2, 1], [3, 2]], [4, 3]), ejemplos(op("♦", "a × b + 2a"), [[2, 3], [3, 2]], [4, 5]), ejemplos(op("⊕", "3a + 2b"), [[1, 2], [2, 1]], [4, 3]),
  // triángulos
  triangulos(op("", "a² + b"), [[3, 2], [4, 1]], [5, 3]), triangulos(op("", "a + b²"), [[2, 3], [5, 2]], [4, 4]), triangulos(op("", "2a + 3b"), [[1, 1], [2, 3]], [4, 2]),
]);

export const AVANZADO = armar("avanzado", [
  // fórmulas más largas
  aplicar(op("★", "a² + b² + 2ab"), 3, 2), aplicar(op("♦", "(a + b)² − a × b"), 4, 3),
  aplicar(op("⊕", "a² − 2ab + b²"), 7, 3), aplicar(op("⊗", "(a − b) × (a + b) + a"), 8, 3),
  // operaciones anidadas con uno o dos operadores
  anidado([op("★", "2a − b"), op("♦", "a × b + 1")], ["(", "5", "★", "3", ")", "♦", "4"]),
  anidado([op("★", "a + b + 1"), op("⊕", "a × b")], ["(", "2", "★", "3", ")", "⊕", "(", "1", "★", "2", ")"]),
  anidado([op("♦", "a² − b")], ["(", "3", "♦", "1", ")", "♦", "2"]),
  anidado([op("⊕", "a + 2b")], ["(", "(", "1", "⊕", "2", ")", "⊕", "3", ")", "⊕", "4"]),
  anidado([op("★", "a × b − a")], ["2", "★", "(", "3", "★", "4", ")"]),
  // hallar el número que falta
  inversa(op("★", "a² + b"), 3, 28, "izq"), inversa(op("♦", "a × b + a"), 4, 24, "der"),
  inversa(op("⊕", "(a + b)²"), 3, 64, "der"), inversa(op("★", "2a × b − a"), 3, 15, "izq"),
  // tablas
  tablaNeutro([1, 2, 3, 4], (a, b) => Math.max(a, b), "★"), tablaNeutro([2, 3, 4, 5], (a, b) => a + b - 2, "♦"),
  tablaIncognita([1, 2, 3, 4], modulo5, "⊕", 3, 2, "izq"),
  tablaDoble([1, 2, 3, 4], ciclica(4), "⊗", ["(", "2", "⊗", "3", ")", "⊗", "(", "4", "⊗", "1", ")"]),
  // descubrir la regla con más ejemplos
  ejemplos(op("♦", "2a + b²"), [[1, 2], [3, 1], [2, 3]], [4, 2]), ejemplos(op("⊕", "a × b − b"), [[3, 2], [4, 3], [5, 4]], [6, 5]),
  // triángulos
  triangulos(op("", "a × b − a − b"), [[3, 4], [4, 5]], [5, 6]), triangulos(op("", "a² + b²"), [[1, 2], [2, 3]], [3, 4]),
  // operadores definidos por casos
  condicional(casos1(), 3, 5), condicional(casos1(), 8, 3), condicional(casos2(), 6, 4), condicional(casos2(), 7, 2),
]);

// Operadores con dos casos
export function casos1(): Op {
  return {
    sim: "★", rhs: "", lineas: ["a ★ b = a + b   si a > b", "a ★ b = a × b   si a ≤ b"],
    f: (a, b) => (a > b ? a + b : a * b),
    expl: (a, b) => `Como ${a} ${a > b ? ">" : "≤"} ${b}, se usa ${a > b ? "a + b" : "a × b"}: ${a} ${a > b ? "+" : "×"} ${b} = ${a > b ? a + b : a * b}.`,
  };
}
export function casos2(): Op {
  return {
    sim: "♦", rhs: "", lineas: ["a ♦ b = 2a − b   si a es par", "a ♦ b = a + b   si a es impar"],
    f: (a, b) => (a % 2 === 0 ? 2 * a - b : a + b),
    expl: (a, b) => `Como ${a} es ${a % 2 === 0 ? "par" : "impar"}, se usa ${a % 2 === 0 ? "2a − b" : "a + b"}: ${a % 2 === 0 ? `2 × ${a} − ${b}` : `${a} + ${b}`} = ${a % 2 === 0 ? 2 * a - b : a + b}.`,
  };
}

export const EJERCICIOS: Record<Nivel, Ejercicio[]> = {
  basico: BASICO,
  intermedio: INTERMEDIO,
  avanzado: AVANZADO,
};

// ================== Componente ==================