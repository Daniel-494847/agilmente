import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { ActividadResumen, ColorTema } from '@core/models/actividad.model';
import { ActivityCard } from '@shared/components/activity-card/activity-card';
import { SvgSeguroPipe } from '@shared/pipes/svg-seguro.pipe';
import { ActividadesService } from '@features/actividades/services/actividades.service';
import { EjerciciosDocenteService } from './services/ejercicios-docente.service';
import {
  HojaDocente,
  NIVELES_DOCENTE,
  RespuestaDocente,
  TIPOS_ACTIVIDAD_DOCENTE,
  TipoEjercicioDocente
} from './models/ejercicio-docente.model';

/** Mapa colorTema → clases de superficie (el mismo de ActivityCard). */
const TEMA_CLASES: Record<ColorTema, string> = {
  purple: 'bg-primary-subtle border-primary-subtle text-primary',
  green: 'bg-success-subtle border-success-subtle text-success',
  amber: 'bg-warning-subtle border-warning-subtle text-warning',
  blue: 'bg-info-subtle border-info-subtle text-info',
  pink: 'bg-danger-subtle border-danger-subtle text-danger',
  orange: 'bg-warning-subtle border-warning-subtle text-warning-emphasis'
};

/** Mapa colorTema → variante de botón sólido (el mismo de ActivityCard). */
const TEMA_BTN: Record<ColorTema, string> = {
  purple: 'btn-primary',
  green: 'btn-success',
  amber: 'btn-warning',
  blue: 'btn-info',
  pink: 'btn-danger',
  orange: 'btn-warning'
};

/**
 * Módulo Docente: genera hojas de ejercicios (tipo, nivel y cantidad
 * seleccionables) para ver la vista previa y descargarlas en PDF
 * en papel tamaño carta, con encabezado de Ágilmente / Unidad Educativa
 * Oscar Alfaro y espacios para nombre y curso.
 *
 * La página comparte el ESTILO de los 14 juegos: fondo con degradado suave
 * por `data-theme` (cada tipo de ejercicio trae el colorTema de su juego),
 * tarjetas `rounded-4 shadow-sm` y variantes de botones de Bootstrap.
 *
 * No es un juego, por eso no usa la plantilla de quiz: la salida es papel
 * impreso, no una pantalla interactiva.
 */
@Component({
  selector: 'app-docente',
  imports: [RouterLink, SvgSeguroPipe, ActivityCard],
  templateUrl: './docente.html',
  styleUrl: './docente.css'
})
export class Docente implements OnInit {
  private readonly ruta = inject(ActivatedRoute);
  private readonly generador = inject(EjerciciosDocenteService);
  private readonly actividadesService = inject(ActividadesService);

  readonly tipos = TIPOS_ACTIVIDAD_DOCENTE;
  readonly niveles = NIVELES_DOCENTE;
  readonly cantidades = [5, 10, 15, 20];

  /** Catálogo de juegos: cada tarjeta trae «Jugar» y «Compartir». */
  readonly actividades = signal<ActividadResumen[]>([]);

  readonly titulo = signal('Módulo Docente');
  readonly descripcion = signal(
    'Genera ejercicios por nivel e imprímelos en hoja tamaño carta.'
  );

  readonly tipoActividad = signal<TipoEjercicioDocente>('operaciones');
  readonly nivel = signal(1);
  readonly cantidad = signal(10);
  readonly incluirRespuestas = signal(false);

  readonly generado = signal(false);
  readonly hojas = signal<HojaDocente[]>([]);
  readonly respuestas = signal<RespuestaDocente[]>([]);
  /** Mientras se arma el PDF (capturas de la vista previa + jsPDF). */
  readonly exportando = signal(false);

  readonly tipoActual = computed(
    () =>
      TIPOS_ACTIVIDAD_DOCENTE.find((t) => t.id === this.tipoActividad()) ??
      TIPOS_ACTIVIDAD_DOCENTE[0]
  );
  /** Tema de color del JUEGO del que proviene el tipo elegido. */
  readonly tema = computed(() => this.tipoActual().colorTema);
  readonly claseTema = computed(
    () => TEMA_CLASES[this.tema()] ?? TEMA_CLASES.blue
  );
  readonly claseBotonGenerar = computed(
    () => TEMA_BTN[this.tema()] ?? 'btn-primary'
  );
  readonly etiquetaNivel = computed(
    () => NIVELES_DOCENTE.find((n) => n.nivel === this.nivel())?.etiqueta ?? ''
  );
  readonly totalHojas = computed(
    () => this.hojas().length + (this.generado() && this.incluirRespuestas() ? 1 : 0)
  );

  async ngOnInit(): Promise<void> {
    const data = this.ruta.snapshot.data;
    this.titulo.set((data['title'] as string) ?? this.titulo());
    this.descripcion.set((data['description'] as string) ?? this.descripcion());
    this.actividades.set(await this.actividadesService.listarPublicadas());
  }

