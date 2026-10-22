
// Seriaciones: 25 ejercicios por nivel con gráficos SVG (banco compartido
// por la actividad y el Módulo Docente).
// Series de letras, de letras con números, de figuras que giran o se pintan, ejercicios para
// ordenar tarjetas e intrusos. Cada respuesta se CALCULA a partir de la regla de la serie.

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
export const VERDE = "#198754";
export const r1 = (n: number) => Math.round(n * 10) / 10;
export const poligono = (p: number[][], fill = "none"): Trazo =>
  ({ t: "p", pts: p.map(q => `${r1(q[0])},${r1(q[1])}`).join(" "), fill, stroke: INK });
export const circulo = (cx: number, cy: number, r: number, fill: string): Trazo =>
  ({ t: "c", cx: r1(cx), cy: r1(cy), r, fill, stroke: INK });
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
// en móvil la figura se reduce y a 13px el texto no se leía.
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

export const pasoPara = (v: number) => (v < 20 ? 1 : v < 60 ? 2 : v < 200 ? 5 : 20);

// Mezcla con semilla
export function mezclada<T>(a: T[], semilla: number): T[] {
  const r = rng(semilla), c = [...a];
  for (let k = c.length - 1; k > 0; k--) { const j = Math.floor(r() * (k + 1)); [c[k], c[j]] = [c[j], c[k]]; }
  return c;
}
export let semillaGlobal = 100;

// ================== Gráficos ==================
// Fila de casillas; "?" es la casilla a descubrir y "…" indica que sigue
export function cajas(items: string[], y = 82): Trazo[] {
  const n = items.length;
  const w = Math.min(44, (284 - 6 * (n - 1)) / n);
  const x0 = (300 - (n * w + 6 * (n - 1))) / 2;
  const t: Trazo[] = [];
  items.forEach((it, i) => {
    const x = x0 + i * (w + 6);
    if (it === "…") { t.push(texto(x + w / 2, y + 28, "…", 22)); return; }
    t.push(caja(x, y, w, 38, it === "?" ? HUECO : CAJA));
    t.push(texto(x + w / 2, y + 25, it, it.length > 3 ? 12 : it.length > 2 ? 14 : 17));
  });
  return t;
}

// Flecha que apunta hacia "grados" (0 = arriba, 90 = derecha, 180 = abajo, 270 = izquierda)
export function flecha(cx: number, cy: number, grados: number): Trazo {
  const base: number[][] = [[0, -20], [12, -5], [5, -5], [5, 18], [-5, 18], [-5, -5], [-12, -5]];
  const a = (grados * Math.PI) / 180;
  return poligono(base.map(([x, y]) => [cx + x * Math.cos(a) - y * Math.sin(a), cy + x * Math.sin(a) + y * Math.cos(a)]), "#d1e7dd");
}

// Fila de elementos dibujados con una función, seguida de un cuadro "?"
export function filaDibujos(n: number, dibujar: (i: number, cx: number, cy: number) => Trazo[]): Trazo[] {
  const items = n + 1;
  const paso = Math.min(58, 280 / items);
  const x = (i: number) => 150 + (i - (items - 1) / 2) * paso;
  const t: Trazo[] = [];
  for (let i = 0; i < n; i++) t.push(...dibujar(i, x(i), 95));
  t.push(caja(x(n) - 20, 75, 40, 40, HUECO), texto(x(n), 103, "?", 22));
  return t;
}

// Cuadrito de 2×2 con casillas pintadas (0 = arriba izquierda, 1 = arriba derecha, 2 = abajo izquierda, 3 = abajo derecha)
export function cuadrito(cx: number, cy: number, pintadas: number[]): Trazo[] {
  const s = 22, x0 = cx - s, y0 = cy - s;
  const t: Trazo[] = [];
  for (let c = 0; c < 4; c++) t.push(caja(x0 + (c % 2) * s, y0 + Math.floor(c / 2) * s, s, s, pintadas.includes(c) ? VERDE : "#ffffff"));
  return t;
}

