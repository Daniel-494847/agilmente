import { ActividadResumen } from '@core/models/actividad.model';

/** Única fuente de verdad del catálogo de actividades. */
export const ACTIVIDADES_INICIALES: ActividadResumen[] = [
  {
    id: 1,
    titulo: 'Sucesiones y Patrones',
    descripcion: 'Descubre secuencias y relaciones entre imágenes y números.',
    icono: 'bi-diagram-3',
    imagen: 'images/Sucesiones-y-Patrones.webp',
    colorTema: 'purple',
    ruta: '/razonamiento-logico/sucesiones-patrones'
  },
  {
    id: 2,
    titulo: 'Conteo de Figuras',
    descripcion: 'Cuenta figuras, segmentos, ángulos y triángulos.',
    icono: 'bi-shapes',
    imagen: 'images/Conteo-de-Figuras.webp',
    colorTema: 'green',
    ruta: '/razonamiento-logico/conteo-figuras'
  },
  {
    id: 3,
    titulo: 'Operaciones Básicas',
    descripcion: 'Suma, resta y multiplica resolviendo desafíos con dibujos, por niveles.',
    icono: 'bi-plus-slash-minus',
    imagen: 'images/Operaciones-con-Numeros-Naturales.webp',
    colorTema: 'blue',
    ruta: '/razonamiento-logico/operaciones-basicas'
  },
  {
    id: 4,
    titulo: 'Operadores Matemáticos',
    descripcion: 'Descubre el valor de figuras y símbolos resolviendo ecuaciones y operadores.',
    icono: 'bi-calculator-fill',
    imagen: 'images/Operadores-Matematicos.webp',
    colorTema: 'blue',
    ruta: '/razonamiento-logico/operadores-matematicos'
  },
  {
    id: 5,
    titulo: 'Actividades Mentales',
    descripcion: 'Entrena tu agilidad mental con conteo rápido y comparaciones.',
    icono: 'bi-brain',
    imagen: 'images/agilmente.webp',
    colorTema: 'green',
    ruta: '/razonamiento-logico/actividades-mentales'
  },
  {
    id: 6,
    titulo: 'Geometría Básica',
    descripcion: 'Explora figuras, perímetros y relaciones geométricas.',
    icono: 'bi-triangle',
    imagen: 'images/Geometria-Basica.webp',
    colorTema: 'orange',
    ruta: '/razonamiento-logico/geometria-basica'
  },
  {
    id: 7,
    titulo: 'Conjuntos',
    descripcion: 'Aprende sobre pertenencia, unión e intersección.',
    icono: 'bi-union',
    imagen: 'images/Conjuntos.webp',
    colorTema: 'pink',
    ruta: '/razonamiento-logico/conjuntos'
  },
  {
    id: 8,
    titulo: 'Juegos Lógicos',
    descripcion: 'Resuelve sudokus deduciendo la casilla que falta.',
    icono: 'bi-grid-3x3',
    imagen: 'images/Juegos-Logicos.webp',
    colorTema: 'orange',
    ruta: '/razonamiento-logico/juegos-logicos'
  },
  {
    id: 9,
    titulo: 'Razonamiento Aplicado',
    descripcion: 'Ordena información y resuelve problemas de la vida diaria.',
    icono: 'bi-lightbulb',
    imagen: 'images/Razonamiento-Aplicado.webp',
    colorTema: 'purple',
    ruta: '/razonamiento-logico/razonamiento-aplicado'
  },
  {
    id: 10,
    titulo: 'Seriaciones',
    descripcion: 'Ordena elementos identificando la regla que los relaciona.',
    icono: 'bi-sort-down',
    imagen: 'images/Seriaciones.webp',
    colorTema: 'green',
    ruta: '/razonamiento-logico/seriaciones'
  },
  {
    id: 12,
    titulo: 'Pirámides',
    descripcion: 'Completa pirámides numéricas usando sus relaciones matemáticas.',
    icono: 'bi-triangle',
    imagen: 'images/Piramides.webp',
    colorTema: 'amber',
    ruta: '/razonamiento-logico/piramides'
  },
  {
    id: 15,
    titulo: 'Cuadrados Mágicos',
    descripcion: 'Completa cuadrados donde todas las líneas suman el número mágico.',
    icono: 'bi-grid-3x3-gap',
    imagen: 'images/cuadrados-magicos.webp',
    colorTema: 'purple',
    ruta: '/razonamiento-logico/cuadrados-magicos'
  },
  {
    id: 13,
    titulo: 'Matemáticas Interactivas',
    descripcion: 'Duelos por equipos de sumas, restas, multiplicación, división y más.',
    icono: 'bi-joystick',
    imagen: 'images/matematicas-interactivas.webp',
    colorTema: 'green',
    ruta: '/razonamiento-logico/matematicas-interactivas'
  },
  {
    id: 14,
    titulo: 'Juegos Mentales',
    descripcion: 'Entrena tu agilidad mental sumando y restando números positivos y negativos.',
    icono: 'bi-calculator',
    imagen: 'images/juegos-mentales.webp',
    colorTema: 'pink',
    ruta: '/razonamiento-logico/juegos-mentales'
  },
  {
    id: 16,
    titulo: 'Relaciones y Analogías',
    descripcion: 'Completa analogías numéricas y de figuras descubriendo la regla matemática que las relaciona.',
    icono: 'bi-link-45deg',
    colorTema: 'purple',
    ruta: '/razonamiento-logico/relaciones-analogias'
  }
];

