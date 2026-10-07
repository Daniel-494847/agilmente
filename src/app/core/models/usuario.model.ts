export type RolUsuario = 'administrador' | 'docente' | 'estudiante';

export interface UsuarioResumen {
  nombre: string;
  rol: RolUsuario;
  puntos: number;
  nivel: number;
  tituloNivel: string;
  avatarUrl?: string;
}
