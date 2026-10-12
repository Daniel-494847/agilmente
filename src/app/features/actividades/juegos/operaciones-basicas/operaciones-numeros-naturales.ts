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

// Operaciones Básicas (un solo archivo): 25 desafíos por nivel con gráficos SVG.
// Cada respuesta y cada explicación se CALCULAN con las mismas cuentas que muestra el dibujo.

// ================== Dibujo (trazos SVG) ==================
type Nivel = "basico" | "intermedio" | "avanzado";

// Un trazo es una pieza del dibujo: línea (l), polígono (p), círculo (c) o texto (x)
interface Trazo {
  t: "l" | "p" | "c" | "x";
  x1?: number; y1?: number; x2?: number; y2?: number; // línea
  pts?: string; // polígono
  cx?: number; cy?: number; r?: number; // círculo
  x?: number; y?: number; s?: string; size?: number; // texto
  fill?: string;
  stroke?: string;
}

const INK = "#212529";
const GRIS = "#6c757d";
const CAJA = "#e7f1ff";
const HUECO = "#fff3cd";
const r1 = (n: number) => Math.round(n * 10) / 10;
const linea = (x1: number, y1: number, x2: number, y2: number): Trazo =>
  ({ t: "l", x1: r1(x1), y1: r1(y1), x2: r1(x2), y2: r1(y2), stroke: INK });
const poligono = (p: number[][], fill = "none"): Trazo =>
  ({ t: "p", pts: p.map(q => `${r1(q[0])},${r1(q[1])}`).join(" "), fill, stroke: INK });
const circulo = (cx: number, cy: number, r: number, fill: string): Trazo =>
  ({ t: "c", cx: r1(cx), cy: r1(cy), r, fill, stroke: INK });
const texto = (x: number, y: number, s: string, size = 13, fill = INK): Trazo =>
  ({ t: "x", x: r1(x), y: r1(y), s, size, fill });
const caja = (x: number, y: number, w: number, h: number, fill: string): Trazo =>
  poligono([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], fill);

// Números pseudoaleatorios con semilla (cada ejercicio siempre se ve igual)
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

