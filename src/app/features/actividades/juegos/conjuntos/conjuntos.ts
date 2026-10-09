import { Component, OnDestroy, OnInit, inject, signal } from "@angular/core";
import { Router } from "@angular/router";
import { AttemptsService } from "../../../../core/services/attempts.service";
import { GameUiService } from "../../../../core/services/game-ui.service";
import { Quiz } from "../../../../shared/components/quiz/quiz";
import {
  ConfiguracionQuiz,
  PreguntaQuiz,
  QuizViewModel,
  TipoPregunta,
} from "../../../../shared/components/quiz/quiz.model";

const EJERCICIOS_POR_NIVEL = 25;
const PUNTOS_POR_NIVEL = [10, 15, 20];
const IDS_OPCION = ["a", "b", "c", "d"] as const;

/* ════════════════════════════════════════════════════════════════
   GENERADOR DE EJERCICIOS CON DIAGRAMAS DE VENN (SVG)
   · Determinista: el ejercicio N de un nivel siempre es el mismo.
   · Las respuestas se calculan a partir de los datos del diagrama.
   · Cada nivel tiene 5 tipos de juego × 5 grados de dificultad = 25.
   ════════════════════════════════════════════════════════════════ */
// <GEN-START>
type P = [number, number];

const POOLS: string[][] = [
  ["🍎", "🍌", "🍇", "🍓", "🍊", "🍉", "🥝", "🍒", "🍍", "🥭"],
  ["🐶", "🐱", "🐰", "🦊", "🐼", "🐸", "🦁", "🐯", "🐵", "🐷"],
  ["⚽", "🏀", "🎸", "🚗", "⭐", "🌙", "🎈", "🌺", "🎲", "🎨"],
];

/* ───────────── Utilidades ───────────── */
function crearRng(semilla: number): () => number {
  let a = semilla >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function mezclar<T>(arr: T[], rnd: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function ent(rnd: () => number, min: number, max: number): number {
  return min + Math.floor(rnd() * (max - min + 1));
}
const fmt = (s: string[]): string => (s.length ? `{${s.join(", ")}}` : "∅");

/* ───────────── Dibujo SVG ───────────── */
const FUENTE = "'Segoe UI Emoji','Apple Color Emoji','Noto Color Emoji',sans-serif";
const COL = {
  A: ["#3b82f6", "#1d4ed8"],
  B: ["#f97316", "#c2410c"],
  C: ["#22c55e", "#15803d"],
};

function svgBase(cuerpo: string, alto = 240): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 ${alto}" width="420" height="${alto}">` +
    `<rect x="4" y="4" width="412" height="${alto - 8}" rx="18" fill="#f8fafc" stroke="#94a3b8" stroke-width="2" stroke-dasharray="7 5"/>` +
    `<text x="22" y="30" font-size="18" font-weight="700" fill="#64748b" font-family="sans-serif">U</text>` +
    cuerpo +
    `</svg>`
  );
}
function circulo(cx: number, cy: number, r: number, k: "A" | "B" | "C"): string {
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${COL[k][0]}" fill-opacity="0.22" stroke="${COL[k][1]}" stroke-width="3"/>`;
}
function etiqueta(x: number, y: number, t: string, k: "A" | "B" | "C"): string {
  return `<text x="${x}" y="${y}" font-size="24" font-weight="800" fill="${COL[k][1]}" text-anchor="middle" dy=".35em" font-family="sans-serif">${t}</text>`;
}
function dibujoEmoji(x: number, y: number, e: string): string {
  return `<text x="${x}" y="${y}" font-size="26" text-anchor="middle" dy=".35em" font-family="${FUENTE}">${e}</text>`;
}
function dibujoNumero(x: number, y: number, n: number, color = "#1e293b", size = 30): string {
  return `<text x="${x}" y="${y}" font-size="${size}" font-weight="800" fill="${color}" text-anchor="middle" dy=".35em" font-family="sans-serif">${n}</text>`;
}
function colocar(items: string[], slots: P[]): string {
  if (items.length > slots.length) throw new Error("Faltan posiciones en el diagrama");
  return items.map((e, i) => dibujoEmoji(slots[i][0], slots[i][1], e)).join("");
}

