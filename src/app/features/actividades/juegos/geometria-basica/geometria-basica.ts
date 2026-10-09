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

// Geometría Básica (un solo archivo): 25 ejercicios por nivel con gráficos SVG.
// Cada respuesta se CALCULA con fórmulas a partir de lo que se dibuja.

// ================== Dibujo (trazos SVG) ==================
type Nivel = 'basico' | 'intermedio' | 'avanzado';

// Un trazo es una pieza del dibujo: línea (l), polígono (p), círculo (c) o texto (x)
interface Trazo {
  t: 'l' | 'p' | 'c' | 'x';
  x1?: number; y1?: number; x2?: number; y2?: number; // línea
  pts?: string; // polígono
  cx?: number; cy?: number; r?: number; // círculo
  x?: number; y?: number; s?: string; // texto
  fill?: string;
  stroke?: string;
  dash?: boolean; // línea punteada
}

const INK = '#212529';
const r1 = (n: number) => Math.round(n * 10) / 10;
const linea = (x1: number, y1: number, x2: number, y2: number): Trazo =>
  ({ t: 'l', x1: r1(x1), y1: r1(y1), x2: r1(x2), y2: r1(y2), stroke: INK });
const poligono = (p: number[][], fill = 'none'): Trazo =>
  ({ t: 'p', pts: p.map(q => `${r1(q[0])},${r1(q[1])}`).join(' '), fill, stroke: INK });
const circulo = (cx: number, cy: number, r: number, fill: string): Trazo =>
  ({ t: 'c', cx: r1(cx), cy: r1(cy), r, fill, stroke: INK });
const texto = (x: number, y: number, s: string): Trazo => ({ t: 'x', x: r1(x), y: r1(y), s });

// Números pseudoaleatorios con semilla (para que cada ejercicio siempre se vea igual)
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