// Convierte los trazos en una imagen SVG (data URI) para el quiz.
// Sin fondo propio (se pinta sobre el del tema) y con trazo/etiqueta más grandes:
// en móvil la figura se reduce y a 13px el texto no se leía.
function svgDe(trazos: Trazo[]): string {
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
interface Ejercicio {
  id: string;
  nivel: Nivel;
  tema: string;
  pregunta: string;
  trazos: Trazo[];
  opciones: string[];
  correcta: string;
  explicacion: string;
}

interface Base {
  tema: string;
  pregunta: string;
  trazos: Trazo[];
  explicacion: string;
  valor: number;
  paso: number; // separación de las opciones cercanas
  trampas?: number[]; // errores típicos
  min?: number; // menor opción permitida (por defecto 1)
  max?: number; // mayor opción permitida (por defecto sin límite)
}

const pasoPara = (v: number) => (v < 20 ? 1 : v < 60 ? 2 : v < 200 ? 5 : v < 800 ? 20 : 50);

// ================== Fórmulas y expresiones ==================
// Evalúa una expresión con paréntesis y prioridad de × sobre + y − (los símbolos pueden ser figuras con valor)
function evaluar(tokens: string[], vals: Record<string, number> = {}): number {
  let i = 0;
  const factor = (): number => {
    const t = tokens[i++];
    if (t === "(") { const v = suma(); i++; return v; }
    return t in vals ? vals[t] : Number(t);
  };
  const producto = (): number => { let v = factor(); while (tokens[i] === "×") { i++; v *= factor(); } return v; };
  const suma = (): number => {
    let v = producto();
    while (tokens[i] === "+" || tokens[i] === "−") { const o = tokens[i++]; const w = producto(); v = o === "+" ? v + w : v - w; }
    return v;
  };
  return suma();
}

// Error típico: resolver de izquierda a derecha, sin prioridad ni paréntesis
function alReves(tokens: string[], vals: Record<string, number> = {}): number {
  const t = tokens.filter(x => x !== "(" && x !== ")");
  let v = t[0] in vals ? vals[t[0]] : Number(t[0]);
  for (let i = 1; i < t.length; i += 2) {
    const w = t[i + 1] in vals ? vals[t[i + 1]] : Number(t[i + 1]);
    v = t[i] === "+" ? v + w : t[i] === "−" ? v - w : v * w;
  }
  return v;
}

// ================== Gráficos ==================
// Fila de símbolos centrada: números, operadores, "?" (cuadro amarillo) y figuras (@c círculo, @t triángulo, @s cuadrado)
function fila(tokens: string[], y: number, tam = 26): Trazo[] {
  const ancho = (t: string, k: number) =>
    t === "?" ? k * 1.7 : t.startsWith("@") ? k * 1.1 : t === "(" || t === ")" ? k * 0.55 : /^\d+$/.test(t) ? t.length * k * 0.62 + 6 : k * 0.95;
  let k = tam;
  const total = (z: number) => tokens.reduce((a, t) => a + ancho(t, z), 0) + (tokens.length - 1) * 6;
  if (total(k) > 272) k = Math.max(14, (k * 272) / total(k));
  let x = 150 - total(k) / 2;
  const out: Trazo[] = [];
  tokens.forEach(t => {
    const w = ancho(t, k), cx = x + w / 2;
    if (t === "?") out.push(caja(x, y - k * 0.8, w, k * 1.6, HUECO), texto(cx, y + k * 0.35, "?", k));
    else if (t === "@c") out.push(circulo(cx, y, k * 0.5, "#cfe2ff"));
    else if (t === "@t") out.push(poligono([[cx, y - k * 0.55], [cx - k * 0.55, y + k * 0.45], [cx + k * 0.55, y + k * 0.45]], "#f8d7da"));
    else if (t === "@s") out.push(caja(cx - k * 0.45, y - k * 0.45, k * 0.9, k * 0.9, "#d1e7dd"));
    else out.push(texto(cx, y + k * 0.35, t, k));
    x += w + 6;
  });
  return out;
}

// Cuenta en columna (suma, resta o multiplicación) con un dígito oculto
function dibujarColumna(op: string, a: number, b: number, r: number, en: "a" | "b" | "r", pos: number): Trazo[] {
  const sa = String(a), sb = String(b), sr = String(r);
  const L = Math.max(sa.length, sb.length, sr.length);
  const w = 34, g = 4;
  const x0 = (300 - (L * w + (L - 1) * g)) / 2 + 14;
  const t: Trazo[] = [];
  const numero = (s: string, y: number, oculto: number) => {
    [...s].forEach((d, i) => {
      const x = x0 + (L - s.length + i) * (w + g);
      t.push(caja(x, y, w, 38, i === oculto ? HUECO : CAJA), texto(x + w / 2, y + 27, i === oculto ? "?" : d, 22));
    });
  };
  numero(sa, 12, en === "a" ? pos : -1);
  numero(sb, 58, en === "b" ? pos : -1);
  t.push(texto(x0 - 22, 87, op, 30), linea(x0 - 8, 106, x0 + L * (w + g), 106));
  numero(sr, 116, en === "r" ? pos : -1);
  return t;
}

// Máquina de operaciones: el número pasa por cada paso en orden
function dibujarMaquina(ent: string, pasos: [string, number][], sal: string): Trazo[] {
  const elementos = [ent, ...pasos.map(([o, n]) => `${o}${n}`), sal];
  const tam = elementos.map((_, i) => (i === 0 || i === elementos.length - 1 ? 46 : 40));
  const gap = 15, total = tam.reduce((a, b) => a + b, 0) + gap * (elementos.length - 1);
  let x = 150 - total / 2;
  const t: Trazo[] = [];
  elementos.forEach((e, i) => {
    const w = tam[i], cx = x + w / 2;
    if (i === 0 || i === elementos.length - 1) t.push(caja(x, 78, w, 44, e === "?" ? HUECO : CAJA), texto(cx, 106, e, 20));
    else t.push(circulo(cx, 100, 20, "#d1e7dd"), texto(cx, 106, e, 16));
    if (i < elementos.length - 1) {
      const ax = x + w + 2, bx = x + w + gap - 2;
      t.push(linea(ax, 100, bx, 100), linea(bx, 100, bx - 5, 96), linea(bx, 100, bx - 5, 104));
    }
    x += w + gap;
  });
  t.push(texto(150, 160, "En orden, de izquierda a derecha", 11, GRIS));
  return t;
}

// Recta numérica con saltos iguales
function dibujarRecta(inicio: number, delta: number, saltos: number): Trazo[] {
  const vals = Array.from({ length: saltos + 1 }, (_, i) => inicio + i * delta);
  const mn = Math.min(...vals), mx = Math.max(...vals);
  const X = (v: number) => 30 + ((v - mn) / (mx - mn || 1)) * 240;
  const t: Trazo[] = [linea(14, 130, 286, 130)];
  vals.forEach((v, i) => {
    t.push(linea(X(v), 124, X(v), 136), texto(X(v), 154, i === saltos ? "?" : String(v), i === saltos ? 20 : 14));
    if (i < saltos) {
      const xm = (X(v) + X(vals[i + 1])) / 2;
      t.push(linea(X(v), 126, xm, 92), linea(xm, 92, X(vals[i + 1]), 126), texto(xm, 84, `${delta > 0 ? "+" : "−"}${Math.abs(delta)}`, 14, "#0d6efd"));
    }
  });
  t.push(circulo(X(vals[0]), 130, 4, "#0d6efd"));
  return t;
}

// ================== Constructores de ejercicios ==================
// Cuenta en columna con un dígito oculto: en = en cuál número (a, b o resultado), pos = qué dígito (desde la izquierda)
function columna(op: "+" | "−" | "×", a: number, b: number, en: "a" | "b" | "r", pos: number): Base {
  const r = op === "+" ? a + b : op === "−" ? a - b : a * b;
  const s = String(en === "a" ? a : en === "b" ? b : r);
  const d = Number(s[pos]);
  const inversa: Record<string, Record<string, string>> = {
    "+": { r: `${a} + ${b} = ${r}`, a: `${r} − ${b} = ${a}`, b: `${r} − ${a} = ${b}` },
    "−": { r: `${a} − ${b} = ${r}`, a: `${r} + ${b} = ${a}`, b: `${a} − ${r} = ${b}` },
    "×": { r: `${a} × ${b} = ${r}`, a: `${r} ÷ ${b} = ${a}`, b: `${r} ÷ ${a} = ${b}` },
  };
  return {
    tema: op === "+" ? "Suma en columna" : op === "−" ? "Resta en columna" : "Multiplicación en columna",
    pregunta: "¿Qué dígito va en el cuadro amarillo para que la cuenta esté bien hecha?",
    trazos: dibujarColumna(op, a, b, r, en, pos), valor: d, paso: 1, trampas: [d + 1, d - 1], min: 0, max: 9,
    explicacion: (en === "r" ? `Se hace la cuenta completa: ${inversa[op][en]}.` : `Se averigua el número completo con la operación contraria: ${inversa[op][en]}.`) + ` El dígito que faltaba es ${d}.`,
  };
}

// Ecuación con un cuadro por descubrir
function ecuacion(tipo: "sumaIz" | "restaIz" | "restaDer" | "prodIz" | "prodDer", a: number, c: number): Base {
  const T: Record<string, { tokens: string[]; x: number; expl: string; trampa: number }> = {
    sumaIz: { tokens: ["?", "+", String(a), "=", String(c)], x: c - a, expl: `Para quitar el + ${a} se resta: ${c} − ${a} = ${c - a}.`, trampa: c + a },
    restaIz: { tokens: ["?", "−", String(a), "=", String(c)], x: c + a, expl: `Para deshacer el − ${a} se suma: ${c} + ${a} = ${c + a}.`, trampa: c - a },
    restaDer: { tokens: [String(a), "−", "?", "=", String(c)], x: a - c, expl: `Lo que se restó es la diferencia entre ${a} y ${c}: ${a} − ${c} = ${a - c}.`, trampa: a + c },
    prodIz: { tokens: ["?", "×", String(a), "=", String(c)], x: c / a, expl: `Para deshacer el × ${a} se divide: ${c} ÷ ${a} = ${c / a}.`, trampa: c - a },
    prodDer: { tokens: [String(a), "×", "?", "=", String(c)], x: c / a, expl: `Se busca qué número multiplicado por ${a} da ${c}: ${c} ÷ ${a} = ${c / a}.`, trampa: c - a },
  };
  const e = T[tipo];
  return { tema: "Ecuaciones", pregunta: "¿Qué número va en el cuadro amarillo?", trazos: fila(e.tokens, 100), valor: e.x, paso: pasoPara(e.x), trampas: [e.trampa], explicacion: e.expl };
}

// Puntos en filas y columnas
function arreglo(filas: number, cols: number): Base {
  const d = 22, x0 = 150 - ((cols - 1) * d) / 2, y0 = 100 - ((filas - 1) * d) / 2;
  const t: Trazo[] = [];
  for (let i = 0; i < filas; i++) for (let j = 0; j < cols; j++) t.push(circulo(x0 + j * d, y0 + i * d, 8, "#0d6efd"));
  const v = filas * cols;
  return {
    tema: "Multiplicación", pregunta: `En la figura hay ${filas} filas con ${cols} puntos cada una. ¿Cuántos puntos hay en total?`, trazos: t,
    valor: v, paso: pasoPara(v), trampas: [filas + cols],
    explicacion: `${filas} filas de ${cols}: ${Array(filas).fill(cols).join(" + ")} = ${filas} × ${cols} = ${v}.`,
  };
}

// Bolsas con la misma cantidad de puntos
function grupos(n: number, k: number): Base {
  const porFila = Math.min(n, 4), filas = Math.ceil(n / porFila), bw = 58, bh = 62, gap = 12;
  const x0 = 150 - (porFila * bw + (porFila - 1) * gap) / 2, y0 = 100 - (filas * bh + (filas - 1) * gap) / 2;
  const t: Trazo[] = [];
  for (let b = 0; b < n; b++) {
    const bx = x0 + (b % porFila) * (bw + gap), by = y0 + Math.floor(b / porFila) * (bh + gap);
    t.push(caja(bx, by, bw, bh, "#fff3cd"));
    const rowsDots = Math.ceil(k / 2);
    for (let i = 0; i < k; i++) t.push(circulo(bx + bw / 2 + (i % 2 === 0 ? -10 : 10), by + bh / 2 + (Math.floor(i / 2) - (rowsDots - 1) / 2) * 16, 5.5, "#0d6efd"));
  }
  const v = n * k;
  return {
    tema: "Multiplicación", pregunta: `Hay ${n} bolsas con ${k} puntos cada una. ¿Cuántos puntos hay en total?`, trazos: t,
    valor: v, paso: pasoPara(v), trampas: [n + k],
    explicacion: `${n} bolsas de ${k}: ${Array(n).fill(k).join(" + ")} = ${n} × ${k} = ${v}.`,
  };
}

// Saltos en la recta numérica
function recta(inicio: number, delta: number, saltos: number): Base {
  const final = inicio + delta * saltos;
  const camino = Array.from({ length: saltos + 1 }, (_, i) => inicio + i * delta).join(", ");
  return {
    tema: "Recta numérica", pregunta: `Se empieza en ${inicio} y se dan ${saltos} saltos de ${Math.abs(delta)} ${delta > 0 ? "hacia la derecha (sumando)" : "hacia la izquierda (restando)"}. ¿En qué número se termina?`,
    trazos: dibujarRecta(inicio, delta, saltos), valor: final, paso: pasoPara(final), trampas: [inicio + Math.abs(delta) * saltos, inicio + delta * (saltos - 1)],
    explicacion: `Los saltos llegan a: ${camino}. También: ${inicio} ${delta > 0 ? "+" : "−"} ${saltos} × ${Math.abs(delta)} = ${final}.`,
  };
}

// Tabla de multiplicar con una casilla por descubrir (hr = fila, hc = columna)
function tablaMult(cols: number[], filas: number[], hr: number, hc: number): Base {
  const cw = 52, ch = 34, x0 = (300 - 4 * cw) / 2, y0 = (200 - 4 * ch) / 2;
  const t: Trazo[] = [];
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
    const x = x0 + c * cw, y = y0 + r * ch;
    const cab = r === 0 || c === 0;
    const esHueco = r - 1 === hr && c - 1 === hc;
    t.push(caja(x, y, cw, ch, esHueco ? HUECO : cab ? CAJA : "#ffffff"));
    const s = r === 0 && c === 0 ? "×" : r === 0 ? String(cols[c - 1]) : c === 0 ? String(filas[r - 1]) : esHueco ? "?" : String(filas[r - 1] * cols[c - 1]);
    t.push(texto(x + cw / 2, y + 24, s, 18));
  }
  const v = filas[hr] * cols[hc];
  return {
    tema: "Tabla de multiplicar", pregunta: "Cada casilla es el producto del número de su fila por el de su columna. ¿Qué número va en el cuadro amarillo?", trazos: t,
    valor: v, paso: pasoPara(v), trampas: [filas[hr] + cols[hc]],
    explicacion: `Se multiplica el número de la fila por el de la columna: ${filas[hr]} × ${cols[hc]} = ${v}.`,
  };
}

