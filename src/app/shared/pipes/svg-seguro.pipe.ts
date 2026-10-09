import { Pipe, PipeTransform, inject } from "@angular/core";
import { DomSanitizer, SafeUrl } from "@angular/platform-browser";

/**
 * Convierte un string SVG en una URL de imagen (data URI) que Angular acepta en <img [src]>.
 * Se usa solo con SVG generado por nuestro propio código (nunca con texto del usuario).
 * Al ir dentro de <img>, el navegador no ejecuta scripts del SVG.
 *
 * Uso:  <img [src]="pregunta.grafico | svgSeguro" alt="Diagrama de Venn" />
 */
@Pipe({ name: "svgSeguro", standalone: true })
export class SvgSeguroPipe implements PipeTransform {
  private readonly sanitizer = inject(DomSanitizer);

  transform(svg: string): SafeUrl {
    return this.sanitizer.bypassSecurityTrustUrl(
      "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg),
    );
  }
}
