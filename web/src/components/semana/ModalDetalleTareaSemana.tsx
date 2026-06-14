/**
 * Modal de detalle / edición / eliminación de tarea en Mi Semana.
 * Las vistas de contenido viven en sub-componentes coubicados:
 *   TareaDetalleVista, TareaEditarVista, TareaJustificacionVista
 */

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { MoreHorizontal } from 'lucide-react';

import { TareaDetalleVista } from '@/components/semana/TareaDetalleVista';
import { TareaEditarVista, EDITAR_IDLE, type EditarTareaDraft } from '@/components/semana/TareaEditarVista';
import { TareaJustificacionVista } from '@/components/semana/TareaJustificacionVista';
import type { Area } from '@/api/areas';
import type { Cliente } from '@/api/clientes';
import type { Proyecto } from '@/api/proyectos';
import type { OrdenTrabajo } from '@/api/ordenTrabajo';
import { markModalCompleted, Modal } from '@/components/ui/Modal';
import { Button, CancelButton } from '@/components/ui/Button';
import { useDraftForm } from '@/hooks/useDraftForm';
import { MIN_JUSTIFICACION_CHARS } from '@/lib/constants';
import { fechaLocalYmd } from '@/lib/fecha';
import { claveVisualTarea } from '@/lib/tableroEstado';
import type { Objetivo, Tarea, Usuario } from '@/types';

export type DetalleTareaVistaInicial = 'detalle' | 'editar' | 'eliminar' | 'cancelar';
type Vista = DetalleTareaVistaInicial;

const MODAL_TITULO: Record<Vista, string> = {
  detalle: 'Detalle de tarea',
  editar:  'Editar tarea',
  eliminar: 'Eliminar tarea',
  cancelar: 'Cancelar tarea',
};

const ELIM_HINT_ID   = 'modal-detalle-eliminar-hint';
const CANCEL_HINT_ID = 'modal-detalle-cancelar-hint';

export type Props = {
  open: boolean;
  tarea: Tarea | null;
  objetivos: Pick<Objetivo, 'id' | 'titulo'>[];
  usuariosAsignables?: Pick<Usuario, 'id' | 'nombre'>[];
  clientes?: Pick<Cliente, 'id' | 'nombre'>[];
  proyectos?: Pick<Proyecto, 'id' | 'nombre' | 'cliente_id'>[];
  areas?: Pick<Area, 'id' | 'nombre'>[];
  moduloClientes?: boolean;
  moduloProyectos?: boolean;
  moduloAreas?: boolean;
  readOnly?: boolean;
  onClose: () => void;
  onGuardar: (input: {
    tareaId: string;
    titulo: string;
    prioridad: Tarea['prioridad'];
    descripcion: string;
    objetivo_id?: string | null;
    asignado_a?: string | null;
    cliente_id?: string | null;
    proyecto_id?: string | null;
    area_id?: string | null;
  }) => Promise<void>;
  onEliminar: (input: { tareaId: string; motivo: string }) => Promise<void>;
  onCancelar?: (input: { tareaId: string; motivo: string }) => Promise<void>;
  onIniciar?: (t: Tarea) => Promise<void>;
  onCompletar?: (t: Tarea) => void;
  onReprogramar?: (t: Tarea) => void;
  ot?: OrdenTrabajo | null;
  onGenerarOt?: (t: Tarea) => void;
  onOtClick?: (ot: OrdenTrabajo) => void;
  vistaInicial?: Vista;
};

