const crypto = require('crypto');
const admin = require('firebase-admin');
const { onCall, HttpsError } = require('firebase-functions/v2/https');

admin.initializeApp();

const ADMIN_EMAIL = 'pcdoctorbermejo@gmail.com';
const COLECCION_USUARIOS = 'usuarios';
const ALFABETO_TEMPORAL = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const LONGITUD_TEMPORAL = 10;
const LONGITUD_MINIMA = 8;

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