// Máquina de operaciones: pide el número que sale o el que entró
function maquina(inicio: number, pasos: [string, number][], pide: "final" | "inicio"): Base {
  const vs = [inicio];
  pasos.forEach(([o, n]) => { const p = vs[vs.length - 1]; vs.push(o === "+" ? p + n : o === "−" ? p - n : p * n); });
  const final = vs[vs.length - 1];
  const inv: Record<string, string> = { "+": "−", "−": "+", "×": "÷" };
  const adelante = pasos.map(([o, n], i) => `${vs[i]} ${o} ${n} = ${vs[i + 1]}`).join(", luego ");
  const atras = pasos.map(([o, n], i) => `${vs[i + 1]} ${inv[o]} ${n} = ${vs[i]}`).reverse().join(", luego ");
  if (pide === "final")
    return { tema: "Máquina de operaciones", pregunta: "El número entra a la máquina y pasa por cada operación en orden. ¿Qué número sale?", trazos: dibujarMaquina(String(inicio), pasos, "?"),
      valor: final, paso: pasoPara(final), trampas: [pasos.reduce((a, [o, n]) => (o === "+" ? a + n : o === "−" ? a - n : a * n), inicio) + pasos[0][1]], explicacion: `Se sigue el camino: ${adelante}.` };
  return { tema: "Máquina de operaciones", pregunta: "Entró un número a la máquina y salió el que se muestra. ¿Qué número entró?", trazos: dibujarMaquina("?", pasos, String(final)),
    valor: inicio, paso: pasoPara(inicio), trampas: [final - pasos[0][1]], explicacion: `Se recorre la máquina al revés con las operaciones contrarias: ${atras}.` };
}

