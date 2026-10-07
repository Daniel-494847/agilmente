import { Component, HostListener, OnDestroy, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { AttemptsService } from '../../../../core/services/attempts.service';
import { FullscreenService } from '../../../../core/services/fullscreen.service';
import { GameUiService } from '../../../../core/services/game-ui.service';

type Modo = 'suma' | 'resta' | 'multiplicacion' | 'combinadas';

/** Fases de la ronda: ajustes -> Showing exercises -> respuestas -> resultado. */
type Fase = 'intro' | 'reproduciendo' | 'respondiendo' | 'resultado';

interface Paso {
  op: string;
  valor: number;
}

/** Un ejercicio es una operación con varios números. */
interface DetalleEjercicio {
  expresion: string;
  respuesta: string;
  resultado: number;
  acierto: boolean;
}

interface ModoInfo {
  id: Modo;
  nombre: string;
  icono: string;
  nota: string;
  /** Variante de Bootstrap que da color al botón: cada operación con su tono. */
  variante: 'success' | 'warning' | 'primary' | 'info';
}

@Component({
  selector: 'app-juegos-mentales',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './juegos-mentales.html',
  styleUrl: './juegos-mentales.css'
})
export class JuegosMentales implements OnDestroy {
  private readonly gameUi = inject(GameUiService);
  private readonly fullscreen = inject(FullscreenService);
  private readonly attempts = inject(AttemptsService);
  private readonly router = inject(Router);

  /** Pausa antes de cada ejercicio: da tiempo a leer el rótulo «Ejercicio N». */
  private static readonly PAUSA_EJERCICIO_MS = 3000;

  readonly actividadId = 'juegos-mentales';
  readonly rutaVolver = '/razonamiento-logico';

  readonly modos: ModoInfo[] = [
    {
      id: 'suma',
      nombre: 'Suma',
      icono: 'bi-plus-circle-fill',
      nota: 'Solo sumas: memoriza los números y súmalos todos.',
      variante: 'success'
    },
    {
      id: 'resta',
      nombre: 'Resta',
      icono: 'bi-dash-circle-fill',
      nota: 'Parte del primer número y réstale todos los demás.',
      variante: 'warning'
    },
    {
      id: 'multiplicacion',
      nombre: 'Multiplicación',
      icono: 'bi-x-circle-fill',
      nota: 'Se multiplican los números (máximo 4 números de 2 cifras).',
      variante: 'primary'
    },
    {
      id: 'combinadas',
      nombre: 'Combinadas',
      icono: 'bi-shuffle',
      nota: 'Mezcla +, − y ×. Se resuelve de izquierda a derecha.',
      variante: 'info'
    }
  ];

  readonly digitos = [1, 2, 3, 4, 5, 6, 7, 8, 9];

  /* ---- Ajustes de la ronda ---- */
  readonly fase = signal<Fase>('intro');
  readonly modo = signal<Modo>('suma');
  readonly cantidad = signal(5);
  readonly cifras = signal(2);
  readonly tiempo = signal(1.2);
  /** Cuántos ejercicios se muestran antes de pedir los resultados. */
  readonly ejercicios = signal(5);
  /** Texto del campo de cantidad: refleja lo escrito para no pisar al teclear. */
  readonly ejerciciosTexto = signal('5');

  /* ---- Mostrando los ejercicios ---- */
  readonly serie = signal<Paso[][]>([]);
  readonly indiceEjercicio = signal(0);
  readonly indiceNumero = signal(0);
  readonly pantalla = signal('');
  /** `true` mientras la pantalla muestra el rótulo «Ejercicio N» y no un número. */
  readonly rotulo = signal(false);
  readonly mensaje = signal('¡Atento!');

  /* ---- Escribiendo los resultados ---- */
  readonly respuestas = signal<string[]>([]);
  readonly huecoActivo = signal(0);

  /* ---- Resultado ---- */
  readonly detalle = signal<DetalleEjercicio[]>([]);
  readonly aciertosRonda = signal(0);
  readonly puntosRonda = signal(0);
  readonly aciertosSesion = signal(0);
  readonly ejerciciosSesion = signal(0);
  readonly sonidoActivo = signal(true);

  /** Delegate de FullscreenService para pintar el aviso en la plantilla. */
  readonly soportado = this.fullscreen.soportado;

  readonly modoActual = computed(
    () => this.modos.find((m) => m.id === this.modo()) ?? this.modos[0]
  );
  /** Cantidad ya recortada al rango válido (2-20): es la que se juega. */
  readonly totalEjercicios = computed(() => {
    const valor = Math.round(this.ejercicios());
    return Number.isFinite(valor) ? Math.min(20, Math.max(2, valor)) : 5;
  });
  readonly respondidos = computed(() => this.respuestas().filter((r) => r !== '').length);
  readonly pendientes = computed(() => this.totalEjercicios() - this.respondidos());
  /** Solo se puede comprobar cuando no queda ningún hueco vacío. */
  readonly puedeComprobar = computed(() => this.pendientes() === 0);
  readonly tituloResultado = computed(() => {
    const aciertos = this.aciertosRonda();
    const total = this.totalEjercicios() || 1;
    if (aciertos === total) return '¡Perfecto!';
    if (aciertos / total >= 0.6) return '¡Muy bien!';
    return '¡Sigue practicando!';
  });
  readonly iconoResultado = computed(() => {
    const aciertos = this.aciertosRonda();
    const total = this.totalEjercicios() || 1;
    if (aciertos === total) return 'bi-emoji-smile-fill';
    return aciertos / total >= 0.6 ? 'bi-emoji-smile-fill' : 'bi-emoji-frown-fill';
  });
  /** Nº de números del ejercicio actual (solo como texto de accesibilidad). */
  readonly numerosEjercicio = computed(() => this.pasosActuales().length);

  private intentoId: string | null = null;
  private intentoInicio = 0;
  /** Sube en cada ronda: cancela la reproducción si el usuario sale o reinicia. */
  private token = 0;

  private pasosActuales(): Paso[] {
    return this.serie()[this.indiceEjercicio()] ?? [];
  }

  /* ================================================================
     Ajustes
     ================================================================ */

  elegirModo(modo: Modo): void {
    this.modo.set(modo);
    // La multiplicación solo admite 4 números de 2 cifras: el paso también lo
    // recorta, así que aquí dejamos los controles listos para lo que se verá.
    if (modo === 'multiplicacion') {
      this.cantidad.set(Math.min(this.cantidad(), 4));
      this.cifras.set(Math.min(this.cifras(), 2));
    }
  }

  cambiarCantidad(delta: number): void {
    this.cantidad.update((valor) => Math.min(20, Math.max(2, valor + delta)));
  }

  /** Campo numérico libre: guarda lo que se escribe (se recorta al salir). */
  escribirEjercicios(evento: Event): void {
    const texto = (evento.target as HTMLInputElement).value;
    this.ejerciciosTexto.set(texto);
    if (texto.trim() === '') return;

    const valor = Number(texto);
    if (!Number.isNaN(valor)) {
      this.ejercicios.set(valor);
    }
  }

  /** Al salir del campo se ajusta al rango 2-20 y se refleja en el campo. */
  normalizarEjercicios(): void {
    const total = this.totalEjercicios();
    this.ejercicios.set(total);
    this.ejerciciosTexto.set(String(total));
  }

  elegirCifras(cifras: number): void {
    this.cifras.set(cifras);
  }

  cambiarTiempo(evento: Event): void {
    const valor = Number((evento.target as HTMLInputElement).value);
    if (!Number.isNaN(valor)) {
      this.tiempo.set(valor);
    }
  }

  /* ================================================================
     Ronda
     ================================================================ */

  /** Botón «Iniciar prueba»: abre a pantalla completa y muestra los ejercicios. */
  async iniciar(): Promise<void> {
    this.normalizarAjustes();

    const total = this.totalEjercicios();
    this.serie.set(Array.from({ length: total }, () => this.generar()));
    this.respuestas.set(Array.from({ length: total }, () => ''));
    this.huecoActivo.set(0);
    this.detalle.set([]);
    this.indiceEjercicio.set(0);
    this.indiceNumero.set(0);
    this.pantalla.set('');
    this.rotulo.set(false);
    this.fase.set('reproduciendo');
    this.mensaje.set('¡Atento!');

    // Modo juego del shell (oculta topbar y colapsa el sidebar) + pantalla
    // completa real del navegador.
    this.gameUi.setJugando(true);
    await this.fullscreen.activar();

    const sesion = await this.attempts.iniciar(this.actividadId);
    this.intentoId = sesion?.id ?? null;
    this.intentoInicio = sesion?.inicio ?? Date.now();

    this.tocar('inicio');
    await this.reproducir();
  }

  /** Compara los N resultados escritos con las operaciones de los ejercicios. */
  comprobar(): void {
    if (this.fase() !== 'respondiendo' || !this.puedeComprobar()) return;

    const respuestas = this.respuestas();
    const detalle = this.serie().map((pasos, indice) => {
      const resultado = this.calcular(pasos);
      const respuesta = respuestas[indice] ?? '';
      return { expresion: this.expresionDe(pasos), respuesta, resultado, acierto: Number(respuesta) === resultado };
    });

    const aciertos = detalle.filter((d) => d.acierto).length;
    const puntosPorEjercicio = 10 + this.cifras() * 5;

    this.detalle.set(detalle);
    this.aciertosRonda.set(aciertos);
    this.puntosRonda.set(aciertos * puntosPorEjercicio);
    this.aciertosSesion.update((valor) => valor + aciertos);
    this.ejerciciosSesion.update((valor) => valor + detalle.length);
    this.fase.set('resultado');
    this.tocar(aciertos === detalle.length ? 'acierto' : 'error');
    void this.guardarIntento();
  }

  /** Vuelve a los ajustes y cierra la pantalla completa. */
  salir(): void {
    this.token++;
    this.gameUi.setJugando(false);
    void this.fullscreen.salir();
    this.limpiarRonda();
    void this.cerrarIntento();
  }

  volver(): void {
    this.salir();
    void this.router.navigateByUrl(this.rutaVolver);
  }

  alternarSonido(): void {
    this.sonidoActivo.update((activo) => !activo);
  }

  /* ================================================================
     Huecos de respuesta (teclado en pantalla y teclado físico)
     ================================================================ */

  seleccionarHueco(indice: number): void {
    this.huecoActivo.set(indice);
  }

  /** Mueve el hueco seleccionado (botones «anterior / siguiente»). */
  moverHueco(delta: number): void {
    const total = this.respuestas().length;
    if (total === 0) return;
    this.huecoActivo.set(Math.min(total - 1, Math.max(0, this.huecoActivo() + delta)));
  }

  /** `true` si se puede avanzar al hueco siguiente. */
  readonly hayHuecoSiguiente = computed(() => this.huecoActivo() < this.respuestas().length - 1);
  /** `true` si se puede volver al hueco anterior. */
  readonly hayHuecoAnterior = computed(() => this.huecoActivo() > 0);

  /** Escribe en un hueco concreto del array de respuestas (copia inmutable). */
  private escribirRespuesta(indice: number, valor: string): void {
    this.respuestas.update((lista) => {
      const copia = [...lista];
      copia[indice] = valor;
      return copia;
    });
  }

  agregarDigito(indice: number, digito: string): void {
    if (this.fase() !== 'respondiendo') return;

    const actual = this.respuestas()[indice] ?? '';

    // El signo solo va delante: los resultados negativos empiezan por "-".
    if (digito === '-') {
      this.escribirRespuesta(indice, actual === '' ? '-' : actual);
      return;
    }

    // El cero inicial se sustituye, no se acumula ("0" + "5" -> "5").
    if (actual === '0') {
      this.escribirRespuesta(indice, digito);
    } else if (actual.length < 8) {
      this.escribirRespuesta(indice, actual + digito);
    }
    this.tocar('tecla');
  }

  borrarDigito(indice: number): void {
    if (this.fase() !== 'respondiendo') return;
    this.escribirRespuesta(indice, (this.respuestas()[indice] ?? '').slice(0, -1));
  }

  @HostListener('document:keydown', ['$event'])
  onTecla(evento: KeyboardEvent): void {
    if (this.fase() !== 'respondiendo') return;

    const hueco = this.huecoActivo();
    if (/^[0-9]$/.test(evento.key)) {
      this.agregarDigito(hueco, evento.key);
    } else if (evento.key === '-') {
      this.agregarDigito(hueco, '-');
    } else if (evento.key === 'Backspace') {
      this.borrarDigito(hueco);
    } else if (evento.key === 'ArrowRight' || evento.key === 'ArrowDown' || evento.key === 'Tab') {
      this.moverHueco(1);
    } else if (evento.key === 'ArrowLeft' || evento.key === 'ArrowUp') {
      this.moverHueco(-1);
    } else if (evento.key === 'Enter') {
      // Enter pasa al hueco siguiente; en el último comprueba los resultados.
      if (this.hayHuecoSiguiente()) {
        this.moverHueco(1);
      } else {
        this.comprobar();
      }
    } else {
      return;
    }
    evento.preventDefault();
  }

  /* ================================================================
     Reproducción de los ejercicios
     ================================================================ */

  private async reproducir(): Promise<void> {
    const token = ++this.token;
    const serie = this.serie();
    const duracion = Math.max(300, this.tiempo() * 1000);

    for (let ejercicio = 0; ejercicio < serie.length; ejercicio++) {
      if (!this.sigueVivo(token)) return;

      this.indiceEjercicio.set(ejercicio);
      const pasos = serie[ejercicio];

      // Rótulo del ejercicio con 3 s de pausa: separa un ejercicio del siguiente.
      this.indiceNumero.set(0);
      this.rotulo.set(true);
      this.pantalla.set(`Ejercicio ${ejercicio + 1}`);
      await this.esperar(JuegosMentales.PAUSA_EJERCICIO_MS);
      if (!this.sigueVivo(token)) return;

      this.rotulo.set(false);
      this.pantalla.set('');

      for (let numero = 0; numero < pasos.length; numero++) {
        if (!this.sigueVivo(token)) return;

        const paso = pasos[numero];
        this.indiceNumero.set(numero);
        this.pantalla.set(numero === 0 ? `${paso.valor}` : `${paso.op} ${paso.valor}`);

        await this.esperar(duracion);
        if (!this.sigueVivo(token)) return;

        // Pausa corta entre números para que se lean los repetidos.
        this.pantalla.set('');
        await this.esperar(150);
      }
    }

    if (!this.sigueVivo(token)) return;

    this.fase.set('respondiendo');
    this.mensaje.set('Ahora escribe los resultados');
  }

  /** `true` si esta ronda sigue vigente (el usuario no salió ni reinició). */
  private sigueVivo(token: number): boolean {
    return token === this.token && this.fase() === 'reproduciendo';
  }

  /* ================================================================
     Generación y cálculo
     ================================================================ */

  /** Crea un ejercicio: lista de números y operadores según el modo elegido. */
  private generar(): Paso[] {
    const modo = this.modo();
    let numeros = this.cantidad();
    let cifras = this.cifras();

    if (modo === 'multiplicacion') {
      numeros = Math.min(numeros, 4);
      cifras = Math.min(cifras, 2);
    }

    const lista: Paso[] = [];
    for (let i = 0; i < numeros; i++) {
      let op = '+';
      let valor = this.aleatorio(cifras);

      if (i > 0) {
        if (modo === 'resta') op = '−';
        if (modo === 'multiplicacion') op = '×';
        if (modo === 'combinadas') {
          op = ['+', '−', '×'][Math.floor(Math.random() * 3)];
          // Multiplicador de 2 a 9 para que el producto siga siendo manejable.
          if (op === '×') valor = 2 + Math.floor(Math.random() * 8);
        }
      }

      lista.push({ op, valor });
    }
    return lista;
  }

  /** Resuelve la operación de izquierda a derecha. */
  private calcular(pasos: Paso[]): number {
    return pasos.reduce((acumulado, paso, indice) => {
      if (indice === 0) return paso.valor;
      if (paso.op === '+') return acumulado + paso.valor;
      if (paso.op === '−') return acumulado - paso.valor;
      return acumulado * paso.valor;
    }, 0);
  }

  /** «48 − 12 − 7» */
  private expresionDe(pasos: Paso[]): string {
    return pasos.map((paso, indice) => (indice === 0 ? `${paso.valor}` : `${paso.op} ${paso.valor}`)).join(' ');
  }

  private aleatorio(cifras: number): number {
    const minimo = cifras === 1 ? 1 : 10 ** (cifras - 1);
    const maximo = 10 ** cifras - 1;
    return Math.floor(Math.random() * (maximo - minimo + 1)) + minimo;
  }

  private esperar(ms: number): Promise<void> {
    return new Promise((resolver) => setTimeout(resolver, ms));
  }

  /* ================================================================
     Intentos (progreso del estudiante)
     ================================================================ */

  private async guardarIntento(): Promise<void> {
    if (!this.intentoId) return;

    const id = this.intentoId;
    this.intentoId = null;
    try {
      await this.attempts.finalizar(id, this.intentoInicio, {
        actividadId: this.actividadId,
        puntaje: this.puntosRonda(),
        nivel: this.cifras(),
        respuestasCorrectas: this.aciertosRonda(),
        respuestasIncorrectas: this.totalEjercicios() - this.aciertosRonda()
      });
    } catch (error) {
      console.error('No se pudo guardar el intento:', error);
    }
  }

  /** Cierra un intento abierto al abandonar la ronda, para no dejarlo pendiente. */
  private async cerrarIntento(): Promise<void> {
    if (!this.intentoId) return;

    const id = this.intentoId;
    this.intentoId = null;
    try {
      await this.attempts.finalizar(id, this.intentoInicio, {
        actividadId: this.actividadId,
        puntaje: 0,
        nivel: this.cifras(),
        respuestasCorrectas: 0,
        respuestasIncorrectas: 0
      });
    } catch (error) {
      console.error('No se pudo cerrar el intento:', error);
    }
  }

  /* ================================================================
     Sonido
     ================================================================ */

  private tocar(tipo: 'tecla' | 'inicio' | 'acierto' | 'error'): void {
    if (!this.sonidoActivo()) return;

    const notas: Record<string, number[]> = {
      tecla: [620],
      inicio: [440, 660],
      acierto: [523, 659, 784],
      error: [220, 180]
    };
    const duracion = 0.1;

    try {
      const audio = new AudioContext();
      const ahora = audio.currentTime;
      (notas[tipo] ?? [440]).forEach((frecuencia, indice) => {
        const oscilador = audio.createOscillator();
        const ganancia = audio.createGain();
        oscilador.connect(ganancia);
        ganancia.connect(audio.destination);
        oscilador.frequency.value = frecuencia;
        ganancia.gain.setValueAtTime(0.12, ahora + indice * duracion);
        ganancia.gain.exponentialRampToValueAtTime(0.001, ahora + indice * duracion + duracion);
        oscilador.start(ahora + indice * duracion);
        oscilador.stop(ahora + indice * duracion + duracion);
      });
      setTimeout(() => void audio.close(), duracion * 4 + 400);
    } catch {
      // Sin audio disponible: el juego sigue funcionando.
    }
  }

  /* ================================================================
     Utilidades
     ================================================================ */

  private normalizarAjustes(): void {
    const modo = this.modo();
    const maximoNumeros = modo === 'multiplicacion' ? 4 : 20;
    const maximoCifras = modo === 'multiplicacion' ? 2 : 3;

    this.cantidad.set(Math.min(maximoNumeros, Math.max(2, this.cantidad())));
    this.cifras.set(Math.min(maximoCifras, Math.max(1, this.cifras())));
    this.tiempo.set(Math.min(5, Math.max(0.3, this.tiempo())));
    this.ejercicios.set(this.totalEjercicios());
  }

  private limpiarRonda(): void {
    this.fase.set('intro');
    this.serie.set([]);
    this.indiceEjercicio.set(0);
    this.indiceNumero.set(0);
    this.pantalla.set('');
    this.rotulo.set(false);
    this.respuestas.set([]);
    this.detalle.set([]);
    this.huecoActivo.set(0);
  }

  ngOnDestroy(): void {
    this.token++;
    this.gameUi.setJugando(false);
    void this.fullscreen.salir();
    void this.cerrarIntento();
  }
}
