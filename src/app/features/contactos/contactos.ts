import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { onAuthStateChanged } from 'firebase/auth';

import { NOMBRES_COLECCION } from '@core/firebase';
import { auth } from '@core/firebase';
import { UserRoleService } from '@core/auth/user-role.service';
import { ContentService } from '@core/services/content.service';
import { Contacto } from '@features/contactos/models/contacto.model';
import { ContactoService } from '@features/contactos/services/contacto.service';

/**
 * Sección «Contactos»: muestra los canales de contacto y redes sociales
 * publicados (WhatsApp, Facebook, teléfono, correo, etc.).
 */
@Component({
  selector: 'app-contactos',
  imports: [RouterLink],
  templateUrl: './contactos.html',
  styleUrl: './contactos.css'
})
export class Contactos implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  private readonly content = inject(ContentService);
  private readonly roles = inject(UserRoleService);
  readonly contacto = inject(ContactoService);

  readonly cargando = signal(true);
  readonly error = signal('');
  readonly esAdmin = signal(false);
  readonly contactos = signal<Contacto[]>([]);
  readonly titulo = signal('Contactos');
  readonly descripcion = signal('Comunícate con la comunidad educativa por nuestros canales oficiales.');

  /** Teléfonos y correos primero; luego redes sociales y enlaces. */
  readonly ordenados = computed<Contacto[]>(() => {
    const prioridad = (c: Contacto) => (['telefono', 'correo'].includes(c.tipo) ? 0 : 1);
    return [...this.contactos()].sort(
      (a, b) => prioridad(a) - prioridad(b) || a.nombre.localeCompare(b.nombre)
    );
  });

  async ngOnInit(): Promise<void> {
    const data = this.route.snapshot.data;
    this.titulo.set((data['title'] as string) ?? this.titulo());
    this.descripcion.set((data['description'] as string) ?? this.descripcion());

    const unsub = onAuthStateChanged(auth, async (user) => {
      this.esAdmin.set(user ? await this.roles.esAdministrador(user) : false);
    });
    this.destroyRef.onDestroy(() => unsub());

    try {
      const lista = await this.content.listarPublicados<Contacto>(NOMBRES_COLECCION.contactos);
      this.contactos.set(lista);
    } catch {
      this.error.set('No se pudieron cargar los contactos. Revisa tu conexión.');
    } finally {
      this.cargando.set(false);
    }
  }
}