export function ModalDetalleTareaSemana({
  open, tarea,
  objetivos,
  usuariosAsignables = [], clientes = [], proyectos = [], areas = [],
  moduloClientes = false, moduloProyectos = false, moduloAreas = false,
  readOnly = false,
  onClose, onGuardar, onEliminar, onCancelar,
  onIniciar, onCompletar, onReprogramar,
  ot, onGenerarOt, onOtClick,
  vistaInicial,
}: Props) {
  const [vista,          setVista]          = useState<Vista>('detalle');
  const [motivoEliminar, setMotivoEliminar] = useState('');
  const [motivoCancelar, setMotivoCancelar] = useState('');
  const [busy,           setBusy]           = useState(false);
  const [menuOpen,       setMenuOpen]       = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const hoyYmd = useMemo(() => fechaLocalYmd(new Date()), []);

  const initialEditar = useMemo<EditarTareaDraft>(() => {
    if (!tarea) return EDITAR_IDLE;
    return {
      titulo:      tarea.titulo,
      prioridad:   tarea.prioridad,
      descripcion: tarea.descripcion ?? '',
      objetivoId:  tarea.objetivo_id ?? '',
      asignadoId:  tarea.asignado_a ?? '',
      clienteId:   tarea.cliente_id ?? '',
      proyectoId:  tarea.proyecto_id ?? '',
      areaId:      tarea.area_id ?? '',
    };
  }, [tarea]);

  const draftKey = tarea ? `tarea-detalle-editar-${tarea.id}` : '__tarea-detalle-idle__';
  const { form: editarForm, setForm: setEditarForm, hasChanges: editarHasChanges, clearDraft: clearEditarDraft } =
    useDraftForm(draftKey, initialEditar, { enabled: Boolean(open && tarea && vista === 'editar') });

  useEffect(() => {
    if (!tarea?.id) return;
    queueMicrotask(() => {
      setVista(vistaInicial ?? 'detalle');
      setMotivoEliminar('');
      setMotivoCancelar('');
      setMenuOpen(false);
    });
  }, [tarea?.id, vistaInicial]);

  const motivoEliminarOk = motivoEliminar.trim().length >= MIN_JUSTIFICACION_CHARS;
  const motivoCancelarOk = motivoCancelar.trim().length >= MIN_JUSTIFICACION_CHARS;

  function handleModalClose() {
    clearEditarDraft();
    setVista('detalle');
    onClose();
  }

  async function guardar() {
    if (readOnly || !tarea || !editarForm.titulo.trim()) return;
    setBusy(true);
    try {
      await onGuardar({
        tareaId:     tarea.id,
        titulo:      editarForm.titulo.trim(),
        prioridad:   editarForm.prioridad,
        descripcion: editarForm.descripcion.trim(),
        objetivo_id: editarForm.objetivoId || null,
        asignado_a:  editarForm.asignadoId || null,
        cliente_id:  editarForm.clienteId  || null,
        proyecto_id: editarForm.proyectoId || null,
        area_id:     editarForm.areaId     || null,
      });
      clearEditarDraft();
      setVista('detalle');
    } finally {
      setBusy(false);
    }
  }

  async function eliminar() {
    if (readOnly || !tarea || !motivoEliminarOk) return;
    setBusy(true);
    try {
      await onEliminar({ tareaId: tarea.id, motivo: motivoEliminar.trim() });
      markModalCompleted('modal-detalle-tarea');
      handleModalClose();
    } finally {
      setBusy(false);
    }
  }

  async function cancelar() {
    if (readOnly || !tarea || !motivoCancelarOk || !onCancelar) return;
    setBusy(true);
    try {
      await onCancelar({ tareaId: tarea.id, motivo: motivoCancelar.trim() });
      markModalCompleted('modal-detalle-tarea');
      handleModalClose();
    } finally {
      setBusy(false);
    }
  }

  // ── Footer ────────────────────────────────────────────────────────────────
  function renderFooter(): ReactNode {
    if (vista === 'editar') {
      return (
        <div className="mc-tarea-detalle-footer mc-tarea-detalle-footer--stack">
          <Button variant="primary" size="lg" fullWidth loading={busy} disabled={!editarForm.titulo.trim()} onClick={() => void guardar()}>
            Guardar cambios
          </Button>
          <CancelButton onClick={() => { clearEditarDraft(); setVista('detalle'); }} disabled={busy} />
        </div>
      );
    }

    if (vista === 'eliminar') {
      return (
        <div className="mc-tarea-detalle-footer">
          <Button variant="ghost" onClick={() => setVista('detalle')} disabled={busy}>Volver</Button>
          <Button variant="danger" loading={busy} disabled={!motivoEliminarOk} onClick={() => void eliminar()}>
            Confirmar eliminación
          </Button>
        </div>
      );
    }

    if (vista === 'cancelar') {
      return (
        <div className="mc-tarea-detalle-footer">
          <Button variant="ghost" onClick={() => setVista('detalle')} disabled={busy}>Volver</Button>
          <Button variant="danger" loading={busy} disabled={!motivoCancelarOk} onClick={() => void cancelar()}>
            Confirmar cancelación
          </Button>
        </div>
      );
    }

    if (readOnly || !tarea) return null;

    const puedeIniciar    = tarea.estado === 'pendiente';
    const puedeCompletar  = tarea.estado === 'en_progreso';
    const puedeDestruir   = !['completada', 'cancelada'].includes(tarea.estado);
    const puedeReprogramar =
      Boolean(onReprogramar) &&
      ['pendiente', 'atrasada', 'reprogramada', 'en_progreso'].includes(claveVisualTarea(tarea, hoyYmd));
    const puedeGenerarOt =
      Boolean(onGenerarOt) && !tarea.es_imprevisto &&
      !['completada', 'cancelada'].includes(tarea.estado) && !ot;

    return (
      <div className="mc-tarea-detalle-footer mc-tarea-detalle-footer--actions-end">
        {puedeReprogramar && onReprogramar && (
          <Button variant="ghost" onClick={() => onReprogramar(tarea)}>Reprogramar</Button>
        )}
        {puedeGenerarOt && onGenerarOt && (
          <Button variant="ghost" onClick={() => onGenerarOt(tarea)}>Generar OT</Button>
        )}

        {puedeDestruir && (
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
                onBlur={(e) => { if (!menuRef.current?.contains(e.relatedTarget as Node)) setMenuOpen(false); }}
              >
                <button type="button" role="menuitem" className="mc-dropdown-item"
                  onClick={() => { setMenuOpen(false); setVista('editar'); }}>
                  Editar
                </button>
                {onCancelar && ['pendiente', 'en_progreso'].includes(tarea.estado) && (
                  <button type="button" role="menuitem" className="mc-dropdown-item mc-dropdown-item--danger"
                    onClick={() => { setMenuOpen(false); setVista('cancelar'); }}>
                    Cancelar tarea
                  </button>
                )}
                <button type="button" role="menuitem" className="mc-dropdown-item mc-dropdown-item--danger"
                  onClick={() => { setMenuOpen(false); setVista('eliminar'); }}>
                  Eliminar tarea
                </button>
              </div>
            )}
          </div>
        )}

        {puedeIniciar   && onIniciar   && <Button variant="primary" onClick={() => void onIniciar(tarea)}>Iniciar ejecución</Button>}
        {puedeCompletar && onCompletar && <Button variant="primary" onClick={() => onCompletar(tarea)}>Completar</Button>}
      </div>
    );
  }

  // ── Cuerpo ────────────────────────────────────────────────────────────────
  function renderCuerpo(): ReactNode {
    if (!tarea) return null;
    let content: ReactNode;
    switch (vista) {
      case 'detalle':
        content = (
          <TareaDetalleVista
            tarea={tarea} hoyYmd={hoyYmd}
            objetivos={objetivos} usuariosAsignables={usuariosAsignables}
            ot={ot} onOtClick={onOtClick}
          />
        );
        break;
      case 'editar':
        content = (
          <TareaEditarVista
            form={editarForm}
            onChange={(patch) => setEditarForm((p) => ({ ...p, ...patch }))}
            objetivos={objetivos} usuariosAsignables={usuariosAsignables}
            clientes={clientes} proyectos={proyectos} areas={areas}
            moduloClientes={moduloClientes} moduloProyectos={moduloProyectos} moduloAreas={moduloAreas}
          />
        );
        break;
      case 'eliminar':
        content = (
          <TareaJustificacionVista
            hintId={ELIM_HINT_ID}
            descripcion="Esta acción no se puede deshacer."
            label="Motivo de eliminación"
            placeholder="Indica el motivo de la eliminación…"
            value={motivoEliminar}
            onChange={setMotivoEliminar}
            disabled={busy}
          />
        );
        break;
      case 'cancelar':
        content = (
          <TareaJustificacionVista
            hintId={CANCEL_HINT_ID}
            descripcion="La tarea quedará como cancelada y el jefe podrá revisar tu justificación."
            label="Motivo de cancelación"
            placeholder="Indica por qué cancelas la tarea…"
            value={motivoCancelar}
            onChange={setMotivoCancelar}
            disabled={busy}
          />
        );
        break;
      default:
        return null;
    }
    return <div key={vista} className="mc-modal-vista-content">{content}</div>;
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
      {...(vista === 'eliminar'
        ? { descriptionElementId: ELIM_HINT_ID }
        : vista === 'cancelar'
          ? { descriptionElementId: CANCEL_HINT_ID }
          : {})}
      footer={renderFooter()}
    >
      {renderCuerpo()}
    </Modal>
  );
}