// Operación combinada: se aplica la prioridad (paréntesis, ×, y luego + y −)
function jerarquia(tokens: string[], explicacion: string): Base {
  const v = evaluar(tokens);
  return {
    tema: "Operaciones combinadas", pregunta: "¿Cuánto vale la operación? (Primero los paréntesis, luego las multiplicaciones y al final las sumas y restas.)",
    trazos: fila([...tokens, "=", "?"], 100, 24), valor: v, paso: pasoPara(v), trampas: [alReves(tokens)], explicacion,
  };
}

// Tabla con totales por fila y por columna; falta un número de adentro
function tablaTotales(m: number[][], hr: number, hc: number): Base {
  const cw = 62, ch = 34, x0 = (300 - 4 * cw) / 2, y0 = (200 - 4 * ch) / 2;
  const totF = m.map(f => f.reduce((a, b) => a + b, 0));
  const totC = [0, 1, 2].map(c => m.reduce((a, f) => a + f[c], 0));
  const gran = totF.reduce((a, b) => a + b, 0);
  const t: Trazo[] = [];
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
    const esTotal = r === 3 || c === 3;
    const esHueco = r === hr && c === hc;
    const x = x0 + c * cw, y = y0 + r * ch;
    const val = r < 3 && c < 3 ? m[r][c] : r < 3 ? totF[r] : c < 3 ? totC[c] : gran;
    t.push(caja(x, y, cw, ch, esHueco ? HUECO : esTotal ? CAJA : "#ffffff"), texto(x + cw / 2, y + 24, esHueco ? "?" : String(val), 18));
  }
  const v = m[hr][hc];
  const otros = m[hr].filter((_, c) => c !== hc);
  return {
    tema: "Tabla de totales", pregunta: "La última columna suma cada fila y la última fila suma cada columna. ¿Qué número va en el cuadro amarillo?", trazos: t,
    valor: v, paso: pasoPara(v), trampas: [totF[hr] - otros[0], totF[hr] + otros[0]],
    explicacion: `La fila suma ${totF[hr]}. Se restan los números que se ven: ${totF[hr]} − ${otros[0]} − ${otros[1]} = ${v}.`,
  };
}

