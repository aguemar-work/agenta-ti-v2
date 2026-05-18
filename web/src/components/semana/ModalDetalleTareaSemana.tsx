/**
 * Modal de detalle / edición / eliminación de tarea en Mi Semana.
 */

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { MoreHorizontal, Trash2 } from 'lucide-react';

import { markModalCompleted, Modal } from '@/components/ui/Modal';
import { Button, CancelButton } from '@/components/ui/Button';
import { JustificacionField } from '@/components/ui/JustificacionField';
import { TareaHistorialSection } from '@/components/tareas/TareaHistorialSection';
import { TareaMetaPillRow } from '@/components/tareas/TareaMetaPillRow';
import { useDraftForm } from '@/hooks/useDraftForm';
import { MIN_JUSTIFICACION_CHARS } from '@/lib/constants';
import { fechaLocalYmd } from '@/lib/fecha';
import type { Objetivo, Tarea, Usuario } from '@/types';

type EditarTareaDraft = {
  titulo: string;
  prioridad: Tarea['prioridad'];
  descripcion: string;
  objetivoId: string;
  asignadoId: string;
};

const EDITAR_IDLE: EditarTareaDraft = {
  titulo: '',
  prioridad: 'media',
  descripcion: '',
  objetivoId: '',
  asignadoId: '',
};

type Vista = 'detalle' | 'editar' | 'eliminar';

const MODAL_TITULO: Record<Vista, string> = {
  detalle: 'Detalle de tarea',
  editar: 'Editar tarea',
  eliminar: 'Eliminar tarea',
};

