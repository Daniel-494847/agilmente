import { Routes } from "@angular/router";

import { requireAdmin } from "../../core/guards/route-guards";

/**
 * Hijas del menú de Operaciones Básicas. Cada tarjeta del menú apunta a una de
 * ellas, y todas renderizan el duelo matemático en modo individual.
 */
const OPERACIONES_BASICAS_CHILDREN: Routes = [
  {
    path: "sumas",
    loadComponent: () =>
      import("./juegos/operaciones-basicas/sumas").then(
        (m) => m.OperacionesBasicasSumas,
      ),
  },
  {
    path: "restas",
    loadComponent: () =>
      import("./juegos/operaciones-basicas/restas").then(
        (m) => m.OperacionesBasicasRestas,
      ),
  },
  {
    path: "multiplicacion",
    loadComponent: () =>
      import("./juegos/operaciones-basicas/multiplicacion").then(
        (m) => m.OperacionesBasicasMultiplicacion,
      ),
  },
  {
    path: "division",
    loadComponent: () =>
      import("./juegos/operaciones-basicas/division").then(
        (m) => m.OperacionesBasicasDivision,
      ),
  },
  {
    path: "combinadas",
    loadComponent: () =>
      import("./juegos/operaciones-basicas/combinadas").then(
        (m) => m.OperacionesBasicasCombinadas,
      ),
  },
  {
    path: "mezcladas",
    loadComponent: () =>
      import("./juegos/operaciones-basicas/mezcladas").then(
        (m) => m.OperacionesBasicasMezcladas,
      ),
  },
];

export const ACTIVIDADES_ROUTES: Routes = [
  {
    path: "",
    loadComponent: () =>
      import("./listado/actividades").then((m) => m.Actividades),
  },
  {
    path: "administrar",
    loadComponent: () =>
      import("./admin/actividades-admin").then((m) => m.ActividadesAdmin),
    canActivate: [requireAdmin],
  },
  {
    path: "sucesiones-patrones",
    loadComponent: () =>
      import("./juegos/sucesiones-patrones/sucesiones-patrones").then(
        (m) => m.SucesionesPatrones,
      ),
  },
  // Juegos mentales: memoriza los números y resuelve la operación mentalmente.
  // Abre la partida a pantalla completa.
  {
    path: "juegos-mentales",
    loadComponent: () =>
      import("./juegos/juegos-mentales/juegos-mentales").then(
        (m) => m.JuegosMentales,
      ),
  },
  // Matemáticas interactivas: menú de operaciones con rutas hijas por tipo
  {
    path: "matematicas-interactivas",
    loadComponent: () =>
      import("./juegos/matematicas-interactivas/matematicas-interactivas").then(
        (m) => m.MatematicasInteractivas,
      ),
    children: [
      {
        path: "sumas",
        loadComponent: () =>
          import("./juegos/matematicas-interactivas/sumas/sumas").then(
            (m) => m.Sumas,
          ),
      },
      {
        path: "restas",
        loadComponent: () =>
          import("./juegos/matematicas-interactivas/restas/restas").then(
            (m) => m.Restas,
          ),
      },
      {
        path: "multiplicacion",
        loadComponent: () =>
          import("./juegos/matematicas-interactivas/multiplicacion/multiplicacion").then(
            (m) => m.Multiplicacion,
          ),
      },
      {
        path: "division",
        loadComponent: () =>
          import("./juegos/matematicas-interactivas/division/division").then(
            (m) => m.Division,
          ),
      },
      {
        path: "combinadas",
        loadComponent: () =>
          import("./juegos/matematicas-interactivas/combinadas/combinadas").then(
            (m) => m.Combinadas,
          ),
      },
    ],
  },
  {
    path: "conteo-figuras",
    loadComponent: () =>
      import("./juegos/conteo-figuras/conteo-figuras").then(
        (m) => m.ConteoFiguras,
      ),
  },
  // Operaciones básicas: menú de operaciones con rutas hijas por tipo.
  // Cada hijo juega el formato duelo matemático en modo INDIVIDUAL.
  {
    path: "operaciones-basicas",
    loadComponent: () =>
      import("./juegos/operaciones-basicas/operaciones-basicas-menu").then(
        (m) => m.OperacionesBasicasMenu,
      ),
    children: OPERACIONES_BASICAS_CHILDREN,
  },
  {
    path: "operadores-matematicos",
    loadComponent: () =>
      import("./juegos/operadores-matematicos/operadores-matematicos").then(
        (m) => m.OperadoresMatematicos,
      ),
  },
  {
    path: "actividades-mentales",
    loadComponent: () =>
      import("./juegos/actividades-mentales/actividades-mentales").then(
        (m) => m.ActividadesMentales,
      ),
  },
  {
    path: "geometria-basica",
    loadComponent: () =>
      import("./juegos/geometria-basica/geometria-basica").then(
        (m) => m.GeometriaBasica,
      ),
  },
  {
    path: "conjuntos",
    loadComponent: () =>
      import("./juegos/conjuntos/conjuntos").then((m) => m.Conjuntos),
  },
  {
    path: "juegos-logicos",
    loadComponent: () =>
      import("./juegos/juegos-logicos/juegos-logicos").then(
        (m) => m.JuegosLogicos,
      ),
  },
  {
    path: "razonamiento-aplicado",
    loadComponent: () =>
      import("./juegos/razonamiento-aplicado/razonamiento-aplicado").then(
        (m) => m.RazonamientoAplicado,
      ),
  },
  {
    path: "seriaciones",
    loadComponent: () =>
      import("./juegos/seriaciones/seriaciones").then((m) => m.Seriaciones),
  },
  {
    path: "sucesiones",
    loadComponent: () =>
      import("./juegos/sucesiones/sucesiones").then((m) => m.Sucesiones),
  },
  {
    path: "piramides",
    loadComponent: () =>
      import("./juegos/piramides/piramides").then((m) => m.Piramides),
  },
  // Cuadrados mágicos: plantilla de quiz; el cuadrado del modelo se dibuja
  // con la rejilla (PreguntaQuiz.rejilla) y los pasos van en la explicación.
  {
    path: "cuadrados-magicos",
    loadComponent: () =>
      import("./juegos/cuadrados-magicos/cuadrados-magicos").then(
        (m) => m.CuadradosMagicos,
      ),
  },
];
