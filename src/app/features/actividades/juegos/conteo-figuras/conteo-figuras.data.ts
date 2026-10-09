
export type Nivel = 'basico' | 'intermedio' | 'avanzado';

// Un trazo es una pieza del dibujo: línea (l), polígono (p), círculo (c) o texto (x)
export interface Trazo {
  t: 'l' | 'p' | 'c' | 'x';
  x1?: number; y1?: number; x2?: number; y2?: number; // línea
  pts?: string; // polígono
  cx?: number; cy?: number; r?: number; // círculo
  x?: number; y?: number; s?: string; // texto
  fill?: string;
  stroke?: string;
}

export interface Ejercicio {
  id: string;
  nivel: Nivel;
  tema: string;
  pregunta: string;
  trazos: Trazo[];
  opciones: number[];
  correcta: number;
  explicacion: string;
}

type Base = Omit<Ejercicio, 'id' | 'nivel' | 'opciones'>;

// ---------- Ayudas de dibujo ----------
const INK = '#212529';
const r1 = (n: number) => Math.round(n * 10) / 10;
const linea = (x1: number, y1: number, x2: number, y2: number): Trazo =>
  ({ t: 'l', x1: r1(x1), y1: r1(y1), x2: r1(x2), y2: r1(y2), stroke: INK });
const poligono = (p: number[][], fill = 'none'): Trazo =>
  ({ t: 'p', pts: p.map(q => `${r1(q[0])},${r1(q[1])}`).join(' '), fill, stroke: INK });
const circulo = (cx: number, cy: number, r: number, fill: string): Trazo =>
  ({ t: 'c', cx: r1(cx), cy: r1(cy), r, fill, stroke: INK });
const texto = (x: number, y: number, s: string): Trazo => ({ t: 'x', x: r1(x), y: r1(y), s });
const punto = (P: number[], Q: number[], f: number) => [P[0] + f * (Q[0] - P[0]), P[1] + f * (Q[1] - P[1])];

const C2 = (n: number) => (n * (n - 1)) / 2; // combinaciones de n en 2
const LETRAS = 'ABCDEFGHIJKLMNOP';

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

// Opciones: la correcta + 3 cercanas, ordenadas de menor a mayor
function opciones(correcta: number, semilla: number): number[] {
  const paso = correcta > 40 ? 5 : correcta > 15 ? 2 : 1;
  const cand = [-3, -2, -1, 1, 2, 3].map(d => correcta + d * paso).filter(v => v > 0);
  const r = rng(semilla);
  for (let i = cand.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [cand[i], cand[j]] = [cand[j], cand[i]];
  }
  return [correcta, ...cand.slice(0, 3)].sort((a, b) => a - b);
}

// ---------- 1. Segmentos sobre una recta ----------
function segmentos(n: number): Base {
  const trazos: Trazo[] = [linea(30, 100, 270, 100)];
  for (let i = 0; i <= n; i++) {
    const x = 30 + (240 / n) * i;
    trazos.push(circulo(x, 100, 4, INK), texto(x, 82, LETRAS[i]));
  }
  const total = n * (n + 1) / 2;
  const suma = Array.from({ length: n }, (_, i) => n - i).join(' + ');
  return {
    tema: 'Segmentos',
    pregunta: '¿Cuántos segmentos hay en la figura?',
    trazos,
    correcta: total,
    explicacion: `Hay ${n + 1} puntos. Desde el primero salen ${n} segmentos, desde el segundo ${n - 1}, y así hasta 1: ${suma} = ${total}.`,
  };
}

// ---------- 2. Ángulos formados por rayos desde un punto ----------
function angulos(k: number): Base {
  const O = [150, 175];
  const trazos: Trazo[] = [];
  for (let i = 0; i < k; i++) {
    const grados = 15 + (150 / (k - 1)) * i; // los rayos se reparten en 150°
    const a = (grados * Math.PI) / 180;
    trazos.push(
      linea(O[0], O[1], O[0] + 130 * Math.cos(a), O[1] - 130 * Math.sin(a)),
      texto(O[0] + 143 * Math.cos(a), O[1] - 143 * Math.sin(a) + 4, LETRAS[i + 1]),
    );
  }
  trazos.push(circulo(O[0], O[1], 3.5, INK), texto(O[0], O[1] + 16, 'O'));
  const total = C2(k);
  const suma = Array.from({ length: k - 1 }, (_, i) => k - 1 - i).join(' + ');
  return {
    tema: 'Ángulos',
    pregunta: '¿Cuántos ángulos hay en la figura?',
    trazos,
    correcta: total,
    explicacion: `Hay ${k} rayos. Cada par de rayos forma un ángulo: ${suma} = ${total}.`,
  };
}

