import { Pipe, PipeTransform, inject } from "@angular/core";
import { DomSanitizer, SafeUrl } from "@angular/platform-browser";

/**
 * Convierte un string SVG en una URL de imagen (data URI) que Angular acepta en <img [src]>.
 * Se usa solo con SVG generado por nuestro propio código (nunca con texto del usuario).
 * Al ir dentro de <img>, el navegador no ejecuta scripts del SVG.
 *
 * Acepta las dos formas con las que los juegos emiten sus figuras:
 *  - SVG crudo (`<svg …>…</svg>`): se envuelve aquí como data URI.
 *  - Data URI (`data:image/svg+xml;utf8,…`): se deja pasar tal cual (sin re-codificar).
 *
 * Uso:  <img [src]="pregunta.imagen | svgSeguro" alt="Diagrama de Venn" />
 */
@Pipe({ name: "svgSeguro", standalone: true })
export class SvgSeguroPipe implements PipeTransform {
  private readonly sanitizer = inject(DomSanitizer);

  transform(svg: string): SafeUrl {
    const yaEsDataUri = /^data:image\/svg\+xml/i.test(svg);
    const url = yaEsDataUri
      ? svg
      : "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
    return this.sanitizer.bypassSecurityTrustUrl(url);
  }
}
