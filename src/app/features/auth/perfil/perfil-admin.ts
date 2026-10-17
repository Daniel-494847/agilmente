import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { updateProfile } from 'firebase/auth';

import { auth } from '@core/firebase';
import { CloudinaryService } from '@core/services/cloudinary.service';
import { UsuarioService } from '@core/services/usuario.service';

@Component({
  selector: 'app-perfil-admin',
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <main class="container py-4 py-lg-5">
      <header class="mb-4">
        <a routerLink="/perfil" class="small text-decoration-none">Volver a Perfil</a>
        <h1 class="h3 fw-bold mt-2 mb-1">Editar mi perfil</h1>
        <p class="text-secondary mb-0">Solo puedes modificar los datos de tu propia cuenta.</p>
      </header>
      @if (mensaje()) { <div class="alert alert-success">{{ mensaje() }}</div> }
      @if (error()) { <div class="alert alert-danger">{{ error() }}</div> }
      <form class="row g-3" [formGroup]="form" (ngSubmit)="guardar()">
        <div class="col-12 col-md-4 text-center">
          <div class="rounded-circle border overflow-hidden mx-auto mb-3 d-flex align-items-center justify-content-center"
               style="width: 140px; height: 140px; background: var(--bs-secondary-bg);">
            @if (previewUrl()) {
              <img [src]="previewUrl()" alt="Foto de perfil" class="w-100 h-100" style="object-fit: cover" />
            } @else {
              <i class="bi bi-person-fill text-secondary" style="font-size: 5rem"></i>
            }
          </div>

          <label class="btn btn-outline-primary d-inline-flex align-items-center gap-2">
            <i class="bi bi-camera"></i>
            {{ archivoSeleccionado() ? 'Cambiar foto' : 'Subir foto' }}
            <input type="file" accept="image/*" class="d-none" (change)="onFileChange($event)" />
          </label>

          @if (cloudinary.subiendo()) {
            <div class="mt-3">
              <div class="d-flex justify-content-between small mb-1">
                <span>Subiendo a Cloudinary...</span>
                <span>{{ cloudinary.progreso() }}%</span>
              </div>
              <div class="progress" role="progressbar" aria-label="Progreso de subida" [attr.aria-valuenow]="cloudinary.progreso()" aria-valuemin="0" aria-valuemax="100" style="height: 8px">
                <div class="progress-bar bg-primary" [style.width.%]="cloudinary.progreso()"></div>
              </div>
            </div>
          }

          @if (avatarActual() && !archivoSeleccionado()) {
            <p class="small text-secondary mt-2 mb-0">La foto de perfil actual se mantiene si no eliges una nueva.</p>
          }
        </div>

        <div class="col-12 col-md-8">
          <div class="row g-3">
            <div class="col-12">
              <label class="form-label" for="nombreCompleto">Nombre completo</label>
              <input id="nombreCompleto" class="form-control" formControlName="nombreCompleto" required />
            </div>
            <div class="col-12">
              <label class="form-label">Correo</label>
              <input class="form-control" [value]="email()" readonly />
            </div>
            <div class="col-12">
              <button type="submit" class="btn btn-primary" [disabled]="guardando() || cloudinary.subiendo()">
                {{ guardando() ? 'Guardando...' : 'Guardar cambios' }}
              </button>
            </div>
          </div>
        </div>
      </form>
    </main>
  `
})
export class PerfilAdmin implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly cloudinary = inject(CloudinaryService);
  private readonly usuarios = inject(UsuarioService);

  readonly email = signal('');
  readonly guardando = signal(false);
  readonly mensaje = signal('');
  readonly error = signal('');
  readonly previewUrl = signal('');
  readonly archivoSeleccionado = signal<File | null>(null);
  readonly avatarActual = signal('');
  readonly form = this.fb.nonNullable.group({
    nombreCompleto: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(100)]]
  });

  async ngOnInit(): Promise<void> {
    await auth.authStateReady();
    const user = auth.currentUser;
    if (!user) {
      this.error.set('Inicia sesión.');
      return;
    }
    this.email.set(user.email ?? '');
    const avatar = user.photoURL ?? '';
    this.avatarActual.set(avatar);
    this.previewUrl.set(avatar);
    try {
      const perfil = await this.usuarios.leerCompleto(user.uid);
      this.form.controls.nombreCompleto.setValue(perfil.nombreCompleto || user.displayName || '');
    } catch {
      this.error.set('No se pudo cargar el perfil.');
    }
  }

  onFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    this.archivoSeleccionado.set(file);
    this.error.set('');

    if (file) {
      if (!file.type.startsWith('image/')) {
        this.error.set('Solo se permiten archivos de imagen.');
        this.archivoSeleccionado.set(null);
        this.previewUrl.set(this.avatarActual());
        return;
      }
      const reader = new FileReader();
      reader.onload = () => this.previewUrl.set(String(reader.result ?? ''));
      reader.readAsDataURL(file);
    } else {
      this.previewUrl.set(this.avatarActual());
    }
  }

  async guardar(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const user = auth.currentUser;
    if (!user) return;
    const nombreCompleto = this.form.controls.nombreCompleto.value.trim();
    const archivo = this.archivoSeleccionado();
    this.guardando.set(true);
    try {
      let avatarUrl = this.avatarActual();
      if (archivo) {
        const resultado = await this.cloudinary.subirImagen(archivo, 'perfiles');
        avatarUrl = resultado.secure_url;
      }

      // UsuarioService garantiza el esquema completo (email, puntos, nivel, etc.).
      await this.usuarios.guardarPerfil(user.uid, { nombreCompleto, avatarUrl });
      await updateProfile(user, {
        displayName: nombreCompleto,
        photoURL: avatarUrl || null
      });
      localStorage.setItem('agilmente_user_name', nombreCompleto);
      this.avatarActual.set(avatarUrl);
      this.archivoSeleccionado.set(null);
      this.mensaje.set(archivo ? 'Perfil y foto actualizados.' : 'Perfil actualizado.');
    } catch (e) {
      console.error(e);
      this.error.set('No se pudo guardar. Verifica la conexión y tu rol.');
    } finally {
      this.guardando.set(false);
    }
  }
}