// ---------- Convierte los trazos en una imagen SVG (data URI) para el quiz ----------
function svgDe(trazos: Trazo[]): string {
  const piezas = trazos.map(t => {
    if (t.t === 'l') return `<line x1="${t.x1}" y1="${t.y1}" x2="${t.x2}" y2="${t.y2}" stroke="${t.stroke}" stroke-width="2" stroke-linecap="round"${t.dash ? ' stroke-dasharray="6 5"' : ''}/>`;
    if (t.t === 'p') return `<polygon points="${t.pts}" fill="${t.fill}" stroke="${t.stroke}" stroke-width="2" stroke-linejoin="round"/>`;
    if (t.t === 'c') return `<circle cx="${t.cx}" cy="${t.cy}" r="${t.r}" fill="${t.fill}" stroke="${t.stroke}" stroke-width="2"/>`;
    return `<text x="${t.x}" y="${t.y}" text-anchor="middle" font-size="13" font-weight="bold" font-family="sans-serif" fill="#0d6efd">${t.s}</text>`;
  });
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 200"><rect width="300" height="200" fill="#fff"/>${piezas.join('')}</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

// ================== Ejercicios ==================

interface EjercicioGeo {
  id: string;
  nivel: Nivel;
  tema: string;
  pregunta: string;
  trazos: Trazo[];
  opciones: string[]; // textos ya con unidad, ordenados de menor a mayor
  correcta: string; // uno de los textos de opciones
  explicacion: string;
}

interface Base {
  tema: string;
  pregunta: string;
  trazos: Trazo[];
  valor: number; // respuesta numérica
  unidad: string; // 'cm', 'cm²', '°'
  paso: number; // separación de las opciones cercanas
  trampas?: number[]; // errores típicos (ej. confundir área con perímetro)
  explicacion: string;
}

type Pt = number[];
const RAD = Math.PI / 180;
const PI = 3.14;
const redondear = (n: number) => Math.round(n * 100) / 100;

// ---------- Ayudas de dibujo ----------
// Ajusta una figura (con y hacia arriba) al centro del lienzo 300×200 y devuelve la función de conversión
function encajar(pts: Pt[], ancho = 220, alto = 130) {
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const s = Math.min(ancho / (x1 - x0 || 1), alto / (y1 - y0 || 1));
  const ox = 150 - (s * (x0 + x1)) / 2, oy = 100 + (s * (y0 + y1)) / 2;
  return (p: Pt): Pt => [ox + s * p[0], oy - s * p[1]];
}

// Etiqueta junto a un lado, por fuera de la figura
function etLado(P: Pt, Q: Pt, centro: Pt, s: string): Trazo {
  const mx = (P[0] + Q[0]) / 2, my = (P[1] + Q[1]) / 2;
  let nx = -(Q[1] - P[1]), ny = Q[0] - P[0]; // perpendicular al lado
  const L = Math.hypot(nx, ny) || 1;
  nx /= L; ny /= L;
  if (nx * (mx - centro[0]) + ny * (my - centro[1]) < 0) { nx = -nx; ny = -ny; } // hacia afuera
  const d = 8 + Math.abs(nx) * s.length * 3.7 + Math.abs(ny) * 9;
  return texto(mx + nx * d, my + ny * d + 4, s);
}

const centro = (pts: Pt[]): Pt => [pts.reduce((a, p) => a + p[0], 0) / pts.length, pts.reduce((a, p) => a + p[1], 0) / pts.length];
const et = (p: Pt, dx: number, dy: number, s: string) => texto(p[0] + dx, p[1] + dy + 4, s);
const punteada = (a: Pt, b: Pt): Trazo => ({ ...linea(a[0], a[1], b[0], b[1]), dash: true });
const polar = (O: Pt, r: number, grados: number): Pt => [O[0] + r * Math.cos(grados * RAD), O[1] - r * Math.sin(grados * RAD)];
const rayo = (O: Pt, largo: number, grados: number) => { const q = polar(O, largo, grados); return linea(O[0], O[1], q[0], q[1]); };

// Marca de ángulo recto en el vértice P, con direcciones u y v (en pantalla)
function marcaRecta(P: Pt, u: Pt, v: Pt, t = 12): Trazo[] {
  const a = [P[0] + u[0] * t, P[1] + u[1] * t], b = [a[0] + v[0] * t, a[1] + v[1] * t], c = [P[0] + v[0] * t, P[1] + v[1] * t];
  return [linea(a[0], a[1], b[0], b[1]), linea(c[0], c[1], b[0], b[1])];
}

// ---------- Figuras reutilizables ----------
function rectDibujo(w: number, h: number, cuadros = false, etiquetaAlto = true): Trazo[] {
  const f = encajar([[0, 0], [w, h]], 190, 110);
  const A = f([0, 0]), B = f([w, h]); // A abajo-izquierda, B arriba-derecha
  const t: Trazo[] = [poligono([[A[0], A[1]], [B[0], A[1]], [B[0], B[1]], [A[0], B[1]]], '#e7f1ff')];
  if (cuadros) {
    for (let i = 1; i < w; i++) { const x = A[0] + ((B[0] - A[0]) / w) * i; t.push(linea(x, A[1], x, B[1])); }
    for (let i = 1; i < h; i++) { const y = A[1] + ((B[1] - A[1]) / h) * i; t.push(linea(A[0], y, B[0], y)); }
  }
  t.push(texto((A[0] + B[0]) / 2, B[1] - 8, `${w} cm`));
  if (etiquetaAlto) t.push(texto(B[0] + 26, (A[1] + B[1]) / 2 + 4, `${h} cm`));
  return t;
}

// Triángulo con los 3 lados dados: a = lado derecho, b = lado izquierdo, c = base
function triLados(a: number, b: number, c: number, e: [string, string, string]): Trazo[] {
  const rx = (b * b + c * c - a * a) / (2 * c), ry = Math.sqrt(Math.max(b * b - rx * rx, 0));
  const f = encajar([[0, 0], [c, 0], [rx, ry]]);
  const P = f([0, 0]), Q = f([c, 0]), R = f([rx, ry]), G = centro([P, Q, R]);
  return [poligono([P, Q, R], '#e7f1ff'), etLado(P, Q, G, e[2]), etLado(P, R, G, e[1]), etLado(Q, R, G, e[0])];
}

// Triángulo dado por sus ángulos en P (izquierda) y Q (derecha); et = etiquetas de P, Q y R (el vértice de arriba)
function triAngulos(aP: number, bQ: number, e: [string, string, string], exterior = false): Trazo[] {
  const cR = 180 - aP - bQ;
  const PR = Math.sin(bQ * RAD) / Math.sin(cR * RAD);
  const P = [0, 0], Q = [1, 0], R = [PR * Math.cos(aP * RAD), PR * Math.sin(aP * RAD)];
  const pts = exterior ? [P, Q, R, [1.5, 0]] : [P, Q, R];
  const f = encajar(pts, 200, 120);
  const Ps = f(P), Qs = f(Q), Rs = f(R), G = centro([Ps, Qs, Rs]);
  const t: Trazo[] = [poligono([Ps, Qs, Rs], '#e7f1ff')];
  [[Ps, e[0]], [Qs, e[1]], [Rs, e[2]]].forEach(([v, s]) => {
    const p = v as Pt;
    if (s) t.push(texto(p[0] + 0.38 * (G[0] - p[0]), p[1] + 0.38 * (G[1] - p[1]) + 4, s as string));
  });
  if (exterior) {
    const ext = f([1.5, 0]);
    const m = (180 - bQ) / 2;
    t.push(linea(Qs[0], Qs[1], ext[0], ext[1]), texto(Qs[0] + 32 * Math.cos(m * RAD), Qs[1] - 32 * Math.sin(m * RAD) + 4, '?'));
  }
  return t;
}

// Figura en forma de L (se le quita un rectángulo cw×ch a la esquina de arriba a la derecha)
function formaL(W: number, H: number, cw: number, ch: number, modo: 'perimetro' | 'area'): Trazo[] {
  const pts: Pt[] = [[0, 0], [W, 0], [W, H - ch], [W - cw, H - ch], [W - cw, H], [0, H]];
  const f = encajar(pts, 200, 120);
  const s = pts.map(f);
  const t: Trazo[] = [poligono(s, '#fff3cd')];
  t.push(et(f([W / 2, 0]), 0, 18, `${W} cm`), et(f([0, H / 2]), -28, 0, `${H} cm`));
  if (modo === 'perimetro') {
    t.push(et(f([(W - cw) / 2, H]), 0, -14, `${W - cw} cm`), et(f([W, (H - ch) / 2]), 28, 0, `${H - ch} cm`));
  } else {
    t.push(et(f([W - cw / 2, H - ch]), 0, 16, `${cw} cm`), et(f([W - cw, H - ch / 2]), 28, 0, `${ch} cm`));
  }
  return t;
}

function trapecioDibujo(B: number, b: number, h: number): Trazo[] {
  const d = (B - b) / 2;
  const f = encajar([[0, 0], [B, 0], [B - d, h], [d, h]], 210, 115);
  const P = f([0, 0]), Q = f([B, 0]), R = f([B - d, h]), S = f([d, h]);
  return [
    poligono([P, Q, R, S], '#d1e7dd'),
    punteada(S, f([d, 0])),
    et(f([B / 2, 0]), 0, 18, `${B} cm`),
    et(f([B / 2, h]), 0, -12, `${b} cm`),
    et(f([d, h / 2]), 22, 0, `${h} cm`),
  ];
}

// ---------- Opciones de respuesta ----------
const fmt = (v: number, u: string) => `${String(redondear(v)).replace('.', ',')}${u === '°' ? '°' : ' ' + u}`;

function armar(nivel: Nivel, bases: Base[]): EjercicioGeo[] {
  return bases.map((b, i) => {
    const r = rng(nivel.length * 1000 + i);
    const set = new Set<number>([redondear(b.valor)]);
    (b.trampas ?? []).forEach(t => { const v = redondear(t); if (v > 0 && set.size < 4) set.add(v); });
    const cand = [-3, -2, -1, 1, 2, 3].map(d => redondear(b.valor + d * b.paso)).filter(v => v > 0);
    for (let k = cand.length - 1; k > 0; k--) { const j = Math.floor(r() * (k + 1)); [cand[k], cand[j]] = [cand[j], cand[k]]; }
    cand.forEach(v => { if (set.size < 4) set.add(v); });
    const orden = [...set].sort((x, y) => x - y);
    return {
      id: `${nivel}-${i + 1}`,
      nivel,
      tema: b.tema,
      pregunta: b.pregunta,
      trazos: b.trazos,
      opciones: orden.map(v => fmt(v, b.unidad)),
      correcta: fmt(b.valor, b.unidad),
      explicacion: b.explicacion,
    };
  });
}

// ================== BÁSICO ==================
const perimetroRect = (w: number, h: number): Base => ({
  tema: 'Perímetro', pregunta: '¿Cuál es el perímetro del rectángulo?', trazos: rectDibujo(w, h),
  valor: 2 * (w + h), unidad: 'cm', paso: 2, trampas: [w * h],
  explicacion: `El perímetro es la suma de todos los lados: ${w} + ${h} + ${w} + ${h} = ${2 * (w + h)} cm.`,
});

const perimetroCuadrado = (l: number): Base => ({
  tema: 'Perímetro', pregunta: '¿Cuál es el perímetro del cuadrado?', trazos: rectDibujo(l, l, false, false),
  valor: 4 * l, unidad: 'cm', paso: 2, trampas: [l * l, 2 * l],
  explicacion: `Un cuadrado tiene 4 lados iguales: 4 × ${l} = ${4 * l} cm.`,
});

const perimetroTriangulo = (a: number, b: number, c: number): Base => ({
  tema: 'Perímetro', pregunta: '¿Cuál es el perímetro del triángulo?', trazos: triLados(a, b, c, [`${a} cm`, `${b} cm`, `${c} cm`]),
  valor: a + b + c, unidad: 'cm', paso: 1, trampas: [a * b],
  explicacion: `Se suman los tres lados: ${a} + ${b} + ${c} = ${a + b + c} cm.`,
});

const areaRectCuadros = (w: number, h: number): Base => ({
  tema: 'Área', pregunta: 'Cada cuadrito mide 1 cm de lado. ¿Cuál es el área del rectángulo?', trazos: rectDibujo(w, h, true),
  valor: w * h, unidad: 'cm²', paso: 2, trampas: [2 * (w + h)],
  explicacion: `Se cuentan los cuadritos: ${w} columnas × ${h} filas = ${w * h} cm².`,
});

const anguloFaltante = (a: number, b: number): Base => ({
  tema: 'Ángulos', pregunta: '¿Cuánto mide el ángulo marcado con “?”', trazos: triAngulos(a, b, [`${a}°`, `${b}°`, '?']),
  valor: 180 - a - b, unidad: '°', paso: 5, trampas: [a + b],
  explicacion: `Los tres ángulos de un triángulo suman 180°: 180° − ${a}° − ${b}° = ${180 - a - b}°.`,
});

const complementario = (a: number): Base => {
  const O: Pt = [90, 165];
  return {
    tema: 'Ángulos',
    pregunta: 'Los dos ángulos juntos forman un ángulo recto (90°). ¿Cuánto mide el ángulo “?”',
    trazos: [
      linea(O[0], O[1], O[0] + 150, O[1]), linea(O[0], O[1], O[0], O[1] - 140), rayo(O, 140, a),
      ...marcaRecta(O, [1, 0], [0, -1]),
      texto(polar(O, 60, a / 2)[0], polar(O, 60, a / 2)[1] + 4, `${a}°`),
      texto(polar(O, 60, (a + 90) / 2)[0], polar(O, 60, (a + 90) / 2)[1] + 4, '?'),
    ],
    valor: 90 - a, unidad: '°', paso: 5, trampas: [180 - a],
    explicacion: `Un ángulo recto mide 90°: 90° − ${a}° = ${90 - a}°.`,
  };
};

const suplementario = (a: number): Base => {
  const O: Pt = [150, 160];
  return {
    tema: 'Ángulos',
    pregunta: 'Los dos ángulos juntos forman una línea recta (180°). ¿Cuánto mide el ángulo “?”',
    trazos: [
      linea(O[0] - 130, O[1], O[0] + 130, O[1]), rayo(O, 130, a),
      texto(polar(O, 55, a / 2)[0], polar(O, 55, a / 2)[1] + 4, `${a}°`),
      texto(polar(O, 55, (a + 180) / 2)[0], polar(O, 55, (a + 180) / 2)[1] + 4, '?'),
    ],
    valor: 180 - a, unidad: '°', paso: 10, trampas: [a < 90 ? 90 - a : a],
    explicacion: `Una línea recta mide 180°: 180° − ${a}° = ${180 - a}°.`,
  };
};

// ================== INTERMEDIO ==================
const perimetroL = (W: number, H: number, cw: number, ch: number): Base => ({
  tema: 'Perímetro', pregunta: '¿Cuál es el perímetro de la figura?', trazos: formaL(W, H, cw, ch, 'perimetro'),
  valor: 2 * (W + H), unidad: 'cm', paso: 2, trampas: [W * H - cw * ch],
  explicacion: `Los lados que faltan miden ${cw} cm y ${ch} cm. Los escalones se compensan, así que el perímetro es el del rectángulo grande: 2 × (${W} + ${H}) = ${2 * (W + H)} cm.`,
});

const areaTriangulo = (b: number, h: number): Base => {
  const ax = Math.round(b * 0.35);
  const f = encajar([[0, 0], [b, 0], [ax, h]], 200, 120);
  const P = f([0, 0]), Q = f([b, 0]), R = f([ax, h]);
  return {
    tema: 'Área', pregunta: '¿Cuál es el área del triángulo?',
    trazos: [poligono([P, Q, R], '#e7f1ff'), punteada(R, f([ax, 0])), et(f([b / 2, 0]), 0, 18, `${b} cm`), et(f([ax, h / 2]), 24, 0, `${h} cm`)],
    valor: (b * h) / 2, unidad: 'cm²', paso: 2, trampas: [b * h],
    explicacion: `Área del triángulo = base × altura ÷ 2 = ${b} × ${h} ÷ 2 = ${(b * h) / 2} cm².`,
  };
};

const areaL = (W: number, H: number, cw: number, ch: number): Base => ({
  tema: 'Área', pregunta: '¿Cuál es el área de la figura?', trazos: formaL(W, H, cw, ch, 'area'),
  valor: W * H - cw * ch, unidad: 'cm²', paso: 2, trampas: [W * H],
  explicacion: `Al rectángulo grande (${W} × ${H} = ${W * H}) se le quita el rectángulo que falta (${cw} × ${ch} = ${cw * ch}): ${W * H} − ${cw * ch} = ${W * H - cw * ch} cm².`,
});

const areaParalelogramo = (b: number, h: number, l: number, off: number): Base => {
  const f = encajar([[0, 0], [b + off, 0], [b + off, h], [off, h]], 210, 115);
  const P = f([0, 0]), Q = f([b, 0]), R = f([b + off, h]), S = f([off, h]);
  return {
    tema: 'Área', pregunta: '¿Cuál es el área del paralelogramo?',
    trazos: [poligono([P, Q, R, S], '#e7f1ff'), punteada(S, f([off, 0])), et(f([b / 2, 0]), 0, 18, `${b} cm`), et(f([off, h * 0.72]), 22, 0, `${h} cm`), et(f([b + off / 2, h / 2]), 32, 0, `${l} cm`)],
    valor: b * h, unidad: 'cm²', paso: 3, trampas: [b * l],
    explicacion: `Área del paralelogramo = base × altura (la altura es la línea punteada, no el lado inclinado): ${b} × ${h} = ${b * h} cm².`,
  };
};

const anguloExterior = (a: number, b: number): Base => ({
  tema: 'Ángulos', pregunta: 'Se prolongó un lado del triángulo. ¿Cuánto mide el ángulo exterior “?”',
  trazos: triAngulos(a, 180 - a - b, [`${a}°`, '', `${b}°`], true),
  valor: a + b, unidad: '°', paso: 5, trampas: [180 - a - b],
  explicacion: `El ángulo exterior es igual a la suma de los dos ángulos interiores que no están a su lado: ${a}° + ${b}° = ${a + b}°.`,
});

// Dos rectas que se cruzan: se da un ángulo a y se pide el opuesto o el adyacente
const rectasCruzadas = (a: number, pide: 'opuesto' | 'adyacente'): Base => {
  const O: Pt = [150, 100], t = 20;
  const lab = (g: number, s: string) => { const p = polar(O, 42, g); return texto(p[0], p[1] + 4, s); };
  const op = pide === 'opuesto';
  return {
    tema: 'Ángulos',
    pregunta: op ? '¿Cuánto mide el ángulo opuesto por el vértice marcado con “?”' : '¿Cuánto mide el ángulo adyacente marcado con “?”',
    trazos: [
      rayo(O, 110, t), rayo(O, 110, t + 180), rayo(O, 110, t + a), rayo(O, 110, t + a + 180),
      lab(t + a / 2, `${a}°`),
      op ? lab(t + 180 + a / 2, '?') : lab(t + a + (180 - a) / 2, '?'),
    ],
    valor: op ? a : 180 - a, unidad: '°', paso: 10, trampas: [op ? 180 - a : a],
    explicacion: op
      ? `Los ángulos opuestos por el vértice son iguales: ${a}°.`
      : `Dos ángulos adyacentes forman una línea recta y suman 180°: 180° − ${a}° = ${180 - a}°.`,
  };
};

const perimetroIsosceles = (igual: number, base: number): Base => {
  const f = triLados(igual, igual, base, [`${igual} cm`, 'igual', `${base} cm`]);
  return {
    tema: 'Perímetro', pregunta: 'Este triángulo isósceles tiene dos lados iguales. ¿Cuál es su perímetro?', trazos: f,
    valor: 2 * igual + base, unidad: 'cm', paso: 2, trampas: [igual + base],
    explicacion: `Los dos lados iguales miden ${igual} cm: ${igual} + ${igual} + ${base} = ${2 * igual + base} cm.`,
  };
};

const perimetroEquilatero = (l: number): Base => ({
  tema: 'Perímetro', pregunta: 'Este triángulo equilátero tiene sus 3 lados iguales. ¿Cuál es su perímetro?',
  trazos: triLados(l, l, l, ['igual', 'igual', `${l} cm`]),
  valor: 3 * l, unidad: 'cm', paso: 3, trampas: [2 * l],
  explicacion: `Los tres lados miden ${l} cm: 3 × ${l} = ${3 * l} cm.`,
});

const areaTrapecio = (B: number, b: number, h: number): Base => ({
  tema: 'Área', pregunta: '¿Cuál es el área del trapecio?', trazos: trapecioDibujo(B, b, h),
  valor: ((B + b) * h) / 2, unidad: 'cm²', paso: 3, trampas: [(B + b) * h],
  explicacion: `Área del trapecio = (base mayor + base menor) × altura ÷ 2 = (${B} + ${b}) × ${h} ÷ 2 = ${((B + b) * h) / 2} cm².`,
});

// ================== AVANZADO ==================
// Triángulo rectángulo: pa = cateto horizontal, pb = cateto vertical; e = etiquetas [horizontal, vertical, hipotenusa]
function trianguloRecto(a: number, b: number, e: [string, string, string]): Trazo[] {
  const f = encajar([[0, 0], [a, 0], [0, b]], 200, 120);
  const P = f([0, 0]), Q = f([a, 0]), R = f([0, b]), G = centro([P, Q, R]);
  return [poligono([P, Q, R], '#e7f1ff'), ...marcaRecta(P, [1, 0], [0, -1]), etLado(P, Q, G, e[0]), etLado(P, R, G, e[1]), etLado(Q, R, G, e[2])];
}

const hipotenusa = (a: number, b: number): Base => {
  const c = Math.sqrt(a * a + b * b);
  return {
    tema: 'Pitágoras', pregunta: '¿Cuánto mide la hipotenusa (el lado “?”)?', trazos: trianguloRecto(a, b, [`${a} cm`, `${b} cm`, '?']),
    valor: c, unidad: 'cm', paso: 2, trampas: [a + b],
    explicacion: `Teorema de Pitágoras: c² = ${a}² + ${b}² = ${a * a} + ${b * b} = ${a * a + b * b}, y la raíz cuadrada de ${a * a + b * b} es ${c} cm.`,
  };
};

const cateto = (c: number, a: number): Base => {
  const b = Math.sqrt(c * c - a * a);
  return {
    tema: 'Pitágoras', pregunta: '¿Cuánto mide el cateto marcado con “?”', trazos: trianguloRecto(b, a, ['?', `${a} cm`, `${c} cm`]),
    valor: b, unidad: 'cm', paso: 2, trampas: [c - a],
    explicacion: `Teorema de Pitágoras: cateto² = ${c}² − ${a}² = ${c * c} − ${a * a} = ${c * c - a * a}, y la raíz cuadrada de ${c * c - a * a} es ${b} cm.`,
  };
};

const casa = (W: number, H: number, t: number): Base => {
  const f = encajar([[0, 0], [W, 0], [W, H], [W / 2, H + t], [0, H]], 190, 130);
  const pts: Pt[] = [[0, 0], [W, 0], [W, H], [W / 2, H + t], [0, H]].map(f);
  return {
    tema: 'Área', pregunta: 'La figura es un rectángulo con un triángulo encima. ¿Cuál es su área total?',
    trazos: [
      poligono(pts, '#fff3cd'), linea(f([0, H])[0], f([0, H])[1], f([W, H])[0], f([W, H])[1]), punteada(f([W / 2, H + t]), f([W / 2, H])),
      et(f([W / 2, 0]), 0, 18, `${W} cm`), et(f([0, H / 2]), -28, 0, `${H} cm`), et(f([W / 2, H + t * 0.3]), 20, 0, `${t} cm`),
    ],
    valor: W * H + (W * t) / 2, unidad: 'cm²', paso: 4, trampas: [W * H + W * t],
    explicacion: `Rectángulo: ${W} × ${H} = ${W * H}. Triángulo: ${W} × ${t} ÷ 2 = ${(W * t) / 2}. Total: ${W * H} + ${(W * t) / 2} = ${W * H + (W * t) / 2} cm².`,
  };
};

const circunferencia = (r: number): Base => ({
  tema: 'Círculo', pregunta: 'Usa π = 3,14. ¿Cuánto mide la longitud de la circunferencia?',
  trazos: [circulo(150, 100, 70, '#e7f1ff'), linea(150, 100, 220, 100), circulo(150, 100, 3, '#212529'), texto(185, 90, `r = ${r} cm`)],
  valor: 2 * PI * r, unidad: 'cm', paso: 5, trampas: [PI * r * r, PI * r],
  explicacion: `Longitud = 2 × π × r = 2 × 3,14 × ${r} = ${redondear(2 * PI * r)} cm.`,
});

const areaCirculo = (r: number): Base => ({
  tema: 'Círculo', pregunta: 'Usa π = 3,14. ¿Cuál es el área del círculo?',
  trazos: [circulo(150, 100, 70, '#e7f1ff'), linea(150, 100, 220, 100), circulo(150, 100, 3, '#212529'), texto(185, 90, `r = ${r} cm`)],
  valor: PI * r * r, unidad: 'cm²', paso: r > 5 ? 20 : 4, trampas: [2 * PI * r],
  explicacion: `Área = π × r² = 3,14 × ${r} × ${r} = ${redondear(PI * r * r)} cm².`,
});

// Polígono regular de n lados; con diagonales punteadas desde un vértice, o con un ángulo marcado “?”
function poligonoRegular(n: number, modo: 'diagonales' | 'angulo'): Trazo[] {
  const O: Pt = [150, 100];
  const V = Array.from({ length: n }, (_, i) => polar(O, 78, 90 + (360 / n) * i));
  const t: Trazo[] = [poligono(V, '#e7f1ff')];
  if (modo === 'diagonales') for (let i = 2; i < n - 1; i++) t.push(punteada(V[0], V[i]));
  else t.push(texto(V[0][0] + 0.3 * (O[0] - V[0][0]), V[0][1] + 0.3 * (O[1] - V[0][1]) + 4, '?'));
  return t;
}

const sumaInteriores = (n: number): Base => ({
  tema: 'Polígonos', pregunta: `Este polígono tiene ${n} lados. ¿Cuánto suman sus ángulos interiores?`, trazos: poligonoRegular(n, 'diagonales'),
  valor: (n - 2) * 180, unidad: '°', paso: 180, trampas: [n * 180, (n - 1) * 180],
  explicacion: `Desde un vértice se trazan diagonales y se forman ${n - 2} triángulos. Cada uno suma 180°: ${n - 2} × 180° = ${(n - 2) * 180}°.`,
});

const anguloRegular = (n: number): Base => ({
  tema: 'Polígonos', pregunta: `Es un polígono regular de ${n} lados. ¿Cuánto mide cada ángulo interior?`, trazos: poligonoRegular(n, 'angulo'),
  valor: ((n - 2) * 180) / n, unidad: '°', paso: 5, trampas: [360 / n, (n - 2) * 180],
  explicacion: `Los ángulos suman (${n} − 2) × 180° = ${(n - 2) * 180}°. Como son ${n} ángulos iguales: ${(n - 2) * 180}° ÷ ${n} = ${((n - 2) * 180) / n}°.`,
});

// Dos paralelas cortadas por una transversal. Región r (1..4) en la intersección i (1 = arriba, 2 = abajo):
// r1 = arriba-derecha, r2 = arriba-izquierda, r3 = abajo-izquierda, r4 = abajo-derecha
function paralelas(dado: [number, number, number], pide: [number, number], relacion: string): Base {
  const [di, dr, a] = dado;
  const t = dr % 2 === 1 ? a : 180 - a; // ángulo de la transversal con la horizontal
  const yA = 65, yB = 135, x1 = 165, x2 = x1 - (yB - yA) / Math.tan(t * RAD);
  const X = [[x1, yA], [x2, yB]];
  const medio = (r: number) => (r === 1 ? t / 2 : r === 2 ? (t + 180) / 2 : r === 3 ? 180 + t / 2 : (180 + t + 360) / 2);
  const valor = (r: number) => (r % 2 === 1 ? t : 180 - t);
  const lab = (i: number, r: number, s: string) => { const p = polar(X[i - 1], 30, medio(r)); return texto(p[0], p[1] + 4, s); };
  const dx = Math.cos(t * RAD) * 45, dy = Math.sin(t * RAD) * 45;
  return {
    tema: 'Paralelas',
    pregunta: 'Las dos rectas horizontales son paralelas. ¿Cuánto mide el ángulo marcado con “?”',
    trazos: [
      linea(20, yA, 280, yA), linea(20, yB, 280, yB),
      linea(x1 + dx, yA - dy, x2 - dx, yB + dy),
      lab(di, dr, `${a}°`), lab(pide[0], pide[1], '?'),
    ],
    valor: valor(pide[1]), unidad: '°', paso: 10, trampas: [180 - valor(pide[1])],
    explicacion: `Los dos ángulos son ${relacion}. ` + (valor(pide[1]) === a ? `Por eso son iguales: ${a}°.` : `Por eso suman 180°: 180° − ${a}° = ${180 - a}°.`),
  };
}

// ---------- Armado de los tres niveles ----------
const BASICO = armar('basico', [
  ...[[6, 4], [8, 3], [10, 5], [7, 2], [9, 7]].map(([w, h]) => perimetroRect(w, h)),
  ...[5, 8, 12].map(l => perimetroCuadrado(l)),
  ...[[3, 4, 5], [5, 5, 6], [6, 7, 8]].map(([a, b, c]) => perimetroTriangulo(a, b, c)),
  ...[[4, 3], [5, 4], [6, 3], [7, 5]].map(([w, h]) => areaRectCuadros(w, h)),
  ...[[50, 60], [35, 85], [90, 35], [45, 45]].map(([a, b]) => anguloFaltante(a, b)),
  ...[25, 40, 65].map(a => complementario(a)),
  ...[40, 110, 135].map(a => suplementario(a)),
]);

const INTERMEDIO = armar('intermedio', [
  ...[[10, 8, 4, 3], [12, 9, 5, 4], [8, 6, 3, 2], [14, 10, 6, 4]].map(([W, H, cw, ch]) => perimetroL(W, H, cw, ch)),
  ...[[6, 4], [8, 5], [10, 6], [7, 6]].map(([b, h]) => areaTriangulo(b, h)),
  ...[[10, 8, 4, 3], [12, 9, 5, 4], [8, 6, 3, 2]].map(([W, H, cw, ch]) => areaL(W, H, cw, ch)),
  ...[[9, 4, 5, 3], [10, 6, 10, 8], [7, 12, 13, 5]].map(([b, h, l, o]) => areaParalelogramo(b, h, l, o)),
  ...[[50, 60], [40, 75], [65, 55]].map(([a, b]) => anguloExterior(a, b)),
  rectasCruzadas(50, 'opuesto'), rectasCruzadas(65, 'adyacente'), rectasCruzadas(130, 'adyacente'),
  perimetroIsosceles(8, 5), perimetroIsosceles(7, 4),
  ...[[10, 6, 4], [12, 8, 5], [9, 5, 6]].map(([B, b, h]) => areaTrapecio(B, b, h)),
]);

const AVANZADO = armar('avanzado', [
  ...[[3, 4], [5, 12], [8, 15], [9, 12]].map(([a, b]) => hipotenusa(a, b)),
  ...[[13, 5], [10, 6]].map(([c, a]) => cateto(c, a)),
  ...[[14, 8, 6], [16, 10, 7]].map(([B, b, h]) => areaTrapecio(B, b, h)),
  ...[[6, 4, 3], [8, 5, 4], [10, 6, 4]].map(([W, H, t]) => casa(W, H, t)),
  ...[5, 10].map(r => circunferencia(r)),
  ...[4, 10].map(r => areaCirculo(r)),
  ...[5, 6, 8].map(n => sumaInteriores(n)),
  ...[9, 10, 12].map(n => anguloRegular(n)),
  paralelas([1, 1, 65], [2, 1], 'correspondientes (están en la misma posición en cada intersección)'),
  paralelas([1, 4, 110], [2, 2], 'alternos internos (están entre las paralelas y en lados opuestos de la transversal)'),
  paralelas([1, 4, 70], [2, 1], 'colaterales internos (están entre las paralelas y del mismo lado de la transversal)'),
  paralelas([1, 2, 130], [2, 3], 'colaterales externos (están fuera de las paralelas y del mismo lado de la transversal)'),
]);

const EJERCICIOS_GEO: Record<Nivel, EjercicioGeo[]> = {
  basico: BASICO,
  intermedio: INTERMEDIO,
  avanzado: AVANZADO,
};

// ================== Componente ==================
@Component({
  selector: "app-geometria-basica",
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
export class GeometriaBasica implements OnInit, OnDestroy {
  private readonly gameUi = inject(GameUiService);
  private readonly attempts = inject(AttemptsService);
  private readonly router = inject(Router);
  private intentoId: string | null = null;
  private intentoInicio = 0;

  readonly config: ConfiguracionQuiz = {
    titulo: "Geometría Básica",
    descripcion: "Explora figuras, perímetros y relaciones geométricas.",
    colorTema: "orange",
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
    colorTema: "orange",
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
    void this.attempts.iniciar("geometria-basica").then((s) => {
      this.intentoId = s?.id ?? null;
      this.intentoInicio = s?.inicio ?? Date.now();
    });
  }
  ngOnDestroy(): void {
    this.gameUi.setJugando(false);
    if (this.intentoId)
      void this.attempts.finalizar(this.intentoId, this.intentoInicio, {
        actividadId: "geometria-basica",
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
      colorTema: "orange",
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
      for (const e of EJERCICIOS_GEO[nombre]) {
        out.push({
          id: `gb-${e.id}`,
          enunciado: e.pregunta,
          imagen: svgDe(e.trazos), // gráfico del ejercicio (campo opcional en PreguntaQuiz)
          tipo: "opcion-multiple" as TipoPregunta,
          nivel: idx + 1,
          opciones: e.opciones.map((o, i) => ({ id: ids[i], texto: o })),
          respuestaCorrectaId: ids[e.opciones.indexOf(e.correcta)], // las opciones ya traen su unidad
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
