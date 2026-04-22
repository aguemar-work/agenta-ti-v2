import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

import { getJustificacionesPendientesJefe, marcarLogLeidoPorJefe } from '@/api/audit';
import {
  fechaLunesDesdeSemanaIso,
  getCargaEquipoSemana,
  getMiembrosActivos,
  getTareasUsuarioDia,
} from '@/api/planificacion';
import { desbloquearTareaConLog, reprogramarTareaConLog } from '@/api/semana';
import { ModalDesbloquear } from '@/components/tareas/ModalDesbloquear';
import { APP_PAGE_CLASS } from '@/lib/appLayout';
import { fechaLocalDdMmYyyy, fechaLocalYmd } from '@/lib/fecha';
import { estadoEfectivoTablero } from '@/lib/tableroEstado';
import { agregarDias, inicioSemanaIso, numeroSemanaDesdeLunes, semanaIsoDesdeFecha } from '@/lib/semanas';
import { useAuthStore } from '@/store/authStore';
import type { EstadoTarea, LogAccion, Tarea, TipoAccionLog } from '@/types';

const Q_LOGS = 'audit-logs-pendientes';

const ESTADOS: EstadoTarea[] = ['pendiente', 'en_progreso', 'atrasada', 'bloqueada', 'completada', 'reprogramada'];

const estadoLabel: Record<EstadoTarea, string> = {
  pendiente:    'pendientes',
  en_progreso:  'en progreso',
  atrasada:     'atrasadas',
  bloqueada:    'bloqueadas',
  completada:   'completadas',
  reprogramada: 'reprogramadas',
  cancelada:    'canceladas',
};

const estadoPillClass: Record<string, string> = {
  pendiente:    'bg-[#F1EFE8] text-[#5F5E5A]',
  en_progreso:  'bg-[#E6F1FB] text-[#185FA5]',
  atrasada:     'bg-[#FCEBEB] text-[#A32D2D]',
  bloqueada:    'bg-[#FAEEDA] text-[#854F0B]',
  completada:   'bg-[#EAF3DE] text-[#27500A]',
  reprogramada: 'bg-[#EEEDFE] text-[#3C3489]',
  cancelada:    'bg-[#F1F1F1] text-[#6B6B6B]',
};

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

function celdaClass(n: number): string {
  if (n === 0) return 'bg-[var(--mc-color-bg-secondary)] text-[var(--mc-color-text-secondary)]';
  if (n <= 2) return 'bg-[#EAF3DE] text-[#27500A]';
  if (n <= 4) return 'bg-[#FAEEDA] text-[#854F0B]';
  return 'bg-[#FCEBEB] text-[#A32D2D]';
}

