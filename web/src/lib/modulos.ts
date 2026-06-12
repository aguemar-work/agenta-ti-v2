export interface ModuloCatalogo {
  clave: string;
  nombre: string;
  descripcion: string;
  obligatorio: boolean;
}

export const CATALOGO_MODULOS: ModuloCatalogo[] = [
  { clave: 'objetivos',       nombre: 'Objetivos',          descripcion: 'Metas con progreso',        obligatorio: false },
  { clave: 'bitacora',        nombre: 'Bitácora',           descripcion: 'Notas y conversiones',      obligatorio: true },
  { clave: 'areas',           nombre: 'Áreas',              descripcion: 'TI, Producción, Ventas…',   obligatorio: false },
  { clave: 'proyectos',       nombre: 'Proyectos',          descripcion: 'Agrupar tareas',            obligatorio: false },
  { clave: 'clientes',        nombre: 'Clientes',           descripcion: 'Clientes externos',         obligatorio: false },
  { clave: 'ordenes_trabajo', nombre: 'Órdenes de trabajo', descripcion: 'Flujo con aprobación',      obligatorio: false },
];

export const MODULOS_OBLIGATORIOS = CATALOGO_MODULOS.filter((m) => m.obligatorio).map((m) => m.clave);

/** Genera un slug URL-safe desde el nombre. */
export function slugify(nombre: string): string {
  return nombre
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
