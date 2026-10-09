import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import { AttemptsService } from '../../../../core/services/attempts.service';
import { GameUiService } from '../../../../core/services/game-ui.service';
import { PreguntaQuiz, QuizViewModel } from '../../../../shared/components/quiz/quiz.model';
import { Quiz } from '../../../../shared/components/quiz/quiz';

const CANTIDAD = 25;
const PUNTOS: Record<number, number> = { 1: 10, 2: 15, 3: 20 };

interface Celda {
  t: string;
  c: string;
}

interface Piramide {
  oculta: Celda[][];
  completa: Celda[][];
  pregunta: string;
  opciones: number[];
  correcta: number;
  pasos: string[];
  clave: string;
}

const azar = (a: number, b: number) => Math.floor(Math.random() * (b - a + 1)) + a;
const mezclar = <T>(l: T[]): T[] => [...l].sort(() => Math.random() - 0.5);

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

function celdasDe(valores: number[][], dados: boolean[][], meta: [number, number], revelar: boolean): Celda[][] {
  return valores.map((fila, r) =>
    fila.map((v, j) => {
      if (r === meta[0] && j === meta[1]) {
        return revelar
          ? { t: String(v), c: 'bg-success border-success text-white' }
          : { t: '?', c: 'bg-warning-subtle border-warning text-warning-emphasis' };
      }
      if (dados[r][j]) return { t: String(v), c: 'bg-body border-primary text-primary' };
      // Casillero por resolver: se marca con un guion bajo para que no se lea
      // como un hueco decorativo. Antes iba vacío y con un borde casi invisible,
      // así que el alumno no sabía qué casillas le tocaba calcular.
      return revelar
        ? { t: String(v), c: 'bg-success-subtle border-success-subtle text-success-emphasis' }
        : { t: '–', c: 'bg-secondary-subtle border-secondary text-secondary-emphasis piramide-vacia' };
    })
  );
}

function resolver(valores: number[][], dados: boolean[][], meta: [number, number]): string[] | null {
  const R = valores.length;
  const sabe: (number | null)[][] = valores.map((f, r) => f.map((v, j) => (dados[r][j] ? v : null)));
  const razon = new Map<string, { paso: string; deps: string[] }>();
  const k = (r: number, j: number) => `${r},${j}`;

  let cambio = true;
  while (cambio) {
    cambio = false;
    for (let r = 0; r < R - 1; r++) {
      for (let j = 0; j <= r; j++) {
        const t = sabe[r][j], l = sabe[r + 1][j], d = sabe[r + 1][j + 1];
        if (t !== null && l !== null && d === null) {
          sabe[r + 1][j + 1] = t - l;
          razon.set(k(r + 1, j + 1), { paso: `${t} − ${l} = ${t - l}`, deps: [k(r, j), k(r + 1, j)] });
          cambio = true;
        } else if (t !== null && d !== null && l === null) {
          sabe[r + 1][j] = t - d;
          razon.set(k(r + 1, j), { paso: `${t} − ${d} = ${t - d}`, deps: [k(r, j), k(r + 1, j + 1)] });
          cambio = true;
        } else if (t === null && l !== null && d !== null) {
          sabe[r][j] = l + d;
          razon.set(k(r, j), { paso: `${l} + ${d} = ${l + d}`, deps: [k(r + 1, j), k(r + 1, j + 1)] });
          cambio = true;
        }
      }
    }
  }
  if (sabe[meta[0]][meta[1]] === null) return null;

  const pasos: string[] = [];
  const visto = new Set<string>();
  const visitar = (clave: string) => {
    if (visto.has(clave)) return;
    visto.add(clave);
    const rz = razon.get(clave);
    if (!rz) return;
    rz.deps.forEach((dep) => visitar(dep));
    pasos.push(rz.paso);
  };
  visitar(`${meta[0]},${meta[1]}`);
  return pasos;
}

