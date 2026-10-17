import { Injectable } from '@angular/core';

import { Contacto, TipoContacto } from '@features/contactos/models/contacto.model';

/** Metadatos de presentación por tipo de contacto. */
interface TipoContactoInfo {
  etiqueta: string;
  icono: string;
  /** Color Bootstrap de acento (text-*). */
  color: string;
  /** Red social o canal externo que se abre en otra pestaña. */
  esRedSocial: boolean;
}

const INFO_TIPO: Record<TipoContacto, TipoContactoInfo> = {
  telefono: { etiqueta: 'Teléfono', icono: 'bi-telephone-fill', color: 'primary', esRedSocial: false },
  whatsapp: { etiqueta: 'WhatsApp', icono: 'bi-whatsapp', color: 'success', esRedSocial: true },
  correo: { etiqueta: 'Correo', icono: 'bi-envelope-fill', color: 'info', esRedSocial: false },
  facebook: { etiqueta: 'Facebook', icono: 'bi-facebook', color: 'primary', esRedSocial: true },
  instagram: { etiqueta: 'Instagram', icono: 'bi-instagram', color: 'danger', esRedSocial: true },
  tiktok: { etiqueta: 'TikTok', icono: 'bi-tiktok', color: 'dark', esRedSocial: true },
  youtube: { etiqueta: 'YouTube', icono: 'bi-youtube', color: 'danger', esRedSocial: true },
  otro: { etiqueta: 'Enlace', icono: 'bi-link-45deg', color: 'secondary', esRedSocial: true }
};

/**
 * Normaliza la sección «Contactos»: guarda en Firestore los canales
 * (teléfono, WhatsApp, correo y redes sociales) y calcula, en un único lugar,
 * el enlace con el que se abren desde la vista del estudiante.
 */
@Injectable({ providedIn: 'root' })
export class ContactoService {
  /** Opciones disponibles para el formulario de administración. */
  readonly tipos: { valor: TipoContacto; etiqueta: string; icono: string }[] = (
    Object.keys(INFO_TIPO) as TipoContacto[]
  ).map((valor) => ({
    valor,
    etiqueta: INFO_TIPO[valor].etiqueta,
    icono: INFO_TIPO[valor].icono
  }));

  etiquetaDe(tipo: TipoContacto): string {
    return INFO_TIPO[tipo]?.etiqueta ?? 'Enlace';
  }

  iconoDe(contacto: Contacto): string {
    return contacto.icono || INFO_TIPO[contacto.tipo]?.icono || 'bi-link-45deg';
  }

  colorDe(tipo: TipoContacto): string {
    return INFO_TIPO[tipo]?.color ?? 'secondary';
  }

  /**
   * URL de apertura del contacto:
   * - WhatsApp: `https://wa.me/<numero>` (o `api.whatsapp.com/send?text=` si es un enlace de invitación).
   * - Facebook: enlace completo, o `https://facebook.com/<usuario>` si se guardó el usuario.
   * - Teléfono: `tel:`; Correo: `mailto:`.
   */
  urlDe(contacto: Contacto): string {
    const valor = (contacto.valor ?? '').trim();
    if (!valor) {
      return '';
    }
    switch (contacto.tipo) {
      case 'telefono':
        return `tel:${valor.replace(/[^\d+]/g, '')}`;
      case 'correo':
        return `mailto:${valor}`;
      case 'whatsapp':
        return this.urlWhatsApp(valor);
      case 'facebook':
        return this.urlRedSocial(valor, 'https://facebook.com/');
      case 'instagram':
        return this.urlRedSocial(valor, 'https://instagram.com/');
      case 'tiktok':
        return this.urlRedSocial(valor, 'https://tiktok.com/@');
      case 'youtube':
        return this.urlRedSocial(valor, 'https://youtube.com/@');
      default:
        return valor;
    }
  }

  /** Indica si el contacto se abre en una pestaña nueva (redes sociales y enlaces). */
  abreEnNuevaPestana(contacto: Contacto): boolean {
    return INFO_TIPO[contacto.tipo]?.esRedSocial ?? false;
  }

  /** Texto legible del valor (oculta el código de país en los teléfonos si aplica). */
  valorVisible(contacto: Contacto): string {
    return (contacto.valor ?? '').trim();
  }

  private urlWhatsApp(valor: string): string {
    // Enlaces de invitación a grupos ya vienen con http(s) y un texto previo.
    if (/^https?:\/\//i.test(valor)) {
      return valor;
    }
    const numero = valor.replace(/[^\d]/g, '');
    if (!numero) {
      return '';
    }
    return `https://wa.me/${numero}`;
  }

  private urlRedSocial(valor: string, base: string): string {
    if (/^https?:\/\//i.test(valor)) {
      return valor;
    }
    return `${base}${valor.replace(/^@/, '')}`;
  }
}
