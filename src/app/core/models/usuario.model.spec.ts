import { describe, expect, it } from 'vitest';

import {
  calcularNivelYTitulo,
  esEmailAdministrador,
  nombreCurso,
  normalizarCurso,
  normalizarParalelo,
  normalizarRol,
  PUNTOS_POR_NIVEL,
  usuarioAdminDesdeDoc,
  usuarioPorDefecto
} from './usuario.model';

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

describe('curso y paralelo', () => {
  it('normaliza cursos válidos de primero a sexto', () => {
    expect(normalizarCurso(1)).toBe(1);
    expect(normalizarCurso('6')).toBe(6);
    expect(normalizarCurso('3')).toBe(3);
  });

  it('rechaza cursos fuera de rango o no numéricos', () => {
    expect(normalizarCurso(0)).toBeUndefined();
    expect(normalizarCurso(7)).toBeUndefined();
    expect(normalizarCurso('primero')).toBeUndefined();
    expect(normalizarCurso(null)).toBeUndefined();
    expect(normalizarCurso(2.5)).toBeUndefined();
  });

  it('normaliza paralelos A y B', () => {
    expect(normalizarParalelo('A')).toBe('A');
    expect(normalizarParalelo(' b ')).toBe('B');
  });

  it('rechaza paralelos inválidos', () => {
    expect(normalizarParalelo('C')).toBeUndefined();
    expect(normalizarParalelo('')).toBeUndefined();
    expect(normalizarParalelo(undefined)).toBeUndefined();
  });

  it('nombreCurso devuelve el texto legible', () => {
    expect(nombreCurso(1, 'A')).toBe('Primero A');
    expect(nombreCurso(6, 'B')).toBe('Sexto B');
    expect(nombreCurso(undefined, 'A')).toBe('');
  });

  it('usuarioPorDefecto guarda curso y paralelo válidos', () => {
    const usuario = usuarioPorDefecto({
      email: 'a@b.com',
      nombreCompleto: 'Ana',
      curso: 3,
      paralelo: 'B'
    });
    expect(usuario.curso).toBe(3);
    expect(usuario.paralelo).toBe('B');
  });

  it('usuarioPorDefecto marca el cambio de contraseña pendiente', () => {
    const usuario = usuarioPorDefecto({
      email: 'a@b.com',
      nombreCompleto: 'Ana',
      debeCambiarPassword: true
    });
    expect(usuario.debeCambiarPassword).toBe(true);
  });

  it('usuarioAdminDesdeDoc lee el cambio de contraseña pendiente', () => {
    const usuario = usuarioAdminDesdeDoc('uid-1', {
      email: 'a@b.com',
      rol: 'estudiante',
      debeCambiarPassword: true
    });
    expect(usuario.debeCambiarPassword).toBe(true);
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

describe('administrador único', () => {
  it('solo reconoce el correo del administrador, sin distinguir mayúsculas', () => {
    expect(esEmailAdministrador('pcdoctorbermejo@gmail.com')).toBe(true);
    expect(esEmailAdministrador('  PCDoctorBermejo@Gmail.com ')).toBe(true);
    expect(esEmailAdministrador('otro@correo.com')).toBe(false);
    expect(esEmailAdministrador('')).toBe(false);
    expect(esEmailAdministrador(null)).toBe(false);
  });
});
