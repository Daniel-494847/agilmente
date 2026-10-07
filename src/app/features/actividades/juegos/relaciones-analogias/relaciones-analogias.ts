import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import katex from 'katex';

import { AttemptsService } from '../../../../core/services/attempts.service';
import { GameUiService } from '../../../../core/services/game-ui.service';

// ====================== GENERADOR DE ANALOGÍAS NUMÉRICAS ======================
// Una analogía numérica es un arreglo de filas (o columnas) con 3 números:
//     8  (12)  4      → el del centro sale de operar los extremos
//     6  (10)  4
//     9  ( ? )  3     → se aplica la misma regla a la última fila
// Cada nivel crea 25 ejercicios al azar, sin repetir y con retroalimentación.

const CANTIDAD = 25; // ejercicios por nivel
const PUNTOS: Record<number, number> = { 1: 10, 2: 15, 3: 20 };

type Pos = 'centro' | 'izquierda' | 'derecha'; // dónde está la incógnita
type Fila = [number, number, number]; // [izquierdo, derecho, centro]

interface Regla {
  id: string;
  texto: string; // la regla en palabras
  f: (a: number, b: number) => number | null; // null = no se puede (no natural)
  tex: (a: string | number, b: string | number) => string; // operación en LaTeX
  rango?: [number, number]; // de dónde salen los extremos
  par?: () => [number, number]; // generador propio de pares
}

interface Analogia {
  tex: string; // el arreglo completo en LaTeX
  layout: 'filas' | 'columnas';
  opciones: number[];
  correcta: number;
  texto: string; // explicación con palabras
  pasos: string[]; // pasos en LaTeX
}

// Utilidades
const azar = (a: number, b: number) => Math.floor(Math.random() * (b - a + 1)) + a;
const mezclar = <T>(l: T[]) => [...l].sort(() => Math.random() - 0.5);
const natural = (n: number) => (Number.isInteger(n) && n > 0 ? n : null);

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

// ---------------------- REGLAS ----------------------

// Básicas: suma, resta, multiplicación y división de los extremos
const BASICAS: Regla[] = [
  { id: 'suma', texto: 'sumar los extremos', f: (a, b) => a + b,
    tex: (a, b) => String.raw`${a} + ${b}`, rango: [2, 30] },
  { id: 'resta', texto: 'restar los extremos (izquierdo − derecho)', f: (a, b) => natural(a - b),
    tex: (a, b) => String.raw`${a} - ${b}`, rango: [2, 40] },
  { id: 'mult', texto: 'multiplicar los extremos', f: (a, b) => a * b,
    tex: (a, b) => String.raw`${a} \times ${b}`, rango: [2, 9] },
  { id: 'div', texto: 'dividir el extremo izquierdo entre el derecho', f: (a, b) => natural(a / b),
    tex: (a, b) => String.raw`${a} \div ${b}`,
    par: () => { const b = azar(2, 9), q = azar(2, 9); return [b * q, b]; } },
];

// Intermedias: reglas con dos pasos
const INTERMEDIAS: Regla[] = [
  { id: 'a+2b', texto: 'sumar el extremo izquierdo con el doble del derecho', f: (a, b) => a + 2 * b,
    tex: (a, b) => String.raw`${a} + 2\cdot ${b}`, rango: [2, 15] },
  { id: '2a+b', texto: 'sumar el doble del extremo izquierdo con el derecho', f: (a, b) => 2 * a + b,
    tex: (a, b) => String.raw`2\cdot ${a} + ${b}`, rango: [2, 15] },
  { id: 'ab+1', texto: 'multiplicar los extremos y sumar 1', f: (a, b) => a * b + 1,
    tex: (a, b) => String.raw`${a}\cdot ${b} + 1`, rango: [2, 9] },
  { id: 'ab-1', texto: 'multiplicar los extremos y restar 1', f: (a, b) => a * b - 1,
    tex: (a, b) => String.raw`${a}\cdot ${b} - 1`, rango: [2, 9] },
  { id: 'ab+a', texto: 'multiplicar los extremos y sumar el extremo izquierdo', f: (a, b) => a * b + a,
    tex: (a, b) => String.raw`${a}\cdot ${b} + ${a}`, rango: [2, 9] },
  { id: 'ab-b', texto: 'multiplicar los extremos y restar el extremo derecho', f: (a, b) => natural(a * b - b),
    tex: (a, b) => String.raw`${a}\cdot ${b} - ${b}`, rango: [2, 9] },
];

