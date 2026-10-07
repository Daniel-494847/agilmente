import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import { AttemptsService } from '../../../../core/services/attempts.service';
import { GameUiService } from '../../../../core/services/game-ui.service';
import { Quiz } from '../../../../shared/components/quiz/quiz';
import type {
  ConfiguracionQuiz,
  PreguntaQuiz,
  QuizViewModel,
  ResultadoQuiz
} from '../../../../shared/components/quiz/quiz.model';

// ====================== GENERADOR DE EJERCICIOS ======================
// Cada nivel combina 3 familias: crecientes, decrecientes y figuras/patrones.
// Cada vez que se empieza un nivel se crean 25 preguntas al azar (sin repetir),
// todas con explicación.

const CANTIDAD = 25; // ejercicios por nivel
const PUNTOS: Record<number, number> = { 1: 10, 2: 15, 3: 20 };

interface Ejercicio {
  enunciado: string;
  serie?: number[]; // números que el quiz dibuja arriba de las opciones
  opciones: string[]; // texto de cada botón (números o figuras)
  correcta: string;
  explicacion: string;
}

// Utilidades
const azar = (a: number, b: number) => Math.floor(Math.random() * (b - a + 1)) + a;
const mezclar = <T>(l: T[]) => [...l].sort(() => Math.random() - 0.5);

