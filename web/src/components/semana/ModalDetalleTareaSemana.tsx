/**
 * components/semana/ModalDetalleTareaSemana.tsx
 * Migrado a <Modal> — Sprint 4.
 *
 * Tres vistas explícitas (sustituye bloques condicionales anidados):
 *   detalle   — info + acciones
 *   editar    — formulario inline
 *   eliminar  — motivo obligatorio
 */

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { MoreHorizontal, X } from 'lucide-react';

import { Modal } from '@/components/ui/Modal';
import { Button, CancelButton } from '@/components/ui/Button';
import { JustificacionField } from '@/components/ui/JustificacionField';
import { useDraftForm } from '@/hooks/useDraftForm';
import { TAREA_BADGE, TAREA_LABEL } from '@/lib/estadoConfig';
import { MIN_JUSTIFICACION_CHARS } from '@/lib/constants';
import { fechaLocalDdMmYyyy } from '@/lib/fecha';
import type { Objetivo, Tarea, Usuario } from '@/types';

type EditarTareaDraft = {
  titulo: string;
  prioridad: Tarea['prioridad'];
  descripcion: string;
  objetivoId: string;
  asignadoId: string;
};

type TareaLogHistorial = {
  tipo_accion: string;
  justificacion: string | null;
  created_at: string;
  usuario_nombre?: string;
};

