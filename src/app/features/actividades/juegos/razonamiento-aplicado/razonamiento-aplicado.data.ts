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

export const EJERCICIOS_POR_NIVEL = 25;
export const PUNTOS_POR_NIVEL = [10, 15, 20];
export const IDS_OPCION = ["a", "b", "c", "d"] as const;

/* ════════════════════════════════════════════════════════════════
   GENERADOR: PROBLEMAS DE LA VIDA DIARIA CON GRÁFICOS SVG
   · Cada nivel tiene 5 tipos de juego × 5 grados de dificultad = 25 ejercicios.
   · Determinista: el ejercicio N de un nivel siempre es el mismo.
   · Las respuestas se calculan a partir de los datos que se dibujan.

   Inicial     → ordenar por hora, leer barras, sumar precios, leer el reloj, días de la semana
   Intermedio  → ordenar por valor, barras, vuelto, duración con relojes, recetas
   Avanzado    → horarios de bus, promedios, ofertas y descuentos, rutas, gráfico de torta
   ════════════════════════════════════════════════════════════════ */
// <GEN-START>
export type Par = [string, string];

/* ───────────── Utilidades ───────────── */
export function crearRng(semilla: number): () => number {
  let a = semilla >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function mezclar<T>(arr: T[], rnd: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
export function ent(rnd: () => number, min: number, max: number): number {
  return min + Math.floor(rnd() * (max - min + 1));
}
export const suma = (a: number[]): number => a.reduce((x, y) => x + y, 0);
export const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);
export const f1 = (x: number): string => x.toFixed(1);
export const hhmm = (min: number): string =>
  `${String(Math.floor(min / 60) % 24).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
export const hm12 = (min: number): string => `${Math.floor(min / 60) % 12 || 12}:${String(min % 60).padStart(2, "0")}`;
export const dur = (min: number): string =>
  min < 60 ? `${min} min` : min % 60 === 0 ? `${min / 60} h` : `${Math.floor(min / 60)} h ${min % 60} min`;
export const NOMBRES = ["Ana", "Luis", "Mía", "Pedro", "Sofía", "Diego", "Valeria", "Mateo", "Lucía", "Carlos"];

/* ───────────── Opciones de respuesta ───────────── */
export interface Opciones {
  textos: string[];
  correcta: number;
}
export function finalizar(correcto: string, distr: string[], rnd: () => number): Opciones {
  if (distr.length < 3) throw new Error("Pocos distractores");
  const todos = mezclar([correcto, ...distr.slice(0, 3)], rnd);
  return { textos: todos, correcta: todos.indexOf(correcto) };
}
export interface OpcNum {
  fmt?: (n: number) => string;
  paso?: number; // salto de los números de relleno
  min?: number; // valor mínimo permitido en los distractores
}
export function opcionesNumero(correcto: number, trampas: number[], rnd: () => number, o: OpcNum = {}): Opciones {
  const fmtN = o.fmt ?? String;
  const paso = o.paso ?? 1;
  const min = o.min ?? 1;
  const vistos = new Set<number>([correcto]);
  const prio: number[] = [];
  for (const t of trampas)
    if (t >= min && !vistos.has(t)) {
      vistos.add(t);
      prio.push(t);
    }
  const relleno: number[] = [];
  for (const d of [1, -1, 2, -2, 3, -3, 4, -4]) {
    const t = correcto + d * paso;
    if (t >= min && !vistos.has(t)) {
      vistos.add(t);
      relleno.push(t);
    }
  }
  const elegidos = [...mezclar(prio, rnd), ...relleno].slice(0, 3);
  return finalizar(fmtN(correcto), elegidos.map(fmtN), rnd);
}
export function opcionesTexto(correcto: string, trampas: string[], rnd: () => number): Opciones {
  const vistos = new Set<string>([correcto]);
  const u: string[] = [];
  for (const t of trampas)
    if (!vistos.has(t)) {
      vistos.add(t);
      u.push(t);
    }
  return finalizar(correcto, mezclar(u, rnd), rnd);
}

/* ───────────── Dibujo SVG común ───────────── */
export const FUENTE = "'Segoe UI Emoji','Apple Color Emoji','Noto Color Emoji',sans-serif";
export const AZUL = "#2563eb";
export const AZUL_OSC = "#1e3a8a";

export function envolver(cuerpo: string, alto: number): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 ${alto}" width="420" height="${alto}">` +
    `<rect x="3" y="3" width="414" height="${alto - 6}" rx="20" fill="#eff6ff" stroke="#60a5fa" stroke-width="3"/>` +
    cuerpo +
    `</svg>`
  );
}
export function texto(
  x: number,
  y: number,
  t: string,
  size: number,
  fill: string,
  peso = 800,
  fuente = "sans-serif",
  ancla = "middle",
): string {
  return `<text x="${f1(x)}" y="${f1(y)}" font-size="${f1(size)}" font-weight="${peso}" fill="${fill}" text-anchor="${ancla}" dy=".35em" font-family="${fuente}">${t}</text>`;
}
export const emoji = (x: number, y: number, e: string, size: number): string => texto(x, y, e, size, "#000", 400, FUENTE);
export const COLORES = ["#60a5fa", "#34d399", "#fbbf24", "#f472b6", "#a78bfa"];

/** Tarjetas en fila: emoji + título + detalle (hora, valor…). */
export function svgTarjetas(items: { emoji: string; titulo: string; detalle: string }[]): string {
  const n = items.length;
  const gap = n === 4 ? 10 : 8;
  const w = (400 - gap * (n - 1)) / n;
  let s = "";
  items.forEach((it, i) => {
    const x = 10 + i * (w + gap);
    const cx = x + w / 2;
    s += `<rect x="${f1(x)}" y="20" width="${f1(w)}" height="135" rx="14" fill="#ffffff" stroke="${AZUL}" stroke-width="3"/>`;
    s += emoji(cx, 62, it.emoji, 34);
    s += texto(cx, 104, it.titulo, 12.5, "#334155", 700);
    s += texto(cx, 133, it.detalle, n === 4 ? 17 : 14, AZUL);
  });
  return envolver(s, 175);
}

/** Gráfico de barras con rejilla y valor sobre cada barra. */
export function svgBarras(items: { emoji: string; nombre: string; valor: number }[], paso: number): string {
  const x0 = 56;
  const x1 = 404;
  const yb = 190;
  const yt = 24;
  const max = Math.max(...items.map((i) => i.valor));
  const techo = Math.ceil((max + 1) / paso) * paso;
  const esc = (v: number): number => yb - (v / techo) * (yb - yt);
  let s = "";
  for (let g = 0; g <= techo; g += paso) {
    s += `<line x1="${x0}" y1="${f1(esc(g))}" x2="${x1}" y2="${f1(esc(g))}" stroke="#bfdbfe" stroke-width="1.5"/>`;
    s += texto(48, esc(g), String(g), 11, "#64748b", 600, "sans-serif", "end");
  }
  const ancho = (x1 - x0) / items.length;
  const bw = Math.min(46, ancho * 0.62);
  items.forEach((it, i) => {
    const cx = x0 + ancho * (i + 0.5);
    const top = esc(it.valor);
    s += `<rect x="${f1(cx - bw / 2)}" y="${f1(top)}" width="${f1(bw)}" height="${f1(yb - top)}" rx="7" fill="${COLORES[i % COLORES.length]}" stroke="${AZUL_OSC}" stroke-width="1.5"/>`;
    s += texto(cx, top - 11, String(it.valor), 15, AZUL_OSC);
    s += emoji(cx, yb + 22, it.emoji, 22);
    s += texto(cx, yb + 44, it.nombre, 11, "#475569", 700);
  });
  s += `<line x1="${x0}" y1="${yb}" x2="${x1}" y2="${yb}" stroke="${AZUL_OSC}" stroke-width="2.5"/>`;
  return envolver(s, 250);
}

