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
   GENERADOR: SUDOKUS Y CUADRADOS MÁGICOS CON GRÁFICOS SVG
   · Los ejercicios impares (1, 3, 5…) son sudokus; los pares son cuadrados mágicos.
   · Determinista: el ejercicio N de un nivel siempre es el mismo.
   · Cada sudoku tiene solución única; cada cuadrado mágico se deduce con una línea.
   ════════════════════════════════════════════════════════════════ */
// <GEN-START>
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
    if (t > 0 && !vistos.has(t)) {
      vistos.add(t);
      prio.push(t);
    }
  const relleno: number[] = [];
  for (const d of [1, -1, 2, -2, 3, -3, 4, -4]) {
    const t = correcto + d;
    if (t > 0 && !vistos.has(t)) {
      vistos.add(t);
      relleno.push(t);
    }
  }
  const elegidos = [...mezclar(prio, rnd), ...relleno].slice(0, 3);
  return finalizar(String(correcto), elegidos.map(String), rnd);
}

/* ───────────── Dibujo SVG común ───────────── */
const FUENTE = "'Segoe UI Emoji','Apple Color Emoji','Noto Color Emoji',sans-serif";

function envolver(cuerpo: string, alto: number): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 ${alto}" width="420" height="${alto}">` +
    `<rect x="3" y="3" width="414" height="${alto - 6}" rx="20" fill="#fffbeb" stroke="#f59e0b" stroke-width="3"/>` +
    cuerpo +
    `</svg>`
  );
}
function texto(x: number, y: number, t: string, size: number, fill: string, peso = 800, fuente = "sans-serif"): string {
  return `<text x="${x}" y="${y}" font-size="${size}" font-weight="${peso}" fill="${fill}" text-anchor="middle" dy=".35em" font-family="${fuente}">${t}</text>`;
}

/* ═════════════════ SUDOKU ═════════════════ */
interface NivelSudoku {
  id: number;
  tam: number;
  cajaF: number;
  cajaC: number;
  simbolos: string[];
  esNumero: boolean;
  objeto: string;
  vaciosMin: number;
  vaciosMax: number;
}
const SUDOKUS: NivelSudoku[] = [
  { id: 1, tam: 4, cajaF: 2, cajaC: 2, simbolos: ["🐶", "🐱", "🐰", "🦊"], esNumero: false, objeto: "animalito", vaciosMin: 5, vaciosMax: 9 },
  { id: 2, tam: 6, cajaF: 2, cajaC: 3, simbolos: ["🍎", "🍊", "🍋", "🍇", "🍓", "🍉"], esNumero: false, objeto: "fruta", vaciosMin: 12, vaciosMax: 20 },
  { id: 3, tam: 9, cajaF: 3, cajaC: 3, simbolos: ["1", "2", "3", "4", "5", "6", "7", "8", "9"], esNumero: true, objeto: "número", vaciosMin: 34, vaciosMax: 50 },
];

