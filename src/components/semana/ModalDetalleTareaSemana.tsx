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

        {!editando ? (
          <div className="mt-3 space-y-2 text-sm text-[var(--mc-color-text)]">
            <p>
              <span className="font-medium">Titulo:</span> {tarea.titulo}
            </p>
            <p>
              <span className="font-medium">Prioridad:</span> {tarea.prioridad}
            </p>
            <p>
              <span className="font-medium">Estado:</span> {tarea.estado}
            </p>
            <p>
              <span className="font-medium">Descripcion:</span> {tarea.descripcion ?? 'Sin descripcion'}
            </p>
            <p>
              <span className="font-medium">Objetivo:</span>{' '}
              {tarea.objetivo_id ? objetivos.find((o) => o.id === tarea.objetivo_id)?.titulo ?? 'Objetivo vinculado' : 'Sin objetivo'}
            </p>
            <p>
              <span className="font-medium">Responsable:</span>{' '}
              {usuariosAsignables.find((u) => u.id === tarea.asignado_a)?.nombre ?? tarea.asignado_a}
            </p>
          </div>
        ) : (
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
        )}

        {!readOnly ? (
          <div className="mt-4 rounded-[var(--mc-radius-md)] border border-[var(--mc-color-border)] p-3">
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" className="mc-btn-secondary text-xs" onClick={() => setEditando((v) => !v)} disabled={busy}>
                {editando ? 'Cancelar edición' : 'Editar'}
              </button>
              {editando ? (
                <button type="button" className="mc-btn text-xs" onClick={() => void guardar()} disabled={busy || !titulo.trim()}>
                  {busy ? 'Guardando…' : 'Guardar cambios'}
                </button>
              ) : null}
              <button
                type="button"
                className="mc-btn-ghost text-xs !text-[var(--mc-color-danger)]"
                onClick={() => setPidiendoMotivo((v) => !v)}
                disabled={busy}
              >
                Eliminar
              </button>
            </div>
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
