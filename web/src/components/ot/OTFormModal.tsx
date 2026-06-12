/**
 * components/ot/OTFormModal.tsx
 * Formulario crear/editar OT — se usa en OrdenesTrabajo.tsx
 */

import { AlertCircle, Check, Loader2 } from 'lucide-react';

import { Modal } from '@/components/ui/Modal';
import { CancelButton } from '@/components/ui/Button';
import type { CrearOTInput, OrdenTrabajo, TipoTrabajoOT } from '@/api/ordenTrabajo';
import { labelNumeroOT } from '@/lib/otNumero';
import type { DraftSaveStatus } from '@/hooks/useOrdenesTrabajoPage';
import type { Tarea } from '@/types';

type Props = {
    open: boolean;
    editando: OrdenTrabajo | null;
    form: CrearOTInput;
    setForm: (f: CrearOTInput) => void;
    tiposTrabajo: TipoTrabajoOT[];
    tareasVinculables: Pick<Tarea, 'id' | 'titulo' | 'estado'>[];
    onClose: () => void;
    onGuardar: () => void;
    busy: boolean;
    hasUnsavedChanges?: boolean;
    borradorCargando?: boolean;
    draftSaveStatus?: DraftSaveStatus;
    draftSavedLabel?: string | null;
};

function DraftStatusLine({
    cargando,
    status,
    label,
}: {
    cargando?: boolean;
    status: DraftSaveStatus;
    label: string | null;
}) {
    if (cargando) {
        return (
            <p className="mc-draft-status" role="status" aria-live="polite">
                <Loader2 size={14} className="mc-draft-status__icon mc-btn-spinner" aria-hidden />
                Recuperando borrador…
            </p>
        );
    }
    if (status === 'saving') {
        return (
            <p className="mc-draft-status" role="status" aria-live="polite">
                <Loader2 size={14} className="mc-draft-status__icon mc-btn-spinner" aria-hidden />
                Guardando borrador…
            </p>
        );
    }
    if (status === 'error') {
        return (
            <p className="mc-draft-status mc-draft-status--error" role="alert">
                <AlertCircle size={14} className="mc-draft-status__icon" aria-hidden />
                No se pudo guardar el borrador. Revisa tu conexión.
            </p>
        );
    }
    if (label) {
        return (
            <p className="mc-draft-status" role="status">
                <Check size={14} className="mc-draft-status__icon" aria-hidden />
                Borrador guardado {label}
            </p>
        );
    }
    return null;
}

