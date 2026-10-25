const crypto = require('crypto');
const admin = require('firebase-admin');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onDocumentUpdated } = require('firebase-functions/v2/firestore');
const { puntosPorAcierto, enteroNoNegativo, sumarAlResumen } = require('./resumen');

admin.initializeApp();

const ADMIN_EMAIL = 'pcdoctorbermejo@gmail.com';
const COLECCION_USUARIOS = 'usuarios';
const COLECCION_INTENTOS = 'intentos';
const ALFABETO_TEMPORAL = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const LONGITUD_TEMPORAL = 10;
const LONGITUD_MINIMA = 8;

// Progreso del usuario: debe coincidir con `calcularNivelYTitulo` del cliente.
const PUNTOS_POR_NIVEL_USUARIO = 100;
const TITULOS_NIVEL = [
  { minNivel: 1, titulo: 'Explorador' },
  { minNivel: 3, titulo: 'Aprendiz' },
  { minNivel: 5, titulo: 'Pensador' },
  { minNivel: 8, titulo: 'Estratega' },
  { minNivel: 12, titulo: 'Maestro lógico' },
  { minNivel: 20, titulo: 'Leyenda' }
];

// Puntos por respuesta correcta: ver `resumen.js` (compartido con el backfill).

/** Nivel y título que corresponden a una cantidad de puntos. */
function calcularNivelYTitulo(puntos) {
  const seguros = Math.max(0, Math.floor(Number(puntos) || 0));
  const nivel = Math.max(1, Math.floor(seguros / PUNTOS_POR_NIVEL_USUARIO) + 1);
  let tituloNivel = TITULOS_NIVEL[0].titulo;
  for (const t of TITULOS_NIVEL) {
    if (nivel >= t.minNivel) {
      tituloNivel = t.titulo;
    }
  }
  return { nivel, tituloNivel };
}

/** `true` si el correo es el del administrador único. */
function esCorreoAdministrador(email) {
  return String(email || '').trim().toLowerCase() === ADMIN_EMAIL;
}

/** Contraseña temporal legible, sin caracteres ambiguos. */
function generarPasswordTemporal() {
  let password = '';
  for (let i = 0; i < LONGITUD_TEMPORAL; i += 1) {
    password += ALFABETO_TEMPORAL[crypto.randomInt(ALFABETO_TEMPORAL.length)];
  }
  return password;
}

/** Exige que quien llama sea el administrador único y tenga su perfil. */
async function exigirAdministrador(request) {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Inicia sesión como administrador.');
  }
  if (!esCorreoAdministrador(request.auth.token.email)) {
    throw new HttpsError('permission-denied', 'Solo el administrador puede hacer esto.');
  }

  const perfil = await admin
    .firestore()
    .doc(`${COLECCION_USUARIOS}/${request.auth.uid}`)
    .get();

  if (!perfil.exists || perfil.data().rol !== 'administrador') {
    throw new HttpsError('permission-denied', 'Solo el administrador puede hacer esto.');
  }
}

/**
 * Genera una contraseña temporal para otro usuario y le marca que debe
 * cambiarla en el próximo inicio de sesión. Devuelve la temporal una sola vez.
 */
exports.resetearPasswordUsuario = onCall(async (request) => {
  await exigirAdministrador(request);

  const uid = String(request.data?.uid || '').trim();
  if (!uid) {
    throw new HttpsError('invalid-argument', 'Falta el usuario que se quiere restablecer.');
  }
  if (uid === request.auth.uid) {
    throw new HttpsError(
      'failed-precondition',
      'No puedes restablecer tu propia contraseña desde aquí.'
    );
  }

  const [target, targetDoc] = await Promise.all([
    admin.auth().getUser(uid).catch(() => null),
    admin.firestore().doc(`${COLECCION_USUARIOS}/${uid}`).get()
  ]);

  if (!target) {
    throw new HttpsError('not-found', 'La cuenta de acceso no existe.');
  }
  if (!targetDoc.exists) {
    throw new HttpsError('not-found', 'El usuario no tiene perfil.');
  }
  if (esCorreoAdministrador(target.email) || esCorreoAdministrador(targetDoc.data().email)) {
    throw new HttpsError(
      'failed-precondition',
      'No se puede restablecer la contraseña del administrador.'
    );
  }

  const password = generarPasswordTemporal();

  // Primero se marca el cambio obligatorio. Si algo falla después, la cuenta
  // conserva la contraseña anterior y el usuario sigue obligado a cambiarla.
  await admin
    .firestore()
    .doc(`${COLECCION_USUARIOS}/${uid}`)
    .set({ debeCambiarPassword: true }, { merge: true });

  const claims = target.customClaims || {};
  await admin.auth().setCustomUserClaims(uid, {
    ...claims,
    debeCambiarPassword: true
  });

  await admin.auth().updateUser(uid, { password });

  // La sesión que estuviera abierta deja de poder renovar el token; el nuevo
  // acceso se hace con la contraseña temporal. Si la revocación falla, la
  // temporal ya es válida y el administrador debe poder entregarla.
  await admin.auth().revokeRefreshTokens(uid).catch((error) => {
    console.error('No se pudieron revocar los tokens de', uid, error);
  });

  return { password };
});

