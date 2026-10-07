import { Component, OnDestroy, OnInit, computed, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';

import { AttemptsService } from '../../../../core/services/attempts.service';
import { GameUiService } from '../../../../core/services/game-ui.service';

// ====================== GENERADOR DE CUADRADOS MÁGICOS ======================
// En un cuadrado mágico, todas las filas, columnas y diagonales suman lo mismo
// (el número mágico). Cada nivel crea 25 ejercicios al azar, sin repetir, con
// retroalimentación paso a paso (solo con sumas, restas y una división).

const CANTIDAD = 25; // ejercicios por nivel
const PUNTOS: Record<number, number> = { 1: 10, 2: 15, 3: 20 };

interface Celda { t: string; c: string } // texto y clases de Bootstrap
type Meta = [number, number] | 'S'; // un casillero, o el número mágico

interface Cuadrado {
  oculto: Celda[][];   // lo que se ve al jugar
  completo: Celda[][]; // el cuadrado resuelto (se muestra al responder)
  lineas: [number, number][][]; // filas/columnas/diagonales que se trazan como pista
  cabecera: string;    // qué se dice del número mágico
  pregunta: string;
  opciones: number[];
  correcta: number;
  texto: string;
  pasos: string[];
}

// Utilidades
const azar = (a: number, b: number) => Math.floor(Math.random() * (b - a + 1)) + a;
const mezclar = <T>(l: T[]) => [...l].sort(() => Math.random() - 0.5);
const suma = (l: number[]) => l.reduce((s, x) => s + x, 0);

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

// ---------------------- CUADRADOS COMPLETOS ----------------------

// Gira 90° y/o refleja un cuadrado (sigue siendo mágico)
function transformar(v: number[][]): number[][] {
  let m = v.map((f) => [...f]);
  for (let i = azar(0, 3); i > 0; i--) m = m[0].map((_, j) => m.map((f) => f[j]).reverse());
  if (Math.random() < 0.5) m = m.map((f) => [...f].reverse());
  return m;
}

// Orden 3: con centro c y dos números libres p y q salen TODOS los cuadrados mágicos 3×3
function cuadrado3(rango: [number, number]): number[][] {
  for (;;) {
    const c = azar(rango[0], rango[1]), p = azar(1, c - 1), q = azar(1, c - 1);
    const v = [
      [c + p, c - p - q, c + q],
      [c - p + q, c, c + p - q],
      [c - q, c + p + q, c - p],
    ];
    const todos = v.flat();
    if (todos.every((x) => x >= 1) && new Set(todos).size === 9) return transformar(v);
  }
}

// Orden 4: el cuadrado de Durero (suma 34), girado y con un número sumado a todos
function cuadrado4(): number[][] {
  const base = [[16, 3, 2, 13], [5, 10, 11, 8], [9, 6, 7, 12], [4, 15, 14, 1]];
  const k = azar(0, 12);
  return transformar(base.map((f) => f.map((x) => x + k)));
}

// Las filas, columnas y diagonales de un cuadrado de orden n
function lineas(n: number): { nombre: string; celdas: [number, number][] }[] {
  const idx = Array.from({ length: n }, (_, i) => i);
  return [
    ...idx.map((i) => ({ nombre: `Fila ${i + 1}`, celdas: idx.map((j) => [i, j] as [number, number]) })),
    ...idx.map((j) => ({ nombre: `Columna ${j + 1}`, celdas: idx.map((i) => [i, j] as [number, number]) })),
    { nombre: 'Diagonal ↘', celdas: idx.map((i) => [i, i] as [number, number]) },
    { nombre: 'Diagonal ↙', celdas: idx.map((i) => [i, n - 1 - i] as [number, number]) },
  ];
}

// Las líneas que conviene sumar para resolver el ejercicio, usadas como pista visual.
// Si se busca un casillero: todas las líneas que lo contienen (fila, columna y, si toca,
// las diagonales). Si se busca el número mágico: la línea completa que lo revela (si no
// la hay no hay línea que sumar, porque sale de 3 × centro en los cuadrados de orden 3).
function lineasPista(dados: boolean[][], meta: Meta): [number, number][][] {
  const ls = lineas(dados.length);
  if (meta !== 'S') {
    const [r, c] = meta;
    return ls.filter((l) => l.celdas.some(([a, b]) => a === r && b === c)).map((l) => l.celdas);
  }
  const completa = ls.find((l) => l.celdas.every(([a, b]) => dados[a][b]));
  return completa ? [completa.celdas] : [];
}

// ---------------------- DIBUJO (clases de Bootstrap) ----------------------

function celdasDe(v: number[][], dados: boolean[][], meta: Meta | null, revelar: boolean): Celda[][] {
  return v.map((fila, r) =>
    fila.map((x, c) => {
      if (meta && meta !== 'S' && meta[0] === r && meta[1] === c) {
        return revelar
          ? { t: String(x), c: 'bg-success border-success text-white' }
          : { t: '?', c: 'bg-warning-subtle border-warning text-warning-emphasis' };
      }
      if (dados[r][c]) return { t: String(x), c: 'bg-body border-success text-success-emphasis' };
      return revelar
        ? { t: String(x), c: 'bg-success-subtle border-success-subtle text-success-emphasis' }
        : { t: '', c: 'bg-body-tertiary border-secondary-subtle' };
    })
  );
}

// ---------------------- RESOLVER COMO UNA PERSONA ----------------------
// Reglas: 1) línea completa → da el número mágico; 2) línea con 1 vacío → número mágico
// menos los demás; 3) (solo orden 3) número mágico = 3 × centro, y centro = número mágico ÷ 3.
// Devuelve los pasos necesarios para llegar a la meta, o null si no se puede.
function resolver(v: number[][], dados: boolean[][], sDada: boolean, meta: Meta): string[] | null {
  const n = v.length, S = suma(v[0]);
  const sabe: (number | null)[][] = v.map((f, r) => f.map((x, c) => (dados[r][c] ? x : null)));
  let s: number | null = sDada ? S : null;
  const razon = new Map<string, { paso: string; deps: string[] }>();
  const k = (r: number, c: number) => `${r},${c}`;
  const ls = lineas(n);
  const centro = (n - 1) / 2;

  let cambio = true;
  while (cambio) {
    cambio = false;
    if (s === null) {
      for (const l of ls) { // número mágico a partir de una línea completa
        const vals = l.celdas.map(([r, c]) => sabe[r][c]);
        if (vals.every((x) => x !== null)) {
          s = suma(vals as number[]);
          razon.set('S', { paso: `${l.nombre}: ${vals.join(' + ')} = ${s}`, deps: l.celdas.map(([r, c]) => k(r, c)) });
          cambio = true;
          break;
        }
      }
      if (s === null && n === 3 && sabe[1][1] !== null) { // 3 × centro
        s = 3 * (sabe[1][1] as number);
        razon.set('S', { paso: `Número mágico = 3 × centro = 3 × ${sabe[1][1]} = ${s}`, deps: [k(1, 1)] });
        cambio = true;
      }
    }
    if (s !== null) {
      for (const l of ls) { // un solo vacío en la línea
        const vacios = l.celdas.filter(([r, c]) => sabe[r][c] === null);
        if (vacios.length !== 1) continue;
        const conocidos = l.celdas.filter(([r, c]) => sabe[r][c] !== null);
        const vals = conocidos.map(([r, c]) => sabe[r][c] as number);
        const [r, c] = vacios[0];
        sabe[r][c] = s - suma(vals);
        razon.set(k(r, c), {
          paso: `${l.nombre}: ${s} − (${vals.join(' + ')}) = ${sabe[r][c]}`,
          deps: ['S', ...conocidos.map(([a, b]) => k(a, b))]
        });
        cambio = true;
      }
      if (n === 3 && sabe[centro][centro] === null) { // centro = número mágico ÷ 3
        sabe[1][1] = s / 3;
        razon.set(k(1, 1), { paso: `Centro = ${s} ÷ 3 = ${s / 3}`, deps: ['S'] });
        cambio = true;
      }
    }
  }

  const clave = meta === 'S' ? 'S' : k(meta[0], meta[1]);
  if (meta === 'S' ? s === null : sabe[meta[0]][meta[1]] === null) return null;

  // Solo los pasos que hacen falta, en orden
  const pasos: string[] = [];
  const visto = new Set<string>();
  const visitar = (c: string) => {
    if (visto.has(c)) return;
    visto.add(c);
    const rz = razon.get(c);
    if (!rz) return;
    rz.deps.forEach(visitar);
    pasos.push(rz.paso);
  };
  visitar(clave);
  return pasos;
}

// ---------------------- RECETAS POR NIVEL ----------------------

interface Receta {
  n: 3 | 4;
  vacios: [number, number]; // cuántos casilleros vacíos
  objetivo: 'celda' | 'suma'; // se pregunta un casillero o el número mágico
  sDada: boolean; // ¿se dice cuál es el número mágico?
  minPasos: number; // pasos mínimos para que no sea trivial
  c?: [number, number]; // rango del centro (orden 3)
}

const RECETAS: Record<number, Receta[]> = {
  1: [
    { n: 3, vacios: [1, 1], objetivo: 'celda', sDada: true, minPasos: 1, c: [5, 12] },
    { n: 3, vacios: [1, 1], objetivo: 'celda', sDada: false, minPasos: 2, c: [5, 12] },
    { n: 3, vacios: [0, 1], objetivo: 'suma', sDada: false, minPasos: 1, c: [5, 12] },
  ],
  2: [
    { n: 3, vacios: [2, 3], objetivo: 'celda', sDada: true, minPasos: 2, c: [8, 25] },
    { n: 3, vacios: [2, 3], objetivo: 'celda', sDada: false, minPasos: 3, c: [8, 25] },
    { n: 3, vacios: [2, 3], objetivo: 'suma', sDada: false, minPasos: 1, c: [8, 25] },
  ],
  3: [
    { n: 3, vacios: [4, 5], objetivo: 'celda', sDada: false, minPasos: 3, c: [10, 40] },
    { n: 3, vacios: [4, 5], objetivo: 'suma', sDada: false, minPasos: 1, c: [10, 40] },
    { n: 4, vacios: [2, 4], objetivo: 'celda', sDada: true, minPasos: 2 },
    { n: 4, vacios: [2, 4], objetivo: 'suma', sDada: false, minPasos: 1 },
  ],
};

function crearCuadrado(rc: Receta): Cuadrado | null {
  const v = rc.n === 3 ? cuadrado3(rc.c!) : cuadrado4();
  const S = suma(v[0]);
  const todas: [number, number][] = [];
  v.forEach((f, r) => f.forEach((_, c) => todas.push([r, c])));

  for (let intento = 0; intento < 80; intento++) {
    const k = azar(rc.vacios[0], rc.vacios[1]);
    const vacias = mezclar(todas).slice(0, k);
    const dados = v.map((f) => f.map(() => true));
    vacias.forEach(([r, c]) => (dados[r][c] = false));

    let meta: Meta;
    if (rc.objetivo === 'celda') {
      if (k === 0) continue;
      meta = vacias[0];
    } else {
      meta = 'S';
    }
    const pasos = resolver(v, dados, rc.sDada, meta);
    if (!pasos || pasos.length < rc.minPasos) continue;

    const resp = meta === 'S' ? S : v[meta[0]][meta[1]];
    const vistos = [...new Set(todas.filter(([r, c]) => dados[r][c]).map(([r, c]) => v[r][c]))];
    return {
      oculto: celdasDe(v, dados, meta, false),
      completo: celdasDe(v, dados, meta, true),
      lineas: lineasPista(dados, meta),
      cabecera: rc.sDada ? `Número mágico = ${S}` : rc.objetivo === 'suma' ? 'Número mágico = ?' : 'El número mágico no se indica',
      pregunta: rc.objetivo === 'suma' ? '¿Cuál es el número mágico?' : '¿Qué número va en el casillero marcado (?)',
      opciones: opcionesCerca(resp, [resp + 1, resp - 1, resp + 2, resp - 2, ...vistos.slice(0, 3)]),
      correcta: resp,
      texto: 'En un cuadrado mágico, todas las filas, columnas y diagonales suman lo mismo: ese es el número mágico.'
        + (rc.n === 3 ? ' En los de orden 3, además, el número mágico es 3 veces el número del centro.' : ''),
      pasos,
    };
  }
  return null;
}

// Crea los 25 ejercicios de un nivel: reparte las recetas por turnos (para combinar
// actividades), sin repetir, y los mezcla en orden al azar
function crearNivel(nivel: number): Cuadrado[] {
  const recetas = RECETAS[nivel];
  const vistos = new Set<string>();
  const lista: Cuadrado[] = [];
  for (let i = 0; i < 800 && lista.length < CANTIDAD; i++) {
    const q = crearCuadrado(recetas[lista.length % recetas.length]);
    if (!q) continue;
    const clave = JSON.stringify(q.oculto) + q.pregunta + q.cabecera;
    if (vistos.has(clave)) continue;
    vistos.add(clave);
    lista.push(q);
  }
  return mezclar(lista);
}

// Ejemplo de la pantalla de inicio (el de la lección: suma 15)
const EJEMPLO_V = [[4, 9, 2], [3, 5, 7], [8, 1, 6]];
const EJEMPLO = celdasDe(EJEMPLO_V, EJEMPLO_V.map((f) => f.map(() => true)), null, false);

// ====================== CUADRÍCULA GRÁFICA (Bootstrap) ======================
// Las líneas-pista se trazan encima de la cuadrícula con un SVG; para que pasen por el
// centro de las casillas, el separación (HUECO) tiene que ser la misma que la del CSS
// (.cm-grilla y .cm-fila usan gap: 4px).
const HUECO = 4;

@Component({
  selector: 'app-cuadricula-grafica',
  standalone: true,
  styleUrl: './cuadrados-magicos.css',
  template: `
    <div class="d-flex justify-content-center py-2">
      <div class="cm-grilla">
        <svg class="cm-lineas" [attr.width]="ancho()" [attr.height]="alto()"
             [attr.role]="pista() ? 'img' : null" [attr.aria-label]="pista()"
             [attr.aria-hidden]="pista() ? null : 'true'">
          @for (t of trazos(); track $index) {
            <line class="cm-linea" [attr.x1]="t.x1" [attr.y1]="t.y1" [attr.x2]="t.x2" [attr.y2]="t.y2" />
          }
        </svg>
        @for (fila of celdas(); track $index) {
          <div class="cm-fila">
            @for (c of fila; track $index) {
              <div class="cm-celda border border-2 rounded-2 d-flex align-items-center justify-content-center fw-bold fs-4 {{ c.c }}"
                   [style.width.px]="lado()" [style.height.px]="altoCelda()">{{ c.t }}</div>
            }
          </div>
        }
      </div>
    </div>
  `
})
export class CuadriculaGrafica {
  celdas = input.required<Celda[][]>();
  /** Filas, columnas o diagonales marcadas como pista (cada línea: sus casillas). */
  lineas = input<[number, number][][]>([]);

  lado = computed(() => (this.celdas().length === 3 ? 66 : 56)); // orden 3 o 4
  altoCelda = computed(() => this.lado() - 6);
  ancho = computed(() => this.medida(this.lado()));
  alto = computed(() => this.medida(this.altoCelda()));

  /** Coordenadas en píxeles de cada trazo: del centro de la primera casilla al de la última. */
  readonly trazos = computed(() => {
    const cx = (c: number) => c * (this.lado() + HUECO) + this.lado() / 2;
    const cy = (r: number) => r * (this.altoCelda() + HUECO) + this.altoCelda() / 2;
    return this.lineas().map((celdas) => {
      const [r1, c1] = celdas[0];
      const [r2, c2] = celdas[celdas.length - 1];
      return { x1: cx(c1), y1: cy(r1), x2: cx(c2), y2: cy(r2) };
    });
  });

  /** Descripción de las líneas marcadas para los lectores de pantalla. */
  readonly pista = computed(() => {
    const nombres = this.lineas().map((celdas) => {
      const r = celdas[0][0];
      const c = celdas[0][1];
      if (celdas.every(([f]) => f === r)) return `fila ${r + 1}`;
      if (celdas.every(([, col]) => col === c)) return `columna ${c + 1}`;
      return 'diagonal';
    });
    return nombres.length ? `Pista: sumar la ${nombres.join(' y la ')}` : null;
  });

  /** Tamaño de la cuadrícula: `n` casillas de `casilla` píxeles con huecos de HUECO. */
  private medida(casilla: number): number {
    const n = this.celdas().length;
    return n * casilla + (n - 1) * HUECO;
  }
}

// ====================== COMPONENTE ======================

@Component({
  selector: 'app-cuadrados-magicos',
  standalone: true,
  imports: [CuadriculaGrafica],
  template: `
    <div class="container py-4" style="max-width: 760px">
      <!-- Cabecera -->
      <div class="d-flex align-items-center gap-3 mb-3">
        <button class="btn btn-outline-secondary btn-sm" (click)="volver()">
          <i class="bi bi-arrow-left"></i> Volver
        </button>
        <div>
          <h2 class="h4 mb-0"><i class="bi bi-grid-3x3 text-warning me-2"></i>Cuadrados Mágicos</h2>
          <small class="text-muted">Completa cuadrados donde todas las líneas suman lo mismo.</small>
        </div>
      </div>

      <!-- 1) INICIO: explicación + elegir nivel -->
      @if (estado() === 'intro') {
        <div class="card shadow-sm mb-4">
          <div class="card-body">
           <app-cuadricula-grafica [celdas]="ejemplo" />
          </div>
        </div>

        <p class="mb-3">
          <i class="bi bi-signpost-split text-warning me-1"></i><strong>Pista:</strong>
          durante el juego aparecerá una línea amarilla sobre las casillas que hay que sumar.
        </p>
        <p>Elige un nivel. Cada uno tiene {{ cantidad }} ejercicios al azar.</p>
        <div class="row g-3">
          @for (n of niveles; track n.n) {
            <div class="col-12 col-md-4">
              <div class="card h-100 shadow-sm border-{{ n.color }}" role="button" tabindex="0"
                   style="cursor: pointer" (click)="empezar(n.n)" (keydown.enter)="empezar(n.n)">
                <div class="card-body">
                  <span class="badge text-bg-{{ n.color }} mb-2">Nivel {{ n.n }}</span>
                  <h5 class="card-title">{{ n.nombre }}</h5>
                  <p class="text-muted small mb-0">{{ n.detalle }}</p>
                </div>
              </div>
            </div>
          }
        </div>

      <!-- 3) RESULTADOS -->
      } @else if (estado() === 'resultado') {
        <div class="card shadow-sm text-center mb-3">
          <div class="card-body">
            <span class="badge text-bg-{{ colorNivel() }} mb-2">{{ nombreNivel() }}</span>
            <div class="fs-1 mb-1">
              @for (s of [1, 2, 3]; track s) {
                <i class="bi text-warning" [class.bi-star-fill]="s <= estrellas()" [class.bi-star]="s > estrellas()"></i>
              }
            </div>
            <h3>{{ aciertos() }} de {{ lista().length }} correctas</h3>
            <p class="fs-5 mb-1">{{ porcentaje() }}% · {{ puntaje() }} puntos</p>
            <p class="text-muted">{{ mensaje() }}</p>
            <div class="d-flex gap-2 justify-content-center">
              <button class="btn btn-primary" (click)="empezar(nivel()!)">Repetir nivel</button>
              <button class="btn btn-outline-secondary" (click)="estado.set('intro')">Elegir otro nivel</button>
            </div>
          </div>
        </div>

        @if (fallos().length) {
          <h4 class="h5">Repasa lo que fallaste</h4>
          @for (f of fallos(); track $index) {
            <div class="card mb-2">
              <div class="card-body py-2">
                <p class="mb-0 text-center fw-semibold">{{ f.q.cabecera }}</p>
                <app-cuadricula-grafica [celdas]="f.q.completo" [lineas]="f.q.lineas" />
                <p class="mb-1 text-center">
                  <span class="text-danger">Tu respuesta: {{ f.elegida }}</span> ·
                  <span class="text-success">Correcta: {{ f.q.correcta }}</span>
                </p>
                <p class="small text-muted mb-0 text-center">{{ f.q.pasos.join('  →  ') }}</p>
              </div>
            </div>
          }
        }

      <!-- 2) JUGAR -->
      } @else {
        @if (actual(); as e) {
          <div class="d-flex justify-content-between align-items-center mb-2">
            <span class="badge text-bg-{{ colorNivel() }}">{{ nombreNivel() }}</span>
            <small>Ejercicio {{ indice() + 1 }} de {{ lista().length }}</small>
            <span class="badge text-bg-success"><i class="bi bi-check-lg"></i> {{ aciertos() }}</span>
          </div>
          <div class="progress mb-3" style="height: 8px">
            <div class="progress-bar bg-warning" [style.width.%]="avance()"></div>
          </div>

          <div class="card shadow-sm">
            <div class="card-body">
              <p class="fs-5 mb-2">{{ e.pregunta }}</p>
              <div class="text-center mb-1">
                <span class="badge text-bg-primary fs-6">{{ e.cabecera }}</span>
              </div>

              <!-- Cuadrado: con vacíos mientras juegas, completo al responder;
                   las líneas amarillas señalan qué casillas hay que sumar -->
              <app-cuadricula-grafica [celdas]="elegida() === null ? e.oculto : e.completo" [lineas]="e.lineas" />

              <!-- Opciones -->
              <div class="row g-2 mt-2">
                @for (op of e.opciones; track op) {
                  <div class="col-6">
                    <button class="btn btn-lg w-100" [class]="claseBoton(op, e)"
                            [disabled]="elegida() !== null" (click)="elegir(op, e)">{{ op }}</button>
                  </div>
                }
              </div>

              <!-- Retroalimentación -->
              @if (elegida() !== null) {
                <div class="alert mt-3 mb-2" [class.alert-success]="elegida() === e.correcta"
                     [class.alert-danger]="elegida() !== e.correcta">
                  @if (elegida() === e.correcta) { <strong>¡Correcto!</strong> }
                  @else { <strong>La respuesta correcta es {{ e.correcta }}.</strong> }
                  {{ e.texto }}
                  <ol class="mb-0 mt-2">
                    @for (p of e.pasos; track $index) { <li>{{ p }}</li> }
                  </ol>
                </div>
                <button class="btn btn-primary" (click)="siguiente()">
                  {{ esUltimo() ? 'Ver resultados' : 'Siguiente' }} <i class="bi bi-arrow-right"></i>
                </button>
              }
            </div>
          </div>
          <button class="btn btn-link text-muted px-0 mt-2" (click)="estado.set('intro')">Salir del nivel</button>
        }
      }
    </div>
  `
})
export class CuadradosMagicos implements OnInit, OnDestroy {
  private readonly router = inject(Router);
  private readonly gameUi = inject(GameUiService);
  private readonly attempts = inject(AttemptsService);

  private intentoId: string | null = null;
  private intentoInicio = 0;

  readonly cantidad = CANTIDAD;
  readonly ejemplo = EJEMPLO;
  readonly niveles = [
    { n: 1, nombre: 'Básico', color: 'success',
      detalle: 'Cuadrados de orden 3 con un casillero vacío (o completos). Se pide el casillero o el número mágico.' },
    { n: 2, nombre: 'Intermedio', color: 'warning',
      detalle: 'Cuadrados de orden 3 con 2 o 3 vacíos. El número mágico puede estar dado o hay que descubrirlo.' },
    { n: 3, nombre: 'Avanzado', color: 'danger',
      detalle: 'Orden 3 con muchos vacíos (usa que el número mágico es 3 × el centro) y cuadrados de orden 4.' },
  ];

  readonly estado = signal<'intro' | 'jugando' | 'resultado'>('intro');
  readonly nivel = signal<number | null>(null);
  readonly lista = signal<Cuadrado[]>([]);
  readonly indice = signal(0);
  readonly elegida = signal<number | null>(null);
  readonly aciertos = signal(0);
  readonly fallos = signal<{ q: Cuadrado; elegida: number }[]>([]);

  readonly actual = computed(() => this.lista()[this.indice()]);
  readonly esUltimo = computed(() => this.indice() + 1 >= this.lista().length);
  readonly avance = computed(
    () => ((this.indice() + (this.elegida() !== null ? 1 : 0)) / Math.max(1, this.lista().length)) * 100
  );
  readonly porcentaje = computed(() => Math.round((this.aciertos() / Math.max(1, this.lista().length)) * 100));
  readonly puntaje = computed(() => this.aciertos() * (PUNTOS[this.nivel() ?? 1] ?? 10));
  readonly estrellas = computed(() => (this.porcentaje() >= 80 ? 3 : this.porcentaje() >= 50 ? 2 : 1));
  readonly nombreNivel = computed(() => this.niveles.find((n) => n.n === this.nivel())?.nombre ?? '');
  readonly colorNivel = computed(() => this.niveles.find((n) => n.n === this.nivel())?.color ?? 'secondary');
  readonly mensaje = computed(() => {
    const p = this.porcentaje();
    if (p >= 90) return '¡Excelente! Dominas los cuadrados mágicos.';
    if (p >= 70) return '¡Muy bien!';
    if (p >= 50) return 'Vas bien, sigue practicando.';
    return 'Repasa los errores y vuelve a intentarlo.';
  });

  ngOnInit(): void {
    this.gameUi.setJugando(true);
  }

  ngOnDestroy(): void {
    this.gameUi.setJugando(false);
  }

  volver(): void {
    this.gameUi.setJugando(false);
    void this.router.navigateByUrl('/razonamiento-logico');
  }

  async empezar(nivel: number): Promise<void> {
    this.nivel.set(nivel);
    this.lista.set(crearNivel(nivel)); // 25 ejercicios nuevos al azar
    this.indice.set(0);
    this.elegida.set(null);
    this.aciertos.set(0);
    this.fallos.set([]);
    this.estado.set('jugando');
    const sesion = await this.attempts.iniciar('cuadrados-magicos');
    this.intentoId = sesion?.id ?? null;
    this.intentoInicio = sesion?.inicio ?? Date.now();
  }

  elegir(op: number, q: Cuadrado): void {
    this.elegida.set(op);
    if (op === q.correcta) this.aciertos.update((x) => x + 1);
    else this.fallos.update((f) => [...f, { q, elegida: op }]);
  }

  async siguiente(): Promise<void> {
    if (this.esUltimo()) {
      await this.terminar();
      return;
    }
    this.indice.update((i) => i + 1);
    this.elegida.set(null);
  }

  private async terminar(): Promise<void> {
    this.estado.set('resultado');
    if (!this.intentoId) return;
    try {
      await this.attempts.finalizar(this.intentoId, this.intentoInicio, {
        actividadId: 'cuadrados-magicos',
        puntaje: this.puntaje(),
        nivel: this.nivel() ?? 1,
        respuestasCorrectas: this.aciertos(),
        respuestasIncorrectas: this.lista().length - this.aciertos()
      });
    } catch (e) {
      console.error('No se pudo guardar el intento:', e);
    }
    this.intentoId = null;
  }

  // Color del botón según la respuesta
  claseBoton(op: number, q: Cuadrado): string {
    if (this.elegida() === null) return 'btn-outline-dark';
    if (op === q.correcta) return 'btn-success';
    if (op === this.elegida()) return 'btn-danger';
    return 'btn-outline-secondary';
  }
}