// Avanzadas: cuadrados, dobles, triples y promedios
const AVANZADAS: Regla[] = [
  { id: '2(a+b)', texto: 'sumar los extremos y duplicar el resultado', f: (a, b) => 2 * (a + b),
    tex: (a, b) => String.raw`2\,(${a} + ${b})`, rango: [2, 15] },
  { id: '3(a-b)', texto: 'restar los extremos y triplicar el resultado', f: (a, b) => natural(3 * (a - b)),
    tex: (a, b) => String.raw`3\,(${a} - ${b})`, rango: [2, 20] },
  { id: 'a2+b', texto: 'elevar al cuadrado el extremo izquierdo y sumarle el derecho', f: (a, b) => a * a + b,
    tex: (a, b) => String.raw`${a}^{2} + ${b}`, rango: [2, 9] },
  { id: 'a2-b', texto: 'elevar al cuadrado el extremo izquierdo y restarle el derecho', f: (a, b) => natural(a * a - b),
    tex: (a, b) => String.raw`${a}^{2} - ${b}`, rango: [2, 9] },
  { id: 'a2-b2', texto: 'restar los cuadrados de los extremos', f: (a, b) => natural(a * a - b * b),
    tex: (a, b) => String.raw`${a}^{2} - ${b}^{2}`, rango: [2, 12] },
  { id: 'ab+a+b', texto: 'multiplicar los extremos y sumarles los dos extremos', f: (a, b) => a * b + a + b,
    tex: (a, b) => String.raw`${a}\cdot ${b} + ${a} + ${b}`, rango: [2, 9] },
  { id: 'prom', texto: 'sacar el promedio de los extremos (suma ÷ 2)', f: (a, b) => natural((a + b) / 2),
    tex: (a, b) => String.raw`\dfrac{${a} + ${b}}{2}`,
    par: () => { const m = azar(3, 15), d = azar(1, m - 1); return [m + d, m - d]; } },
];

// Qué reglas se usan en cada nivel, dónde puede estar la incógnita y cuántos ejemplos hay
const NIVELES: Record<number, { reglas: Regla[]; pool: Regla[]; pos: Pos[]; ejemplos: () => number }> = {
  1: { reglas: BASICAS, pool: BASICAS, pos: ['centro'], ejemplos: () => 2 },
  2: {
    reglas: [...BASICAS, ...INTERMEDIAS], pool: [...BASICAS, ...INTERMEDIAS],
    pos: ['centro', 'izquierda', 'derecha'], ejemplos: () => azar(2, 3)
  },
  3: {
    reglas: [...INTERMEDIAS, ...AVANZADAS], pool: [...BASICAS, ...INTERMEDIAS, ...AVANZADAS],
    pos: ['centro', 'izquierda', 'derecha', 'izquierda', 'derecha'], ejemplos: () => 3
  },
};

// ---------------------- LaTeX ----------------------

const INCOGNITA = String.raw`\textcolor{#dc3545}{\boxed{\,?\,}}`;