// ---------- 3. Triángulos con líneas desde el vértice (y horizontales) ----------
// k = líneas internas desde el vértice, j = líneas horizontales contando la base
function triAbanico(k: number, j: number): Base {
  const A = [150, 18], B = [40, 182], C = [260, 182];
  const trazos: Trazo[] = [poligono([A, B, C], '#e7f1ff')];
  for (let i = 1; i <= k; i++) {
    const p = punto(B, C, i / (k + 1));
    trazos.push(linea(A[0], A[1], p[0], p[1]));
  }
  for (let m = 1; m < j; m++) {
    const p = punto(A, B, m / j), q = punto(A, C, m / j);
    trazos.push(linea(p[0], p[1], q[0], q[1]));
  }
  const lineas = k + 2; // contando los dos lados
  const aberturas = C2(lineas);
  const total = aberturas * j;
  return {
    tema: 'Triángulos',
    pregunta: '¿Cuántos triángulos hay en la figura?',
    trazos,
    correcta: total,
    explicacion:
      `Del vértice de arriba salen ${lineas} líneas (contando los dos lados). Cada par de líneas forma una abertura: ${aberturas}. ` +
      (j === 1
        ? `La base cierra cada abertura y forma un triángulo: ${total} triángulos.`
        : `Hay ${j} líneas horizontales (contando la base) y cada una cierra todas las aberturas: ${aberturas} × ${j} = ${total}.`),
  };
}

// ---------- 4. Triángulo dividido en n filas ----------
function triSub(n: number): Base {
  const A = [150, 18], B = [40, 182], C = [260, 182];
  const trazos: Trazo[] = [poligono([A, B, C], '#fff3cd')];
  for (let i = 1; i < n; i++) {
    const ab = punto(A, B, i / n), ac = punto(A, C, i / n);
    const bcI = punto(B, C, i / n), bcN = punto(B, C, (n - i) / n);
    trazos.push(
      linea(ab[0], ab[1], ac[0], ac[1]), // paralela a la base
      linea(ab[0], ab[1], bcN[0], bcN[1]), // paralela al lado AC
      linea(ac[0], ac[1], bcI[0], bcI[1]), // paralela al lado AB
    );
  }
  let arriba = 0, abajo = 0;
  for (let s = 1; s <= n; s++) arriba += ((n - s + 1) * (n - s + 2)) / 2;
  for (let s = 1; 2 * s <= n; s++) abajo += ((n - 2 * s + 1) * (n - 2 * s + 2)) / 2;
  const total = arriba + abajo;
  return {
    tema: 'Triángulos',
    pregunta: '¿Cuántos triángulos de cualquier tamaño hay en la figura?',
    trazos,
    correcta: total,
    explicacion: `Se cuentan por tamaño. Triángulos con la punta hacia arriba: ${arriba}. Triángulos con la punta hacia abajo: ${abajo}. Total: ${arriba} + ${abajo} = ${total}.`,
  };
}

// ---------- 5. Cuadrículas: cuadrados, rectángulos y segmentos ----------
// m = columnas, n = filas
function cuadricula(m: number, n: number): Trazo[] {
  const s = Math.min(240 / m, 160 / n);
  const x0 = (300 - s * m) / 2, y0 = (200 - s * n) / 2;
  const t: Trazo[] = [];
  for (let i = 0; i <= n; i++) t.push(linea(x0, y0 + i * s, x0 + s * m, y0 + i * s));
  for (let i = 0; i <= m; i++) t.push(linea(x0 + i * s, y0, x0 + i * s, y0 + s * n));
  return t;
}

function cuadradosEn(m: number, n: number) {
  const partes: string[] = [];
  let total = 0;
  for (let k = 1; k <= Math.min(m, n); k++) {
    const c = (m - k + 1) * (n - k + 1);
    total += c;
    partes.push(`${c} de ${k}×${k}`);
  }
  return { total, partes };
}

function cuadrados(m: number, n: number): Base {
  const { total, partes } = cuadradosEn(m, n);
  return {
    tema: 'Cuadrados',
    pregunta: '¿Cuántos cuadrados de cualquier tamaño hay en la figura?',
    trazos: cuadricula(m, n),
    correcta: total,
    explicacion: `Se cuentan por tamaño: ${partes.join(' + ')} = ${total}.`,
  };
}

