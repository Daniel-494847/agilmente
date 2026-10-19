import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import { ColorTema } from '@core/models/actividad.model';
import { SvgSeguroPipe } from '@shared/pipes/svg-seguro.pipe';
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
 * Estilos del archivo .doc de Word. Word (a diferencia del navegador) solo
 * entiende un subconjunto de CSS, así que aquí va lo mínimo: tamaño de hoja
 * carta con márgenes y tipografía. El salto entre hojas NO se declara con
 * `page-break-*` en una clase: Word lo aplicaría a cada párrafo del documento
 * y el cuadernillo saldría con un ejercicio por página. El salto se inserta
 * con SALTO_PAGINA_WORD, que es el idioma que Word mismo escribe al guardar.
 *
 * Los márgenes de 1 cm arriba y abajo dejan un área útil de 792 − 28.35 −
 * 28.35 = 735.29 pt, que es la que usan las alturas de fila de `hojaWord`
 * para anclar el pie a 1 cm del borde inferior (verificado exportando el .doc
 * a PDF y midiendo la posición real del pie en las tres páginas).
 */
const ESTILOS_WORD = `
  @page WordSection1 { size: 21.59cm 27.94cm; margin: 1cm 1.4cm 1cm 1.4cm; }
  div.WordSection1 { page: WordSection1; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 12pt; color: #111; }
`;

/**
 * Salto de página entre hojas, tal y como Word lo escribe al guardar HTML
 * filtrado (`<br clear=all style='page-break-before:always'>` envuelto en un
 * span + párrafo vacío). Es la única forma en la que el importador de Word
 * respeta el salto: verificado abriendo el .doc en Word y exportándolo a PDF
 * (una página por hoja; con `page-break-after` en CSS salían 9 páginas).
 *
 * El párrafo separador va a 1 pt (no a 8 pt): cae al inicio de la página
 * siguiente y consume ~1.2 pt del alto disponible de las hojas 2+; con 8 pt
 * las tablas de altura fija desbordaban y el pie se iba a otra página.
 */
const SALTO_PAGINA_WORD = `<span style='font-size:12.0pt;font-family:"Arial",sans-serif'><br clear=all style='page-break-before:always'></span>

<p style="margin-top:0cm;margin-bottom:0cm;font-size:1pt;line-height:1pt">&nbsp;</p>`;

