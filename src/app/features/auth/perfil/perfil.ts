import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { doc, getDoc } from 'firebase/firestore';

import { auth, db, NOMBRES_COLECCION } from '@core/firebase';
import { UserRoleService } from '@core/auth/user-role.service';
import {
  Paralelo,
  RolUsuario,
  nombreCurso,
  normalizarCurso,
  normalizarParalelo
} from '@core/models/usuario.model';
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
  private readonly roles = inject(UserRoleService);
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

    await auth.authStateReady();
    const user = auth.currentUser;
    if (!user) {
      this.necesitaSesion.set(true);
      this.cargando.set(false);
      return;
    }

    this.email.set(user.email ?? '');
    this.avatarUrl.set(user.photoURL ?? '');
    this.nombre.set(user.displayName ?? 'Estudiante');

    try {
      const docSnap = await getDoc(doc(db, NOMBRES_COLECCION.usuarios, user.uid));
      const datos = docSnap.data();
      if (datos) {
        this.nombre.set(String(datos['nombreCompleto'] ?? user.displayName ?? 'Estudiante'));
        this.avatarUrl.set(String(datos['avatarUrl'] ?? user.photoURL ?? ''));
        this.curso.set(normalizarCurso(datos['curso']));
        this.paralelo.set(normalizarParalelo(datos['paralelo']));
      }
    } catch {
      // Sin documento de perfil: se usan los datos de la sesión.
    }

    try {
      this.rol.set(await this.roles.obtenerRol(user));
    } catch {
      this.rol.set('estudiante');
    }

    try {
      const avance = await this.progreso.refrescar();
      this.puntos.set(avance.puntos);
      this.nivel.set(avance.nivel);
      this.tituloNivel.set(avance.tituloNivel);
    } catch {
      // Se mantienen los valores por defecto.
    }

    this.cargando.set(false);
  }

  claseRol(): string {
    if (this.rol() === 'administrador') return 'text-bg-danger';
    if (this.rol() === 'docente') return 'text-bg-info';
    return 'text-bg-secondary';
  }
}
