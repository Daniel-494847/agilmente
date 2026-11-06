import { Injectable } from '@angular/core';

/** Efectos disponibles en la plantilla de quiz. */
export type SonidoQuiz =
  | 'inicio'
  | 'acierto'
  | 'error'
  | 'tiempo'
  | 'tick'
  | 'avanzar'
  | 'resultado'
  | 'fin';

/** Frases habladas que acompañan a la retroalimentación. */
export type VozQuiz = 'acierto' | 'error' | 'tiempo';

/** Notas (Hz) de cada efecto. */
const NOTAS: Record<SonidoQuiz, number[]> = {
  inicio: [440, 660],
  acierto: [523.25, 659.25, 783.99],
  error: [311.13, 233.08],
  tiempo: [880, 659.25, 440],
  // Efectos durante la partida.
  tick: [1046.5],
  avanzar: [392, 587.33],
  resultado: [523.25, 659.25, 783.99, 1046.5],
  fin: [392, 329.63]
};

/** Duración (s) de cada nota; el resto usa 0.12. */
const DURACIONES: Partial<Record<SonidoQuiz, number>> = {
  tick: 0.05,
  avanzar: 0.09,
  resultado: 0.16,
  fin: 0.14
};

/** Texto que se pronuncia en cada caso. */
const FRASES: Record<VozQuiz, string> = {
  acierto: '¡Correcto, sigue así!',
  error: 'Incorrecto',
  tiempo: '¡Se acabó el tiempo!'
};

/**
 * Sonidos y voz de la plantilla de quiz.
 *
 * Los efectos se generan con Web Audio (sin archivos de audio) y la
 * retroalimentación se pronuncia con la API de síntesis de voz del navegador.
 * Ambos se disparan dentro de un clic del alumno («¡Empezar!», una respuesta),
 * así el navegador no bloquea la reproducción por la política de autoplay.
 * Si el equipo no tiene audio disponible, el juego sigue igual.
 */
@Injectable({ providedIn: 'root' })
export class QuizSonidoService {
  private contexto: AudioContext | null = null;
  /** Se guarda la frase en curso: si se recolecta, Chrome corta la voz. */
  private utterance: SpeechSynthesisUtterance | null = null;
  private temporizadorVoz: ReturnType<typeof setTimeout> | null = null;
  private voces: SpeechSynthesisVoice[] = [];

  constructor() {
    // Las voces se cargan de forma asíncrona en algunos navegadores: se
    // cachean al arrancar para tener una voz en español cuando haga falta.
    const sintesis = this.sintesisVoz();
    if (!sintesis) return;
    const cargar = (): void => {
      this.voces = sintesis.getVoices();
    };
    cargar();
    sintesis.addEventListener?.('voiceschanged', cargar);
  }

  /** Reproduce el efecto indicado. Silencioso si el navegador no lo permite. */
  tocar(tipo: SonidoQuiz): void {
    try {
      const audio = this.contexto ?? (this.contexto = new AudioContext());
      if (audio.state === 'suspended') {
        void audio.resume();
      }

      const ahora = audio.currentTime;
      const duracion = DURACIONES[tipo] ?? 0.12;
      const volumen = tipo === 'tick' ? 0.07 : 0.14;

      NOTAS[tipo].forEach((frecuencia, indice) => {
        const inicio = ahora + indice * duracion;
        const oscilador = audio.createOscillator();
        const ganancia = audio.createGain();
        oscilador.type = 'sine';
        oscilador.connect(ganancia);
        ganancia.connect(audio.destination);
        oscilador.frequency.value = frecuencia;
        ganancia.gain.setValueAtTime(0.0001, inicio);
        ganancia.gain.exponentialRampToValueAtTime(volumen, inicio + 0.01);
        ganancia.gain.exponentialRampToValueAtTime(0.0001, inicio + duracion);
        oscilador.start(inicio);
        oscilador.stop(inicio + duracion);
      });
    } catch {
      // Sin audio disponible: el juego sigue funcionando.
    }
  }

  /**
   * Pronuncia la frase de retroalimentación («¡Correcto, sigue así!»,
   * «Incorrecto»…). Si el navegador no soporta la síntesis de voz, no hace nada.
   */
  hablar(tipo: VozQuiz): void {
    this.decir(FRASES[tipo]);
  }

  /**
   * Pronuncia un texto libre (por ejemplo, el resumen de una ronda:
   * «Acertaste 5 correctas y 2 incorrectas»).
   */
  decir(texto: string): void {
    const sintesis = this.sintesisVoz();
    if (!sintesis || !texto.trim()) return;

    const lanzar = (): void => {
      this.pronunciar(texto, this.vozEspanol(), true);
    };

    if (sintesis.speaking || sintesis.pending) {
      // Chrome ignora un `speak()` en la misma tarea que `cancel()`:
      // se cancela y se habla en la tarea siguiente.
      sintesis.cancel();
      this.temporizadorVoz = setTimeout(lanzar, 60);
      return;
    }

    // Camino normal: se habla dentro del propio gesto del alumno, que es lo
    // que exigen Safari y Chrome para permitir la síntesis de voz.
    lanzar();
  }

