
// Sucesiones y Patrones: 25 ejercicios por nivel con gráficos SVG (banco
// compartido por la actividad y el Módulo Docente).
// Cada respuesta y cada explicación se CALCULAN a partir de los datos del ejercicio.

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
export const r1 = (n: number) => Math.round(n * 10) / 10;
export const linea = (x1: number, y1: number, x2: number, y2: number): Trazo =>
  ({ t: "l", x1: r1(x1), y1: r1(y1), x2: r1(x2), y2: r1(y2), stroke: INK });
export const poligono = (p: number[][], fill = "none"): Trazo =>
  ({ t: "p", pts: p.map(q => `${r1(q[0])},${r1(q[1])}`).join(" "), fill, stroke: INK });
export const circulo = (cx: number, cy: number, r: number, fill: string): Trazo =>
  ({ t: "c", cx: r1(cx), cy: r1(cy), r, fill, stroke: INK });
export const texto = (x: number, y: number, s: string, size = 13, fill = INK): Trazo =>
  ({ t: "x", x: r1(x), y: r1(y), s, size, fill });

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
// Sin rectángulo de fondo blanco: la figura se pinta sobre el fondo del tema de
// la plantilla, así no se ve un parche claro alrededor de las figuras. Trazo y
// etiqueta van algo más gruesos/grandes porque en móvil la imagen se reduce.
export function svgDe(trazos: Trazo[]): string {
  const piezas = trazos.map(t => {
    if (t.t === "l") return `<line x1="${t.x1}" y1="${t.y1}" x2="${t.x2}" y2="${t.y2}" stroke="${t.stroke}" stroke-width="3" stroke-linecap="round"/>`;
    if (t.t === "p") return `<polygon points="${t.pts}" fill="${t.fill}" stroke="${t.stroke}" stroke-width="3" stroke-linejoin="round"/>`;
    if (t.t === "c") return `<circle cx="${t.cx}" cy="${t.cy}" r="${t.r}" fill="${t.fill}" stroke="${t.stroke}" stroke-width="3"/>`;
    return `<text x="${t.x}" y="${t.y}" text-anchor="middle" font-size="${t.size ?? 20}" font-weight="bold" font-family="sans-serif" fill="${t.fill}" stroke="#ffffff" stroke-width="4" paint-order="stroke">${t.s}</text>`;
  });
  // El lienzo se RECORTA al dibujo: si no, el SVG de 300x200 con los trazos en
  // la franja central lleva medio lienzo en blanco y, al escalarlo el quiz, ese
  // blanco se convierte en dos franjas huecas alrededor de las figuras.
  const { x, y, w, h } = caja(trazos);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x} ${y} ${w} ${h}">${piezas.join("")}</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

