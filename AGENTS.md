# AGENTS.md — reglas del proyecto Ágilmente

## Regla: los juegos SIEMPRE usan la plantilla de Quiz

**Regla dura.** Cualquier juego nuevo o reformado existente debe construirse sobre el
componente de quiz compartido. No se crean pantallas de game propias con HTML/CSS
propio, ni "variantes" del juego.

Componente base: `src/app/shared/components/quiz/`

| Archivo | Rol |
|---|---|
| `quiz.ts` | Componente `Quiz` (`app-quiz`). Solo inputs/outputs, sin lógica. |
| `quiz.html` / `quiz.css` | Presentación (intro, jugando, feedback, resultado). |
| `quiz.model.ts` | `ConfiguracionQuiz`, `PreguntaQuiz`, `QuizViewModel`, `ResultadoQuiz`. |

### Contrato de uso

1. El juego declara un `ConfiguracionQuiz` (titulo, descripcion, colorTema, niveles,
   preguntas, tiempoLimiteSegundos opcional).
2. Mantiene un `signal<QuizViewModel>` con los 4 estados: `intro` → `jugando` →
   `feedback` → `resultado`.
3. Enlaza los eventos: `volver`, `nivelElegido`, `empezar`, `respuestaSeleccionada`,
   `avanzar`, `reiniciar`, `alternarSonido`.
4. En `ngOnInit` llama `gameUi.setJugando(true)` y en `ngDestroy`
   `gameUi.setJugando(false)` (el shell colapsa el sidebar en modo juego).
5. Registra el intento con `AttemptsService` (`iniciar` / `finalizar`).
6. La única lógica específica del juego es la **generación de `preguntas`**.

Ejemplo de referencia completo: `src/app/features/actividades/juegos/sucesiones-patrones/sucesiones-patrones.ts`.

### Cómo se logra la variedad sin romper la plantilla

La apariencia se cambia mediante los campos de `PreguntaQuiz`, no con otra pantalla:

- `tipo`: `opcion-multiple` | `verdadero-falso` | `completar` | `personalizado`
- `opciones[].imagen` y `opciones[].ariaLabel` para figuras
- `niveles` + `etiquetasNiveles` + generación por nivel
- `imagen` en la pregunta para SVG o imágenes
- `rejilla` para retos de tabla (sudokus, cuadrados mágicos)
- `contenidoHtml` para contenido personalizado en estado `jugando`

Excepciones conocidas: `matematicas-interactivas/*` (sumas, restas, multiplicación,
división, combinadas, duelo) y `operaciones-basicas/*` usan keypad numérico propio
porque son retos de rapidez/competencia, no quizzes de opción múltiple. Si se
convierten en quiz, deben migrar a `app-quiz`.

## Regla: todos los botones son `.btn` de Bootstrap

**Regla dura.** Ningún botón se pinta con CSS propio. Todo elemento accionable es
`<button class="btn …">` o `<a class="btn …">`, y el aspecto lo pone una variante
de Bootstrap (`btn-primary`, `btn-success`, `btn-warning`, `btn-outline-dark`,
`btn-light`, `btn-link`…).

| Se permite en el CSS propio | No se permite |
|---|---|
| Tamaño (`clamp`, `width`, `height`) | `background`, `color`, `border`, `border-radius` del botón |
| Rejilla/flex del contenedor | Degradados, `box-shadow` de color, animaciones propias de estado |
| Marcas y estados de juego | Variantes inventadas tipo `btn-morado` |

- Si el color depende del juego (color de equipo en los duelos, color de modo en
  Juegos Mentales), se pinta con las **variables de Bootstrap** del propio
  componente: `--bs-btn-bg`, `--bs-btn-border-color`, `--bs-btn-color`,
  `--bs-btn-hover-*`, `--bs-btn-active-*`, `--bs-btn-disabled-*`. Así el botón
  conserva el hover, el focus ring y el disabled de Bootstrap.
- Si el estado cambia según la respuesta, se cambia la variante con `[class.…]`
  (`btn-outline-dark` → `btn-danger` → `btn-success`), no una clase `is-*` propia.