// Puntos que forman figuras que crecen
export type TipoPuntos = "triangulo" | "cuadrado" | "oblongo";
export const PUNTOS: Record<TipoPuntos, { v: (k: number) => number; regla: string; formula: (k: number) => string }> = {
  triangulo: { v: k => (k * (k + 1)) / 2, regla: "Cada figura agrega una fila nueva con un punto más que la fila anterior", formula: k => `${k} × ${k + 1} ÷ 2` },
  cuadrado: { v: k => k * k, regla: "La figura k forma un cuadrado de k × k puntos", formula: k => `${k} × ${k}` },
  oblongo: { v: k => k * (k + 1), regla: "La figura k tiene k filas de k + 1 puntos", formula: k => `${k} × ${k + 1}` },
};

export function dibujarPuntos(tipo: TipoPuntos, k: number, cx: number, cy: number): Trazo[] {
  const t: Trazo[] = [];
  const d = 16, punto = (x: number, y: number) => t.push(circulo(x, y, 5, "#0d6efd"));
  if (tipo === "triangulo") for (let i = 0; i < k; i++) for (let j = 0; j <= i; j++) punto(cx - (i * d) / 2 + j * d, cy - ((k - 1) * d) / 2 + i * d);
  else if (tipo === "cuadrado") for (let i = 0; i < k; i++) for (let j = 0; j < k; j++) punto(cx - ((k - 1) * d) / 2 + j * d, cy - ((k - 1) * d) / 2 + i * d);
  else for (let i = 0; i < k; i++) for (let j = 0; j <= k; j++) punto(cx - (k * d) / 2 + j * d, cy - ((k - 1) * d) / 2 + i * d);
  return t;
}

// ================== Letras ==================
export const ABC = "ABCDEFGHIJKLMNÑOPQRSTUVWXYZ"; // 27 letras, con la Ñ
export const letra = (i: number) => ABC[((i % 27) + 27) % 27];
export const indice = (l: string) => ABC.indexOf(l);

// Explica los saltos entre letras
export function describirSaltos(pasos: number[], prev: string, ans: string): string {
  const ult = pasos[pasos.length - 1];
  const todosIguales = pasos.every(p => p === pasos[0]);
  const crecientes = pasos.length > 2 && pasos.every((p, i) => i === 0 || p === pasos[i - 1] + 1);
  const decrecientes = pasos.length > 2 && pasos.every((p, i) => i === 0 || p === pasos[i - 1] - 1);
  const txt = (p: number) => (p > 0 ? `+${p}` : `−${-p}`);
  let regla: string;
  if (todosIguales) regla = pasos[0] === 1 ? "Cada letra es la siguiente del abecedario" : pasos[0] > 0 ? `Se avanzan ${pasos[0]} lugares en cada paso` : `Se retroceden ${-pasos[0]} lugares en cada paso`;
  else if (crecientes || decrecientes) regla = `Los saltos van cambiando de 1 en 1: ${pasos.slice(0, -1).map(txt).join(", ")}… y ahora ${txt(ult)}`;
  else regla = `Los saltos se alternan: ${pasos.slice(0, 2).map(txt).join(" y ")}. Ahora toca ${txt(ult)}`;
  return `${regla}. Se cuenta con las 27 letras del abecedario (con la Ñ): ${prev} ${txt(ult)} = ${ans}.`;
}

// ¿Qué letra sigue? terms = inicio + saltos (el último término es la respuesta)
export function serieLetras(inicio: string, pasos: number[]): Base {
  const terms = [indice(inicio)];
  pasos.forEach(p => terms.push(terms[terms.length - 1] + p));
  const mostrar = terms.slice(0, -1).map(letra), ans = letra(terms[terms.length - 1]);
  const a = terms[terms.length - 1];
  return {
    tema: "Series de letras", pregunta: "¿Qué letra sigue en la serie?", trazos: cajas([...mostrar, "?"]),
    fijas: mezclada([ans, letra(a + 1), letra(a - 1), letra(a + 2)], semillaGlobal++), correctaTexto: ans,
    explicacion: describirSaltos(pasos, mostrar[mostrar.length - 1], ans),
  };
}