// Posiciones dentro de cada región (ordenadas para que se vean repartidas)
const SLOTS_UNO: P[] = [[210, 122], [165, 92], [255, 92], [165, 152], [255, 152], [210, 72], [210, 172]];
const SLOTS_FUERA: P[] = [[50, 75], [375, 75], [50, 135], [375, 135], [50, 195], [375, 195]];
const SLOTS_SEP_A: P[] = [[92, 85], [148, 155], [148, 85], [92, 155], [92, 120], [148, 120]];
const SLOTS_SEP_B: P[] = SLOTS_SEP_A.map(([x, y]) => [x + 180, y] as P);
const SLOTS_V_A: P[] = [[100, 78], [145, 162], [145, 78], [100, 162], [100, 120], [145, 120]];
const SLOTS_V_B: P[] = SLOTS_V_A.map(([x, y]) => [420 - x, y] as P);
const SLOTS_V_AB: P[][] = [[], [[210, 120]], [[210, 98], [210, 142]], [[210, 82], [210, 120], [210, 158]]];
const SLOTS_ANILLO: P[] = [[110, 120], [140, 85], [140, 155], [225, 55], [225, 185]];
const SLOTS_INTERIOR: P[][] = [[], [[225, 120]], [[210, 120], [240, 120]], [[225, 98], [207, 138], [243, 138]]];

/** Un círculo (conjunto A) con elementos dentro y fuera (dentro del universo U). */
function svgUno(dentro: string[], fuera: string[]): string {
  return svgBase(
    circulo(210, 120, 88, "A") +
      etiqueta(118, 42, "A", "A") +
      colocar(dentro, SLOTS_UNO) +
      colocar(fuera, SLOTS_FUERA),
  );
}

/** Dos círculos con elementos: cruzados (venn) o separados (sep). */
function svgDos(soloA: string[], ambos: string[], soloB: string[], modo: "venn" | "sep" = "venn"): string {
  if (modo === "sep") {
    return svgBase(
      circulo(120, 120, 75, "A") +
        circulo(300, 120, 75, "B") +
        etiqueta(120, 40, "A", "A") +
        etiqueta(300, 40, "B", "B") +
        colocar(soloA, SLOTS_SEP_A) +
        colocar(soloB, SLOTS_SEP_B),
    );
  }
  return svgBase(
    circulo(160, 120, 90, "A") +
      circulo(260, 120, 90, "B") +
      etiqueta(95, 45, "A", "A") +
      etiqueta(325, 45, "B", "B") +
      colocar(soloA, SLOTS_V_A) +
      colocar(ambos, SLOTS_V_AB[ambos.length]) +
      colocar(soloB, SLOTS_V_B),
  );
}

/** Dos círculos con números en cada región. */
function svgDosNum(a: number, ab: number, b: number, fuera: number): string {
  return svgBase(
    circulo(160, 120, 90, "A") +
      circulo(260, 120, 90, "B") +
      etiqueta(95, 45, "A", "A") +
      etiqueta(325, 45, "B", "B") +
      dibujoNumero(118, 120, a) +
      dibujoNumero(210, 120, ab) +
      dibujoNumero(302, 120, b) +
      dibujoNumero(375, 205, fuera, "#64748b"),
  );
}

/** Tres círculos con números en las 7 regiones. */
function svgTres(v: { a: number; b: number; c: number; ab: number; ac: number; bc: number; abc: number; fuera: number }): string {
  return svgBase(
    circulo(165, 95, 70, "A") +
      circulo(255, 95, 70, "B") +
      circulo(210, 165, 70, "C") +
      etiqueta(100, 40, "A", "A") +
      etiqueta(320, 40, "B", "B") +
      etiqueta(312, 215, "C", "C") +
      dibujoNumero(130, 75, v.a, "#1e293b", 26) +
      dibujoNumero(290, 75, v.b, "#1e293b", 26) +
      dibujoNumero(210, 205, v.c, "#1e293b", 26) +
      dibujoNumero(210, 68, v.ab, "#1e293b", 26) +
      dibujoNumero(170, 140, v.ac, "#1e293b", 26) +
      dibujoNumero(250, 140, v.bc, "#1e293b", 26) +
      dibujoNumero(210, 118, v.abc, "#1e293b", 26) +
      dibujoNumero(58, 212, v.fuera, "#64748b", 26),
    250,
  );
}

