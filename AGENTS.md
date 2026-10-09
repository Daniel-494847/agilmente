# AGENTS.md — reglas del proyecto Ágilmente

## Regla: los juegos SIEMPRE usan la plantilla de Quiz

**Regla dura.** Cualquier juego nuevo o reformado existente debe construirse sobre el
componente de quiz compartido. No se crean pantallas de juego propias con HTML/CSS
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

- `tipo`: `opcion-multiple` | `verdadero-falso` | `completar`
- `opciones[].imagen` y `opciones[].ariaLabel` para figuras
- `niveles` + `etiquetasNiveles` + generación por nivel

Excepción conocida: `matematicas-interactivas/*` (sumas, restas, multiplicación,
división, combinadas, duelo) usa keypad numérico propio porque es un reto de
rapidez/competencia, no un quiz de opción múltiple. Si se convierte en quiz, debe
migrar a `app-quiz`.

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

Comprobación rápida (debe dar 0 y 0):

```bash
# botones sin la clase .btn de Bootstrap
node <script-de-auditoría>   # inventaría <button> sin \bbtn\b
```

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

## Arquitectura (ver README.md)

- Angular 22 standalone, sin `NgModule` de feature. Un dominio = una carpeta con
  su `*.routes.ts`.
- Catálogo único de actividades: `src/app/features/actividades/data/actividades.data.ts`
  (`ACTIVIDADES_INICIALES`), combinado con Firestore en `ActividadesService.listar()`.
- Rutas de actividades y juegos cuelgan de `/razonamiento-logico/...`.
- Admin por feature, no un admin global.
- CSS mínimo → Bootstrap 5 + bootstrap-icons.
- La app es **zoneless**: todo dato asíncrono vive en `signal`, nunca en campo plano.