/**
 * hooks/useModoHoy.ts
 *
 * Queries y handlers exclusivos del panel "Ahora" (modo Hoy) de Mi Semana.
 * Solo se activan cuando esModoHoy === true.
 * Extraído de useMiSemanaPage para separar responsabilidades.
 */

import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';

import { insertarNotaBitacoraRapida, crearIncidencia } from '@/api/hoyColumnas';
import {
  useIncidenciasDelDia,
  useNotasBitacoraHoy,
  useEventosHoy,
  Q_INC_HOY,
} from '@/hooks/useHoyColumnas';
import { useJefesNotificacion } from '@/hooks/useUsuarios';
import { invalidateRelatedQueries } from '@/lib/queryHelpers';
import { publicarEventoEquipo } from '@/lib/realtimePublish';
import type { Tarea, Usuario } from '@/types';

export function useModoHoy({
  uid,
  hoyYmd,
  esModoHoy,
  usuario,
  esJefe,
}: {
  uid:       string | undefined;
  hoyYmd:    string;
  esModoHoy: boolean;
  usuario:   Usuario | null | undefined;
  esJefe:    boolean;
}) {
  const qc = useQueryClient();

  // Solo carga datos cuando el panel Hoy está activo
  const { data: incidenciasHoy = [] } = useIncidenciasDelDia(esModoHoy ? uid : undefined, hoyYmd);
  const { data: notasHoy       = [] } = useNotasBitacoraHoy(esModoHoy ? uid : undefined);
  const { data: eventosHoy     = [] } = useEventosHoy(esModoHoy ? uid : undefined, hoyYmd);

  const { data: jefesNotificacion = [] } = useJefesNotificacion({
    enabled: Boolean(usuario && !esJefe),
  });

  // ── Estado local del panel Hoy ────────────────────────────────────────────
  const [modalInc,   setModalInc]   = useState(false);
  const [notaRapida, setNotaRapida] = useState('');

  // ── Handlers ──────────────────────────────────────────────────────────────
  async function crearIncidenciaHoy(input: {
    titulo:       string;
    prioridad:    Tarea['prioridad'];
    descripcion?: string | null;
    asignado_a?:  string | null;
    ya_resuelta:  boolean;
  }) {
    if (!usuario || !uid) return;

    const incidencia = await crearIncidencia({
      titulo:            input.titulo,
      prioridad:         input.prioridad,
      descripcion:       input.descripcion ?? null,
      asignado_a:        input.asignado_a ?? uid,
      fecha_planificada: hoyYmd,
      ya_resuelta:       input.ya_resuelta,
    });

    if (incidencia.asignado_a === uid && incidencia.fecha_planificada === hoyYmd) {
      qc.setQueryData<Tarea[]>([Q_INC_HOY, uid, hoyYmd], (prev = []) => [incidencia, ...prev]);
    }

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

    await invalidateRelatedQueries(qc, ['tablero', 'planificacion']);
    await qc.invalidateQueries({ queryKey: [Q_INC_HOY], exact: false });
    toast.success(input.ya_resuelta ? 'Incidencia registrada' : 'Incidencia agendada');
    setModalInc(false);
  }

  async function guardarNotaRapida() {
    if (!notaRapida.trim() || !uid) return;
    try {
      await insertarNotaBitacoraRapida({ usuario_id: uid, contenido: notaRapida.trim() });
      setNotaRapida('');
      toast.success('Nota guardada');
    } catch (err) {
      console.error('[guardarNotaRapida]', err);
      toast.error('No se pudo guardar la nota.');
    }
  }

  return {
    // Datos
    incidenciasHoy, notasHoy, eventosHoy, jefesNotificacion,

    // Estado UI
    modalInc, setModalInc,
    notaRapida, setNotaRapida,

    // Handlers
    crearIncidenciaHoy, guardarNotaRapida,
  };
}