/**
 * Banco de ejercicios de «Actividades Mentales».
 *
 * Cuatro tipos, tal como anuncia la descripción de la actividad:
 *  - serie:       continuar una serie numérica (cajas con números y un «?»).
 *  - conteo:      conteo rápido de figuras dibujadas en SVG.
 *  - comparacion: cuál es el mayor o el menor entre varios números u operaciones.
 *  - patron:      patrón de figuras que se repite o que crece.
 *
 * Las opciones se BARAJAN al armar cada ejercicio. Sin ese barajado la
 * respuesta correcta caería siempre en el primer botón y el alumno podría
 * acertar sin calcular nada.
 *
 * Los ejercicios se generan con semilla fija: el mismo ejercicio se ve
 * siempre igual, pero su posición dentro del nivel la decide el azar de la
 * partida (eso lo hace el `QuizEngine`).
 */

export type TipoEjercicio = 'serie' | 'conteo' | 'comparacion' | 'patron';

export interface Ejercicio {
  id: string;
  nivel: number;
  tipo: TipoEjercicio;
  enunciado: string;
  /** Dibujo del ejercicio (SVG en data URI). */
  imagen?: string;
  /** Textos de las opciones, ya barajados. */
  opciones: string[];
  /** Texto de la opción correcta (siempre está dentro de `opciones`). */
  correcta: string;
  explicacion: string;
}

/** Ejercicio sin `id` ni `nivel`: se los pone `armar` al montar el nivel. */
type Base = Omit<Ejercicio, 'id' | 'nivel'>;

// ================== Dibujo (SVG) ==================
const INK = '#212529';
const CAJA = '#e7f1ff';
const HUECO = '#fff3cd';
/** Colores de las cuatro figuras: círculo, cuadrado, triángulo y rombo. */
const COLORES = ['#cfe2ff', '#d1e7dd', '#f8d7da', '#fff3cd'];
/** Nombre en singular de cada figura. */
const NOMBRES = ['Círculo', 'Cuadrado', 'Triángulo', 'Rombo'];
/** Nombre en plural de cada figura (para el enunciado del conteo). */
const PLURALES = ['círculos', 'cuadrados', 'triángulos', 'rombos'];

function svgDe(ancho: number, alto: number, piezas: string[]): string {
  // Se redondea el lienzo: sin esto el viewBox sale con decimales sucios
  // (55.400000000000006) por los múltiplos de la division de la fila.
  const w = Math.round(ancho * 10) / 10;
  const h = Math.round(alto * 10) / 10;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}">${piezas.join('')}</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/** Una de las cuatro figuras, centrada en (cx, cy). */
function forma(tipo: number, cx: number, cy: number, r: number): string {
  const fill = COLORES[tipo] ?? COLORES[0];
  if (tipo === 0) {
    return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" stroke="${INK}" stroke-width="3"/>`;
  }
  if (tipo === 1) {
    return `<rect x="${cx - r}" y="${cy - r}" width="${r * 2}" height="${r * 2}" rx="5" fill="${fill}" stroke="${INK}" stroke-width="3"/>`;
  }
  if (tipo === 2) {
    return `<polygon points="${cx},${cy - r - 2} ${cx - r - 2},${cy + r} ${cx + r + 2},${cy + r}" fill="${fill}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>`;
  }
  return `<polygon points="${cx},${cy - r - 3} ${cx + r + 3},${cy} ${cx},${cy + r + 3} ${cx - r - 3},${cy}" fill="${fill}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>`;
}

/** Fila de cajitas con números; la última puede ser un «?». */
function filaCajas(items: string[]): string {
  const n = items.length;
  const w = Math.min(52, (520 - 8 * (n - 1)) / n);
  const ancho = n * w + 8 * (n - 1);
  const y = 6;
  const h = 48;
  const piezas: string[] = [];
  items.forEach((it, i) => {
    const x = i * (w + 8);
    if (it === '?') {
      piezas.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" fill="${HUECO}" stroke="${INK}" stroke-width="3"/>`);
      piezas.push(`<text x="${x + w / 2}" y="${y + h / 2 + 8}" text-anchor="middle" font-size="24" font-weight="bold" fill="${INK}">?</text>`);
      return;
    }
    piezas.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" fill="${CAJA}" stroke="${INK}" stroke-width="3"/>`);
    piezas.push(`<text x="${x + w / 2}" y="${y + h / 2 + 8}" text-anchor="middle" font-size="${it.length > 3 ? 19 : 23}" font-weight="bold" fill="${INK}">${it}</text>`);
  });
  return svgDe(ancho, y + h, piezas);
}

