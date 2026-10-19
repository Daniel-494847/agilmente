import { describe, expect, it } from 'vitest';

import { calcularNivelYTitulo, normalizarRol, PUNTOS_POR_NIVEL } from './usuario.model';

describe('calcularNivelYTitulo', () => {
  it('0 puntos → nivel 1, Explorador', () => {
    expect(calcularNivelYTitulo(0)).toEqual({ nivel: 1, tituloNivel: 'Explorador' });
  });

  it('100 puntos → nivel 2, Explorador', () => {
    expect(calcularNivelYTitulo(100)).toEqual({ nivel: 2, tituloNivel: 'Explorador' });
  });

  it('200 puntos → nivel 3, Aprendiz', () => {
    expect(calcularNivelYTitulo(200)).toEqual({ nivel: 3, tituloNivel: 'Aprendiz' });
  });

  it('valores negativos o NaN se tratan como 0', () => {
    expect(calcularNivelYTitulo(-50)).toEqual({ nivel: 1, tituloNivel: 'Explorador' });
    expect(calcularNivelYTitulo(NaN)).toEqual({ nivel: 1, tituloNivel: 'Explorador' });
  });

  it('PUNTOS_POR_NIVEL es 100', () => {
    expect(PUNTOS_POR_NIVEL).toBe(100);
  });
});

describe('normalizarRol', () => {
  it('normaliza roles válidos', () => {
    expect(normalizarRol('administrador')).toBe('administrador');
    expect(normalizarRol('Docente')).toBe('docente');
    expect(normalizarRol('  ESTUDIANTE  ')).toBe('estudiante');
  });

  it('valores inválidos → estudiante', () => {
    expect(normalizarRol(null)).toBe('estudiante');
    expect(normalizarRol(undefined)).toBe('estudiante');
    expect(normalizarRol('superadmin')).toBe('estudiante');
    expect(normalizarRol(123)).toBe('estudiante');
  });
});