function rectangulos(m: number, n: number): Base {
  const a = C2(m + 1), b = C2(n + 1);
  return {
    tema: 'Rectángulos',
    pregunta: '¿Cuántos rectángulos (los cuadrados también cuentan) hay en la figura?',
    trazos: cuadricula(m, n),
    correcta: a * b,
    explicacion: `Un rectángulo se forma con 2 líneas verticales (de ${m + 1}: ${a} formas) y 2 horizontales (de ${n + 1}: ${b} formas). Total: ${a} × ${b} = ${a * b}.`,
  };
}

function noCuadrados(m: number, n: number): Base {
  const rect = C2(m + 1) * C2(n + 1);
  const { total: cua } = cuadradosEn(m, n);
  return {
    tema: 'Rectángulos',
    pregunta: '¿Cuántos rectángulos que NO son cuadrados hay en la figura?',
    trazos: cuadricula(m, n),
    correcta: rect - cua,
    explicacion: `Rectángulos en total: ${C2(m + 1)} × ${C2(n + 1)} = ${rect}. Cuadrados: ${cua}. Los que no son cuadrados: ${rect} − ${cua} = ${rect - cua}.`,
  };
}

function segmentosGrid(m: number, n: number): Base {
  const h = (n + 1) * C2(m + 1), v = (m + 1) * C2(n + 1);
  return {
    tema: 'Segmentos',
    pregunta: '¿Cuántos segmentos (de cualquier largo) hay sobre las líneas dibujadas?',
    trazos: cuadricula(m, n),
    correcta: h + v,
    explicacion: `Hay ${n + 1} líneas horizontales con ${C2(m + 1)} segmentos cada una = ${h}. Hay ${m + 1} líneas verticales con ${C2(n + 1)} segmentos cada una = ${v}. Total: ${h} + ${v} = ${h + v}.`,
  };
}

// ---------- 6. Conteo simple de figuras sueltas ----------
type Forma = 'tri' | 'cir' | 'cua';
const NOMBRE: Record<Forma, string> = { tri: 'triángulos', cir: 'círculos', cua: 'cuadrados' };
const COLOR: Record<Forma, string> = { tri: '#f8d7da', cir: '#cfe2ff', cua: '#d1e7dd' };