/** Un círculo pequeño dentro de otro (subconjunto). espejo=true invierte los papeles A/B. */
function svgAnidado(interior: string[], anillo: string[], espejo: boolean): string {
  const X = (x: number): number => (espejo ? 420 - x : x);
  const ext: "A" | "B" = espejo ? "B" : "A";
  const int: "A" | "B" = espejo ? "A" : "B";
  const pos = (arr: P[]): P[] => arr.map(([x, y]) => [X(x), y] as P);
  return svgBase(
    circulo(X(190), 120, 95, ext) +
      circulo(X(225), 120, 45, int) +
      etiqueta(X(100), 48, ext, ext) +
      etiqueta(X(266), 80, int, int) +
      colocar(anillo, pos(SLOTS_ANILLO)) +
      colocar(interior, pos(SLOTS_INTERIOR[interior.length])),
  );
}

/* ───────────── Opciones de respuesta ───────────── */
interface Opciones {
  textos: string[];
  correcta: number;
}
function finalizar(correcto: string, distr: string[], rnd: () => number): Opciones {
  if (distr.length < 3) throw new Error("Pocos distractores");
  const todos = mezclar([correcto, ...distr.slice(0, 3)], rnd);
  return { textos: todos, correcta: todos.indexOf(correcto) };
}
function opcionesNumero(correcto: number, trampas: number[], rnd: () => number): Opciones {
  const vistos = new Set<number>([correcto]);
  const prio: number[] = [];
  for (const t of trampas)
    if (t >= 0 && !vistos.has(t)) {
      vistos.add(t);
      prio.push(t);
    }
  const relleno: number[] = [];
  for (const d of [1, -1, 2, -2, 3, -3, 4]) {
    const t = correcto + d;
    if (t >= 0 && !vistos.has(t)) {
      vistos.add(t);
      relleno.push(t);
    }
  }
  const elegidos = [...mezclar(prio, rnd), ...relleno].slice(0, 3);
  return finalizar(String(correcto), elegidos.map(String), rnd);
}
function opcionesConjunto(correcto: string[], trampas: string[][], universo: string[], rnd: () => number): Opciones {
  const clave = (a: string[]): string => [...a].sort().join("|");
  const vistos = new Set<string>([clave(correcto)]);
  const prio: string[][] = [];
  for (const t of trampas)
    if (!vistos.has(clave(t))) {
      vistos.add(clave(t));
      prio.push(t);
    }
  const elegidos = mezclar(prio, rnd).slice(0, 3);
  let guardia = 0;
  while (elegidos.length < 3 && guardia++ < 200) {
    const sub = mezclar(universo, rnd).slice(0, 1 + Math.floor(rnd() * 4));
    if (!vistos.has(clave(sub))) {
      vistos.add(clave(sub));
      elegidos.push(sub);
    }
  }
  return finalizar(fmt(correcto), elegidos.map(fmt), rnd);
}

/* ───────────── Contexto de cada ejercicio ───────────── */
interface Ctx {
  e: number;
  v: number; // grado de dificultad 0..4
  tipo: number; // tipo de juego 0..4
  rnd: () => number;
  sacar: (k: number) => string[];
  universo: string[];
}
function crearCtx(nivel: number, e: number): Ctx {
  const rnd = crearRng(nivel * 10007 + e * 7919 + 13);
  const pool = mezclar(POOLS[Math.floor(rnd() * POOLS.length)], rnd);
  let pos = 0;
  return {
    e,
    v: Math.floor((e - 1) / 5),
    tipo: (e - 1) % 5,
    rnd,
    sacar: (k) => {
      const r = pool.slice(pos, pos + k);
      pos += k;
      return r;
    },
    universo: [...pool],
  };
}

interface Parcial {
  pregunta: string;
  pista?: string;
  svg: string;
  op: Opciones;
  explicacion: string;
}

