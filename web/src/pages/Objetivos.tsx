import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import { crearObjetivo, eliminarObjetivo, getTareasPorObjetivo } from '@/api/objetivos';
import { getUsuariosActivosParaAsignacion } from '@/api/usuarios';
import { crearTareaLibre } from '@/api/semana';
import { Q_KPIS, Q_OBJ_PROG, useObjetivosProgreso } from '@/hooks/useObjetivosMetricas';
import { APP_PAGE_CLASS } from '@/lib/appLayout';
import { useAuthStore } from '@/store/authStore';
import type { EstadoObjetivo, Tarea } from '@/types';

const estadoObjLabel: Record<EstadoObjetivo, string> = {
  activo: 'Activo',
  completado: 'Completado',
  cancelado: 'Cancelado',
};

const estadoBadge: Record<EstadoObjetivo, string> = {
  activo: 'mc-badge-accent',
  completado: 'mc-badge-success',
  cancelado: 'mc-badge-neutral',
};

const estadoTareaBadge: Record<string, string> = {
  pendiente: 'mc-badge-neutral',
  en_progreso: 'mc-badge-info',
  atrasada: 'mc-badge-danger',
  bloqueada: 'mc-badge-warning',
  completada: 'mc-badge-success',
  reprogramada: 'mc-badge-neutral',
};

const estadoTareaLabel: Record<string, string> = {
  pendiente: 'Pendiente',
  en_progreso: 'En progreso',
  atrasada: 'Atrasada',
  bloqueada: 'Bloqueada',
  completada: 'Completada',
  reprogramada: 'Reprogramada',
};

const Q_TAREAS_OBJ = 'objetivo-tareas';