- **Prohibido `btn-outline-warning` / `btn-outline-info`**: su texto no llega a
  4.5:1 de contraste. Para el amarillo sólido, `btn-warning` (ya trae texto
  oscuro). Mínimo exigido: 4.5:1.

### Trampas de Bootstrap 5.3 (medidas, no de memoria)

1. `.btn` fija `font-size: var(--bs-btn-font-size)` = `1rem`. Un botón **no**
   hereda el tamaño del texto que lo rodea; para que sí, hay que poner
   `font-size: 1em` en el CSS del componente.
2. `.badge` fija `color: #fff`. Una letra o marca dentro de un botón sale
   **blanca sobre blanco** si no se le pone `color: inherit` + borde
   `currentColor`.
3. `.border` declara el borde con `!important`, así que `border-current` no
   funciona encima: el borde del círculo se declara en el CSS del componente.
4. `.btn:disabled` aplica `opacity: .65`. En el acertijo eso deja el verde y el
   rojo casi ilegibles; se anula solo con `opacity: 1` (sin tocar colores).
5. `.row` lleva `margin-top` negativo por la gutter vertical: dentro de un
   contenedor con `gap` se come la separación. Se neutraliza con `mt-0` en la
   fila (y `gx-*` / `gy-*` para la separación entre columnas).
6. `.card` es `display: flex; flex-direction: column`, así que sus hijos se
   estiran a todo el ancho: un botón dentro de una tarjeta ocupa el 100%.

## Arquitectura

### Stack

- **Angular 22** standalone, **zoneless**, sin `NgModule` de feature
- **TypeScript ~6.0** con `strict`, `noImplicitOverride`, `noImplicitReturns`
- **Bootstrap 5.3** + bootstrap-icons (sin CSS propio para botones)
- **Firebase 12** (Firestore + Storage)
- **KaTeX** para renderizado de matemáticas
- **Vitest** + jsdom para tests

### Estructura de carpetas

```
src/app/
├── app.ts                    # Componente raíz (solo <router-outlet />)
├── app.config.ts             # provideRouter + error listeners
├── app.routes.ts             # Rutas raíz (login + shell con children)
├── core/                     # Servicios y modelos globales
│   ├── firebase.ts           # Inicialización Firebase + nombres de colección
│   ├── auth/
│   │   └── user-role.service.ts
│   ├── guards/
│   │   └── route-guards.ts
│   ├── models/
│   │   ├── actividad.model.ts
│   │   └── usuario.model.ts
│   └── services/
│       ├── attempts.service.ts
│       ├── content.service.ts
│       ├── fullscreen.service.ts
│       ├── game-ui.service.ts
│       └── user-progress.service.ts
├── features/                 # Módulos de feature (standalone, sin NgModules)
│   ├── actividades/
│   │   ├── data/actividades.data.ts    # Catálogo ACTIVIDADES_INICIALES
│   │   ├── services/actividades.service.ts
│   │   ├── actividades.routes.ts
│   │   └── juegos/                     # 15 juegos/actividades
│   ├── administracion/
│   ├── auth/
│   ├── avisos/
│   ├── biblioteca/
│   ├── dashboard/
│   ├── galeria/
│   ├── progreso/
│   └── unidad-educativa/
├── layout/                   # Shell de la app (sidebar + topbar)
│   ├── shell/
│   ├── sidebar/
│   └── topbar/
└── shared/                   # Componentes y datos compartidos
    ├── components/
    │   ├── activity-card/    # Tarjeta de actividad
    │   ├── quiz/             # Plantilla base de juego
    │   └── section-page/     # Página de sección genérica
    └── data/
        └── section-pages.data.ts
```

### Juegos/actividades existentes (15)