/** Etiquetas de precio. cinta = oferta (texto rojo). billete = billete con el que se paga. */
export function svgEtiquetas(
  items: { emoji: string; nombre: string; precio: number }[],
  cinta?: string,
  billete?: number,
): string {
  const n = items.length;
  const w = n === 1 ? 210 : n === 2 ? 170 : 124;
  const gap = n === 1 ? 0 : 14;
  const total = n * w + (n - 1) * gap;
  const x0 = (420 - total) / 2;
  const y0 = 18;
  const h = n === 1 ? 150 : 140;
  let s = "";
  items.forEach((it, i) => {
    const x = x0 + i * (w + gap);
    const cx = x + w / 2;
    s += `<rect x="${f1(x)}" y="${y0}" width="${w}" height="${h}" rx="16" fill="#ffffff" stroke="${AZUL}" stroke-width="3"/>`;
    s += `<circle cx="${f1(cx)}" cy="${y0 + 14}" r="6" fill="#dbeafe" stroke="${AZUL}" stroke-width="2"/>`;
    s += emoji(cx, y0 + 62, it.emoji, n === 1 ? 52 : 40);
    s += texto(cx, y0 + (n === 1 ? 102 : 98), cap(it.nombre), 14, "#334155", 700);
    s += texto(cx, y0 + (n === 1 ? 130 : 122), `Bs ${it.precio}`, n === 1 ? 24 : 20, "#1d4ed8");
  });
  let alto = 180;
  if (cinta) {
    s += `<rect x="${f1(210 - 95)}" y="${y0 + h + 10}" width="190" height="30" rx="15" fill="#ef4444"/>`;
    s += texto(210, y0 + h + 25, cinta, 15, "#ffffff");
    alto = 218;
  }
  if (billete) {
    s += `<rect x="125" y="${y0 + h + 12}" width="170" height="42" rx="9" fill="#bbf7d0" stroke="#16a34a" stroke-width="3"/>`;
    s += texto(210, y0 + h + 33, `💵 Bs ${billete}`, 21, "#166534", 800, FUENTE);
    alto = 232;
  }
  return envolver(s, alto);
}

/** Cara de reloj analógico (manecilla corta azul = hora, larga roja = minutos). */
export function relojSVG(cx: number, cy: number, r: number, h: number, m: number): string {
  let s = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#ffffff" stroke="${AZUL}" stroke-width="5"/>`;
  for (let i = 0; i < 60; i++) {
    const a = (i * 6 * Math.PI) / 180;
    const r1 = i % 5 === 0 ? 0.9 : 0.94;
    s += `<line x1="${f1(cx + Math.sin(a) * r * r1)}" y1="${f1(cy - Math.cos(a) * r * r1)}" x2="${f1(cx + Math.sin(a) * r * 0.98)}" y2="${f1(cy - Math.cos(a) * r * 0.98)}" stroke="#94a3b8" stroke-width="${i % 5 === 0 ? 2 : 1}"/>`;
  }
  for (let i = 1; i <= 12; i++) {
    const a = (i * 30 * Math.PI) / 180;
    s += texto(cx + Math.sin(a) * r * 0.74, cy - Math.cos(a) * r * 0.74, String(i), r * 0.2, AZUL_OSC);
  }
  const ah = (((h % 12) * 30 + m * 0.5) * Math.PI) / 180;
  const am = (m * 6 * Math.PI) / 180;
  s += `<line x1="${cx}" y1="${cy}" x2="${f1(cx + Math.sin(ah) * r * 0.48)}" y2="${f1(cy - Math.cos(ah) * r * 0.48)}" stroke="${AZUL_OSC}" stroke-width="7" stroke-linecap="round"/>`;
  s += `<line x1="${cx}" y1="${cy}" x2="${f1(cx + Math.sin(am) * r * 0.72)}" y2="${f1(cy - Math.cos(am) * r * 0.72)}" stroke="#ef4444" stroke-width="4.5" stroke-linecap="round"/>`;
  s += `<circle cx="${cx}" cy="${cy}" r="6" fill="${AZUL_OSC}"/>`;
  return s;
}
/** Un reloj (leer la hora) o dos relojes (duración) con la hora digital debajo. */
export function svgRelojes(lista: { h: number; m: number; rotulo?: string; digital?: string }[]): string {
  if (lista.length === 1) {
    return envolver(relojSVG(210, 112, 92, lista[0].h, lista[0].m), 224);
  }
  let s = "";
  const xs = [105, 315];
  lista.forEach((r, i) => {
    s += relojSVG(xs[i], 100, 76, r.h, r.m);
    if (r.rotulo) s += texto(xs[i], 200, r.rotulo, 16, "#334155", 700, FUENTE);
    if (r.digital) s += texto(xs[i], 226, r.digital, 20, AZUL);
  });
  s += texto(210, 100, "➜", 36, "#f59e0b");
  return envolver(s, 248);
}

/** Tira de la semana con el día de HOY marcado. */
export function svgSemana(hoy: number): string {
  const dias = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
  let s = "";
  dias.forEach((d, i) => {
    const x = 16 + i * 56;
    const es = i === hoy;
    s += `<rect x="${x}" y="46" width="52" height="64" rx="12" fill="${es ? "#fde047" : "#ffffff"}" stroke="${es ? "#f59e0b" : AZUL}" stroke-width="${es ? 4 : 2.5}"/>`;
    s += texto(x + 26, 78, d, 15, es ? "#92400e" : AZUL_OSC);
    if (es) {
      s += `<rect x="${x + 2}" y="14" width="48" height="24" rx="12" fill="#f59e0b"/>`;
      s += texto(x + 26, 26, "HOY", 13, "#ffffff");
    }
  });
  return envolver(s, 128);
}

/** Tarjeta de receta. */
export function svgReceta(personas: number, ings: { emoji: string; cant: number; nombre: string }[]): string {
  let s = `<rect x="40" y="16" width="340" height="190" rx="16" fill="#ffffff" stroke="${AZUL}" stroke-width="3"/>`;
  s += `<rect x="40" y="16" width="340" height="42" rx="16" fill="${AZUL}"/>`;
  s += texto(210, 38, `📋 Receta para ${personas} personas`, 18, "#ffffff", 800, FUENTE);
  ings.forEach((g, i) => {
    const y = 90 + i * 44;
    s += emoji(76, y, g.emoji, 30);
    s += texto(110, y, `${g.cant} ${g.nombre}`, 19, "#1e293b", 700, "sans-serif", "start");
  });
  return envolver(s, 222);
}

/** Tabla de horarios de buses. */
export function svgHorario(salidas: number[]): string {
  let s = `<rect x="90" y="14" width="240" height="46" rx="14" fill="${AZUL}"/>`;
  s += texto(210, 37, "🚌 Horario de buses", 19, "#ffffff", 800, FUENTE);
  s += texto(150, 80, "Bus", 14, "#64748b", 700);
  s += texto(270, 80, "Sale a las", 14, "#64748b", 700);
  salidas.forEach((t, i) => {
    const y = 96 + i * 38;
    s += `<rect x="90" y="${y}" width="240" height="32" rx="10" fill="${i % 2 ? "#ffffff" : "#dbeafe"}" stroke="#93c5fd" stroke-width="1.5"/>`;
    s += texto(150, y + 16, `Bus ${i + 1}`, 16, "#334155", 700);
    s += texto(270, y + 16, hhmm(t), 20, AZUL_OSC);
  });
  return envolver(s, 258);
}