export function Objetivos() {
  const qc = useQueryClient();
  const usuario = useAuthStore((s) => s.usuario);
  const esJefe = usuario?.rol === 'jefe';

  const { data: objetivos = [], isLoading: loadO, isError } = useObjetivosProgreso();

  const [seleccionId, setSeleccionId] = useState<string | null>(null);
  const [menuObjId, setMenuObjId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Modal nuevo objetivo
  const [modalNuevo, setModalNuevo] = useState(false);
  const [tituloObj, setTituloObj] = useState('');
  const [descObj, setDescObj] = useState('');
  const [limiteObj, setLimiteObj] = useState('');
  const [responsableObjId, setResponsableObjId] = useState('');

  // Modal añadir tarea
  const [modalTarea, setModalTarea] = useState(false);
  const [nuevaTareaTitulo, setNuevaTareaTitulo] = useState('');
  const [nuevaTareaPrioridad, setNuevaTareaPrioridad] = useState<Tarea['prioridad']>('media');
  const [nuevaTareaAsignadoId, setNuevaTareaAsignadoId] = useState('');

  // Modal eliminar objetivo
  const [eliminarObjId, setEliminarObjId] = useState<string | null>(null);
  const [motivoEliminar, setMotivoEliminar] = useState('');

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
  const objetivoEliminar = objetivos.find((o) => o.id === eliminarObjId) ?? null;

  useEffect(() => {
    if (!usuario?.id) return;
    setNuevaTareaAsignadoId(usuario.id);
    setResponsableObjId(usuario.id);
  }, [usuario?.id]);

  // Cerrar menú al click fuera
  useEffect(() => {
    if (!menuObjId) return;
    function handler(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuObjId(null);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuObjId]);

  const mutCrearObj = useMutation({
    mutationFn: crearObjetivo,
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: [Q_OBJ_PROG] }),
        qc.invalidateQueries({ queryKey: [Q_KPIS] }),
        qc.invalidateQueries({ queryKey: [Q_KPIS, usuario?.id] }),
      ]);
      setTituloObj(''); setDescObj(''); setLimiteObj('');
      setModalNuevo(false);
      toast.success('Objetivo creado');
    },
    onError: () => toast.error('No se pudo crear el objetivo.'),
  });

  const mutEliminarObj = useMutation({
    mutationFn: (input: { objetivoId: string; usuarioId: string; motivo: string }) =>
      eliminarObjetivo(input),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: [Q_OBJ_PROG] }),
        qc.invalidateQueries({ queryKey: [Q_KPIS] }),
        qc.invalidateQueries({ queryKey: [Q_KPIS, usuario?.id] }),
      ]);
      if (seleccionId === eliminarObjId) setSeleccionId(null);
      setEliminarObjId(null);
      setMotivoEliminar('');
      toast.success('Objetivo eliminado');
    },
    onError: () => toast.error('No se pudo eliminar el objetivo.'),
  });

  const mutAddTarea = useMutation({
    mutationFn: crearTareaLibre,
    onSuccess: async (_, vars) => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: [Q_TAREAS_OBJ, vars.objetivo_id] }),
        qc.invalidateQueries({ queryKey: [Q_OBJ_PROG] }),
        qc.invalidateQueries({ queryKey: ['tablero'] }),
        qc.invalidateQueries({ queryKey: ['semana'] }),
      ]);
      setNuevaTareaTitulo('');
      setNuevaTareaPrioridad('media');
      setNuevaTareaAsignadoId(usuario?.id ?? '');
      setModalTarea(false);
      toast.success('Tarea añadida al objetivo');
    },
    onError: () => toast.error('No se pudo añadir la tarea.'),
  });

  if (!usuario) return null;
  const me = usuario;

  async function submitNuevoObjetivo() {
    if (!tituloObj.trim() || !responsableObjId.trim()) return;
    try {
      await mutCrearObj.mutateAsync({
        titulo: tituloObj.trim(),
        descripcion: descObj.trim() || null,
        fecha_limite: limiteObj.trim() || null,
        creado_por: me.id,
        responsable_id: responsableObjId.trim(),
      });
    } catch {
      // toast ya lo maneja onError
    }
  }

  function addTareaVinculada() {
    if (!seleccionId || !nuevaTareaTitulo.trim()) return;
    mutAddTarea.mutate({
      titulo: nuevaTareaTitulo.trim(),
      prioridad: nuevaTareaPrioridad,
      descripcion: null,
      asignado_a: nuevaTareaAsignadoId.trim() || null,
      creado_por: me.id,
      objetivo_id: seleccionId,
    });
  }

  function puedeEliminarObjetivo(objetivoId: string): boolean {
    const obj = objetivos.find((o) => o.id === objetivoId);
    if (!obj) return false;
    return esJefe || obj.creado_por === me.id;
  }

  return (
    <div className={APP_PAGE_CLASS}>
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-semibold text-[var(--mc-color-text)]" style={{ fontSize: 'var(--mc-text-lg)' }}>
            Objetivos
          </h1>
          <h2 className="mt-2 text-sm font-medium text-[var(--mc-color-text-secondary)]">
            Gestión estratégica
          </h2>
        </div>
        <button
          type="button"
          className="mc-btn !px-4 !py-2 text-sm"
          onClick={() => {
            setResponsableObjId(me.id);
            setModalNuevo(true);
          }}
        >
          + Nuevo objetivo
        </button>
      </div>

      {isError ? <p className="text-sm text-[var(--mc-color-danger)]">No se pudieron cargar los objetivos.</p> : null}

      {/* Layout principal */}
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">

        {/* Tabla de objetivos */}
        <div className="mc-card !p-0 overflow-hidden">
          <div className="border-b border-[var(--mc-color-border)] bg-[var(--mc-color-bg)] px-4 py-3">
            <span className="text-xs font-semibold uppercase tracking-wide text-[var(--mc-color-text-secondary)]">
              Lista de objetivos
            </span>
          </div>
          {/* Headers */}
          <div className="grid grid-cols-[1fr_80px_160px_80px_32px] gap-3 border-b border-[var(--mc-color-border)] bg-[var(--mc-color-bg-secondary)] px-4 py-2">
            {['Objetivo', 'Estado', 'Progreso', 'Límite', ''].map((h) => (
              <span key={h} className="text-[10px] font-medium uppercase tracking-wide text-[var(--mc-color-text-secondary)]">
                {h}
              </span>
            ))}
          </div>
          {loadO ? (
            <p className="p-4 text-sm text-[var(--mc-color-text-secondary)]">Cargando…</p>
          ) : objetivos.length === 0 ? (
            <p className="p-4 text-sm text-[var(--mc-color-text-secondary)]">Sin objetivos.</p>
          ) : (
            objetivos.map((o) => (
              <div
                key={o.id}
                className={`grid cursor-pointer grid-cols-[1fr_80px_160px_80px_32px] items-center gap-3 border-b border-[var(--mc-color-border)] px-4 py-3 last:border-b-0 hover:bg-[var(--mc-color-bg-secondary)] ${seleccionId === o.id ? 'bg-[var(--mc-color-accent-soft)]' : ''}`.trim()}
                onClick={() => setSeleccionId(o.id)}
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-[var(--mc-color-text)]">{o.titulo}</p>
                  {o.descripcion ? (
                    <p className="mt-0.5 truncate text-xs text-[var(--mc-color-text-secondary)]">{o.descripcion}</p>
                  ) : null}
                </div>
                <span className={`mc-badge ${estadoBadge[o.estado]} text-[10px]`}>
                  {estadoObjLabel[o.estado]}
                </span>
                <div className="flex flex-col gap-1">
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--mc-color-border)]">
                    <div
                      className="h-full rounded-full bg-[var(--mc-color-accent)]"
                      style={{ width: `${o.pct}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-[var(--mc-color-text-secondary)]">
                    {o.completadas}/{o.total_tareas} · {o.pct}%
                  </span>
                </div>
                <span className="text-xs text-[var(--mc-color-text-secondary)]">
                  {o.fecha_limite ?? '—'}
                </span>
                {/* Menú ⋯ */}
                <div className="relative" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    className="mc-btn-ghost !p-1 text-[var(--mc-color-text-secondary)]"
                    onClick={() => setMenuObjId(menuObjId === o.id ? null : o.id)}
                  >
                    ···
                  </button>
                  {menuObjId === o.id ? (
                    <div
                      ref={menuRef}
                      className="absolute right-0 top-7 z-20 min-w-[160px] rounded-lg border border-[var(--mc-color-border)] bg-[var(--mc-color-bg)] py-1"
                    >
                      {(esJefe || o.creado_por === me.id) ? (
                        <button
                          type="button"
                          className="mc-btn-ghost w-full justify-start px-3 py-2 text-xs"
                          onClick={() => {
                            setMenuObjId(null);
                            // abrir modal edición — por implementar
                          }}
                        >
                          Editar
                        </button>
                      ) : null}
                      {puedeEliminarObjetivo(o.id) ? (
                        <button
                          type="button"
                          className="mc-btn-ghost w-full justify-start px-3 py-2 text-xs !text-[var(--mc-color-danger)]"
                          onClick={() => {
                            setMenuObjId(null);
                            setEliminarObjId(o.id);
                          }}
                        >
                          Eliminar
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Panel lateral */}
        <div className="mc-card flex flex-col gap-4">
          {!objetivoSel ? (
            <p className="text-sm text-[var(--mc-color-text-secondary)]">
              Selecciona un objetivo para ver sus tareas.
            </p>
          ) : (
            <>
              {/* Header del objetivo */}
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-[var(--mc-color-text)]">{objetivoSel.titulo}</p>
                  {objetivoSel.descripcion ? (
                    <p className="mt-1 text-xs text-[var(--mc-color-text-secondary)]">{objetivoSel.descripcion}</p>
                  ) : null}
                </div>
                <span className={`mc-badge ${estadoBadge[objetivoSel.estado]} shrink-0 text-[10px]`}>
                  {estadoObjLabel[objetivoSel.estado]}
                </span>
              </div>

              {/* Barra de progreso */}
              <div className="flex flex-col gap-1">
                <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--mc-color-border)]">
                  <div
                    className="h-full rounded-full bg-[var(--mc-color-accent)]"
                    style={{ width: `${objetivoSel.pct}%` }}
                  />
                </div>
                <span className="text-xs text-[var(--mc-color-text-secondary)]">
                  {objetivoSel.completadas} de {objetivoSel.total_tareas} tareas completadas · {objetivoSel.pct}%
                </span>
              </div>

              {/* Tareas vinculadas */}
              <div className="border-t border-[var(--mc-color-border)] pt-3">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-[10px] font-medium uppercase tracking-wide text-[var(--mc-color-text-secondary)]">
                    Tareas vinculadas
                  </span>
                  <button
                    type="button"
                    className="mc-btn-secondary !px-2 !py-1 text-xs"
                    onClick={() => setModalTarea(true)}
                  >
                    + Añadir
                  </button>
                </div>
                {loadTareas ? (
                  <p className="text-sm text-[var(--mc-color-text-secondary)]">Cargando…</p>
                ) : tareasVinc.length === 0 ? (
                  <p className="text-sm text-[var(--mc-color-text-secondary)]">Sin tareas vinculadas.</p>
                ) : (
                  <div className="flex max-h-[300px] flex-col gap-2 overflow-y-auto">
                    {tareasVinc.map((t) => (
                      <div
                        key={t.id}
                        className="flex items-center justify-between gap-2 rounded-lg bg-[var(--mc-color-bg-secondary)] px-3 py-2"
                      >
                        <p className="min-w-0 flex-1 truncate text-xs text-[var(--mc-color-text)]">
                          {t.titulo}
                        </p>
                        <span className={`mc-badge ${estadoTareaBadge[t.estado] ?? 'mc-badge-neutral'} shrink-0 text-[9px]`}>
                          {estadoTareaLabel[t.estado] ?? t.estado}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Modal nuevo objetivo */}
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
              Responsable
              <select className="mc-input mt-1" value={responsableObjId} onChange={(e) => setResponsableObjId(e.target.value)}>
                <option value="">Selecciona…</option>
                {usuariosActivos.map((u) => (
                  <option key={u.id} value={u.id}>{u.nombre}</option>
                ))}
              </select>
            </label>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className="mc-btn-ghost" onClick={() => setModalNuevo(false)}>Cancelar</button>
              <button
                type="button"
                className="mc-btn"
                disabled={mutCrearObj.isPending || !tituloObj.trim() || !responsableObjId.trim()}
                onClick={() => void submitNuevoObjetivo()}
              >
                {mutCrearObj.isPending ? 'Guardando…' : 'Crear objetivo'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Modal añadir tarea */}
      {modalTarea && seleccionId ? (
        <div className="mc-overlay flex items-center justify-center p-4" role="presentation" onClick={() => setModalTarea(false)}>
          <div className="mc-modal" role="dialog" aria-modal onClick={(e) => e.stopPropagation()}>
            <h2 className="text-base font-semibold text-[var(--mc-color-text)]">Añadir tarea al objetivo</h2>
            <p className="mt-1 text-xs text-[var(--mc-color-text-secondary)]">{objetivoSel?.titulo}</p>
            <label className="mt-3 block text-xs font-medium text-[var(--mc-color-text-secondary)]">
              Título
              <input
                className="mc-input mt-1"
                value={nuevaTareaTitulo}
                onChange={(e) => setNuevaTareaTitulo(e.target.value)}
                placeholder="Ej: Configurar firewall perimetral…"
              />
            </label>
            <label className="mt-3 block text-xs font-medium text-[var(--mc-color-text-secondary)]">
              Prioridad
              <select className="mc-input mt-1" value={nuevaTareaPrioridad} onChange={(e) => setNuevaTareaPrioridad(e.target.value as Tarea['prioridad'])}>
                <option value="baja">Baja</option>
                <option value="media">Media</option>
                <option value="alta">Alta</option>
              </select>
            </label>
            {usuariosActivos.length > 0 ? (
              <label className="mt-3 block text-xs font-medium text-[var(--mc-color-text-secondary)]">
                Responsable
                <select className="mc-input mt-1" value={nuevaTareaAsignadoId} onChange={(e) => setNuevaTareaAsignadoId(e.target.value)}>
                  {usuariosActivos.map((u) => (
                    <option key={u.id} value={u.id}>{u.nombre}</option>
                  ))}
                </select>
              </label>
            ) : null}
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className="mc-btn-ghost" onClick={() => setModalTarea(false)}>Cancelar</button>
              <button
                type="button"
                className="mc-btn"
                disabled={mutAddTarea.isPending || !nuevaTareaTitulo.trim()}
                onClick={() => addTareaVinculada()}
              >
                {mutAddTarea.isPending ? 'Guardando…' : 'Añadir tarea'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Modal eliminar objetivo */}
      {eliminarObjId ? (
        <div className="mc-overlay flex items-center justify-center p-4" role="presentation" onClick={() => setEliminarObjId(null)}>
          <div className="mc-modal" role="dialog" aria-modal onClick={(e) => e.stopPropagation()}>
            <h2 className="text-base font-semibold text-[var(--mc-color-text)]">Eliminar objetivo</h2>
            <p className="mt-1 text-xs text-[var(--mc-color-text-secondary)]">
              {objetivoEliminar?.titulo} · Esta acción no se puede deshacer.
            </p>
            <label className="mt-3 block text-xs font-medium text-[var(--mc-color-text-secondary)]">
              Motivo (mín. 10 caracteres)
              <textarea
                className="mc-input mt-1 min-h-[80px]"
                value={motivoEliminar}
                onChange={(e) => setMotivoEliminar(e.target.value)}
                placeholder="Indica el motivo de la eliminación…"
              />
            </label>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className="mc-btn-ghost" onClick={() => { setEliminarObjId(null); setMotivoEliminar(''); }}>
                Cancelar
              </button>
              <button
                type="button"
                className="mc-btn !bg-[var(--mc-color-danger)]"
                disabled={mutEliminarObj.isPending || motivoEliminar.trim().length < 10}
                onClick={async () => {
                  if (!eliminarObjId) return;
                  try {
                    await mutEliminarObj.mutateAsync({
                      objetivoId: eliminarObjId,
                      usuarioId: me.id,
                      motivo: motivoEliminar.trim(),
                    });
                  } catch {
                    // toast ya lo maneja onError
                  }
                }}
              >
                {mutEliminarObj.isPending ? 'Eliminando…' : 'Confirmar eliminación'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}