function ordenGrupos(nGrupos: number, tam: number, rnd: () => number): number[] {
  const out: number[] = [];
  for (const g of mezclar(Array.from({ length: nGrupos }, (_, i) => i), rnd)) {
    for (const k of mezclar(Array.from({ length: tam }, (_, i) => i), rnd)) out.push(g * tam + k);
  }
  return out;
}
function bits(m: number): number {
  let c = 0;
  while (m) {
    m &= m - 1;
    c++;
  }
  return c;
}
function candidatos(g: number[], i: number, cfg: NivelSudoku): number {
  const n = cfg.tam;
  const r = Math.floor(i / n);
  const c = i % n;
  let usado = 0;
  for (let k = 0; k < n; k++) {
    usado |= 1 << g[r * n + k];
    usado |= 1 << g[k * n + c];
  }
  const r0 = r - (r % cfg.cajaF);
  const c0 = c - (c % cfg.cajaC);
  for (let dr = 0; dr < cfg.cajaF; dr++)
    for (let dc = 0; dc < cfg.cajaC; dc++) usado |= 1 << g[(r0 + dr) * n + c0 + dc];
  let todos = 0;
  for (let v = 1; v <= n; v++) todos |= 1 << v;
  return todos & ~usado;
}
function contarSoluciones(g: number[], cfg: NivelSudoku, limite: number): number {
  const n = cfg.tam;
  let mejor = -1;
  let mascara = 0;
  let minimo = n + 1;
  for (let i = 0; i < g.length; i++) {
    if (g[i] !== 0) continue;
    const m = candidatos(g, i, cfg);
    const cnt = bits(m);
    if (cnt < minimo) {
      minimo = cnt;
      mejor = i;
      mascara = m;
      if (cnt <= 1) break;
    }
  }
  if (mejor === -1) return 1;
  if (minimo === 0) return 0;
  let total = 0;
  for (let v = 1; v <= n && total < limite; v++) {
    if (mascara & (1 << v)) {
      g[mejor] = v;
      total += contarSoluciones(g, cfg, limite - total);
    }
  }
  g[mejor] = 0;
  return total;
}
/** paso/pasos: posición del sudoku dentro de su nivel (controla cuántas celdas se vacían). */
function generarPuzzle(cfg: NivelSudoku, ejercicio: number, paso: number, pasos: number) {
  const rnd = crearRng(cfg.id * 100003 + ejercicio * 7919);
  const n = cfg.tam;
  const filas = ordenGrupos(n / cfg.cajaF, cfg.cajaF, rnd);
  const cols = ordenGrupos(n / cfg.cajaC, cfg.cajaC, rnd);
  const perm = mezclar(Array.from({ length: n }, (_, i) => i + 1), rnd);
  const solucion: number[] = [];
  for (let r = 0; r < n; r++)
    for (let c = 0; c < n; c++) {
      const p = filas[r];
      const q = cols[c];
      solucion.push(perm[(cfg.cajaC * (p % cfg.cajaF) + Math.floor(p / cfg.cajaF) + q) % n]);
    }
  const objetivo = cfg.vaciosMin + Math.round(((cfg.vaciosMax - cfg.vaciosMin) * paso) / Math.max(1, pasos - 1));
  const puzzle = [...solucion];
  let quitadas = 0;
  for (const i of mezclar(Array.from({ length: n * n }, (_, k) => k), rnd)) {
    if (quitadas >= objetivo) break;
    const v = puzzle[i];
    puzzle[i] = 0;
    if (contarSoluciones(puzzle, cfg, 2) === 1) quitadas++;
    else puzzle[i] = v;
  }
  return { puzzle, solucion };
}

function svgSudoku(cfg: NivelSudoku, puzzle: number[], objetivo: number): string {
  const n = cfg.tam;
  const lado = 360;
  const c = lado / n;
  const x0 = 30;
  const y0 = 10;
  let s = "";
  for (let r = 0; r < n; r++)
    for (let k = 0; k < n; k++) {
      const i = r * n + k;
      const alt = (Math.floor(r / cfg.cajaF) + Math.floor(k / cfg.cajaC)) % 2 === 1;
      const fill = i === objetivo ? "#fde047" : alt ? "#fef3c7" : "#ffffff";
      s += `<rect x="${x0 + k * c}" y="${y0 + r * c}" width="${c}" height="${c}" fill="${fill}"/>`;
      const cx = x0 + k * c + c / 2;
      const cy = y0 + r * c + c / 2;
      if (i === objetivo) s += texto(cx, cy, "?", c * 0.62, "#b45309");
      else if (puzzle[i] !== 0) {
        const v = puzzle[i];
        s += cfg.esNumero
          ? texto(cx, cy, String(v), c * 0.62, `hsl(${(v * 40) % 360} 70% 36%)`)
          : texto(cx, cy, cfg.simbolos[v - 1], c * 0.6, "#000", 400, FUENTE);
      }
    }
  for (let i = 1; i < n; i++) {
    const grueso = i % cfg.cajaC === 0;
    s += `<line x1="${x0 + i * c}" y1="${y0}" x2="${x0 + i * c}" y2="${y0 + lado}" stroke="${grueso ? "#92400e" : "#d6d3d1"}" stroke-width="${grueso ? 3.5 : 1.2}"/>`;
    const gruesoF = i % cfg.cajaF === 0;
    s += `<line x1="${x0}" y1="${y0 + i * c}" x2="${x0 + lado}" y2="${y0 + i * c}" stroke="${gruesoF ? "#92400e" : "#d6d3d1"}" stroke-width="${gruesoF ? 3.5 : 1.2}"/>`;
  }
  s += `<rect x="${x0}" y="${y0}" width="${lado}" height="${lado}" fill="none" stroke="#92400e" stroke-width="4" rx="4"/>`;
  return envolver(s, 380);
}

