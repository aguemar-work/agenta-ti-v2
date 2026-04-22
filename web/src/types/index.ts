/** Identificadores UUID alineados con Postgres (`uuid`). */
export type Id = string;

export type RolUsuario = 'jefe' | 'miembro';

export type EstadoObjetivo = 'activo' | 'completado' | 'cancelado';

export type EstadoTarea =
  | 'pendiente'
  | 'en_progreso'
  | 'reprogramada'
  | 'completada'
  | 'bloqueada'
  | 'atrasada'
  | 'cancelada';

export type TipoTarea = 'planificada' | 'no_planificada' | 'libre';

export type PrioridadTarea = 'alta' | 'media' | 'baja';

export type TipoEvento = 'reunion' | 'entrega' | 'personal' | 'otro';

export type VisibilidadBitacora = 'todos' | 'solo_jefe' | 'privado';

export type TipoAccionLog =
  | 'creada'
  | 'reprogramada'
  | 'eliminada'
  | 'estado_cambiado'
  | 'prioridad_cambiada'
  | 'editada'
  | 'cancelada';

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Usuario {
  id: Id;
  nombre: string;
  email: string;
  rol: RolUsuario;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

export interface Objetivo {
  id: Id;
  titulo: string;
  descripcion: string | null;
  fecha_limite: string | null;
  estado: EstadoObjetivo;
  creado_por: Id;
  /** Usuario responsable del objetivo (puede ser jefe o miembro). */
  responsable_id: Id | null;
  created_at: string;
  updated_at: string;
}

export interface Tarea {
  id: Id;
  titulo: string;
  descripcion: string | null;
  estado: EstadoTarea;
  tipo: TipoTarea;
  prioridad: PrioridadTarea;
  fecha_planificada: string | null;
  /** Semana ISO `YYYYWW` (p. ej. `202601`), almacenada como texto en BD. */
  semana_planificada: string | null;
  fecha_completada: string | null;
  asignado_a: Id;
  objetivo_id: Id | null;
  creado_por: Id;
  es_imprevisto: boolean;
  created_at: string;
  updated_at: string;
}

export interface Evento {
  id: Id;
  titulo: string;
  tipo: TipoEvento;
  fecha_inicio: string;
  fecha_fin: string;
  usuario_id: Id;
  es_recurrente: boolean;
  created_at: string;
  updated_at: string;
}

export interface NotaBitacora {
  id: Id;
  contenido: string;
  usuario_id: Id;
  objetivo_id: Id | null;
  visibilidad: VisibilidadBitacora;
  convertida_en: 'tarea' | 'evento' | null;
  usuario?: { nombre: string } | null;
  created_at: string;
  updated_at: string;
}

export interface LogAccion {
  id: Id;
  tarea_id: Id | null;
  usuario_id: Id;
  tipo_accion: TipoAccionLog;
  valor_anterior: Json | null;
  valor_nuevo: Json | null;
  justificacion: string | null;
  leido_por_jefe: boolean;
  created_at: string;
}

export interface ConfiguracionSemana {
  id: Id;
  fecha_inicio_semana: string;
  notas_semana: string | null;
  created_at: string;
  updated_at: string;
}