// Letras y números en cada casilla: A2, C4, E6, …
export function alfanumerica(L0: string, N0: number, dl: number, dn: number, mostrar = 3): Base {
  const termino = (i: number) => `${letra(indice(L0) + i * dl)}${N0 + i * dn}`;
  const ans = termino(mostrar), l = indice(L0) + mostrar * dl, n = N0 + mostrar * dn;
  const otras = [`${letra(l + 1)}${n}`, `${letra(l)}${n + dn}`, `${letra(l - 1)}${n}`, `${letra(l)}${n - dn}`, `${letra(l + dl)}${n + dn}`].filter((x, i, arr) => x !== ans && arr.indexOf(x) === i).slice(0, 3);
  const t = (p: number) => (p > 0 ? `+${p}` : `−${-p}`);
  return {
    tema: "Letras y números", pregunta: "¿Qué casilla sigue en la serie?", trazos: cajas([...Array.from({ length: mostrar }, (_, i) => termino(i)), "?"]),
    fijas: mezclada([ans, ...otras], semillaGlobal++), correctaTexto: ans,
    explicacion: `Las letras y los números siguen reglas distintas. Letras: ${t(dl)} ${Math.abs(dl) === 1 ? "lugar" : "lugares"} cada vez. Números: ${t(dn)} cada vez. Después de ${termino(mostrar - 1)} viene ${ans}.`,
  };
}

// Dos series mezcladas: letra, número, letra, número… (se pide la que sigue)
export function entrelazada(L0: string, dl: number, N0: number, dn: number): Base {
  const items: string[] = [];
  for (let i = 0; i < 3; i++) items.push(letra(indice(L0) + i * dl), String(N0 + i * dn));
  const ans = letra(indice(L0) + 3 * dl);
  return {
    tema: "Series mezcladas", pregunta: "Dos series están mezcladas: una de letras y otra de números. ¿Qué elemento sigue?", trazos: cajas([...items, "?"]),
    fijas: mezclada([ans, String(N0 + 3 * dn), letra(indice(L0) + 4 * dl), letra(indice(L0) + 2 * dl)], semillaGlobal++), correctaTexto: ans,
    explicacion: `Los lugares impares forman la serie de letras (${items.filter((_, i) => i % 2 === 0).join(", ")}…) y los pares la de números (${items.filter((_, i) => i % 2 === 1).join(", ")}…). Toca una letra: ${ans}.`,
  };
}

// Dos series de letras mezcladas (una sube y otra baja)
export function dosLetras(A0: string, da: number, B0: string, db: number): Base {
  const items: string[] = [];
  for (let i = 0; i < 3; i++) items.push(letra(indice(A0) + i * da), letra(indice(B0) + i * db));
  const ans = letra(indice(A0) + 3 * da);
  return {
    tema: "Series mezcladas", pregunta: "Dos series de letras están mezcladas. ¿Qué letra sigue?", trazos: cajas([...items, "?"]),
    fijas: mezclada([ans, letra(indice(B0) + 3 * db), letra(indice(A0) + 4 * da), letra(indice(A0) + 2 * da)], semillaGlobal++), correctaTexto: ans,
    explicacion: `Los lugares impares forman una serie (${items.filter((_, i) => i % 2 === 0).join(", ")}…) y los pares otra (${items.filter((_, i) => i % 2 === 1).join(", ")}…). Toca una del primer grupo: ${ans}.`,
  };
}

// ================== Números ==================
// Regla general de una serie numérica completa
export function reglaDe(t: number[]): string {
  const dif = t.slice(1).map((v, i) => v - t[i]);
  if (dif.every(d => d === dif[0])) return dif[0] >= 0 ? `Se suma ${dif[0]} cada vez` : `Se resta ${-dif[0]} cada vez`;
  if (t.every(v => v !== 0) && t.slice(1).every((v, i) => v % t[i] === 0 && v / t[i] === t[1] / t[0])) return `Se multiplica por ${t[1] / t[0]} cada vez`;
  if (t.length > 3 && t.slice(2).every((v, i) => v === t[i + 1] + t[i])) return "Cada número es la suma de los dos anteriores";
  const d2 = dif.slice(1).map((v, i) => v - dif[i]);
  if (d2.every(d => d === d2[0])) return `Las diferencias entre números seguidos son ${dif.join(", ")}: cambian ${Math.abs(d2[0])} cada vez`;
  return "Se sigue la regla de la serie";
}

// Hay un número que falta en medio de la serie
export function hueco(terms: number[], idx: number, explicacion?: string): Base {
  const items = terms.map(String);
  items[idx] = "?";
  const v = terms[idx];
  return {
    tema: "Número que falta", pregunta: "¿Qué número falta en la serie?", trazos: cajas(items),
    valor: v, paso: pasoPara(v), trampas: [v + 1, v - 1],
    explicacion: explicacion ?? `${reglaDe(terms)}. La serie completa es ${terms.join(", ")}, así que el número que falta es ${v}.`,
  };
}

