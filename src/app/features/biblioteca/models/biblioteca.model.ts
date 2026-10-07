export const CATEGORIAS_MATERIAL = [
  'General',
  'Grado 1',
  'Grado 2',
  'Grado 3',
  'Grado 4',
  'Grado 5',
  'Grado 6',
  'Sucesiones y patrones',
  'Conteo de figuras',
  'Relaciones y analogías',
  'Operaciones con números naturales',
  'Operadores matemáticos',
  'Geometría básica'
] as const;

export type CategoriaMaterial = (typeof CATEGORIAS_MATERIAL)[number];
export type TipoMaterial = 'archivo' | 'documento' | 'hoja' | 'presentacion' | 'carpeta';

export interface MaterialBiblioteca {
  id: string;
  titulo: string;
  descripcion: string;
  categoria: CategoriaMaterial;
  tipo: TipoMaterial;
  enlace: string;
  driveId: string;
  publicado: boolean;
  creadoEn: number;
}

export type DatosMaterial = Omit<MaterialBiblioteca, 'id' | 'creadoEn'>;

export const ICONO_TIPO: Record<TipoMaterial, string> = {
  archivo: 'bi-file-earmark',
  documento: 'bi-file-earmark-text',
  hoja: 'bi-file-earmark-spreadsheet',
  presentacion: 'bi-file-earmark-slides',
  carpeta: 'bi-folder2-open'
};

export const ETIQUETA_TIPO: Record<TipoMaterial, string> = {
  archivo: 'Archivo',
  documento: 'Documento',
  hoja: 'Hoja de cálculo',
  presentacion: 'Presentación',
  carpeta: 'Carpeta'
};

export interface EnlaceDrive {
  driveId: string;
  tipo: TipoMaterial;
  enlace: string;
}

const PATRONES: { regex: RegExp; tipo: TipoMaterial }[] = [
  { regex: /\/document\/(?:u\/\d+\/)?d\/([\w-]{10,})/, tipo: 'documento' },
  { regex: /\/spreadsheets\/(?:u\/\d+\/)?d\/([\w-]{10,})/, tipo: 'hoja' },
  { regex: /\/presentation\/(?:u\/\d+\/)?d\/([\w-]{10,})/, tipo: 'presentacion' },
  { regex: /\/file\/(?:u\/\d+\/)?d\/([\w-]{10,})/, tipo: 'archivo' },
  { regex: /\/folders\/([\w-]{10,})/, tipo: 'carpeta' }
];

const ENLACE_LIMPIO: Record<TipoMaterial, (id: string) => string> = {
  archivo: (id) => `https://drive.google.com/file/d/${id}/view`,
  documento: (id) => `https://docs.google.com/document/d/${id}/edit`,
  hoja: (id) => `https://docs.google.com/spreadsheets/d/${id}/edit`,
  presentacion: (id) => `https://docs.google.com/presentation/d/${id}/edit`,
  carpeta: (id) => `https://drive.google.com/drive/folders/${id}`
};

export function analizarEnlaceDrive(texto: string): EnlaceDrive | null {
  let url: URL;
  try {
    url = new URL(texto.trim());
  } catch {
    return null;
  }

  const hostValido = url.hostname === 'drive.google.com' || url.hostname === 'docs.google.com';
  if (url.protocol !== 'https:' || !hostValido) {
    return null;
  }

  for (const { regex, tipo } of PATRONES) {
    const coincidencia = url.pathname.match(regex);
    if (coincidencia) {
      return { driveId: coincidencia[1], tipo, enlace: ENLACE_LIMPIO[tipo](coincidencia[1]) };
    }
  }

  const idAntiguo = url.searchParams.get('id');
  if (url.hostname === 'drive.google.com' && idAntiguo && /^[\w-]{10,}$/.test(idAntiguo)) {
    return { driveId: idAntiguo, tipo: 'archivo', enlace: ENLACE_LIMPIO.archivo(idAntiguo) };
  }

  return null;
}