  seleccionarTipo(ev: Event): void {
    this.tipoActividad.set(
      (ev.target as HTMLSelectElement).value as TipoEjercicioDocente
    );
    this.regenerarSiGenerado();
  }

  seleccionarNivel(ev: Event): void {
    this.nivel.set(Number((ev.target as HTMLSelectElement).value));
    this.regenerarSiGenerado();
  }

  seleccionarCantidad(ev: Event): void {
    this.cantidad.set(Number((ev.target as HTMLSelectElement).value));
    this.regenerarSiGenerado();
  }

  alternarRespuestas(ev: Event): void {
    this.incluirRespuestas.set((ev.target as HTMLInputElement).checked);
  }

  /** Genera (o regenera) las hojas con los datos elegidos. */
  generar(interactivo = true): void {
    const tipo = this.tipoActual();
    const ejercicios = this.generador.generar(tipo.id, this.nivel(), this.cantidad());

    // Reparte los ejercicios en hojas completas, sin dejar huecos grandes.
    const paginas = Math.max(1, Math.ceil(ejercicios.length / tipo.porHoja));
    const porHoja = Math.ceil(ejercicios.length / paginas);
    const hojas: HojaDocente[] = [];
    for (let p = 0; p < paginas; p++) {
      const rebanada = ejercicios.slice(p * porHoja, (p + 1) * porHoja);
      if (rebanada.length === 0) break;
      hojas.push({ indice: p + 1, inicio: p * porHoja + 1, ejercicios: rebanada });
    }

    this.hojas.set(hojas);
    this.respuestas.set(
      ejercicios.map((e, idx) => ({ numero: idx + 1, texto: e.respuesta }))
    );
    this.generado.set(true);

    if (interactivo) {
      requestAnimationFrame(() =>
        document
          .getElementById('vista-previa')
          ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      );
    }
  }

  /**
   * Descarga el cuadernillo como PDF carta, una página por hoja, con la
   * vista previa tal cual se ve en pantalla: cada `<article>` de la vista
   * previa se captura con html-to-image (texto, figuras, marco y logo
   * incluidos) y se coloca en una página Letter con jsPDF. Ambas librerías se
   * cargan bajo demanda para no engordar el bundle inicial.
   *
   * Se captura a JPEG (calidad 0.93, 2×): con PNG, jsPDF recodifica el canal
   * alfa de cada captura y un cuadernillo de 3 hojas salía de ~28 MB; en JPEG
   * pesa ~1 MB manteniendo la nitidez.
   *
   * La captura no se modifica (mismo ancho, mismo marco y mismos saltos de
   * línea que la vista previa); solo se coloca dentro de un área útil de 1 cm
   * (el mismo margen que `@page` en la impresión del navegador), escala
   * "contain" y se centra. Sin ese margen la hoja quedaba pegada al borde del
   * papel y el encabezado se recortaba con la zona no imprimible.
   */
  async descargarPdf(): Promise<void> {
    if (!this.generado() || this.exportando()) return;
    this.exportando.set(true);
    try {
      const [{ toJpeg }, { jsPDF }] = await Promise.all([
        import('html-to-image'),
        import('jspdf')
      ]);

      const nodos = [
        ...document.querySelectorAll<HTMLElement>('#vista-previa article')
      ];
      if (nodos.length === 0) return;

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'pt',
        format: 'letter'
      });
      const anchoPagina = pdf.internal.pageSize.getWidth();
      const altoPagina = pdf.internal.pageSize.getHeight();
      // 1 cm = 28.35 pt: el mismo margen que la regla `@page` de la impresión.
      const margen = 28.35;
      const anchoUtil = anchoPagina - margen * 2;
      const altoUtil = altoPagina - margen * 2;

      for (let i = 0; i < nodos.length; i++) {
        const captura = await toJpeg(nodos[i], {
          backgroundColor: '#ffffff',
          pixelRatio: 2,
          quality: 0.93
        });
        const caja = nodos[i].getBoundingClientRect();
        if (!caja.width || !caja.height) continue;
        // Escala "contain" dentro del área útil: la hoja entra completa y,
        // si sobra alto (hojas con menos ejercicios), queda centrada.
        const escala = Math.min(anchoUtil / caja.width, altoUtil / caja.height);
        const ancho = caja.width * escala;
        const alto = caja.height * escala;
        if (i > 0) pdf.addPage();
        pdf.addImage(
          captura,
          'JPEG',
          margen + (anchoUtil - ancho) / 2,
          margen + (altoUtil - alto) / 2,
          ancho,
          alto
        );
      }

      pdf.save(
        `ejercicios-agilmente-${this.tipoActividad()}-nivel-${this.nivel()}.pdf`
      );
    } finally {
      this.exportando.set(false);
    }
  }

  private regenerarSiGenerado(): void {
    if (this.generado()) this.generar(false);
  }
}
