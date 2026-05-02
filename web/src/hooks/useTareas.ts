import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { bloquearTareaConLog, reprogramarTareaConLog as reprogramarTareaConLogApi } from '@/api/semana';
import { fechaLocalYmd } from '@/lib/fecha';
import { getInsforge } from '@/lib/insforge';
import { publicarEventoEquipo } from '@/lib/realtimePublish';
import { parseTarea } from '@/lib/schemas';
import type { Tarea, Usuario } from '@/types';

const Q_HOY = 'tareas-hoy';

/**
 * Dispara el RPC `sgtd_marcar_atrasadas_equipo` al montar la vista.
 * La lógica de marcado está ahora en el servidor (trigger + RPC).
 * El trigger BEFORE UPDATE ya gestiona casos individuales en tiempo real;
 * este hook hace una pasada masiva al cargar la app por si hay tareas
 * que quedaron sin procesar (ej. usuario sin sesión activa varios días).
 */
export function useMarcarAtrasadasAlMontar(asignadoA: string | undefined) {
  const qc = useQueryClient();

  useEffect(() => {
    if (!asignadoA) return;
    let cancelled = false;
    void (async () => {
      try {
        await getInsforge().database.rpc('sgtd_marcar_atrasadas_equipo');
        if (!cancelled) {
          await qc.invalidateQueries({ refetchType: 'active', queryKey: [Q_HOY, asignadoA] });
        }
      } catch (err) {
        console.error('[useMarcarAtrasadasAlMontar]', err);
      }
    })();
    return () => { cancelled = true; };
  }, [asignadoA, qc]);
}

const prioridadOrden: Record<Tarea['prioridad'], number> = {
  alta: 0,
  media: 1,
  baja: 2,
};

export function useTareasHoy(asignadoA: string | undefined) {
  const hoy = fechaLocalYmd(new Date());
  return useQuery({
    queryKey: [Q_HOY, asignadoA, hoy],
    enabled: Boolean(asignadoA),
    queryFn: async () => {
      const insforge = getInsforge();
      const { data, error } = await insforge.database
        .from('tarea')
        .select('*')
        .eq('asignado_a', asignadoA!)
        .eq('tipo', 'planificada')
        .or(`fecha_planificada.eq.${hoy},estado.eq.atrasada`);
      if (error) throw error;
      const list = (data ?? []).map((r) => parseTarea(r as Record<string, unknown>));
      list.sort((a, b) => prioridadOrden[a.prioridad] - prioridadOrden[b.prioridad]);
      return list;
    },
  });
}

export function useUsuariosParaSelector(esJefe: boolean) {
  return useQuery({
    queryKey: ['usuarios-selector'],
    enabled: esJefe,
    queryFn: async () => {
      const insforge = getInsforge();
      const { data, error } = await insforge.database
        .from('usuario')
        .select('id,nombre,email,rol')
        .eq('activo', true)
        .order('nombre');
      if (error) throw error;
      return (data ?? []) as Pick<Usuario, 'id' | 'nombre' | 'email' | 'rol'>[];
    },
  });
}

export async function completarTarea(tareaId: string): Promise<void> {
  const insforge = getInsforge();
  const { error } = await insforge.database
    .from('tarea')
    .update({
      estado: 'completada',
      fecha_completada: new Date().toISOString(),
    })
    .eq('id', tareaId);
  if (error) throw error;
}

/**
 * Cierra la tarea y registra el resumen de trabajo.
 * La validación (mínimo 10 chars, permisos) ocurre en el servidor.
 */
export async function completarTareaConResumen(input: {
  tareaId: string;
  usuarioId: string;
  resumen: string;
  /** Opcionales — solo necesarios para la notificación realtime al Jefe */
  usuarioNombre?: string;
  tareaTitulo?: string;
  jefeId?: string;
  jefeIds?: string[];
}): Promise<void> {
  const { error } = await getInsforge().database.rpc('sgtd_completar_tarea_con_resumen', {
    p_tarea_id:   input.tareaId,
    p_usuario_id: input.usuarioId,
    p_resumen:    input.resumen.trim(),
  });
  if (error) throw error;

  const jefeIds = input.jefeIds ?? (input.jefeId ? [input.jefeId] : []);
  // Notificar al Jefe si se conoce su id
  if (jefeIds.length > 0) {
    const resumen = input.resumen.trim();
    void Promise.all(jefeIds.map((jefeId) =>
      publicarEventoEquipo({
        tipo:          'tarea_completada',
        jefeId,
        tareaId:       input.tareaId,
        titulo:        input.tareaTitulo ?? 'Tarea',
        usuarioNombre: input.usuarioNombre ?? 'Miembro',
        resumen,
      }),
    ));
  }
}

export async function reprogramarTareaConLog(input: {
  tareaId: string;
  usuarioId: string;
  nuevaFecha: string;
  justificacion: string;
  nuevoEstado?: Tarea['estado'];
}): Promise<void> {
  return reprogramarTareaConLogApi(input);
}

export async function bloquearTarea(input: {
  tareaId: string;
  usuarioId: string;
  justificacion: string;
}): Promise<void> {
  return bloquearTareaConLog(input);
}