const ELIM_HINT_ID = 'modal-detalle-eliminar-hint';

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
  const menuRef = useRef<HTMLDivElement>(null);

  const hoyYmd = useMemo(() => fechaLocalYmd(new Date()), []);

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
    });
  }, [tareaId]);

  const motivoOk = motivoEliminar.trim().length >= MIN_JUSTIFICACION_CHARS;

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
      markModalCompleted('modal-detalle-tarea');
      handleModalClose();
    } finally {
      setBusy(false);
    }
  }

  function handleModalClose() {
    clearEditarDraft();
    setVista('detalle');
    onClose();
  }

  function renderFooter(): ReactNode {
    if (vista === 'editar') {
      return (
        <div className="mc-tarea-detalle-footer mc-tarea-detalle-footer--stack">
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
            onClick={() => {
              clearEditarDraft();
              setVista('detalle');
            }}
            disabled={busy}
          />
        </div>
      );
    }

    if (vista === 'eliminar') {
      return (
        <div className="mc-tarea-detalle-footer">
          <Button variant="ghost" onClick={() => setVista('detalle')} disabled={busy}>
            Cancelar
          </Button>
          <Button variant="danger" onClick={() => void eliminar()} disabled={busy || !motivoOk}>
            {busy ? 'Eliminando…' : 'Confirmar eliminación'}
          </Button>
        </div>
      );
    }

    if (readOnly || !tarea) return null;

    const puedeIniciar = ['pendiente', 'atrasada', 'reprogramada'].includes(tarea.estado);
    const puedeCompletar = tarea.estado === 'en_progreso';
    const puedeDestruir = !['completada', 'cancelada'].includes(tarea.estado);
    const puedeSecundario = puedeDestruir;

    return (
      <div className="mc-tarea-detalle-footer mc-tarea-detalle-footer--actions-end">
        {puedeSecundario && (
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              className="mc-btn-icon-secondary"
              aria-label="Más opciones"
              aria-expanded={menuOpen}
              aria-haspopup="menu"
              onClick={() => setMenuOpen((v) => !v)}
            >
              <MoreHorizontal size={18} aria-hidden />
            </button>
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
                {['pendiente', 'atrasada', 'reprogramada', 'en_progreso'].includes(tarea.estado) &&
                  onReprogramar && (
                    <button
                      type="button"
                      role="menuitem"
                      className="mc-dropdown-item"
                      onClick={() => {
                        setMenuOpen(false);
                        onReprogramar(tarea);
                      }}
                    >
                      Reprogramar
                    </button>
                  )}
                {['pendiente', 'atrasada', 'en_progreso', 'reprogramada'].includes(tarea.estado) &&
                  onBloquear && (
                    <button
                      type="button"
                      role="menuitem"
                      className="mc-dropdown-item"
                      onClick={() => {
                        setMenuOpen(false);
                        onBloquear(tarea);
                      }}
                    >
                      Bloquear
                    </button>
                  )}
                <button
                  type="button"
                  role="menuitem"
                  className="mc-dropdown-item"
                  onClick={() => {
                    setMenuOpen(false);
                    setVista('editar');
                  }}
                >
                  Editar
                </button>
              </div>
            )}
          </div>
        )}

        {puedeDestruir && (
          <button
            type="button"
            className="mc-btn-icon-danger"
            aria-label="Eliminar tarea"
            onClick={() => setVista('eliminar')}
          >
            <Trash2 size={18} aria-hidden />
          </button>
        )}

        {puedeIniciar && onIniciar && (
          <Button variant="primary" onClick={() => void onIniciar(tarea)}>
            Iniciar ejecución
          </Button>
        )}
        {puedeCompletar && onCompletar && (
          <Button variant="primary" onClick={() => onCompletar(tarea)}>
            Completar
          </Button>
        )}
      </div>
    );
  }

  function renderCuerpo(): ReactNode {
    if (!tarea) return null;

    switch (vista) {
      case 'detalle':
        return (
          <div className="mc-tarea-detalle">
            <p className="mc-tarea-detalle__kicker">Tarea</p>
            <h2 className="mc-tarea-detalle__titulo">{tarea.titulo}</h2>

            {tarea.descripcion?.trim() ? (
              <p className="mc-tarea-detalle__desc">{tarea.descripcion}</p>
            ) : (
              <p className="mc-tarea-detalle__desc mc-tarea-detalle__desc--empty">
                Sin descripción.
              </p>
            )}

            <TareaMetaPillRow tarea={tarea} hoyYmd={hoyYmd} />

            {tarea.objetivo_id && (
              <p className="mc-tarea-detalle__meta-line">
                Objetivo:{' '}
                {objetivos.find((o) => o.id === tarea.objetivo_id)?.titulo ?? '—'}
              </p>
            )}

            {(() => {
              const u = usuariosAsignables.find((x) => x.id === tarea.asignado_a);
              const nombre = u?.nombre ?? tarea.asignado_a;
              const initials = nombre
                .trim()
                .split(' ')
                .filter(Boolean)
                .map((p) => (p[0] ?? '').toUpperCase())
                .slice(0, 2)
                .join('');
              return (
                <div className="mc-tarea-detalle__responsable">
                  <span className="mc-tarea-detalle__avatar" aria-hidden>
                    {initials}
                  </span>
                  <span>
                    <span className="mc-tarea-detalle__responsable-nombre">{nombre}</span>
                    <span className="mc-tarea-detalle__responsable-rol">Responsable</span>
                  </span>
                </div>
              );
            })()}

            <TareaHistorialSection tareaId={tarea.id} defaultOpen />
          </div>
        );

      case 'editar':
        return (
          <div className="flex flex-col gap-4">
            <div className="mc-field">
              <label className="mc-field-label" htmlFor="edit-titulo">
                Título
              </label>
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
              <label className="mc-field-label" htmlFor="edit-prioridad">
                Prioridad
              </label>
              <select
                id="edit-prioridad"
                className="mc-input"
                value={editarForm.prioridad}
                onChange={(e) =>
                  setEditarForm((p) => ({
                    ...p,
                    prioridad: e.target.value as Tarea['prioridad'],
                  }))
                }
              >
                <option value="baja">Baja</option>
                <option value="media">Media</option>
                <option value="alta">Alta</option>
              </select>
            </div>
            <div className="mc-field">
              <label className="mc-field-label" htmlFor="edit-desc">
                Descripción
              </label>
              <textarea
                id="edit-desc"
                className="mc-input"
                style={{ minHeight: 90, resize: 'vertical' }}
                value={editarForm.descripcion}
                onChange={(e) => setEditarForm((p) => ({ ...p, descripcion: e.target.value }))}
              />
            </div>
            <div className="mc-field">
              <label className="mc-field-label" htmlFor="edit-objetivo">
                Objetivo
              </label>
              <select
                id="edit-objetivo"
                className="mc-input"
                value={editarForm.objetivoId}
                onChange={(e) => setEditarForm((p) => ({ ...p, objetivoId: e.target.value }))}
              >
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
                <label className="mc-field-label" htmlFor="edit-resp">
                  Responsable
                </label>
                <select
                  id="edit-resp"
                  className="mc-input"
                  value={editarForm.asignadoId}
                  onChange={(e) => setEditarForm((p) => ({ ...p, asignadoId: e.target.value }))}
                >
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
              Esta acción no se puede deshacer. Indica el motivo (mínimo{' '}
              {MIN_JUSTIFICACION_CHARS} caracteres).
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

  return (
    <Modal
      open={open && tarea !== null}
      onClose={handleModalClose}
      title={MODAL_TITULO[vista]}
      analyticsId="modal-detalle-tarea"
      size="lg"
      bodyClassName="mc-tarea-detalle-modal-body"
      footerClassName="mc-tarea-detalle-modal-footer"
      hasUnsavedChanges={vista === 'editar' && editarHasChanges}
      {...(vista === 'eliminar' ? { descriptionElementId: ELIM_HINT_ID } : {})}
      footer={renderFooter()}
    >
      {renderCuerpo()}
    </Modal>
  );
}
