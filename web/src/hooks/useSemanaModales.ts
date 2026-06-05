/**
 * hooks/useSemanaModales.ts
 *
 * Estado de modales de Mi Semana y handlers (completar, reprogramar, editar, eliminar, iniciar).
 */

import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';

import { reprogramarTareaConLog } from '@/api/semana';
import { useMiSemanaMutations } from '@/hooks/useMiSemana';
import { invalidateRelatedQueries } from '@/lib/queryHelpers';
import type { Tarea, TipoEvento, Usuario } from '@/types';

type MiSemanaMut = ReturnType<typeof useMiSemanaMutations>;

export function useSemanaModales({
  tareasPlan,
  usuario,
  jefesNotificacion,
  mut,
}: {
  tareasPlan:        Tarea[];
  hoyYmd:            string;
  usuario:           Usuario | null | undefined;
  jefesNotificacion: { id: string }[];
  mut:               MiSemanaMut;
}) {
  const qc = useQueryClient();

  const [modal,            setModal]            = useState<{ fecha: string } | null>(null);
  const [modalInc,         setModalInc]         = useState(false);
  const [detalleTareaId,   setDetalleTareaId]   = useState<string | null>(null);
  const [completarTareaId, setCompletarTareaId] = useState<string | null>(null);
  const [reprDetalleTarea, setReprDetalleTarea] = useState<Tarea | null>(null);

  const tareaPorId = new Map(tareasPlan.map((t) => [t.id, t]));

  const tareaDetalle   = detalleTareaId   ? (tareaPorId.get(detalleTareaId)   ?? null) : null;
  const tareaCompletar = completarTareaId ? (tareaPorId.get(completarTareaId) ?? null) : null;

  async function confirmarReprDetalle(input: {
    tareaId:       string;
    nuevaFecha:    string;
    justificacion: string;
  }) {
    if (!reprDetalleTarea || !usuario) return;
    try {
      await reprogramarTareaConLog({ ...input, usuarioId: usuario.id });
      setReprDetalleTarea(null);
      toast.success('Tarea reprogramada');
      await invalidateRelatedQueries(qc, ['semana', 'tareas-hoy', 'planificacion']);
    } catch (err) {
      console.error('[confirmarReprDetalle]', err);
      toast.error('No se pudo reprogramar la tarea.');
    }
  }

  async function confirmarCompletar(input: { tareaId: string; resumen: string }) {
    if (!usuario) return;
    try {
      await mut.completarTareaConResumen({
        tareaId:       input.tareaId,
        usuarioId:     usuario.id,
        resumen:       input.resumen,
        usuarioNombre: usuario.nombre,
        ...(tareaCompletar?.titulo ? { tareaTitulo: tareaCompletar.titulo } : {}),
        ...(usuario.rol !== 'jefe' && jefesNotificacion.length > 0
          ? { jefeIds: jefesNotificacion.map((j) => j.id) }
          : {}),
      });
      setCompletarTareaId(null);
      toast.success('Tarea finalizada');
      await invalidateRelatedQueries(qc, ['semana', 'tablero', 'tareas-hoy', 'planificacion', 'ot']);
    } catch (err) {
      console.error('[confirmarCompletar]', err);
      toast.error('No se pudo completar la tarea.');
    }
  }

  async function crearTareaDesdeModal(input: {
    titulo:       string;
    prioridad:    Tarea['prioridad'];
    descripcion:  string;
    objetivo_id?: string | null;
    asignado_a?:  string | null;
  }) {
    if (!modal || !usuario) return;
    const asignado = input.asignado_a?.trim() || usuario.id;
    if (modal.fecha) {
      await mut.crearPlan({
        titulo:            input.titulo,
        prioridad:         input.prioridad,
        descripcion:       input.descripcion,
        fecha_planificada: modal.fecha,
        asignado_a:        asignado,
        creado_por:        usuario.id,
        objetivo_id:       input.objetivo_id ?? null,
      });
      toast.success('Tarea planificada');
    }
  }

  async function crearEventoDesdeModal(input: {
    titulo:        string;
    tipo:          TipoEvento;
    hora_inicio:   string;
    hora_fin:      string;
    es_recurrente: boolean;
  }) {
    if (!modal?.fecha || !usuario) return;
    await mut.crearEvento({
      titulo:        input.titulo,
      tipo:          input.tipo,
      fecha_dia:     modal.fecha,
      hora_inicio:   input.hora_inicio,
      hora_fin:      input.hora_fin,
      usuario_id:    usuario.id,
      es_recurrente: input.es_recurrente,
    });
    toast.success('Evento creado');
  }

  async function guardarDetalle(input: {
    tareaId:      string;
    titulo:       string;
    prioridad:    Tarea['prioridad'];
    descripcion:  string;
    objetivo_id?: string | null;
    asignado_a?:  string | null;
  }) {
    if (!usuario) return;
    try {
      await mut.editarTarea({ ...input, usuarioActorId: usuario.id });
      toast.success('Tarea actualizada');
    } catch (err) {
      console.error('[guardarDetalle]', err);
      toast.error('No se pudo actualizar la tarea.');
    }
  }

  async function eliminarDesdeDetalle(input: { tareaId: string; motivo: string }) {
    if (!usuario) return;
    try {
      await mut.eliminarTarea({ tareaId: input.tareaId, usuarioId: usuario.id, motivo: input.motivo });
      setDetalleTareaId(null);
      toast.success('Tarea eliminada');
    } catch (err) {
      console.error('[eliminarDesdeDetalle]', err);
      toast.error('No se pudo eliminar la tarea.');
    }
  }

  async function cancelarDesdeDetalle(input: { tareaId: string; motivo: string }) {
    if (!usuario) return;
    try {
      await mut.cancelarTarea({ tareaId: input.tareaId, motivo: input.motivo });
      setDetalleTareaId(null);
      toast.success('Tarea cancelada');
      await invalidateRelatedQueries(qc, ['semana', 'tareas-hoy', 'planificacion']);
    } catch (err) {
      console.error('[cancelarDesdeDetalle]', err);
      toast.error('No se pudo cancelar la tarea.');
    }
  }

  async function iniciarDesdeDetalle(t: Tarea) {
    if (!usuario) return;
    try {
      await mut.iniciarTarea({ tareaId: t.id, usuarioId: usuario.id });
      toast.success('Tarea en progreso');
      setDetalleTareaId(null);
    } catch (err) {
      console.error('[iniciarDesdeDetalle]', err);
      toast.error('No se pudo iniciar la tarea.');
    }
  }

  return {
    modal,            setModal,
    modalInc,         setModalInc,
    detalleTareaId,   setDetalleTareaId,
    completarTareaId, setCompletarTareaId,
    reprDetalleTarea, setReprDetalleTarea,
    tareaDetalle,
    tareaCompletar,
    confirmarReprDetalle,
    confirmarCompletar,
    crearTareaDesdeModal,
    crearEventoDesdeModal,
    guardarDetalle,
    eliminarDesdeDetalle,
    cancelarDesdeDetalle,
    iniciarDesdeDetalle,
  };
}