/* ───────────── NIVEL 1 · INICIAL: pertenencia y conteo ───────────── */
function nivel1(c: Ctx): Parcial {
  const { rnd, v } = c;
  switch (c.tipo) {
    case 0: {
      const n = 3 + v;
      const dentro = c.sacar(n);
      const fuera = c.sacar(2);
      return {
        pregunta: "¿Cuántos elementos tiene el conjunto A?",
        pista: "Cuenta solo los dibujos que están dentro del círculo A.",
        svg: svgUno(dentro, fuera),
        op: opcionesNumero(n, [n + fuera.length, n - 1, n + 1], rnd),
        explicacion: `A = ${fmt(dentro)} tiene ${n} elementos. Los dibujos de afuera no pertenecen a A.`,
      };
    }
    case 1: {
      const dentro = c.sacar(3 + (v % 2));
      const fuera = c.sacar(3);
      const correcto = dentro[Math.floor(rnd() * dentro.length)];
      return {
        pregunta: "¿Cuál de estos elementos pertenece al conjunto A?",
        svg: svgUno(dentro, fuera),
        op: finalizar(correcto, fuera, rnd),
        explicacion: `${correcto} está dentro del círculo A, por eso ${correcto} ∈ A. Los demás están afuera.`,
      };
    }
    case 2: {
      const dentro = c.sacar(3);
      const fuera = c.sacar(1 + Math.min(2, Math.floor(v / 2)));
      return {
        pregunta: "¿Cuál de estos elementos NO pertenece al conjunto A?",
        svg: svgUno(dentro, fuera),
        op: finalizar(fuera[0], dentro, rnd),
        explicacion: `${fuera[0]} está fuera del círculo A, por eso ${fuera[0]} ∉ A.`,
      };
    }
    case 3: {
      const a = ent(rnd, 2, 3) + (v >= 3 ? 1 : 0);
      const b = ent(rnd, 2, 3);
      const A = c.sacar(a);
      const B = c.sacar(b);
      return {
        pregunta: "A y B no comparten ningún elemento. Si los juntamos, ¿cuántos elementos hay en total?",
        svg: svgDos(A, [], B, "sep"),
        op: opcionesNumero(a + b, [a, b, Math.abs(a - b)], rnd),
        explicacion: `A tiene ${a} y B tiene ${b}. Juntos: ${a} + ${b} = ${a + b} elementos.`,
      };
    }
    default: {
      const dentro = c.sacar(3);
      const fuera = c.sacar(3);
      const esta = v % 2 === 0;
      const el = esta ? dentro[0] : fuera[0];
      return {
        pregunta: `¿Qué símbolo completa la frase?   ${el}  ___  A`,
        pista: "∈ significa «pertenece a» y ∉ significa «no pertenece a».",
        svg: svgUno(dentro, fuera),
        op: finalizar(esta ? "∈" : "∉", esta ? ["∉", "∪", "∩"] : ["∈", "∪", "∩"], rnd),
        explicacion: esta
          ? `${el} está dentro del círculo A, entonces ${el} ∈ A.`
          : `${el} está fuera del círculo A, entonces ${el} ∉ A.`,
      };
    }
  }
}

