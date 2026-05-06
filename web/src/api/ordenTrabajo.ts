/**
 * api/ordenTrabajo.ts
 * Capa de acceso a datos para Órdenes de Trabajo.
 */

import { getInsforge } from '@/lib/insforge';
import type { Id } from '@/types';

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------
export type EstadoOT =
  | 'borrador'
  | 'pendiente'
  | 'aprobada'
  | 'en_ejecucion'
  | 'completada'
  | 'rechazada'
  | 'cancelada';

export type ModalidadOT  = 'presencial' | 'remoto' | 'viaje';
export type PrioridadOT  = 'normal' | 'urgente';

export interface TipoTrabajoOT {
  id:         Id;
  nombre:     string;
  activo:     boolean;
  created_at: string;
}

export interface OrdenTrabajo {
  id:                   Id;
  numero:               string;
  creado_por:           Id;
  tipo_trabajo_id:      Id | null;
  tarea_id:             Id | null;
  objetivo_id:          Id | null;
  estado:               EstadoOT;
  prioridad:            PrioridadOT;
  descripcion:          string;
  area_destino:         string;
  ubicacion:            string | null;
  modalidad:            ModalidadOT;
  fecha_estimada:       string;
  hora_inicio_est:      string | null;
  duracion_est_min:     number | null;
  equipos_materiales:   string | null;
  observaciones:        string | null;
  aprobado_por:         Id | null;
  fecha_aprobacion:     string | null;
  motivo_rechazo:       string | null;
  fecha_inicio_real:    string | null;
  fecha_fin_real:       string | null;
  observaciones_cierre: string | null;
  receptor_nombre:      string | null;
  receptor_dni:         string | null;
  receptor_cargo:       string | null;
  created_at:           string;
  updated_at:           string;
  tipo_trabajo?:        { nombre: string } | null;
  creador?:             { nombre: string; email: string } | null;
  aprobador?:           { nombre: string } | null;
  tarea?:               { titulo: string } | null;
  objetivo?:            { titulo: string } | null;
}

export type CrearOTInput = {
  creado_por:          Id;
  tipo_trabajo_id?:    Id | null;
  tarea_id?:           Id | null;
  objetivo_id?:        Id | null;
  descripcion:         string;
  area_destino:        string;
  ubicacion?:          string | null;
  modalidad:           ModalidadOT;
  fecha_estimada:      string;
  hora_inicio_est?:    string | null;
  duracion_est_min?:   number | null;
  equipos_materiales?: string | null;
  observaciones?:      string | null;
  prioridad?:          PrioridadOT;
  /** true = enviar directo a pendiente, false = guardar como borrador */
  enviar:              boolean;
};

export type ActualizarOTInput = Omit<CrearOTInput, 'creado_por' | 'enviar'> & {
  otId:   Id;
  enviar: boolean;
};

// ---------------------------------------------------------------------------
// Tipos de trabajo
// ---------------------------------------------------------------------------
export async function getTiposTrabajoOT(): Promise<TipoTrabajoOT[]> {
  const { data, error } = await getInsforge().database
    .from('tipo_trabajo_ot')
    .select('*')
    .eq('activo', true)
    .order('nombre');
  if (error) throw error;
  return (data ?? []) as TipoTrabajoOT[];
}

export async function crearTipoTrabajoOT(nombre: string, createdBy: Id): Promise<TipoTrabajoOT> {
  const { data, error } = await getInsforge().database
    .from('tipo_trabajo_ot')
    .insert([{ nombre: nombre.trim().toUpperCase(), created_by: createdBy }])
    .select('*')
    .single();
  if (error) throw error;
  return data as TipoTrabajoOT;
}

