/**
 * components/semana/ModalDetalleTareaSemana.tsx
 * Migrado a <Modal> — Sprint 4.
 *
 * Tres vistas explícitas (sustituye bloques condicionales anidados):
 *   detalle   — info + acciones
 *   editar    — formulario inline
 *   eliminar  — motivo obligatorio
 */

import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';

import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { TAREA_BADGE, TAREA_LABEL } from '@/lib/estadoConfig';
import type { Objetivo, Tarea, Usuario } from '@/types';

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
const PRIORIDAD_ICON: Record<string, string> = {
  alta: '🔴',
  media: '🟡',
  baja: '⚪',
};

const MIN_MOTIVO = 10;

type Vista = 'detalle' | 'editar' | 'eliminar';

const MODAL_TITULO: Record<Vista, string> = {
  detalle: 'Detalle de tarea',
  editar: 'Editar tarea',
  eliminar: 'Eliminar tarea',
};

const ELIM_HINT_ID = 'modal-detalle-eliminar-hint';
const ELIM_ERR_ID = 'modal-detalle-eliminar-error';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------
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
  const [vista, setVista] = useState<Vista>('detalle');
  const [titulo, setTitulo] = useState('');
  const [prioridad, setPrioridad] = useState<Tarea['prioridad']>('media');
  const [descripcion, setDescripcion] = useState('');
  const [objetivoId, setObjetivoId] = useState('');
  const [asignadoId, setAsignadoId] = useState('');
  const [motivoEliminar, setMotivoEliminar] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!tarea) return;
    setVista('detalle');
    setMotivoEliminar('');
    setTitulo(tarea.titulo);
    setPrioridad(tarea.prioridad);
    setDescripcion(tarea.descripcion ?? '');
    setObjetivoId(tarea.objetivo_id ?? '');
    setAsignadoId(tarea.asignado_a ?? '');
  }, [tarea?.id]);

  const motivoLen = motivoEliminar.trim().length;
  const motivoOk = motivoLen >= MIN_MOTIVO;
  const elimDescribedBy =
    [ELIM_HINT_ID, motivoLen > 0 && !motivoOk ? ELIM_ERR_ID : null].filter(Boolean).join(' ') || undefined;

  async function guardar() {
    if (readOnly || !tarea || !titulo.trim()) return;
    setBusy(true);
    try {
      await onGuardar({
        tareaId: tarea.id,
        titulo: titulo.trim(),
        prioridad,
        descripcion: descripcion.trim(),
        objetivo_id: objetivoId || null,
        asignado_a: asignadoId || null,
      });
      setVista('detalle');
    } finally {
      setBusy(false);
    }
  }

  async function eliminar() {
    if (readOnly || !tarea || !motivoOk) return;
    setBusy(true);
    try {
      await onEliminar({ tareaId: tarea.id, motivo: motivoEliminar.trim() });
      onClose();
    } finally {
      setBusy(false);
    }
  }

  function renderFooter(): ReactNode {
    if (vista === 'editar') {
      return (
        <>
          <Button variant="ghost" onClick={() => setVista('detalle')} disabled={busy}>
            Cancelar
          </Button>
          <Button onClick={() => void guardar()} disabled={busy || !titulo.trim()}>
            {busy ? 'Guardando…' : 'Guardar cambios'}
          </Button>
        </>
      );
    }
    if (vista === 'eliminar') {
      return (
        <>
          <Button variant="ghost" onClick={() => setVista('detalle')} disabled={busy}>
            Cancelar
          </Button>
          <Button onClick={() => void eliminar()} disabled={busy || !motivoOk} variant="danger">
            {busy ? 'Eliminando…' : 'Confirmar eliminación'}
          </Button>
        </>
      );
    }
    return (
      <Button variant="ghost" onClick={onClose} disabled={busy}>
        Cerrar
      </Button>
    );
  }

  function renderCuerpo(): ReactNode {
    if (!tarea) return null;

    switch (vista) {
      case 'detalle':
        return (
          <div className="flex flex-col gap-3">
            <h3 className="text-base font-semibold text-[var(--mc-color-text)]">
              {tarea.titulo}
            </h3>

            <div className="flex flex-wrap items-center gap-2">
              <span className={`mc-badge ${TAREA_BADGE[tarea.estado] ?? 'mc-badge-neutral'}`}>
                {TAREA_LABEL[tarea.estado] ?? tarea.estado}
              </span>
              <span className="text-xs text-[var(--mc-color-text-secondary)]">
                {PRIORIDAD_ICON[tarea.prioridad]} {tarea.prioridad}
              </span>
              {tarea.fecha_planificada && (
                <span className="text-xs text-[var(--mc-color-text-secondary)]">
                  · {tarea.fecha_planificada}
                </span>
              )}
            </div>

            {tarea.descripcion ? (
              <p className="text-sm text-[var(--mc-color-text-secondary)]">{tarea.descripcion}</p>
            ) : (
              <p className="text-sm italic text-[var(--mc-color-text-secondary)]">
                Sin descripción.
              </p>
            )}

            {tarea.objetivo_id && (
              <p className="text-xs text-[var(--mc-color-text-secondary)]">
                Objetivo: {objetivos.find((o) => o.id === tarea.objetivo_id)?.titulo ?? '—'}
              </p>
            )}

            <p className="text-xs text-[var(--mc-color-text-secondary)]">
              Responsable: {usuariosAsignables.find((u) => u.id === tarea.asignado_a)?.nombre ?? tarea.asignado_a}
            </p>

            {!readOnly && (
              <div className="mt-2 border-t border-[var(--mc-color-border)] pt-4">
                <p className="mb-3 text-[10px] font-semibold uppercase tracking-wide text-[var(--mc-color-text-secondary)]">
                  Acciones
                </p>

                {tarea.tipo === 'libre' ? (
                  <div className="flex flex-wrap items-center gap-2">
                    {onPlanificar && <PlanificarInline tarea={tarea} onPlanificar={onPlanificar} />}
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => setVista('eliminar')}
                    >
                      Eliminar
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {['pendiente', 'atrasada', 'reprogramada'].includes(tarea.estado) && onIniciar && (
                      <Button size="sm" onClick={() => void onIniciar(tarea)}>Iniciar</Button>
                    )}
                    {tarea.estado === 'en_progreso' && onCompletar && (
                      <Button size="sm" onClick={() => onCompletar(tarea)}>Completar</Button>
                    )}
                    {['pendiente', 'atrasada', 'reprogramada'].includes(tarea.estado) && onReprogramar && (
                      <Button variant="ghost" size="sm" onClick={() => onReprogramar(tarea)}>
                        Reprogramar
                      </Button>
                    )}
                    {['pendiente', 'atrasada', 'en_progreso', 'reprogramada'].includes(tarea.estado) && onBloquear && (
                      <Button variant="ghost" size="sm" onClick={() => onBloquear(tarea)}>
                        Bloquear
                      </Button>
                    )}
                    {!['completada', 'cancelada'].includes(tarea.estado) && (
                      <Button variant="ghost" size="sm" onClick={() => setVista('editar')}>
                        Editar
                      </Button>
                    )}
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => setVista('eliminar')}
                    >
                      Eliminar
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        );

      case 'editar':
        return (
          <div className="flex flex-col gap-4">
            <div className="mc-field">
              <label className="mc-field-label" htmlFor="edit-titulo">Título</label>
              <input
                id="edit-titulo"
                className="mc-input"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                autoFocus
                required
              />
            </div>
            <div className="mc-field">
              <label className="mc-field-label" htmlFor="edit-prioridad">Prioridad</label>
              <select
                id="edit-prioridad"
                className="mc-input"
                value={prioridad}
                onChange={(e) => setPrioridad(e.target.value as Tarea['prioridad'])}
              >
                <option value="baja">Baja</option>
                <option value="media">Media</option>
                <option value="alta">Alta</option>
              </select>
            </div>
            <div className="mc-field">
              <label className="mc-field-label" htmlFor="edit-desc">Descripción</label>
              <textarea
                id="edit-desc"
                className="mc-input"
                style={{ minHeight: 90, resize: 'vertical' }}
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
              />
            </div>
            <div className="mc-field">
              <label className="mc-field-label" htmlFor="edit-objetivo">Objetivo</label>
              <select id="edit-objetivo" className="mc-input" value={objetivoId} onChange={(e) => setObjetivoId(e.target.value)}>
                <option value="">Sin objetivo</option>
                {objetivos.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.titulo}
                  </option>
                ))}
              </select>
            </div>
            {usuariosAsignables.length > 0 && (
              <div className="mc-field">
                <label className="mc-field-label" htmlFor="edit-resp">Responsable</label>
                <select id="edit-resp" className="mc-input" value={asignadoId} onChange={(e) => setAsignadoId(e.target.value)}>
                  {usuariosAsignables.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.nombre}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        );

      case 'eliminar':
        return (
          <div className="flex flex-col gap-4">
            <p id={ELIM_HINT_ID} className="text-sm text-[var(--mc-color-text-secondary)]">
              Esta acción no se puede deshacer. Indica el motivo (mínimo {MIN_MOTIVO} caracteres).
            </p>
            <div className="mc-field">
              <label className="mc-field-label" htmlFor="elim-motivo">
                <span className="flex justify-between">
                  <span>Motivo de eliminación</span>
                  <span
                    aria-live="polite"
                    className={`mc-char-count ${motivoOk ? 'mc-char-count-ok' : ''}`}
                  >
                    {motivoLen}/{MIN_MOTIVO}
                  </span>
                </span>
              </label>
              <textarea
                id="elim-motivo"
                className="mc-input"
                style={{ minHeight: 90, resize: 'vertical' }}
                value={motivoEliminar}
                onChange={(e) => setMotivoEliminar(e.target.value)}
                placeholder="Indica el motivo de la eliminación…"
                autoFocus
                aria-describedby={elimDescribedBy}
                aria-invalid={motivoLen > 0 && !motivoOk}
              />
            </div>
            {motivoLen > 0 && !motivoOk && (
              <p id={ELIM_ERR_ID} role="alert" className="text-xs text-[var(--mc-color-danger)]">
                Mínimo {MIN_MOTIVO} caracteres (llevas {motivoLen}/{MIN_MOTIVO}).
              </p>
            )}
          </div>
        );

      default:
        return null;
    }
  }

  return (
    <Modal
      open={open && tarea !== null}
      onClose={onClose}
      title={MODAL_TITULO[vista]}
      size="lg"
      footer={renderFooter()}
    >
      {renderCuerpo()}
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// PlanificarInline — selector de fecha para tareas libres (subcomponente)
// ---------------------------------------------------------------------------
function PlanificarInline({
  tarea,
  onPlanificar,
}: {
  tarea: Tarea;
  onPlanificar: (t: Tarea, fecha: string) => Promise<void>;
}) {
  const [fecha, setFecha] = useState('');
  const [busy, setBusy] = useState(false);

  return (
    <div className="flex items-center gap-2">
      <input
        type="date"
        className="mc-input !w-auto !py-1 !text-xs"
        value={fecha}
        onChange={(e) => setFecha(e.target.value)}
        aria-label="Fecha para planificar"
      />
      <Button
        size="sm"
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
      </Button>
    </div>
  );
}