function construirSudoku(nivel: number, e: number): PreguntaQuiz {
  const cfg = SUDOKUS[nivel - 1];
  const n = cfg.tam;
  const paso = (e - 1) / 2; // 0..12
  const { puzzle, solucion } = generarPuzzle(cfg, e, paso, 13);
  const rnd = crearRng(nivel * 911 + e * 131);

  // Casilla con menos posibilidades (idealmente solo una → se deduce con lógica)
  let minimo = n + 1;
  let elegibles: number[] = [];
  for (let i = 0; i < puzzle.length; i++) {
    if (puzzle[i] !== 0) continue;
    const k = bits(candidatos(puzzle, i, cfg));
    if (k < minimo) {
      minimo = k;
      elegibles = [i];
    } else if (k === minimo) elegibles.push(i);
  }
  const objetivo = elegibles[Math.floor(rnd() * elegibles.length)];
  const correcto = solucion[objetivo];
  const todos = Array.from({ length: n }, (_, i) => i + 1);
  const otros = mezclar(todos.filter((v) => v !== correcto), rnd).slice(0, 3);
  const valores = mezclar([correcto, ...otros], rnd);

  // Explicación
  const r = Math.floor(objetivo / n);
  const c = objetivo % n;
  const vistos = new Set<number>();
  for (let k = 0; k < n; k++) {
    vistos.add(puzzle[r * n + k]);
    vistos.add(puzzle[k * n + c]);
  }
  const r0 = r - (r % cfg.cajaF);
  const c0 = c - (c % cfg.cajaC);
  for (let dr = 0; dr < cfg.cajaF; dr++)
    for (let dc = 0; dc < cfg.cajaC; dc++) vistos.add(puzzle[(r0 + dr) * n + c0 + dc]);
  vistos.delete(0);
  const yaEstan = todos.filter((v) => vistos.has(v)).map((v) => cfg.simbolos[v - 1]);
  const faltan = todos.filter((v) => !vistos.has(v));
  const sim = cfg.simbolos[correcto - 1];
  const explicacion =
    `En la fila, la columna y la caja de la casilla ❓ ya están: ${yaEstan.join(" ")}. ` +
    (faltan.length === 1
      ? `El único que falta es ${sim}.`
      : `Quedan ${faltan.length} posibilidades (${faltan.map((v) => cfg.simbolos[v - 1]).join(" ")}); al mirar el resto del tablero, la única que encaja es ${sim}.`);

  return {
    id: `jl-${nivel}-${e}`,
    enunciado:
      `Sudoku ${n}×${n}: ¿qué ${cfg.objeto} va en la casilla ❓?\n` +
      `No se repite ningún valor en la fila, la columna ni la caja (las cajas están separadas por líneas gruesas).`,
    tipo: "opcion-multiple" as TipoPregunta,
    nivel,
    opciones: valores.map((v, k) => ({ id: IDS_OPCION[k], texto: cfg.simbolos[v - 1] })),
    respuestaCorrectaId: IDS_OPCION[valores.indexOf(correcto)],
    explicacion,
    puntos: PUNTOS_POR_NIVEL[nivel - 1],
    imagen: svgSudoku(cfg, puzzle, objetivo),
  };
}

/* ═════════════════ CUADRADOS MÁGICOS ═════════════════ */
const LO_SHU = [[2, 7, 6], [9, 5, 1], [4, 3, 8]]; // 3×3, suma 15
const DURERO = [[16, 3, 2, 13], [5, 10, 11, 8], [9, 6, 7, 12], [4, 15, 14, 1]]; // 4×4, suma 34