  private pronunciar(
    texto: string,
    voz: SpeechSynthesisVoice | null,
    permitirReintento: boolean
  ): void {
    const sintesis = this.sintesisVoz();
    if (!sintesis) return;

    try {
      const frase = new SpeechSynthesisUtterance(texto);
      if (voz) {
        frase.voice = voz;
        frase.lang = voz.lang;
      } else {
        frase.lang = 'es-ES';
      }
      // Valores neutros: las voces naturales suenan mejor sin alterar el tono.
      frase.rate = 1;
      frase.pitch = 1;
      frase.volume = 1;

      frase.onend = () => {
        if (this.utterance === frase) this.utterance = null;
      };
      frase.onerror = (evento) => {
        const eraActual = this.utterance === frase;
        if (eraActual) this.utterance = null;
        // Si la cortamos nosotros (avanzar, silenciar…), no se reintenta.
        if (!eraActual) return;

        const motivo = (evento as SpeechSynthesisErrorEvent).error;
        if (motivo === 'canceled' || motivo === 'interrupted') return;

        // Una voz en línea puede fallar sin red: se reintenta con una local.
        if (permitirReintento && voz && !voz.localService) {
          const local = this.vozEspanolLocal();
          if (local) this.pronunciar(texto, local, false);
        }
      };

      this.utterance = frase;
      sintesis.resume();
      sintesis.speak(frase);
    } catch {
      // Sin voz disponible: el juego sigue funcionando.
    }
  }

  /** Corta la frase en curso y la que esté en espera. */
  detenerVoz(): void {
    if (this.temporizadorVoz !== null) {
      clearTimeout(this.temporizadorVoz);
      this.temporizadorVoz = null;
    }
    this.utterance = null;
    try {
      this.sintesisVoz()?.cancel();
    } catch {
      // Sin voz disponible: nada que detener.
    }
  }

  private sintesisVoz(): SpeechSynthesis | null {
    return typeof window !== 'undefined' && 'speechSynthesis' in window
      ? window.speechSynthesis
      : null;
  }

  /**
   * Elige la voz más natural disponible en español.
   *
   * Los navegadores exponen muchas voces: las neuronales («Natural»/«Neural»
   * de Edge, «Google español» en Chrome) suenan mucho más humanas que las
   * voces SAPI locales, así que se puntúan primero. Si no hay ninguna, se usa
   * la mejor voz local y, como último recurso, la predeterminada del sistema.
   */
  private vozEspanol(): SpeechSynthesisVoice | null {
    const voces = this.voces.length
      ? this.voces
      : (this.sintesisVoz()?.getVoices() ?? []);
    const espanol = voces.filter((v) => v.lang.toLowerCase().startsWith('es'));
    if (!espanol.length) return null;

    const idioma = (typeof navigator !== 'undefined' ? navigator.language : 'es-ES').toLowerCase();

    const puntaje = (voz: SpeechSynthesisVoice): number => {
      const nombre = voz.name.toLowerCase();
      const lang = voz.lang.toLowerCase();
      let s = 0;

      // Calidad de la voz: neuronal > en línea > Google > Microsoft.
      if (/natural|neural/.test(nombre)) s += 1000;
      if (/online|enhanced|premium/.test(nombre)) s += 300;
      if (/google/.test(nombre)) s += 200;
      if (/microsoft/.test(nombre)) s += 100;
      if (/elvira|helena|laura|sabina|pablo|raul|jorge|monica|paulina|marisol|carmen|dalia|luciana|valentina/.test(nombre)) s += 20;

      // Preferir el idioma del navegador y el español latinoamericano.
      if (lang === idioma) s += 50;
      if (/es[-_]419/.test(lang)) s += 10;
      if (/es[-_]es/.test(lang)) s += 5;
      if (voz.localService) s += 1;

      return s;
    };

    return [...espanol].sort((a, b) => puntaje(b) - puntaje(a))[0];
  }

  /** Voz local en español para reintentar cuando falla una voz en línea. */
  private vozEspanolLocal(): SpeechSynthesisVoice | null {
    const voces = this.voces.length
      ? this.voces
      : (this.sintesisVoz()?.getVoices() ?? []);
    return (
      voces.find(
        (v) => v.localService && v.lang.toLowerCase().startsWith('es')
      ) ?? null
    );
  }
}