// Caja mínima que encierra los trazos, con un margen para que el borde de las
// figuras no quede pegado al recorte.
export function caja(trazos: Trazo[]): { x: number; y: number; w: number; h: number } {
  const M = 8;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const ver = (px: number, py: number) => {
    x0 = Math.min(x0, px); x1 = Math.max(x1, px);
    y0 = Math.min(y0, py); y1 = Math.max(y1, py);
  };
  for (const t of trazos) {
    if (t.t === "l") { ver(t.x1!, t.y1!); ver(t.x2!, t.y2!); }
    else if (t.t === "p") t.pts!.split(" ").forEach(p => { const [px, py] = p.split(",").map(Number); ver(px, py); });
    else if (t.t === "c") { ver(t.cx! - t.r!, t.cy! - t.r!); ver(t.cx! + t.r!, t.cy! + t.r!); }
    else {
      // Texto: se estima su ancho/alto a partir del tamaño de fuente.
      const hw = (t.s?.length ?? 1) * (t.size ?? 13) * 0.35;
      ver(t.x! - hw, t.y! - (t.size ?? 13)); ver(t.x! + hw, t.y! + 3);
    }
  }
  if (!Number.isFinite(x0)) return { x: 0, y: 0, w: 300, h: 200 };
  return { x: r1(x0 - M), y: r1(y0 - M), w: r1(x1 - x0 + 2 * M), h: r1(y1 - y0 + 2 * M) };
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

export interface Base {
  tema: string;
  pregunta: string;
  trazos: Trazo[];
  explicacion: string;
  // Respuesta numérica (se generan las opciones cercanas)...
  valor?: number;
  paso?: number;
  trampas?: number[]; // errores típicos
  // ...o respuesta de texto con opciones fijas
  fijas?: string[];
  correctaTexto?: string;
}

// Separación de las opciones cercanas según el tamaño de la respuesta
export const pasoPara = (v: number) => (v < 20 ? 1 : v < 60 ? 2 : v < 200 ? 5 : v < 800 ? 20 : 50);
export const SUP = "⁰¹²³⁴⁵⁶⁷⁸⁹";
export const sup = (n: number) => String(n).split("").map(d => SUP[+d]).join("");

// ================== Gráficos ==================
export const CAJA = "#e7f1ff";
export const HUECO = "#fff3cd";

// Fila de casillas con números; "?" es la casilla a descubrir y "…" indica que sigue
export function cajas(items: string[]): Trazo[] {
  const n = items.length;
  const w = Math.min(44, (284 - 6 * (n - 1)) / n);
  const x0 = (300 - (n * w + 6 * (n - 1))) / 2;
  const y = 82, h = 38;
  const t: Trazo[] = [];
  items.forEach((it, i) => {
    const x = x0 + i * (w + 6);
    if (it === "…") { t.push(texto(x + w / 2, y + 28, "…", 22)); return; }
    t.push(poligono([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], it === "?" ? HUECO : CAJA));
    t.push(texto(x + w / 2, y + 25, it, it.length > 3 ? 13 : 16));
  });
  return t;
}

// Figuras pequeñas para los patrones: 0 círculo, 1 cuadrado, 2 triángulo, 3 rombo
export const NOMBRES = ["Círculo", "Cuadrado", "Triángulo", "Rombo"];
export function formaMini(tipo: number, cx: number, cy: number, r = 15): Trazo {
  if (tipo === 0) return circulo(cx, cy, r, "#cfe2ff");
  if (tipo === 1) return poligono([[cx - r, cy - r], [cx + r, cy - r], [cx + r, cy + r], [cx - r, cy + r]], "#d1e7dd");
  if (tipo === 2) return poligono([[cx, cy - r - 2], [cx - r - 2, cy + r], [cx + r + 2, cy + r]], "#f8d7da");
  return poligono([[cx, cy - r - 3], [cx + r + 3, cy], [cx, cy + r + 3], [cx - r - 3, cy]], "#fff3cd");
}

// Fila de figuras seguida de "?" o "…"; con numerar=true se escribe el lugar de cada figura
export function filaFormas(seq: number[], final: "?" | "…", numerar: boolean): Trazo[] {
  const items = seq.length + 1;
  const paso = Math.min(42, 280 / items);
  const x = (i: number) => 150 + (i - (items - 1) / 2) * paso;
  const t: Trazo[] = [];
  seq.forEach((f, i) => {
    t.push(formaMini(f, x(i), 90));
    if (numerar) t.push(texto(x(i), 135, String(i + 1), 12, GRIS));
  });
  const i = seq.length;
  if (final === "?") {
    t.push(poligono([[x(i) - 16, 74], [x(i) + 16, 74], [x(i) + 16, 106], [x(i) - 16, 106]], HUECO), texto(x(i), 98, "?", 20));
  } else t.push(texto(x(i), 98, "…", 24));
  return t;
}

// Figuras que crecen (puntos o palitos)
export type TipoCrec = "palitos" | "triangulo" | "cuadrado" | "ele" | "cruz" | "oblongo";

export const CREC: Record<TipoCrec, { v: (k: number) => number; regla: string; formula: (k: number) => string; que: string }> = {
  palitos: { v: k => 3 * k + 1, que: "palitos", regla: "Cada figura tiene 3 palitos más que la anterior", formula: k => `3 × ${k} + 1` },
  triangulo: { v: k => (k * (k + 1)) / 2, que: "puntos", regla: "Cada figura agrega una fila nueva con un punto más que la fila anterior", formula: k => `${k} × ${k + 1} ÷ 2` },
  cuadrado: { v: k => k * k, que: "puntos", regla: "La figura k forma un cuadrado de k × k puntos", formula: k => `${k} × ${k}` },
  ele: { v: k => 2 * k - 1, que: "puntos", regla: "Cada figura agrega 2 puntos (uno en cada brazo de la L)", formula: k => `2 × ${k} − 1` },
  cruz: { v: k => 4 * k + 1, que: "puntos", regla: "Cada figura agrega 4 puntos (uno en cada brazo de la cruz)", formula: k => `4 × ${k} + 1` },
  oblongo: { v: k => k * (k + 1), que: "puntos", regla: "La figura k tiene k filas de k + 1 puntos", formula: k => `${k} × ${k + 1}` },
};

export function dibujarCrec(tipo: TipoCrec, k: number, cx: number, cy: number): Trazo[] {
  const t: Trazo[] = [];
  const punto = (x: number, y: number) => t.push(circulo(x, y, 5, "#0d6efd"));
  const d = tipo === "cruz" ? 13 : 16;
  if (tipo === "palitos") {
    const s = 18, x0 = cx - (k * s) / 2, y0 = cy - s / 2;
    for (let i = 0; i < k; i++) t.push(linea(x0 + i * s, y0, x0 + (i + 1) * s, y0), linea(x0 + i * s, y0 + s, x0 + (i + 1) * s, y0 + s));
    for (let i = 0; i <= k; i++) t.push(linea(x0 + i * s, y0, x0 + i * s, y0 + s));
  } else if (tipo === "triangulo") {
    for (let i = 0; i < k; i++) for (let j = 0; j <= i; j++) punto(cx - (i * d) / 2 + j * d, cy - ((k - 1) * d) / 2 + i * d);
  } else if (tipo === "cuadrado") {
    for (let i = 0; i < k; i++) for (let j = 0; j < k; j++) punto(cx - ((k - 1) * d) / 2 + j * d, cy - ((k - 1) * d) / 2 + i * d);
  } else if (tipo === "ele") {
    const x0 = cx - ((k - 1) * d) / 2, y0 = cy - ((k - 1) * d) / 2;
    for (let r = 0; r < k; r++) punto(x0, y0 + r * d);
    for (let c = 1; c < k; c++) punto(x0 + c * d, y0 + (k - 1) * d);
  } else if (tipo === "cruz") {
    punto(cx, cy);
    for (let m = 1; m <= k; m++) { punto(cx + m * d, cy); punto(cx - m * d, cy); punto(cx, cy + m * d); punto(cx, cy - m * d); }
  } else {
    for (let i = 0; i < k; i++) for (let j = 0; j <= k; j++) punto(cx - (k * d) / 2 + j * d, cy - ((k - 1) * d) / 2 + i * d);
  }
  return t;
}

// ================== Constructores de ejercicios ==================
// Describe la regla de una sucesión (el último número es la respuesta)
export function describir(t: number[], manual?: string): string {
  if (manual) return manual;
  const n = t.length, last = t[n - 1], prev = t[n - 2];
  const dif = t.slice(1).map((v, i) => v - t[i]);
  if (dif.every(d => d === dif[0])) {
    return dif[0] >= 0 ? `Se suma ${dif[0]} cada vez: ${prev} + ${dif[0]} = ${last}.` : `Se resta ${-dif[0]} cada vez: ${prev} − ${-dif[0]} = ${last}.`;
  }
  if (t.every(v => v !== 0) && t.slice(1).every((v, i) => v % t[i] === 0 && v / t[i] === t[1] / t[0])) {
    return `Se multiplica por ${t[1] / t[0]} cada vez: ${prev} × ${t[1] / t[0]} = ${last}.`;
  }
  if (t.length > 3 && t.slice(2).every((v, i) => v === t[i + 1] + t[i])) {
    return `Cada número es la suma de los dos anteriores: ${t[n - 3]} + ${prev} = ${last}.`;
  }
  if (t.length > 4 && t.slice(3).every((v, i) => v === t[i + 2] + t[i + 1] + t[i])) {
    return `Cada número es la suma de los tres anteriores: ${t[n - 4]} + ${t[n - 3]} + ${prev} = ${last}.`;
  }
  const d2 = dif.slice(1).map((v, i) => v - dif[i]);
  if (d2.every(d => d === d2[0])) {
    return `Las diferencias entre números seguidos son ${dif.slice(0, -1).join(", ")}…: aumentan ${d2[0]} cada vez, así que ahora se suma ${dif[dif.length - 1]}: ${prev} + ${dif[dif.length - 1]} = ${last}.`;
  }
  return "";
}

// ¿Qué número sigue? (el último elemento de la lista es la respuesta)
export function siguiente(terms: number[], manual?: string, trampas?: number[]): Base {
  const mostrar = terms.slice(0, -1), valor = terms[terms.length - 1];
  const p = mostrar[mostrar.length - 1], p2 = mostrar[mostrar.length - 2];
  return {
    tema: "Sucesiones numéricas", pregunta: "¿Qué número sigue en la sucesión?",
    trazos: cajas([...mostrar.map(String), "?"]),
    valor, paso: pasoPara(valor), trampas: trampas ?? [p + (p - p2)],
    explicacion: describir(terms, manual),
  };
}

// ¿Qué número falta? (el hueco está en la posición idx)
export function faltante(terms: number[], idx: number, explicacion: string): Base {
  const items = terms.map(String);
  items[idx] = "?";
  return {
    tema: "Sucesiones numéricas", pregunta: "¿Qué número falta en la sucesión?", trazos: cajas(items),
    valor: terms[idx], paso: pasoPara(terms[idx]), trampas: [terms[idx] + 2], explicacion,
  };
}

// Término del lugar n de una sucesión que suma d cada vez
export function terminoN(a1: number, d: number, n: number): Base {
  const vals = [0, 1, 2, 3, 4].map(i => a1 + i * d);
  const valor = a1 + (n - 1) * d;
  return {
    tema: "Término general", pregunta: `¿Qué número ocupa el lugar ${n} de esta sucesión?`, trazos: cajas([...vals.map(String), "…"]),
    valor, paso: pasoPara(valor), trampas: [a1 + n * d, n * Math.abs(d)],
    explicacion: `Cada número se obtiene ${d < 0 ? "restando" : "sumando"} ${Math.abs(d)}. El lugar ${n} es ${a1} ${d < 0 ? "−" : "+"} ${n - 1} × ${Math.abs(d)} = ${valor}.`,
  };
}

// Término del lugar n de una sucesión que multiplica por r cada vez
export function terminoGeometrico(a: number, r: number, n: number): Base {
  const vals = [0, 1, 2, 3].map(i => a * r ** i);
  const valor = a * r ** (n - 1);
  return {
    tema: "Término general", pregunta: `¿Qué número ocupa el lugar ${n} de esta sucesión?`, trazos: cajas([...vals.map(String), "…"]),
    valor, paso: pasoPara(valor), trampas: [a * r ** n, a * r * (n - 1)],
    explicacion: `Se multiplica por ${r} cada vez. El lugar ${n} es ${a} × ${r}${sup(n - 1)} = ${a} × ${r ** (n - 1)} = ${valor}.`,
  };
}

// Suma de los primeros n términos de una sucesión que suma d cada vez
export function sumaAritmetica(a1: number, d: number, n: number): Base {
  const vals = [0, 1, 2, 3].map(i => a1 + i * d);
  const ult = a1 + (n - 1) * d, valor = ((a1 + ult) * n) / 2;
  return {
    tema: "Sumas de sucesiones", pregunta: `¿Cuánto suman los primeros ${n} números de esta sucesión?`, trazos: cajas([...vals.map(String), "…"]),
    valor, paso: pasoPara(valor), trampas: [ult * n, valor - ult],
    explicacion: `El número del lugar ${n} es ${ult}. Se suma el primero con el último y se multiplica por la cantidad de números ÷ 2: (${a1} + ${ult}) × ${n} ÷ 2 = ${valor}.`,
  };
}

// Patrón de figuras que se repite: ¿qué figura sigue?
export function cicloSigue(patron: number[], mostrar: number): Base {
  const L = patron.length;
  const seq = Array.from({ length: mostrar }, (_, i) => patron[i % L]);
  const sig = patron[mostrar % L];
  return {
    tema: "Patrones de figuras", pregunta: "¿Qué figura sigue en el patrón?", trazos: filaFormas(seq, "?", false),
    fijas: NOMBRES, correctaTexto: NOMBRES[sig],
    explicacion: `El patrón se repite cada ${L} figuras: ${patron.map(f => NOMBRES[f].toLowerCase()).join(", ")}. Después de la figura ${mostrar} toca la figura ${(mostrar % L) + 1} del patrón: ${NOMBRES[sig].toLowerCase()}.`,
  };
}

// Patrón de figuras que se repite: ¿qué figura ocupa el lugar n?
export function cicloLugar(patron: number[], lugar: number): Base {
  const L = patron.length;
  const seq = Array.from({ length: Math.min(8, L * 2) }, (_, i) => patron[i % L]);
  const idx = (lugar - 1) % L, q = Math.floor(lugar / L), r = lugar % L;
  return {
    tema: "Patrones de figuras", pregunta: `Si el patrón sigue así, ¿qué figura ocupa el lugar ${lugar}?`, trazos: filaFormas(seq, "…", true),
    fijas: NOMBRES, correctaTexto: NOMBRES[patron[idx]],
    explicacion: `El patrón de ${L} figuras (${patron.map(f => NOMBRES[f].toLowerCase()).join(", ")}) se repite. ${lugar} ÷ ${L} da cociente ${q} y resto ${r}. ` +
      (r === 0 ? "Como el resto es 0, es la última figura del patrón" : `El resto ${r} indica la figura n.º ${r} del patrón`) + `: ${NOMBRES[patron[idx]].toLowerCase()}.`,
  };
}

// Figuras que crecen: se muestran las primeras y se pregunta por la figura "pide"
export function crece(tipo: TipoCrec, pide: number, mostrar = 3): Base {
  const c = CREC[tipo];
  const trazos: Trazo[] = [];
  for (let i = 1; i <= mostrar; i++) {
    const cx = (300 / mostrar) * (i - 0.5);
    trazos.push(...dibujarCrec(tipo, i, cx, 88), texto(cx, 165, `Figura ${i}`, 12, GRIS));
  }
  const valor = c.v(pide);
  const lineal = c.v(mostrar) + (c.v(mostrar) - c.v(mostrar - 1)) * (pide - mostrar);
  const lista = Array.from({ length: pide }, (_, i) => c.v(i + 1)).join(", ");
  return {
    tema: "Figuras que crecen", pregunta: `¿Cuántos ${c.que} tendrá la figura ${pide}?`, trazos,
    valor, paso: pasoPara(valor), trampas: [lineal, c.v(pide - 1)],
    explicacion: `${c.regla}. Figura ${pide}: ${c.formula(pide)} = ${valor}.` + (pide <= 7 ? ` (Valores: ${lista}.)` : ""),
  };
}

// ================== Armado de los tres niveles ==================
export function armar(nivel: Nivel, bases: Base[]): Ejercicio[] {
  return bases.map((b, i) => {
    const r = rng(nivel.length * 1000 + i);
    let opciones: string[], correcta: string;
    if (b.fijas) {
      opciones = [...b.fijas];
      for (let k = opciones.length - 1; k > 0; k--) { const j = Math.floor(r() * (k + 1)); [opciones[k], opciones[j]] = [opciones[j], opciones[k]]; }
      correcta = b.correctaTexto!;
    } else {
      const valor = b.valor!, paso = b.paso!;
      const set = new Set<number>([valor]);
      (b.trampas ?? []).forEach(t => { if (t > 0 && Number.isInteger(t) && set.size < 4) set.add(t); });
      const cand = [-3, -2, -1, 1, 2, 3].map(d => valor + d * paso).filter(v => v > 0);
      for (let k = cand.length - 1; k > 0; k--) { const j = Math.floor(r() * (k + 1)); [cand[k], cand[j]] = [cand[j], cand[k]]; }
      cand.forEach(v => { if (set.size < 4) set.add(v); });
      opciones = [...set].sort((x, y) => x - y).map(String);
      correcta = String(valor);
    }
    return { id: `${nivel}-${i + 1}`, nivel, tema: b.tema, pregunta: b.pregunta, trazos: b.trazos, opciones, correcta, explicacion: b.explicacion };
  });
}

export const BASICO = armar("basico", [
  // sumar o restar siempre lo mismo
  ...[[2, 4, 6, 8, 10], [5, 10, 15, 20, 25], [3, 6, 9, 12, 15], [10, 20, 30, 40, 50], [1, 4, 7, 10, 13], [20, 18, 16, 14, 12], [50, 45, 40, 35, 30], [7, 14, 21, 28, 35]].map(t => siguiente(t)),
  // multiplicar siempre por lo mismo
  ...[[1, 2, 4, 8, 16], [2, 4, 8, 16, 32], [3, 6, 12, 24, 48]].map(t => siguiente(t)),
  // cuadrados, impares y múltiplos
  siguiente([1, 4, 9, 16, 25], "Son los números multiplicados por sí mismos: 1×1, 2×2, 3×3, 4×4 y 5×5 = 25."),
  siguiente([11, 13, 15, 17, 19]),
  siguiente([0, 5, 10, 15, 20]),
  // patrones de figuras
  cicloSigue([0, 2], 5), cicloSigue([1, 2], 5), cicloSigue([0, 0, 2], 7), cicloSigue([0, 1, 2], 7), cicloSigue([3, 1], 5), cicloSigue([2, 2, 1], 7),
  // figuras que crecen
  crece("palitos", 4), crece("cuadrado", 4), crece("triangulo", 4), crece("ele", 4), crece("oblongo", 4),
]);

export const INTERMEDIO = armar("intermedio", [
  // las diferencias van cambiando
  siguiente([1, 2, 4, 7, 11, 16]),
  siguiente([2, 3, 5, 8, 12, 17]),
  siguiente([1, 3, 6, 10, 15, 21], "Son los números triangulares: se suma 2, luego 3, luego 4, 5 y 6. Entonces 15 + 6 = 21."),
  siguiente([1, 4, 9, 16, 25, 36], "Son los cuadrados: 1×1, 2×2, 3×3, 4×4, 5×5 y 6×6 = 36."),
  // multiplicar o dividir
  siguiente([2, 6, 18, 54, 162]),
  siguiente([3, 9, 27, 81, 243]),
  siguiente([5, 10, 20, 40, 80, 160]),
  siguiente([256, 128, 64, 32, 16], "Se divide entre 2 cada vez: 32 ÷ 2 = 16."),
  // cada número es la suma de los anteriores
  siguiente([1, 1, 2, 3, 5, 8, 13]),
  siguiente([2, 3, 5, 8, 13, 21]),
  siguiente([3, 4, 7, 11, 18, 29]),
  // dos sucesiones mezcladas
  siguiente([1, 10, 2, 20, 3, 30, 4], "Hay dos sucesiones mezcladas. Los lugares impares van 1, 2, 3, … y los pares 10, 20, 30, …. Toca un lugar impar: el siguiente es 4.", [40]),
  siguiente([2, 5, 4, 10, 6, 15, 8, 20], "Hay dos sucesiones mezcladas. Los lugares impares van 2, 4, 6, 8, … y los pares 5, 10, 15, …. Toca un lugar par: 15 + 5 = 20.", [10]),
  siguiente([5, 1, 10, 2, 15, 3, 20], "Hay dos sucesiones mezcladas. Los lugares impares van 5, 10, 15, … y los pares 1, 2, 3, …. Toca un lugar impar: 15 + 5 = 20.", [4]),
  // figuras que crecen
  crece("palitos", 6), crece("triangulo", 5), crece("cuadrado", 6), crece("ele", 7), crece("cruz", 5),
  // patrones de figuras: lugar n
  cicloLugar([0, 1, 2], 10), cicloLugar([1, 2], 11), cicloLugar([0, 1, 2, 3], 14),
  // dos operaciones
  siguiente([1, 3, 7, 15, 31, 63], "Se multiplica por 2 y se suma 1: 31 × 2 + 1 = 63."),
  siguiente([2, 3, 5, 9, 17, 33], "Se multiplica por 2 y se resta 1: 17 × 2 − 1 = 33."),
  // cubos
  siguiente([1, 8, 27, 64, 125], "Son los cubos: 1×1×1, 2×2×2, 3×3×3, 4×4×4 y 5×5×5 = 125."),
]);

export const AVANZADO = armar("avanzado", [
  // término del lugar n
  terminoN(3, 4, 20), terminoN(5, 3, 15), terminoN(2, 7, 10), terminoN(100, -4, 12),
  // figuras que crecen: lugares lejanos
  crece("palitos", 10), crece("triangulo", 10), crece("cuadrado", 12), crece("ele", 15), crece("cruz", 12), crece("oblongo", 10),
  // suma de los primeros n términos
  sumaAritmetica(2, 2, 10), sumaAritmetica(5, 5, 8),
  // el término depende del lugar al cuadrado
  siguiente([2, 5, 10, 17, 26, 37], "El número del lugar n es n × n + 1: 1×1+1 = 2, 2×2+1 = 5, 3×3+1 = 10… El lugar 6 es 6 × 6 + 1 = 37."),
  siguiente([3, 8, 15, 24, 35, 48], "El número del lugar n es n × (n + 2): 1×3 = 3, 2×4 = 8, 3×5 = 15… El lugar 6 es 6 × 8 = 48."),
  siguiente([0, 3, 8, 15, 24, 35], "El número del lugar n es n × n − 1: 1−1 = 0, 4−1 = 3, 9−1 = 8… El lugar 6 es 36 − 1 = 35."),
  // término del lugar n multiplicando
  terminoGeometrico(2, 2, 8), terminoGeometrico(3, 2, 7),
  // patrones de figuras: lugares lejanos
  cicloLugar([0, 1, 2], 50), cicloLugar([0, 2, 1, 3], 30), cicloLugar([0, 0, 2, 1, 1], 23),
  // reglas especiales
  siguiente([1, 2, 3, 6, 11, 20, 37]),
  siguiente([2, 4, 6, 12, 14, 28, 30, 60], "Se alternan dos operaciones: ×2 y +2. Después de 30 toca ×2: 30 × 2 = 60."),
  siguiente([1, 2, 6, 24, 120, 720], "Se multiplica por 2, luego por 3, 4, 5 y 6: 120 × 6 = 720."),
  // número que falta en medio
  faltante([4, 10, 16, 22, 28], 1, "Se suma 6 cada vez: 4 + 6 = 10 (y 10 + 6 = 16)."),
  faltante([2, 6, 18, 54, 162], 2, "Se multiplica por 3 cada vez: 6 × 3 = 18 (y 18 × 3 = 54)."),
]);

export const EJERCICIOS: Record<Nivel, Ejercicio[]> = {
  basico: BASICO,
  intermedio: INTERMEDIO,
  avanzado: AVANZADO,
};