/** Mapa con tres rutas de la casa a la escuela y la distancia de cada tramo. */
export function svgRutas(rutas: { tramos: number[]; nodos: string[] }[]): string {
  const ys = [50, 120, 190];
  const col = ["#3b82f6", "#f97316", "#22c55e"];
  const letras = ["A", "B", "C"];
  const casa: [number, number] = [50, 120];
  const esc: [number, number] = [370, 120];
  let lineas = "";
  let pills = "";
  let nodos = "";
  rutas.forEach((r, i) => {
    const t = r.tramos.length;
    const pts: [number, number][] = [casa];
    for (let j = 1; j < t; j++) pts.push([casa[0] + ((esc[0] - casa[0]) * j) / t, ys[i]]);
    pts.push(esc);
    lineas += `<polyline points="${pts.map((p) => `${f1(p[0])},${f1(p[1])}`).join(" ")}" fill="none" stroke="${col[i]}" stroke-width="5" stroke-linejoin="round" stroke-linecap="round"/>`;
    for (let j = 0; j < t; j++) {
      const mx = (pts[j][0] + pts[j + 1][0]) / 2;
      const my = (pts[j][1] + pts[j + 1][1]) / 2;
      pills += `<rect x="${f1(mx - 24)}" y="${f1(my - 11)}" width="48" height="22" rx="11" fill="#ffffff" stroke="${col[i]}" stroke-width="2"/>`;
      pills += texto(mx, my, `${r.tramos[j]} km`, 12, "#1e293b");
    }
    for (let j = 1; j < t; j++) {
      nodos += `<circle cx="${f1(pts[j][0])}" cy="${f1(pts[j][1])}" r="17" fill="#ffffff" stroke="${col[i]}" stroke-width="3"/>`;
      nodos += emoji(pts[j][0], pts[j][1], r.nodos[j - 1], 20);
    }
    const lx = pts[1][0] - 14;
    const ly = pts[1][1] - 12; // la letra de la ruta va como insignia en la esquina de su primer nodo
    nodos += `<circle cx="${f1(lx)}" cy="${f1(ly)}" r="11" fill="${col[i]}"/>` + texto(lx, ly, letras[i], 14, "#ffffff");
  });
  const extremos =
    `<circle cx="${casa[0]}" cy="${casa[1]}" r="25" fill="#ffffff" stroke="#94a3b8" stroke-width="3"/>` +
    emoji(casa[0], casa[1], "🏠", 30) +
    texto(casa[0], 156, "Casa", 12, "#334155", 700) +
    `<circle cx="${esc[0]}" cy="${esc[1]}" r="25" fill="#ffffff" stroke="#94a3b8" stroke-width="3"/>` +
    emoji(esc[0], esc[1], "🏫", 30) +
    texto(esc[0], 156, "Escuela", 12, "#334155", 700);
  return envolver(lineas + pills + nodos + extremos, 232);
}

/** Gráfico de torta con porcentajes y leyenda. */
export function svgTorta(partes: { emoji: string; nombre: string; pct: number }[]): string {
  const col = ["#3b82f6", "#f97316", "#22c55e", "#a855f7"];
  const cx = 120;
  const cy = 118;
  const r = 90;
  let ang = -Math.PI / 2;
  let s = "";
  partes.forEach((p, i) => {
    const a1 = ang + (2 * Math.PI * p.pct) / 100;
    const x0 = cx + r * Math.cos(ang);
    const y0 = cy + r * Math.sin(ang);
    const x1 = cx + r * Math.cos(a1);
    const y1 = cy + r * Math.sin(a1);
    s += `<path d="M ${cx} ${cy} L ${f1(x0)} ${f1(y0)} A ${r} ${r} 0 ${p.pct > 50 ? 1 : 0} 1 ${f1(x1)} ${f1(y1)} Z" fill="${col[i]}" stroke="#ffffff" stroke-width="3"/>`;
    const am = (ang + a1) / 2;
    s += texto(cx + r * 0.6 * Math.cos(am), cy + r * 0.6 * Math.sin(am), `${p.pct}%`, 18, "#ffffff");
    ang = a1;
  });
  partes.forEach((p, i) => {
    const y = 66 + i * 44;
    s += `<rect x="236" y="${y - 14}" width="26" height="26" rx="7" fill="${col[i]}"/>`;
    s += emoji(284, y, p.emoji, 24);
    s += texto(304, y, p.nombre, 15, "#1e293b", 700, "sans-serif", "start");
  });
  return envolver(s, 236);
}

/* ───────────── Contexto de cada ejercicio ───────────── */
export interface Ctx {
  v: number; // grado de dificultad 0..4
  tipo: number; // tipo de juego 0..4
  rnd: () => number;
  nombre: string;
}
export function crearCtx(nivel: number, e: number): Ctx {
  const rnd = crearRng(nivel * 20011 + e * 7919 + 31);
  return {
    v: Math.floor((e - 1) / 5),
    tipo: (e - 1) % 5,
    rnd,
    nombre: NOMBRES[Math.floor(rnd() * NOMBRES.length)],
  };
}
export interface Parcial {
  pregunta: string;
  pista?: string;
  svg: string;
  op: Opciones;
  explicacion: string;
}

export const FRUTAS: Par[] = [["🍎", "Manzanas"], ["🍌", "Bananas"], ["🍇", "Uvas"], ["🍓", "Frutillas"], ["🍊", "Naranjas"]];
export const ANIMALES: Par[] = [["🐶", "Perros"], ["🐱", "Gatos"], ["🐰", "Conejos"], ["🐸", "Ranas"], ["🐢", "Tortugas"]];
export const OBJETOS: Par[] = [["⚽", "Pelotas"], ["🎈", "Globos"], ["🚲", "Bicis"], ["🪁", "Cometas"], ["🎨", "Pinturas"]];
export const CATEGORIAS: Par[][] = [FRUTAS, ANIMALES, OBJETOS];
export const PRODUCTOS: Par[] = [
  ["🍞", "pan"], ["🥛", "leche"], ["🍎", "manzana"], ["🍪", "galletas"], ["🧃", "jugo"],
  ["🍫", "chocolate"], ["🍌", "banana"], ["🧀", "queso"], ["🥚", "huevos"],
];
export const DIAS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

export interface Barra {
  emoji: string;
  nombre: string;
  valor: number;
}
export function crearBarras(c: Ctx, cuantas: number, valores: number[]): Barra[] {
  const cat = mezclar(CATEGORIAS[Math.floor(c.rnd() * CATEGORIAS.length)], c.rnd);
  const vals = mezclar(valores, c.rnd);
  return cat.slice(0, cuantas).map(([emoji, nombre], i) => ({ emoji, nombre, valor: vals[i] }));
}
export const rango = (a: number, b: number, paso = 1): number[] => {
  const o: number[] = [];
  for (let x = a; x <= b; x += paso) o.push(x);
  return o;
};
export const etiq = (b: { emoji: string; nombre: string }): string => `${b.emoji} ${b.nombre}`;

/* ───────────── NIVEL 1 · INICIAL ───────────── */
export const ACTIVIDADES: [string, string, number][] = [
  ["🌅", "Despertar", 6 * 60 + 30],
  ["🪥", "Cepillarse", 6 * 60 + 45],
  ["🍞", "Desayunar", 7 * 60],
  ["🎒", "Ir a clases", 7 * 60 + 45],
  ["🍽️", "Almorzar", 12 * 60 + 30],
  ["📚", "Hacer tarea", 15 * 60 + 30],
  ["🛁", "Bañarse", 19 * 60],
  ["😴", "Dormir", 21 * 60],
];

