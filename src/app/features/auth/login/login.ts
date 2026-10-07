import { Component, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut
} from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';

import { auth, colecciones, db, NOMBRES_COLECCION } from '../../../core/firebase';

type TipoUsuario = 'estudiante' | 'docente' | 'administrador';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule],
  templateUrl: './login.html'
})
export class Login {
  readonly form;
  readonly isSubmitting = signal(false);
  readonly errorMessage = signal('');
  readonly modoRegistro = signal(false);
  readonly tipoUsuario = signal<TipoUsuario>('estudiante');

  constructor(
    private readonly fb: FormBuilder,
    private readonly router: Router,
    private readonly route: ActivatedRoute
  ) {
    this.form = this.fb.nonNullable.group({
      nombreCompleto: ['', [Validators.required, Validators.minLength(3)]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      tipoUsuario: ['estudiante', Validators.required]
    });
    this.modoRegistro.set(this.route.snapshot.queryParamMap.get('registro') === '1');
    this.actualizarCampoNombre();
  }

  toggleModo(): void {
    this.modoRegistro.update((v) => !v);
    this.errorMessage.set('');
    this.form.get('tipoUsuario')?.setValue(this.tipoUsuario());
    this.actualizarCampoNombre();
  }

  seleccionarTipo(tipo: TipoUsuario): void {
    this.tipoUsuario.set(tipo);
    this.form.get('tipoUsuario')?.setValue(tipo);
  }

  async iniciarSesion(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.errorMessage.set('Ingresa un correo y una contraseña válidos.');
      return;
    }
    const { email, password } = this.form.getRawValue();
    this.isSubmitting.set(true);
    this.errorMessage.set('');
    try {
      const credential = await signInWithEmailAndPassword(auth, email, password);
      await setDoc(
        doc(db, NOMBRES_COLECCION.usuarios, credential.user.uid),
        { ultimoIngreso: serverTimestamp() },
        { merge: true }
      );
      const nombre = localStorage.getItem('agilmente_user_name') ?? 'Usuario';
      localStorage.setItem(
        'agilmente_session',
        JSON.stringify({ uid: credential.user.uid, email, nombre, rol: 'estudiante' })
      );
      this.router.navigateByUrl('/inicio');
    } catch {
      this.errorMessage.set('Credenciales incorrectas o error de conexión.');
    } finally {
      this.isSubmitting.set(false);
    }
  }

  async registrarUsuario(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.errorMessage.set('Completa todos los campos.');
      return;
    }
    const { nombreCompleto, email, password } = this.form.getRawValue();
    const tipo = this.tipoUsuario();
    this.isSubmitting.set(true);
    this.errorMessage.set('');
    try {
      const credential = await createUserWithEmailAndPassword(auth, email, password);
      await setDoc(doc(colecciones.usuarios, credential.user.uid), {
        email,
        nombreCompleto: nombreCompleto.trim(),
        rol: tipo === 'administrador' ? 'estudiante' : tipo,
        creadoEn: serverTimestamp(),
        ultimoIngreso: serverTimestamp()
      });
      localStorage.setItem('agilmente_user_name', nombreCompleto.trim());
      this.router.navigateByUrl('/inicio');
    } catch {
      this.errorMessage.set('No se pudo completar el registro.');
    } finally {
      this.isSubmitting.set(false);
    }
  }

  async iniciarConGoogle(): Promise<void> {
    this.isSubmitting.set(true);
    this.errorMessage.set('');
    try {
      if (auth.currentUser) await signOut(auth);
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const credential = await signInWithPopup(auth, provider);
      const uid = credential.user.uid;
      const userDoc = await getDoc(doc(colecciones.usuarios, uid));
      const data = {
        email: credential.user.email ?? '',
        nombreCompleto: credential.user.displayName ?? 'Usuario',
        rol: this.tipoUsuario() === 'docente' ? 'docente' : 'estudiante',
        ultimoIngreso: serverTimestamp()
      };
      if (!userDoc.exists()) {
        await setDoc(doc(colecciones.usuarios, uid), data);
      } else {
        await setDoc(doc(colecciones.usuarios, uid), { ultimoIngreso: serverTimestamp() }, { merge: true });
      }
      localStorage.setItem('agilmente_user_name', data.nombreCompleto);
      this.router.navigateByUrl('/inicio');
    } catch {
      this.errorMessage.set('No se pudo iniciar con Google.');
    } finally {
      this.isSubmitting.set(false);
    }
  }

  private actualizarCampoNombre(): void {
    const nombre = this.form.controls.nombreCompleto;
    if (this.modoRegistro()) nombre.enable();
    else nombre.disable();
  }
}