| Carpeta | Componente | Descripción |
|---|---|---|
| `sucesiones-patrones/` | `SucesionesPatrones` | Secuencias y relaciones entre imágenes/números |
| `sucesiones/` | `Sucesiones` | Completar secuencias numéricas |
| `conteo-figuras/` | `ConteoFiguras` | Contar figuras, segmentos, ángulos, triángulos |
| `operaciones-basicas/` | `OperacionesBasicasMenu` + hijos | Sumas, restas, multiplicación, división, combinadas, mezcladas |
| `matematicas-interactivas/` | `MatematicasInteractivas` + hijos | Duelos por equipos: sumas, restas, multiplicación, división, combinadas |
| `actividades-mentales/` | `ActividadesMentales` | Cálculo mental: series, conteo rápido, comparaciones |
| `geometria-basica/` | `GeometriaBasica` | Figuras, perímetros, relaciones geométricas |
| `conjuntos/` | `Conjuntos` | Pertenencia, unión, intersección |
| `juegos-logicos/` | `JuegosLogicos` | Sudokus y cuadrados mágicos |
| `razonamiento-aplicado/` | `RazonamientoAplicado` | Problemas de la vida diaria |
| `seriaciones/` | `Seriaciones` | Ordenar elementos por regla |
| `piramides/` | `Piramides` | Pirámides numéricas |
| `cuadrados-magicos/` | `CuadradosMagicos` | Cuadrados mágicos (usa plantilla quiz) |
| `operadores-matematicos/` | `OperadoresMatematicos` | Operadores matemáticos |
| `juegos-mentales/` | `JuegosMentales` | Agilidad mental con positivos/negativos (pantalla completa) |

### Catálogo de actividades

`src/app/features/actividades/data/actividades.data.ts` define `ACTIVIDADES_INICIALES`
(14 actividades). `ActividadesService.listar()` combina este catálogo con Firestore
para permitir contenido dinámico.

| ID | Título | Ruta | ColorTema |
|---|---|---|---|
| 1 | Sucesiones y Patrones | `/razonamiento-logico/sucesiones-patrones` | purple |
| 2 | Conteo de Figuras | `/razonamiento-logico/conteo-figuras` | green |
| 4 | Operaciones Básicas | `/razonamiento-logico/operaciones-basicas` | blue |
| 5 | Actividades Mentales | `/razonamiento-logico/actividades-mentales` | green |
| 6 | Geometría Básica | `/razonamiento-logico/geometria-basica` | orange |
| 7 | Conjuntos | `/razonamiento-logico/conjuntos` | pink |
| 8 | Juegos Lógicos | `/razonamiento-logico/juegos-logicos` | orange |
| 9 | Razonamiento Aplicado | `/razonamiento-logico/razonamiento-aplicado` | purple |
| 10 | Seriaciones | `/razonamiento-logico/seriaciones` | green |
| 11 | Sucesiones | `/razonamiento-logico/sucesiones` | blue |
| 12 | Pirámides | `/razonamiento-logico/piramides` | amber |
| 15 | Cuadrados Mágicos | `/razonamiento-logico/cuadrados-magicos` | purple |
| 13 | Matemáticas Interactivas | `/razonamiento-logico/matematicas-interactivas` | green |
| 14 | Juegos Mentales | `/razonamiento-logico/juegos-mentales` | pink |

**Nota:** El ID 3 no existe (salto en la numeración histórico).

### Rutas

Todas las rutas de actividades cuelgan de `/razonamiento-logico/...` con lazy loading:

```
/razonamiento-logico/
├── ""                          → Actividades (listado)
├── administrar                 → ActividadesAdmin [requireAdmin]
├── sucesiones-patrones         → SucesionesPatrones
├── juegos-mentales             → JuegosMentales
├── matematicas-interactivas    → MatematicasInteractivas
│   ├── sumas                   → Sumas
│   ├── restas                  → Restas
│   ├── multiplicacion          → Multiplicacion
│   ├── division                → Division
│   └── combinadas              → Combinadas
├── conteo-figuras              → ConteoFiguras
├── operaciones-basicas        → OperacionesBasicasMenu
│   ├── sumas                   → OperacionesBasicasSumas
│   ├── restas                  → OperacionesBasicasRestas
│   ├── multiplicacion          → OperacionesBasicasMultiplicacion
│   ├── division                → OperacionesBasicasDivision
│   ├── combinadas              → OperacionesBasicasCombinadas
│   └── mezcladas               → OperacionesBasicasMezcladas
├── operadores-matematicos      → OperadoresMatematicos
├── actividades-mentales        → ActividadesMentales
├── geometria-basica            → GeometriaBasica
├── conjuntos                   → Conjuntos
├── juegos-logicos              → JuegosLogicos
├── razonamiento-aplicado       → RazonamientoAplicado
├── seriaciones                 → Seriaciones
├── sucesiones                  → Sucesiones
├── piramides                   → Piramides
└── cuadrados-magicos           → CuadradosMagicos
```

