import { describe, expect, it } from 'vitest';

import { EJERCICIOS, TipoEjercicio } from './actividades-mentales.data';

/**
 * El banco de «Actividades Mentales» alimenta un quiz: si un ejercicio se
 * rompe (opciones duplicadas, respuesta correcta que no está entre las
 * opciones, dibujo que no es un SVG), el alumno ve una pregunta sin sentido.
 * Estos checks vigilan justo eso.
 */
describe('Actividades Mentales (banco de ejercicios)', () => {
  const porNivel = (nivel: number) => EJERCICIOS.filter((e) => e.nivel === nivel);

  it('tiene 8 ejercicios en cada uno de los 3 niveles', () => {
    expect(EJERCICIOS).toHaveLength(24);
    expect(porNivel(1)).toHaveLength(8);
    expect(porNivel(2)).toHaveLength(8);
    expect(porNivel(3)).toHaveLength(8);
  });

  it('todos los ids son únicos', () => {
    const ids = EJERCICIOS.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('cada ejercicio ofrece 4 opciones distintas', () => {
    for (const e of EJERCICIOS) {
      expect(e.opciones, e.id).toHaveLength(4);
      expect(new Set(e.opciones).size, e.id).toBe(4);
    }
  });

  it('la respuesta correcta está siempre entre las opciones', () => {
    for (const e of EJERCICIOS) {
      expect(e.opciones, e.id).toContain(e.correcta);
    }
  });

  it('la respuesta correcta NO cae siempre en la primera opción', () => {
    // Regresión: antes el acierto estaba siempre en el botón A y se podía
    // acertar sin calcular. Ahora la posición tiene que estar repartida.
    const posiciones = EJERCICIOS.map((e) => e.opciones.indexOf(e.correcta));
    expect(posiciones.every((p) => p === 0)).toBe(false);
    expect(new Set(posiciones).size).toBe(4);
  });

  it('cada nivel trabaja los tipos prometidos', () => {
    const tipos: TipoEjercicio[] = ['conteo', 'comparacion'];
    for (const nivel of [1, 2, 3]) {
      const delNivel = new Set(porNivel(nivel).map((e) => e.tipo));
      for (const tipo of tipos) {
        expect(delNivel.has(tipo), `nivel ${nivel} sin ${tipo}`).toBe(true);
      }
    }
  });

  it('los ejercicios con dibujo usan un SVG válido y los de texto no', () => {
    for (const e of EJERCICIOS) {
      if (e.tipo === 'conteo') {
        expect(e.imagen, e.id).toBeTruthy();
        expect(e.imagen!.startsWith('data:image/svg+xml;utf8,')).toBe(true);
        expect(decodeURIComponent(e.imagen!)).toContain('<svg');
      } else {
        expect(e.imagen, e.id).toBeUndefined();
      }
    }
  });

  it('cada ejercicio explica la respuesta', () => {
    for (const e of EJERCICIOS) {
      expect(e.explicacion.trim().length, e.id).toBeGreaterThan(5);
      expect(e.enunciado.trim().length, e.id).toBeGreaterThan(5);
    }
  });
});
