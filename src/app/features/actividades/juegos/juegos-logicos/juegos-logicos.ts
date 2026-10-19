import { Component } from "@angular/core";
import { Router } from "@angular/router";
import { AttemptsService } from "@core/services/attempts.service";
import { GameUiService } from "@core/services/game-ui.service";
import { QuizEngine } from '@core/services/quiz-engine.service';
import { JuegoQuizBase } from '@core/services/juego-quiz-base';
import { Quiz } from "@shared/components/quiz/quiz";
import {
  ConfiguracionQuiz,
  PreguntaQuiz,
  TipoPregunta,
} from "@shared/components/quiz/quiz.model";

const EJERCICIOS_POR_NIVEL = 25;
const PUNTOS_POR_NIVEL = [10, 15, 20];
const IDS_OPCION = ["a", "b", "c", "d"] as const;

/* ════════════════════════════════════════════════════════════════
   GENERADOR: SUDOKUS CON GRÁFICOS SVG
   · Determinista: el ejercicio N de un nivel siempre es el mismo.
   · Cada sudoku tiene solución única y se resuelve con lógica.
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
    enunciado: `Sudoku ${n}×${n}: ¿qué ${cfg.objeto} va en la casilla?`,
    tipo: "opcion-multiple" as TipoPregunta,
    nivel,
    opciones: valores.map((v, k) => ({ id: IDS_OPCION[k], texto: cfg.simbolos[v - 1] })),
    respuestaCorrectaId: IDS_OPCION[valores.indexOf(correcto)],
    explicacion,
    puntos: PUNTOS_POR_NIVEL[nivel - 1],
    imagen: svgSudoku(cfg, puzzle, objetivo),
  };
}

function construirPregunta(nivel: number, e: number): PreguntaQuiz {
  return construirSudoku(nivel, e);
}
// <GEN-END>

@Component({
  selector: "app-juegos-logicos",
  standalone: true,
  imports: [Quiz],
  providers: [QuizEngine],
  template: `
    <app-quiz
      [vista]="engine.vista()"
      (volver)="engine.volver()"
      (nivelElegido)="engine.nivelElegido($event)"
      (empezar)="engine.empezar()"
      (respuestaSeleccionada)="engine.responder($event)"
      (avanzar)="engine.avanzar()"
      (reiniciar)="engine.reiniciar()"
      (alternarSonido)="engine.alternarSonido()"
    />
  `,
})
export class JuegosLogicos extends JuegoQuizBase {

  protected readonly config: ConfiguracionQuiz = {
    titulo: "Juegos Lógicos",
    descripcion: "Resuelve sudokus deduciendo la casilla que falta.",
    colorTema: "orange",
    niveles: 3,
    preguntasPorNivel: EJERCICIOS_POR_NIVEL,
    etiquetasNiveles: ["Inicial", "Intermedio", "Avanzado"],
    preguntas: [],
  };
  protected readonly slug = 'juegos-logicos';



/** Construye los 75 ejercicios (25 por nivel): sudokus y cuadrados mágicos. */
  protected generar(): PreguntaQuiz[] {
    const out: PreguntaQuiz[] = [];
    for (let nivel = 1; nivel <= 3; nivel++) {
      for (let e = 1; e <= EJERCICIOS_POR_NIVEL; e++) {
        out.push(construirPregunta(nivel, e));
      }
    }
    return out;
  }

  /** Baraja el orden de una lista (Fisher-Yates) con el azar de la partida. */
  private mezclar<T>(a: T[]): T[] {
    const c = [...a];
    for (let i = c.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [c[i], c[j]] = [c[j], c[i]];
    }
    return c;
  }



}