const CFG: Record<number, { filas: number; max: number; pistas: number; minPasos: number; cima: number }> = {
  1: { filas: 3, max: 9, pistas: 3, minPasos: 2, cima: 1 },
  2: { filas: 4, max: 12, pistas: 4, minPasos: 3, cima: 0.6 },
  3: { filas: 5, max: 12, pistas: 5, minPasos: 4, cima: 0.4 },
};

function crearPiramide(nivel: number): Piramide | null {
  const cfg = CFG[nivel];
  const R = cfg.filas;

  const valores: number[][] = [];
  valores[R - 1] = Array.from({ length: R }, () => azar(1, cfg.max));
  for (let r = R - 2; r >= 0; r--) {
    valores[r] = Array.from({ length: r + 1 }, (_, j) => valores[r + 1][j] + valores[r + 1][j + 1]);
  }

  const todas: [number, number][] = [];
  valores.forEach((f, r) => f.forEach((_, j) => todas.push([r, j])));
  const meta: [number, number] = Math.random() < cfg.cima ? [0, 0] : mezclar(todas.filter(([r]) => r > 0))[0];
  const candidatas = todas.filter(([r, j]) => !(r === meta[0] && j === meta[1]));

  for (let intento = 0; intento < 80; intento++) {
    const dados = valores.map((f) => f.map(() => false));
    mezclar(candidatas).slice(0, cfg.pistas).forEach(([r, j]) => (dados[r][j] = true));
    const pasos = resolver(valores, dados, meta);
    if (!pasos || pasos.length < cfg.minPasos) continue;

    const resp = valores[meta[0]][meta[1]];
    const vistos = [...new Set(todas.filter(([r, j]) => dados[r][j]).map(([r, j]) => valores[r][j]))];
    const oculta = celdasDe(valores, dados, meta, false);
    return {
      oculta,
      completa: celdasDe(valores, dados, meta, true),
      pregunta: meta[0] === 0 ? '¿Qué número va en la cima (?)' : '¿Qué número va en el casillero marcado (?)',
      opciones: opcionesCerca(resp, [resp + 1, resp - 1, resp + 2, ...vistos.slice(0, 3)]),
      correcta: resp,
      pasos,
      clave: JSON.stringify(oculta),
    };
  }
  return null;
}

function crearNivel(nivel: number): Piramide[] {
  const vistos = new Set<string>();
  const lista: Piramide[] = [];
  for (let i = 0; i < 800 && lista.length < CANTIDAD; i++) {
    const p = crearPiramide(nivel);
    if (!p) continue;
    if (vistos.has(p.clave)) continue;
    vistos.add(p.clave);
    lista.push(p);
  }
  return mezclar(lista);
}

@Component({
  selector: 'app-piramides',
  standalone: true,
  imports: [Quiz],
  template: `
    <app-quiz
      [vm]="vm()"
      (volver)="volver()"
      (nivelElegido)="seleccionarNivel($event)"
      (empezar)="empezar()"
      (respuestaSeleccionada)="respuestaSeleccionada($event)"
      (avanzar)="avanzar()"
      (reiniciar)="reiniciar()"
      (alternarSonido)="alternarSonido()"
    />
  `,
})
export class Piramides implements OnInit, OnDestroy {
  private readonly router = inject(Router);
  private readonly gameUi = inject(GameUiService);
  private readonly attempts = inject(AttemptsService);

  private intentoId: string | null = null;
  private intentoInicio = 0;
  private nivelActual = 1;
  private piramidesPorNivel: Piramide[][] = [[], [], []];

  readonly sonidosActivos = signal(true);