function rotar(m: number[][]): number[][] {
  const n = m.length;
  return Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => m[n - 1 - j][i]));
}
/** Las 8 simetrías (giros y reflejos) de un cuadrado mágico siguen siendo mágicas. */
function transformar(m: number[][], t: number): number[][] {
  let r = m.map((f) => [...f]);
  if (t >= 4) r = r.map((f) => [...f].reverse());
  for (let i = 0; i < t % 4; i++) r = rotar(r);
  return r;
}
function cuadradoMagico(nivel: number, rnd: () => number): number[][] {
  const base = nivel === 3 ? DURERO : LO_SHU;
  const m = transformar(base, ent(rnd, 0, 7));
  // multiplicar por k y sumar d a todos los números conserva la propiedad mágica
  let k = 1;
  let d = 0;
  if (nivel === 2) {
    k = ent(rnd, 1, 3);
    d = ent(rnd, 1, 10);
  } else if (nivel === 3) {
    k = ent(rnd, 1, 2);
    d = ent(rnd, 0, 10);
  }
  return m.map((f) => f.map((x) => x * k + d));
}

interface Linea {
  nombre: string;
  celdas: number[];
}
function lineasDe(n: number): Linea[] {
  const L: Linea[] = [];
  for (let r = 0; r < n; r++)
    L.push({ nombre: `la fila ${r + 1}`, celdas: Array.from({ length: n }, (_, c) => r * n + c) });
  for (let c = 0; c < n; c++)
    L.push({ nombre: `la columna ${c + 1}`, celdas: Array.from({ length: n }, (_, r) => r * n + c) });
  L.push({ nombre: "la diagonal ↘", celdas: Array.from({ length: n }, (_, i) => i * n + i) });
  L.push({ nombre: "la diagonal ↙", celdas: Array.from({ length: n }, (_, i) => i * n + (n - 1 - i)) });
  return L;
}

/** Elige la casilla ❓ y qué otras casillas se ocultan, asegurando que se pueda deducir. */
function disenarHuecos(n: number, rnd: () => number, pedido: number, requiereLineaLibre: boolean) {
  const lineas = lineasDe(n);
  for (let cant = pedido; cant >= 1; cant--) {
    for (let intento = 0; intento < 300; intento++) {
      const todos = mezclar(Array.from({ length: n * n }, (_, i) => i), rnd);
      const objetivo = todos[0];
      const suyas = lineas.filter((l) => l.celdas.includes(objetivo));
      const linea = suyas[Math.floor(rnd() * suyas.length)];
      const protegidas = new Set(linea.celdas.filter((i) => i !== objetivo));
      const extra = todos.slice(1).filter((i) => !protegidas.has(i)).slice(0, cant - 1);
      const ocultas = new Set<number>([objetivo, ...extra]);
      const libre = lineas.find((l) => l.celdas.every((i) => !ocultas.has(i))) ?? null;
      if (requiereLineaLibre && !libre) continue;
      return { objetivo, ocultas, linea, libre };
    }
  }
  throw new Error("No se pudo diseñar el cuadrado mágico");
}

function svgMagico(m: number[][], ocultas: Set<number>, objetivo: number, S: number | null): string {
  const n = m.length;
  const c = n === 3 ? 96 : 76;
  const lado = c * n;
  const x0 = (420 - lado) / 2;
  const y0 = n === 3 ? 66 : 62;
  const alto = y0 + lado + 18;
  const banner = S !== null ? `✨ Cada fila, columna y diagonal suma ${S} ✨` : "✨ Todas las líneas suman lo mismo ✨";
  let s =
    `<rect x="20" y="14" width="380" height="36" rx="18" fill="#f59e0b"/>` + texto(210, 32, banner, 15, "#ffffff", 800);
  for (let r = 0; r < n; r++)
    for (let k = 0; k < n; k++) {
      const i = r * n + k;
      const x = x0 + k * c + 3;
      const y = y0 + r * c + 3;
      const w = c - 6;
      const cx = x + w / 2;
      const cy = y + w / 2;
      if (i === objetivo) {
        s += `<rect x="${x}" y="${y}" width="${w}" height="${w}" rx="12" fill="#fde047" stroke="#b45309" stroke-width="3"/>`;
        s += texto(cx, cy, "?", c * 0.55, "#b45309");
      } else if (ocultas.has(i)) {
        s += `<rect x="${x}" y="${y}" width="${w}" height="${w}" rx="12" fill="#f1f5f9" stroke="#94a3b8" stroke-width="2" stroke-dasharray="6 4"/>`;
      } else {
        const v = m[r][k];
        s += `<rect x="${x}" y="${y}" width="${w}" height="${w}" rx="12" fill="hsl(${(v * 47) % 360} 85% 88%)" stroke="hsl(${(v * 47) % 360} 55% 55%)" stroke-width="2.5"/>`;
        s += texto(cx, cy, String(v), c * 0.4, "#1e293b");
      }
    }
  return envolver(s, alto);
}