/**
 * Cambia la contraseña del usuario autenticado cuando tiene un cambio
 * pendiente. Al terminarlo se borra la marca y la temporal deja de servir.
 */
exports.cambiarPasswordPropia = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Inicia sesión para cambiar tu contraseña.');
  }

  const nueva = String(request.data?.password || '');
  if (nueva.length < LONGITUD_MINIMA) {
    throw new HttpsError(
      'invalid-argument',
      `La contraseña debe tener al menos ${LONGITUD_MINIMA} caracteres.`
    );
  }
  if (nueva.length > 128) {
    throw new HttpsError('invalid-argument', 'La contraseña es demasiado larga.');
  }

  const uid = request.auth.uid;
  const perfil = await admin.firestore().doc(`${COLECCION_USUARIOS}/${uid}`).get();
  const pendiente =
    request.auth.token.debeCambiarPassword === true ||
    (perfil.exists && perfil.data().debeCambiarPassword === true);

  if (!pendiente) {
    throw new HttpsError('failed-precondition', 'No hay un cambio de contraseña pendiente.');
  }

  await admin.auth().updateUser(uid, { password: nueva });

  const usuario = await admin.auth().getUser(uid);
  const claims = usuario.customClaims || {};
  delete claims.debeCambiarPassword;
  await admin.auth().setCustomUserClaims(uid, claims);

  await admin
    .firestore()
    .doc(`${COLECCION_USUARIOS}/${uid}`)
    .set({ debeCambiarPassword: admin.firestore.FieldValue.delete() }, { merge: true });

  return { ok: true };
});

/**
 * Cierra un intento en el servidor: recalcula el puntaje desde las respuestas
 * correctas (nunca confía en el puntaje del cliente), lo deja escrito en el
 * intento y suma los puntos al perfil del estudiante.
 *
 * `puntosAplicados` hace el trigger idempotente: si Firestore lo reintenta,
 * la transacción detecta la marca y no vuelve a sumar los puntos.
 */
exports.procesarIntentoFinalizado = onDocumentUpdated(
  `${COLECCION_INTENTOS}/{intentoId}`,
  async (event) => {
    const antes = event.data?.before.data();
    const despues = event.data?.after.data();
    if (!antes || !despues) return;

    // Solo la transición en_progreso → finalizado.
    if (antes.estado !== 'en_progreso' || despues.estado !== 'finalizado') return;
    if (despues.puntosAplicados === true) return;

    const estudianteUid = String(despues.estudianteUid || '');
    if (!estudianteUid) return;

    const db = admin.firestore();
    const intentoRef = db.doc(`${COLECCION_INTENTOS}/${event.params.intentoId}`);
    const usuarioRef = db.doc(`${COLECCION_USUARIOS}/${estudianteUid}`);

    await db.runTransaction(async (tx) => {
      // Todas las lecturas van antes de las escrituras (requisito de Firestore).
      const intentoSnap = await tx.get(intentoRef);
      if (!intentoSnap.exists) return;

      const intento = intentoSnap.data();
      if (intento.estado !== 'finalizado' || intento.puntosAplicados === true) {
        return;
      }

      // Puntaje recalculado desde el documento fresco del intento.
      const actividadId = String(intento.actividadId || '');
      const nivel = Math.max(1, Math.floor(Number(intento.nivel) || 1));
      const correctas = enteroNoNegativo(intento.respuestasCorrectas);
      const puntaje = correctas * puntosPorAcierto(actividadId, nivel);

      const usuarioSnap = await tx.get(usuarioRef);
      tx.update(intentoRef, { puntaje, puntosAplicados: true });

      if (!usuarioSnap.exists) {
        // Sin perfil no hay dónde sumar; el intento queda cerrado igualmente.
        return;
      }

      const perfil = usuarioSnap.data();
      const puntosActuales = enteroNoNegativo(perfil.puntos);
      const puntosNuevos = puntosActuales + puntaje;
      const { nivel: nuevoNivel, tituloNivel } = calcularNivelYTitulo(puntosNuevos);

      const cambios = {
        puntos: puntosNuevos,
        nivel: nuevoNivel,
        tituloNivel
      };

      // El resumen solo se actualiza si el backfill ya lo creó. Antes de eso
      // quedaría parcial y subestimaría el historial anterior del estudiante.
      if (perfil.resumen && perfil.resumen.completo === true) {
        cambios.resumen = sumarAlResumen(perfil.resumen, intento, puntaje);
      }

      tx.update(usuarioRef, cambios);
    });
  }
);