  readonly vm = signal<QuizViewModel>({
    config: {
      titulo: 'Pirámides',
      descripcion: 'Cada casillero es la suma de los dos que tiene debajo. Usa sumas y restas para hallar el valor que falta.',
      niveles: 3,
      preguntasPorNivel: CANTIDAD,
      etiquetasNiveles: ['Básico', 'Intermedio', 'Avanzado'],
      colorTema: 'orange',
      preguntas: [],
    },
    estado: 'intro',
    indice: 0,
    nivelSeleccionado: 1,
    preguntaActual: null,
    total: CANTIDAD,
    etiquetasNiveles: ['Básico', 'Intermedio', 'Avanzado'],
    resultado: {
      correctas: 0,
      incorrectas: 0,
      total: 0,
      puntaje: 0,
      porcentaje: 0,
      respuestas: [],
    },
    estrellas: 0,
    colorTema: 'orange',
    seleccionada: null,
    esCorrecta: null,
    mostrarConfeti: false,
    sonidosActivos: true,
    segundosRestantes: 0,
  });

  readonly config = computed(() => this.vm().config);

  ngOnInit(): void {
    this.gameUi.setJugando(true);
    this.cargarPreguntas(1);
    this.cargarPreguntas(2);
    this.cargarPreguntas(3);
  }

  ngOnDestroy(): void {
    this.gameUi.setJugando(false);
  }

  private cargarPreguntas(nivel: number): void {
    const lista = crearNivel(nivel);
    this.piramidesPorNivel[nivel - 1] = lista;
  }

  private obtenerPreguntas(nivel: number): PreguntaQuiz[] {
    return this.piramidesPorNivel[nivel - 1].map((p, i) => this.mapearPiramide(p, nivel, i));
  }

  private mapearPiramide(p: Piramide, nivel: number, idx: number): PreguntaQuiz {
    return {
      id: `piramide-${nivel}-${idx}-${p.clave.slice(0, 8)}`,
      enunciado: p.pregunta,
      tipo: 'personalizado',
      contenidoHtml: this.renderizarPiramide(p, nivel, false),
      opciones: p.opciones.map((op) => ({ id: String(op), texto: String(op) })),
      respuestaCorrectaId: String(p.correcta),
      explicacion: `Pasos: ${p.pasos.join(' → ')}`,
      nivel,
      puntos: PUNTOS[nivel] ?? 10,
      datos: { piramide: p, nivel },
    };
  }

  private renderizarPiramide(p: Piramide, nivel: number, revelar = false): string {
    const filas = revelar ? p.completa : p.oculta;
    return `
      <div class="piramide-caja d-flex flex-column align-items-center w-100">
        <div class="piramide-render">${this.renderizarFilas(filas)}</div>
      </div>
    `;
  }

  private renderizarFilas(celdas: Celda[][]): string {
    return celdas
      .map(
        (f: Celda[]) => `
      <div class="d-flex justify-content-center">
        ${f
          .map((c: Celda) => `<div class="border border-2 rounded-3 d-flex align-items-center justify-content-center fw-bold piramide-celda ${c.c}">${c.t}</div>`)
          .join('')}
      </div>
    `
      )
      .join('');
  }

  volver(): void {
    this.gameUi.setJugando(false);
    void this.router.navigateByUrl('/razonamiento-logico');
  }

  seleccionarNivel(nivel: number): void {
    this.nivelActual = nivel;
    const preguntas = this.obtenerPreguntas(nivel);
    const vm = this.vm();
    this.vm.set({
      ...vm,
      nivelSeleccionado: nivel,
      config: { ...vm.config, preguntas },
      total: preguntas.length,
    });
  }

  async empezar(): Promise<void> {
    const vm = this.vm();
    const preguntas = vm.config.preguntas.length ? vm.config.preguntas : this.obtenerPreguntas(this.nivelActual);
    this.vm.set({
      ...vm,
      config: { ...vm.config, preguntas },
      estado: 'jugando',
      indice: 0,
      total: preguntas.length,
      preguntaActual: preguntas[0] ?? null,
      seleccionada: null,
      esCorrecta: null,
      resultado: {
        correctas: 0,
        incorrectas: 0,
        total: preguntas.length,
        puntaje: 0,
        porcentaje: 0,
        respuestas: [],
      },
      estrellas: 0,
      mostrarConfeti: false,
    });
    const sesion = await this.attempts.iniciar('piramides');
    this.intentoId = sesion?.id ?? null;
    this.intentoInicio = sesion?.inicio ?? Date.now();
  }

