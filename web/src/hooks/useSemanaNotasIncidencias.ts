import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import {
  convertirNotaEnEvento as convertirNotaEnEventoApi,
  convertirNotaEnTarea as convertirNotaEnTareaApi,
  crearIncidencia,
  insertarNotaBitacoraRapida,
} from '@/api/hoyColumnas';
import { useIncidenciasDelDia, useNotasBitacoraHoy, Q_INC_HOY, Q_NOTAS_HOY } from '@/hooks/useHoyColumnas';
import { useJefesNotificacion } from '@/hooks/useUsuarios';
import { useWorkspaceId } from '@/hooks/useWorkspaceId';
import { invalidateRelatedQueries } from '@/lib/queryHelpers';
import { qkWsId } from '@/lib/queryKeys';
import { publicarEventoEquipo } from '@/lib/realtimePublish';
import type { NotaBitacora, Tarea, TipoEvento, Usuario } from '@/types';

type Params = {
  uid:     string | undefined;
  esJefe:  boolean;
  hoyYmd:  string;
  usuario: Usuario | null | undefined;
};

/**
 * Estado y handlers de notas de bitácora e incidencias en Mi Semana.
 * Separa esta responsabilidad del orquestador principal `useMiSemanaPage`.
 */
export function useSemanaNotasIncidencias({ uid, esJefe, hoyYmd, usuario }: Params) {
  const qc          = useQueryClient();
  const workspaceId = useWorkspaceId();

  const { data: incidenciasHoy = [] } = useIncidenciasDelDia(uid, hoyYmd);
  const { data: notasHoy       = [] } = useNotasBitacoraHoy(uid, esJefe);
  const { data: jefesNotificacion = [] } = useJefesNotificacion({
    enabled: Boolean(usuario && !esJefe),
  });

  const [modalInc,     setModalInc]     = useState(false);
  const [notaRapida,   setNotaRapida]   = useState('');
  const [notaConvertir, setNotaConvertir] = useState<NotaBitacora | null>(null);

  async function invalidarNotasYSemana() {
    await invalidateRelatedQueries(qc, ['semana', 'bitacora']);
    await qc.invalidateQueries({ queryKey: qkWsId(workspaceId, Q_NOTAS_HOY), exact: false });
  }

  async function crearIncidenciaHoy(input: {
    titulo:             string;
    prioridad:          Tarea['prioridad'];
    descripcion?:       string | null;
    asignado_a?:        string | null;
    fecha_planificada?: string;
    ya_resuelta:        boolean;
  }) {
    if (!usuario || !uid) return;
    const fecha = input.fecha_planificada ?? hoyYmd;
    const incidencia = await crearIncidencia({
      titulo:            input.titulo,
      prioridad:         input.prioridad,
      descripcion:       input.descripcion ?? null,
      asignado_a:        input.asignado_a ?? uid,
      fecha_planificada: fecha,
      ya_resuelta:       input.ya_resuelta,
    });

    if (!esJefe) {
      void Promise.all(
        jefesNotificacion.map((jefe) =>
          publicarEventoEquipo({
            tipo:          'incidencia_registrada',
            jefeId:        jefe.id,
            titulo:        incidencia.titulo,
            usuarioNombre: usuario.nombre,
          }),
        ),
      );
    }

    await invalidateRelatedQueries(qc, ['planificacion', 'semana']);
    await qc.invalidateQueries({ queryKey: qkWsId(workspaceId, Q_INC_HOY), exact: false });
    toast.success(input.ya_resuelta ? 'Incidencia registrada' : 'Incidencia agendada');
    setModalInc(false);
  }

  async function guardarNotaRapida() {
    if (!notaRapida.trim() || !uid) return;
    try {
      await insertarNotaBitacoraRapida({ usuario_id: uid, contenido: notaRapida.trim() });
      setNotaRapida('');
      await invalidarNotasYSemana();
      toast.success('Nota guardada');
    } catch (err) {
      console.error('[guardarNotaRapida]', err);
      toast.error('No se pudo guardar la nota.');
    }
  }

  async function confirmarConvertirNotaTarea(input: {
    titulo:             string;
    prioridad:          Tarea['prioridad'];
    descripcion:        string;
    fecha_planificada:  string;
    asignado_a:         string;
  }) {
    if (!usuario || !notaConvertir) return;
    await convertirNotaEnTareaApi({
      notaId:            notaConvertir.id,
      titulo:            input.titulo,
      descripcion:       input.descripcion,
      prioridad:         input.prioridad,
      fecha_planificada: input.fecha_planificada,
      asignado_a:        input.asignado_a,
      creado_por:        usuario.id,
    });
    setNotaConvertir(null);
    await invalidarNotasYSemana();
    toast.success('Nota convertida en tarea');
  }

  async function confirmarConvertirNotaEvento(input: {
    titulo:      string;
    tipo:        TipoEvento;
    fecha_dia:   string;
    hora_inicio: string;
    hora_fin:    string;
  }) {
    if (!usuario || !notaConvertir) return;
    await convertirNotaEnEventoApi({
      notaId:      notaConvertir.id,
      titulo:      input.titulo,
      tipo:        input.tipo,
      fecha_dia:   input.fecha_dia,
      hora_inicio: input.hora_inicio,
      hora_fin:    input.hora_fin,
      usuario_id:  usuario.id,
    });
    setNotaConvertir(null);
    await invalidarNotasYSemana();
    toast.success('Nota convertida en evento');
  }

  return {
    incidenciasHoy,
    notasHoy,
    jefesNotificacion,
    modalInc,     setModalInc,
    notaRapida,   setNotaRapida,
    notaConvertir, setNotaConvertir,
    crearIncidenciaHoy,
    guardarNotaRapida,
    confirmarConvertirNotaTarea,
    confirmarConvertirNotaEvento,
  };
}