// Figuras con valor: cada figura vale siempre lo mismo
const SIMB: Record<string, string> = { c: "●", t: "▲", s: "■" };
function figuras(vals: Record<string, number>, filas: string[][], consulta: string[]): Base {
  const ficha = (tk: string[]) => tk.map(x => (x in SIMB ? "@" + x : x));
  const filasT = filas.map(f => [...ficha(f), "=", String(evaluar(f, vals))]);
  const alto = 40, y0 = 100 - ((filas.length + 1 - 1) * alto) / 2;
  const t: Trazo[] = [];
  [...filasT, [...ficha(consulta), "=", "?"]].forEach((f, i) => t.push(...fila(f, y0 + i * alto, 24)));
  const v = evaluar(consulta, vals);
  const usadas = Object.keys(vals).filter(k => filas.some(f => f.includes(k)) || consulta.includes(k));
  return {
    tema: "Figuras con valor", pregunta: "Cada figura vale siempre el mismo número. ¿Qué número va en el cuadro amarillo?", trazos: t,
    valor: v, paso: pasoPara(v), trampas: [alReves(consulta, vals) === v ? v + 1 : alReves(consulta, vals)],
    explicacion: `Con las filas se descubre que ${usadas.map(k => `${SIMB[k]} = ${vals[k]}`).join(", ")}. Entonces ` +
      (consulta.length === 1 ? `${SIMB[consulta[0]]} = ${v}.` : `${consulta.map(x => SIMB[x] ?? x).join(" ")} = ${consulta.map(x => (x in SIMB ? String(vals[x]) : x)).join(" ")} = ${v}.`),
  };
}

// ================== Armado de los tres niveles ==================
function armar(nivel: Nivel, bases: Base[]): Ejercicio[] {
  return bases.map((b, i) => {
    const r = rng(nivel.length * 1000 + i);
    const lo = b.min ?? 1, hi = b.max ?? Infinity;
    const set = new Set<number>([b.valor]);
    (b.trampas ?? []).forEach(t => { if (t >= lo && t <= hi && t <= 2 * b.valor + 12 && Number.isInteger(t) && set.size < 4) set.add(t); });
    const cand = [-3, -2, -1, 1, 2, 3].map(d => b.valor + d * b.paso).filter(v => v >= lo && v <= hi);
    for (let k = cand.length - 1; k > 0; k--) { const j = Math.floor(r() * (k + 1)); [cand[k], cand[j]] = [cand[j], cand[k]]; }
    cand.forEach(v => { if (set.size < 4) set.add(v); });
    const opciones = [...set].sort((x, y) => x - y).map(String);
    return { id: `${nivel}-${i + 1}`, nivel, tema: b.tema, pregunta: b.pregunta, trazos: b.trazos, opciones, correcta: String(b.valor), explicacion: b.explicacion };
  });
}

