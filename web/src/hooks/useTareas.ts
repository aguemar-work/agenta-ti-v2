import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { cambiarEstadoTarea, reprogramarTareaConLog as reprogramarTareaConLogApi } from '@/api/semana';
import { fechaLocalYmd } from '@/lib/fecha';
import { getInsforge } from '@/lib/insforge';
import { publicarEventoEquipo } from '@/lib/realtimePublish';
import { parseTarea } from '@/lib/schemas';
import type { Tarea, Usuario } from '@/types';

const Q_HOY = 'tareas-hoy';

// Throttle: ejecutar el RPC de marcado como máximo 1 vez cada 30 minutos por sesión.
// Sin esto, el RPC se dispara en cada navegación a /semana haciendo un UPDATE masivo
// innecesario en la tabla de tareas.
const THROTTLE_KEY    = 'sgtd-marcar-atrasadas-ts';
const THROTTLE_MS     = 30 * 60 * 1000; // 30 minutos

function debeEjecutarMarcarAtrasadas(): boolean {
  try {
    const ts = sessionStorage.getItem(THROTTLE_KEY);
    if (!ts) return true;
    return Date.now() - Number(ts) > THROTTLE_MS;
  } catch {
    return true; // sessionStorage no disponible → ejecutar igual
  }
}

function registrarEjecucionMarcarAtrasadas(): void {
  try {
    sessionStorage.setItem(THROTTLE_KEY, String(Date.now()));
  } catch { /* ignorar */ }
}

/**
 * Dispara el RPC `sgtd_marcar_atrasadas_equipo` al montar la vista,
 * con throttle de 30 minutos por sesión para evitar UPDATE masivos en
 * cada navegación.
 *
 * El trigger BEFORE UPDATE gestiona casos individuales en tiempo real;
 * este hook hace una pasada masiva para tareas que quedaron sin procesar
 * (ej. usuario sin sesión activa varios días).
 */
export function useMarcarAtrasadasAlMontar(asignadoA: string | undefined) {
  const qc = useQueryClient();

  useEffect(() => {
    if (!asignadoA) return;
    if (!debeEjecutarMarcarAtrasadas()) return;
    let cancelled = false;
    void (async () => {
      try {
        registrarEjecucionMarcarAtrasadas();
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
    .update({ estado: 'completada', fecha_completada: new Date().toISOString() })
    .eq('id', tareaId);
  if (error) throw error;
}

export async function completarTareaConResumen(input: {
  tareaId:        string;
  usuarioId:      string;
  resumen:        string;
  usuarioNombre?: string;
  tareaTitulo?:   string;
  jefeId?:        string;
  jefeIds?:       string[];
}): Promise<void> {
  const { error } = await getInsforge().database.rpc('sgtd_completar_tarea_con_resumen', {
    p_tarea_id:   input.tareaId,
    p_usuario_id: input.usuarioId,
    p_resumen:    input.resumen.trim(),
  });
  if (error) throw error;

  const jefeIds = input.jefeIds ?? (input.jefeId ? [input.jefeId] : []);
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
  tareaId:       string;
  usuarioId:     string;
  nuevaFecha:    string;
  justificacion: string;
  nuevoEstado?:  Tarea['estado'];
}): Promise<void> {
  return reprogramarTareaConLogApi(input);
}

/**
 * Bloquea una tarea con justificación.
 * Usa la nueva RPC sgtd_cambiar_estado_tarea que registra el log automáticamente.
 */
export async function bloquearTarea(input: {
  tareaId:       string;
  usuarioId:     string;
  justificacion: string;
}): Promise<void> {
  return cambiarEstadoTarea({
    tareaId:        input.tareaId,
    nuevoEstado:    'bloqueada',
    justificacion:  input.justificacion,
  });
}