export function OTFormModal({
    open,
    editando,
    form,
    setForm,
    tiposTrabajo,
    tareasVinculables,
    onClose,
    onGuardar,
    busy,
    hasUnsavedChanges = false,
    borradorCargando = false,
    draftSaveStatus = 'idle',
    draftSavedLabel = null,
}: Props) {
    const fechaEsValida = form.fecha_estimada.length > 0 && form.fecha_estimada >= new Date().toISOString().slice(0, 10);
    const canSave = form.descripcion.trim().length > 0 && form.area_destino.trim().length > 0 && fechaEsValida;
    const titulo = editando
        ? `Editar ${labelNumeroOT(editando.numero)}`
        : 'Nueva orden de trabajo';

    function upd<K extends keyof typeof form>(key: K, val: typeof form[K]) {
        setForm({ ...form, [key]: val });
    }

    return (
        <Modal
            open={open}
            onClose={onClose}
            title={titulo}
            size="lg"
            analyticsId="modal-ot-form"
            hasUnsavedChanges={hasUnsavedChanges}
            bodyClassName="mc-modal-form"
            footerClassName="mc-modal-footer--stack"
            footer={(
                <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <DraftStatusLine
                        cargando={borradorCargando && !editando}
                        status={draftSaveStatus}
                        label={draftSavedLabel}
                    />
                    <button
                        type="button"
                        className="mc-btn-modal-primary"
                        disabled={!canSave || busy}
                        onClick={() => onGuardar()}
                    >
                        {busy ? 'Enviando…' : (editando ? 'Guardar y enviar' : 'Enviar al jefe')}
                    </button>
                    <CancelButton onClick={onClose} disabled={busy} />
                </div>
            )}
        >
            <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-3">
                    <p className="m-0 text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--mc-color-text-secondary)]">
                        Información básica
                    </p>
                    <label className="mc-field">
                        <span className="mc-field-label">Tipo de trabajo</span>
                        <select className="mc-input" value={form.tipo_trabajo_id ?? ''} onChange={(e) => upd('tipo_trabajo_id', e.target.value || null)}>
                            <option value="">Selecciona…</option>
                            {tiposTrabajo.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                        </select>
                    </label>
                    <label className="mc-field">
                        <span className="mc-field-label">
                            Tarea vinculada
                            <span className="ml-1 font-normal text-[var(--mc-color-text-secondary)]">(opcional)</span>
                        </span>
                        <select
                            className="mc-input"
                            value={form.tarea_id ?? ''}
                            onChange={(e) => upd('tarea_id', e.target.value || null)}
                        >
                            <option value="">Sin tarea vinculada</option>
                            {tareasVinculables.map((t) => (
                                <option key={t.id} value={t.id}>{t.titulo}</option>
                            ))}
                        </select>
                        {form.tarea_id && (
                            <p className="m-0 mt-1 text-[11px] text-[var(--mc-color-text-secondary)]">
                                Al completar la OT, esta tarea se completará automáticamente.
                            </p>
                        )}
                    </label>
                    <label className="mc-field">
                        <span className="mc-field-label">Descripción del trabajo *</span>
                        <textarea
                            className="mc-input"
                            style={{ minHeight: 80 }}
                            value={form.descripcion}
                            onChange={(e) => upd('descripcion', e.target.value)}
                            placeholder="Describe detalladamente el trabajo a realizar…"
                            required
                            autoFocus
                        />
                    </label>
                </div>

                <div className="mc-divider" />

                <div className="flex flex-col gap-3">
                    <p className="m-0 text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--mc-color-text-secondary)]">
                        Ubicación y tiempo
                    </p>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        <label className="mc-field">
                            <span className="mc-field-label">Área / Oficina destino *</span>
                            <input className="mc-input" value={form.area_destino} onChange={(e) => upd('area_destino', e.target.value)} placeholder="Ej: Recursos Humanos" required />
                        </label>
                        <label className="mc-field">
                            <span className="mc-field-label">Ubicación (piso, edificio)</span>
                            <input className="mc-input" value={form.ubicacion ?? ''} onChange={(e) => upd('ubicacion', e.target.value)} placeholder="Ej: Piso 3, Edificio A" />
                        </label>
                    </div>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                        <label className="mc-field">
                            <span className="mc-field-label">Modalidad *</span>
                            <select className="mc-input" value={form.modalidad} onChange={(e) => upd('modalidad', e.target.value as typeof form.modalidad)}>
                                <option value="presencial">Presencial</option>
                                <option value="remoto">Remoto</option>
                                <option value="viaje">Viaje</option>
                            </select>
                        </label>
                        <label className="mc-field">
                            <span className="mc-field-label">Fecha estimada *</span>
                            <input
                                type="date"
                                className="mc-input"
                                value={form.fecha_estimada}
                                min={new Date().toISOString().slice(0, 10)}
                                onChange={(e) => upd('fecha_estimada', e.target.value)}
                                required
                            />
                            {form.fecha_estimada.length > 0 && !fechaEsValida && (
                                <p className="mt-1 text-xs text-[var(--mc-color-danger)]">
                                    La fecha no puede ser anterior a hoy.
                                </p>
                            )}
                        </label>
                        <label className="mc-field">
                            <span className="mc-field-label">Hora de inicio</span>
                            <input type="time" className="mc-input" value={form.hora_inicio_est ?? ''} onChange={(e) => upd('hora_inicio_est', e.target.value || null)} />
                        </label>
                    </div>
                    <label className="mc-field max-w-full md:max-w-[200px]">
                        <span className="mc-field-label">Duración estimada (minutos)</span>
                        <input
                            type="number" min={0} className="mc-input"
                            value={form.duracion_est_min ?? ''}
                            onChange={(e) => upd('duracion_est_min', e.target.value ? Number(e.target.value) : null)}
                            placeholder="60"
                        />
                    </label>
                </div>

                <div className="mc-divider" />

                <div className="flex flex-col gap-3">
                    <p className="m-0 text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--mc-color-text-secondary)]">
                        Detalle y observaciones
                    </p>
                    <label className="mc-field">
                        <span className="mc-field-label">Equipos / materiales requeridos</span>
                        <textarea
                            className="mc-input"
                            style={{ minHeight: 64 }}
                            value={form.equipos_materiales ?? ''}
                            onChange={(e) => upd('equipos_materiales', e.target.value)}
                            placeholder="Ej: Laptop, cable UTP cat6, switch 8 puertos…"
                        />
                    </label>
                    <label className="mc-field">
                        <span className="mc-field-label">Observaciones adicionales</span>
                        <textarea
                            className="mc-input"
                            style={{ minHeight: 64 }}
                            value={form.observaciones ?? ''}
                            onChange={(e) => upd('observaciones', e.target.value)}
                            placeholder="Información adicional relevante…"
                        />
                    </label>
                </div>
            </div>
        </Modal>
    );
}