// Dibuja el arreglo: por filas (8 (12) 4) o por columnas (extremos arriba y abajo)
function matrizTex(filas: Fila[], pos: Pos, layout: 'filas' | 'columnas'): string {
  const ult = filas.length - 1;
  const sp = (s: string) => String.raw`\quad ${s}\quad`;
  const items = filas.map(([a, b, c], i) => ({
    a: sp(i === ult && pos === 'izquierda' ? INCOGNITA : String(a)),
    c: sp(String.raw`(\,${i === ult && pos === 'centro' ? INCOGNITA : c}\,)`),
    b: sp(i === ult && pos === 'derecha' ? INCOGNITA : String(b)),
  }));
  if (layout === 'filas') {
    const cuerpo = items.map((x) => `${x.a} & ${x.c} & ${x.b}`).join(String.raw` \\[6pt] `);
    return String.raw`\begin{array}{ccc} ${cuerpo} \end{array}`;
  }
  const lin = (k: 'a' | 'c' | 'b') => items.map((x) => x[k]).join(' & ');
  const cols = 'c'.repeat(items.length);
  return String.raw`\begin{array}{${cols}} ${lin('a')} \\[8pt] ${lin('c')} \\[8pt] ${lin('b')} \end{array}`;
}

// ---------------------- CREAR UNA ANALOGÍA ----------------------

function crearAnalogia(r: Regla, pos: Pos, ejemplos: number, pool: Regla[]): Analogia | null {
  // 1) filas de ejemplo + la última fila (con la incógnita)
  const filas: Fila[] = [];
  const usados = new Set<string>();
  while (filas.length < ejemplos + 1) {
    let fila: Fila | null = null;
    for (let k = 0; k < 40 && !fila; k++) {
      const [a, b] = r.par ? r.par() : [azar(r.rango![0], r.rango![1]), azar(r.rango![0], r.rango![1])];
      const c = r.f(a, b);
      if (c === null || c > 300 || a === b || usados.has(`${a},${b}`)) continue;
      fila = [a, b, c];
    }
    if (!fila) return null;
    usados.add(`${fila[0]},${fila[1]}`);
    filas.push(fila);
  }
  const ej = filas.slice(0, ejemplos);
  const [a, b, c] = filas[ejemplos];
  const resp = pos === 'centro' ? c : pos === 'izquierda' ? a : b;

  // 2) si falta un extremo, la solución debe ser única
  const conExtremo = (x: number) => (pos === 'izquierda' ? r.f(x, b) : r.f(a, x));
  if (pos !== 'centro') {
    let n = 0;
    for (let x = 1; x <= 300; x++) if (conExtremo(x) === c) n++;
    if (n !== 1) return null;
  }

  // 3) ninguna otra regla puede explicar los ejemplos y dar otra respuesta
  for (const o of pool) {
    if (o.id === r.id) continue;
    if (!ej.every(([x, y, z]) => o.f(x, y) === z)) continue;
    if (pos === 'centro') {
      const v = o.f(a, b);
      if (v !== null && v !== c) return null;
    } else {
      for (let x = 1; x <= 300; x++) {
        const v = pos === 'izquierda' ? o.f(x, b) : o.f(a, x);
        if (v === c && x !== resp) return null;
      }
    }
  }

  // 4) respuestas falsas: errores típicos
  const k = pos === 'izquierda' ? b : a;
  const extras = pos === 'centro'
    ? pool.map((o) => o.f(a, b)).filter((v): v is number => v !== null && v !== c)
    : [c + k, c - k, c * k, c / k, resp + 1, resp - 1];

  // 5) LaTeX y retroalimentación
  const layout: 'filas' | 'columnas' = Math.random() < 0.5 ? 'filas' : 'columnas';
  const u = layout === 'filas' ? 'fila' : 'columna';
  const [a1, b1, c1] = filas[0];
  const pasos = [String.raw`${r.tex(a1, b1)} = ${c1}`];
  if (pos === 'centro') {
    pasos.push(String.raw`${r.tex(a, b)} = \boxed{${c}}`);
  } else {
    pasos.push(String.raw`${r.tex(pos === 'izquierda' ? '?' : a, pos === 'derecha' ? '?' : b)} = ${c}`);
    pasos.push(String.raw`${r.tex(a, b)} = ${c} \;\Rightarrow\; ? = \boxed{${resp}}`);
  }
  const texto = `En cada ${u} de ejemplo, el número del centro sale de ${r.texto}. ` + (pos === 'centro'
    ? `Aplicamos la misma regla a la última ${u}.`
    : `En la última ${u} falta un extremo, así que hacemos la operación al revés.`);

  return {
    tex: matrizTex(filas, pos, layout), layout,
    opciones: opcionesCerca(resp, extras), correcta: resp, texto, pasos
  };
}