// Un número de la serie no sigue la regla (el intruso)
export function intruso(terms: number[], idx: number, falso: number, regla: string): Base {
  const items = terms.map((v, i) => (i === idx ? falso : v));
  const otros = mezclada(items.filter((_, i) => i !== idx), semillaGlobal++).slice(0, 3);
  return {
    tema: "El intruso", pregunta: "Uno de los números no sigue la regla de la serie. ¿Cuál es?", trazos: cajas(items.map(String)),
    fijas: mezclada([String(falso), ...otros.map(String)], semillaGlobal++), correctaTexto: String(falso),
    explicacion: `${regla} En ese lugar debía ir el ${terms[idx]} y no el ${falso}.`,
  };
}

// ================== Ordenar tarjetas ==================
export function variantes(correcto: string[]): string[] {
  const c = [...correcto], n = c.length;
  const cambio = (i: number, j: number) => { const x = [...c]; [x[i], x[j]] = [x[j], x[i]]; return x.join(", "); };
  const lista = [[...c].reverse().join(", "), cambio(0, 1), cambio(n - 2, n - 1), cambio(1, 2), cambio(0, n - 1), [...c.slice(1), c[0]].join(", ")];
  const out: string[] = [];
  lista.forEach(x => { if (x !== c.join(", ") && !out.includes(x) && out.length < 3) out.push(x); });
  return out;
}

// Tarjetas desordenadas: ¿cuál es el orden correcto? (de menor a mayor)
export function ordenar(items: string[], regla: string, tema = "Ordenar la serie"): Base {
  let baraja = mezclada(items, semillaGlobal++);
  let k = 0;
  while ((baraja.join() === items.join() || baraja.join() === [...items].reverse().join()) && k++ < 20) baraja = mezclada(items, semillaGlobal++);
  const correcto = items.join(", ");
  return {
    tema, pregunta: "Las tarjetas están desordenadas. ¿Cuál es el orden correcto para formar la serie, de menor a mayor?",
    trazos: [texto(150, 54, "Tarjetas desordenadas", 12, GRIS), ...cajas(baraja)],
    fijas: mezclada([correcto, ...variantes(items)], semillaGlobal++), correctaTexto: correcto,
    explicacion: `${regla} El orden correcto es: ${correcto}.`,
  };
}

// Círculos de distintos tamaños con una letra debajo: ordenarlos por tamaño
export function ordenarTamano(radios: number[], mayorAMenor = false): Base {
  const n = radios.length, letras = "ABCDEFG".slice(0, n).split("");
  const t: Trazo[] = [];
  radios.forEach((r, i) => {
    const cx = 150 + (i - (n - 1) / 2) * (n > 4 ? 56 : 66);
    t.push(circulo(cx, 92, r, "#cfe2ff"), texto(cx, 150, letras[i], 18));
  });
  const orden = letras.map((l, i) => ({ l, r: radios[i] })).sort((a, b) => (mayorAMenor ? b.r - a.r : a.r - b.r)).map(x => x.l);
  const correcto = orden.join(", ");
  return {
    tema: "Ordenar por tamaño", pregunta: `¿Cómo se ordenan las letras de los círculos, del ${mayorAMenor ? "más grande al más pequeño" : "más pequeño al más grande"}?`, trazos: t,
    fijas: mezclada([correcto, ...variantes(orden)], semillaGlobal++), correctaTexto: correcto,
    explicacion: `Se comparan los tamaños de los círculos y se ordenan ${mayorAMenor ? "de mayor a menor" : "de menor a mayor"}: ${correcto}.`,
  };
}

// ================== Figuras que giran o se pintan ==================
export const DIRECCIONES = ["Arriba", "Arriba a la derecha", "Derecha", "Abajo a la derecha", "Abajo", "Abajo a la izquierda", "Izquierda", "Arriba a la izquierda"];
export const direccion = (g: number) => DIRECCIONES[(((g / 45) % 8) + 8) % 8];

