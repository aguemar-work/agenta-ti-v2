import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { crearObjetivo, getTareasPorObjetivo } from '@/api/objetivos';
import { getUsuariosActivosParaAsignacion } from '@/api/usuarios';
import { crearTareaLibre } from '@/api/semana';
import { TaskItem } from '@/components/tareas/TaskItem';
import { Q_KPIS, Q_OBJ_PROG, useKpisUsuario, useObjetivosProgreso } from '@/hooks/useObjetivosMetricas';
import { APP_PAGE_CLASS } from '@/lib/appLayout';
import { useAuthStore } from '@/store/authStore';
import type { EstadoObjetivo, Tarea } from '@/types';

const estadoObjLabel: Record<EstadoObjetivo, string> = {
  activo: 'Activo',
  completado: 'Completado',
  cancelado: 'Cancelado',
};

function badgeForEstado(estado: EstadoObjetivo) {
  if (estado === 'activo') return 'mc-badge-accent';
  if (estado === 'completado') return 'mc-badge-success';
  return 'mc-badge-neutral';
}

const Q_TAREAS_OBJ = 'objetivo-tareas';

export function Objetivos() {
  const qc = useQueryClient();
  const usuario = useAuthStore((s) => s.usuario);
  const { data: kpis, isLoading: loadK } = useKpisUsuario(usuario?.id);
  const { data: objetivos = [], isLoading: loadO, isError } = useObjetivosProgreso();

  const [seleccionId, setSeleccionId] = useState<string | null>(null);
  const [modalNuevo, setModalNuevo] = useState(false);
  const [tituloObj, setTituloObj] = useState('');
  const [descObj, setDescObj] = useState('');
  const [limiteObj, setLimiteObj] = useState('');
  const [responsableObjId, setResponsableObjId] = useState('');
  const [nuevaTareaTitulo, setNuevaTareaTitulo] = useState('');
  const [nuevaTareaPrioridad, setNuevaTareaPrioridad] = useState<Tarea['prioridad']>('media');
  const [nuevaTareaAsignadoId, setNuevaTareaAsignadoId] = useState('');

  const { data: tareasVinc = [], isLoading: loadTareas } = useQuery({
    queryKey: [Q_TAREAS_OBJ, seleccionId],
    enabled: Boolean(seleccionId),
    queryFn: () => getTareasPorObjetivo(seleccionId!),
  });

  const { data: usuariosActivos = [] } = useQuery({
    queryKey: ['usuarios-asignacion-objetivos'],
    queryFn: () => getUsuariosActivosParaAsignacion(),
  });

  const objetivoSel = objetivos.find((o) => o.id === seleccionId) ?? null;

  useEffect(() => {
    if (!usuario?.id) return;
    setNuevaTareaAsignadoId((prev) => prev || usuario.id);
  }, [usuario?.id]);

  const mutCrearObj = useMutation({
    mutationFn: crearObjetivo,
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: [Q_OBJ_PROG] }),
        qc.invalidateQueries({ queryKey: [Q_KPIS, usuario?.id] }),
      ]);
      setTituloObj('');
      setDescObj('');
      setLimiteObj('');
      setResponsableObjId('');
      setModalNuevo(false);
      toast.success('Objetivo creado');
    },
    onError: () => toast.error('No se pudo crear el objetivo.'),
  });

  const mutAddTarea = useMutation({
    mutationFn: crearTareaLibre,
    onSuccess: async (_, vars) => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: [Q_TAREAS_OBJ, vars.objetivo_id] }),
        qc.invalidateQueries({ queryKey: [Q_OBJ_PROG] }),
        qc.invalidateQueries({ queryKey: [Q_KPIS, usuario?.id] }),
        qc.invalidateQueries({ queryKey: ['tablero'] }),
        qc.invalidateQueries({ queryKey: ['semana'] }),
      ]);
      setNuevaTareaTitulo('');
      setNuevaTareaPrioridad('media');
      setNuevaTareaAsignadoId(usuario?.id ?? '');
      toast.success('Tarea vinculada al objetivo');
    },
    onError: () => toast.error('No se pudo crear la tarea.'),
  });

  if (!usuario) return null;
  const me = usuario;

  async function submitNuevoObjetivo() {
    if (!tituloObj.trim() || !responsableObjId.trim()) return;
    await mutCrearObj.mutateAsync({
      titulo: tituloObj.trim(),
      descripcion: descObj.trim() || null,
      fecha_limite: limiteObj.trim() || null,
      creado_por: me.id,
      responsable_id: responsableObjId.trim(),
    });
  }

  function addTareaVinculada() {
    if (!seleccionId || !nuevaTareaTitulo.trim()) return;
    const asignado = nuevaTareaAsignadoId.trim() || null;
    mutAddTarea.mutate({
      titulo: nuevaTareaTitulo.trim(),
      prioridad: nuevaTareaPrioridad,
      descripcion: null,
      asignado_a: asignado,
      creado_por: me.id,
      objetivo_id: seleccionId,
    });
  }

  return (
    <div className={APP_PAGE_CLASS}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-semibold text-[var(--mc-color-text)]" style={{ fontSize: 'var(--mc-text-lg)' }}>
            Objetivos
          </h1>
          <h2 className="mt-2 text-sm font-medium text-[var(--mc-color-text-secondary)]">Listado</h2>
        </div>
        <button
          type="button"
          className="mc-btn !px-4 !py-2 text-sm"
          onClick={() => {
            setResponsableObjId(me.id);
            setModalNuevo(true);
          }}
        >
          Nuevo objetivo
        </button>
      </div>

      <div className="mc-kpi-grid">
        {(['activas', 'completadas7d', 'objetivosActivos', 'atrasadas'] as const).map((key) => (
          <div key={key} className="mc-kpi-card">
            {loadK ? (
              <div className="mc-kpi-value text-[var(--mc-color-text-secondary)]">—</div>
            ) : (
              <div className="mc-kpi-value">
                {key === 'activas'
                  ? kpis?.activas ?? 0
                  : key === 'completadas7d'
                    ? kpis?.completadas7d ?? 0
                    : key === 'objetivosActivos'
                      ? kpis?.objetivosActivos ?? 0
                      : kpis?.atrasadas ?? 0}
              </div>
            )}
            <div className="mc-kpi-label">
              {key === 'activas'
                ? 'Tareas activas'
                : key === 'completadas7d'
                  ? 'Completadas (7 días)'
                  : key === 'objetivosActivos'
                    ? 'Objetivos activos'
                    : 'Tareas atrasadas'}
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_minmax(280px,360px)]">
        <section className="mc-card !p-0 overflow-hidden">
          <div className="border-b border-[var(--mc-color-border)] bg-[var(--mc-color-bg)] px-4 py-3">
            <span className="text-xs font-semibold uppercase tracking-wide text-[var(--mc-color-text-secondary)]">
              Lista de objetivos
            </span>
          </div>
          {isError ? <p className="p-4 text-sm text-[var(--mc-color-danger)]">No se pudieron cargar los objetivos.</p> : null}
          {loadO ? (
            <p className="p-4 text-sm text-[var(--mc-color-text-secondary)]">Cargando…</p>
          ) : objetivos.length === 0 ? (
            <p className="p-4 text-sm text-[var(--mc-color-text-secondary)]">Sin objetivos.</p>
          ) : (
            <table className="mc-table">
              <thead>
                <tr>
                  <th>Objetivo</th>
                  <th>Estado</th>
                  <th>Progreso</th>
                  <th>Límite</th>
                </tr>
              </thead>
              <tbody>
                {objetivos.map((o) => (
                  <tr
                    key={o.id}
                    className={`cursor-pointer ${seleccionId === o.id ? 'bg-[var(--mc-color-accent-soft)]' : ''}`.trim()}
                    onClick={() => setSeleccionId(o.id)}
                  >
                    <td>
                      <div className="font-medium text-[var(--mc-color-text)]">{o.titulo}</div>
                      {o.descripcion ? (
                        <div className="mt-1 line-clamp-2 text-xs text-[var(--mc-color-text-secondary)]">{o.descripcion}</div>
                      ) : null}
                    </td>
                    <td>
                      <span className={`mc-badge ${badgeForEstado(o.estado)}`}>{estadoObjLabel[o.estado]}</span>
                    </td>
                    <td>
                      <div className="flex flex-col gap-1">
                        <div className="h-2 w-full overflow-hidden rounded-[var(--mc-radius-sm)] bg-[var(--mc-color-border)]">
                          <div
                            className="h-full rounded-[var(--mc-radius-sm)] bg-[var(--mc-color-accent)]"
                            style={{ width: `${o.pct}%` }}
                          />
                        </div>
                        <span className="text-xs text-[var(--mc-color-text-secondary)]">
                          {o.completadas}/{o.total_tareas} tareas · {o.pct}%
                        </span>
                      </div>
                    </td>
                    <td className="text-sm text-[var(--mc-color-text-secondary)]">{o.fecha_limite ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <aside className="mc-card flex min-h-[280px] flex-col gap-3">
          {!objetivoSel ? (
            <p className="text-sm text-[var(--mc-color-text-secondary)]">Selecciona un objetivo en la tabla para ver sus tareas.</p>
          ) : (
            <>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-[var(--mc-color-text-secondary)]">Detalle</div>
                <div className="mt-1 text-sm font-medium text-[var(--mc-color-text)]">{objetivoSel.titulo}</div>
                {objetivoSel.descripcion ? (
                  <p className="mt-2 text-xs text-[var(--mc-color-text-secondary)]">{objetivoSel.descripcion}</p>
                ) : null}
              </div>
              <div className="border-t border-[var(--mc-color-border)] pt-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-[var(--mc-color-text-secondary)]">
                  Tareas vinculadas
                </div>
                {loadTareas ? (
                  <p className="mt-2 text-sm text-[var(--mc-color-text-secondary)]">Cargando…</p>
                ) : tareasVinc.length === 0 ? (
                  <p className="mt-2 text-sm text-[var(--mc-color-text-secondary)]">Aún no hay tareas con este objetivo.</p>
                ) : (
                  <ul className="mt-2 flex max-h-[220px] list-none flex-col gap-2 overflow-y-auto p-0">
                    {tareasVinc.map((t) => (
                      <li key={t.id}>
                        <TaskItem variant="week" tarea={t} readOnly />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="mt-auto border-t border-[var(--mc-color-border)] pt-3">
                <div className="text-xs font-medium text-[var(--mc-color-text-secondary)]">Añadir tarea (libre, vinculada)</div>
                <input
                  className="mc-input mt-2 !py-2 text-sm"
                  placeholder="Título de la tarea"
                  value={nuevaTareaTitulo}
                  onChange={(e) => setNuevaTareaTitulo(e.target.value)}
                />
                <label className="mt-2 block text-xs text-[var(--mc-color-text-secondary)]">
                  Prioridad
                  <select
                    className="mc-input mt-1"
                    value={nuevaTareaPrioridad}
                    onChange={(e) => setNuevaTareaPrioridad(e.target.value as Tarea['prioridad'])}
                  >
                    <option value="baja">Baja</option>
                    <option value="media">Media</option>
                    <option value="alta">Alta</option>
                  </select>
                </label>
                {usuariosActivos.length > 0 ? (
                  <label className="mt-2 block text-xs text-[var(--mc-color-text-secondary)]">
                    Responsable
                    <select
                      className="mc-input mt-1"
                      value={nuevaTareaAsignadoId}
                      onChange={(e) => setNuevaTareaAsignadoId(e.target.value)}
                    >
                      {usuariosActivos.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.nombre}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
                <button
                  type="button"
                  className="mc-btn mt-3 w-full !py-2 text-sm"
                  disabled={mutAddTarea.isPending || !nuevaTareaTitulo.trim()}
                  onClick={() => addTareaVinculada()}
                >
                  Guardar tarea
                </button>
              </div>
            </>
          )}
        </aside>
      </div>

      {modalNuevo ? (
        <div className="mc-overlay flex items-center justify-center p-4" role="presentation" onClick={() => setModalNuevo(false)}>
          <div className="mc-modal" role="dialog" aria-modal onClick={(e) => e.stopPropagation()}>
            <h2 className="text-base font-semibold text-[var(--mc-color-text)]">Nuevo objetivo</h2>
            <label className="mt-3 block text-xs font-medium text-[var(--mc-color-text-secondary)]">
              Título
              <input className="mc-input mt-1" value={tituloObj} onChange={(e) => setTituloObj(e.target.value)} />
            </label>
            <label className="mt-3 block text-xs font-medium text-[var(--mc-color-text-secondary)]">
              Descripción (opcional)
              <textarea className="mc-input mt-1 min-h-[80px]" value={descObj} onChange={(e) => setDescObj(e.target.value)} />
            </label>
            <label className="mt-3 block text-xs font-medium text-[var(--mc-color-text-secondary)]">
              Fecha límite (opcional)
              <input type="date" className="mc-input mt-1" value={limiteObj} onChange={(e) => setLimiteObj(e.target.value)} />
            </label>
            <label className="mt-3 block text-xs font-medium text-[var(--mc-color-text-secondary)]">
              Responsable del objetivo
              <select
                className="mc-input mt-1"
                value={responsableObjId}
                onChange={(e) => setResponsableObjId(e.target.value)}
                required
              >
                <option value="">Selecciona…</option>
                {usuariosActivos.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nombre}
                  </option>
                ))}
              </select>
            </label>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className="mc-btn-ghost" onClick={() => setModalNuevo(false)}>
                Cancelar
              </button>
              <button
                type="button"
                className="mc-btn"
                disabled={mutCrearObj.isPending || !tituloObj.trim() || !responsableObjId.trim()}
                onClick={() => void submitNuevoObjetivo()}
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
