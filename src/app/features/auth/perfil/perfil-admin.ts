import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { updateProfile } from 'firebase/auth';
import { doc, getDoc, updateDoc } from 'firebase/firestore';

import { auth, db, NOMBRES_COLECCION } from '../../../core/firebase';

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
        <div class="col-12 col-md-6">
          <label class="form-label" for="nombreCompleto">Nombre completo</label>
          <input id="nombreCompleto" class="form-control" formControlName="nombreCompleto" required />
        </div>
        <div class="col-12 col-md-6">
          <label class="form-label">Correo</label>
          <input class="form-control" [value]="email()" readonly />
        </div>
        <div class="col-12">
          <button type="submit" class="btn btn-primary" [disabled]="guardando()">
            {{ guardando() ? 'Guardando...' : 'Guardar cambios' }}
          </button>
        </div>
      </form>
    </main>
  `
})
export class PerfilAdmin implements OnInit {
  private readonly fb = inject(FormBuilder);
  readonly email = signal('');
  readonly guardando = signal(false);
  readonly mensaje = signal('');
  readonly error = signal('');
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
    try {
      const userDoc = await getDoc(doc(db, NOMBRES_COLECCION.usuarios, user.uid));
      if (userDoc.exists()) {
        this.form.controls.nombreCompleto.setValue(
          String(userDoc.data()['nombreCompleto'] ?? user.displayName ?? '')
        );
      }
    } catch {
      this.error.set('No se pudo cargar el perfil.');
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
    this.guardando.set(true);
    try {
      await updateDoc(doc(db, NOMBRES_COLECCION.usuarios, user.uid), { nombreCompleto });
      await updateProfile(user, { displayName: nombreCompleto });
      localStorage.setItem('agilmente_user_name', nombreCompleto);
      this.mensaje.set('Perfil actualizado.');
    } catch {
      this.error.set('No se pudo guardar.');
    } finally {
      this.guardando.set(false);
    }
  }
}
