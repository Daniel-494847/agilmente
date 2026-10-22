import { describe, expect, it } from 'vitest';

import { ActividadResumen } from '@core/models/actividad.model';
import { ACTIVIDADES_INICIALES, fusionarActividades } from './actividades.data';

/** Ficha guardada en Firestore desde el panel de administración. */
function ficha(id: number, ruta: string, titulo: string): ActividadResumen {
  return {
    id,
    titulo,
    descripcion: `${titulo} (editado)`,
    icono: 'bi-lightbulb',
    colorTema: 'blue',
    ruta
  };
}

describe('Catálogo de actividades: fusión con lo guardado en Firestore', () => {
  it('el catálogo del código está completo', () => {
    expect(ACTIVIDADES_INICIALES).toHaveLength(15);
    expect(ACTIVIDADES_INICIALES.map((a) => a.ruta)).toContain('/razonamiento-logico/actividades-mentales');
  });

  it('una ficha con un id repetido NO tapa a otra actividad del catálogo', () => {
    // Caso real: `actividades/5` estaba guardado como «Operadores Matemáticos»
    // y dejaba fuera de la lista a «Actividades Mentales».
    const lista = fusionarActividades([
      ficha(5, '/razonamiento-logico/operadores-matematicos', 'Operadores Matemáticos')
    ]);

    const rutas = lista.map((a) => a.ruta);
    expect(rutas).toContain('/razonamiento-logico/actividades-mentales');
    expect(rutas).toContain('/razonamiento-logico/operadores-matematicos');
    // Ninguna ruta repetida y ninguna actividad perdida.
    expect(new Set(rutas).size).toBe(rutas.length);
    expect(lista).toHaveLength(15);
  });

  it('la ficha con la misma ruta personaliza la actividad del catálogo', () => {
    const lista = fusionarActividades([ficha(7, '/razonamiento-logico/conjuntos', 'Conjuntos del aula')]);
    const conjuntos = lista.find((a) => a.ruta === '/razonamiento-logico/conjuntos');

    expect(conjuntos?.titulo).toBe('Conjuntos del aula');
    expect(conjuntos?.descripcion).toBe('Conjuntos del aula (editado)');
    // La imagen del catálogo no se deja pisar.
    expect(conjuntos?.imagen).toBeTruthy();
  });

  it('una ficha con ruta nueva aparece como actividad adicional', () => {
    const lista = fusionarActividades([ficha(900, '/razonamiento-logico/mi-juego-nuevo', 'Mi juego nuevo')]);
    expect(lista.map((a) => a.ruta)).toContain('/razonamiento-logico/mi-juego-nuevo');
    expect(lista).toHaveLength(16);
  });

  it('las fichas con la misma ruta se funden en una sola actividad', () => {
    const lista = fusionarActividades([
      ficha(5, '/razonamiento-logico/actividades-mentales', 'Actividades Mentales'),
      ficha(77, '/razonamiento-logico/actividades-mentales', 'Actividades Mentales vieja')
    ]);
    const rutas = lista.map((a) => a.ruta);
    expect(rutas.filter((r) => r === '/razonamiento-logico/actividades-mentales')).toHaveLength(1);
    expect(lista).toHaveLength(15);
  });

  it('sin fichas sale el catálogo del código tal cual', () => {
    const lista = fusionarActividades([]);
    expect(lista).toHaveLength(15);
    expect(lista.map((a) => a.ruta)).toContain('/razonamiento-logico/actividades-mentales');
  });

  it('ninguna actividad se queda sin id y no se repiten', () => {
    const lista = fusionarActividades([ficha(5, '/razonamiento-logico/otro-juego', 'Otro juego')]);
    const ids = lista.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((id) => typeof id === 'number')).toBe(true);
  });
});
