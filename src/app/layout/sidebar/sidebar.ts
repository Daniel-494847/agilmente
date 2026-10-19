import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterModule } from '@angular/router';

import { AuthService } from '@core/auth/auth.service';
import { GameUiService } from '@core/services/game-ui.service';

interface ItemMenu {
  etiqueta: string;
  icono: string;
  /** Clase Bootstrap de tono (bg-*-subtle) */
  tono: string;
  ruta: string;
  rutaAdmin?: string;
  /** Si es true, solo la ven los administradores (es un enlace de administración). */
  soloAdmin?: boolean;
  /** Si es true, solo la ven docentes y administradores. */
  soloDocente?: boolean;
}

@Component({
  selector: 'app-sidebar',
  imports: [RouterModule],
  host: { '[class.menu-juego-host]': 'esModoJuego()' },
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.css'
})
export class Sidebar {
  private readonly gameUi = inject(GameUiService);
  private readonly auth = inject(AuthService);
  readonly menuAbierto = signal(false);
  readonly sesionIniciada = this.auth.isAuthenticated;
  readonly esAdministrador = this.auth.esAdministrador;
  readonly esDocente = this.auth.esDocente;
  readonly esModoJuego = this.gameUi.jugando;
  readonly enRutaJuego = signal(false);
  readonly rutaActual = signal('');

  readonly menu: ItemMenu[] = [
    {
      etiqueta: 'Inicio',
      icono: 'bi-house-door',
      tono: 'primary',
      ruta: '/'
    },
    {
      etiqueta: 'Razonamiento lógico',
      icono: 'bi-lightbulb',
      tono: 'warning',
      ruta: '/razonamiento-logico',
      rutaAdmin: '/razonamiento-logico/administrar'
    },
    {
      etiqueta: 'Módulo Docente',
      icono: 'bi-journal-text',
      tono: 'info',
      ruta: '/docente',
      soloDocente: true
    },
    {
      etiqueta: 'Biblioteca Digital',
      icono: 'bi-book',
      tono: 'info',
      ruta: '/biblioteca',
      rutaAdmin: '/biblioteca/administrar'
    },
    {
      etiqueta: 'Galería',
      icono: 'bi-images',
      tono: 'danger',
      ruta: '/galeria',
      rutaAdmin: '/galeria/administrar'
    },
    {
      etiqueta: 'Mi Progreso',
      icono: 'bi-bar-chart',
      tono: 'success',
      ruta: '/progreso',
      rutaAdmin: '/progreso/administrar'
    },
    {
      etiqueta: 'Avisos y Comunicados',
      icono: 'bi-bell',
      tono: 'warning',
      ruta: '/avisos',
      rutaAdmin: '/avisos/administrar'
    },
    {
      etiqueta: 'Unidad Educativa',
      icono: 'bi-building',
      tono: 'primary',
      ruta: '/unidad-educativa',
      rutaAdmin: '/unidad-educativa/administrar'
    },
    {
      etiqueta: 'Contactos',
      icono: 'bi-telephone',
      tono: 'success',
      ruta: '/contactos',
      rutaAdmin: '/contactos/administrar'
    },
    {
      etiqueta: 'Perfil',
      icono: 'bi-person-circle',
      tono: 'success',
      ruta: '/perfil',
      rutaAdmin: '/perfil/administrar'
    },
    {
      etiqueta: 'Gestión de usuarios',
      icono: 'bi-people',
      tono: 'secondary',
      ruta: '/administracion/usuarios',
      soloAdmin: true
    }
  ];

  private readonly destroyRef = inject(DestroyRef);

  constructor(private readonly router: Router) {
    this.rutaActual.set(this.router.url);
    this.enRutaJuego.set(this.esRutaJuego(this.router.url));

    this.router.events.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((event) => {
      if (event instanceof NavigationEnd) {
        this.rutaActual.set(event.urlAfterRedirects);
        this.enRutaJuego.set(this.esRutaJuego(event.urlAfterRedirects));
        this.cerrarMenuMovil();
      }
    });
  }

  alternarMenu(): void {
    this.menuAbierto.update((v) => !v);
  }

  cerrarMenuMovil(): void {
    this.menuAbierto.set(false);
  }

  esModoAdmin(): boolean {
    return this.esAdministrador();
  }

  esActivo(item: ItemMenu): boolean {
    const rutaActual = this.rutaActual().split(/[?#]/, 1)[0];
    const rutas = [item.ruta, item.rutaAdmin].filter((r): r is string => !!r);
    return rutas.some((ruta) => rutaActual === ruta || rutaActual.startsWith(`${ruta}/`));
  }

  private esRutaJuego(url: string): boolean {
    const ruta = url.split(/[?#]/, 1)[0].replace(/\/+$/, '');
    return (
      ruta.startsWith('/razonamiento-logico/') &&
      !ruta.startsWith('/razonamiento-logico/administrar')
    );
  }

  navegar(item: ItemMenu): void {
    const ruta = this.esModoAdmin() && item.rutaAdmin ? item.rutaAdmin : item.ruta;
    this.router.navigateByUrl(ruta);
    this.cerrarMenuMovil();
  }

  async cerrarSesion(): Promise<void> {
    await this.auth.cerrarSesion();
    this.cerrarMenuMovil();
    await this.router.navigateByUrl('/');
  }
}