// Flechas que giran: cada paso suma grados (positivo = hacia la derecha, negativo = hacia la izquierda)
export function giros(inicio: number, pasos: number[]): Base {
  const angs = [inicio];
  pasos.forEach(p => angs.push(angs[angs.length - 1] + p));
  const mostrar = angs.slice(0, -1), ans = angs[angs.length - 1];
  const ultPaso = pasos[pasos.length - 1];
  const opciones = [ans, ans - 2 * ultPaso, ans + 180, ans + 45].map(direccion).filter((x, i, arr) => arr.indexOf(x) === i);
  [90, 135, 225].forEach(g => { const d = direccion(ans + g); if (opciones.length < 4 && !opciones.includes(d)) opciones.push(d); });
  const todosIguales = pasos.every(p => p === pasos[0]);
  const tx = (p: number) => `${Math.abs(p)}° hacia la ${p > 0 ? "derecha" : "izquierda"}`;
  return {
    tema: "Figuras que giran", pregunta: "Las flechas giran siguiendo una regla. ¿Hacia dónde apunta la flecha que sigue?",
    trazos: filaDibujos(mostrar.length, (i, cx, cy) => [flecha(cx, cy, mostrar[i])]),
    fijas: mezclada(opciones.slice(0, 4), semillaGlobal++), correctaTexto: direccion(ans),
    explicacion: todosIguales ? `Cada flecha gira ${tx(pasos[0])} respecto a la anterior. Después de la que apunta ${direccion(mostrar[mostrar.length - 1]).toLowerCase()}, la siguiente apunta ${direccion(ans).toLowerCase()}.`
      : `Los giros se alternan: ${tx(pasos[0])} y ${tx(pasos[1])}. Ahora toca ${tx(ultPaso)}, y la flecha apunta ${direccion(ans).toLowerCase()}.`,
  };
}

export const CASILLAS = ["Arriba a la izquierda", "Arriba a la derecha", "Abajo a la izquierda", "Abajo a la derecha"];

// Una casilla pintada que recorre el cuadrito (en el orden dado)
export function casillaPintada(ciclo: number[], inicio: number, paso: number, mostrar: number): Base {
  const pos = Array.from({ length: mostrar + 1 }, (_, i) => ciclo[(((inicio + i * paso) % 4) + 4) % 4]);
  const ans = pos[mostrar];
  return {
    tema: "Figuras que se pintan", pregunta: "Una casilla pintada se mueve siguiendo una regla. ¿Cuál es la casilla pintada de la figura que sigue?",
    trazos: filaDibujos(mostrar, (i, cx, cy) => cuadrito(cx, cy, [pos[i]])),
    fijas: mezclada(CASILLAS, semillaGlobal++), correctaTexto: CASILLAS[ans],
    explicacion: `La casilla pintada va ${paso > 0 ? "en el sentido de las agujas del reloj" : "en sentido contrario a las agujas del reloj"}, una casilla por figura. Después de «${CASILLAS[pos[mostrar - 1]].toLowerCase()}» viene «${CASILLAS[ans].toLowerCase()}».`,
  };
}

// Dos casillas pintadas que giran: fila de arriba → columna derecha → fila de abajo → columna izquierda
export const PARES = [[0, 1], [1, 3], [3, 2], [2, 0]];
export const NOMBRES_PAR = ["La fila de arriba", "La columna de la derecha", "La fila de abajo", "La columna de la izquierda"];
export function paresGiran(inicio: number, mostrar: number): Base {
  const pos = Array.from({ length: mostrar + 1 }, (_, i) => (inicio + i) % 4);
  const ans = pos[mostrar];
  return {
    tema: "Figuras que se pintan", pregunta: "Dos casillas pintadas giran siguiendo una regla. ¿Cuáles están pintadas en la figura que sigue?",
    trazos: filaDibujos(mostrar, (i, cx, cy) => cuadrito(cx, cy, PARES[pos[i]])),
    fijas: mezclada(NOMBRES_PAR, semillaGlobal++), correctaTexto: NOMBRES_PAR[ans],
    explicacion: `Las dos casillas pintadas dan un cuarto de vuelta hacia la derecha en cada figura. Después de «${NOMBRES_PAR[pos[mostrar - 1]].toLowerCase()}» viene «${NOMBRES_PAR[ans].toLowerCase()}».`,
  };
}