/** Fila de figuras; con `conHueco` se añade una cajita «?» al final. */
function filaFiguras(tipos: number[], conHueco: boolean): string {
  const n = tipos.length + (conHueco ? 1 : 0);
  const paso = Math.min(56, 440 / n);
  const r = Math.min(19, paso * 0.34);
  const ancho = n * paso;
  const cy = r + 10;
  const piezas: string[] = [];
  tipos.forEach((t, i) => piezas.push(forma(t, paso / 2 + i * paso, cy, r)));
  if (conHueco) {
    const x = paso / 2 + tipos.length * paso;
    piezas.push(`<rect x="${x - r}" y="${cy - r}" width="${r * 2}" height="${r * 2}" rx="6" fill="${HUECO}" stroke="${INK}" stroke-width="3"/>`);
    piezas.push(`<text x="${x}" y="${cy + 7}" text-anchor="middle" font-size="22" font-weight="bold" fill="${INK}">?</text>`);
  }
  return svgDe(ancho, cy + r + 8, piezas);
}

/** Figuras con puntos: cada una tiene uno más que la anterior. */
function figurasConPuntos(cantidades: number[]): string {
  const paso = 92;
  const ancho = cantidades.length * paso;
  const piezas: string[] = [];
  cantidades.forEach((k, i) => {
    const x0 = i * paso + 8;
    const anchoCaja = paso - 16;
    piezas.push(`<rect x="${x0}" y="6" width="${anchoCaja}" height="50" rx="8" fill="${CAJA}" stroke="${INK}" stroke-width="3"/>`);
    for (let j = 0; j < k; j++) {
      const cx = x0 + (anchoCaja / (k + 1)) * (j + 1);
      piezas.push(`<circle cx="${cx}" cy="31" r="6" fill="#0d6efd" stroke="${INK}" stroke-width="2"/>`);
    }
  });
  return svgDe(ancho, 62, piezas);
}

