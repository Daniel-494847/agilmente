import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { AuthService } from '@core/auth/auth.service';
import { Paralelo, RolUsuario, nombreCurso } from '@core/models/usuario.model';
import { UserProgressService } from '@core/services/user-progress.service';

interface EnlaceSeccion {
  title: string;
  description: string;
  icon: string;
  route: string;
  externalUrl?: string;
}

/**
 * Mi Perfil del estudiante: muestra sus datos de cuenta y su avance general.
 * Desde aquí puede entrar a editar su propio perfil (`/perfil/administrar`).
 */
@Component({
  selector: 'app-perfil',
  imports: [RouterLink],
  templateUrl: './perfil.html'
})
export class Perfil implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly authService = inject(AuthService);
  private readonly progreso = inject(UserProgressService);

  readonly cargando = signal(true);
  readonly necesitaSesion = signal(false);
  readonly titulo = signal('Perfil');
  readonly descripcion = signal('Consulta tus datos personales y ajustes de cuenta.');
  readonly badge = signal('Cuenta');
  readonly enlaces = signal<EnlaceSeccion[]>([]);

  readonly nombre = signal('');
  readonly email = signal('');
  readonly avatarUrl = signal('');
  readonly curso = signal<number | undefined>(undefined);
  readonly paralelo = signal<Paralelo | undefined>(undefined);
  readonly cursoTexto = computed(() => nombreCurso(this.curso(), this.paralelo()));
  readonly rol = signal<RolUsuario>('estudiante');
  readonly puntos = signal(0);
  readonly nivel = signal(1);
  readonly tituloNivel = signal('Explorador');

  async ngOnInit(): Promise<void> {
    const data = this.route.snapshot.data;
    this.titulo.set((data['title'] as string) ?? this.titulo());
    this.descripcion.set((data['description'] as string) ?? this.descripcion());
    this.badge.set((data['badge'] as string) ?? this.badge());
    this.enlaces.set((data['items'] as EnlaceSeccion[]) ?? []);

    await this.authService.ready;
    const user = this.authService.user();
    if (!user) {
      this.necesitaSesion.set(true);
      this.cargando.set(false);
      return;
    }

    this.email.set(user.email ?? '');
    this.avatarUrl.set(user.photoURL ?? '');
    this.nombre.set(user.displayName ?? 'Estudiante');

    // El perfil lo carga `AuthService` al iniciar sesión: no se vuelve a leer.
    const perfil = this.authService.perfil();
    if (perfil) {
      this.nombre.set(perfil.nombreCompleto || user.displayName || 'Estudiante');
      this.avatarUrl.set(perfil.avatarUrl ?? user.photoURL ?? '');
      this.curso.set(perfil.curso);
      this.paralelo.set(perfil.paralelo);
      this.rol.set(perfil.rol);
    }

    const avance = this.progreso.progreso();
    this.puntos.set(avance.puntos);
    this.nivel.set(avance.nivel);
    this.tituloNivel.set(avance.tituloNivel);

    this.cargando.set(false);
  }

  claseRol(): string {
    if (this.rol() === 'administrador') return 'text-bg-danger';
    if (this.rol() === 'docente') return 'text-bg-info';
    return 'text-bg-secondary';
  }
}
