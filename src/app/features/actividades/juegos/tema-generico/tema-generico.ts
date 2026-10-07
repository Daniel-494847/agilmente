import { Component } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

/**
 * Placeholder reutilizable para juegos aún sin lógica completa.
 * Los datos (title, description, icon) vienen de la ruta.
 */
@Component({
  selector: 'app-tema-generico',
  standalone: true,
  imports: [RouterLink],
  template: `
    <main class="min-vh-100 bg-light p-3 p-md-5">
      <a routerLink="/razonamiento-logico" class="btn btn-link text-decoration-none fw-semibold px-0">
        <i class="bi bi-arrow-left me-1"></i> Volver a actividades
      </a>
      <section class="card border-0 shadow-sm rounded-4 text-center p-4 p-md-5 mx-auto mt-4" style="max-width: 720px">
        <i class="bi {{ icon }} display-3 text-primary" aria-hidden="true"></i>
        <p class="text-primary text-uppercase fw-bold small mt-3">Desafío de razonamiento</p>
        <h1 class="h2 fw-bold">{{ title }}</h1>
        <p class="text-secondary">{{ description }}</p>
        <div class="border border-2 border-dashed rounded-3 text-secondary p-3 mt-4">
          Aquí comenzará tu próximo reto.
        </div>
      </section>
    </main>
  `
})
export class TemaGenerico {
  readonly title: string;
  readonly description: string;
  readonly icon: string;

  constructor(route: ActivatedRoute) {
    this.title = route.snapshot.data['title'] ?? 'Actividad';
    this.description = route.snapshot.data['description'] ?? '';
    this.icon = route.snapshot.data['icon'] ?? 'bi-lightbulb';
  }
}