Rutas raíz (`app.routes.ts`):
- `/login` → Login (fuera del shell, `redirectIfAuthenticated`)
- `/` → Shell (con sidebar + topbar)
  - `/inicio` → Dashboard
  - `/razonamiento-logico` → Actividades
  - `/biblioteca` → Biblioteca
  - `/galeria` → Galería
  - `/progreso` → Progreso
  - `/avisos` → Avisos
  - `/unidad-educativa` → Unidad Educativa
  - `/perfil` → Perfil
  - `/administracion` → Administración

### Servicios

| Servicio | Ubicación | Rol |
|---|---|---|
| `AttemptsService` | `core/services/` | Registra intentos de juego en Firestore (`iniciar` / `finalizar`). Guarda puntaje, nivel, respuestas, duración. |
| `ContentService` | `core/services/` | CRUD genérico de Firestore + subida de imágenes a Storage. |
| `FullscreenService` | `core/services/` | Maneja pantalla completa del navegador. Signal `activo` y `soportado`. |
| `GameUiService` | `core/services/` | Signal `jugando` (boolean). Cuando es `true`, el shell colapsa el sidebar. |
| `UserProgressService` | `core/services/` | Calcula puntos/nivel del usuario desde intentos finalizados. Títulos: Explorador → Aprendiz → Pensador → Estratega → Maestro lógico → Leyenda. |
| `ActividadesService` | `features/actividades/services/` | Combina `ACTIVIDADES_INICIALES` con Firestore. |
| `UserRoleService` | `core/auth/` | Obtiene/cambia rol de usuario (estudiante/docente/administrador). |

### Componentes compartidos

| Componente | Selector | Rol |
|---|---|---|
| `Quiz` | `app-quiz` | Plantilla base para todos los juegos. Recibe `QuizViewModel` y emite eventos. |
| `ActivityCard` | `app-activity-card` | Tarjeta de actividad con colorTema → clases Bootstrap. |
| `SectionPage` | `app-section-page` | Página de sección genérica (progreso, unidad educativa, perfil). Carga contenido desde Firestore. |

### Firebase

**Proyecto:** `agilmente-123`

| Colección | Uso |
|---|---|
| `usuarios` | Perfiles con rol, puntos, nivel |
| `actividades` | Catálogo (se combina con `ACTIVIDADES_INICIALES`) |
| `biblioteca` | Recursos digitales |
| `comunicados` | Avisos |
| `fotosGaleria` | Galería de fotos |
| `contenidoSecciones` | Contenido de páginas de sección |
| `intentos` | Registro de intentos de juego |
| `unidad-educativa` | Info institucional (doc `principal`) |

### Patrones clave

1. **Standalone components** — Sin NgModules. Cada feature es una carpeta con sus rutas.
2. **Zoneless** — Todo dato asíncrono vive en `signal`, nunca en campo plano.
3. **Plantilla de Quiz** — Todos los juegos usan `app-quiz` con `ConfiguracionQuiz` + `QuizViewModel`. La variedad se logra con `tipo`, `opciones[].imagen`, `niveles`, `rejilla`, `contenidoHtml`.
4. **Admin por feature** — Cada módulo tiene su propia ruta `administrar` con guard `requireAdmin`.
5. **Shell con sidebar/topbar** — El sidebar se colapsa en modo juego (`GameUiService.jugando`).
6. **Bootstrap 5.3** — Sin CSS propio para botones (`.btn` + variantes). Colores vía variables CSS del componente.
7. **Lazy loading** — Todas las rutas usan `loadComponent` / `loadChildren`.
8. **TypeScript paths** — Alias `@core/*`, `@layout/*`, `@shared/*`, `@features/*`.

### Configuración

- **angular.json:** `@angular/build:application` (esbuild), Bootstrap 5.3 + bootstrap-icons, budgets 1.5MB/2.5MB
- **tsconfig:** ES2022, `strict`, `noImplicitOverride`, `noImplicitReturns`, `noFallthroughCasesInSwitch`
- **Tests:** Vitest + jsdom