/**
 * Módulo Docente: genera hojas de ejercicios (tipo, nivel y cantidad
 * seleccionables) para ver la vista previa y descargarlas en PDF o en Word
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
  imports: [SvgSeguroPipe],
  templateUrl: './docente.html',
  styleUrl: './docente.css'
})
export class Docente implements OnInit {
  private readonly ruta = inject(ActivatedRoute);
  private readonly generador = inject(EjerciciosDocenteService);

  readonly tipos = TIPOS_ACTIVIDAD_DOCENTE;
  readonly niveles = NIVELES_DOCENTE;
  readonly cantidades = [5, 10, 15, 20];

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

  ngOnInit(): void {
    const data = this.ruta.snapshot.data;
    this.titulo.set((data['title'] as string) ?? this.titulo());
    this.descripcion.set((data['description'] as string) ?? this.descripcion());
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
   * previa se captura con html-to-image (texto, figuras y logo incluidos) y
   * se coloca en una página Letter con jsPDF. Ambas librerías se cargan bajo
   * demanda para no engordar el bundle inicial.
   *
   * Se captura a JPEG (calidad 0.93, 2×): con PNG, jsPDF recodifica el canal
   * alfa de cada captura y un cuadernillo de 3 hojas salía de ~28 MB; en JPEG
   * pesa ~1 MB manteniendo la nitidez.
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

      for (let i = 0; i < nodos.length; i++) {
        const captura = await toJpeg(nodos[i], {
          backgroundColor: '#ffffff',
          pixelRatio: 2,
          quality: 0.93
        });
        const caja = nodos[i].getBoundingClientRect();
        if (!caja.width || !caja.height) continue;
        // Escala "contain": la hoja entra completa en la carta y, si sobra
        // alto (hojas con menos ejercicios), queda centrada.
        const escala = Math.min(anchoPagina / caja.width, altoPagina / caja.height);
        const ancho = caja.width * escala;
        const alto = caja.height * escala;
        if (i > 0) pdf.addPage();
        pdf.addImage(
          captura,
          'JPEG',
          (anchoPagina - ancho) / 2,
          (altoPagina - alto) / 2,
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

  /**
   * Descarga el cuadernillo como archivo de Word (.doc): el mismo HTML pero
   * con los namespaces MSO y la hoja carta configurada, que Word interpreta
   * al abrirlo. Las figuras SVG (y el logo WebP) se rasterizan a PNG antes,
   * porque Word no sabe dibujarlos.
   */
  async descargarWord(): Promise<void> {
    if (!this.generado()) return;

    // Logo con tope de píxeles: sin él, el WebP de 1254² se convertía en un
    // PNG de 5 MB repetido en cada hoja (archivo de ~50 MB y cargas lentas).
    const logo = await this.rasterizar('images/agilmente.webp', 2, 168);
    const total = this.totalHojas();

    const secciones: { cuerpo: string; indice: number; extra?: string }[] = [];
    for (const hoja of this.hojas()) {
      const items: string[] = [];
      for (const e of hoja.ejercicios) {
        let imagen = '';
        if (e.imagen) {
          const png = await this.rasterizar(e.imagen);
          if (png) {
            // En pantalla la imagen llega a 85 × 38 mm, pero Word apila
            // texto e imagen dentro de cada <li>: aquí se limita a 78 × 32 mm
            // para que las 5 filas de la hoja siempre quepan en la carta.
            const factor = Math.min(78 * 3.78 / png.ancho, 32 * 3.78 / png.alto, 1.5);
            const w = Math.round(png.ancho * factor);
            const h = Math.round(png.alto * factor);
            // Centrada bajo el enunciado, igual que en la vista previa.
            imagen = `<div align="center" style="margin-top: 2pt"><img src="${png.data}" width="${w}" height="${h}" alt="${this.escapar(e.enunciado)}" /></div>`;
          }
        }
        items.push(`<li style="margin-bottom: 4pt">${this.escapar(e.enunciado)}${imagen}</li>`);
      }
      secciones.push({
        cuerpo: `<ol start="${hoja.inicio}" style="margin-left: 18pt; line-height: 1.6">${items.join('')}</ol>`,
        indice: hoja.indice
      });
    }

    if (this.incluirRespuestas() && this.respuestas().length > 0) {
      secciones.push({
        cuerpo: this.respuestasWord(),
        indice: total,
        extra: `Hoja de respuestas — ${this.tipoActual().nombre} · Nivel ${this.nivel()} (${this.etiquetaNivel()})`
      });
    }

    // Alturas de la fila de contenido, verificadas en Word (área útil de
    // 735.29 pt = carta 792pt − 1cm arriba − 1cm abajo):
    //   · primera hoja de varias: 717 pt (sin párrafo de salto encima)
    //   · hojas intermedias:      715 pt (llevan el separador de 1.2 pt)
    //   · última hoja (y única):  714/715 pt — deja sitio al párrafo final
    //     de ~1.2 pt que Word exige tras una tabla final; sin él Word crea
    //     un párrafo de 13.8 pt y se genera una página en blanco.
    // La fila de pie son 18 pt más y así el pie queda a 1.01–1.08 cm del
    // borde inferior en TODA configuración (tipo, nivel, cantidad, con o sin
    // hoja de respuestas). Si un contenido superara la fila, Word la estira
    // (regla AtLeast) y el texto nunca se recorta.
    const ultima = secciones.length - 1;
    const htmlHojas = secciones.map((s, i) =>
      this.hojaWord(
        s.cuerpo,
        s.indice,
        total,
        logo,
        s.extra,
        secciones.length === 1 ? 715 : i === 0 ? 717 : i === ultima ? 714 : 715
      )
    );

    const html = `<!doctype html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="utf-8" />
<title>Ejercicios Ágilmente — ${this.tipoActual().nombre} (Nivel ${this.nivel()})</title>
<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom></w:WordDocument></xml><![endif]-->
<style>
${ESTILOS_WORD}
</style>
</head>
<body>
<div class="WordSection1">
${htmlHojas.join('\n' + SALTO_PAGINA_WORD + '\n')}
<p style="margin-top:0cm;margin-bottom:0cm;font-size:1pt;line-height:1pt">&nbsp;</p>
</div>
</body>
</html>`;

    // El BOM (\ufeff) ayuda a Word a detectar la codificación UTF-8.
    this.descargarArchivo(
      '\ufeff' + html,
      'application/msword;charset=utf-8',
      `ejercicios-agilmente-${this.tipoActividad()}-nivel-${this.nivel()}.doc`
    );
  }

  /** Cuerpo de la hoja de respuestas: dos columnas de lista numerada. */
  private respuestasWord(): string {
    const resp = this.respuestas();
    const mitad = Math.ceil(resp.length / 2);
    const lista = (desde: number, hasta: number): string =>
      `<ol start="${desde + 1}" style="margin-left: 18pt; line-height: 1.9">${resp
        .slice(desde, hasta)
        .map((r) => `<li>${this.escapar(r.texto)}</li>`)
        .join('')}</ol>`;
    return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr>
<td width="50%" valign="top">${lista(0, mitad)}</td>
<td width="50%" valign="top">${lista(mitad, resp.length)}</td>
</tr></table>`;
  }

  /**
   * Encabezado + cuerpo + pie de una hoja del cuadernillo Word, como tabla de
   * dos filas con la altura escrita como la escribe Word (`height:…pt` en
   * `<tr>` y `<td>`, sin `mso-height-rule` = AtLeast): la fila de contenido
   * arriba y la de pie abajo (`valign="bottom"`), de modo que el pie queda
   * anclado a ~1 cm del borde inferior de la página aunque la hoja esté casi
   * vacía — idéntico a la vista previa. `hContenido` es la altura de la fila
   * de contenido calculada según la posición de la hoja (ver `descargarWord`).
   */
  private hojaWord(
    contenido: string,
    indice: number,
    total: number,
    logo: { data: string } | null,
    encabezadoExtra: string | undefined,
    hContenido: number
  ): string {
    const marcaLogo = logo
      ? `<img src="${logo.data}" width="42" height="42" alt="" style="vertical-align: middle; margin-right: 6pt" />`
      : '';
    const pie = `<p style="margin:0; border-top:0.5pt solid #6c757d; padding-top:4pt; text-align:center; color:#6c757d; font-size:9pt">Ágilmente · Unidad Educativa Oscar Alfaro — Hoja ${indice} de ${total}</p>`;
    return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse">
<tr style='height:${hContenido}pt'>
<td valign="top" style="padding:0;height:${hContenido}pt">
<table role="presentation" width="100%" cellspacing="0" cellpadding="4" style="border-collapse: collapse; border-bottom: 2pt solid #111111">
<tr>
<td style="vertical-align: middle">${marcaLogo}<span style="vertical-align: middle; font-weight: bold">ÁGILMENTE</span><br /><span style="color: #666666; font-size: 9pt">Aprendo, pienso y resuelvo</span></td>
<td align="right" style="vertical-align: middle; font-weight: bold; text-transform: uppercase">Unidad Educativa<br />Oscar Alfaro</td>
</tr>
</table>
${
  encabezadoExtra
    ? `<h2 style="font-size: 12pt; margin: 12pt 0 4pt">${encabezadoExtra}</h2>`
    : `<p style="margin: 10pt 0 2pt"><b>Nombre y Apellido:</b> ______________________________________&nbsp;&nbsp;&nbsp;<b>Curso:</b> ______________</p>
<p style="margin: 0 0 8pt; color: #555555"><b>Actividad:</b> ${this.tipoActual().nombre} · <b>Nivel:</b> ${this.nivel()} — ${this.etiquetaNivel()}</p>`
}
${contenido}
</td>
</tr>
<tr style='height:18pt'>
<td valign="bottom" style="padding:0;height:18pt">${pie}</td>
</tr>
</table>`;
  }

  /**
   * Rasteriza un SVG (o cualquier imagen, p. ej. el logo WebP) a un PNG embebido.
   * Word no entiende SVG ni WebP, así que la única forma de llevar las figuras
   * al .doc es pasarlas por un canvas. `topePx` limita el tamaño final (el logo
   * nació de 2508 × 2508 y pesaba 5 MB por hoja). Devuelve null si no se puede
   * convertir (el ejercicio se imprime entonces solo con su enunciado).
   *
   * Se espera el evento `load` y no `img.decode()`: decode() puede rechazar
   * (o quedar colgado sin resolver) según el navegador, y entonces no llegaba
   * ni el logo ni las figuras — el .doc salía solo con texto.
   */
  private async rasterizar(
    fuente: string,
    escala = 2,
    topePx = 0
  ): Promise<{ data: string; ancho: number; alto: number } | null> {
    try {
      const esSvgCrudo = /^\s*<svg/i.test(fuente);
      const img = new Image();
      await new Promise<void>((resolver, rechazar) => {
        img.onload = () => resolver();
        img.onerror = () => rechazar(new Error('imagen no disponible'));
        img.src = esSvgCrudo
          ? 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(fuente)
          : fuente;
      });
      // Los SVG de los juegos salen como data URI percent-encoded y con
      // viewBox de 4 valores (a veces con origen negativo, por recortes):
      // se decodifica y se leen el ancho y el alto reales (3.º y 4.º valor).
      let texto = fuente;
      if (!esSvgCrudo && fuente.startsWith('data:')) {
        try {
          texto = decodeURIComponent(fuente.slice(fuente.indexOf(',') + 1));
        } catch {
          texto = fuente;
        }
      }
      const vb = /viewBox\s*=\s*"([-\d.]+)[\s,]+([-\d.]+)[\s,]+([-\d.]+)[\s,]+([-\d.]+)"/.exec(
        texto
      );
      const ancho = vb ? Number(vb[3]) : img.naturalWidth;
      const alto = vb ? Number(vb[4]) : img.naturalHeight;
      if (!ancho || !alto) return null;
      // Tope de píxeles: reduce la escala para que el lado mayor no lo supere.
      let factor = escala;
      if (topePx > 0) factor = Math.min(factor, topePx / Math.max(ancho, alto));
      if (factor <= 0) factor = 1;
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(ancho * factor));
      canvas.height = Math.max(1, Math.round(alto * factor));
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      return { data: canvas.toDataURL('image/png'), ancho, alto };
    } catch {
      return null;
    }
  }

  /** Escapa texto para insertarlo dentro del HTML de Word. */
  private escapar(texto: string): string {
    return texto.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /** Dispara la descarga de un archivo con el nombre y tipo indicados. */
  private descargarArchivo(contenido: string, tipo: string, nombre: string): void {
    const blob = new Blob([contenido], { type: tipo });
    const url = URL.createObjectURL(blob);
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = nombre;
    enlace.style.display = 'none';
    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();
    // Revocar tarde: revocar justo después del click aborta la descarga
    // en algunos navegadores (el archivo salía en 0 bytes).
    window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
  }

  private regenerarSiGenerado(): void {
    if (this.generado()) this.generar(false);
  }
}