// Puntos que forman figuras: ¿cuántos puntos tendrá la figura "pide"?
export function puntosSiguiente(tipo: TipoPuntos, pide: number, mostrar = 3): Base {
  const p = PUNTOS[tipo];
  const trazos: Trazo[] = [];
  for (let i = 1; i <= mostrar; i++) {
    const cx = (300 / mostrar) * (i - 0.5);
    trazos.push(...dibujarPuntos(tipo, i, cx, 88), texto(cx, 165, `Figura ${i}`, 12, GRIS));
  }
  const v = p.v(pide), lineal = p.v(mostrar) + (p.v(mostrar) - p.v(mostrar - 1)) * (pide - mostrar);
  return {
    tema: "Figuras de puntos", pregunta: `Siguiendo la serie, ¿cuántos puntos tendrá la figura ${pide}?`, trazos,
    valor: v, paso: pasoPara(v), trampas: [lineal, p.v(pide - 1)],
    explicacion: `${p.regla}. Figura ${pide}: ${p.formula(pide)} = ${v}.`,
  };
}

// ================== Armado de los tres niveles ==================
export function armar(nivel: Nivel, bases: Base[]): Ejercicio[] {
  return bases.map((b, i) => {
    const r = rng(nivel.length * 1000 + i);
    let opciones: string[], correcta: string;
    if (b.fijas) {
      opciones = b.fijas;
      correcta = b.correctaTexto!;
    } else {
      const valor = b.valor!, paso = b.paso!;
      const set = new Set<number>([valor]);
      (b.trampas ?? []).forEach(t => { if (t > 0 && t <= 2 * valor + 12 && Number.isInteger(t) && set.size < 4) set.add(t); });
      const cand = [-3, -2, -1, 1, 2, 3].map(d => valor + d * paso).filter(v => v > 0);
      for (let k = cand.length - 1; k > 0; k--) { const j = Math.floor(r() * (k + 1)); [cand[k], cand[j]] = [cand[j], cand[k]]; }
      cand.forEach(v => { if (set.size < 4) set.add(v); });
      opciones = [...set].sort((x, y) => x - y).map(String);
      correcta = String(valor);
    }
    return { id: `${nivel}-${i + 1}`, nivel, tema: b.tema, pregunta: b.pregunta, trazos: b.trazos, opciones, correcta, explicacion: b.explicacion };
  });
}

export const CICLO_HORARIO = [0, 1, 3, 2]; // arriba izquierda → arriba derecha → abajo derecha → abajo izquierda

export const BASICO = armar("basico", [
  // series de letras
  serieLetras("A", [1, 1, 1, 1]), serieLetras("A", [2, 2, 2, 2]), serieLetras("B", [3, 3, 3, 3]), serieLetras("M", [1, 1, 1, 1]), serieLetras("Z", [-2, -2, -2, -2]),
  // ordenar tarjetas
  ordenar(["4", "8", "12", "16", "20"], "Se suma 4 cada vez."), ordenar(["5", "10", "15", "20", "25"], "Se suma 5 cada vez."),
  ordenar(["3", "6", "9", "12", "15"], "Se suma 3 cada vez."), ordenar(["2", "4", "8", "16", "32"], "Se multiplica por 2 cada vez."),
  ordenar(["A", "C", "E", "G", "I"], "Se salta una letra cada vez (A, C, E…).", "Ordenar letras"),
  ordenar(["B", "E", "H", "K", "N"], "Se saltan dos letras cada vez (B, E, H…).", "Ordenar letras"),
  ordenar(["M", "N", "Ñ", "O", "P"], "Son letras seguidas del abecedario (con la Ñ).", "Ordenar letras"),
  // flechas que giran
  giros(0, [90, 90, 90, 90]), giros(90, [90, 90, 90, 90]), giros(180, [90, 90, 90, 90]), giros(270, [90, 90, 90, 90]),
  // casilla pintada que se mueve
  casillaPintada(CICLO_HORARIO, 0, 1, 3), casillaPintada(CICLO_HORARIO, 1, 1, 4), casillaPintada(CICLO_HORARIO, 2, 1, 3),
  // intruso
  intruso([4, 8, 12, 16, 20, 24], 3, 15, "La regla es sumar 4 cada vez."), intruso([5, 10, 15, 20, 25, 30], 2, 14, "La regla es sumar 5 cada vez."), intruso([3, 6, 9, 12, 15, 18], 4, 16, "La regla es sumar 3 cada vez."),
  // número que falta
  hueco([5, 10, 15, 20, 25], 2), hueco([3, 6, 9, 12, 15], 1), hueco([20, 16, 12, 8, 4], 3),
]);

