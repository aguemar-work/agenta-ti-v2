import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';

import { getJustificacionesPendientesJefe, marcarLogLeidoPorJefe } from '@/api/audit';
import {
  fechaLunesDesdeSemanaIso,
  getCargaEquipoSemana,
  getMiembrosActivos,
  getNotaSemana,
  getTareasUsuarioDia,
  upsertNotaSemana,
} from '@/api/planificacion';
import { TaskItem } from '@/components/tareas/TaskItem';
import { APP_PAGE_CLASS } from '@/lib/appLayout';
import { fechaLocalDdMmYyyy, fechaLocalYmd } from '@/lib/fecha';
import { agregarDias, inicioSemanaIso, numeroSemanaDesdeLunes, semanaIsoDesdeFecha } from '@/lib/semanas';
import { useAuthStore } from '@/store/authStore';
import type { LogAccion, Tarea, TipoAccionLog } from '@/types';

const Q_LOGS = 'audit-logs-pendientes';

function contadorCarga(n: number): string {
  if (n <= 2) return '🟢';
  if (n <= 4) return '🟡';
  return '🔴';
}

function labelTipoLog(t: TipoAccionLog): string {
  const m: Record<TipoAccionLog, string> = {
    creada: 'Creada',
    reprogramada: 'Reprogramada',
    eliminada: 'Eliminada',
    estado_cambiado: 'Cambio de estado',
    prioridad_cambiada: 'Prioridad',
    editada: 'Editada',
    cancelada: 'Cancelación',
  };
  return m[t] ?? t;
}

