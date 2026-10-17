/** Canales de contacto y redes sociales disponibles. */
export type TipoContacto =
  | 'telefono'
  | 'whatsapp'
  | 'correo'
  | 'facebook'
  | 'instagram'
  | 'tiktok'
  | 'youtube'
  | 'otro';

/** Un canal de contacto o red social mostrado en la sección «Contactos». */
export interface Contacto {
  id: string;
  /** Nombre visible del canal (p. ej. «Secretaría» o «Facebook oficial»). */
  nombre: string;
  tipo: TipoContacto;
  /** Teléfono, número de WhatsApp, correo, usuario o enlace, según el tipo. */
  valor: string;
  descripcion?: string;
  /** Icono de Bootstrap Icons; si falta, se usa el icono por defecto del tipo. */
  icono?: string;
  publicado: boolean;
  creadoEn?: number;
}