/* ───────────── NIVEL 2 · INTERMEDIO: unión e intersección ───────────── */
function nivel2(c: Ctx): Parcial {
  const { rnd, v } = c;
  const a = ent(rnd, 2, 3);
  const b = ent(rnd, 2, 3);
  const k = [1, 2, 3, 0, 2][v];
  const soloA = c.sacar(a);
  const ambos = c.sacar(k);
  const soloB = c.sacar(b);
  const A = [...soloA, ...ambos];
  const B = [...ambos, ...soloB];
  const union = [...soloA, ...ambos, ...soloB];
  const svg = svgDos(soloA, ambos, soloB);
  const pista = "Cada dibujo es un elemento. Los que están en la zona de cruce pertenecen a A y a B.";
  switch (c.tipo) {
    case 0:
      return {
        pregunta: "¿Cuántos elementos tiene A ∩ B (la intersección)?",
        pista,
        svg,
        op: opcionesNumero(k, [union.length, A.length, B.length], rnd),
        explicacion:
          k === 0
            ? "Los círculos no comparten ningún elemento: A ∩ B = ∅ y tiene 0 elementos."
            : `A ∩ B son los elementos que están en los dos círculos: ${fmt(ambos)}. Son ${k}.`,
      };
    case 1:
      return {
        pregunta: "¿Cuántos elementos tiene A ∪ B (la unión)?",
        pista,
        svg,
        op: opcionesNumero(union.length, [A.length + B.length, a + b, k], rnd),
        explicacion: `A ∪ B reúne todos los elementos de A o de B sin repetir: ${fmt(union)}. Son ${union.length}.`,
      };
    case 2:
      return {
        pregunta: "¿Cuál es el conjunto A ∩ B?",
        pista,
        svg,
        op: opcionesConjunto(ambos, [union, soloA, soloB, A], c.universo, rnd),
        explicacion:
          k === 0
            ? "No hay elementos en la zona de cruce, así que A ∩ B = ∅ (conjunto vacío)."
            : `La intersección tiene solo lo que está en ambos círculos: A ∩ B = ${fmt(ambos)}.`,
      };
    case 3:
      return {
        pregunta: "¿Cuál es el conjunto A ∪ B?",
        pista,
        svg,
        op: opcionesConjunto(union, [ambos, A, B, [...soloA, ...soloB]], c.universo, rnd),
        explicacion: `La unión junta todo lo que está en A o en B (sin repetir): A ∪ B = ${fmt(union)}.`,
      };
    default:
      return {
        pregunta: "¿Cuántos elementos pertenecen a A pero NO a B?",
        pista,
        svg,
        op: opcionesNumero(a, [A.length, k, b], rnd),
        explicacion: `Son los que están solo en A: ${fmt(soloA)}. En total ${a}.`,
      };
  }
}