export function Planificacion() {
  const qc = useQueryClient();
  const usuario = useAuthStore((s) => s.usuario);
  const [lunes, setLunes] = useState(() => inicioSemanaIso(new Date()));
  const semanaISO = semanaIsoDesdeFecha(lunes);
  const numSem = numeroSemanaDesdeLunes(lunes);

  const diasLab = useMemo(() => [0, 1, 2, 3, 4].map((i) => agregarDias(lunes, i)), [lunes]);

  const { data: miembros = [] } = useQuery({
    queryKey: ['planificacion', 'miembros'],
    queryFn: () => getMiembrosActivos(),
  });

  const { data: carga = [] } = useQuery({
    queryKey: ['planificacion', 'carga', semanaISO],
    queryFn: () => getCargaEquipoSemana(semanaISO),
  });

  const { data: notaRow } = useQuery({
    queryKey: ['planificacion', 'nota', semanaISO],
    queryFn: () => getNotaSemana(semanaISO),
  });

  const [nota, setNota] = useState('');
  useEffect(() => {
    setNota(notaRow?.notas_semana ?? '');
  }, [notaRow?.notas_semana]);

  const [modal, setModal] = useState<{ usuarioId: string; fecha: string } | null>(null);
  const { data: detalle = [] } = useQuery({
    queryKey: ['planificacion', 'celda', modal?.usuarioId, modal?.fecha],
    enabled: Boolean(modal),
    queryFn: () => getTareasUsuarioDia(modal!.usuarioId, modal!.fecha),
  });

  const { data: logsPend = [], isLoading: loadLogs, isError: errLogs } = useQuery({
    queryKey: [Q_LOGS],
    queryFn: () => getJustificacionesPendientesJefe(),
  });

  const mutNota = useMutation({
    mutationFn: () => upsertNotaSemana(semanaISO, nota),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['planificacion', 'nota', semanaISO] });
      toast.success('Nota guardada');
    },
    onError: () => toast.error('No se pudo guardar la nota.'),
  });

  const mutLeerLog = useMutation({
    mutationFn: (id: string) => marcarLogLeidoPorJefe(id),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: [Q_LOGS] });
      toast.success('Marcada como leído');
    },
    onError: () => toast.error('No se pudo actualizar el registro.'),
  });

  function cuenta(uid: string, ymd: string): number {
    return carga.filter((t) => t.asignado_a === uid && t.fecha_planificada === ymd).length;
  }

  if (!usuario) return null;

  return (
    <div className={APP_PAGE_CLASS}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-semibold text-[var(--mc-color-text)]" style={{ fontSize: 'var(--mc-text-lg)' }}>
            Planificación
          </h1>
          <h2 className="mt-2 text-sm font-medium text-[var(--mc-color-text-secondary)]">
            Semana {numSem} · {fechaLocalDdMmYyyy(lunes)} — {fechaLocalDdMmYyyy(agregarDias(lunes, 6))}
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link className="mc-btn-secondary text-sm no-underline" to="/semana">
            Mi semana
          </Link>
          <button type="button" className="mc-btn-secondary text-sm" onClick={() => setLunes((d) => agregarDias(d, -7))}>
            ‹
          </button>
          <span className="text-sm font-medium">Lunes {fechaLunesDesdeSemanaIso(semanaISO)}</span>
          <button type="button" className="mc-btn-secondary text-sm" onClick={() => setLunes((d) => agregarDias(d, 7))}>
            ›
          </button>
        </div>
      </div>

      <section className="mc-card">
        <div className="text-sm font-semibold text-[var(--mc-color-text)]">Nota semanal (jefe)</div>
        <textarea className="mc-input mt-3 min-h-[100px]" value={nota} onChange={(e) => setNota(e.target.value)} readOnly={false} />
        <div className="mt-3 flex justify-end">
          <button type="button" className="mc-btn" disabled={mutNota.isPending} onClick={() => mutNota.mutate()}>
            {mutNota.isPending ? 'Guardando…' : 'Guardar nota'}
          </button>
        </div>
      </section>

      <section>
        <div className="mb-2 text-sm font-semibold text-[var(--mc-color-text)]">Carga de trabajo por miembro (semana)</div>
        <div className="overflow-x-auto rounded-[var(--mc-radius-md)] border border-[var(--mc-color-border)] bg-[var(--mc-color-surface)]">
          <table className="w-full min-w-[640px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--mc-color-border)]">
                <th className="p-2 font-semibold text-[var(--mc-color-text-secondary)]">Miembro</th>
                {diasLab.map((d) => (
                  <th key={fechaLocalYmd(d)} className="p-2 font-semibold text-[var(--mc-color-text-secondary)]">
                    {fechaLocalDdMmYyyy(d)}
                  </th>
                ))}
                <th className="p-2 font-semibold text-[var(--mc-color-text-secondary)]">Total sem.</th>
              </tr>
            </thead>
            <tbody>
              {miembros.map((u) => {
                const totalSem = diasLab.reduce((acc, d) => acc + cuenta(u.id, fechaLocalYmd(d)), 0);
                return (
                  <tr key={u.id} className="border-b border-[var(--mc-color-border)] last:border-0">
                    <td className="p-2 font-medium text-[var(--mc-color-text)]">{u.nombre}</td>
                    {diasLab.map((d) => {
                      const ymd = fechaLocalYmd(d);
                      const n = cuenta(u.id, ymd);
                      return (
                        <td key={ymd} className="p-2">
                          <button
                            type="button"
                            className="mc-btn-ghost w-full justify-start !px-2 !py-1 text-left text-sm"
                            onClick={() => setModal({ usuarioId: u.id, fecha: ymd })}
                          >
                            {contadorCarga(n)} <span className="text-[var(--mc-color-text-secondary)]">({n})</span>
                          </button>
                        </td>
                      );
                    })}
                    <td className="p-2 font-medium text-[var(--mc-color-text)]">{totalSem}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <div className="mb-2 text-sm font-semibold text-[var(--mc-color-text)]">Justificaciones pendientes de lectura</div>
        {errLogs ? <p className="text-sm text-[var(--mc-color-danger)]">No se pudieron cargar los registros.</p> : null}
        {loadLogs ? (
          <p className="text-sm text-[var(--mc-color-text-secondary)]">Cargando…</p>
        ) : logsPend.length === 0 ? (
          <p className="text-sm text-[var(--mc-color-text-secondary)]">Sin pendientes de lectura.</p>
        ) : (
          <div className="overflow-x-auto rounded-[var(--mc-radius-md)] border border-[var(--mc-color-border)] bg-[var(--mc-color-surface)]">
            <table className="mc-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Tipo</th>
                  <th>Tarea</th>
                  <th>Justificación / detalle</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {logsPend.map((log: LogAccion) => (
                  <tr key={log.id}>
                    <td className="whitespace-nowrap text-xs text-[var(--mc-color-text-secondary)]">
                      {new Date(log.created_at).toLocaleString('es', { dateStyle: 'short', timeStyle: 'short' })}
                    </td>
                    <td>
                      <span className="mc-badge mc-badge-neutral text-[11px]">{labelTipoLog(log.tipo_accion)}</span>
                    </td>
                    <td className="max-w-[120px] truncate font-mono text-xs">{log.tarea_id ?? '—'}</td>
                    <td className="max-w-[320px] text-sm text-[var(--mc-color-text)]">{log.justificacion ?? '—'}</td>
                    <td>
                      <button
                        type="button"
                        className="mc-btn-secondary !px-2 !py-1 text-xs"
                        disabled={mutLeerLog.isPending}
                        onClick={() => mutLeerLog.mutate(log.id)}
                      >
                        Marcar como leído
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {modal ? (
        <div className="mc-overlay flex items-center justify-center p-4" role="presentation" onClick={() => setModal(null)}>
          <div className="mc-modal max-h-[80vh] overflow-y-auto" role="dialog" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-base font-semibold">Tareas · {modal.fecha}</h2>
            <ul className="mt-3 flex list-none flex-col gap-2 p-0">
              {detalle.length === 0 ? (
                <li className="text-sm text-[var(--mc-color-text-secondary)]">Sin tareas planificadas.</li>
              ) : (
                detalle.map((t: Tarea) => (
                  <li key={t.id} className="list-none">
                    <TaskItem variant="week" tarea={t} readOnly objetivoTitulo={null} />
                  </li>
                ))
              )}
            </ul>
            <div className="mt-4 flex justify-end">
              <button type="button" className="mc-btn-ghost" onClick={() => setModal(null)}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
