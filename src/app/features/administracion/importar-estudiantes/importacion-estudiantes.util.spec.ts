import { describe, expect, it } from 'vitest';

import {
  correoDeUsuario,
  extraerCurso,
  extraerParalelo,
  generarPassword,
  parsearCsv,
  procesarFilas,
  slugUsuario
} from './importacion-estudiantes.util';

describe('lectura de la lista de estudiantes', () => {
  it('interpreta el curso en números y palabras', () => {
    expect(extraerCurso('Primero A')).toBe(1);
    expect(extraerCurso('6°')).toBe(6);
    expect(extraerCurso('Tercero')).toBe(3);
    expect(extraerCurso('7')).toBeUndefined();
  });

  it('interpreta el paralelo incluso pegado al curso', () => {
    expect(extraerParalelo('1A')).toBe('A');
    expect(extraerParalelo('paralelo b')).toBe('B');
    expect(extraerParalelo('Primero')).toBeUndefined();
  });

  it('genera un usuario válido a partir del nombre', () => {
    expect(slugUsuario('Juan Pérez')).toBe('juan.perez');
    expect(slugUsuario('  ')).toBe('estudiante');
    expect(correoDeUsuario('Ana Gómez')).toBe('ana.gomez@estudiantes.agilmente.app');
  });

  it('genera contraseñas temporales con el formato esperado', () => {
    expect(generarPassword()).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
  });

  it('procesa filas con cabeceras y valida curso y paralelo', () => {
    const filas = procesarFilas([
      ['Nombre', 'Curso', 'Paralelo', 'Correo'],
      ['Ana Torres', '1', 'A', 'ana@correo.com'],
      ['Luis Pérez', 'Segundo', 'B', ''],
      ['Malo', '7', 'C', '']
    ]);

    expect(filas).toHaveLength(3);
    expect(filas[0]).toMatchObject({
      fila: 2,
      nombre: 'Ana Torres',
      curso: 1,
      paralelo: 'A',
      usuario: 'ana@correo.com',
      correoInterno: 'ana@correo.com',
      valida: true
    });
    expect(filas[1]).toMatchObject({
      nombre: 'Luis Pérez',
      curso: 2,
      paralelo: 'B',
      correoInterno: 'luis.perez@estudiantes.agilmente.app',
      valida: true
    });
    expect(filas[2].valida).toBe(false);
    expect(filas[2].error).toContain('Curso inválido');
    expect(filas[2].error).toContain('Paralelo inválido');
  });

  it('detecta correos duplicados en el archivo', () => {
    const filas = procesarFilas([
      ['Nombre', 'Curso', 'Paralelo', 'Correo'],
      ['Ana', '1', 'A', 'ana@correo.com'],
      ['Otra Ana', '2', 'B', 'ana@correo.com']
    ]);

    expect(filas[0].valida).toBe(true);
    expect(filas[1].valida).toBe(false);
    expect(filas[1].error).toContain('Duplicado');
  });

  it('interpreta curso y paralelo juntos en una sola columna', () => {
    const filas = procesarFilas([
      ['Nombre', 'Curso', 'Correo'],
      ['Ana', '3B', 'ana@correo.com'],
      ['Beto', 'Cuarto A', 'beto@correo.com'],
      ['Sin paralelo', '1', 'beto2@correo.com']
    ]);

    expect(filas[0]).toMatchObject({ curso: 3, paralelo: 'B', valida: true });
    expect(filas[1]).toMatchObject({ curso: 4, paralelo: 'A', valida: true });
    expect(filas[2].paralelo).toBeUndefined();
    expect(filas[2].valida).toBe(false);
  });

  it('crea una fila válida para el formulario de un solo estudiante', () => {
    const filas = procesarFilas([
      ['Nombre', 'Curso', 'Paralelo', 'Correo', 'Usuario', 'Contraseña'],
      ['Ana Torres', '1', 'A', '', '', '']
    ]);

    expect(filas).toHaveLength(1);
    expect(filas[0]).toMatchObject({
      nombre: 'Ana Torres',
      curso: 1,
      paralelo: 'A',
      usuario: 'ana.torres',
      correoInterno: 'ana.torres@estudiantes.agilmente.app',
      valida: true
    });
    expect(filas[0].password).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
  });

  it('asigna el curso seleccionado aunque el archivo traiga otro', () => {
    const filas = procesarFilas(
      [
        ['Nombre', 'Curso', 'Paralelo', 'Correo'],
        ['Ana Torres', '6', 'B', 'ana@correo.com']
      ],
      { curso: 2, paralelo: 'A' }
    );

    expect(filas[0]).toMatchObject({
      nombre: 'Ana Torres',
      curso: 2,
      paralelo: 'A',
      valida: true
    });
  });

  it('importa una lista sin cabeceras ni curso al curso seleccionado', () => {
    const filas = procesarFilas(
      [
        ['Ana Torres', 'ana@correo.com', 'ana.torres', 'CLAVE-123'],
        ['Luis Pérez', '', '', '']
      ],
      { curso: 3, paralelo: 'B' }
    );

    expect(filas[0]).toMatchObject({
      nombre: 'Ana Torres',
      curso: 3,
      paralelo: 'B',
      correoInterno: 'ana@correo.com',
      usuario: 'ana@correo.com',
      password: 'CLAVE-123',
      valida: true
    });
    expect(filas[1]).toMatchObject({
      nombre: 'Luis Pérez',
      curso: 3,
      paralelo: 'B',
      usuario: 'luis.perez',
      correoInterno: 'luis.perez@estudiantes.agilmente.app',
      valida: true
    });
  });

  it('lee CSV con punto y coma y comillas', () => {
    const filas = parsearCsv(
      'Nombre;Curso;Paralelo\r\n"Pérez; Ana";2;B\r\nLuis;3;A'
    );

    expect(filas).toEqual([
      ['Nombre', 'Curso', 'Paralelo'],
      ['Pérez; Ana', '2', 'B'],
      ['Luis', '3', 'A']
    ]);
  });
});