export const INTERMEDIO = armar("intermedio", [
  // series de letras con saltos que cambian
  serieLetras("A", [1, 2, 3, 4, 5]), serieLetras("A", [2, 3, 2, 3, 2]), serieLetras("Z", [-1, -2, -1, -2, -1]), serieLetras("C", [3, -1, 3, -1, 3]),
  // letras y números mezclados
  entrelazada("A", 1, 1, 1), entrelazada("B", 2, 2, 2),
  alfanumerica("A", 2, 1, 2), alfanumerica("B", 5, 2, 5), alfanumerica("A", 10, 3, -2), alfanumerica("C", 1, 1, 3),
  // ordenar tarjetas
  ordenar(["3", "6", "12", "24", "48"], "Se multiplica por 2 cada vez."), ordenar(["1", "4", "9", "16", "25"], "Son los números multiplicados por sí mismos: 1×1, 2×2, 3×3…"),
  ordenar(["2", "3", "5", "8", "12"], "Se suma 1, luego 2, luego 3, luego 4."),
  ordenar(["A", "B", "D", "G", "K"], "Los saltos crecen: +1, +2, +3, +4.", "Ordenar letras"), ordenar(["D", "E", "G", "J", "N"], "Los saltos crecen: +1, +2, +3, +4.", "Ordenar letras"),
  ordenarTamano([22, 10, 30, 16]), ordenarTamano([14, 28, 8, 20]),
  // flechas que giran
  giros(0, [45, 45, 45, 45]), giros(270, [-90, -90, -90, -90]), giros(0, [180, 180, 180, 180]),
  // dos casillas pintadas
  paresGiran(0, 3), paresGiran(1, 4),
  // intruso
  intruso([2, 4, 8, 16, 32, 64], 4, 30, "La regla es multiplicar por 2 cada vez."), intruso([1, 2, 3, 5, 8, 13, 21], 5, 12, "Cada número es la suma de los dos anteriores."), intruso([1, 4, 9, 16, 25, 36], 3, 15, "Son los números multiplicados por sí mismos."),
]);

export const AVANZADO = armar("avanzado", [
  // series de letras más largas
  serieLetras("B", [2, 3, 2, 3, 2]), serieLetras("Z", [-1, -2, -3, -4]), serieLetras("D", [3, -2, 3, -2, 3]),
  // series mezcladas
  entrelazada("C", 1, 5, 5), dosLetras("A", 1, "Z", -1),
  // letras y números con reglas distintas
  alfanumerica("B", 3, 2, 3), alfanumerica("Z", 50, -2, -7), alfanumerica("C", 2, 4, 3), alfanumerica("A", 1, 2, 5),
  // número que falta con reglas más difíciles
  hueco([2, 3, 5, 8, 13, 21], 3), hueco([1, 4, 9, 16, 25, 36], 3), hueco([2, 6, 18, 54, 162], 3), hueco([3, 5, 9, 17, 33, 65], 4, "Se multiplica por 2 y se resta 1: 17 × 2 − 1 = 33."), hueco([1, 2, 4, 7, 11, 16], 4, "Las diferencias son 1, 2, 3, 4, 5: a 7 se le suma 4 y da 11."),
  // ordenar tarjetas
  ordenar(["2", "5", "7", "10", "12", "15"], "Se suma 3 y 2 alternadamente."), ordenar(["B", "C", "E", "H", "L", "Q"], "Los saltos crecen: +1, +2, +3, +4, +5.", "Ordenar letras"), ordenarTamano([12, 30, 20, 8, 26], true),
  // flechas que giran
  giros(0, [90, 45, 90, 45, 90]), giros(0, [135, 135, 135, 135]), giros(90, [-45, -90, -45, -90, -45]),
  // figuras de puntos
  puntosSiguiente("triangulo", 5), puntosSiguiente("cuadrado", 6), puntosSiguiente("oblongo", 5),
  // intruso
  intruso([2, 3, 5, 8, 12, 17, 23], 6, 22, "Las diferencias crecen de 1 en 1: +1, +2, +3, +4, +5, +6."), intruso([3, 6, 12, 24, 48, 96], 4, 46, "La regla es multiplicar por 2 cada vez."),
]);

export const EJERCICIOS: Record<Nivel, Ejercicio[]> = {
  basico: BASICO,
  intermedio: INTERMEDIO,
  avanzado: AVANZADO,
};