// Crea las 25 analogías de un nivel: reparte las reglas por turnos (para combinar
// operaciones), sin repetir, y las mezcla en orden al azar
function crearNivel(nivel: number): Analogia[] {
  const cfg = NIVELES[nivel];
  const vistos = new Set<string>();
  const lista: Analogia[] = [];
  const reglas = mezclar(cfg.reglas);
  for (let i = 0; i < 800 && lista.length < CANTIDAD; i++) {
    const r = reglas[lista.length % reglas.length];
    const pos = cfg.pos[azar(0, cfg.pos.length - 1)];
    const a = crearAnalogia(r, pos, cfg.ejemplos(), cfg.pool);
    if (!a || vistos.has(a.tex)) continue;
    vistos.add(a.tex);
    lista.push(a);
  }
  return mezclar(lista);
}

// Ejemplo que se muestra en la pantalla de inicio
const EJEMPLO = String.raw`\begin{array}{ccc} \quad 3\quad & \quad (\,7\,)\quad & \quad 4\quad \\[6pt] \quad 5\quad & \quad (\,9\,)\quad & \quad 4\quad \\[6pt] \quad 6\quad & \quad (\,${INCOGNITA}\,)\quad & \quad 2\quad \end{array}`;

// ====================== COMPONENTE ======================

