import { Component, Input, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { AttemptsService } from '../../../../../core/services/attempts.service';
import { GameUiService } from '../../../../../core/services/game-ui.service';

type TipoOperacion = 'sumas' | 'restas' | 'multiplicacion' | 'division' | 'combinadas' | 'operaciones-basicas';

type Ejercicio = {
  expresion: string;
  resultado: number;
};

type Participante = {
  id: 'azul' | 'rojo';
  nombre: string;
  puntos: number;
  expresion: string;
  resultado: number;
  respuesta: string;
  mensaje: string;
  /** Ejercicios que le quedan en esta partida (se generan mezclados al crearla). */
  pendientes: Ejercicio[];
};

@Component({
  selector: 'app-duelo-matematico',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './duelo-matematico.html',
  styleUrl: './duelo-matematico.css'
})
export class DueloMatematico implements OnInit, OnDestroy {
  @Input() titulo = 'Duelo matemático';
  @Input() tipo: TipoOperacion = 'sumas';
  /** Id para guardar el intento (sumas, restas, ...). Por defecto usa `tipo`. */
  @Input() actividadId = '';
  /** Ruta del botón volver (por defecto el menú de matemáticas interactivas). */
  @Input() rutaVolver = '/razonamiento-logico/matematicas-interactivas';
  /** Texto del botón volver. */
  @Input() textoVolver = 'Volver a operaciones';
  /** Etiqueta corta del volver dentro de la partida. */
  @Input() etiquetaVolver = 'Operaciones';

  // El shell entra en modo juego: fija el alto a 100dvh, oculta el topbar y
  // colapsa el sidebar, de modo que no queda altura muerta bajo el juego.
  private readonly gameUi = inject(GameUiService);
  private readonly attempts = inject(AttemptsService);
  private intentoId: string | null = null;
  private intentoInicio = 0;

  readonly digitos = [1, 2, 3, 4, 5, 6, 7, 8, 9, 0];
  readonly niveles = [1, 2, 3, 4, 5];
  readonly duracionesMinutos = [1, 2, 3, 5];
  /** Cada partida son 30 ejercicios por jugador; gana quien los completa primero. */
  readonly totalEjercicios = 30;
  readonly puntosMeta = Array.from({ length: this.totalEjercicios }, (_, indice) => indice + 1);
  readonly nombresNiveles = ['Inicial', 'Práctica', 'Intermedio', 'Avanzado', 'Experto'];
  nivelActual = signal(1);
  duracionSeleccionada = signal(2);
  readonly tiempoRestante = signal(120);
  readonly tiempoAgotado = signal(false);
  juegoIniciado = signal(false);
  ventajaActual = signal<Participante['id'] | null>(null);
  resultadoPartida = signal('');
  ganador = signal<Participante['id'] | null>(null);
  participantes = signal<Participante[]>([]);
  private temporizador: ReturnType<typeof setInterval> | null = null;

  ngOnInit(): void {
    this.nuevaPartida();
  }

  ngOnDestroy(): void {
    this.detenerTemporizador();
    this.gameUi.setJugando(false);
  }

  nuevaPartida(): void {
    this.ventajaActual.set(null);
    this.resultadoPartida.set('');
    this.ganador.set(null);
    this.participantes.set([
      this.crearParticipante('azul', 'Equipo azul'),
      this.crearParticipante('rojo', 'Equipo rojo')
    ]);
  }

  seleccionarNivel(nivel: number): void {
    this.nivelActual.set(nivel);
    this.nuevaPartida();
    if (this.juegoIniciado()) {
      this.iniciarTemporizador();
    }
  }

  seleccionarDuracion(minutos: number): void {
    this.duracionSeleccionada.set(minutos);
  }

  async jugar(): Promise<void> {
    this.nuevaPartida();
    this.juegoIniciado.set(true);
    this.gameUi.setJugando(true);
    const sesion = await this.attempts.iniciar(this.actividadId || this.tipo);
    this.intentoId = sesion?.id ?? null;
    this.intentoInicio = sesion?.inicio ?? Date.now();
    this.iniciarTemporizador();
  }

  salirDelJuego(): void {
    this.juegoIniciado.set(false);
    this.ganador.set(null);
    this.intentoId = null;
    this.gameUi.setJugando(false);
    this.detenerTemporizador();
  }

  get tiempoFormateado(): string {
    const minutos = Math.floor(this.tiempoRestante() / 60).toString().padStart(2, '0');
    const segundos = (this.tiempoRestante() % 60).toString().padStart(2, '0');
    return `${minutos}:${segundos}`;
  }

  agregarDigito(participante: Participante, digito: number): void {
    if (!this.ganador() && !this.tiempoAgotado() && participante.respuesta.length < 4) {
      this.actualizarParticipante(participante.id, { respuesta: participante.respuesta + digito, mensaje: '' });
    }
  }

  borrarDigito(participante: Participante): void {
    if (this.ganador() || this.tiempoAgotado()) {
      return;
    }

    this.actualizarParticipante(participante.id, {
      respuesta: participante.respuesta.slice(0, -1),
      mensaje: ''
    });
  }

  verificar(participante: Participante): void {
    if (this.ganador() || this.tiempoAgotado()) {
      return;
    }

    if (!participante.respuesta) {
      this.actualizarParticipante(participante.id, { mensaje: 'Ingresa tu respuesta' });
      return;
    }

    if (Number(participante.respuesta) === participante.resultado) {
      const puntos = participante.puntos + 1;
      this.ventajaActual.set(participante.id);
      const pendientes = [...participante.pendientes];
      const siguiente = pendientes.shift();
      if (!siguiente) {
        this.ganador.set(participante.id);
        this.resultadoPartida.set(
          `¡Gana ${participante.nombre} al completar los ${this.totalEjercicios} ejercicios!`
        );
        this.actualizarParticipante(participante.id, { puntos, respuesta: '', mensaje: '¡Ganaste!' });
        this.detenerTemporizador();
        void this.guardarIntento();
      } else {
        this.actualizarParticipante(participante.id, {
          puntos,
          respuesta: '',
          mensaje: '¡Correcto!',
          expresion: siguiente.expresion,
          resultado: siguiente.resultado,
          pendientes
        });
      }
      return;
    }

    this.actualizarParticipante(participante.id, { respuesta: '', mensaje: 'Inténtalo otra vez' });
  }

  private actualizarParticipante(id: Participante['id'], cambios: Partial<Participante>): void {
    this.participantes.update((lista) => lista.map((p) => (p.id === id ? { ...p, ...cambios } : p)));
  }

  private async guardarIntento(): Promise<void> {
    if (!this.intentoId) return;
    try {
      const lista = this.participantes();
      const puntaje = Math.max(...lista.map((p) => p.puntos), 0);
      await this.attempts.finalizar(this.intentoId, this.intentoInicio, {
        actividadId: this.actividadId || this.tipo,
        puntaje,
        nivel: this.nivelActual(),
        respuestasCorrectas: puntaje,
        respuestasIncorrectas: 0
      });
    } catch (e) {
      console.error('No se pudo guardar el intento:', e);
    }
    this.intentoId = null;
  }

  private crearParticipante(id: Participante['id'], nombre: string): Participante {
    const pendientes = this.generarEjercicios();
    const primero = pendientes.shift()!;
    return {
      id,
      nombre,
      puntos: 0,
      respuesta: '',
      mensaje: '',
      pendientes,
      ...primero
    };
  }

  /* Cada partida genera 30 ejercicios nuevos: aleatorios, sin repetir la
     misma expresión mientras el rango del nivel lo permita (los niveles
     bajos de división/multiplicación tienen pocas combinaciones y ahí se
     admiten repeticiones tras 100 intentos) y finalmente mezclados, así
     el orden cambia cada vez que el usuario juega. */
  private generarEjercicios(): Ejercicio[] {
    const vistos = new Set<string>();
    const ejercicios: Ejercicio[] = [];
    for (let indice = 0; indice < this.totalEjercicios; indice++) {
      let ejercicio = this.crearProblema();
      let intentos = 0;
      while (vistos.has(ejercicio.expresion) && intentos < 100) {
        ejercicio = this.crearProblema();
        intentos++;
      }
      vistos.add(ejercicio.expresion);
      ejercicios.push(ejercicio);
    }
    return this.mezclar(ejercicios);
  }

  private mezclar<T>(elementos: T[]): T[] {
    const resultado = [...elementos];
    for (let indice = resultado.length - 1; indice > 0; indice--) {
      const aleatorio = Math.floor(Math.random() * (indice + 1));
      [resultado[indice], resultado[aleatorio]] = [resultado[aleatorio], resultado[indice]];
    }
    return resultado;
  }

  private crearProblema(): Ejercicio {
    const nivel = this.nivelActual();
    const rango = 5 + nivel * 10;
    const primero = this.enteroAleatorio(2, rango);
    const segundo = this.enteroAleatorio(2, rango);

    if (this.tipo === 'operaciones-basicas') {
      const opciones: Exclude<TipoOperacion, 'combinadas' | 'operaciones-basicas'>[] =
        ['sumas', 'restas', 'multiplicacion', 'division'];
      const elegida = opciones[this.enteroAleatorio(0, opciones.length - 1)];
      return this.crearProblemaDe(elegida, nivel, primero, segundo);
    }

    return this.crearProblemaDe(this.tipo, nivel, primero, segundo);
  }

  private crearProblemaDe(
    tipo: Exclude<TipoOperacion, 'operaciones-basicas'>,
    nivel: number,
    primero: number,
    segundo: number
  ): Ejercicio {
    switch (tipo) {
      case 'restas': {
        const mayor = Math.max(primero, segundo);
        const menor = Math.min(primero, segundo);
        return { expresion: `${mayor} − ${menor}`, resultado: mayor - menor };
      }
      case 'multiplicacion': {
        const factorMaximo = 3 + nivel * 2;
        const factorA = this.enteroAleatorio(2, factorMaximo);
        const factorB = this.enteroAleatorio(2, factorMaximo);
        return { expresion: `${factorA} × ${factorB}`, resultado: factorA * factorB };
      }
      case 'division': {
        const limite = 2 + nivel * 2;
        const divisor = this.enteroAleatorio(2, limite);
        const cociente = this.enteroAleatorio(2, limite);
        return { expresion: `${divisor * cociente} ÷ ${divisor}`, resultado: cociente };
      }
      case 'combinadas': {
        const limite = 3 + nivel * 3;
        const operandoA = this.enteroAleatorio(2, limite);
        const operandoB = this.enteroAleatorio(2, limite);
        const factor = this.enteroAleatorio(2, nivel + 2);
        return {
          expresion: `${operandoA} + ${operandoB} × ${factor}`,
          resultado: operandoA + operandoB * factor
        };
      }
      default:
        return { expresion: `${primero} + ${segundo}`, resultado: primero + segundo };
    }
  }

  private enteroAleatorio(minimo: number, maximo: number): number {
    return Math.floor(Math.random() * (maximo - minimo + 1)) + minimo;
  }

  private iniciarTemporizador(): void {
    this.detenerTemporizador();
    this.tiempoRestante.set(this.duracionSeleccionada() * 60);
    this.tiempoAgotado.set(false);
    this.temporizador = setInterval(() => {
      if (this.tiempoRestante() <= 1) {
        this.tiempoRestante.set(0);
        this.tiempoAgotado.set(true);
        const [azul, rojo] = this.participantes();

        let ganador: Participante['id'] | null = null;
        if (azul.puntos > rojo.puntos) {
          ganador = 'azul';
          this.resultadoPartida.set('¡Gana el equipo azul por tener más puntos cuando terminó el tiempo!');
        } else if (rojo.puntos > azul.puntos) {
          ganador = 'rojo';
          this.resultadoPartida.set('¡Gana el equipo rojo por tener más puntos cuando terminó el tiempo!');
        } else {
          this.resultadoPartida.set('¡Empate! Los dos equipos tienen los mismos puntos.');
        }

        this.ganador.set(ganador);
        this.participantes.update((lista) =>
          lista.map((p) => ({
            ...p,
            mensaje: p.id === ganador ? '¡Ganaste por puntos!' : ganador ? 'Tiempo terminado' : '¡Empate!'
          }))
        );
        this.detenerTemporizador();
        void this.guardarIntento();
        return;
      }

      this.tiempoRestante.update((restante) => restante - 1);
    }, 1000);
  }

  private detenerTemporizador(): void {
    if (this.temporizador) {
      clearInterval(this.temporizador);
      this.temporizador = null;
    }
  }
}
