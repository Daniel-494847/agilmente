const menuItems = [
  { title: 'Biblioteca Digital', description: 'Recursos, guías y material de apoyo.', icon: 'bi-book', route: '/biblioteca' },
  { title: 'Mi Progreso', description: 'Seguimiento de logros y avances.', icon: 'bi-bar-chart', route: '/progreso' },
  { title: 'Avisos y Comunicados', description: 'Novedades y recordatorios de la comunidad.', icon: 'bi-bell', route: '/avisos' },
  { title: 'Unidad Educativa', description: 'Información institucional y contacto.', icon: 'bi-building', route: '/unidad-educativa' },
  { title: 'Perfil', description: 'Configuración y datos del estudiante.', icon: 'bi-person-circle', route: '/perfil' }
];

export const itemsRelacionados = (ruta: string) => menuItems.filter((item) => item.route !== ruta);

export const secciones = {
  progreso: {
    title: 'Mi Progreso',
    description: 'Visualiza tus logros, metas y evolución en cada reto.',
    badge: 'Estadísticas',
    contentId: 'progreso',
    items: itemsRelacionados('/progreso')
  },
  unidadEducativa: {
    title: 'Unidad Educativa',
    description: 'Conoce la comunidad, valores y espacios de aprendizaje.',
    badge: 'Institución',
    items: itemsRelacionados('/unidad-educativa')
  },
  perfil: {
    title: 'Perfil',
    description: 'Consulta tus datos personales y ajustes de cuenta.',
    badge: 'Cuenta',
    items: itemsRelacionados('/perfil')
  }
};