export function nivel1(c: Ctx): Parcial {
  const { rnd, v } = c;
  switch (c.tipo) {
    case 0: {
      // Ordenar actividades por hora
      const cuatro = mezclar(ACTIVIDADES, rnd).slice(0, 4);
      const orden = [...cuatro].sort((a, b) => a[2] - b[2]);
      const nom = (a: [string, string, number]): string => `${a[0]} ${a[1]}`;
      const casos = [
        { q: "¿Qué actividad ocurre PRIMERO?", r: orden[0] },
        { q: "¿Qué actividad ocurre ÚLTIMA?", r: orden[3] },
        { q: "¿Cuál es la SEGUNDA actividad del día?", r: orden[1] },
        { q: "¿Cuál es la TERCERA actividad del día?", r: orden[2] },
        { q: `¿Qué actividad ocurre justo después de «${orden[1][1]}»?`, r: orden[2] },
      ][v];
      return {
        pregunta: casos.q,
        pista: "Mira la hora de cada tarjeta y ordénalas de la más temprana a la más tarde.",
        svg: svgTarjetas(cuatro.map((a) => ({ emoji: a[0], titulo: a[1], detalle: hhmm(a[2]) }))),
        op: finalizar(nom(casos.r), cuatro.filter((a) => a !== casos.r).map(nom), rnd),
        explicacion: `En orden: ${orden.map((a) => `${hhmm(a[2])} ${a[0]} ${a[1]}`).join(" → ")}.`,
      };
    }
    case 1: {
      // Leer un gráfico de barras
      const b = crearBarras(c, 4, rango(2, 9));
      const mas = b.reduce((x, y) => (y.valor > x.valor ? y : x));
      const menos = b.reduce((x, y) => (y.valor < x.valor ? y : x));
      const ord = [...b].sort((x, y) => y.valor - x.valor);
      const A = ord[0];
      const B = ord[2];
      const pista = "Cada barra muestra una cantidad: mientras más alta, mayor es.";
      const svg = svgBarras(b, 2);
      if (v === 0)
        return {
          pregunta: "¿Qué barra es la MÁS alta?",
          pista,
          svg,
          op: finalizar(etiq(mas), b.filter((x) => x !== mas).map(etiq), rnd),
          explicacion: `La barra más alta es la de ${etiq(mas)}, con ${mas.valor}.`,
        };
      if (v === 1)
        return {
          pregunta: "¿Qué barra es la MÁS baja?",
          pista,
          svg,
          op: finalizar(etiq(menos), b.filter((x) => x !== menos).map(etiq), rnd),
          explicacion: `La barra más baja es la de ${etiq(menos)}, con ${menos.valor}.`,
        };
      if (v === 2) {
        const x = b[0];
        return {
          pregunta: `¿Qué cantidad muestra la barra de ${etiq(x)}?`,
          pista,
          svg,
          op: opcionesNumero(x.valor, b.slice(1).map((y) => y.valor), rnd),
          explicacion: `La barra de ${etiq(x)} llega a ${x.valor}.`,
        };
      }
      if (v === 3)
        return {
          pregunta: `¿Cuál es la diferencia entre las barras de ${etiq(A)} y ${etiq(B)}?`,
          pista,
          svg,
          op: opcionesNumero(A.valor - B.valor, [A.valor, B.valor, A.valor + B.valor], rnd),
          explicacion: `${A.valor} − ${B.valor} = ${A.valor - B.valor}.`,
        };
      return {
        pregunta: `¿Cuánto suman las barras de ${etiq(b[0])} y ${etiq(b[1])}?`,
        pista,
        svg,
        op: opcionesNumero(b[0].valor + b[1].valor, [b[0].valor, b[1].valor, Math.abs(b[0].valor - b[1].valor)], rnd),
        explicacion: `${b[0].valor} + ${b[1].valor} = ${b[0].valor + b[1].valor}.`,
      };
    }
    case 2: {
      // Sumar precios
      const prods = mezclar(PRODUCTOS, rnd);
      const n = v === 0 || v === 1 || v === 3 ? 2 : 3;
      const rangos = [[2, 9], [5, 12], [1, 6], [3, 9], [3, 9]][v];
      const items: { emoji: string; nombre: string; precio: number }[] = [];
      const usados = new Set<number>();
      for (let i = 0; i < n; i++) {
        let p = ent(rnd, rangos[0], rangos[1]);
        while (v === 3 && usados.has(p)) p = ent(rnd, rangos[0], rangos[1]);
        usados.add(p);
        items.push({ emoji: prods[i][0], nombre: prods[i][1], precio: p });
      }
      const pista = "Mira el precio de cada etiqueta.";
      const svg = svgEtiquetas(items);
      if (v === 3) {
        const [mayor, menor] = [...items].sort((a, b) => b.precio - a.precio);
        return {
          pregunta: `¿Cuántos Bs más cuesta ${mayor.nombre} que ${menor.nombre}?`,
          pista,
          svg,
          op: opcionesNumero(mayor.precio - menor.precio, [mayor.precio, menor.precio, mayor.precio + menor.precio], rnd),
          explicacion: `${mayor.precio} − ${menor.precio} = ${mayor.precio - menor.precio} Bs.`,
        };
      }
      const total = suma(items.map((i) => i.precio));
      return {
        pregunta: `${c.nombre} compra ${items.map((i) => i.nombre).join(", ").replace(/, ([^,]*)$/, " y $1")}. ¿Cuánto paga en total?`,
        pista,
        svg,
        op: opcionesNumero(total, items.map((i) => i.precio).concat([total - 1]), rnd),
        explicacion: `${items.map((i) => i.precio).join(" + ")} = ${total} Bs.`,
      };
    }
    case 3: {
      // Leer el reloj
      const hs = (x: number): number => ((((x - 1) % 12) + 12) % 12) + 1;
      const h = ent(rnd, 1, 12);
      const minutos = v < 2 ? 0 : v < 4 ? 30 : rnd() < 0.5 ? 15 : 45;
      const correcto = `${h}:${String(minutos).padStart(2, "0")}`;
      const trampas =
        minutos === 0
          ? [`${hs(h + 1)}:00`, `${hs(h - 1)}:00`, `${h}:30`, `${hs(h + 2)}:00`]
          : minutos === 30
            ? [`${h}:00`, `${hs(h + 1)}:30`, `${hs(h + 1)}:00`, `${hs(h - 1)}:30`]
            : [`${h}:${minutos === 15 ? 45 : 15}`, `${h}:30`, `${hs(h + 1)}:${minutos}`, `${h}:00`];
      return {
        pregunta: "¿Qué hora marca el reloj?",
        pista: "La manecilla corta (azul) marca la hora y la larga (roja) los minutos.",
        svg: svgRelojes([{ h, m: minutos }]),
        op: opcionesTexto(correcto, trampas, rnd),
        explicacion: `La manecilla corta apunta al ${h} y la larga al ${minutos === 0 ? 12 : minutos / 5}: son las ${correcto}.`,
      };
    }
    default: {
      // Días de la semana
      const hoy = ent(rnd, 0, 6);
      const casos = [
        { q: "¿Qué día será mañana?", off: 1, f: "mañana" },
        { q: "¿Qué día fue ayer?", off: -1, f: "ayer" },
        { q: "¿Qué día será pasado mañana?", off: 2, f: "pasado mañana" },
        { q: "¿Qué día fue anteayer?", off: -2, f: "anteayer" },
        { q: "¿Qué día será dentro de 3 días?", off: 3, f: "dentro de 3 días" },
      ][v];
      const r = (((hoy + casos.off) % 7) + 7) % 7;
      return {
        pregunta: casos.q,
        pista: "El día marcado como HOY es el punto de partida.",
        svg: svgSemana(hoy),
        op: finalizar(DIAS[r], mezclar(DIAS.filter((_, i) => i !== r), rnd), rnd),
        explicacion: `Hoy es ${DIAS[hoy].toLowerCase()}, así que ${casos.f} es ${DIAS[r].toLowerCase()}.`,
      };
    }
  }
}

