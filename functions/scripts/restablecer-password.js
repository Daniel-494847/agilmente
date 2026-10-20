#!/usr/bin/env node
/**
 * Restablece la contraseña de un usuario SIN Cloud Functions y SIN plan Blaze.
 *
 * Usa el Admin SDK de Firebase desde tu propia PC. Solo necesitas una clave de
 * servicio (gratis, se genera una sola vez en la consola de Firebase). El
 * resultado es el mismo que el de la función `resetearPasswordUsuario`:
 * contraseña temporal + cambio obligatorio al entrar + revocación de sesiones.
 *
 * Uso (PowerShell, desde la carpeta functions):
 *   $env:GOOGLE_APPLICATION_CREDENTIALS="C:\ruta\clave-servicio-agilmente.json"
 *   node scripts\restablecer-password.js ana.torres
 *   node scripts\restablecer-password.js ana.torres NuevaClave123
 *
 * El identificador puede ser: uid, correo completo o nombre de usuario interno.
 */
const admin = require('firebase-admin');

const ADMIN_EMAIL = 'pcdoctorbermejo@gmail.com';
const DOMINIO_ESTUDIANTES = 'estudiantes.agilmente.app';
const COLECCION_USUARIOS = 'usuarios';
const ALFABETO_TEMPORAL = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const LONGITUD_TEMPORAL = 10;
const LONGITUD_MINIMA = 8;

/** Contraseña temporal legible, sin caracteres ambiguos. */
function generarPasswordTemporal() {
  let password = '';
  for (let i = 0; i < LONGITUD_TEMPORAL; i += 1) {
    password += ALFABETO_TEMPORAL[cryptoRandomInt(ALFABETO_TEMPORAL.length)];
  }
  return password;
}

function cryptoRandomInt(max) {
  // `crypto.randomInt` está disponible desde Node 14.10.
  return require('crypto').randomInt(max);
}

function esCorreoAdministrador(email) {
  return String(email || '').trim().toLowerCase() === ADMIN_EMAIL;
}

/** uid, correo o nombre de usuario interno → usuario de Auth (o null). */
async function buscarUsuario(identificador) {
  try {
    return await admin.auth().getUser(identificador);
  } catch {
    // No era un uid; probamos como correo (real o interno).
  }

  const correo = identificador.includes('@')
    ? identificador
    : `${identificador}@${DOMINIO_ESTUDIANTES}`;
  try {
    return await admin.auth().getUserByEmail(correo);
  } catch {
    return null;
  }
}

/** Nombre de acceso que usa el usuario para entrar (sin dominio interno). */
function usuarioTexto(email) {
  const correo = String(email || '').trim().toLowerCase();
  const sufijo = `@${DOMINIO_ESTUDIANTES}`;
  return correo.endsWith(sufijo) ? correo.slice(0, -sufijo.length) : correo;
}

async function main() {
  const [, , identificador, passwordIndicada] = process.argv;

  if (!identificador) {
    console.error('Uso: node scripts\\restablecer-password.js <uid-o-correo> [contraseña]');
    console.error('Ej.: node scripts\\restablecer-password.js ana.torres');
    process.exit(1);
  }

  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    console.error('Falta la variable GOOGLE_APPLICATION_CREDENTIALS.');
    console.error('');
    console.error('1. En Firebase → Configuración del proyecto → Cuentas de servicio');
    console.error('   pulsa «Generar nueva clave privada» (es gratis).');
    console.error('2. Guarda el archivo .json en un lugar seguro.');
    console.error('3. Antes de ejecutar el script:');
    console.error('   $env:GOOGLE_APPLICATION_CREDENTIALS="C:\\ruta\\clave-servicio-agilmente.json"');
    process.exit(1);
  }

  admin.initializeApp({
    credential: admin.credential.applicationDefault()
  });

  const usuario = await buscarUsuario(identificador.trim());
  if (!usuario) {
    console.error(`No existe ninguna cuenta con el identificador «${identificador}».`);
    process.exit(1);
  }

  if (esCorreoAdministrador(usuario.email)) {
    console.warn('¡Atención! Vas a restablecer la contraseña del administrador único.');
  }

  const password = (passwordIndicada || '').trim() || generarPasswordTemporal();
  if (password.length < LONGITUD_MINIMA) {
    console.error(`La contraseña debe tener al menos ${LONGITUD_MINIMA} caracteres.`);
    process.exit(1);
  }

  // 1. Marcar el cambio obligatorio antes de tocar la contraseña. Si algo
  //    falla después, la cuenta conserva la contraseña anterior y el usuario
  //    sigue obligado a cambiarla.
  let firestoreOk = true;
  try {
    await admin
      .firestore()
      .doc(`${COLECCION_USUARIOS}/${usuario.uid}`)
      .set({ debeCambiarPassword: true }, { merge: true });
  } catch (error) {
    firestoreOk = false;
    console.warn('Aviso: no se pudo marcar el perfil en Firestore:', error.message);
  }

  // 2. Reclamación en el token (la app la lee al entrar).
  const claims = { ...(usuario.customClaims || {}), debeCambiarPassword: true };
  await admin.auth().setCustomUserClaims(usuario.uid, claims);

  // 3. Cambiar la contraseña.
  await admin.auth().updateUser(usuario.uid, { password });

  // 4. Cerrar las sesiones abiertas (no interrumpe si falla).
  try {
    await admin.auth().revokeRefreshTokens(usuario.uid);
  } catch (error) {
    console.warn('Aviso: no se pudieron revocar las sesiones abiertas:', error.message);
  }

  console.log('');
  console.log('✔ Contraseña restablecida.');
  console.log(`  Usuario:              ${usuarioTexto(usuario.email)}`);
  console.log(`  Correo:               ${usuario.email}`);
  console.log(`  Contraseña temporal:  ${password}`);
  if (!firestoreOk) {
    console.log('  (No se pudo marcar el perfil; la app igual obligará al cambio por el token.)');
  }
  console.log('');
  console.log('Entrega esta contraseña al usuario. Al entrar deberá cambiarla');
  console.log('en /cambiar-password; la temporal dejará de servir.');
}

main().catch((error) => {
  console.error('');
  console.error('Error:', error.message);
  process.exit(1);
});