export async function toggleTipoTrabajoOT(id: Id, activo: boolean): Promise<void> {
  const { error } = await getInsforge().database
    .from('tipo_trabajo_ot')
    .update({ activo })
    .eq('id', id);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// OTs — queries
// ---------------------------------------------------------------------------
const OT_SELECT = `
  *,
  tipo_trabajo:tipo_trabajo_ot(nombre),
  creador:usuario!orden_trabajo_creado_por_fkey(nombre, email),
  aprobador:usuario!orden_trabajo_aprobado_por_fkey(nombre),
  tarea(titulo),
  objetivo(titulo)
`;

export async function getOrdenesTrabajoMiembro(usuarioId: Id): Promise<OrdenTrabajo[]> {
  const { data, error } = await getInsforge().database
    .from('orden_trabajo')
    .select(OT_SELECT)
    .eq('creado_por', usuarioId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as OrdenTrabajo[];
}

export async function getOrdenesTrabajoTodas(): Promise<OrdenTrabajo[]> {
  const { data, error } = await getInsforge().database
    .from('orden_trabajo')
    .select(OT_SELECT)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as OrdenTrabajo[];
}

// ---------------------------------------------------------------------------
// OTs — mutaciones
// ---------------------------------------------------------------------------
export async function crearOrdenTrabajo(input: CrearOTInput): Promise<OrdenTrabajo> {
  const insforge = getInsforge();
  const row = {
    creado_por:          input.creado_por,
    tipo_trabajo_id:     input.tipo_trabajo_id ?? null,
    tarea_id:            input.tarea_id ?? null,
    objetivo_id:         input.objetivo_id ?? null,
    estado:              input.enviar ? 'pendiente' : 'borrador',
    prioridad:           input.prioridad ?? 'normal',
    descripcion:         input.descripcion.trim(),
    area_destino:        input.area_destino.trim(),
    ubicacion:           input.ubicacion ?? null,
    modalidad:           input.modalidad,
    fecha_estimada:      input.fecha_estimada,
    hora_inicio_est:     input.hora_inicio_est ?? null,
    duracion_est_min:    input.duracion_est_min ?? null,
    equipos_materiales:  input.equipos_materiales ?? null,
    observaciones:       input.observaciones ?? null,
  };
  const { data: inserted, error } = await insforge.database
    .from('orden_trabajo').insert([row]).select(OT_SELECT).single();
  if (error) throw error;
  return inserted as OrdenTrabajo;
}

export async function actualizarOrdenTrabajo(input: ActualizarOTInput): Promise<OrdenTrabajo> {
  const insforge = getInsforge();
  const { otId, enviar, ...rest } = input;
  const updates = {
    ...rest,
    prioridad:    rest.prioridad ?? 'normal',
    descripcion:  rest.descripcion.trim(),
    area_destino: rest.area_destino.trim(),
    estado:       enviar ? 'pendiente' : 'borrador',
  };
  const { data: updated, error } = await insforge.database
    .from('orden_trabajo').update(updates).eq('id', otId).select(OT_SELECT).single();
  if (error) throw error;
  return updated as OrdenTrabajo;
}

export async function aprobarOT(otId: Id, usuarioId: Id): Promise<void> {
  const { error } = await getInsforge().database.rpc('sgtd_aprobar_ot', {
    p_ot_id:      otId,
    p_usuario_id: usuarioId,
  });
  if (error) throw error;
}

export async function rechazarOT(otId: Id, usuarioId: Id, motivo: string): Promise<void> {
  const { error } = await getInsforge().database.rpc('sgtd_rechazar_ot', {
    p_ot_id:      otId,
    p_usuario_id: usuarioId,
    p_motivo:     motivo.trim(),
  });
  if (error) throw error;
}

export async function iniciarEjecucionOT(otId: Id, usuarioId: Id): Promise<void> {
  const { error } = await getInsforge().database.rpc('sgtd_iniciar_ejecucion_ot', {
    p_ot_id:      otId,
    p_usuario_id: usuarioId,
  });
  if (error) throw error;
}

export async function completarOT(input: {
  otId:                 Id;
  usuarioId:            Id;
  receptorNombre:       string;
  receptorDni:          string;
  receptorCargo:        string;
  observacionesCierre?: string;
}): Promise<void> {
  const { error } = await getInsforge().database.rpc('sgtd_completar_ot', {
    p_ot_id:                input.otId,
    p_usuario_id:           input.usuarioId,
    p_receptor_nombre:      input.receptorNombre.trim(),
    p_receptor_dni:         input.receptorDni.trim(),
    p_receptor_cargo:       input.receptorCargo.trim(),
    p_observaciones_cierre: input.observacionesCierre?.trim() ?? null,
  });
  if (error) throw error;
}

export async function cancelarOrdenTrabajo(otId: Id, usuarioId: Id): Promise<void> {
  const { error } = await getInsforge().database.rpc('sgtd_cancelar_ot', {
    p_ot_id:      otId,
    p_usuario_id: usuarioId,
  });
  if (error) throw error;
}

/**
 * Crea una OT pre-rellenada a partir de una incidencia abierta.
 * Retorna el UUID de la OT creada en estado 'borrador'.
 */
export async function crearOTDesdeIncidencia(input: {
  incidenciaId:    Id;
  tipoTrabajoId?:  Id | null;
  fechaEstimada?:  string | null;
  prioridad?:      PrioridadOT;
}): Promise<string> {
  const { data, error } = await getInsforge().database.rpc('sgtd_crear_ot_desde_incidencia', {
    p_incidencia_id:   input.incidenciaId,
    p_tipo_trabajo_id: input.tipoTrabajoId ?? null,
    p_fecha_estimada:  input.fechaEstimada ?? null,
    p_prioridad:       input.prioridad ?? 'normal',
  });
  if (error) throw error;
  return data as string;
}