@Component({
  selector: 'app-relaciones-analogias',
  standalone: true,
  template: `
    <div class="container py-4" style="max-width: 760px">
      <!-- Cabecera -->
      <div class="d-flex align-items-center gap-3 mb-3">
        <button class="btn btn-outline-secondary btn-sm" (click)="volver()">
          <i class="bi bi-arrow-left"></i> Volver
        </button>
        <div>
          <h2 class="h4 mb-0"><i class="bi bi-diagram-3 text-warning me-2"></i>Relaciones y Analogías</h2>
          <small class="text-muted">Analogías numéricas: descubre la regla y halla el número oculto.</small>
        </div>
      </div>

      <!-- 1) INICIO: explicación + elegir nivel -->
      @if (estado() === 'intro') {
        <div class="card shadow-sm mb-4">
          <div class="card-body">
            <h5 class="card-title">¿Cómo se resuelve?</h5>
            <p class="mb-2">
              Los números están en filas (o columnas). El número del <strong>centro</strong>, entre paréntesis,
              sale de operar los números de los <strong>extremos</strong>. Descubre la regla en las primeras filas
              y aplícala a la última.
            </p>
            <div class="bg-body-tertiary rounded-3 p-3 text-center fs-3 overflow-auto" [innerHTML]="tex(ejemplo)"></div>
            <p class="text-muted small mt-2 mb-0">
              Aquí: 3 + 4 = 7 y 5 + 4 = 9, así que la regla es sumar los extremos: 6 + 2 = 8.
            </p>
          </div>
        </div>

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
                <div class="text-center fs-4 overflow-auto" [innerHTML]="tex(f.a.tex)"></div>
                <p class="mb-1">
                  <span class="text-danger">Tu respuesta: {{ f.elegida }}</span> ·
                  <span class="text-success">Correcta: {{ f.a.correcta }}</span>
                </p>
                <p class="small text-muted mb-1">{{ f.a.texto }}</p>
                @for (p of f.a.pasos; track $index) {
                  <div class="text-center" [innerHTML]="tex(p)"></div>
                }
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
              <p class="text-muted small mb-2">
                En cada {{ e.layout === 'filas' ? 'fila' : 'columna' }}, el número entre paréntesis sale de operar
                los dos números de los extremos. Halla el valor oculto.
              </p>

              <!-- Arreglo en LaTeX -->
              <div class="bg-body-tertiary rounded-3 p-3 text-center fs-3 mb-3 overflow-auto" [innerHTML]="tex(e.tex)"></div>

              <!-- Opciones -->
              <div class="row g-2">
                @for (op of e.opciones; track op) {
                  <div class="col-6">
                    <button class="btn btn-lg w-100" [class]="claseBoton(op, e)"
                            [disabled]="elegida() !== null" (click)="elegir(op, e)">
                      <span [innerHTML]="tex('' + op)"></span>
                    </button>
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
                  @for (p of e.pasos; track $index) {
                    <div class="text-center fs-5 mt-1" [innerHTML]="tex(p)"></div>
                  }
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
export class RelacionesAnalogias implements OnInit, OnDestroy {
  private readonly router = inject(Router);
  private readonly gameUi = inject(GameUiService);
  private readonly attempts = inject(AttemptsService);
  private readonly sanitizer = inject(DomSanitizer);

  private intentoId: string | null = null;
  private intentoInicio = 0;
  private readonly cache = new Map<string, SafeHtml>();

  readonly cantidad = CANTIDAD;
  readonly ejemplo = EJEMPLO;
  readonly niveles = [
    { n: 1, nombre: 'Básico', color: 'success',
      detalle: 'Suma, resta, multiplicación y división de los extremos. Se oculta el número del centro.' },
    { n: 2, nombre: 'Intermedio', color: 'warning',
      detalle: 'Reglas de dos pasos (2a + b, a·b + 1...). Puede faltar el centro o un extremo.' },
    { n: 3, nombre: 'Avanzado', color: 'danger',
      detalle: 'Cuadrados, dobles, triples y promedios. Casi siempre falta un extremo.' },
  ];

  readonly estado = signal<'intro' | 'jugando' | 'resultado'>('intro');
  readonly nivel = signal<number | null>(null);
  readonly lista = signal<Analogia[]>([]);
  readonly indice = signal(0);
  readonly elegida = signal<number | null>(null);
  readonly aciertos = signal(0);
  readonly fallos = signal<{ a: Analogia; elegida: number }[]>([]);

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
    if (p >= 90) return '¡Excelente! Dominas las analogías.';
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

  // Convierte LaTeX en HTML (KaTeX). Seguro: el LaTeX lo generamos nosotros.
  tex(s: string): SafeHtml {
    let h = this.cache.get(s);
    if (!h) {
      const html = katex.renderToString(s, { throwOnError: false });
      h = this.sanitizer.bypassSecurityTrustHtml(html);
      this.cache.set(s, h);
    }
    return h;
  }

  async empezar(nivel: number): Promise<void> {
    this.nivel.set(nivel);
    this.lista.set(crearNivel(nivel)); // 25 analogías nuevas al azar
    this.indice.set(0);
    this.elegida.set(null);
    this.aciertos.set(0);
    this.fallos.set([]);
    this.estado.set('jugando');
    const sesion = await this.attempts.iniciar('relaciones-analogias');
    this.intentoId = sesion?.id ?? null;
    this.intentoInicio = sesion?.inicio ?? Date.now();
  }

  elegir(op: number, a: Analogia): void {
    this.elegida.set(op);
    if (op === a.correcta) this.aciertos.update((x) => x + 1);
    else this.fallos.update((f) => [...f, { a, elegida: op }]);
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
        actividadId: 'relaciones-analogias',
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
  claseBoton(op: number, a: Analogia): string {
    if (this.elegida() === null) return 'btn-outline-dark';
    if (op === a.correcta) return 'btn-success';
    if (op === this.elegida()) return 'btn-danger';
    return 'btn-outline-secondary';
  }
}