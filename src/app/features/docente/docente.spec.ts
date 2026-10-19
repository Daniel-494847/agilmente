import { describe, expect, it } from 'vitest';

import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { Docente } from './docente';

/** Monta el módulo Docente dentro de su ruta y devuelve el arnés de pruebas. */
async function montar(): Promise<RouterTestingHarness> {
  TestBed.configureTestingModule({
    providers: [provideRouter([{ path: 'docente', component: Docente }])]
  });
  return RouterTestingHarness.create('/docente');
}

describe('Módulo Docente (vista)', () => {
  it('el selector de cantidad muestra la cantidad que se pide generar', async () => {
    const harness = await montar();
    const select = harness.routeNativeElement?.querySelector(
      '#doc-cantidad'
    ) as HTMLSelectElement;
    expect(select).toBeTruthy();
    // La casilla visible debe coincidir con la cantidad por defecto (10).
    expect(select.value).toBe('10');
  });

  it('genera exactamente la cantidad que el docente selecciona', async () => {
    const harness = await montar();
    const docente = harness.routeNativeElement as HTMLElement;

    for (const cantidad of ['5', '15']) {
      const select = docente.querySelector('#doc-cantidad') as HTMLSelectElement;
      select.value = cantidad;
      select.dispatchEvent(new Event('change'));

      const boton = [...docente.querySelectorAll('button')].find((b) =>
        b.textContent?.includes('Generar ejercicios')
      )!;
      boton.click();
      harness.detectChanges();

      const enunciados = docente.querySelectorAll('#vista-previa > article ol > li');
      expect(enunciados.length, `cantidad ${cantidad}`).toBe(Number(cantidad));
      expect(select.value).toBe(cantidad);
    }
  });

  it('los tres selectores muestran la opción que se va a usar', async () => {
    const harness = await montar();
    const docente = harness.routeNativeElement as HTMLElement;
    const tipo = docente.querySelector('#doc-tipo') as HTMLSelectElement;
    const nivel = docente.querySelector('#doc-nivel') as HTMLSelectElement;
    const cantidad = docente.querySelector('#doc-cantidad') as HTMLSelectElement;

    // Deben reflejar los valores por defecto de las señales, no la 1.ª opción.
    expect(tipo.value).toBe('operaciones');
    expect(nivel.value).toBe('1');
    expect(cantidad.value).toBe('10');

    // Y seguir reflejándolas tras cambiar de opción.
    tipo.value = 'sucesiones';
    tipo.dispatchEvent(new Event('change'));
    harness.detectChanges();
    expect(tipo.value).toBe('sucesiones');
  });

  it('ofrece Descargar PDF y Descargar Word, sin HTML ni impresión', async () => {
    const harness = await montar();
    const docente = harness.routeNativeElement as HTMLElement;

    const generar = [...docente.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('Generar ejercicios')
    )!;
    generar.click();
    harness.detectChanges();

    const textos = [...docente.querySelectorAll('button')].map((b) =>
      b.textContent?.replace(/\s+/g, ' ').trim() ?? ''
    );
    expect(textos.some((t) => t.includes('Descargar PDF'))).toBe(true);
    expect(textos.some((t) => t.includes('Descargar Word'))).toBe(true);
    expect(textos.some((t) => t.includes('Descargar HTML'))).toBe(false);
    expect(textos.some((t) => t.includes('Imprimir'))).toBe(false);
  });
});
