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

export type ModalidadOT = 'presencial' | 'remoto' | 'viaje';

export interface TipoTrabajoOT {
    id: Id;
    nombre: string;
    activo: boolean;
    created_at: string;
}

export interface OrdenTrabajo {
    id: Id;
    numero: string;
    creado_por: Id;
    tipo_trabajo_id: Id | null;
    tarea_id: Id | null;
    estado: EstadoOT;
    descripcion: string;
    area_destino: string;
    ubicacion: string | null;
    modalidad: ModalidadOT;
    fecha_estimada: string;
    hora_inicio_est: string | null;
    duracion_est_min: number | null;
    equipos_materiales: string | null;
    observaciones: string | null;
    aprobado_por: Id | null;
    fecha_aprobacion: string | null;
    motivo_rechazo: string | null;
    fecha_inicio_real: string | null;
    fecha_fin_real: string | null;
    observaciones_cierre: string | null;
    receptor_nombre: string | null;
    receptor_dni: string | null;
    receptor_cargo: string | null;
    created_at: string;
    updated_at: string;
    // Joins opcionales
    tipo_trabajo?: { nombre: string } | null;
    creador?: { nombre: string; email: string } | null;
    aprobador?: { nombre: string } | null;
    tarea?: { titulo: string } | null;
}

export type CrearOTInput = {
    creado_por: Id;
    tipo_trabajo_id?: Id | null;
    tarea_id?: Id | null;
    descripcion: string;
    area_destino: string;
    ubicacion?: string | null;
    modalidad: ModalidadOT;
    fecha_estimada: string;
    hora_inicio_est?: string | null;
    duracion_est_min?: number | null;
    equipos_materiales?: string | null;
    observaciones?: string | null;
    /** true = enviar directo a pendiente, false = guardar como borrador */
    enviar: boolean;
};

export type ActualizarOTInput = Omit<CrearOTInput, 'creado_por' | 'enviar'> & {
    otId: Id;
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
  tarea(titulo)
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

export async function getOrdenTrabajoPorId(id: Id): Promise<OrdenTrabajo | null> {
    const { data, error } = await getInsforge().database
        .from('orden_trabajo')
        .select(OT_SELECT)
        .eq('id', id)
        .maybeSingle();
    if (error) throw error;
    return data as OrdenTrabajo | null;
}

// ---------------------------------------------------------------------------
// OTs — mutaciones
// ---------------------------------------------------------------------------
export async function crearOrdenTrabajo(input: CrearOTInput): Promise<OrdenTrabajo> {
    const insforge = getInsforge();

    // Generar número correlativo via RPC
    const { data: numData, error: numError } = await insforge.database
        .rpc('generar_numero_ot');
    if (numError) throw numError;

    const row = {
        numero: numData as string,
        creado_por: input.creado_por,
        tipo_trabajo_id: input.tipo_trabajo_id ?? null,
        tarea_id: input.tarea_id ?? null,
        estado: input.enviar ? 'pendiente' : 'borrador',
        descripcion: input.descripcion.trim(),
        area_destino: input.area_destino.trim(),
        ubicacion: input.ubicacion?.trim() ?? null,
        modalidad: input.modalidad,
        fecha_estimada: input.fecha_estimada,
        hora_inicio_est: input.hora_inicio_est ?? null,
        duracion_est_min: input.duracion_est_min ?? null,
        equipos_materiales: input.equipos_materiales?.trim() ?? null,
        observaciones: input.observaciones?.trim() ?? null,
    };

    const { data, error } = await insforge.database
        .from('orden_trabajo')
        .insert([row])
        .select(OT_SELECT)
        .single();
    if (error) throw error;
    return data as OrdenTrabajo;
}

export async function actualizarOrdenTrabajo(input: ActualizarOTInput): Promise<void> {
    const patch = {
        tipo_trabajo_id: input.tipo_trabajo_id ?? null,
        tarea_id: input.tarea_id ?? null,
        estado: input.enviar ? 'pendiente' : 'borrador',
        descripcion: input.descripcion.trim(),
        area_destino: input.area_destino.trim(),
        ubicacion: input.ubicacion?.trim() ?? null,
        modalidad: input.modalidad,
        fecha_estimada: input.fecha_estimada,
        hora_inicio_est: input.hora_inicio_est ?? null,
        duracion_est_min: input.duracion_est_min ?? null,
        equipos_materiales: input.equipos_materiales?.trim() ?? null,
        observaciones: input.observaciones?.trim() ?? null,
        updated_at: new Date().toISOString(),
    };

    const { error } = await getInsforge().database
        .from('orden_trabajo')
        .update(patch)
        .eq('id', input.otId);
    if (error) throw error;
}

export async function cancelarOrdenTrabajo(otId: Id): Promise<void> {
    const { error } = await getInsforge().database
        .from('orden_trabajo')
        .update({ estado: 'cancelada', updated_at: new Date().toISOString() })
        .eq('id', otId);
    if (error) throw error;
}

export async function iniciarEjecucionOT(otId: Id): Promise<void> {
    const { error } = await getInsforge().database
        .from('orden_trabajo')
        .update({ estado: 'en_ejecucion', fecha_inicio_real: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', otId);
    if (error) throw error;
}

// Jefe: aprobar
export async function aprobarOT(otId: Id, usuarioId: Id): Promise<void> {
    const { error } = await getInsforge().database
        .rpc('sgtd_aprobar_ot', { p_ot_id: otId, p_usuario_id: usuarioId });
    if (error) throw error;
}

// Jefe: rechazar
export async function rechazarOT(otId: Id, usuarioId: Id, motivo: string): Promise<void> {
    const { error } = await getInsforge().database
        .rpc('sgtd_rechazar_ot', { p_ot_id: otId, p_usuario_id: usuarioId, p_motivo: motivo });
    if (error) throw error;
}

// Miembro: completar con datos del receptor
export async function completarOT(input: {
    otId: Id;
    receptorNombre: string;
    receptorDni: string;
    receptorCargo: string;
    observaciones?: string;
}): Promise<void> {
    const { error } = await getInsforge().database
        .rpc('sgtd_completar_ot', {
            p_ot_id: input.otId,
            p_receptor_nombre: input.receptorNombre,
            p_receptor_dni: input.receptorDni,
            p_receptor_cargo: input.receptorCargo,
            p_observaciones: input.observaciones ?? null,
        });
    if (error) throw error;
}