const EDITAR_IDLE: EditarTareaDraft = {
  titulo: '',
  prioridad: 'media',
  descripcion: '',
  objetivoId: '',
  asignadoId: '',
};

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
const PRIORIDAD_ICON: Record<string, { emoji: string; label: string }> = {
  alta:  { emoji: '🔴', label: 'Prioridad alta'  },
  media: { emoji: '◆', label: 'Prioridad media' },
  baja:  { emoji: '⚪', label: 'Prioridad baja'  },
};

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
}: Props) {
  const [vista, setVista] = useState<Vista>('detalle');
  const [motivoEliminar, setMotivoEliminar] = useState('');
  const [busy, setBusy] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [logsHistorial, setLogsHistorial] = useState<TareaLogHistorial[]>([]);
  const menuRef = useRef<HTMLDivElement>(null);

  const initialEditar = useMemo<EditarTareaDraft>(() => {
    if (!tarea) return EDITAR_IDLE;
    return {
      titulo: tarea.titulo,
      prioridad: tarea.prioridad,
      descripcion: tarea.descripcion ?? '',
      objetivoId: tarea.objetivo_id ?? '',
      asignadoId: tarea.asignado_a ?? '',
    };
  }, [tarea]);

  const editarDraftKey = tarea ? `tarea-detalle-editar-${tarea.id}` : '__tarea-detalle-idle__';
  const {
    form: editarForm,
    setForm: setEditarForm,
    hasChanges: editarHasChanges,
    clearDraft: clearEditarDraft,
  } = useDraftForm(editarDraftKey, initialEditar, {
    enabled: Boolean(open && tarea && vista === 'editar'),
  });

  const tareaId = tarea?.id;

  useEffect(() => {
    if (!tareaId) return;

    queueMicrotask(() => {
      setVista('detalle');
      setMotivoEliminar('');
      setMenuOpen(false);
      setLogsHistorial([]);
    });

    // Fetch logs de esta tarea para el historial
    import('@/lib/insforge').then(({ getInsforge }) => {
      getInsforge().database
        .from('log_accion')
        .select('tipo_accion,justificacion,created_at,usuario:usuario_id(nombre)')
        .eq('tarea_id', tareaId)
        .order('created_at', { ascending: false })
        .limit(10)
        .then(({ data }) => {
          if (data) {
            setLogsHistorial(data.map((r: Record<string, unknown>) => ({
              tipo_accion:    r.tipo_accion as string,
              justificacion:  r.justificacion as string | null,
              created_at:     r.created_at as string,
              usuario_nombre: (r.usuario as { nombre?: string } | null)?.nombre,
            })));
          }
        });
    });
  }, [tareaId]);

  const motivoLen = motivoEliminar.trim().length;
  const motivoOk = motivoLen >= MIN_JUSTIFICACION_CHARS;
  const elimDescribedBy =
    [ELIM_HINT_ID, motivoLen > 0 && !motivoOk ? ELIM_ERR_ID : null].filter(Boolean).join(' ') || undefined;

  async function guardar() {
    if (readOnly || !tarea || !editarForm.titulo.trim()) return;
    setBusy(true);
    try {
      await onGuardar({
        tareaId: tarea.id,
        titulo: editarForm.titulo.trim(),
        prioridad: editarForm.prioridad,
        descripcion: editarForm.descripcion.trim(),
        objetivo_id: editarForm.objetivoId || null,
        asignado_a: editarForm.asignadoId || null,
      });
      clearEditarDraft();
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
      handleModalClose();
    } finally {
      setBusy(false);
    }
  }

  function renderFooter(): ReactNode {
    if (vista === 'editar') {
      return (
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Button
            variant="primary"
            size="lg"
            fullWidth
            onClick={() => void guardar()}
            disabled={busy || !editarForm.titulo.trim()}
          >
            {busy ? 'Guardando…' : 'Guardar cambios'}
          </Button>
          <CancelButton
            onClick={() => { clearEditarDraft(); setVista('detalle'); }}
            disabled={busy}
          />
        </div>
      );
    }
    if (vista === 'eliminar') {
      return (
        <>
          <Button variant="ghost" onClick={() => setVista('detalle')} disabled={busy}>
            Cancelar
          </Button>
          <Button variant="danger" onClick={() => void eliminar()} disabled={busy || !motivoOk}>
            {busy ? 'Eliminando…' : 'Confirmar eliminación'}
          </Button>
        </>
      );
    }
    return (
      <div style={{ marginLeft: 'auto' }}>
        <Button
          variant="ghost"
          size="xs"
          onClick={handleModalClose}
          disabled={busy}
          aria-label="Cerrar"
          className="!min-h-[28px] !min-w-[28px] !p-0"
        >
          <X size={14} aria-hidden />
        </Button>
      </div>
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
                <span role="img" aria-label={PRIORIDAD_ICON[tarea.prioridad]?.label ?? tarea.prioridad}>
                  {PRIORIDAD_ICON[tarea.prioridad]?.emoji}
                </span>
                {' '}{tarea.prioridad}
              </span>
              {tarea.fecha_planificada && (
                <span className="text-xs text-[var(--mc-color-text-secondary)]">
                  · {fechaLocalDdMmYyyy(new Date(`${tarea.fecha_planificada}T12:00:00`))}
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

            {logsHistorial.length > 0 && (
              <div className="border-t border-[var(--mc-color-border)] pt-3">
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--mc-color-text-secondary)]">
                  Historial reciente
                </div>
                <div className="flex flex-col gap-2">
                  {logsHistorial.map((log) => (
                    <div key={`${log.created_at}-${log.tipo_accion}`} className="rounded-lg bg-[var(--mc-color-bg-secondary)] px-3 py-2">
                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-[var(--mc-color-text-secondary)]">
                        <span className="font-medium text-[var(--mc-color-text)]">{log.tipo_accion}</span>
                        {log.usuario_nombre && <span>{log.usuario_nombre}</span>}
                        <span>{new Date(log.created_at).toLocaleString('es', { dateStyle: 'short', timeStyle: 'short' })}</span>
                      </div>
                      {log.justificacion && (
                        <p className="mt-1 text-xs text-[var(--mc-color-text)]">{log.justificacion}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!readOnly && (
              <div className="mt-2 border-t border-[var(--mc-color-border)] pt-4">
                <div className="flex items-center gap-2">

                  {/* Botón principal: Iniciar o Completar según estado */}
                  {['pendiente', 'atrasada', 'reprogramada'].includes(tarea.estado) && onIniciar && (
                    <Button variant="primary" size="sm" onClick={() => void onIniciar(tarea)}>
                      Iniciar
                    </Button>
                  )}
                  {tarea.estado === 'en_progreso' && onCompletar && (
                    <Button variant="primary" size="sm" onClick={() => onCompletar(tarea)}>
                      Completar
                    </Button>
                  )}

                  {/* Eliminar — acción destructiva visible pero diferenciada */}
                  {!['completada', 'cancelada'].includes(tarea.estado) && (
                    <Button variant="danger" size="sm" onClick={() => setVista('eliminar')}>
                      Eliminar
                    </Button>
                  )}

                  {/* ··· Menú de acciones secundarias */}
                  {!['completada', 'cancelada'].includes(tarea.estado) && (
                    <div className="relative ml-auto" ref={menuRef}>
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label="Más acciones"
                        aria-expanded={menuOpen}
                        aria-haspopup="menu"
                        onClick={() => setMenuOpen((v) => !v)}
                      >
                        <MoreHorizontal size={15} aria-hidden />
                      </Button>
                      {menuOpen && (
                        <div
                          className="mc-dropdown-menu"
                          role="menu"
                          onBlur={(e) => {
                            if (!menuRef.current?.contains(e.relatedTarget as Node)) {
                              setMenuOpen(false);
                            }
                          }}
                        >
                          {['pendiente', 'atrasada', 'reprogramada', 'en_progreso'].includes(tarea.estado) && onReprogramar && (
                            <button
                              type="button"
                              role="menuitem"
                              className="mc-dropdown-item"
                              onClick={() => { setMenuOpen(false); onReprogramar(tarea); }}
                            >
                              Reprogramar
                            </button>
                          )}
                          {['pendiente', 'atrasada', 'en_progreso', 'reprogramada'].includes(tarea.estado) && onBloquear && (
                            <button
                              type="button"
                              role="menuitem"
                              className="mc-dropdown-item"
                              onClick={() => { setMenuOpen(false); onBloquear(tarea); }}
                            >
                              Bloquear
                            </button>
                          )}
                          <button
                            type="button"
                            role="menuitem"
                            className="mc-dropdown-item"
                            onClick={() => { setMenuOpen(false); setVista('editar'); }}
                          >
                            Editar
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
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
                value={editarForm.titulo}
                onChange={(e) => setEditarForm((p) => ({ ...p, titulo: e.target.value }))}
                autoFocus
                required
              />
            </div>
            <div className="mc-field">
              <label className="mc-field-label" htmlFor="edit-prioridad">Prioridad</label>
              <select
                id="edit-prioridad"
                className="mc-input"
                value={editarForm.prioridad}
                onChange={(e) => setEditarForm((p) => ({ ...p, prioridad: e.target.value as Tarea['prioridad'] }))}
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
                value={editarForm.descripcion}
                onChange={(e) => setEditarForm((p) => ({ ...p, descripcion: e.target.value }))}
              />
            </div>
            <div className="mc-field">
              <label className="mc-field-label" htmlFor="edit-objetivo">Objetivo</label>
              <select id="edit-objetivo" className="mc-input" value={editarForm.objetivoId} onChange={(e) => setEditarForm((p) => ({ ...p, objetivoId: e.target.value }))}>
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
                <select id="edit-resp" className="mc-input" value={editarForm.asignadoId} onChange={(e) => setEditarForm((p) => ({ ...p, asignadoId: e.target.value }))}>
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
              Esta acción no se puede deshacer. Indica el motivo (mínimo {MIN_JUSTIFICACION_CHARS} caracteres).
            </p>
            <JustificacionField
              label="Motivo de eliminación"
              value={motivoEliminar}
              onChange={setMotivoEliminar}
              placeholder="Indica el motivo de la eliminación…"
              disabled={busy}
              autoFocus
            />
          </div>
        );

      default:
        return null;
    }
  }

  function handleModalClose() {
    clearEditarDraft();
    setVista('detalle');
    onClose();
  }

  return (
    <Modal
      open={open && tarea !== null}
      onClose={handleModalClose}
      title={MODAL_TITULO[vista]}
      size="lg"
      hasUnsavedChanges={vista === 'editar' && editarHasChanges}
      footer={renderFooter()}
    >
      {renderCuerpo()}
    </Modal>
  );
}