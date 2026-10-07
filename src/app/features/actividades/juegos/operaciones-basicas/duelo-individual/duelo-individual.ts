import { Component, Input, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { AttemptsService } from '../../../../../core/services/attempts.service';
import { GameUiService } from '../../../../../core/services/game-ui.service';

type TipoBase =
  | 'sumas'
  | 'restas'
  | 'multiplicacion'
  | 'division'
  | 'combinadas'
  | 'operaciones-basicas';

type Ejercicio = {
  expresion: string;
  resultado: number;
};

type Jugador = {
  id: 'jugador';
  nombre: string;
  puntos: number;
  expresion: string;
  resultado: number;
  respuesta: string;
  mensaje: string;
  pendientes: Ejercicio[];
};

@Component({
  selector: 'app-duelo-individual-op',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './duelo-individual.html',
  styleUrl: './duelo-individual.css'
})
export class DueloIndividualOp implements OnInit, OnDestroy {
  @Input() tipo: TipoBase = 'operaciones-basicas';
  @Input() titulo = 'Operaciones básicas';
  @Input() rutaVolver = '/razonamiento-logico/operaciones-basicas';
  @Input() textoVolver = 'Volver al menú';

  private readonly gameUi = inject(GameUiService);
  private readonly attempts = inject(AttemptsService);

  private intentoId: string | null = null;
  private intentoInicio = 0;
  private timer: ReturnType<typeof setInterval> | null = null;

  readonly niveles = [1, 2, 3, 4, 5];
  readonly duraciones = [1, 2, 3, 5];
  readonly total = 30;
  readonly puntosMeta = Array.from({ length: 30 }, (_, i) => i + 1);
  readonly nombres = ['Inicial', 'Práctica', 'Intermedio', 'Avanzado', 'Experto'];
  readonly digitos = [1, 2, 3, 4, 5, 6, 7, 8, 9, 0];

  nivel = signal(1);
  duracion = signal(2);
  tiempo = signal(120);
  agotado = signal(false);
  iniciado = signal(false);
  completo = signal(false);
  resultado = signal('');
  jugador = signal<Jugador | null>(null);

  ngOnInit(): void {
    this.nuevo();
  }

  ngOnDestroy(): void {
    this.detener();
    this.gameUi.setJugando(false);
  }

  nuevo(): void {
    this.resultado.set('');
    this.completo.set(false);
    this.jugador.set(this.crearJugador());
  }

  selNivel(n: number): void {
    this.nivel.set(n);
    this.nuevo();
    if (this.iniciado()) {
      this.iniciarTemporizador();
    }
  }

  selDur(m: number): void {
    this.duracion.set(m);
  }

  get tiempoFmt(): string {
    const m = Math.floor(this.tiempo() / 60)
      .toString()
      .padStart(2, '0');
    const s = (this.tiempo() % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }

  async jugar(): Promise<void> {
    this.nuevo();
    this.iniciado.set(true);
    this.gameUi.setJugando(true);
    const sesion = await this.attempts.iniciar('operaciones-basicas');
    this.intentoId = sesion?.id ?? null;
    this.intentoInicio = sesion?.inicio ?? Date.now();
    this.iniciarTemporizador();
  }

  salir(): void {
    this.iniciado.set(false);
    this.completo.set(false);
    this.intentoId = null;
    this.gameUi.setJugando(false);
    this.detener();
  }

  add(d: number): void {
    const j = this.jugador();
    if (!j || this.completo() || this.agotado()) return;
    if (j.respuesta.length < 6) {
      this.up({ respuesta: j.respuesta + d, mensaje: '' });
    }
  }

  del(): void {
    const j = this.jugador();
    if (!j || this.completo() || this.agotado()) return;
    this.up({ respuesta: j.respuesta.slice(0, -1), mensaje: '' });
  }

  ver(): void {
    const j = this.jugador();
    if (!j || this.completo() || this.agotado()) return;
    if (!j.respuesta) {
      this.up({ mensaje: 'Ingresa tu respuesta' });
      return;
    }
    if (Number(j.respuesta) === j.resultado) {
      const pts = j.puntos + 1;
      const pend = [...j.pendientes];
      const sig = pend.shift();
      if (!sig) {
        this.completo.set(true);
        this.resultado.set(`¡Completaste los ${this.total} ejercicios!`);
        this.up({
          puntos: pts,
          respuesta: '',
          mensaje: '¡Muy bien! ¡Has terminado!'
        });
        this.detener();
        void this.guardar();
        return;
      }
      this.up({
        puntos: pts,
        respuesta: '',
        mensaje: '¡Correcto!',
        expresion: sig.expresion,
        resultado: sig.resultado,
        pendientes: pend
      });
      return;
    }
    this.up({ respuesta: '', mensaje: 'Inténtalo otra vez' });
  }

  private up(c: Partial<Jugador>): void {
    this.jugador.update((x) => (x ? { ...x, ...c } : x));
  }

  private async guardar(): Promise<void> {
    if (!this.intentoId) return;
    try {
      const j = this.jugador();
      const pts = j?.puntos || 0;
      await this.attempts.finalizar(this.intentoId, this.intentoInicio, {
        actividadId: 'operaciones-basicas',
        puntaje: pts,
        nivel: this.nivel(),
        respuestasCorrectas: pts,
        respuestasIncorrectas: 0
      });
    } catch (e) {
      console.error('No se pudo guardar el intento:', e);
    }
    this.intentoId = null;
  }

  private crearJugador(): Jugador {
    const pend = this.generar();
    const p = pend.shift()!;
    return {
      id: 'jugador',
      nombre: 'Jugador',
      puntos: 0,
      respuesta: '',
      mensaje: '',
      pendientes: pend,
      ...p
    };
  }

  private generar(): Ejercicio[] {
    const vistos = new Set<string>();
    const arr: Ejercicio[] = [];
    for (let i = 0; i < this.total; i++) {
      let e = this.problema();
      let t = 0;
      while (vistos.has(e.expresion) && t < 100) {
        e = this.problema();
        t++;
      }
      vistos.add(e.expresion);
      arr.push(e);
    }
    return this.mezclar(arr);
  }

  private mezclar<T>(a: T[]): T[] {
    const r = [...a];
    for (let i = r.length - 1; i > 0; i--) {
      const k = Math.floor(Math.random() * (i + 1));
      [r[i], r[k]] = [r[k], r[i]];
    }
    return r;
  }

  private problema(): Ejercicio {
    const n = this.nivel();
    const r = 5 + n * 10;
    const a = this.rnd(2, r);
    const b = this.rnd(2, r);
    const tp = this.tipo;
    if (tp === 'operaciones-basicas') {
      const ops: Exclude<TipoBase, 'operaciones-basicas'>[] = [
        'sumas',
        'restas',
        'multiplicacion',
        'division'
      ];
      return this.de(ops[this.rnd(0, 3)], n, a, b);
    }
    return this.de(tp as Exclude<TipoBase, 'operaciones-basicas'>, n, a, b);
  }

  private de(
    tp: Exclude<TipoBase, 'operaciones-basicas'>,
    n: number,
    a: number,
    b: number
  ): Ejercicio {
    switch (tp) {
      case 'restas': {
        const m = Math.max(a, b);
        const mn = Math.min(a, b);
        return { expresion: `${m} − ${mn}`, resultado: m - mn };
      }
      case 'multiplicacion': {
        const fm = 3 + n * 2;
        const fa = this.rnd(2, fm);
        const fb = this.rnd(2, fm);
        return { expresion: `${fa} × ${fb}`, resultado: fa * fb };
      }
      case 'division': {
        const lm = 2 + n * 2;
        const d = this.rnd(2, lm);
        const c = this.rnd(2, lm);
        const dd = d * c;
        return { expresion: `${dd} ÷ ${d}`, resultado: c };
      }
      case 'combinadas': {
        const lm = 3 + n * 3;
        const oa = this.rnd(2, lm);
        const ob = this.rnd(2, lm);
        const f = this.rnd(2, n + 2);
        return {
          expresion: `${oa} + ${ob} × ${f}`,
          resultado: oa + ob * f
        };
      }
      case 'sumas':
      default:
        return { expresion: `${a} + ${b}`, resultado: a + b };
    }
  }

  private rnd(mn: number, mx: number): number {
    return Math.floor(Math.random() * (mx - mn + 1)) + mn;
  }

  private iniciarTemporizador(): void {
    this.detener();
    this.tiempo.set(this.duracion() * 60);
    this.agotado.set(false);
    this.timer = setInterval(() => {
      if (this.tiempo() <= 1) {
        this.tiempo.set(0);
        this.agotado.set(true);
        const j = this.jugador();
        if (j) {
          const c = j.puntos;
          if (c < this.total) {
            this.resultado.set(
              c
                ? `Tiempo agotado. Has completado ${c} de ${this.total} ejercicios.`
                : 'Tiempo agotado. ¡Sigue practicando!'
            );
          }
          this.up({
            mensaje: c === this.total ? '¡Muy bien!' : 'Tiempo terminado'
          });
        }
        this.detener();
        void this.guardar();
        return;
      }
      this.tiempo.update((t) => t - 1);
    }, 1000);
  }

  private detener(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
