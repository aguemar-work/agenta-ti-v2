/** Identificadores UUID alineados con Postgres (`uuid`). */
export type Id = string;

export type RolUsuario = 'jefe' | 'miembro';

export type EstadoObjetivo = 'activo' | 'completado' | 'cancelado';

/** Nivel de riesgo calculado en el frontend a partir del % de avance y fecha_limite. */
export type NivelRiesgoObjetivo = 'critico' | 'moderado' | 'aceptable' | 'en_ritmo' | 'sin_fecha';

export type EstadoTarea =
  | 'pendiente'
  | 'en_progreso'
  | 'reprogramada'
  | 'completada'
  | 'bloqueada'
  | 'atrasada'
  | 'cancelada';

/** Urgencia visual de una tarea según la hora del día. Solo aplica en vista HOY. */
export type UrgenciaHoraria = 'normal' | 'precaucion' | 'urgente' | 'vencida_hoy';

/** 'libre' eliminado — las ideas sin fecha viven en bitácora. */
export type TipoTarea = 'planificada' | 'no_planificada';

export type PrioridadTarea = 'alta' | 'media' | 'baja';

export type TipoEvento = 'reunion' | 'entrega' | 'personal' | 'otro';

export type VisibilidadBitacora = 'todos' | 'solo_jefe' | 'privado';

export type TipoAccionLog =
  | 'creada'
  | 'iniciada'
  | 'reprogramada'
  | 'eliminada'
  | 'estado_cambiado'
  | 'prioridad_cambiada'
  | 'editada'
  | 'cancelada'
  | 'bloqueada'
  | 'desbloqueada'
  | 'completada';

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
  /** UUID de la nota de bitácora que originó esta tarea (trazabilidad). */
  nota_origen_id: Id | null;
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
  /** Tras revisión del jefe: aceptado | devuelto */
  resultado_revision_jefe?: 'aceptado' | 'devuelto' | null;
  created_at: string;
}

export interface LogOT {
  id: Id;
  ot_id: Id;
  usuario_id: Id;
  accion: 'creada' | 'enviada' | 'aprobada' | 'rechazada' | 'iniciada' | 'completada' | 'cancelada' | 'editada';
  estado_anterior: string | null;
  estado_nuevo: string | null;
  motivo: string | null;
  created_at: string;
}