export type RolUsuario = 'administrador' | 'docente' | 'estudiante';

export interface UsuarioResumen {
  nombre: string;
  rol: RolUsuario;
  puntos: number;
  nivel: number;
  tituloNivel: string;
  avatarUrl?: string;
}

/** Usuario con su rol, para la gestión de usuarios del administrador. */
export interface UsuarioAdmin {
  uid: string;
  nombreCompleto: string;
  email: string;
  rol: RolUsuario;
}