const BASICO = armar("basico", [
  // cuentas en columna con un dígito oculto
  columna("+", 23, 14, "r", 1), columna("+", 45, 32, "a", 0), columna("+", 34, 25, "b", 1),
  columna("+", 38, 27, "r", 0), columna("+", 49, 36, "a", 1), columna("+", 62, 19, "b", 1),
  columna("−", 87, 35, "b", 0), columna("−", 94, 51, "r", 1), columna("−", 76, 28, "a", 1),
  // ecuaciones con un cuadro
  ecuacion("sumaIz", 17, 45), ecuacion("restaIz", 9, 14), ecuacion("restaDer", 56, 21), ecuacion("prodIz", 6, 42), ecuacion("prodDer", 8, 72),
  // multiplicar con dibujos
  arreglo(3, 4), arreglo(5, 4), grupos(4, 6), grupos(3, 5),
  // saltos en la recta
  recta(4, 3, 4), recta(2, 5, 3), recta(20, -4, 4), recta(18, -3, 5),
  // tablas de multiplicar
  tablaMult([2, 3, 4], [5, 6, 7], 1, 0), tablaMult([3, 4, 5], [2, 6, 8], 2, 2), tablaMult([6, 7, 8], [3, 4, 5], 0, 1),
]);

const INTERMEDIO = armar("intermedio", [
  // cuentas en columna con llevadas
  columna("+", 345, 278, "r", 1), columna("+", 567, 189, "a", 1), columna("−", 724, 358, "b", 0), columna("−", 641, 275, "r", 2),
  columna("×", 24, 6, "r", 1), columna("×", 37, 5, "a", 1), columna("×", 123, 4, "r", 0), columna("×", 46, 7, "b", 0),
  // máquina de operaciones
  maquina(3, [["+", 5], ["×", 4]], "final"), maquina(10, [["×", 3], ["−", 7]], "final"), maquina(7, [["×", 2], ["+", 9]], "final"), maquina(20, [["−", 8], ["×", 3]], "final"),
  maquina(8, [["+", 6], ["×", 2]], "inicio"), maquina(9, [["×", 3], ["−", 5]], "inicio"),
  // operaciones combinadas
  jerarquia(["3", "+", "4", "×", "5"], "Primero se multiplica: 4 × 5 = 20. Luego se suma: 3 + 20 = 23."),
  jerarquia(["20", "−", "2", "×", "6"], "Primero se multiplica: 2 × 6 = 12. Luego se resta: 20 − 12 = 8."),
  jerarquia(["2", "×", "5", "+", "3", "×", "4"], "Primero las multiplicaciones: 2 × 5 = 10 y 3 × 4 = 12. Luego se suma: 10 + 12 = 22."),
  jerarquia(["(", "3", "+", "4", ")", "×", "5"], "Primero el paréntesis: 3 + 4 = 7. Luego se multiplica: 7 × 5 = 35."),
  jerarquia(["40", "−", "(", "8", "+", "6", ")"], "Primero el paréntesis: 8 + 6 = 14. Luego se resta: 40 − 14 = 26."),
  // tablas con totales
  tablaTotales([[4, 7, 5], [6, 3, 8], [2, 9, 5]], 1, 2), tablaTotales([[12, 8, 15], [9, 14, 6], [7, 11, 10]], 0, 1), tablaTotales([[5, 9, 6], [8, 4, 7], [3, 6, 9]], 2, 0),
  // figuras con valor
  figuras({ c: 7, t: 4 }, [["c", "+", "c"], ["c", "+", "t"]], ["t"]),
  figuras({ t: 6, s: 5 }, [["t", "+", "t", "+", "t"], ["t", "+", "s"]], ["s"]),
  figuras({ s: 8, c: 5 }, [["s", "+", "s"], ["s", "+", "c"]], ["c"]),
]);