// Opciones: la correcta + 3 falsas. "extras" son errores típicos (se usan primero)
function opcionesCerca(c: number, extras: number[] = []): number[] {
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

// Opciones numéricas listas para usar (como texto)
const op = (c: number, extras: number[] = []) => ({
  opciones: opcionesCerca(c, extras).map(String),
  correcta: String(c)
});

// Textos de los enunciados (mismo estilo que antes)
const sigue = (t: number[]) => `¿Qué número sigue: ${t.join(', ')}, ...?`;
const falta = (t: number[], h: number) =>
  `¿Qué número falta: ${t.map((x, i) => (i === h ? '?' : x)).join(', ')}?`;

// ---------------------- BÁSICO ----------------------

// 1) Sube sumando una cantidad fija
const b1 = (): Ejercicio => {
  const a = azar(1, 20), d = azar(2, 9);
  const t = Array.from({ length: 6 }, (_, i) => a + d * i);
  return {
    enunciado: sigue(t.slice(0, 5)), serie: t.slice(0, 5),
    ...op(t[5], [t[4] + d + 1, t[4] + d - 1, t[4] + 2 * d]),
    explicacion: `La serie sube ${d} cada vez. Entonces ${t[4]} + ${d} = ${t[5]}.`,
  };
};

// 2) Baja restando una cantidad fija
const b2 = (): Ejercicio => {
  const d = azar(2, 8), a = d * 5 + azar(5, 20);
  const t = Array.from({ length: 6 }, (_, i) => a - d * i);
  return {
    enunciado: sigue(t.slice(0, 5)), serie: t.slice(0, 5),
    ...op(t[5], [t[4] - d + 1, t[4] - d - 1, t[4] + d]),
    explicacion: `La serie baja ${d} cada vez. Entonces ${t[4]} − ${d} = ${t[5]}.`,
  };
};

// 3) Falta un número en medio
const b3 = (): Ejercicio => {
  const a = azar(1, 20), d = azar(2, 9), h = azar(1, 4);
  const t = Array.from({ length: 6 }, (_, i) => a + d * i);
  return {
    enunciado: falta(t, h),
    ...op(t[h], [t[h] + 1, t[h] - 1, t[h] + d]),
    explicacion: `La serie sube ${d} cada vez. Entre ${t[h - 1]} y ${t[h + 1]} va el ${t[h - 1]} + ${d} = ${t[h]}.`,
  };
};

// 4) ¿Cuánto se suma cada vez?
const b4 = (): Ejercicio => {
  const a = azar(1, 20), d = azar(2, 9);
  const t = Array.from({ length: 5 }, (_, i) => a + d * i);
  return {
    enunciado: `En la serie ${t.join(', ')}, ¿cuánto se suma de un número al siguiente?`, serie: t,
    ...op(d, [d + 1, d - 1, d + 2]),
    explicacion: `${t[1]} − ${t[0]} = ${d}. Siempre se suma ${d}.`,
  };
};

// 5) Patrón que se repite (2 o 3 números)
const b5 = (): Ejercicio => {
  const largo = azar(2, 3);
  const base = mezclar(Array.from({ length: 20 }, (_, i) => i + 1)).slice(0, largo);
  const t = Array.from({ length: 2 * largo + 1 }, (_, i) => base[i % largo]);
  const r = base[1];
  return {
    enunciado: sigue(t), serie: t,
    ...op(r, [...base.filter((x) => x !== r), base[0] + base[1]]),
    explicacion: `El grupo que se repite es ${base.join(', ')}. Después de ${t[t.length - 1]} viene ${r}.`,
  };
};

// 6) Tabla de multiplicar
const b6 = (): Ejercicio => {
  const k = azar(3, 9), s = azar(1, 5);
  const t = Array.from({ length: 5 }, (_, i) => k * (s + i));
  const r = k * (s + 5);
  return {
    enunciado: sigue(t), serie: t,
    ...op(r, [r + 1, r - 1, r + k]),
    explicacion: `Es la tabla del ${k}: ${k} × ${s + 5} = ${r}.`,
  };
};

// ---------------------- INTERMEDIO ----------------------

// 1) Se multiplica por la misma cantidad
const i1 = (): Ejercicio => {
  const a = azar(1, 4), r = azar(2, 3);
  const t = Array.from({ length: 6 }, (_, i) => a * r ** i);
  return {
    enunciado: sigue(t.slice(0, 5)), serie: t.slice(0, 5),
    ...op(t[5], [2 * t[4] - t[3], t[4] * r - 1, t[4] * (r + 1)]),
    explicacion: `Cada número se multiplica por ${r}. Entonces ${t[4]} × ${r} = ${t[5]}.`,
  };
};

// 2) Se divide entre la misma cantidad
const i2 = (): Ejercicio => {
  const r = azar(2, 3), b = azar(2, 5);
  const t = Array.from({ length: 6 }, (_, i) => b * r ** (5 - i));
  return {
    enunciado: sigue(t.slice(0, 5)), serie: t.slice(0, 5),
    ...op(t[5], [t[4] - r, t[5] + 1, t[5] * 2]),
    explicacion: `Cada número se divide entre ${r}. Entonces ${t[4]} ÷ ${r} = ${t[5]}.`,
  };
};

// 3) Falta un número en una serie que se multiplica
const i3 = (): Ejercicio => {
  const a = azar(1, 4), r = azar(2, 3), h = azar(2, 4);
  const t = Array.from({ length: 6 }, (_, i) => a * r ** i);
  return {
    enunciado: falta(t, h),
    ...op(t[h], [t[h - 1] + (t[h - 1] - t[h - 2]), t[h] + 1, t[h] - 1]),
    explicacion: `Se multiplica por ${r} cada vez: ${t[h - 1]} × ${r} = ${t[h]}.`,
  };
};

// 4) Se alternan dos operaciones: +a y ×2
const i4 = (): Ejercicio => {
  const s = azar(1, 5), a = azar(2, 6);
  const t = [s];
  for (let i = 1; i < 6; i++) t.push(i % 2 === 1 ? t[i - 1] + a : t[i - 1] * 2);
  return {
    enunciado: sigue(t.slice(0, 5)), serie: t.slice(0, 5),
    ...op(t[5], [t[4] * 2, t[4] + a + 1, t[4] + 2 * a]),
    explicacion: `Se alterna "+${a}" y "×2". El último paso fue ×2, ahora toca +${a}: ${t[4]} + ${a} = ${t[5]}.`,
  };
};

// 5) Cuadrados (con o sin número extra)
const i5 = (): Ejercicio => {
  const s = azar(1, 6), c = azar(0, 1) * azar(1, 5);
  const t = Array.from({ length: 6 }, (_, i) => (s + i) ** 2 + c);
  return {
    enunciado: sigue(t.slice(0, 5)), serie: t.slice(0, 5),
    ...op(t[5], [t[4] + (t[4] - t[3]), t[5] + 1, t[5] - 1]),
    explicacion: `Son cuadrados${c ? ` más ${c}` : ''}: ${s + 5}² ${c ? `+ ${c} ` : ''}= ${t[5]}.`,
  };
};

// 6) Dos series mezcladas
const i6 = (): Ejercicio => {
  const a = azar(1, 10), da = azar(1, 4), b = azar(20, 40), db = azar(2, 6);
  const t: number[] = [];
  for (let i = 0; i < 4; i++) t.push(a + da * i, b + db * i);
  const r = t[7];
  return {
    enunciado: sigue(t.slice(0, 7)), serie: t.slice(0, 7),
    ...op(r, [t[6] + da, r + 1, r - 1]),
    explicacion: `Son dos series mezcladas. Los lugares impares suben ${da}. Los pares (${b}, ${b + db}, ${b + 2 * db}...) suben ${db}. Sigue ${t[5]} + ${db} = ${r}.`,
  };
};

// ---------------------- AVANZADO ----------------------

// 1) Los saltos crecen de 1 en 1
const a1 = (): Ejercicio => {
  const a = azar(1, 6), d = azar(1, 3);
  const t = [a];
  for (let i = 0; i < 5; i++) t.push(t[i] + d + i);
  return {
    enunciado: sigue(t.slice(0, 5)), serie: t.slice(0, 5),
    ...op(t[5], [t[4] + d + 3, t[4] + d + 5, t[4] + d]),
    explicacion: `Los saltos son ${d}, ${d + 1}, ${d + 2}, ${d + 3} y ahora ${d + 4}. Entonces ${t[4]} + ${d + 4} = ${t[5]}.`,
  };
};

// 2) Cada número es la suma de los dos anteriores
const a2 = (): Ejercicio => {
  const t = [azar(1, 5), azar(1, 5)];
  for (let i = 2; i < 7; i++) t.push(t[i - 1] + t[i - 2]);
  return {
    enunciado: sigue(t.slice(0, 6)), serie: t.slice(0, 6),
    ...op(t[6], [t[5] + t[3], t[5] * 2, t[6] + 1]),
    explicacion: `Cada número es la suma de los dos anteriores: ${t[4]} + ${t[5]} = ${t[6]}.`,
  };
};

// 3) Números triangulares
const a3 = (): Ejercicio => {
  const s = azar(1, 4);
  const T = (n: number) => (n * (n + 1)) / 2;
  const t = Array.from({ length: 5 }, (_, i) => T(s + i));
  const r = T(s + 5);
  return {
    enunciado: sigue(t), serie: t,
    ...op(r, [t[4] + (s + 4), t[4] + (s + 6), r + 1]),
    explicacion: `Son los números triangulares: el salto crece de 1 en 1. Ahora se suma ${s + 5}: ${t[4]} + ${s + 5} = ${r}.`,
  };
};

// 4) Cubos o n × (n + 1)
const a4 = (): Ejercicio => {
  const cubos = Math.random() < 0.5;
  const s = cubos ? azar(1, 3) : azar(1, 5);
  const f = (n: number) => (cubos ? n ** 3 : n * (n + 1));
  const t = Array.from({ length: 5 }, (_, i) => f(s + i));
  const r = f(s + 5);
  return {
    enunciado: sigue(t), serie: t,
    ...op(r, [t[4] + (t[4] - t[3]), r + 1, r - 1]),
    explicacion: cubos
      ? `Son cubos: ${s + 5} × ${s + 5} × ${s + 5} = ${r}.`
      : `Son productos de números seguidos: ${s + 5} × ${s + 6} = ${r}.`,
  };
};

// 5) Término de un lugar lejano: k·lugar + c
const a5 = (): Ejercicio => {
  const k = azar(2, 7), c = azar(0, 5), p = azar(10, 20);
  const t = Array.from({ length: 4 }, (_, i) => k * (i + 1) + c);
  const r = k * p + c;
  return {
    enunciado: `En la serie ${t.join(', ')}, ... ¿qué número ocupa el lugar ${p}?`, serie: t,
    ...op(r, [r + k, r - k, k * p]),
    explicacion: `Sube ${k} cada vez, así que el término es ${k} × lugar${c ? ` + ${c}` : ''}. Lugar ${p}: ${k} × ${p}${c ? ` + ${c}` : ''} = ${r}.`,
  };
};

// 6) Se multiplica y se suma: x → m·x + c
const a6 = (): Ejercicio => {
  const m = azar(2, 3), c = azar(1, 3), s = azar(1, 3);
  const t = [s];
  for (let i = 0; i < 5; i++) t.push(t[i] * m + c);
  return {
    enunciado: sigue(t.slice(0, 5)), serie: t.slice(0, 5),
    ...op(t[5], [t[4] * m, t[4] * m + c + 1, t[4] + (t[4] - t[3])]),
    explicacion: `Cada número se multiplica por ${m} y se le suma ${c}: ${t[4]} × ${m} + ${c} = ${t[5]}.`,
  };
};

// 7) Dos series mezcladas: una suma y otra multiplica
const a7 = (): Ejercicio => {
  const a = azar(1, 10), da = azar(2, 5), b = azar(1, 3);
  const t: number[] = [];
  for (let i = 0; i < 4; i++) t.push(a + da * i, b * 2 ** i);
  const r = t[7];
  return {
    enunciado: sigue(t.slice(0, 7)), serie: t.slice(0, 7),
    ...op(r, [t[5] + 2, r + 1, r - 2]),
    explicacion: `Son dos series mezcladas. Lugares impares: suben ${da} cada vez. Lugares pares: ${b}, ${b * 2}, ${b * 4}... se multiplican por 2. Sigue ${t[5]} × 2 = ${r}.`,
  };
};

// 8) Falta un número en la serie "suma de los dos anteriores"
const a8 = (): Ejercicio => {
  const t = [azar(1, 5), azar(1, 5)];
  for (let i = 2; i < 7; i++) t.push(t[i - 1] + t[i - 2]);
  const h = azar(2, 4);
  const v = t.slice(0, 6);
  return {
    enunciado: falta(v, h),
    ...op(t[h], [t[h] + 1, t[h] - 1, t[h - 1] * 2]),
    explicacion: `Cada número es la suma de los dos anteriores: ${t[h - 2]} + ${t[h - 1]} = ${t[h]}.`,
  };
};

// ---------------------- DECRECIENTES (más tipos) ----------------------

// Básico: falta un número en una serie que baja
const bd2 = (): Ejercicio => {
  const d = azar(2, 8), a = d * 5 + azar(5, 20), h = azar(1, 4);
  const t = Array.from({ length: 6 }, (_, i) => a - d * i);
  return {
    enunciado: falta(t, h),
    ...op(t[h], [t[h] + 1, t[h] - 1, t[h] + d]),
    explicacion: `La serie baja ${d} cada vez. Entre ${t[h - 1]} y ${t[h + 1]} va el ${t[h - 1]} − ${d} = ${t[h]}.`,
  };
};

// Básico: ¿cuánto se resta cada vez?
const bd3 = (): Ejercicio => {
  const d = azar(2, 8), a = d * 5 + azar(5, 20);
  const t = Array.from({ length: 5 }, (_, i) => a - d * i);
  return {
    enunciado: `En la serie ${t.join(', ')}, ¿cuánto se resta de un número al siguiente?`, serie: t,
    ...op(d, [d + 1, d - 1, d + 2]),
    explicacion: `${t[0]} − ${t[1]} = ${d}. Siempre se resta ${d}.`,
  };
};

// Intermedio: lo que se resta baja de 1 en 1 (100, 90, 81, 73, ...)
const id2 = (): Ejercicio => {
  const s = azar(80, 100), r0 = azar(6, 10);
  const t = [s];
  for (let i = 0; i < 4; i++) t.push(t[i] - (r0 - i));
  return {
    enunciado: sigue(t.slice(0, 4)), serie: t.slice(0, 4),
    ...op(t[4], [t[3] - (r0 - 2), t[3] - (r0 - 4), t[3] - (r0 - 3) + 1]),
    explicacion: `Se resta ${r0}, luego ${r0 - 1}, luego ${r0 - 2} y ahora ${r0 - 3}: ${t[3]} − ${r0 - 3} = ${t[4]}.`,
  };
};

// Intermedio: se alternan dos restas
const id3 = (): Ejercicio => {
  const s = azar(60, 90), a = azar(2, 5), b = azar(6, 9);
  const t = [s];
  for (let i = 1; i < 6; i++) t.push(t[i - 1] - (i % 2 === 1 ? a : b));
  return {
    enunciado: sigue(t.slice(0, 5)), serie: t.slice(0, 5),
    ...op(t[5], [t[4] - b, t[4] - a - 1, t[4] - a + 1]),
    explicacion: `Se alterna "−${a}" y "−${b}". El último paso fue −${b}, ahora toca −${a}: ${t[4]} − ${a} = ${t[5]}.`,
  };
};

// Intermedio: falta un número en una serie que se divide
const id4 = (): Ejercicio => {
  const r = azar(2, 3), b = azar(2, 5), h = azar(1, 4);
  const t = Array.from({ length: 6 }, (_, i) => b * r ** (5 - i));
  return {
    enunciado: falta(t, h),
    ...op(t[h], [t[h] + 1, t[h] - 1, t[h - 1] - r]),
    explicacion: `Se divide entre ${r} cada vez: ${t[h - 1]} ÷ ${r} = ${t[h]}.`,
  };
};

// Avanzado: lo que se resta crece de 1 en 1
const ad1 = (): Ejercicio => {
  const d = azar(1, 3), s = azar(60, 100);
  const t = [s];
  for (let i = 0; i < 5; i++) t.push(t[i] - (d + i));
  return {
    enunciado: sigue(t.slice(0, 5)), serie: t.slice(0, 5),
    ...op(t[5], [t[4] - (d + 3), t[4] - (d + 5), t[4] - d]),
    explicacion: `Lo que se resta crece: ${d}, ${d + 1}, ${d + 2}, ${d + 3} y ahora ${d + 4}. Entonces ${t[4]} − ${d + 4} = ${t[5]}.`,
  };
};

// Avanzado: término de un lugar lejano en una serie que baja
const ad2 = (): Ejercicio => {
  const k = azar(2, 7), p = azar(10, 15), C = k * (p + 2) + azar(1, 5);
  const t = Array.from({ length: 4 }, (_, i) => C - k * (i + 1));
  const r = C - k * p;
  return {
    enunciado: `En la serie ${t.join(', ')}, ... ¿qué número ocupa el lugar ${p}?`, serie: t,
    ...op(r, [r + k, r - k, C - p]),
    explicacion: `Baja ${k} cada vez, así que el término es ${C} − ${k} × lugar. Lugar ${p}: ${C} − ${k} × ${p} = ${r}.`,
  };
};

// Avanzado: dos series mezcladas que bajan
const ad3 = (): Ejercicio => {
  const aA = azar(40, 60), da = azar(2, 5), bB = azar(70, 90), db = azar(3, 7);
  const t: number[] = [];
  for (let i = 0; i < 4; i++) t.push(aA - da * i, bB - db * i);
  const r = t[7];
  return {
    enunciado: sigue(t.slice(0, 7)), serie: t.slice(0, 7),
    ...op(r, [t[6] - da, r + 1, r - 1]),
    explicacion: `Son dos series mezcladas que bajan. Lugares impares: restan ${da}. Lugares pares (${bB}, ${bB - db}, ${bB - 2 * db}...): restan ${db}. Sigue ${t[5]} − ${db} = ${r}.`,
  };
};

// ---------------------- FIGURAS Y PATRONES ----------------------
// Las figuras son emojis de colores y formas: se ven bien en el quiz sin CSS extra

const COLORES = ['🔴', '🔵', '🟢', '🟡', '🟣', '🟠'];
const FORMAS = [ // círculo y cuadrado del mismo color
  { c: '🔴', s: '🟥' }, { c: '🔵', s: '🟦' }, { c: '🟢', s: '🟩' },
  { c: '🟡', s: '🟨' }, { c: '🟣', s: '🟪' }, { c: '🟠', s: '🟧' }
];
const MEZCLA = ['⭐', '🔺', '🔴', '🟦', '❤️', '🔷'];
const TAMANOS = ['▪️', '◾', '◼️', '⬛']; // de pequeño a grande

// Repite un grupo de figuras hasta tener "largo" elementos
const ciclo = (base: string[], largo: number) =>
  Array.from({ length: largo }, (_, i) => base[i % base.length]);

// Elige k figuras distintas: por color, por forma o mezcladas
function elegirFiguras(k: number): { base: string[]; pool: string[] } {
  const r = azar(0, 2);
  if (r === 0) return { base: mezclar(COLORES).slice(0, k), pool: COLORES };
  if (r === 1 && k <= 2) {
    const f = FORMAS[azar(0, 5)];
    return { base: mezclar([f.c, f.s]).slice(0, k), pool: [f.c, f.s] };
  }
  return { base: mezclar(MEZCLA).slice(0, k), pool: MEZCLA };
}

// Opciones de figuras: la correcta + 3 distintas (primero las del patrón)
function opcionesFig(correcta: string, base: string[], pool: string[]) {
  const set = new Set<string>([correcta]);
  for (const x of [...mezclar(base), ...mezclar(pool), ...mezclar(MEZCLA)]) {
    if (set.size >= 4) break;
    set.add(x);
  }
  return { opciones: mezclar([...set]), correcta };
}

const sigueFig = (t: string[]) => `¿Qué figura sigue?  ${t.join(' ')} ...`;
const faltaFig = (t: string[], h: number) =>
  `¿Qué figura falta?  ${t.map((x, i) => (i === h ? '❓' : x)).join(' ')}`;

// Básico: dos figuras que se alternan (círculo, cuadrado, círculo, cuadrado...)
const bf1 = (): Ejercicio => {
  const { base, pool } = elegirFiguras(2);
  const t = ciclo(base, azar(5, 7));
  const r = base[t.length % 2];
  return {
    enunciado: sigueFig(t),
    ...opcionesFig(r, base, pool),
    explicacion: `Se alternan ${base.join(' y ')}. Después de ${t[t.length - 1]} viene ${r}.`,
  };
};

// Básico: falta una figura en medio
const bf2 = (): Ejercicio => {
  const { base, pool } = elegirFiguras(2);
  const t = ciclo(base, 7), h = azar(1, 5);
  return {
    enunciado: faltaFig(t, h),
    ...opcionesFig(t[h], base, pool),
    explicacion: `Se alternan ${base.join(' y ')}. Entre ${t[h - 1]} y ${t[h + 1]} va ${t[h]}.`,
  };
};

// Intermedio: grupo de 3 figuras que se repite
const if1 = (): Ejercicio => {
  const { base, pool } = elegirFiguras(3);
  const t = ciclo(base, azar(7, 9));
  const r = base[t.length % 3];
  return {
    enunciado: sigueFig(t),
    ...opcionesFig(r, base, pool),
    explicacion: `Se repite el grupo ${base.join(' ')} (3 figuras). Después de ${t[t.length - 1]} viene ${r}.`,
  };
};

// Intermedio: dos figuras iguales y una distinta (A A B)
const if2 = (): Ejercicio => {
  const { base, pool } = elegirFiguras(2);
  const pat = [base[0], base[0], base[1]];
  const t = ciclo(pat, azar(7, 8));
  const r = pat[t.length % 3];
  return {
    enunciado: sigueFig(t),
    ...opcionesFig(r, base, pool),
    explicacion: `Se repite el grupo ${pat.join(' ')}: dos iguales y luego una distinta. Después de ${t[t.length - 1]} viene ${r}.`,
  };
};

// Intermedio: falta una figura en un grupo de 3
const if3 = (): Ejercicio => {
  const { base, pool } = elegirFiguras(3);
  const t = ciclo(base, 9), h = azar(2, 6);
  return {
    enunciado: faltaFig(t, h),
    ...opcionesFig(t[h], base, pool),
    explicacion: `Se repite el grupo ${base.join(' ')}. En ese lugar toca ${t[h]}.`,
  };
};

// Intermedio: el tamaño crece o decrece
const if4 = (): Ejercicio => {
  const idx = mezclar([0, 1, 2, 3]).slice(0, 3).sort((a, b) => a - b);
  let base = idx.map((i) => TAMANOS[i]);
  const crece = Math.random() < 0.5;
  if (!crece) base = base.reverse();
  const t = ciclo(base, azar(7, 9));
  const r = base[t.length % 3];
  return {
    enunciado: sigueFig(t),
    ...opcionesFig(r, base, TAMANOS),
    explicacion: `El tamaño va ${crece ? 'de menor a mayor' : 'de mayor a menor'} y el grupo ${base.join(' ')} se repite. Después de ${t[t.length - 1]} viene ${r}.`,
  };
};

// Avanzado: ¿qué figura ocupa un lugar lejano?
const af1 = (): Ejercicio => {
  const k = azar(3, 4), p = azar(10, 20);
  const { base, pool } = elegirFiguras(k);
  const t = ciclo(base, 2 * k);
  const q = Math.floor(p / k), sobra = p % k;
  const r = sobra === 0 ? base[k - 1] : base[sobra - 1];
  return {
    enunciado: `${t.join(' ')} ...  ¿Qué figura ocupa el lugar ${p}?`,
    ...opcionesFig(r, base, pool),
    explicacion: sobra === 0
      ? `El grupo ${base.join(' ')} se repite cada ${k} figuras. ${p} ÷ ${k} = ${q} exacto, así que el lugar ${p} es la última del grupo: ${r}.`
      : `El grupo ${base.join(' ')} se repite cada ${k} figuras. ${p} ÷ ${k} = ${q} y sobran ${sobra}: es la figura número ${sobra} del grupo, ${r}.`,
  };
};

// Avanzado: grupos que crecen (¿cuántas figuras tendrá el grupo n?)
const af2 = (): Ejercicio => {
  const fig = COLORES[azar(0, 5)], s = azar(1, 3), d = azar(1, 3), g = azar(5, 7);
  const grupos = Array.from({ length: 4 }, (_, i) => fig.repeat(s + d * i));
  const r = s + d * (g - 1);
  return {
    enunciado: `Cada grupo tiene más figuras que el anterior:  ${grupos.join('  |  ')}  |  ...  ¿Cuántas figuras tendrá el grupo ${g}?`,
    ...op(r, [r + d, r - d, r + 1]),
    explicacion: `Cada grupo tiene ${d} figura${d > 1 ? 's' : ''} más. Grupo ${g}: ${s} + ${d} × ${g - 1} = ${r}.`,
  };
};

// Avanzado: grupo de 4 figuras que se repite
const af3 = (): Ejercicio => {
  const { base, pool } = elegirFiguras(4);
  const t = ciclo(base, azar(9, 11));
  const r = base[t.length % 4];
  return {
    enunciado: sigueFig(t),
    ...opcionesFig(r, base, pool),
    explicacion: `Se repite el grupo ${base.join(' ')} (4 figuras). Después de ${t[t.length - 1]} viene ${r}.`,
  };
};

// Avanzado: el tamaño sube y baja
const af4 = (): Ejercicio => {
  const idx = mezclar([0, 1, 2, 3]).slice(0, 3).sort((a, b) => a - b);
  const [a, b, c] = idx.map((i) => TAMANOS[i]);
  const base = [a, b, c, b];
  const t = ciclo(base, azar(9, 11));
  const r = base[t.length % 4];
  return {
    enunciado: sigueFig(t),
    ...opcionesFig(r, base, TAMANOS),
    explicacion: `El tamaño sube y baja: ${base.join(' ')} y vuelve a empezar. Después de ${t[t.length - 1]} viene ${r}.`,
  };
};

// Cada nivel combina 3 familias de actividades:
// [crecientes (suma/multiplicación), decrecientes (resta/división), figuras y patrones]
const FAMILIAS_NIVEL: Record<number, (() => Ejercicio)[][]> = {
  1: [[b1, b3, b4, b6], [b2, bd2, bd3], [bf1, bf2, b5]],
  2: [[i1, i3, i4, i5, i6], [i2, id2, id3, id4], [if1, if2, if3, if4]],
  3: [[a1, a2, a3, a4, a5, a6, a7, a8], [ad1, ad2, ad3], [af1, af2, af3, af4]],
};

// Convierte un ejercicio al formato PreguntaQuiz
function aPregunta(e: Ejercicio, nivel: number, n: number): PreguntaQuiz {
  const ids = ['a', 'b', 'c', 'd'];
  return {
    id: `n${nivel}-${n}`,
    nivel,
    enunciado: e.enunciado,
    tipo: 'opcion-multiple',
    ...(e.serie ? { secuenciaNumerica: e.serie } : {}),
    opciones: e.opciones.map((o, k) => ({ id: ids[k], texto: o })),
    respuestaCorrectaId: ids[e.opciones.indexOf(e.correcta)],
    explicacion: e.explicacion,
    puntos: PUNTOS[nivel]
  };
}

// Crea las 25 preguntas de un nivel: se reparten entre las 3 familias
// (9 + 8 + 8), sin repetir enunciados, y se mezclan en orden al azar
function crearNivel(nivel: number): PreguntaQuiz[] {
  const familias = FAMILIAS_NIVEL[nivel];
  const vistos = new Set<string>();
  const ejercicios: Ejercicio[] = [];
  for (let i = 0; i < 500 && ejercicios.length < CANTIDAD; i++) {
    const fam = familias[ejercicios.length % familias.length];
    const e = fam[azar(0, fam.length - 1)]();
    if (vistos.has(e.enunciado)) continue;
    vistos.add(e.enunciado);
    ejercicios.push(e);
  }
  return mezclar(ejercicios).map((e, i) => aPregunta(e, nivel, i + 1));
}

// ====================== COMPONENTE ======================

@Component({
  selector: 'app-sucesiones-patrones',
  standalone: true,
  imports: [Quiz],
  template: `
    <app-quiz
      [vista]="vista()"
      rutaVolver="/razonamiento-logico"
      (volver)="volver()"
      (nivelElegido)="elegirNivel($event)"
      (empezar)="empezar()"
      (respuestaSeleccionada)="seleccionar($event)"
      (avanzar)="siguiente()"
      (reiniciar)="reiniciar()"
      (alternarSonido)="alternarSonido()"
    />
  `
})
export class SucesionesPatrones implements OnInit, OnDestroy {
  private readonly router = inject(Router);
  private readonly gameUi = inject(GameUiService);
  private readonly attempts = inject(AttemptsService);

  private intentoId: string | null = null;
  private intentoInicio = 0;
  private temporizador: ReturnType<typeof setInterval> | null = null;

  // Preguntas de cada nivel (se vuelven a crear al azar cada vez que se empieza)
  private banco: Record<number, PreguntaQuiz[]> = {
    1: crearNivel(1),
    2: crearNivel(2),
    3: crearNivel(3)
  };

  private readonly config: ConfiguracionQuiz = {
    titulo: 'Sucesiones y Patrones',
    descripcion: 'Descubre la regla y completa la secuencia.',
    colorTema: 'purple',
    niveles: 3,
    etiquetasNiveles: ['Básico', 'Intermedio', 'Avanzado'],
    tiempoLimiteSegundos: 30,
    preguntas: [...this.banco[1], ...this.banco[2], ...this.banco[3]]
  };

  readonly vista = signal<QuizViewModel>({
    config: this.config,
    estado: 'intro',
    indice: 0,
    nivelSeleccionado: 1,
    preguntaActual: null,
    total: CANTIDAD,
    etiquetasNiveles: ['Básico', 'Intermedio', 'Avanzado'],
    resultado: {
      correctas: 0,
      incorrectas: 0,
      total: CANTIDAD,
      puntaje: 0,
      porcentaje: 0,
      respuestas: []
    },
    estrellas: 0,
    colorTema: 'purple',
    seleccionada: null,
    esCorrecta: null,
    mostrarConfeti: false,
    sonidosActivos: true,
    segundosRestantes: this.config.tiempoLimiteSegundos ?? 0
  });

  ngOnInit(): void {
    this.gameUi.setJugando(true);
  }

  ngOnDestroy(): void {
    this.detenerTemporizador();
    this.gameUi.setJugando(false);
  }

  volver(): void {
    this.detenerTemporizador();
    this.gameUi.setJugando(false);
    this.router.navigateByUrl('/razonamiento-logico');
  }

  elegirNivel(nivel: number): void {
    if (this.vista().estado !== 'intro') return;
    this.vista.set(this.crearVistaInicial(nivel));
    this.reproducirSonido('click');
  }

  async empezar(): Promise<void> {
    const nivel = this.vista().nivelSeleccionado;
    this.banco[nivel] = crearNivel(nivel); // 25 ejercicios nuevos al azar
    const preguntas = this.preguntasDeNivel(nivel);
    if (preguntas.length === 0) return;
    const sesion = await this.attempts.iniciar('sucesiones-patrones');
    this.intentoId = sesion?.id ?? null;
    this.intentoInicio = sesion?.inicio ?? Date.now();

    this.vista.update((v) => ({
      ...v,
      estado: 'jugando',
      indice: 0,
      total: preguntas.length,
      preguntaActual: preguntas[0],
      resultado: { ...v.resultado, total: preguntas.length },
      seleccionada: null,
      esCorrecta: null,
      mostrarConfeti: false,
      segundosRestantes: this.config.tiempoLimiteSegundos ?? 0
    }));
    this.iniciarTemporizador();
    this.reproducirSonido('click');
  }

  seleccionar(opcionId: string): void {
    const v = this.vista();
    if (v.estado !== 'jugando' || !v.preguntaActual) return;
    this.detenerTemporizador();
    const correcta = opcionId === v.preguntaActual.respuestaCorrectaId;
    const puntos = correcta ? (v.preguntaActual.puntos ?? 10) : 0;
    const resultado: ResultadoQuiz = {
      ...v.resultado,
      correctas: v.resultado.correctas + (correcta ? 1 : 0),
      incorrectas: v.resultado.incorrectas + (correcta ? 0 : 1),
      puntaje: v.resultado.puntaje + puntos,
      respuestas: [
        ...v.resultado.respuestas,
        { preguntaId: v.preguntaActual.id, opcionId, correcta }
      ]
    };
    resultado.porcentaje = v.total > 0 ? Math.round((resultado.correctas / v.total) * 100) : 0;

    this.vista.set({
      ...v,
      estado: 'feedback',
      seleccionada: opcionId,
      esCorrecta: correcta,
      mostrarConfeti: correcta,
      resultado
    });
    this.reproducirSonido(correcta ? 'acierto' : 'error');
  }

  async siguiente(): Promise<void> {
    const v = this.vista();
    const preguntas = this.preguntasDeNivel(v.nivelSeleccionado);
    const next = v.indice + 1;
    if (next >= preguntas.length) {
      await this.terminarPartida(v.resultado.porcentaje, v.resultado);
      return;
    }
    this.vista.set({
      ...v,
      estado: 'jugando',
      indice: next,
      preguntaActual: preguntas[next],
      seleccionada: null,
      esCorrecta: null,
      mostrarConfeti: false,
      segundosRestantes: this.config.tiempoLimiteSegundos ?? 0
    });
    this.iniciarTemporizador();
  }

  reiniciar(): void {
    this.detenerTemporizador();
    this.intentoId = null;
    this.vista.set(this.crearVistaInicial(this.vista().nivelSeleccionado));
  }

  private preguntasDeNivel(nivel: number): PreguntaQuiz[] {
    return this.banco[nivel] ?? this.banco[1];
  }

  alternarSonido(): void {
    this.vista.update((v) => ({ ...v, sonidosActivos: !v.sonidosActivos }));
  }

  private iniciarTemporizador(): void {
    this.detenerTemporizador();
    const limite = this.config.tiempoLimiteSegundos ?? 0;
    if (limite <= 0) return;
    this.temporizador = setInterval(() => {
      const v = this.vista();
      if (v.estado !== 'jugando') {
        this.detenerTemporizador();
        return;
      }
      const restantes = v.segundosRestantes - 1;
      if (restantes <= 0) {
        this.vista.set({ ...v, segundosRestantes: 0 });
        this.seleccionar('__tiempo-agotado__');
        return;
      }
      this.vista.set({ ...v, segundosRestantes: restantes });
    }, 1000);
  }

  private detenerTemporizador(): void {
    if (this.temporizador) {
      clearInterval(this.temporizador);
      this.temporizador = null;
    }
  }

  private async terminarPartida(porcentaje: number, resultado: ResultadoQuiz): Promise<void> {
    const v = this.vista();
    const estrellas = porcentaje >= 80 ? 3 : porcentaje >= 50 ? 2 : 1;
    this.detenerTemporizador();
    this.vista.set({ ...v, estado: 'resultado', estrellas, mostrarConfeti: false });
    this.reproducirSonido(porcentaje >= 50 ? 'exito' : 'error');
    if (this.intentoId) {
      try {
        await this.attempts.finalizar(this.intentoId, this.intentoInicio, {
          actividadId: 'sucesiones-patrones',
          puntaje: resultado.puntaje,
          nivel: v.nivelSeleccionado,
          respuestasCorrectas: resultado.correctas,
          respuestasIncorrectas: resultado.incorrectas
        });
      } catch (e) {
        console.error('No se pudo guardar el intento:', e);
      }
      this.intentoId = null;
    }
  }

  private reproducirSonido(tipo: 'acierto' | 'error' | 'click' | 'exito'): void {
    if (!this.vista().sonidosActivos) return;
    try {
      const ctx = new AudioContext();
      const freqs: Record<string, number[]> = {
        acierto: [523, 659, 784],
        error: [220, 180],
        click: [440],
        exito: [523, 659, 784, 1047]
      };
      const dur = 0.12;
      const ahora = ctx.currentTime;
      (freqs[tipo] ?? [440]).forEach((f, i) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.connect(g);
        g.connect(ctx.destination);
        o.frequency.value = f;
        g.gain.setValueAtTime(0.15, ahora + i * dur);
        g.gain.exponentialRampToValueAtTime(0.001, ahora + i * dur + dur);
        o.start(ahora + i * dur);
        o.stop(ahora + i * dur + dur);
      });
      setTimeout(() => void ctx.close(), 1200);
    } catch {
      // Sin audio: el juego sigue funcionando.
    }
  }

  private crearVistaInicial(nivel: number): QuizViewModel {
    const total = this.preguntasDeNivel(nivel).length || CANTIDAD;
    return {
      config: this.config,
      estado: 'intro',
      indice: 0,
      nivelSeleccionado: nivel,
      preguntaActual: null,
      total,
      etiquetasNiveles: this.config.etiquetasNiveles ?? ['Básico'],
      resultado: {
        correctas: 0,
        incorrectas: 0,
        total,
        puntaje: 0,
        porcentaje: 0,
        respuestas: []
      },
      estrellas: 0,
      colorTema: this.config.colorTema ?? 'purple',
      seleccionada: null,
      esCorrecta: null,
      mostrarConfeti: false,
      sonidosActivos: true,
      segundosRestantes: this.config.tiempoLimiteSegundos ?? 0
    };
  }
}