/**
 * Orden de aparición preferido (inicio y listado): primero estos juegos, en
 * este orden. Los juegos que no están en la lista se muestran después,
 * ordenados por `id`.
 */
const ORDEN_DESTACADO = [
  'juegos-mentales',
  'matematicas-interactivas',
  'actividades-mentales',
  'cuadrados-magicos',
  'juegos-logicos',
  'piramides'
];

/** Posición de una actividad en el orden destacado (las no listadas van al final). */
function posicionDestacada(actividad: ActividadResumen): number {
  const slug = actividad.ruta.split('/').filter(Boolean).pop() ?? '';
  const indice = ORDEN_DESTACADO.indexOf(slug);
  return indice === -1 ? ORDEN_DESTACADO.length : indice;
}

/** Comparador para el orden de vitrina del inicio y del listado de actividades. */
export function compararActividades(a: ActividadResumen, b: ActividadResumen): number {
  return posicionDestacada(a) - posicionDestacada(b) || a.id - b.id;
}

/**
 * Funde el catálogo del código (`ACTIVIDADES_INICIALES`) con las fichas que
 * el administrador guarda en Firestore.
 *
 * La identidad de una actividad es su **ruta** (de ahí sale el slug con el que
 * se registran los intentos), no su número. Por eso:
 *  - una ficha con la ruta de una actividad del catálogo la **personaliza**;
 *  - una ficha con una ruta nueva es una **actividad añadida**;
 *  - y una ficha con un id repetido ya no puede «tapar» a otra actividad
 *    (pasó con `actividades/5`, guardada como «Operadores Matemáticos», que
 *    dejaba fuera de la lista a «Actividades Mentales»).
 */
export function fusionarActividades(fichas: ActividadResumen[]): ActividadResumen[] {
  const porRuta = new Map<string, ActividadResumen>();

  for (const ficha of fichas) {
    const ruta = (ficha.ruta ?? '').trim();
    if (!ruta || porRuta.has(ruta)) continue;
    const inicial = ACTIVIDADES_INICIALES.find((a) => a.ruta === ruta);
    porRuta.set(ruta, {
      ...inicial,
      ...ficha,
      id: inicial?.id ?? ficha.id,
      imagen: inicial?.imagen ?? ficha.imagen
    });
  }

  // Las actividades del catálogo que nadie ha personalizado.
  for (const inicial of ACTIVIDADES_INICIALES) {
    if (!porRuta.has(inicial.ruta)) {
      porRuta.set(inicial.ruta, inicial);
    }
  }

  return sinIdsRepetidos([...porRuta.values()].sort(compararActividades));
}

/** Asigna un id libre a las actividades que repiten id (no debería pasar). */
function sinIdsRepetidos(actividades: ActividadResumen[]): ActividadResumen[] {
  const usados = new Set<number>();
  let siguiente = ACTIVIDADES_INICIALES.reduce((max, a) => Math.max(max, a.id), 0) + 1;
  return actividades.map((a) => {
    if (!usados.has(a.id)) {
      usados.add(a.id);
      return a;
    }
    while (usados.has(siguiente)) siguiente++;
    usados.add(siguiente);
    return { ...a, id: siguiente++ };
  });
}