/* ───────────── NIVEL 3 · AVANZADO: diferencia, complemento, cardinalidad, 3 conjuntos, subconjuntos ───────────── */
function nivel3(c: Ctx): Parcial {
  const { rnd, v } = c;
  switch (c.tipo) {
    case 0: {
      const soloA = c.sacar(ent(rnd, 2, 3));
      const ambos = c.sacar([1, 2, 1, 3, 2][v]);
      const soloB = c.sacar(ent(rnd, 2, 3));
      return {
        pregunta: "¿Cuál es el conjunto A − B (diferencia)?",
        pista: "A − B son los elementos de A que no están en B.",
        svg: svgDos(soloA, ambos, soloB),
        op: opcionesConjunto(soloA, [soloB, ambos, [...soloA, ...ambos], [...soloA, ...ambos, ...soloB]], c.universo, rnd),
        explicacion: `Quitamos de A lo que también está en B (${fmt(ambos)}). Queda A − B = ${fmt(soloA)}.`,
      };
    }
    case 1: {
      const dentro = c.sacar(3 + (v % 2));
      const fuera = c.sacar(2 + (v % 3));
      return {
        pregunta: "¿Cuál es el complemento A′ de A?",
        pista: "El universo U es todo lo que aparece dentro del rectángulo.",
        svg: svgUno(dentro, fuera),
        op: opcionesConjunto(fuera, [dentro, [fuera[0]], [...dentro, ...fuera], dentro.slice(0, 2)], c.universo, rnd),
        explicacion: `A′ son los elementos de U que no están en A: A′ = ${fmt(fuera)}.`,
      };
    }
    case 2: {
      const a = ent(rnd, 3, 9);
      const ab = ent(rnd, 2, 6);
      const b = ent(rnd, 3, 9);
      const ning = ent(rnd, 2, 8);
      const pista = "Los números indican cuántos elementos hay en cada región.";
      const casos = [
        {
          q: "¿Cuántos elementos tiene A, es decir, cuánto vale n(A)?",
          r: a + ab,
          t: [a, a + ab + b, ab],
          ex: `A incluye su parte exclusiva (${a}) y la intersección (${ab}): ${a} + ${ab} = ${a + ab}.`,
        },
        {
          q: "¿Cuántos elementos tiene B, es decir, cuánto vale n(B)?",
          r: b + ab,
          t: [b, a + ab + b, ab],
          ex: `B incluye su parte exclusiva (${b}) y la intersección (${ab}): ${b} + ${ab} = ${b + ab}.`,
        },
        {
          q: "¿Cuánto vale n(A ∪ B)?",
          r: a + ab + b,
          t: [a + b, a + b + 2 * ab, a + ab + b + ning],
          ex: `Se suman las tres regiones sin repetir la del medio: ${a} + ${ab} + ${b} = ${a + ab + b}.`,
        },
        {
          q: "Si U es todo lo que aparece en el diagrama (incluido lo de afuera), ¿cuánto vale n(U)?",
          r: a + ab + b + ning,
          t: [a + ab + b, ning, a + b + ning],
          ex: `Se suman las cuatro regiones: ${a} + ${ab} + ${b} + ${ning} = ${a + ab + b + ning}.`,
        },
        {
          q: "¿Cuánto vale n(A′), el complemento de A?",
          r: b + ning,
          t: [b, ning, a + ab],
          ex: `A′ es todo lo que está fuera de A: ${b} + ${ning} = ${b + ning}.`,
        },
      ][v];
      return {
        pregunta: casos.q,
        pista,
        svg: svgDosNum(a, ab, b, ning),
        op: opcionesNumero(casos.r, casos.t, rnd),
        explicacion: casos.ex,
      };
    }
    case 3: {
      const r = {
        a: ent(rnd, 3, 9),
        b: ent(rnd, 3, 9),
        c: ent(rnd, 3, 9),
        ab: ent(rnd, 1, 5),
        ac: ent(rnd, 1, 5),
        bc: ent(rnd, 1, 5),
        abc: ent(rnd, 1, 4),
        fuera: ent(rnd, 2, 8),
      };
      const nA = r.a + r.ab + r.ac + r.abc;
      const nB = r.b + r.ab + r.bc + r.abc;
      const nC = r.c + r.ac + r.bc + r.abc;
      const uAB = r.a + r.b + r.ab + r.ac + r.bc + r.abc;
      const uABC = uAB + r.c;
      const pista = "Los números indican cuántos elementos hay en cada región. El del centro está en A, B y C.";
      const casos = [
        {
          q: "¿Cuántos elementos pertenecen SOLO a C?",
          r: r.c,
          t: [nC, r.abc, r.ac + r.bc],
          ex: `Solo C es la parte de C que no toca a A ni a B: ${r.c}.`,
        },
        {
          q: "¿Cuántos elementos hay en A ∩ B ∩ C?",
          r: r.abc,
          t: [r.ab, r.ab + r.abc, r.ab + r.ac + r.bc],
          ex: `A ∩ B ∩ C es la región central donde se cruzan los tres círculos: ${r.abc}.`,
        },
        {
          q: "¿Cuánto vale n(A ∩ B)?",
          r: r.ab + r.abc,
          t: [r.ab, r.abc, r.ab + r.ac + r.bc + r.abc],
          ex: `A ∩ B incluye la zona solo de A y B (${r.ab}) y la del centro (${r.abc}): ${r.ab} + ${r.abc} = ${r.ab + r.abc}.`,
        },
        {
          q: "¿Cuánto vale n(A ∪ B)?",
          r: uAB,
          t: [nA + nB, uABC, r.a + r.b + r.ab],
          ex: `Se suman todas las regiones que tocan A o B (todas menos «solo C»): ${uAB}.`,
        },
        {
          q: "¿Cuánto vale n(A ∪ B ∪ C)?",
          r: uABC,
          t: [uABC + r.fuera, nA + nB + nC, uABC - r.abc],
          ex: `Se suman las 7 regiones dentro de los círculos: ${uABC}. El número de afuera (${r.fuera}) no cuenta.`,
        },
      ][v];
      return {
        pregunta: casos.q,
        pista,
        svg: svgTres(r),
        op: opcionesNumero(casos.r, casos.t, rnd),
        explicacion: casos.ex,
      };
    }
    default: {
      const rel = ["BsubA", "disj", "solapan", "AsubB", "solapan"][v];
      const TEXTOS = [
        "A ⊂ B",
        "B ⊂ A",
        "A ∩ B = ∅",
        "A y B comparten algunos elementos, pero ninguno contiene al otro",
      ];
      let svg: string;
      let idx: number;
      let ex: string;
      if (rel === "BsubA") {
        const interior = c.sacar(ent(rnd, 1, 3));
        const anillo = c.sacar(ent(rnd, 2, 4));
        svg = svgAnidado(interior, anillo, false);
        idx = 1;
        ex = "Todos los elementos de B están dentro de A, así que B ⊂ A (B es subconjunto de A).";
      } else if (rel === "AsubB") {
        const interior = c.sacar(ent(rnd, 1, 3));
        const anillo = c.sacar(ent(rnd, 2, 4));
        svg = svgAnidado(interior, anillo, true);
        idx = 0;
        ex = "Todos los elementos de A están dentro de B, así que A ⊂ B (A es subconjunto de B).";
      } else if (rel === "disj") {
        svg = svgDos(c.sacar(ent(rnd, 2, 3)), [], c.sacar(ent(rnd, 2, 3)), "sep");
        idx = 2;
        ex = "Los círculos no se tocan: no hay elementos comunes, A ∩ B = ∅ (conjuntos disjuntos).";
      } else {
        svg = svgDos(c.sacar(ent(rnd, 1, 3)), c.sacar(ent(rnd, 1, 2)), c.sacar(ent(rnd, 1, 3)));
        idx = 3;
        ex = "Hay elementos en la zona de cruce, pero también elementos solo de A y solo de B: ninguno contiene al otro.";
      }
      return {
        pregunta: "¿Qué afirmación describe correctamente el diagrama?",
        svg,
        op: finalizar(
          TEXTOS[idx],
          TEXTOS.filter((_, i) => i !== idx),
          rnd,
        ),
        explicacion: ex,
      };
    }
  }
}