const AVANZADO = armar("avanzado", [
  // cuentas en columna más grandes
  columna("+", 478, 356, "b", 1), columna("+", 2645, 1387, "r", 2), columna("−", 832, 457, "a", 1), columna("−", 1204, 659, "b", 1),
  columna("×", 37, 8, "a", 0), columna("×", 59, 6, "r", 1), columna("×", 46, 23, "r", 2),
  // máquina de operaciones con tres pasos
  maquina(4, [["×", 3], ["+", 8], ["−", 5]], "final"), maquina(6, [["+", 9], ["×", 2], ["−", 10]], "final"),
  maquina(12, [["−", 5], ["×", 4], ["+", 6]], "final"), maquina(5, [["×", 5], ["−", 7], ["×", 2]], "final"),
  maquina(7, [["+", 4], ["×", 3], ["−", 6]], "inicio"), maquina(4, [["×", 2], ["+", 7], ["×", 3]], "inicio"),
  // operaciones combinadas con paréntesis
  jerarquia(["2", "×", "(", "15", "−", "9", ")", "+", "4", "×", "3"], "Primero el paréntesis: 15 − 9 = 6. Luego las multiplicaciones: 2 × 6 = 12 y 4 × 3 = 12. Al final se suma: 12 + 12 = 24."),
  jerarquia(["(", "12", "+", "8", ")", "×", "(", "9", "−", "6", ")"], "Primero los paréntesis: 12 + 8 = 20 y 9 − 6 = 3. Luego se multiplica: 20 × 3 = 60."),
  jerarquia(["5", "×", "6", "−", "4", "×", "(", "3", "+", "2", ")"], "Primero el paréntesis: 3 + 2 = 5. Luego las multiplicaciones: 5 × 6 = 30 y 4 × 5 = 20. Al final se resta: 30 − 20 = 10."),
  jerarquia(["100", "−", "(", "7", "+", "3", ")", "×", "8"], "Primero el paréntesis: 7 + 3 = 10. Luego se multiplica: 10 × 8 = 80. Al final se resta: 100 − 80 = 20."),
  jerarquia(["3", "×", "(", "4", "+", "5", "×", "2", ")", "−", "10"], "Dentro del paréntesis primero se multiplica: 5 × 2 = 10 y luego se suma: 4 + 10 = 14. Después: 3 × 14 = 42. Al final: 42 − 10 = 32."),
  // figuras con valor
  figuras({ c: 6, t: 9, s: 5 }, [["c", "+", "c"], ["c", "+", "t"], ["t", "+", "s"]], ["c", "+", "s"]),
  figuras({ c: 4, t: 7, s: 3 }, [["c", "×", "c"], ["c", "+", "t"], ["t", "×", "s"]], ["c", "+", "t", "+", "s"]),
  figuras({ c: 5, t: 8, s: 2 }, [["c", "+", "c", "+", "c"], ["c", "+", "t"], ["t", "−", "s"]], ["t", "×", "s"]),
  figuras({ c: 3, t: 6, s: 9 }, [["t", "+", "t"], ["s", "−", "c"], ["c", "×", "t"]], ["s", "+", "t", "−", "c"]),
  // tablas con totales
  tablaTotales([[23, 17, 35], [41, 28, 19], [16, 32, 24]], 2, 0), tablaTotales([[48, 36, 52], [27, 61, 33], [45, 29, 58]], 1, 1), tablaTotales([[125, 80, 95], [60, 140, 75], [110, 90, 65]], 0, 2),
]);

const EJERCICIOS: Record<Nivel, Ejercicio[]> = {
  basico: BASICO,
  intermedio: INTERMEDIO,
  avanzado: AVANZADO,
};

// ================== Componente ==================
@Component({
  selector: "app-operaciones-naturales",
  standalone: true,
  imports: [Quiz],
  template: `
    <app-quiz
      [vista]="vista()"
      (volver)="volver()"
      (nivelElegido)="nivelElegido($event)"
      (empezar)="empezar()"
      (respuestaSeleccionada)="respuestaSeleccionada($event)"
      (avanzar)="avanzar()"
      (reiniciar)="reiniciar()"
      (alternarSonido)="alternarSonido()"
    />
  `,
})
export class OperacionesNaturales implements OnInit, OnDestroy {
  private readonly gameUi = inject(GameUiService);
  private readonly attempts = inject(AttemptsService);
  private readonly router = inject(Router);
  private intentoId: string | null = null;
  private intentoInicio = 0;

  readonly config: ConfiguracionQuiz = {
    titulo: "Operaciones Básicas",
    descripcion: "Suma, resta y multiplica resolviendo desafíos.",
    colorTema: "cyan",
    niveles: 3,
    preguntasPorNivel: 25,
    etiquetasNiveles: ["Básico", "Intermedio", "Avanzado"],
    preguntas: [],
  };

  readonly vista = signal<QuizViewModel>({
    config: {} as ConfiguracionQuiz,
    estado: "intro",
    indice: 0,
    nivelSeleccionado: 1,
    preguntaActual: null,
    total: 0,
    etiquetasNiveles: [],
    resultado: {
      correctas: 0,
      incorrectas: 0,
      total: 0,
      puntaje: 0,
      porcentaje: 0,
      respuestas: [],
    },
    estrellas: 0,
    colorTema: "cyan",
    seleccionada: null,
    esCorrecta: null,
    mostrarConfeti: false,
    sonidosActivos: true,
    segundosRestantes: 0,
  });

