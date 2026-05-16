/**
 * hooks/useSemanaDnD.ts
 *
 * Estado y handlers de Drag & Drop para la vista Mi Semana.
 * Extraído de useMiSemanaPage para separar responsabilidades.
 */

import {
  type DragEndEvent,
  type DragOverEvent,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

import { reprogramarTareaConLog } from '@/hooks/useTareas';
import { resolverEstadoReprogramacion } from '@/lib/tareaEstado';
import { semanaIsoDesdeFecha } from '@/lib/semanas';
import type { Tarea } from '@/types';

/** Mouse: evita activar drag en clics accidentales. */
export const SEMANA_DND_POINTER_ACTIVATION = { distance: 8 } as const;

/**
 * Touch: delay distingue scroll vertical de intención de drag (M-01).
 * Sin delay, el scroll de la columna del día queda bloqueado.
 */
export const SEMANA_DND_TOUCH_ACTIVATION = { delay: 250, tolerance: 5 } as const;

/** Sensores DnD Mi Semana — usar en `DndContext` de la grilla semanal. */
export function useSemanaDnDSensors() {
  return useSensors(
    useSensor(PointerSensor, { activationConstraint: SEMANA_DND_POINTER_ACTIVATION }),
    useSensor(TouchSensor,   { activationConstraint: SEMANA_DND_TOUCH_ACTIVATION }),
  );
}

export function useSemanaDnD({
  tareasPlan,
  hoyYmd,
  usuarioId,
  onMoverDia,
  onReprDragConfirmado,
}: {
  tareasPlan:            Tarea[];
  hoyYmd:                string;
  usuarioId:             string | undefined;
  onMoverDia:            (p: { tareaId: string; fecha: string; semana: string }) => Promise<void>;
  /** Callback que ejecuta la invalidación de queries tras confirmar reprogramación por drag */
  onReprDragConfirmado?: () => Promise<void>;
}) {
  // ── Estado ────────────────────────────────────────────────────────────────
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [overId,       setOverId]       = useState<string | null>(null);

  // Modal de justificación al arrastrar a otro día
  const [reprDragTarea, setReprDragTarea] = useState<{
    tarea:  Tarea;
    fecha:  string;
    semana: string;
  } | null>(null);

  // ── Mapa de tareas para lookup O(1) ──────────────────────────────────────
  const tareaPorId = useMemo(() => {
    const m = new Map<string, Tarea>();
    for (const t of tareasPlan) m.set(t.id, t);
    return m;
  }, [tareasPlan]);

  const activeTareaDrag = useMemo(() => {
    if (!activeDragId) return null;
    const tid = String(activeDragId).replace('tarea-', '');
    return tareaPorId.get(tid) ?? null;
  }, [activeDragId, tareaPorId]);

  // ── Handlers ─────────────────────────────────────────────────────────────
  function onDragOver(ev: DragOverEvent) {
    setOverId(ev.over ? String(ev.over.id) : null);
  }

  async function onDragEnd(ev: DragEndEvent) {
    const { active, over } = ev;
    setActiveDragId(null);
    setOverId(null);
    if (!over || !active.id) return;

    const tid = String(active.id).replace('tarea-', '');
    const t   = tareaPorId.get(tid);
    if (!t) return;
    if (t.estado === 'completada' || t.estado === 'cancelada') return;

    const oid = String(over.id);
    if (!oid.startsWith('day-')) return;

    const fecha = oid.slice(4);
    const sem   = semanaIsoDesdeFecha(new Date(`${fecha}T12:00:00`));

    // Si es planificada y cambia de día → pedir justificación
    if (t.tipo === 'planificada' && t.fecha_planificada && t.fecha_planificada !== fecha) {
      setReprDragTarea({ tarea: t, fecha, semana: sem });
      return;
    }

    try {
      await onMoverDia({ tareaId: tid, fecha, semana: sem });
    } catch (err) {
      console.error('[onDragEnd]', err);
      toast.error('No se pudo mover la tarea.');
    }
  }

  async function confirmarReprDrag(input: {
    tareaId:       string;
    nuevaFecha:    string;
    justificacion: string;
  }) {
    if (!reprDragTarea || !usuarioId) return;
    const { tarea: t, semana } = reprDragTarea;
    try {
      const nuevoEstado = resolverEstadoReprogramacion(t, hoyYmd);
      await reprogramarTareaConLog({
        tareaId:       input.tareaId,
        usuarioId,
        nuevaFecha:    input.nuevaFecha,
        justificacion: input.justificacion,
        nuevoEstado,
      });
      setReprDragTarea(null);
      toast.success('Tarea reprogramada');
      await onMoverDia({ tareaId: input.tareaId, fecha: input.nuevaFecha, semana });
      await onReprDragConfirmado?.();
    } catch (err) {
      console.error('[confirmarReprDrag]', err);
      toast.error('No se pudo reprogramar la tarea.');
    }
  }

  return {
    // Estado
    activeDragId, setActiveDragId,
    overId,
    reprDragTarea, setReprDragTarea,
    tareaPorId,
    activeTareaDrag,

    // Handlers
    onDragOver,
    onDragEnd,
    confirmarReprDrag,
  };
}