/** Construye una pregunta del quiz con su diagrama SVG. */
function construirPregunta(nivel: number, e: number): PreguntaQuiz {
  const c = crearCtx(nivel, e);
  const p = nivel === 1 ? nivel1(c) : nivel === 2 ? nivel2(c) : nivel3(c);
  return {
    id: `cj-${nivel}-${e}`,
    enunciado:
      p.pregunta + (p.pista ? `\n${p.pista}` : ""),
    tipo: "opcion-multiple" as TipoPregunta,
    nivel,
    opciones: p.op.textos.map((texto, k) => ({ id: IDS_OPCION[k], texto })),
    respuestaCorrectaId: IDS_OPCION[p.op.correcta],
    explicacion: p.explicacion,
    puntos: PUNTOS_POR_NIVEL[nivel - 1],
    imagen: p.svg,
  };
}
// <GEN-END>

@Component({
  selector: "app-conjuntos",
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
export class Conjuntos implements OnInit, OnDestroy {
  private readonly gameUi = inject(GameUiService);
  private readonly attempts = inject(AttemptsService);
  private readonly router = inject(Router);
  private intentoId: string | null = null;
  private intentoInicio = 0;

  readonly config: ConfiguracionQuiz = {
    titulo: "Conjuntos",
    descripcion: "Aprende sobre pertenencia, unión e intersección.",
    colorTema: "pink",
    niveles: 3,
    preguntasPorNivel: EJERCICIOS_POR_NIVEL,
    etiquetasNiveles: ["Inicial", "Intermedio", "Avanzado"],
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
    colorTema: "pink",
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
    void this.attempts.iniciar("conjuntos").then((s) => {
      this.intentoId = s?.id ?? null;
      this.intentoInicio = s?.inicio ?? Date.now();
    });
  }
  ngOnDestroy(): void {
    this.gameUi.setJugando(false);
    if (this.intentoId)
      void this.attempts.finalizar(this.intentoId, this.intentoInicio, {
        actividadId: "conjuntos",
        puntaje: this.vista().resultado.puntaje,
        nivel: this.vista().nivelSeleccionado,
        respuestasCorrectas: this.vista().resultado.correctas,
        respuestasIncorrectas: this.vista().resultado.incorrectas,
      });
  }

  private inicial(n: number): QuizViewModel {
    const list = this.config.preguntas.filter((p) => p.nivel === n);
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
      colorTema: "pink",
      seleccionada: null,
      esCorrecta: null,
      mostrarConfeti: false,
      sonidosActivos: true,
      segundosRestantes: 0,
    };
  }

  /** Construye los 75 ejercicios (25 por nivel) con su diagrama. */
  private generar(): PreguntaQuiz[] {
    const out: PreguntaQuiz[] = [];
    for (let nivel = 1; nivel <= 3; nivel++) {
      for (let e = 1; e <= EJERCICIOS_POR_NIVEL; e++) {
        out.push(construirPregunta(nivel, e));
      }
    }
    return out;
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