function construirMagico(nivel: number, e: number): PreguntaQuiz {
  const rnd = crearRng(nivel * 5003 + e * 104729 + 7);
  const m = cuadradoMagico(nivel, rnd);
  const n = m.length;
  const plano = m.flat();
  const S = m[0].reduce((a, b) => a + b, 0);
  const paso = e / 2 - 1; // 0..11
  const pedido = nivel === 1 ? 1 : nivel === 2 ? 2 + Math.floor(paso / 4) : 3 + Math.floor(paso / 3);
  const { objetivo, ocultas, linea, libre } = disenarHuecos(n, rnd, pedido, nivel === 3);

  const correcto = plano[objetivo];
  const otros = linea.celdas.filter((i) => i !== objetivo).map((i) => plano[i]);
  const suma = otros.reduce((a, b) => a + b, 0);
  const diagonal = nivel === 3 ? libre : null;
  const dadoS = nivel < 3;

  const op = opcionesNumero(correcto, [suma, S, correcto + 1, correcto - 1], rnd);
  const cuenta = `${otros.join(" + ")} + ❓ = ${S}  →  ❓ = ${S} − ${suma} = ${correcto}`;
  const explicacion = dadoS
    ? `Mira ${linea.nombre}: ${cuenta}.`
    : `Primero hallamos la suma mágica con una línea completa: ${libre!.nombre} = ${libre!.celdas.map((i) => plano[i]).join(" + ")} = ${S}. ` +
      `Luego, en ${linea.nombre}: ${cuenta}.`;
  void diagonal;

  return {
    id: `jl-${nivel}-${e}`,
    enunciado:
      `Cuadrado mágico ${n}×${n}: ¿qué número va en la casilla ❓?\n` +
      (dadoS
        ? `En un cuadrado mágico todas las filas, columnas y diagonales suman ${S}.`
        : `En un cuadrado mágico todas las filas, columnas y diagonales suman lo mismo. ¡Descubre cuánto!`),
    tipo: "opcion-multiple" as TipoPregunta,
    nivel,
    opciones: op.textos.map((t, k) => ({ id: IDS_OPCION[k], texto: t })),
    respuestaCorrectaId: IDS_OPCION[op.correcta],
    explicacion,
    puntos: PUNTOS_POR_NIVEL[nivel - 1],
    imagen: svgMagico(m, ocultas, objetivo, dadoS ? S : null),
  };
}

/** Impares: sudoku · pares: cuadrado mágico. */
function construirPregunta(nivel: number, e: number): PreguntaQuiz {
  return e % 2 === 1 ? construirSudoku(nivel, e) : construirMagico(nivel, e);
}
// <GEN-END>

@Component({
  selector: "app-juegos-logicos",
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
export class JuegosLogicos implements OnInit, OnDestroy {
  private readonly gameUi = inject(GameUiService);
  private readonly attempts = inject(AttemptsService);
  private readonly router = inject(Router);
  private intentoId: string | null = null;
  private intentoInicio = 0;

  readonly config: ConfiguracionQuiz = {
    titulo: "Juegos Lógicos",
    descripcion: "Resuelve sudokus y cuadrados mágicos.",
    colorTema: "orange",
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
    void this.attempts.iniciar("juegos-logicos").then((s) => {
      this.intentoId = s?.id ?? null;
      this.intentoInicio = s?.inicio ?? Date.now();
    });
  }
  ngOnDestroy(): void {
    this.gameUi.setJugando(false);
    if (this.intentoId)
      void this.attempts.finalizar(this.intentoId, this.intentoInicio, {
        actividadId: "juegos-logicos",
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
      colorTema: "orange",
      seleccionada: null,
      esCorrecta: null,
      mostrarConfeti: false,
      sonidosActivos: true,
      segundosRestantes: 0,
    };
  }

  /** Construye los 75 ejercicios (25 por nivel): sudokus y cuadrados mágicos. */
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