  respuestaSeleccionada(opcionId: string): void {
    const vm = this.vm();
    if (vm.estado === 'feedback') return;
    const pregunta = vm.preguntaActual;
    if (!pregunta) return;
    const esCorrecta = opcionId === pregunta.respuestaCorrectaId;
    const resultado = {
      ...vm.resultado,
      correctas: vm.resultado.correctas + (esCorrecta ? 1 : 0),
      incorrectas: vm.resultado.incorrectas + (!esCorrecta ? 1 : 0),
      respuestas: [...vm.resultado.respuestas, { preguntaId: pregunta.id, opcionId, correcta: esCorrecta }],
    };
    resultado.puntaje = resultado.correctas * (pregunta.puntos ?? 10);
    resultado.porcentaje = Math.round((resultado.correctas / Math.max(1, resultado.total)) * 100);

    // Al revelar se muestra la pirámide RESUELTA: sin esto el alumno veía la
    // explicación («8 + 2 = 10») pero el 10 no aparecía en ningún casillero, así
    // que no podía comprobar de dónde salía la respuesta.
    const piramide = pregunta.datos?.piramide as Piramide | undefined;
    const nivel = (pregunta.datos?.nivel as number) ?? this.nivelActual;
    const revelada: PreguntaQuiz = piramide
      ? { ...pregunta, contenidoHtml: this.renderizarPiramide(piramide, nivel, true) }
      : pregunta;

    this.vm.set({
      ...vm,
      seleccionada: opcionId,
      esCorrecta,
      estado: 'feedback',
      preguntaActual: revelada,
      resultado,
    });
  }

  async avanzar(): Promise<void> {
    const vm = this.vm();
    const siguienteIndice = vm.indice + 1;
    if (siguienteIndice >= vm.total) {
      const porcentaje = vm.resultado.porcentaje;
      const estrellas = porcentaje >= 80 ? 3 : porcentaje >= 50 ? 2 : 1;
      this.vm.set({
        ...vm,
        estado: 'resultado',
        estrellas,
        mostrarConfeti: estrellas >= 3,
      });
      if (this.intentoId) {
        try {
          await this.attempts.finalizar(this.intentoId, this.intentoInicio, {
            actividadId: 'piramides',
            puntaje: vm.resultado.puntaje,
            nivel: this.nivelActual,
            respuestasCorrectas: vm.resultado.correctas,
            respuestasIncorrectas: vm.resultado.incorrectas,
          });
        } catch (e) {
          console.error('No se pudo guardar el intento:', e);
        }
        this.intentoId = null;
      }
      return;
    }
    const pregunta = vm.config.preguntas[siguienteIndice];
    this.vm.set({
      ...vm,
      indice: siguienteIndice,
      preguntaActual: pregunta ?? null,
      estado: 'jugando',
      seleccionada: null,
      esCorrecta: null,
    });
  }

  reiniciar(): void {
    const vm = this.vm();
    const preguntas = this.obtenerPreguntas(this.nivelActual);
    this.vm.set({
      ...vm,
      config: { ...vm.config, preguntas },
      estado: 'intro',
      indice: 0,
      preguntaActual: null,
      seleccionada: null,
      esCorrecta: null,
      resultado: {
        correctas: 0,
        incorrectas: 0,
        total: preguntas.length,
        puntaje: 0,
        porcentaje: 0,
        respuestas: [],
      },
      estrellas: 0,
      mostrarConfeti: false,
      nivelSeleccionado: this.nivelActual,
      total: preguntas.length,
    });
  }

  alternarSonido(): void {
    this.sonidosActivos.update((v) => !v);
    const vm = this.vm();
    this.vm.set({ ...vm, sonidosActivos: this.sonidosActivos() });
  }
}