/* ───────────── NIVEL 2 · INTERMEDIO ───────────── */
export interface SetOrden {
  criterio: string;
  items: Par[];
  valores: number[];
  fmt: (n: number) => string;
  paso: number;
}
export const SETS_ORDEN: SetOrden[] = [
  {
    criterio: "la altura",
    items: [["👧", "Ana"], ["👦", "Luis"], ["🧒", "Mía"], ["👨", "Pedro"], ["👩", "Sofía"]],
    valores: rango(110, 170, 5),
    fmt: (n) => `${n} cm`,
    paso: 5,
  },
  {
    criterio: "el precio",
    items: [["🧸", "Oso"], ["🚗", "Auto"], ["🪁", "Cometa"], ["🎲", "Dados"], ["⚽", "Pelota"]],
    valores: rango(10, 60, 5),
    fmt: (n) => `Bs ${n}`,
    paso: 5,
  },
  {
    criterio: "la distancia",
    items: [["🏫", "Escuela"], ["🏪", "Tienda"], ["⛲", "Plaza"], ["🏥", "Hospital"], ["🌳", "Parque"]],
    valores: rango(1, 12),
    fmt: (n) => `${n} km`,
    paso: 1,
  },
];

export function nivel2(c: Ctx): Parcial {
  const { rnd, v } = c;
  switch (c.tipo) {
    case 0: {
      // Ordenar por valor
      const set = SETS_ORDEN[Math.floor(rnd() * SETS_ORDEN.length)];
      const vals = mezclar(set.valores, rnd);
      const its = mezclar(set.items, rnd).map(([emoji, nombre], i) => ({ emoji, nombre, valor: vals[i] }));
      const asc = [...its].sort((a, b) => a.valor - b.valor);
      const svg = svgTarjetas(its.map((i) => ({ emoji: i.emoji, titulo: i.nombre, detalle: set.fmt(i.valor) })));
      const pista = `Ordena las tarjetas según ${set.criterio}.`;
      const resumen = `De menor a mayor: ${asc.map((i) => `${i.emoji} ${set.fmt(i.valor)}`).join(" < ")}.`;
      if (v <= 2) {
        const rank = [1, 2, 3][v]; // posición en orden ascendente (0-based)
        const correcto = asc[rank];
        const cercanos = asc
          .map((it, i) => ({ it, d: Math.abs(i - rank) }))
          .filter((x) => x.it !== correcto)
          .sort((a, b) => a.d - b.d)
          .map((x) => etiq(x.it));
        const txt = [
          "Ordena de MENOR a MAYOR. ¿Cuál ocupa el 2.º lugar?",
          "Ordena de MENOR a MAYOR. ¿Cuál queda en el 3.er lugar (el del medio)?",
          "Ordena de MAYOR a MENOR. ¿Cuál ocupa el 2.º lugar?",
        ][v];
        return {
          pregunta: txt,
          pista,
          svg,
          op: finalizar(etiq(correcto), cercanos, rnd),
          explicacion: `${resumen} El elegido es ${etiq(correcto)}.`,
        };
      }
      const mx = asc[4].valor;
      const mn = asc[0].valor;
      if (v === 3)
        return {
          pregunta: "¿Cuál es la diferencia entre el mayor y el menor?",
          pista,
          svg,
          op: opcionesNumero(mx - mn, [mx, mn, mx + mn], rnd, { fmt: set.fmt, paso: set.paso }),
          explicacion: `${resumen} ${mx} − ${mn} = ${mx - mn}.`,
        };
      const s2 = asc[0].valor + asc[1].valor;
      return {
        pregunta: "¿Cuánto suman los DOS valores más pequeños?",
        pista,
        svg,
        op: opcionesNumero(s2, [asc[0].valor + asc[2].valor, asc[1].valor + asc[2].valor, mn], rnd, {
          fmt: set.fmt,
          paso: set.paso,
        }),
        explicacion: `${resumen} ${asc[0].valor} + ${asc[1].valor} = ${s2}.`,
      };
    }
    case 1: {
      // Barras con más cálculo
      const b = crearBarras(c, 5, rango(4, 20));
      const tot = suma(b.map((x) => x.valor));
      const ord = [...b].sort((x, y) => x.valor - y.valor);
      const mx = ord[4];
      const mn = ord[0];
      const pista = "Lee con cuidado el número que aparece sobre cada barra.";
      const svg = svgBarras(b, 5);
      if (v === 0)
        return {
          pregunta: "¿Cuánto suman TODAS las barras?",
          pista,
          svg,
          op: opcionesNumero(tot, [tot - mx.valor, tot - mn.valor, tot + 5], rnd),
          explicacion: `${b.map((x) => x.valor).join(" + ")} = ${tot}.`,
        };
      if (v === 1)
        return {
          pregunta: "¿Cuánto más alta es la barra mayor que la menor?",
          pista,
          svg,
          op: opcionesNumero(mx.valor - mn.valor, [mx.valor, mn.valor, mx.valor + mn.valor], rnd),
          explicacion: `${mx.valor} − ${mn.valor} = ${mx.valor - mn.valor}.`,
        };
      if (v === 2)
        return {
          pregunta: `¿Cuánto suman las barras de ${etiq(b[0])} y ${etiq(b[1])}?`,
          pista,
          svg,
          op: opcionesNumero(b[0].valor + b[1].valor, [Math.abs(b[0].valor - b[1].valor), b[0].valor, b[1].valor], rnd),
          explicacion: `${b[0].valor} + ${b[1].valor} = ${b[0].valor + b[1].valor}.`,
        };
      if (v === 3) {
        const x = ord[1 + Math.floor(rnd() * 3)];
        return {
          pregunta: `¿Cuánto le falta a la barra de ${etiq(x)} para igualar a la más alta?`,
          pista,
          svg,
          op: opcionesNumero(mx.valor - x.valor, [mx.valor, x.valor, mx.valor + x.valor], rnd),
          explicacion: `La más alta vale ${mx.valor} y la de ${etiq(x)} vale ${x.valor}: ${mx.valor} − ${x.valor} = ${mx.valor - x.valor}.`,
        };
      }
      const tres = [b[0], b[2], b[3]];
      const s3 = suma(tres.map((x) => x.valor));
      return {
        pregunta: `¿Cuánto suman las barras de ${tres.map(etiq).join(", ").replace(/, ([^,]*)$/, " y $1")}?`,
        pista,
        svg,
        op: opcionesNumero(s3, [s3 - tres[0].valor, s3 - tres[1].valor, tot], rnd),
        explicacion: `${tres.map((x) => x.valor).join(" + ")} = ${s3}.`,
      };
    }
    case 2: {
      // Compras y vuelto
      const prods = mezclar(PRODUCTOS, rnd);
      const n = v < 2 ? 2 : 3;
      const rg = [[3, 9], [5, 15], [5, 15], [8, 25], [10, 30]][v];
      const items = prods.slice(0, n).map(([emoji, nombre]) => ({ emoji, nombre, precio: ent(rnd, rg[0], rg[1]) }));
      const total = suma(items.map((i) => i.precio));
      const billete = [20, 50, 100].find((b) => b > total) ?? 100;
      return {
        pregunta: `${c.nombre} compra ${items.map((i) => i.nombre).join(", ").replace(/, ([^,]*)$/, " y $1")} y paga con un billete de Bs ${billete}. ¿Cuánto vuelto recibe?`,
        pista: "Primero suma lo que cuesta todo; luego réstalo del billete.",
        svg: svgEtiquetas(items, undefined, billete),
        op: opcionesNumero(billete - total, [total, billete + total, billete - total + 10, billete - total - 5], rnd),
        explicacion: `Total: ${items.map((i) => i.precio).join(" + ")} = ${total} Bs. Vuelto: ${billete} − ${total} = ${billete - total} Bs.`,
      };
    }
    case 3: {
      // Duración entre dos relojes
      let d: number;
      let mm: number;
      if (v === 0) {
        d = 60 * ent(rnd, 1, 3);
        mm = 0;
      } else if (v === 1) {
        d = [90, 150, 210][ent(rnd, 0, 2)];
        mm = [0, 30][ent(rnd, 0, 1)];
      } else if (v === 2) {
        d = [20, 25, 35, 40, 45, 50][ent(rnd, 0, 5)];
        mm = [0, 15, 30, 45][ent(rnd, 0, 3)];
      } else if (v === 3) {
        d = [75, 105, 135, 165][ent(rnd, 0, 3)];
        mm = [0, 15, 30, 45][ent(rnd, 0, 3)];
      } else {
        do d = 5 * ent(rnd, 17, 40);
        while (d % 15 === 0);
        mm = 5 * ent(rnd, 0, 11);
      }
      const s = ent(rnd, 1, 8) * 60 + mm;
      const e = s + d;
      const trampas = [d + 15, d - 15, d + 60, d + 30, d - 30, d - 60].map((x) => dur(x)).filter((_, i) => [d + 15, d - 15, d + 60, d + 30, d - 30, d - 60][i] > 0);
      return {
        pregunta: "El primer reloj marca la salida y el segundo la llegada. ¿Cuánto dura el viaje?",
        pista: "Cuenta primero hasta la hora en punto y luego suma los minutos que faltan.",
        svg: svgRelojes([
          { h: Math.floor(s / 60), m: s % 60, rotulo: "🛫 Sale", digital: hm12(s) },
          { h: Math.floor(e / 60), m: e % 60, rotulo: "🛬 Llega", digital: hm12(e) },
        ]),
        op: opcionesTexto(dur(d), trampas, rnd),
        explicacion: `De ${hm12(s)} a ${hm12(e)} pasan ${dur(d)}.`,
      };
    }
    default: {
      // Recetas: proporciones
      const pool: Par[] = [
        ["🥚", "huevos"], ["🥛", "tazas de leche"], ["🍌", "bananas"], ["🍅", "tomates"],
        ["🥕", "zanahorias"], ["🧀", "tajadas de queso"], ["🍎", "manzanas"],
      ];
      const tres = mezclar(pool, rnd).slice(0, 3);
      const dividir = v === 4;
      const p0 = dividir ? 6 : 2;
      const p = dividir ? 3 : [4, 6, 8, 10][v];
      const ings = tres.map(([emoji, nombre]) => ({
        emoji,
        nombre,
        cant: dividir ? 2 * ent(rnd, 1, 4) : ent(rnd, 1, 4),
      }));
      const x = ings[ent(rnd, 0, 2)];
      const resp = dividir ? x.cant / 2 : x.cant * (p / p0);
      const trampas = dividir
        ? [x.cant, x.cant - 3, x.cant / 2 + 1, x.cant / 2 - 1]
        : [x.cant + (p - p0), x.cant * (p / p0) + x.cant, x.cant * (p / p0) - 1, x.cant * p];
      return {
        pregunta: `Para ${p} personas, ¿qué cantidad de «${x.nombre}» se necesita?`,
        pista: `La receta es para ${p0} personas. Calcula cuántas veces ${dividir ? "menos" : "más"} necesitas.`,
        svg: svgReceta(p0, ings),
        op: opcionesNumero(resp, trampas, rnd),
        explicacion: dividir
          ? `${p} personas es la mitad de ${p0}, así que hace falta la mitad: ${x.cant} ÷ 2 = ${resp}.`
          : `${p} personas son ${p / p0} veces ${p0}, así que: ${x.cant} × ${p / p0} = ${resp}.`,
      };
    }
  }
}

