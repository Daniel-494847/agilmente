import { describe, expect, it } from 'vitest';

import {
  calcularNivelYTitulo,
  claveCurso,
  codigoCurso,
  conCursoAsignado,
  cursosDe,
  esEmailAdministrador,
  nombreCurso,
  normalizarCurso,
  normalizarCursos,
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

  it('codigoCurso devuelve el curso numeral, por ejemplo «5 A»', () => {
    expect(codigoCurso(5, 'A')).toBe('5 A');
    expect(codigoCurso(6, 'B')).toBe('6 B');
    expect(codigoCurso(undefined, 'A')).toBe('');
  });

  it('conCursoAsignado agrega y quita un curso sin tocar los demás', () => {
    const base = [
      { curso: 1, paralelo: 'A' as const },
      { curso: 3, paralelo: 'B' as const }
    ];
    expect(conCursoAsignado(base, 5, 'A', true)).toEqual([
      ...base,
      { curso: 5, paralelo: 'A' }
    ]);
    expect(conCursoAsignado(base, 1, 'A', false)).toEqual([{ curso: 3, paralelo: 'B' }]);
    expect(conCursoAsignado(base, 3, 'B', false)).toEqual([{ curso: 1, paralelo: 'A' }]);
    expect(conCursoAsignado([{ curso: 1, paralelo: 'A' }], 1, 'A', false)).toEqual([]);
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

describe('cursos múltiples (docentes)', () => {
  it('claveCurso arma la clave «curso-paralelo»', () => {
    expect(claveCurso(1, 'A')).toBe('1-A');
    expect(claveCurso(6, 'B')).toBe('6-B');
    expect(claveCurso(undefined, 'A')).toBe('');
  });

  it('normalizarCursos quita inválidos y duplicados', () => {
    expect(
      normalizarCursos([
        { curso: 1, paralelo: 'A' },
        { curso: 1, paralelo: 'A' },
        { curso: 9, paralelo: 'A' },
        { curso: 2, paralelo: 'C' }
      ])
    ).toEqual([{ curso: 1, paralelo: 'A' }]);
  });

  it('cursosDe usa la lista y, si no existe, el curso único', () => {
    expect(cursosDe({ cursos: [{ curso: 2, paralelo: 'B' }] })).toEqual([
      { curso: 2, paralelo: 'B' }
    ]);
    expect(cursosDe({ curso: 4, paralelo: 'A' })).toEqual([{ curso: 4, paralelo: 'A' }]);
    expect(cursosDe({})).toEqual([]);
  });

  it('usuarioPorDefecto guarda los cursos y sus claves', () => {
    const usuario = usuarioPorDefecto({
      email: 'docente@agilmente.com',
      nombreCompleto: 'Docente',
      rol: 'docente',
      cursos: [
        { curso: 2, paralelo: 'A' },
        { curso: 5, paralelo: 'B' }
      ]
    });
    expect(usuario.curso).toBe(2);
    expect(usuario.paralelo).toBe('A');
    expect(usuario.cursosClaves).toEqual(['2-A', '5-B']);
  });

  it('usuarioAdminDesdeDoc lee varios cursos y mantiene el principal', () => {
    const usuario = usuarioAdminDesdeDoc('uid-docente', {
      nombreCompleto: 'Docente',
      email: 'docente@agilmente.com',
      rol: 'docente',
      curso: 1,
      paralelo: 'A',
      cursos: [
        { curso: 1, paralelo: 'A' },
        { curso: 3, paralelo: 'B' }
      ]
    });
    expect(usuario.curso).toBe(1);
    expect(usuario.paralelo).toBe('A');
    expect(usuario.cursos).toEqual([
      { curso: 1, paralelo: 'A' },
      { curso: 3, paralelo: 'B' }
    ]);
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
