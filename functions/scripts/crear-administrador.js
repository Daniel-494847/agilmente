#!/usr/bin/env node
/**
 * Crea (o repara) la cuenta del administrador único.
 *
 * - En Firebase Authentication: crea la cuenta con su contraseña (o la
 *   actualiza si ya existe). La contraseña se guarda cifrada, nunca en
 *   Firestore ni en el repositorio.
 * - En Firestore: escribe/repara el perfil con `rol: 'administrador'`.
 *
 * Solo puede crear administrador al correo único del proyecto; cualquier otro
 * correo se rechaza (regla de un solo administrador).
 *
 * Uso (PowerShell, desde la carpeta functions):
 *   $env:GOOGLE_APPLICATION_CREDENTIALS="C:\ruta\clave-servicio-agilmente.json"
 *   node scripts\crear-administrador.js
 *   node scripts\crear-administrador.js pcdoctorbermejo@gmail.com "10deabrilde1991"
 */
const admin = require('firebase-admin');

const ADMIN_EMAIL = 'pcdoctorbermejo@gmail.com';
const ADMIN_NOMBRE = 'Daniel Llanos Pallares';
const COLECCION_USUARIOS = 'usuarios';
const LONGITUD_MINIMA = 8;

async function main() {
  const [, , emailArg, passwordArg, nombreArg] = process.argv;

  const email = String(emailArg || ADMIN_EMAIL).trim().toLowerCase();
  const password = String(passwordArg || '').trim();
  const nombre = String(nombreArg || ADMIN_NOMBRE).trim();

  if (email !== ADMIN_EMAIL) {
    console.error(`Solo existe un administrador: ${ADMIN_EMAIL}.`);
    console.error(`No se creará ningún otro correo como administrador («${email}»).`);
    process.exit(1);
  }
  if (password.length < LONGITUD_MINIMA) {
    console.error(`La contraseña debe tener al menos ${LONGITUD_MINIMA} caracteres.`);
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

  // 1. Cuenta de acceso (Authentication).
  let usuario;
  let creado = false;
  try {
    usuario = await admin.auth().getUserByEmail(email);
    await admin.auth().updateUser(usuario.uid, { password });
  } catch (error) {
    if (error.code !== 'auth/user-not-found') {
      throw error;
    }
    usuario = await admin.auth().createUser({ email, password });
    creado = true;
  }

  // 2. Quitar cualquier marca de cambio pendiente y dejar el rol por defecto.
  const claims = { ...(usuario.customClaims || {}) };
  delete claims.debeCambiarPassword;
  await admin.auth().setCustomUserClaims(usuario.uid, claims);

  // 3. Perfil en Firestore: conserva puntos si ya existían.
  const docRef = admin.firestore().doc(`${COLECCION_USUARIOS}/${usuario.uid}`);
  const snap = await docRef.get();
  const datos = snap.exists ? snap.data() || {} : {};
  const puntos = Number.isFinite(Number(datos.puntos)) ? Number(datos.puntos) : 0;
  const nivel = Number(datos.nivel) || Math.floor(puntos / 100) + 1;

  await docRef.set(
    {
      email,
      nombreCompleto: datos.nombreCompleto || nombre,
      rol: 'administrador',
      puntos,
      nivel,
      tituloNivel: String(datos.tituloNivel || 'Explorador'),
      debeCambiarPassword: admin.firestore.FieldValue.delete(),
      creadoEn: datos.creadoEn || admin.firestore.FieldValue.serverTimestamp(),
      ultimoIngreso: admin.firestore.FieldValue.serverTimestamp()
    },
    { merge: true }
  );

  console.log('');
  console.log(creado ? '✔ Cuenta de administrador creada.' : '✔ Cuenta de administrador reparada.');
  console.log(`  Usuario:  ${email}`);
  console.log(`  Rol:      administrador (único del proyecto)`);
  console.log(`  Perfil:   ${COLECCION_USUARIOS}/${usuario.uid}`);
  console.log('');
  console.log('Ya puedes entrar en la app con ese correo y contraseña.');
}

main().catch((error) => {
  console.error('');
  console.error('Error:', error.message);
  process.exit(1);
});