function conteo(semilla: number, cant: Record<Forma, number>, pide: Forma[]): Base {
  const r = rng(semilla);
  const mezclar = <T>(a: T[]) => {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  const formas: Forma[] = [];
  (Object.keys(cant) as Forma[]).forEach(f => { for (let i = 0; i < cant[f]; i++) formas.push(f); });
  mezclar(formas);
  const celdas = mezclar(Array.from({ length: 18 }, (_, i) => i)); // 6 columnas × 3 filas
  const trazos: Trazo[] = [];
  formas.forEach((f, i) => {
    const c = celdas[i];
    const cx = 25 + 50 * (c % 6) + (r() - 0.5) * 12;
    const cy = 33 + 66 * Math.floor(c / 6) + (r() - 0.5) * 12;
    if (f === 'cir') trazos.push(circulo(cx, cy, 15, COLOR.cir));
    else if (f === 'cua') trazos.push(poligono([[cx - 14, cy - 14], [cx + 14, cy - 14], [cx + 14, cy + 14], [cx - 14, cy + 14]], COLOR.cua));
    else trazos.push(poligono([[cx, cy - 16], [cx - 16, cy + 13], [cx + 16, cy + 13]], COLOR.tri));
  });
  const total = pide.reduce((s, f) => s + cant[f], 0);
  const nombres = pide.map(f => NOMBRE[f]);
  const todas = pide.length === 3;
  return {
    tema: 'Figuras',
    pregunta: todas
      ? '¿Cuántas figuras hay en total?'
      : pide.length === 1
        ? `¿Cuántos ${nombres[0]} hay?`
        : `¿Cuántos ${nombres.join(' y ')} hay en total?`,
    trazos,
    correcta: total,
    explicacion: `Se cuentan ${todas ? 'todas las figuras' : nombres.join(' y ')}: ${pide.map(f => `${cant[f]} ${NOMBRE[f]}`).join(' + ')} = ${total}.`,
  };
}

// ---------- Armado de los tres niveles ----------
function armar(nivel: Nivel, bases: Base[]): Ejercicio[] {
  return bases.map((b, i) => ({
    ...b,
    id: `${nivel}-${i + 1}`,
    nivel,
    opciones: opciones(b.correcta, (nivel.length * 100) + i),
  }));
}

const BASICO = armar('basico', [
  ...[2, 3, 4, 5, 6].map(n => segmentos(n)),
  ...[3, 4, 5, 6].map(k => angulos(k)),
  ...[1, 2, 3, 4, 5].map(k => triAbanico(k, 1)),
  ...[2, 3, 4].map(n => cuadrados(n, n)),
  ...[3, 4, 5].map(m => rectangulos(m, 1)),
  conteo(1, { tri: 4, cir: 3, cua: 2 }, ['tri']),
  conteo(2, { tri: 2, cir: 5, cua: 3 }, ['cir']),
  conteo(3, { tri: 3, cir: 2, cua: 6 }, ['cua']),
  conteo(4, { tri: 5, cir: 4, cua: 3 }, ['cir']),
  conteo(5, { tri: 3, cir: 3, cua: 4 }, ['tri', 'cir', 'cua']),
]);

const INTERMEDIO = armar('intermedio', [
  ...[7, 8, 9].map(k => angulos(k)),
  ...[6, 7].map(k => triAbanico(k, 1)),
  ...[1, 2, 3, 4].map(k => triAbanico(k, 2)),
  ...[2, 3, 4].map(n => triSub(n)),
  ...[5, 6].map(n => cuadrados(n, n)),
  ...[[3, 2], [4, 3], [5, 3], [4, 2]].map(([m, n]) => cuadrados(m, n)),
  ...[[2, 2], [3, 2], [3, 3], [4, 2]].map(([m, n]) => rectangulos(m, n)),
  conteo(11, { tri: 5, cir: 4, cua: 6 }, ['tri', 'cua']),
  conteo(12, { tri: 6, cir: 5, cua: 4 }, ['cir', 'cua']),
  conteo(13, { tri: 4, cir: 6, cua: 7 }, ['tri', 'cir', 'cua']),
]);

const AVANZADO = armar('avanzado', [
  ...[5, 6, 7].map(n => triSub(n)),
  ...[2, 3, 4, 5].map(k => triAbanico(k, 3)),
  ...[5, 6, 7].map(k => triAbanico(k, 2)),
  ...[[3, 4], [4, 4], [3, 5], [4, 5]].map(([m, n]) => rectangulos(m, n)),
  ...[[4, 5], [3, 6], [4, 6], [5, 6]].map(([m, n]) => cuadrados(m, n)),
  ...[[3, 3], [3, 4], [4, 4], [4, 5]].map(([m, n]) => noCuadrados(m, n)),
  ...[[2, 2], [3, 2], [3, 3]].map(([m, n]) => segmentosGrid(m, n)),
]);

export const EJERCICIOS: Record<Nivel, Ejercicio[]> = {
  basico: BASICO,
  intermedio: INTERMEDIO,
  avanzado: AVANZADO,
};

export const NIVELES: { id: Nivel; nombre: string; detalle: string; color: string }[] = [
  { id: 'basico', nombre: 'Básico', detalle: 'Figuras sueltas, segmentos, ángulos y triángulos sencillos', color: 'success' },
  { id: 'intermedio', nombre: 'Intermedio', detalle: 'Cuadrículas, abanicos con horizontales y triángulos divididos', color: 'warning' },
  { id: 'avanzado', nombre: 'Avanzado', detalle: 'Rectángulos, cuadrados y segmentos en figuras grandes', color: 'danger' },
];

// ---------- Convierte los trazos en una imagen SVG (data URI) para el quiz ----------
export function svgDe(trazos: Trazo[]): string {
  const piezas = trazos.map(t => {
    if (t.t === 'l') return `<line x1="${t.x1}" y1="${t.y1}" x2="${t.x2}" y2="${t.y2}" stroke="${t.stroke}" stroke-width="2" stroke-linecap="round"/>`;
    if (t.t === 'p') return `<polygon points="${t.pts}" fill="${t.fill}" stroke="${t.stroke}" stroke-width="2" stroke-linejoin="round"/>`;
    if (t.t === 'c') return `<circle cx="${t.cx}" cy="${t.cy}" r="${t.r}" fill="${t.fill}" stroke="${t.stroke}" stroke-width="2"/>`;
    return `<text x="${t.x}" y="${t.y}" text-anchor="middle" font-size="13" font-weight="bold" font-family="sans-serif" fill="#0d6efd">${t.s}</text>`;
  });
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 200"><rect width="300" height="200" fill="#fff"/>${piezas.join('')}</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