/* ───────────── NIVEL 3 · AVANZADO ───────────── */
export function nivel3(c: Ctx): Parcial {
  const { rnd, v } = c;
  switch (c.tipo) {
    case 0: {
      // Horarios de bus
      const s0 = 6 * 60 + 5 * ent(rnd, 0, 36);
      const gaps = [0, 1, 2].map(() => 5 * ent(rnd, 3, 8));
      const sal = [s0, s0 + gaps[0], s0 + gaps[0] + gaps[1], s0 + gaps[0] + gaps[1] + gaps[2]];
      const D = 5 * ent(rnd, 7, 21);
      const svg = svgHorario(sal);
      const pista = "Usa los horarios de la tabla y calcula con minutos.";
      const fh = { fmt: hhmm, paso: 5 };
      const i = ent(rnd, 0, 2);
      const llegada = sal[i] + ent(rnd, 1, gaps[i] - 1);
      if (v === 0)
        return {
          pregunta: `Llegas a la parada a las ${hhmm(llegada)}. ¿A qué hora sale el siguiente bus?`,
          pista,
          svg,
          op: opcionesNumero(sal[i + 1], [sal[i], sal[(i + 2) % 4], llegada + 5, llegada + 10], rnd, fh),
          explicacion: `El último bus salió a las ${hhmm(sal[i])}; el siguiente sale a las ${hhmm(sal[i + 1])}.`,
        };
      if (v === 1) {
        const j = ent(rnd, 0, 3);
        return {
          pregunta: `El viaje dura ${dur(D)}. Si tomas el bus de las ${hhmm(sal[j])}, ¿a qué hora llegas?`,
          pista,
          svg,
          op: opcionesNumero(sal[j] + D, [sal[j] + D + 10, sal[j] + D - 10, sal[j] + D + 60, sal[j] + D - 60], rnd, fh),
          explicacion: `${hhmm(sal[j])} + ${dur(D)} = ${hhmm(sal[j] + D)}.`,
        };
      }
      if (v === 2)
        return {
          pregunta: "¿Cuántos minutos pasan entre la salida del Bus 1 y la del Bus 4?",
          pista,
          svg,
          op: opcionesNumero(sal[3] - sal[0], [gaps[0] + gaps[1], gaps[1] + gaps[2], sal[3] - sal[0] + 10], rnd, {
            fmt: (n) => `${n} min`,
            paso: 5,
          }),
          explicacion: `De ${hhmm(sal[0])} a ${hhmm(sal[3])}: ${gaps[0]} + ${gaps[1]} + ${gaps[2]} = ${sal[3] - sal[0]} minutos.`,
        };
      if (v === 3)
        return {
          pregunta: `Llegas a las ${hhmm(llegada)} y tomas el siguiente bus. El viaje dura ${dur(D)}. ¿A qué hora llegas a tu destino?`,
          pista,
          svg,
          op: opcionesNumero(sal[i + 1] + D, [llegada + D, sal[i] + D, sal[i + 1] + D + 10, sal[i + 1] + D - 10], rnd, fh),
          explicacion: `El siguiente bus sale a las ${hhmm(sal[i + 1])}; con ${dur(D)} de viaje llegas a las ${hhmm(sal[i + 1] + D)}.`,
        };
      const j = ent(rnd, 1, 2);
      const limite = sal[j] + D + ent(rnd, 0, gaps[j] - 1);
      return {
        pregunta: `Debes llegar antes de las ${hhmm(limite + 1)}. El viaje dura ${dur(D)}. ¿A qué hora sale el ÚLTIMO bus que puedes tomar?`,
        pista,
        svg,
        op: opcionesNumero(sal[j], [sal[j - 1], sal[j + 1], sal[(j + 2) % 4]], rnd, fh),
        explicacion: `El Bus que sale a las ${hhmm(sal[j])} llega a las ${hhmm(sal[j] + D)}, a tiempo. El siguiente llegaría a las ${hhmm(sal[j + 1] + D)}, demasiado tarde.`,
      };
    }
    case 1: {
      // Barras: promedio y razonamiento
      let b: Barra[] = [];
      for (let t = 0; t < 400; t++) {
        b = crearBarras(c, 4, rango(6, 24));
        if (suma(b.map((x) => x.valor)) % 4 === 0) break;
      }
      const vals = b.map((x) => x.valor);
      const tot = suma(vals);
      const prom = tot / 4;
      const ord = [...vals].sort((x, y) => y - x);
      const pista = "Observa todas las barras antes de calcular.";
      const svg = svgBarras(b, 5);
      if (v === 0)
        return {
          pregunta: "¿Cuál es el promedio de las cuatro barras?",
          pista,
          svg,
          op: opcionesNumero(prom, [prom + 1, prom - 1, ord[0], ord[3]], rnd),
          explicacion: `Suma: ${vals.join(" + ")} = ${tot}. Promedio: ${tot} ÷ 4 = ${prom}.`,
        };
      if (v === 1)
        return {
          pregunta: "Se necesita llegar a 100 en total. ¿Cuánto falta?",
          pista,
          svg,
          op: opcionesNumero(100 - tot, [tot, 100 - tot + 10, 100 - tot - 10, 100 - ord[0]], rnd),
          explicacion: `Total: ${tot}. Faltan 100 − ${tot} = ${100 - tot}.`,
        };
      if (v === 2)
        return {
          pregunta: "¿Cuánto más alta es la barra mayor que la menor?",
          pista,
          svg,
          op: opcionesNumero(ord[0] - ord[3], [ord[0], ord[3], ord[0] - ord[1]], rnd),
          explicacion: `${ord[0]} − ${ord[3]} = ${ord[0] - ord[3]}.`,
        };
      if (v === 3) {
        const sobre = vals.filter((x) => x > prom).length;
        return {
          pregunta: "¿Cuántas barras superan al promedio?",
          pista: "Primero calcula el promedio y luego compáralo con cada barra.",
          svg,
          op: opcionesNumero(sobre, [0, 1, 2, 3, 4], rnd, { min: 0 }),
          explicacion: `Promedio: ${tot} ÷ 4 = ${prom}. Superan ${prom}: ${vals.filter((x) => x > prom).join(", ") || "ninguna"}. Son ${sobre}.`,
        };
      }
      return {
        pregunta: "¿Cuánto suman las DOS barras más altas?",
        pista,
        svg,
        op: opcionesNumero(ord[0] + ord[1], [ord[0] + ord[2], ord[2] + ord[3], tot], rnd),
        explicacion: `Las más altas son ${ord[0]} y ${ord[1]}: ${ord[0]} + ${ord[1]} = ${ord[0] + ord[1]}.`,
      };
    }
    case 2: {
      // Ofertas y descuentos
      const arts: [string, string, string][] = [
        ["👕", "camiseta", "Una"], ["🎒", "mochila", "Una"], ["🧢", "gorra", "Una"], ["📚", "libro", "Un"], ["⚽", "pelota", "Una"],
      ];
      const [em, nom, art] = arts[Math.floor(rnd() * arts.length)];
      const bs = (n: number): string => `Bs ${n}`;
      const pista = "Piensa cuánto pagas realmente por cada oferta.";
      if (v === 0) {
        const P = [30, 40, 50, 60, 80][ent(rnd, 0, 4)];
        return {
          pregunta: `${art} ${nom} cuesta Bs ${P} y tiene 20% de descuento. ¿Cuánto pagas?`,
          pista,
          svg: svgEtiquetas([{ emoji: em, nombre: nom, precio: P }], "¡20% de descuento!"),
          op: opcionesNumero(P * 0.8, [P, P * 0.2, P - 20], rnd, { fmt: bs }),
          explicacion: `20% de ${P} es ${P * 0.2}. Pagas ${P} − ${P * 0.2} = ${P * 0.8} Bs.`,
        };
      }
      if (v === 1) {
        const P = ent(rnd, 5, 15);
        return {
          pregunta: `Oferta 2×1: pagas 1 y llevas 2. Cada ${nom} cuesta Bs ${P}. Si llevas 4, ¿cuánto pagas?`,
          pista,
          svg: svgEtiquetas([{ emoji: em, nombre: nom, precio: P }], "¡Oferta 2×1!"),
          op: opcionesNumero(2 * P, [4 * P, 3 * P, P], rnd, { fmt: bs }),
          explicacion: `Con 2×1, de cada 2 pagas 1. Para 4 pagas 2: 2 × ${P} = ${2 * P} Bs.`,
        };
      }
      if (v === 2) {
        const P = ent(rnd, 5, 12);
        return {
          pregunta: `Oferta 3×2: llevas 3 y pagas 2. Cada ${nom} cuesta Bs ${P}. Si llevas 6, ¿cuánto pagas?`,
          pista,
          svg: svgEtiquetas([{ emoji: em, nombre: nom, precio: P }], "¡Oferta 3×2!"),
          op: opcionesNumero(4 * P, [6 * P, 5 * P, 2 * P], rnd, { fmt: bs }),
          explicacion: `Con 3×2, de cada 3 pagas 2. Para 6 pagas 4: 4 × ${P} = ${4 * P} Bs.`,
        };
      }
      if (v === 3) {
        const P = 2 * ent(rnd, 5, 15);
        return {
          pregunta: `La segunda unidad sale a mitad de precio. Cada ${nom} cuesta Bs ${P}. Si compras 2, ¿cuánto pagas?`,
          pista,
          svg: svgEtiquetas([{ emoji: em, nombre: nom, precio: P }], "2.ª unidad a mitad"),
          op: opcionesNumero(P + P / 2, [2 * P, P, P / 2], rnd, { fmt: bs }),
          explicacion: `Pagas ${P} por la primera y ${P / 2} por la segunda: ${P} + ${P / 2} = ${P + P / 2} Bs.`,
        };
      }
      const P = [40, 60, 80, 100, 120][ent(rnd, 0, 4)];
      return {
        pregunta: `${art} ${nom} cuesta Bs ${P} y tiene 25% de descuento. ¿Cuánto AHORRAS?`,
        pista,
        svg: svgEtiquetas([{ emoji: em, nombre: nom, precio: P }], "¡25% de descuento!"),
        op: opcionesNumero(P / 4, [P * 0.75, P / 2, P / 4 + 5, P], rnd, { fmt: bs }),
        explicacion: `25% es la cuarta parte: ${P} ÷ 4 = ${P / 4} Bs de ahorro.`,
      };
    }
    case 3: {
      // Rutas más cortas
      let tramos: number[][] = [];
      for (let t = 0; t < 300; t++) {
        tramos = [0, 1, 2].map(() => Array.from({ length: ent(rnd, 2, 3) }, () => ent(rnd, 1, 8)));
        if (new Set(tramos.map(suma)).size === 3) break;
      }
      const tot = tramos.map(suma);
      const nodosPool = mezclar(["🌳", "🏪", "⛲", "🏥", "🚏", "🌉"], rnd);
      let k = 0;
      const rutas = tramos.map((t) => ({ tramos: t, nodos: t.slice(1).map(() => nodosPool[k++]) }));
      const L = ["A", "B", "C"];
      const mn = Math.min(...tot);
      const mx = Math.max(...tot);
      const imin = tot.indexOf(mn);
      const km = (n: number): string => `${n} km`;
      const svg = svgRutas(rutas);
      const pista = "Suma las distancias de todos los tramos de cada ruta.";
      const resumen = tot.map((t, i) => `Ruta ${L[i]}: ${tramos[i].join(" + ")} = ${t} km`).join(". ");
      if (v === 0)
        return {
          pregunta: "¿Cuál es la ruta MÁS CORTA de la casa a la escuela?",
          pista,
          svg,
          op: finalizar(`Ruta ${L[imin]}`, [...L.filter((_, i) => i !== imin).map((x) => `Ruta ${x}`), "Todas miden lo mismo"], rnd),
          explicacion: `${resumen}. La más corta es la Ruta ${L[imin]}.`,
        };
      if (v === 1)
        return {
          pregunta: "¿Cuántos km mide la ruta MÁS CORTA?",
          pista,
          svg,
          op: opcionesNumero(mn, [mx, tot[(imin + 1) % 3] + 1, mn + 2, mn - 1], rnd, { fmt: km }),
          explicacion: `${resumen}. La menor es ${mn} km.`,
        };
      if (v === 2)
        return {
          pregunta: "¿Cuántos km más mide la ruta MÁS LARGA que la más corta?",
          pista,
          svg,
          op: opcionesNumero(mx - mn, [mx, mn, mx + mn], rnd, { fmt: km }),
          explicacion: `${resumen}. ${mx} − ${mn} = ${mx - mn} km.`,
        };
      if (v === 3) {
        const i = ent(rnd, 0, 2);
        const j = (i + ent(rnd, 1, 2)) % 3;
        return {
          pregunta: `Vas a la escuela por la ruta ${L[i]} y regresas por la ruta ${L[j]}. ¿Cuántos km recorres en total?`,
          pista,
          svg,
          op: opcionesNumero(tot[i] + tot[j], [tot[i], tot[j], 2 * tot[i], 2 * tot[j]], rnd, { fmt: km }),
          explicacion: `${resumen}. Ida y vuelta: ${tot[i]} + ${tot[j]} = ${tot[i] + tot[j]} km.`,
        };
      }
      return {
        pregunta: "Vas y vuelves por la ruta MÁS CORTA. ¿Cuántos km recorres en total?",
        pista,
        svg,
        op: opcionesNumero(2 * mn, [mn, mn + mx, 2 * mx, 2 * mn + 2], rnd, { fmt: km }),
        explicacion: `${resumen}. Ida y vuelta por la más corta: 2 × ${mn} = ${2 * mn} km.`,
      };
    }
    default: {
      // Gráfico de torta: presupuesto familiar
      const base: Par[] = [["🍞", "Comida"], ["🏠", "Casa"], ["🚌", "Transporte"], ["🎓", "Estudios"]];
      const combos = [[40, 25, 20, 15], [35, 30, 20, 15], [45, 25, 20, 10], [30, 30, 25, 15], [50, 20, 20, 10]];
      const pcts = mezclar(combos[ent(rnd, 0, 4)], rnd);
      const partes = base.map(([emoji, nombre], i) => ({ emoji, nombre, pct: pcts[i] }));
      const T = [200, 400, 600, 800, 1000][ent(rnd, 0, 4)];
      const monto = (p: { pct: number }): number => (p.pct * T) / 100;
      const bs = (n: number): string => `Bs ${n}`;
      const pista = `El sueldo mensual es Bs ${T}. Cada porción del gráfico es un porcentaje de ese sueldo.`;
      const svg = svgTorta(partes);
      const A = partes[ent(rnd, 0, 3)];
      const B = partes.filter((p) => p !== A)[ent(rnd, 0, 2)];
      const asc = [...partes].sort((x, y) => x.pct - y.pct);
      if (v === 0)
        return {
          pregunta: `Un sueldo es de Bs ${T}. ¿Cuánto se gasta en ${A.emoji} ${A.nombre}?`,
          pista,
          svg,
          op: opcionesNumero(monto(A), [A.pct, T - monto(A), monto(A) / 2, monto(A) + 20], rnd, { fmt: bs, paso: 5 }),
          explicacion: `${A.pct}% de ${T} = ${monto(A)} Bs.`,
        };
      if (v === 1)
        return {
          pregunta: `Un sueldo es de Bs ${T}. ¿Cuánto se gasta en ${B.emoji} ${B.nombre}?`,
          pista,
          svg,
          op: opcionesNumero(monto(B), [B.pct, T - monto(B), monto(B) / 2, monto(B) + 20], rnd, { fmt: bs, paso: 5 }),
          explicacion: `${B.pct}% de ${T} = ${monto(B)} Bs.`,
        };
      if (v === 2)
        return {
          pregunta: `Un sueldo es de Bs ${T}. ¿Cuánto se gasta en total en ${A.emoji} ${A.nombre} y ${B.emoji} ${B.nombre}?`,
          pista,
          svg,
          op: opcionesNumero(monto(A) + monto(B), [monto(A), monto(B), T - monto(A) - monto(B), Math.abs(monto(A) - monto(B))], rnd, { fmt: bs, paso: 5 }),
          explicacion: `${monto(A)} + ${monto(B)} = ${monto(A) + monto(B)} Bs.`,
        };
      if (v === 3) {
        const mayor = asc[3];
        const menor = asc[0];
        return {
          pregunta: `Un sueldo es de Bs ${T}. ¿Cuántos Bs más se gastan en ${mayor.emoji} ${mayor.nombre} que en ${menor.emoji} ${menor.nombre}?`,
          pista,
          svg,
          op: opcionesNumero(monto(mayor) - monto(menor), [monto(mayor), monto(menor), mayor.pct - menor.pct, monto(mayor) + monto(menor)], rnd, { fmt: bs, paso: 5 }),
          explicacion: `${monto(mayor)} − ${monto(menor)} = ${monto(mayor) - monto(menor)} Bs.`,
        };
      }
      return {
        pregunta: `Un sueldo es de Bs ${T}. Si el gasto en ${A.emoji} ${A.nombre} se reduce a la mitad, ¿cuánto se ahorra?`,
        pista,
        svg,
        op: opcionesNumero(monto(A) / 2, [monto(A), monto(A) * 2, monto(A) / 2 + 10, A.pct], rnd, { fmt: bs, paso: 5 }),
        explicacion: `${A.pct}% de ${T} = ${monto(A)} Bs; su mitad es ${monto(A) / 2} Bs.`,
      };
    }
  }
}

/** Construye una pregunta del quiz con su gráfico SVG. */
export function construirPregunta(nivel: number, e: number): PreguntaQuiz {
  const c = crearCtx(nivel, e);
  const p = nivel === 1 ? nivel1(c) : nivel === 2 ? nivel2(c) : nivel3(c);
  return {
    id: `ra-${nivel}-${e}`,
    enunciado: p.pregunta + (p.pista ? `\n${p.pista}` : ""),
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
