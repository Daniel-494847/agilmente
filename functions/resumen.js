/**
 * Cálculo del resumen de progreso que se guarda en `usuarios/{uid}.resumen`.
 *
 * Lo usan el trigger `procesarIntentoFinalizado` (incremental) y el script de
 * backfill (recalcula desde todo el historial). Mantener el cálculo en un solo
 * módulo evita que las dos vías se desincronicen.
 */
const admin = require('firebase-admin');

// Puntos por respuesta correcta. Debe coincidir con firestore.rules y con la
// generación de preguntas de cada juego.
const PUNTOS_POR_ACIERTO_NIVEL = [10, 15, 20];
const ACTIVIDADES_PUNTOS_POR_NIVEL = new Set([
  'conjuntos',
  'razonamiento-aplicado',
  'juegos-logicos',
  'piramides',
  'cuadrados-magicos'
]);

/** Puntos que otorga cada respuesta correcta en una actividad y nivel. */
function puntosPorAcierto(actividadId, nivel) {
  const n = Math.max(1, Math.floor(Number(nivel) || 1));
  if (actividadId === 'juegos-mentales') {
    return 10 + n * 5;
  }
  if (ACTIVIDADES_PUNTOS_POR_NIVEL.has(actividadId)) {
    return PUNTOS_POR_ACIERTO_NIVEL[n - 1] || 10;
  }
  return 10;
}

function enteroNoNegativo(valor) {
  return Math.max(0, Math.floor(Number(valor) || 0));
}

function porcentaje(correctas, incorrectas) {
  const total = correctas + incorrectas;
  return total > 0 ? Math.round((correctas / total) * 100) : 0;
}

/** Milisegundos de un Timestamp de Firestore, Date o número. */
function aMillis(fecha) {
  if (!fecha) return 0;
  if (typeof fecha.toMillis === 'function') return fecha.toMillis();
  if (fecha instanceof Date) return fecha.getTime();
  const n = Number(fecha);
  return Number.isFinite(n) ? n : 0;
}

function resumenVacio() {
  return {
    completo: true,
    intentosFinalizados: 0,
    respuestasCorrectas: 0,
    respuestasIncorrectas: 0,
    tiempoTotalSegundos: 0,
    ultimaActividadEn: null,
    actividadMasReciente: '',
    porActividad: {}
  };
}

/**
 * Suma un intento finalizado al resumen. Es idempotente desde fuera: el
 * trigger no la llama dos veces para el mismo intento (`puntosAplicados`).
 */
function sumarAlResumen(actual, intento, puntaje) {
  const base = actual && typeof actual === 'object' ? actual : {};
  const resumen = {
    completo: true,
    intentosFinalizados: enteroNoNegativo(base.intentosFinalizados),
    respuestasCorrectas: enteroNoNegativo(base.respuestasCorrectas),
    respuestasIncorrectas: enteroNoNegativo(base.respuestasIncorrectas),
    tiempoTotalSegundos: enteroNoNegativo(base.tiempoTotalSegundos),
    ultimaActividadEn: base.ultimaActividadEn || null,
    actividadMasReciente: base.actividadMasReciente || '',
    porActividad: { ...(base.porActividad || {}) }
  };

  const actividadId = String(intento.actividadId || '');
  const nivel = Math.max(1, Math.floor(Number(intento.nivel) || 1));
  const correctas = enteroNoNegativo(intento.respuestasCorrectas);
  const incorrectas = enteroNoNegativo(intento.respuestasIncorrectas);
  const segundos = enteroNoNegativo(intento.duracionSegundos);
  const fecha = intento.horaFinalizacion || admin.firestore.Timestamp.now();

  resumen.intentosFinalizados += 1;
  resumen.respuestasCorrectas += correctas;
  resumen.respuestasIncorrectas += incorrectas;
  resumen.tiempoTotalSegundos += segundos;

  if (aMillis(fecha) >= aMillis(resumen.ultimaActividadEn)) {
    resumen.ultimaActividadEn = fecha;
    resumen.actividadMasReciente = actividadId;
  }

  if (actividadId) {
    const previa = resumen.porActividad[actividadId] || {};
    const puntosActividad = enteroNoNegativo(previa.puntos) + enteroNoNegativo(puntaje);
    resumen.porActividad[actividadId] = {
      intentos: enteroNoNegativo(previa.intentos) + 1,
      puntos: puntosActividad,
      mejorPuntaje: Math.max(enteroNoNegativo(previa.mejorPuntaje), enteroNoNegativo(puntaje)),
      respuestasCorrectas: enteroNoNegativo(previa.respuestasCorrectas) + correctas,
      respuestasIncorrectas: enteroNoNegativo(previa.respuestasIncorrectas) + incorrectas,
      mejorPorcentaje: Math.max(enteroNoNegativo(previa.mejorPorcentaje), porcentaje(correctas, incorrectas)),
      mejorNivel: Math.max(enteroNoNegativo(previa.mejorNivel), nivel),
      ultimaEn:
        aMillis(fecha) >= aMillis(previa.ultimaEn) ? fecha : (previa.ultimaEn || fecha)
    };
  }

  return resumen;
}

/** Recalcula el resumen completo de un usuario a partir de sus intentos. */
function construirResumen(intentos) {
  let resumen = resumenVacio();
  for (const intento of intentos) {
    const nivel = Math.max(1, Math.floor(Number(intento.nivel) || 1));
    const correctas = enteroNoNegativo(intento.respuestasCorrectas);
    const puntaje =
      intento.puntaje !== undefined
        ? enteroNoNegativo(intento.puntaje)
        : correctas * puntosPorAcierto(String(intento.actividadId || ''), nivel);
    resumen = sumarAlResumen(resumen, intento, puntaje);
  }
  return resumen;
}

module.exports = {
  puntosPorAcierto,
  enteroNoNegativo,
  sumarAlResumen,
  construirResumen
};