// ================== Azar con semilla ==================
function rng(semilla: number): () => number {
  let a = semilla >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function mezclar<T>(lista: T[], r: () => number): T[] {
  const c = [...lista];
  for (let i = c.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [c[i], c[j]] = [c[j], c[i]];
  }
  return c;
}

// ================== Opciones ==================
/** Cuatro números: el correcto y tres cercanos. */
function opcionesNumero(correcta: number, semilla: number): number[] {
  const paso = Math.abs(correcta) > 100 ? 20 : Math.abs(correcta) > 20 ? 5 : Math.abs(correcta) > 9 ? 2 : 1;
  const r = rng(semilla);
  const set = new Set<number>([correcta]);
  for (const d of mezclar([1, -1, 2, -2, 3, -3, 4, -4], r)) {
    if (set.size >= 4) break;
    const v = correcta + d * paso;
    if (v > 0) set.add(v);
  }
  let extra = 5;
  while (set.size < 4) {
    set.add(correcta + extra * paso);
    extra++;
  }
  return [...set];
}

// ================== Constructores de ejercicios ==================
/** Explica la regla de una serie numérica. */
function describirSerie(t: number[]): string {
  const n = t.length;
  const dif = t.slice(1).map((v, i) => v - t[i]);
  if (dif.every((d) => d === dif[0])) {
    return dif[0] >= 0
      ? `Se suma ${dif[0]} cada vez: ${t[n - 2]} + ${dif[0]} = ${t[n - 1]}.`
      : `Se resta ${-dif[0]} cada vez: ${t[n - 2]} − ${-dif[0]} = ${t[n - 1]}.`;
  }
  if (t.length > 3 && t.slice(2).every((v, i) => v === t[i] + t[i + 1])) {
    return `Cada número es la suma de los dos anteriores: ${t[n - 3]} + ${t[n - 2]} = ${t[n - 1]}.`;
  }
  if (t[0] !== 0 && t[1] % t[0] === 0) {
    const r = t[1] / t[0];
    if (t.slice(1).every((v, i) => v === t[i] * r)) {
      return `Se multiplica por ${r} cada vez: ${t[n - 2]} × ${r} = ${t[n - 1]}.`;
    }
  }
  const d2 = dif.slice(1).map((d, i) => d - dif[i]);
  if (d2.length && d2.every((d) => d === d2[0])) {
    return `Las diferencias aumentan de ${d2[0]} en ${d2[0]}: ${t[n - 2]} + ${dif[n - 2]} = ${t[n - 1]}.`;
  }
  return `El número que sigue es ${t[n - 1]}.`;
}

/** Serie numérica: se muestran los términos y se pide el siguiente. */
function serie(terminos: number[], explicacion?: string, distractores?: number[]): Base {
  const mostrar = terminos.slice(0, -1);
  const valor = terminos[terminos.length - 1];
  const dif = terminos.length > 1 ? terminos[1] - terminos[0] : 1;
  const set = new Set<number>([valor]);
  (distractores ?? [valor + dif, valor - dif, valor + 2 * dif]).forEach((v) => {
    if (set.size < 4 && v >= 0) set.add(v);
  });
  let extra = 3;
  while (set.size < 4) {
    set.add(valor + extra * Math.max(1, Math.abs(dif)));
    extra++;
  }
  return {
    tipo: 'serie',
    enunciado: '¿Qué número sigue en la serie?',
    imagen: filaCajas([...mostrar.map(String), '?']),
    opciones: [...set].map(String),
    correcta: String(valor),
    explicacion: explicacion ?? describirSerie(terminos)
  };
}

/** Serie con un hueco en medio: se pide el número que falta. */
function serieFaltante(terminos: number[], indice: number, explicacion: string): Base {
  const valor = terminos[indice];
  const dif = terminos[1] - terminos[0];
  const set = new Set<number>([valor]);
  [valor + dif, valor - dif, valor + 2 * dif].forEach((v) => {
    if (set.size < 4 && v >= 0) set.add(v);
  });
  let extra = 3;
  while (set.size < 4) {
    set.add(valor + extra * Math.max(1, Math.abs(dif)));
    extra++;
  }
  return {
    tipo: 'serie',
    enunciado: '¿Qué número falta en la serie?',
    imagen: filaCajas(terminos.map((t, i) => (i === indice ? '?' : String(t)))),
    opciones: [...set].map(String),
    correcta: String(valor),
    explicacion
  };
}

/** Conteo rápido de figuras dibujadas. */
function conteo(tipos: number[], preguntar: 'total' | 'tipo', tipoPreguntado = 0): Base {
  const total = tipos.length;
  const cuenta = preguntar === 'total' ? total : tipos.filter((t) => t === tipoPreguntado).length;
  const enunciado =
    preguntar === 'total'
      ? '¿Cuántas figuras hay en la fila?'
      : `¿Cuántos ${PLURALES[tipoPreguntado]} hay en la fila?`;
  const explicacion =
    preguntar === 'total'
      ? `Hay ${total} figuras en la fila.`
      : `Hay ${cuenta} ${PLURALES[tipoPreguntado]} en la fila.`;
  return {
    tipo: 'conteo',
    enunciado,
    imagen: filaFiguras(tipos, false),
    opciones: opcionesNumero(cuenta, total * 37 + cuenta).map(String),
    correcta: String(cuenta),
    explicacion
  };
}

/** Comparación: cuál de los números es el mayor. */
function mayor(numeros: number[]): Base {
  const valor = Math.max(...numeros);
  return {
    tipo: 'comparacion',
    enunciado: '¿Cuál de estos números es el mayor?',
    opciones: numeros.map(String),
    correcta: String(valor),
    explicacion: `Comparando uno a uno, el mayor es ${valor}.`
  };
}

/** Comparación: cuál de los números es el menor. */
function menor(numeros: number[]): Base {
  const valor = Math.min(...numeros);
  return {
    tipo: 'comparacion',
    enunciado: '¿Cuál de estos números es el menor?',
    opciones: numeros.map(String),
    correcta: String(valor),
    explicacion: `Comparando uno a uno, el menor es ${valor}.`
  };
}

/** Comparación: qué número está entre dos dados. */
function entre(a: number, b: number, medio: number): Base {
  const min = Math.min(a, b);
  const max = Math.max(a, b);
  return {
    tipo: 'comparacion',
    enunciado: `¿Qué número está entre ${min} y ${max}?`,
    opciones: opcionesNumero(medio, medio * 31 + 7).map(String),
    correcta: String(medio),
    explicacion: `${medio} es mayor que ${min} y menor que ${max}.`
  };
}

/** Comparación: cuál de las operaciones da el resultado mayor. */
function comparaOperaciones(ops: { texto: string; valor: number }[]): Base {
  const mayorValor = Math.max(...ops.map((o) => o.valor));
  return {
    tipo: 'comparacion',
    enunciado: '¿Cuál de estas operaciones da el resultado mayor?',
    opciones: ops.map((o) => o.texto),
    correcta: ops.find((o) => o.valor === mayorValor)!.texto,
    explicacion:
      ops.map((o) => `${o.texto} = ${o.valor}`).join(' · ') + `. El resultado mayor es ${mayorValor}.`
  };
}

/** Patrón: ciclo de figuras que se repite. */
function patronCiclo(patron: number[], mostrar: number): Base {
  const seq = Array.from({ length: mostrar }, (_, i) => patron[i % patron.length]);
  const siguiente = patron[mostrar % patron.length];
  return {
    tipo: 'patron',
    enunciado: '¿Qué figura sigue en el patrón?',
    imagen: filaFiguras(seq, true),
    opciones: [...NOMBRES],
    correcta: NOMBRES[siguiente],
    explicacion:
      `El patrón se repite: ${patron.map((f) => NOMBRES[f].toLowerCase()).join(', ')}. ` +
      `Después de la figura ${mostrar} toca la figura ${(mostrar % patron.length) + 1} del patrón: ` +
      `${NOMBRES[siguiente].toLowerCase()}.`
  };
}

/** Patrón: qué figura ocupa el lugar n de un ciclo. */
function patronLugar(patron: number[], lugar: number): Base {
  const seq = Array.from({ length: Math.min(8, patron.length * 2) }, (_, i) => patron[i % patron.length]);
  const idx = (lugar - 1) % patron.length;
  const cociente = Math.floor(lugar / patron.length);
  const resto = lugar % patron.length;
  return {
    tipo: 'patron',
    enunciado: `Si el patrón sigue así, ¿qué figura ocupa el lugar ${lugar}?`,
    imagen: filaFiguras(seq, false),
    opciones: [...NOMBRES],
    correcta: NOMBRES[patron[idx]],
    explicacion:
      `El patrón (${patron.map((f) => NOMBRES[f].toLowerCase()).join(', ')}) se repite cada ${patron.length} figuras. ` +
      `${lugar} ÷ ${patron.length} da cociente ${cociente} y resto ${resto}, así que el lugar ${lugar} ` +
      `corresponde a la figura ${resto === 0 ? patron.length : resto} del patrón: ${NOMBRES[patron[idx]].toLowerCase()}.`
  };
}

/** Patrón: figuras que crecen (cada una tiene un punto más). */
function patronCrece(cantidades: number[], pide: number): Base {
  const valor = pide;
  return {
    tipo: 'patron',
    enunciado: `¿Cuántos puntos tendrá la figura ${pide}?`,
    imagen: figurasConPuntos(cantidades),
    opciones: opcionesNumero(valor, valor * 53 + 11).map(String),
    correcta: String(valor),
    explicacion:
      `Cada figura tiene un punto más que la anterior (${cantidades.join(', ')}…). ` +
      `La figura ${pide} tiene ${valor} puntos.`
  };
}

// ================== Niveles ==================
const NIVEL_1: Base[] = [
  // --- series ---
  serie([2, 4, 6, 8, 10]),
  serie([10, 8, 6, 4, 2]),
  serie([1, 3, 5, 7, 9]),
  serie([5, 10, 15, 20, 25]),
  // --- conteo rápido ---
  conteo([0, 1, 2, 1], 'total'),
  conteo([1, 2, 0, 1, 2], 'total'),
  conteo([0, 0, 1, 2, 3, 1], 'total'),
  conteo([3, 2, 1, 0, 2, 3, 1], 'total'),
  // --- comparaciones ---
  mayor([23, 47, 15, 39]),
  mayor([8, 12, 6, 9]),
  menor([34, 21, 43, 12]),
  entre(20, 30, 25),
  // --- patrones ---
  patronCiclo([0, 2], 5),
  patronCiclo([1, 3], 5),
  patronCiclo([0, 1, 2], 7)
];

const NIVEL_2: Base[] = [
  // --- series ---
  serie([2, 5, 8, 11, 14]),
  serie([1, 4, 9, 16, 25], 'Son los cuadrados: 1×1, 2×2, 3×3, 4×4 y 5×5 = 25.'),
  serie([1, 2, 3, 5, 8, 13]),
  serie([3, 6, 12, 24, 48]),
  // --- conteo rápido ---
  conteo([0, 1, 2, 0, 1, 0, 2, 1, 0, 2], 'tipo', 0),
  conteo([1, 2, 3, 1, 2, 3, 1, 2], 'total'),
  conteo([0, 1, 2, 3, 0, 1, 2, 3, 0, 1, 2, 3], 'total'),
  conteo([1, 1, 2, 3, 3, 2, 1, 1, 2], 'tipo', 2),
  // --- comparaciones ---
  mayor([248, 189, 456, 237]),
  menor([512, 348, 479, 265]),
  entre(300, 400, 350),
  comparaOperaciones([
    { texto: '6 × 7', valor: 42 },
    { texto: '5 + 35', valor: 40 },
    { texto: '8 × 4', valor: 32 },
    { texto: '45 − 9', valor: 36 }
  ]),
  // --- patrones ---
  patronCiclo([0, 1, 2], 8),
  patronLugar([1, 2, 3], 10),
  patronCrece([1, 2, 3], 5)
];

const NIVEL_3: Base[] = [
  // --- series ---
  serie([1, 2, 4, 7, 11, 16]),
  serie([2, 6, 18, 54, 162]),
  serie([3, 7, 15, 31, 63], 'Se multiplica por 2 y se suma 1: 31 × 2 + 1 = 63.'),
  serieFaltante([4, 10, 16, 22, 28], 1, 'Se suma 6 cada vez: 4 + 6 = 10 (y 10 + 6 = 16).'),
  // --- conteo rápido ---
  conteo([0, 1, 2, 3, 0, 1, 2, 3, 0, 1, 2, 3, 0, 1], 'tipo', 0),
  conteo([0, 1, 2, 3, 0, 1, 2, 3, 0, 1, 2, 3, 0, 1, 2, 3], 'total'),
  conteo([2, 2, 1, 3, 1, 2, 3, 1, 2, 1, 3, 2], 'tipo', 1),
  // --- comparaciones ---
  mayor([1204, 1189, 1456, 1237]),
  menor([3210, 2987, 3456, 2650]),
  entre(500, 600, 560),
  comparaOperaciones([
    { texto: '8 × 9', valor: 72 },
    { texto: '34 + 39', valor: 73 },
    { texto: '7 × 9', valor: 63 },
    { texto: '96 − 18', valor: 78 }
  ]),
  // --- patrones ---
  patronCiclo([0, 2, 1, 3], 8),
  patronLugar([0, 1, 2, 3], 14),
  patronCrece([1, 2, 3], 8),
  patronCiclo([3, 1], 9)
];

/** Monta un nivel: baraja las opciones de cada ejercicio. */
function armar(nivel: number, bases: Base[]): Ejercicio[] {
  return bases.map((b, i) => {
    const r = rng(nivel * 1000 + i);
    const opciones = mezclar(b.opciones, r);
    return {
      id: `am-${nivel}-${i + 1}`,
      nivel,
      tipo: b.tipo,
      enunciado: b.enunciado,
      imagen: b.imagen,
      opciones,
      correcta: b.correcta,
      explicacion: b.explicacion
    };
  });
}

/** Los 45 ejercicios de la actividad (15 por nivel). */
export const EJERCICIOS: Ejercicio[] = [
  ...armar(1, NIVEL_1),
  ...armar(2, NIVEL_2),
  ...armar(3, NIVEL_3)
];