export function Planificacion() {
  const qc = useQueryClient();
  const usuario = useAuthStore((s) => s.usuario);
  const hoyYmd = fechaLocalYmd(new Date());

  const [lunes, setLunes] = useState(() => inicioSemanaIso(new Date()));
  const semanaISO = semanaIsoDesdeFecha(lunes);
  const numSem = numeroSemanaDesdeLunes(lunes);
  const sabado = useMemo(() => agregarDias(lunes, 5), [lunes]);

  const diasLab = useMemo(
    () => [0, 1, 2, 3, 4, 5].map((i) => agregarDias(lunes, i)),
    [lunes],
  );

  const [modal, setModal] = useState<{ usuarioId: string; fecha: string; nombre: string } | null>(null);
  const [desbloquearTarea, setDesbloquearTarea] = useState<Tarea | null>(null);
  const [devolverTarea, setDevolverTarea] = useState<Tarea | null>(null);
  const [motivoDevolver, setMotivoDevolver] = useState('');
  const [busyDevolver, setBusyDevolver] = useState(false);

  const { data: miembros = [] } = useQuery({
    queryKey: ['planificacion', 'miembros'],
    queryFn: () => getMiembrosActivos(),
  });

  const { data: carga = [] } = useQuery({
    queryKey: ['planificacion', 'carga', semanaISO],
    queryFn: () => getCargaEquipoSemana(semanaISO),
  });

  const { data: detalle = [] } = useQuery({
    queryKey: ['planificacion', 'celda', modal?.usuarioId, modal?.fecha],
    enabled: Boolean(modal),
    queryFn: () => getTareasUsuarioDia(modal!.usuarioId, modal!.fecha),
  });

  const { data: logsPend = [], isLoading: loadLogs, isError: errLogs } = useQuery({
    queryKey: [Q_LOGS],
    queryFn: () => getJustificacionesPendientesJefe(),
  });

  const mutLeerLog = useMutation({
    mutationFn: (id: string) => marcarLogLeidoPorJefe(id),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: [Q_LOGS] });
      toast.success('Marcada como leído');
    },
    onError: () => toast.error('No se pudo actualizar el registro.'),
  });

  // Conteo de tareas por usuario+día
  function cuenta(uid: string, ymd: string): number {
    return carga.filter((t) => t.asignado_a === uid && t.fecha_planificada === ymd).length;
  }

  // Conteo por estado para un día (todos los miembros)
  function conteoEstadosDia(ymd: string): Partial<Record<EstadoTarea, number>> {
    const del = carga.filter((t) => t.fecha_planificada === ymd);
    const counts: Partial<Record<EstadoTarea, number>> = {};
    for (const t of del) {
      const est = estadoEfectivoTablero(t, hoyYmd);
      counts[est] = (counts[est] ?? 0) + 1;
    }
    return counts;
  }

  // Conteo por estado para toda la semana
  const conteoSemana = useMemo(() => {
    const counts: Partial<Record<EstadoTarea, number>> = {};
    for (const t of carga) {
      const est = estadoEfectivoTablero(t, hoyYmd);
      counts[est] = (counts[est] ?? 0) + 1;
    }
    return counts;
  }, [carga, hoyYmd]);

  async function confirmarDesbloqueo(input: { tareaId: string; nuevaFecha: string; justificacion: string }) {
    if (!usuario) return;
    try {
      await desbloquearTareaConLog({ ...input, usuarioId: usuario.id });
      setDesbloquearTarea(null);
      toast.success('Tarea desbloqueada');
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['planificacion', 'carga', semanaISO] }),
        qc.invalidateQueries({ queryKey: ['planificacion', 'celda', modal?.usuarioId, modal?.fecha] }),
        qc.invalidateQueries({ queryKey: ['tablero'] }),
        qc.invalidateQueries({ queryKey: ['semana'] }),
      ]);
    } catch {
      toast.error('No se pudo desbloquear la tarea.');
    }
  }

  async function confirmarDevolver() {
    if (!devolverTarea || !usuario || motivoDevolver.trim().length < 10) return;
    setBusyDevolver(true);
    try {
      await reprogramarTareaConLog({
        tareaId: devolverTarea.id,
        usuarioId: usuario.id,
        nuevaFecha: devolverTarea.fecha_planificada ?? hoyYmd,
        justificacion: motivoDevolver.trim(),
        nuevoEstado: 'pendiente',
      });
      setDevolverTarea(null);
      setMotivoDevolver('');
      toast.success('Tarea devuelta a pendiente');
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['planificacion', 'carga', semanaISO] }),
        qc.invalidateQueries({ queryKey: ['planificacion', 'celda', modal?.usuarioId, modal?.fecha] }),
        qc.invalidateQueries({ queryKey: ['tablero'] }),
        qc.invalidateQueries({ queryKey: ['semana'] }),
      ]);
    } catch {
      toast.error('No se pudo devolver la tarea.');
    } finally {
      setBusyDevolver(false);
    }
  }

  if (!usuario) return null;

  return (
    <div className={APP_PAGE_CLASS}>
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-semibold text-[var(--mc-color-text)]" style={{ fontSize: 'var(--mc-text-lg)' }}>
            Planificación
          </h1>
          <h2 className="mt-2 text-sm font-medium text-[var(--mc-color-text-secondary)]">
            Semana {numSem} · {fechaLocalDdMmYyyy(lunes)} — {fechaLocalDdMmYyyy(sabado)}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" className="mc-btn-secondary text-sm" onClick={() => setLunes((d) => agregarDias(d, -7))}>‹</button>
          <span className="text-sm font-medium">Lunes {fechaLunesDesdeSemanaIso(semanaISO)}</span>
          <button type="button" className="mc-btn-secondary text-sm" onClick={() => setLunes((d) => agregarDias(d, 7))}>›</button>
        </div>
      </div>

      {/* Tabla de carga */}
      <section>
        <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--mc-color-text-secondary)]">
          Carga de trabajo por miembro
        </div>
        <div className="mb-2 flex flex-wrap gap-3">
          {[
            { color: '#EAF3DE', label: '1–2 tareas' },
            { color: '#FAEEDA', label: '3–4 tareas' },
            { color: '#FCEBEB', label: '5+ tareas' },
          ].map(({ color, label }) => (
            <div key={label} className="flex items-center gap-1.5 text-xs text-[var(--mc-color-text-secondary)]">
              <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: color }} />
              {label}
            </div>
          ))}
        </div>
        <div className="overflow-x-auto rounded-xl border border-[var(--mc-color-border)] bg-[var(--mc-color-surface)]">
          <table className="w-full min-w-[720px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--mc-color-border)]">
                <th className="p-2 text-[10px] font-medium uppercase tracking-wide text-[var(--mc-color-text-secondary)]">
                  Miembro
                </th>
                {diasLab.map((d, i) => (
                  <th key={fechaLocalYmd(d)} className="p-2 text-[10px] font-medium uppercase tracking-wide text-[var(--mc-color-text-secondary)]">
                    {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'][i]} {d.getDate()}
                  </th>
                ))}
                <th className="p-2 text-[10px] font-medium uppercase tracking-wide text-[var(--mc-color-text-secondary)]">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {miembros.map((u) => {
                const totalSem = diasLab.reduce((acc, d) => acc + cuenta(u.id, fechaLocalYmd(d)), 0);
                return (
                  <tr key={u.id} className="border-b border-[var(--mc-color-border)]">
                    <td className="p-2 font-medium text-[var(--mc-color-text)]">{u.nombre}</td>
                    {diasLab.map((d) => {
                      const ymd = fechaLocalYmd(d);
                      const n = cuenta(u.id, ymd);
                      return (
                        <td key={ymd} className="p-2">
                          <button
                            type="button"
                            className={`w-full rounded-md py-1 text-center text-xs font-medium ${celdaClass(n)}`}
                            onClick={() => setModal({ usuarioId: u.id, fecha: ymd, nombre: u.nombre })}
                          >
                            {n}
                          </button>
                        </td>
                      );
                    })}
                    <td className="p-2 font-medium text-[var(--mc-color-text)]">{totalSem}</td>
                  </tr>
                );
              })}

              {/* Fila de resumen por estado */}
              <tr className="border-t border-[var(--mc-color-border)] bg-[var(--mc-color-bg-secondary)]">
                <td className="p-2 text-xs font-medium text-[var(--mc-color-text-secondary)]">
                  Resumen del día
                </td>
                {diasLab.map((d) => {
                  const ymd = fechaLocalYmd(d);
                  const counts = conteoEstadosDia(ymd);
                  const hayAlgo = Object.values(counts).some((v) => v && v > 0);
                  return (
                    <td key={ymd} className="p-2">
                      {!hayAlgo ? (
                        <span className="text-xs text-[var(--mc-color-text-secondary)]">—</span>
                      ) : (
                        <div className="flex flex-col gap-0.5">
                          {ESTADOS.filter((e) => counts[e]).map((e) => (
                            <span
                              key={e}
                              className={`inline-block rounded px-1 py-0.5 text-[10px] font-medium ${estadoPillClass[e] ?? ''}`}
                            >
                              {counts[e]} {estadoLabel[e]}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                  );
                })}
                {/* Total semana */}
                <td className="p-2">
                  <div className="flex flex-col gap-0.5">
                    {ESTADOS.filter((e) => conteoSemana[e]).map((e) => (
                      <span
                        key={e}
                        className={`inline-block rounded px-1 py-0.5 text-[10px] font-medium ${estadoPillClass[e] ?? ''}`}
                      >
                        {conteoSemana[e]} {estadoLabel[e]}
                      </span>
                    ))}
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Justificaciones pendientes */}
      <section>
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--mc-color-text-secondary)]">
          Justificaciones pendientes de lectura
        </div>
        {errLogs ? <p className="text-sm text-[var(--mc-color-danger)]">No se pudieron cargar los registros.</p> : null}
        {loadLogs ? (
          <p className="text-sm text-[var(--mc-color-text-secondary)]">Cargando…</p>
        ) : logsPend.length === 0 ? (
          <p className="text-sm text-[var(--mc-color-text-secondary)]">Sin pendientes de lectura.</p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-[var(--mc-color-border)] bg-[var(--mc-color-surface)]">
            {logsPend.map((log: LogAccion) => (
              <div
                key={log.id}
                className="grid grid-cols-[120px_100px_1fr_auto] items-center gap-3 border-b border-[var(--mc-color-border)] px-4 py-3 last:border-b-0"
              >
                <span className="text-xs text-[var(--mc-color-text-secondary)]">
                  {new Date(log.created_at).toLocaleString('es', { dateStyle: 'short', timeStyle: 'short' })}
                </span>
                <span className="mc-badge mc-badge-neutral text-[10px]">{labelTipoLog(log.tipo_accion)}</span>
                <span className="text-sm text-[var(--mc-color-text)]">{log.justificacion ?? '—'}</span>
                <button
                  type="button"
                  className="mc-btn-secondary !px-2 !py-1 text-xs"
                  disabled={mutLeerLog.isPending}
                  onClick={() => mutLeerLog.mutate(log.id)}
                >
                  Marcar leído
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Modal detalle celda */}
      {modal ? (
        <div className="mc-overlay flex items-center justify-center p-4" role="presentation" onClick={() => setModal(null)}>
          <div
            className="mc-modal max-h-[80vh] overflow-y-auto"
            role="dialog"
            aria-modal
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-base font-semibold text-[var(--mc-color-text)]">
              {modal.nombre}
            </h2>
            <p className="mt-1 text-xs text-[var(--mc-color-text-secondary)]">
              {modal.fecha} · {detalle.length} tareas
            </p>
            <div className="mt-3 flex flex-col gap-2">
              {detalle.length === 0 ? (
                <p className="text-sm text-[var(--mc-color-text-secondary)]">Sin tareas planificadas.</p>
              ) : (
                detalle.map((t: Tarea) => {
                  const est = estadoEfectivoTablero(t, hoyYmd);
                  return (
                    <div key={t.id} className="rounded-lg bg-[var(--mc-color-bg-secondary)] p-3">
                      <p className="mb-2 text-sm font-medium text-[var(--mc-color-text)]">{t.titulo}</p>
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <span className={`inline-block rounded px-1 py-0.5 text-[10px] font-medium ${estadoPillClass[est] ?? 'bg-[#F1F1F1] text-[#6B6B6B]'}`}>
                          {estadoLabel[est] ?? est}
                        </span>
                        <span className="text-xs text-[var(--mc-color-text-secondary)]">{t.prioridad} prioridad</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {est === 'bloqueada' ? (
                          <button
                            type="button"
                            className="mc-btn-secondary !px-3 !py-1.5 text-xs !text-[var(--mc-color-accent)]"
                            onClick={() => setDesbloquearTarea(t)}
                          >
                            Desbloquear
                          </button>
                        ) : null}
                        {est === 'completada' ? (
                          <button
                            type="button"
                            className="mc-btn-secondary !px-3 !py-1.5 text-xs !text-[var(--mc-color-warning)]"
                            onClick={() => { setDevolverTarea(t); setMotivoDevolver(''); }}
                          >
                            Devolver a pendiente
                          </button>
                        ) : null}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            <div className="mt-4 flex justify-end">
              <button type="button" className="mc-btn-ghost" onClick={() => setModal(null)}>Cerrar</button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Modal devolver a pendiente */}
      {devolverTarea ? (
        <div className="mc-overlay flex items-center justify-center p-4" role="presentation" onClick={() => setDevolverTarea(null)}>
          <div className="mc-modal" role="dialog" aria-modal onClick={(e) => e.stopPropagation()}>
            <h2 className="text-base font-semibold text-[var(--mc-color-text)]">Devolver a pendiente</h2>
            <p className="mt-1 text-xs text-[var(--mc-color-text-secondary)]">{devolverTarea.titulo}</p>
            <label className="mt-3 block text-xs font-medium text-[var(--mc-color-text-secondary)]">
              Justificación (mín. 10 caracteres)
              <textarea
                className="mc-input mt-1 min-h-[80px]"
                value={motivoDevolver}
                onChange={(e) => setMotivoDevolver(e.target.value)}
                placeholder="Indica el motivo para devolver esta tarea…"
              />
            </label>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className="mc-btn-ghost" onClick={() => setDevolverTarea(null)} disabled={busyDevolver}>
                Cancelar
              </button>
              <button
                type="button"
                className="mc-btn"
                disabled={busyDevolver || motivoDevolver.trim().length < 10}
                onClick={() => void confirmarDevolver()}
              >
                {busyDevolver ? 'Guardando…' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Modal desbloquear */}
      <ModalDesbloquear
        tarea={desbloquearTarea}
        onClose={() => setDesbloquearTarea(null)}
        onConfirm={confirmarDesbloqueo}
      />
    </div>
  );
}