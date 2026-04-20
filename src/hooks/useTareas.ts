import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { fechaLocalYmd } from '@/lib/fecha';
import { getInsforge } from '@/lib/insforge';
import { semanaIsoDesdeFecha } from '@/lib/semanas';
import type { Tarea, Usuario } from '@/types';

const Q_HOY = 'tareas-hoy';

function parseTarea(row: Record<string, unknown>): Tarea {
  return row as unknown as Tarea;
}

async function marcarAtrasadasParaUsuario(usuarioId: string): Promise<void> {
  const insforge = getInsforge();
  const hoy = fechaLocalYmd(new Date());
  const { error } = await insforge.database
    .from('tarea')
    .update({ estado: 'atrasada' })
    .lt('fecha_planificada', hoy)
    .in('estado', ['pendiente', 'en_progreso', 'bloqueada'])
    .eq('tipo', 'planificada')
    .eq('asignado_a', usuarioId);
  if (error) throw error;
}

/** Transición automática a `atrasada` al montar la vista HOY (regla SGTD). */
export function useMarcarAtrasadasAlMontar(asignadoA: string | undefined) {
  const qc = useQueryClient();

  useEffect(() => {
    if (!asignadoA) return;
    let cancelled = false;
    void (async () => {
      try {
        await marcarAtrasadasParaUsuario(asignadoA);
        if (!cancelled) await qc.invalidateQueries({ queryKey: [Q_HOY, asignadoA] });
      } catch {
        /* RLS u red: no mostrar errores técnicos de token; la lista HOY sigue intentándose */
      }
    })();
    return () => {
      cancelled = true;
    };
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

/** Cierra la tarea y registra el resumen de trabajo (obligatorio en UI). */
export async function completarTareaConResumen(input: {
  tareaId: string;
  usuarioId: string;
  resumen: string;
}): Promise<void> {
  const res = input.resumen.trim();
  if (res.length < 10) {
    throw new Error('El resumen debe tener al menos 10 caracteres.');
  }
  const insforge = getInsforge();
  const { error: e1 } = await insforge.database
    .from('tarea')
    .update({
      estado: 'completada',
      fecha_completada: new Date().toISOString(),
    })
    .eq('id', input.tareaId);
  if (e1) throw e1;

  const { error: e2 } = await insforge.database.from('log_accion').insert([
    {
      tarea_id: input.tareaId,
      usuario_id: input.usuarioId,
      tipo_accion: 'editada',
      valor_anterior: null,
      valor_nuevo: { resumen_cierre: true },
      justificacion: res,
      leido_por_jefe: false,
    },
  ]);
  if (e2) throw e2;
}

export async function reprogramarTareaConLog(input: {
  tareaId: string;
  usuarioId: string;
  nuevaFecha: string;
  justificacion: string;
}): Promise<void> {
  const insforge = getInsforge();
  const semana = semanaIsoDesdeFecha(new Date(`${input.nuevaFecha}T12:00:00`));

  const { error: e1 } = await insforge.database
    .from('tarea')
    .update({
      fecha_planificada: input.nuevaFecha,
      semana_planificada: semana,
    })
    .eq('id', input.tareaId);
  if (e1) throw e1;

  const { error: e2 } = await insforge.database.from('log_accion').insert([
    {
      tarea_id: input.tareaId,
      usuario_id: input.usuarioId,
      tipo_accion: 'reprogramada',
      valor_anterior: null,
      valor_nuevo: { fecha_planificada: input.nuevaFecha },
      justificacion: input.justificacion,
    },
  ]);
  if (e2) throw e2;
}