  ngOnInit(): void {
    this.config.preguntas = this.generar();
    this.vista.set(this.inicial(1));
    this.gameUi.setJugando(true);
    void this.attempts.iniciar("operaciones-naturales").then((s) => {
      this.intentoId = s?.id ?? null;
      this.intentoInicio = s?.inicio ?? Date.now();
    });
  }
  ngOnDestroy(): void {
    this.gameUi.setJugando(false);
    if (this.intentoId)
      void this.attempts.finalizar(this.intentoId, this.intentoInicio, {
        actividadId: "operaciones-naturales",
        puntaje: this.vista().resultado.puntaje,
        nivel: this.vista().nivelSeleccionado,
        respuestasCorrectas: this.vista().resultado.correctas,
        respuestasIncorrectas: this.vista().resultado.incorrectas,
      });
  }

  private inicial(n: number): QuizViewModel {
    // Al elegir o reiniciar un nivel se mezcla el orden de sus 25 ejercicios
    const list = this.mezclar(this.config.preguntas.filter((p) => p.nivel === n));
    this.config.preguntas = [
      ...this.config.preguntas.filter((p) => p.nivel !== n),
      ...list,
    ];
    return {
      config: this.config,
      estado: "intro",
      indice: 0,
      nivelSeleccionado: n,
      preguntaActual: list[0] ?? null,
      total: list.length,
      etiquetasNiveles: this.config.etiquetasNiveles ?? [],
      resultado: {
        correctas: 0,
        incorrectas: 0,
        total: list.length,
        puntaje: 0,
        porcentaje: 0,
        respuestas: [],
      },
      estrellas: 0,
      colorTema: "cyan",
      seleccionada: null,
      esCorrecta: null,
      mostrarConfeti: false,
      sonidosActivos: true,
      segundosRestantes: 0,
    };
  }

  // Convierte los 75 ejercicios (25 por nivel) al formato PreguntaQuiz
  private generar(): PreguntaQuiz[] {
    const niveles: Nivel[] = ["basico", "intermedio", "avanzado"];
    const ids = ["a", "b", "c", "d"];
    const out: PreguntaQuiz[] = [];
    niveles.forEach((nombre, idx) => {
      for (const e of EJERCICIOS[nombre]) {
        out.push({
          id: `on-${e.id}`,
          enunciado: e.pregunta,
          imagen: svgDe(e.trazos), // gráfico del ejercicio (campo opcional en PreguntaQuiz)
          tipo: "opcion-multiple" as TipoPregunta,
          nivel: idx + 1,
          opciones: e.opciones.map((o, i) => ({ id: ids[i], texto: o })),
          respuestaCorrectaId: ids[e.opciones.indexOf(e.correcta)],
          explicacion: e.explicacion,
        });
      }
    });
    return out;
  }

  private mezclar<T>(a: T[]): T[] {
    const c = [...a];
    for (let i = c.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [c[i], c[j]] = [c[j], c[i]];
    }
    return c;
  }

  volver() {
    void this.router.navigateByUrl("/razonamiento-logico");
  }
  nivelElegido(n: number) {
    this.vista.set(this.inicial(n));
  }
  empezar() {
    this.vista.update((s) => ({ ...s, estado: "jugando" }));
  }
  respuestaSeleccionada(id: string) {
    const v = this.vista();
    const p = v.preguntaActual;
    if (!p) return;
    const es = id === p.respuestaCorrectaId;
    this.vista.update((s) => ({
      ...s,
      seleccionada: id,
      esCorrecta: es,
      estado: "feedback",
      // El marcador se acumula aqui: avanzar() solo cierra la partida.
      resultado: {
        ...s.resultado,
        correctas: s.resultado.correctas + (es ? 1 : 0),
        incorrectas: s.resultado.incorrectas + (es ? 0 : 1),
        puntaje: s.resultado.puntaje + (es ? (p.puntos ?? 10) : 0),
        respuestas: [
          ...s.resultado.respuestas,
          { preguntaId: p.id, opcionId: id, correcta: es },
        ],
      },
    }));
  }
  avanzar() {
    const v = this.vista();
    const list = this.config.preguntas.filter(
      (p) => p.nivel === v.nivelSeleccionado,
    );
    const sig = v.indice + 1;
    if (sig < list.length) {
      this.vista.update((s) => ({
        ...s,
        indice: sig,
        preguntaActual: list[sig],
        estado: "jugando",
        seleccionada: null,
        esCorrecta: null,
      }));
    } else {
      const c = v.resultado.correctas;
      const t = list.length;
      const pct = t === 0 ? 0 : Math.round((c / t) * 100);
      this.vista.update((s) => ({
        ...s,
        estado: "resultado",
        resultado: {
          ...s.resultado,
          correctas: c,
          incorrectas: t - c,
          total: t,
          porcentaje: pct,
        },
        estrellas: pct >= 90 ? 3 : pct >= 70 ? 2 : pct >= 50 ? 1 : 0,
        mostrarConfeti: pct >= 70,
      }));
    }
  }
  reiniciar() {
    this.vista.set(this.inicial(this.vista().nivelSeleccionado));
  }
  alternarSonido() {
    this.vista.update((s) => ({ ...s, sonidosActivos: !s.sonidosActivos }));
  }
}