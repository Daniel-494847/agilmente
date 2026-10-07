import { Component, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { onAuthStateChanged, signOut } from 'firebase/auth';

import { auth } from '../../core/firebase';
import { UserRoleService } from '../../core/auth/user-role.service';
import { GameUiService } from '../../core/services/game-ui.service';

interface ItemMenu {
  etiqueta: string;
  icono: string;
  /** Clase Bootstrap de tono (bg-*-subtle) */
  tono: string;
  ruta: string;
  rutaAdmin?: string;
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
  readonly menuAbierto = signal(false);
  readonly sesionIniciada = signal(false);
  readonly esAdministrador = signal(false);
  readonly esModoJuego = this.gameUi.jugando;
  readonly enRutaJuego = signal(false);
  readonly rutaActual = signal('');

  readonly menu: ItemMenu[] = [
    {
      etiqueta: 'Inicio',
      icono: 'bi-house-door',
      tono: 'primary',
      ruta: '/inicio'
    },
    {
      etiqueta: 'Razonamiento lógico',
      icono: 'bi-lightbulb',
      tono: 'warning',
      ruta: '/razonamiento-logico',
      rutaAdmin: '/razonamiento-logico/administrar'
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
      etiqueta: 'Perfil',
      icono: 'bi-person-circle',
      tono: 'success',
      ruta: '/perfil',
      rutaAdmin: '/perfil/administrar'
    }
  ];

  constructor(
    private readonly router: Router,
    private readonly userRoleService: UserRoleService
  ) {
    this.rutaActual.set(this.router.url);
    this.enRutaJuego.set(this.esRutaJuego(this.router.url));

    this.router.events.subscribe((event) => {
      if (event instanceof NavigationEnd) {
        this.rutaActual.set(event.urlAfterRedirects);
        this.enRutaJuego.set(this.esRutaJuego(event.urlAfterRedirects));
        this.cerrarMenuMovil();
      }
    });

    onAuthStateChanged(auth, async (user) => {
      this.sesionIniciada.set(!!user);
      if (!user) {
        this.esAdministrador.set(false);
        return;
      }
      try {
        this.esAdministrador.set(await this.userRoleService.esAdministrador(user));
      } catch {
        this.esAdministrador.set(false);
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
    try {
      if (auth.currentUser) {
        await signOut(auth);
      }
      localStorage.removeItem('agilmente_user_role');
      localStorage.removeItem('agilmente_guest');
      localStorage.removeItem('agilmente_session');
      localStorage.removeItem('agilmente_user_name');
      this.cerrarMenuMovil();
      await this.router.navigateByUrl('/inicio');
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    }
  }
}
