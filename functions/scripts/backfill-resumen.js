/**
 * Recalcula el campo `resumen` de todos los perfiles de `usuarios` a partir de
 * sus intentos finalizados. Se ejecuta UNA VEZ después de desplegar el trigger
 * `procesarIntentoFinalizado`; a partir de ahí el trigger lo mantiene solo.
 *
 * Uso (desde la raíz del proyecto, en PowerShell):
 *
 *   $env:GOOGLE_APPLICATION_CREDENTIALS="C:\ruta\cuenta-servicio.json"
 *   node functions/scripts/backfill-resumen.js
 *
 * También admite un solo usuario:
 *
 *   node functions/scripts/backfill-resumen.js --uid=UID_DEL_ESTUDIANTE
 *
 * La cuenta de servicio debe tener permiso de lectura/escritura en Firestore
 * (rol «Cloud Datastore User» o «Firebase Admin SDK Administrator»).
 */
const admin = require('firebase-admin');
const { construirResumen } = require('../resumen');

admin.initializeApp({
  projectId: process.env.GCLOUD_PROJECT || 'agilmente-123'
});

const db = admin.firestore();
const soloUid = process.argv
  .find((argumento) => argumento.startsWith('--uid='))
  ?.split('=')[1];

async function main() {
  const usuarios = soloUid
    ? [await db.doc(`usuarios/${soloUid}`).get()]
    : (await db.collection('usuarios').get()).docs;

  let actualizados = 0;

  for (const usuario of usuarios) {
    if (!usuario.exists) {
      console.warn(`· ${usuario.id}: no existe, se omite.`);
      continue;
    }

    const intentos = await db
      .collection('intentos')
      .where('estudianteUid', '==', usuario.id)
      .where('estado', '==', 'finalizado')
      .get();

    const resumen = construirResumen(intentos.docs.map((intento) => intento.data()));
    await usuario.ref.set({ resumen }, { merge: true });

    actualizados += 1;
    console.log(
      `✓ ${usuario.id}: ${resumen.intentosFinalizados} intentos, ` +
        `${resumen.respuestasCorrectas} aciertos, ` +
        `${Object.keys(resumen.porActividad).length} juegos`
    );
  }

  console.log(`\n${actualizados} perfiles actualizados.`);
}

main().catch((error) => {
  console.error('No se pudo recalcular el resumen:', error);
  process.exitCode = 1;
});
