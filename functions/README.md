# Funciones de Ágilmente

Dos funciones invocables para el restablecimiento de contraseñas de cuentas con
**correo interno** (`@estudiantes.agilmente.app`):

| Función | Quién la usa | Qué hace |
|---|---|---|
| `resetearPasswordUsuario` | Administrador único | Genera una contraseña temporal, marca `debeCambiarPassword` en el perfil y en las *custom claims*, y revoca los tokens de refresco del usuario. Devuelve la temporal una sola vez. |
| `cambiarPasswordPropia` | Usuario con cambio pendiente | Guarda la contraseña nueva, borra la marca y retira la *custom claim*. La temporal deja de servir. |

El administrador entrega la contraseña temporal por su cuenta; la aplicación no
envía correos para las cuentas internas. El usuario debe cambiarla en
`/cambiar-password` antes de entrar al resto de la aplicación.

## Cuentas con correo real

No necesitan estas funciones. La aplicación usa `sendPasswordResetEmail`, que
envía un enlace de un solo uso y el usuario elige su nueva contraseña. Este
camino funciona en el plan Spark.

## Requisito para las cuentas internas

Firebase exige el plan **Blaze** para desplegar Cloud Functions. El proyecto
`agilmente-123` está en Spark, por lo que el despliegue falla con:

> Your project agilmente-123 must be on the Blaze (pay-as-you-go) plan…

Mientras no se active Blaze, el botón «Generar contraseña temporal» muestra un
error explicando que las funciones no están desplegadas.

## Restablecer sin plan Blaze (desde tu PC)

El requisito de Blaze aplica **solo** a desplegar Cloud Functions. El Admin SDK
funciona en el plan gratis si se ejecuta localmente, así que puedes
restablecer contraseñas al instante sin pagar nada con el script incluido:

```powershell
# 1. Una sola vez: Firebase → Configuración del proyecto → Cuentas de servicio
#    → «Generar nueva clave privada» (gratis). Guarda el .json en un lugar seguro.

cd functions
chcp 65001 > $null   # opcional: muestra bien los acentos en la consola
$env:GOOGLE_APPLICATION_CREDENTIALS="C:\ruta\clave-servicio-agilmente.json"

# Genera una contraseña temporal y la imprime:
node scripts\restablecer-password.js ana.torres

# O indica tú la contraseña nueva:
node scripts\restablecer-password.js ana.torres NuevaClave123
```

El script hace exactamente lo mismo que la función: cambia la contraseña, marca
`debeCambiarPassword` en el perfil y en el token, y revoca las sesiones
abiertas. El usuario recibe la temporal y debe cambiarla en `/cambiar-password`.

**Cuidado:** quien tenga el archivo `.json` tiene control total del proyecto.
No lo compartas ni lo subas al repositorio (ya está en `.gitignore`).

## Crear la cuenta del administrador (desde tu PC)

La contraseña **nunca se guarda en Firestore**: vive cifrada en Firebase
Authentication. Para dar de alta la cuenta del administrador único:

```powershell
cd functions
$env:GOOGLE_APPLICATION_CREDENTIALS="C:\ruta\clave-servicio-agilmente.json"
node scripts\crear-administrador.js
node scripts\crear-administrador.js pcdoctorbermejo@gmail.com "10deabrilde1991"
```

El script solo acepta el correo `pcdoctorbermejo@gmail.com` (regla de un solo
administrador). Crea la cuenta en Authentication con la contraseña indicada y
escribe o repara el perfil en Firestore con `rol: 'administrador'`, conservando
los puntos si ya existían.

Alternativa sin script: Firebase Console → **Authentication** → *Add user*
(correo y contraseña). Al iniciar sesión, la aplicación crea sola el perfil de
administrador.

## Despliegue

Desde la raíz del proyecto:

```powershell
cd functions
npm install
cd ..
firebase deploy --only functions --project agilmente-123
```
