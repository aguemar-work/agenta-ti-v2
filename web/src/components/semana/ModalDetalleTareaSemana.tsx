import { useEffect, useState } from 'react';

import type { Objetivo, Tarea, Usuario } from '@/types';

type Props = {
  open: boolean;
  tarea: Tarea | null;
  objetivos: Pick<Objetivo, 'id' | 'titulo'>[];
  usuariosAsignables?: Pick<Usuario, 'id' | 'nombre'>[];
  readOnly?: boolean;
  onClose: () => void;
  onGuardar: (input: {
    tareaId: string;
    titulo: string;
    prioridad: Tarea['prioridad'];
    descripcion: string;
    objetivo_id?: string | null;
    asignado_a?: string | null;
  }) => Promise<void>;
  onEliminar: (input: { tareaId: string; motivo: string }) => Promise<void>;
  onIniciar?: (t: Tarea) => Promise<void>;
  onCompletar?: (t: Tarea) => void;
  onReprogramar?: (t: Tarea) => void;
  onBloquear?: (t: Tarea) => void;
  onPlanificar?: (t: Tarea, fecha: string) => Promise<void>;
};

export function ModalDetalleTareaSemana({
  open,
  tarea,
  objetivos,
  usuariosAsignables = [],
  readOnly = false,
  onClose,
  onGuardar,
  onEliminar,
  onIniciar,
  onCompletar,
  onReprogramar,
  onBloquear,
  onPlanificar,
}: Props) {
  const [editando, setEditando] = useState(false);
  const [titulo, setTitulo] = useState('');
  const [prioridad, setPrioridad] = useState<Tarea['prioridad']>('media');
  const [descripcion, setDescripcion] = useState('');
  const [objetivoId, setObjetivoId] = useState('');
  const [asignadoId, setAsignadoId] = useState('');
  const [motivoEliminar, setMotivoEliminar] = useState('');
  const [pidiendoMotivo, setPidiendoMotivo] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!tarea) return;
    setEditando(false);
    setPidiendoMotivo(false);
    setMotivoEliminar('');
    setTitulo(tarea.titulo);
    setPrioridad(tarea.prioridad);
    setDescripcion(tarea.descripcion ?? '');
    setObjetivoId(tarea.objetivo_id ?? '');
    setAsignadoId(tarea.asignado_a ?? '');
  }, [tarea]);

  if (!open || !tarea) return null;

  const tareaActual = tarea;
  const motivoOk = motivoEliminar.trim().length >= 10;
  const badgeClass: Record<string, string> = {
    pendiente: 'mc-badge-neutral',
    en_progreso: 'mc-badge-info',
    atrasada: 'mc-badge-danger',
    bloqueada: 'mc-badge-warning',
    completada: 'mc-badge-success',
    reprogramada: 'mc-badge-neutral',
    cancelada: 'mc-badge-neutral',
  };

  const badgeLabel: Record<string, string> = {
    pendiente: 'Pendiente',
    en_progreso: 'En progreso',
    atrasada: 'Atrasada',
    bloqueada: 'Bloqueada',
    completada: 'Completada',
    reprogramada: 'Reprogramada',
    cancelada: 'Cancelada',
  };

  async function guardar() {
    if (readOnly || !titulo.trim()) return;
    setBusy(true);
    try {
      await onGuardar({
        tareaId: tareaActual.id,
        titulo: titulo.trim(),
        prioridad,
        descripcion: descripcion.trim(),
        objetivo_id: objetivoId || null,
        asignado_a: asignadoId || null,
      });
      setEditando(false);
    } finally {
      setBusy(false);
    }
  }

  async function eliminar() {
    if (readOnly || !motivoOk) return;
    setBusy(true);
    try {
      await onEliminar({
        tareaId: tareaActual.id,
        motivo: motivoEliminar.trim(),
      });
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mc-overlay flex items-center justify-center p-4" role="presentation" onClick={onClose}>
      <div className="mc-modal max-w-[680px]" role="dialog" aria-modal onClick={(e) => e.stopPropagation()}>
        <h2 className="text-base font-semibold text-[var(--mc-color-text)]">Detalle de tarea</h2>

        {!editando && !pidiendoMotivo ? (
          <div className="mt-4 space-y-2 text-sm text-[var(--mc-color-text)]">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`mc-badge ${badgeClass[tarea.estado] ?? 'mc-badge-neutral'}`}>{badgeLabel[tarea.estado] ?? tarea.estado}</span>
              <span className="text-xs text-[var(--mc-color-text-secondary)]">
                {tarea.prioridad === 'alta' ? '🔴' : tarea.prioridad === 'media' ? '🟡' : '⚪'} {tarea.prioridad}
              </span>
              {tarea.fecha_planificada ? (
                <span className="text-xs text-[var(--mc-color-text-secondary)]">· {tarea.fecha_planificada}</span>
              ) : null}
            </div>
            {tarea.descripcion ? (
              <p className="text-sm text-[var(--mc-color-text-secondary)]">{tarea.descripcion}</p>
            ) : (
              <p className="text-sm italic text-[var(--mc-color-text-secondary)]">Sin descripción.</p>
            )}
            {tarea.objetivo_id ? (
              <p className="text-xs text-[var(--mc-color-text-secondary)]">
                Objetivo: {objetivos.find((o) => o.id === tarea.objetivo_id)?.titulo ?? '—'}
              </p>
            ) : null}
            <p className="text-xs text-[var(--mc-color-text-secondary)]">
              Responsable: {usuariosAsignables.find((u) => u.id === tarea.asignado_a)?.nombre ?? tarea.asignado_a}
            </p>
          </div>
        ) : editando ? (
          <div className="mt-3">
            <label className="block text-xs font-medium text-[var(--mc-color-text-secondary)]">
              Titulo
              <input className="mc-input mt-1" value={titulo} onChange={(e) => setTitulo(e.target.value)} />
            </label>
            <label className="mt-3 block text-xs font-medium text-[var(--mc-color-text-secondary)]">
              Prioridad
              <select className="mc-input mt-1" value={prioridad} onChange={(e) => setPrioridad(e.target.value as Tarea['prioridad'])}>
                <option value="baja">Baja</option>
                <option value="media">Media</option>
                <option value="alta">Alta</option>
              </select>
            </label>
            <label className="mt-3 block text-xs font-medium text-[var(--mc-color-text-secondary)]">
              Descripcion
              <textarea className="mc-input mt-1 min-h-[90px]" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
            </label>
            <label className="mt-3 block text-xs font-medium text-[var(--mc-color-text-secondary)]">
              Objetivo
              <select className="mc-input mt-1" value={objetivoId} onChange={(e) => setObjetivoId(e.target.value)}>
                <option value="">Sin objetivo</option>
                {objetivos.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.titulo}
                  </option>
                ))}
              </select>
            </label>
            {usuariosAsignables.length > 0 ? (
              <label className="mt-3 block text-xs font-medium text-[var(--mc-color-text-secondary)]">
                Responsable
                <select className="mc-input mt-1" value={asignadoId} onChange={(e) => setAsignadoId(e.target.value)}>
                  {usuariosAsignables.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.nombre}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </div>
        ) : null}

        {!readOnly && !editando && !pidiendoMotivo ? (
          tarea.tipo === 'libre' ? (
            <div className="mt-4 border-t border-[var(--mc-color-border)] pt-4">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--mc-color-text-secondary)]">Acciones</p>
              <div className="flex flex-wrap items-center gap-2">
                {onPlanificar ? <PlanificarInline tarea={tarea} onPlanificar={onPlanificar} /> : null}
                <button
                  type="button"
                  className="mc-btn-ghost text-xs !text-[var(--mc-color-danger)]"
                  onClick={() => setPidiendoMotivo(true)}
                >
                  Eliminar
                </button>
              </div>
              {pidiendoMotivo ? (
                <div className="mt-3">
                  <label className="block text-xs font-medium text-[var(--mc-color-text-secondary)]">
                    Motivo de eliminación (mín. 10 caracteres)
                    <textarea
                      className="mc-input mt-1 min-h-[80px]"
                      value={motivoEliminar}
                      onChange={(e) => setMotivoEliminar(e.target.value)}
                      placeholder="Indica el motivo…"
                    />
                  </label>
                  <div className="mt-2 flex justify-end">
                    <button type="button" className="mc-btn text-xs" onClick={() => void eliminar()} disabled={busy || !motivoOk}>
                      {busy ? 'Eliminando…' : 'Confirmar eliminación'}
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="mt-4 border-t border-[var(--mc-color-border)] pt-4">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--mc-color-text-secondary)]">Acciones</p>
              <div className="flex flex-wrap gap-2">
                {(tarea.estado === 'pendiente' || tarea.estado === 'atrasada' || tarea.estado === 'reprogramada') && onIniciar ? (
                  <button type="button" className="mc-btn text-xs" onClick={() => void onIniciar(tarea)}>
                    Iniciar
                  </button>
                ) : null}
                {tarea.estado === 'en_progreso' && onCompletar ? (
                  <button type="button" className="mc-btn text-xs" onClick={() => onCompletar(tarea)}>
                    Completar
                  </button>
                ) : null}
                {(tarea.estado === 'pendiente' || tarea.estado === 'atrasada' || tarea.estado === 'reprogramada') && onReprogramar ? (
                  <button
                    type="button"
                    className="mc-btn-secondary text-xs !text-[var(--mc-color-warning)]"
                    onClick={() => onReprogramar(tarea)}
                  >
                    Reprogramar
                  </button>
                ) : null}
                {(tarea.estado === 'pendiente' ||
                  tarea.estado === 'atrasada' ||
                  tarea.estado === 'en_progreso' ||
                  tarea.estado === 'reprogramada') &&
                onBloquear ? (
                  <button
                    type="button"
                    className="mc-btn-secondary text-xs !text-[var(--mc-color-warning)]"
                    onClick={() => onBloquear(tarea)}
                  >
                    Bloquear
                  </button>
                ) : null}
                {tarea.estado !== 'completada' && tarea.estado !== 'cancelada' ? (
                  <button type="button" className="mc-btn-secondary text-xs" onClick={() => setEditando(true)}>
                    Editar
                  </button>
                ) : null}
                <button type="button" className="mc-btn-ghost text-xs !text-[var(--mc-color-danger)]" onClick={() => setPidiendoMotivo(true)}>
                  Eliminar
                </button>
              </div>
            </div>
          )
        ) : null}

        {!readOnly && (editando || pidiendoMotivo) ? (
          <div className="mt-4 rounded-[var(--mc-radius-md)] border border-[var(--mc-color-border)] p-3">
            {editando ? (
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" className="mc-btn-secondary text-xs" onClick={() => setEditando(false)} disabled={busy}>
                  Cancelar edición
                </button>
                <button type="button" className="mc-btn text-xs" onClick={() => void guardar()} disabled={busy || !titulo.trim()}>
                  {busy ? 'Guardando…' : 'Guardar cambios'}
                </button>
              </div>
            ) : null}
            {pidiendoMotivo ? (
              <div className="mt-3">
                <label className="block text-xs font-medium text-[var(--mc-color-text-secondary)]">
                  Motivo de eliminación (mín. 10 caracteres)
                  <textarea
                    className="mc-input mt-1 min-h-[90px]"
                    value={motivoEliminar}
                    onChange={(e) => setMotivoEliminar(e.target.value)}
                    placeholder="Indica el motivo de la eliminación..."
                  />
                </label>
                <div className="mt-2 flex justify-end">
                  <button type="button" className="mc-btn text-xs" onClick={() => void eliminar()} disabled={busy || !motivoOk}>
                    {busy ? 'Eliminando…' : 'Confirmar eliminación'}
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="mt-4 flex justify-end">
          <button type="button" className="mc-btn-ghost" onClick={onClose} disabled={busy}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

function PlanificarInline({ tarea, onPlanificar }: { tarea: Tarea; onPlanificar: (t: Tarea, fecha: string) => Promise<void> }) {
  const [fecha, setFecha] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <div className="flex items-center gap-2">
      <input type="date" className="mc-input !py-1 text-xs" value={fecha} onChange={(e) => setFecha(e.target.value)} />
      <button
        type="button"
        className="mc-btn text-xs"
        disabled={!fecha || busy}
        onClick={async () => {
          setBusy(true);
          try {
            await onPlanificar(tarea, fecha);
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? '…' : 'Planificar'}
      </button>
    </div>
  );
}
