/**
 * components/ot/OTFormModal.tsx
 * Formulario crear/editar OT — se usa en OrdenesTrabajo.tsx
 */

import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import type { CrearOTInput, OrdenTrabajo, TipoTrabajoOT } from '@/api/ordenTrabajo';

type Props = {
    open: boolean;
    editando: OrdenTrabajo | null;
    form: Omit<CrearOTInput, 'enviar'>;
    setForm: (f: Omit<CrearOTInput, 'enviar'>) => void;
    tiposTrabajo: TipoTrabajoOT[];
    onClose: () => void;
    onGuardar: (enviar: boolean) => void;
    busy: boolean;
    hasUnsavedChanges?: boolean;
};

export function OTFormModal({ open, editando, form, setForm, tiposTrabajo, onClose, onGuardar, busy, hasUnsavedChanges = false }: Props) {
    const canSave = form.descripcion.trim().length > 0 && form.area_destino.trim().length > 0 && form.fecha_estimada.length > 0;
    const titulo = editando ? `Editar ${editando.numero}` : 'Nueva orden de trabajo';

    function upd<K extends keyof typeof form>(key: K, val: typeof form[K]) {
        setForm({ ...form, [key]: val });
    }

    return (
        <Modal
            open={open}
            onClose={onClose}
            title={titulo}
            size="lg"
            hasUnsavedChanges={hasUnsavedChanges}
            footer={
                <div style={{ display: 'flex', gap: 8 }}>
                    <Button variant="ghost" onClick={onClose} disabled={busy}>Cancelar</Button>
                    <Button variant="secondary" disabled={!canSave || busy} onClick={() => onGuardar(false)}>
                        {busy ? 'Guardando…' : 'Guardar borrador'}
                    </Button>
                    <Button disabled={!canSave || busy} onClick={() => onGuardar(true)}>
                        {busy ? 'Enviando…' : 'Enviar al jefe'}
                    </Button>
                </div>
            }
        >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

                {/* Tipo de trabajo */}
                <label className="mc-field">
                    <span className="mc-field-label">Tipo de trabajo</span>
                    <select className="mc-input" value={form.tipo_trabajo_id ?? ''} onChange={(e) => upd('tipo_trabajo_id', e.target.value || null)}>
                        <option value="">Selecciona…</option>
                        {tiposTrabajo.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                    </select>
                </label>

                {/* Descripción */}
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

                {/* Área + Ubicación */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <label className="mc-field">
                        <span className="mc-field-label">Área / Oficina destino *</span>
                        <input className="mc-input" value={form.area_destino} onChange={(e) => upd('area_destino', e.target.value)} placeholder="Ej: Recursos Humanos" required />
                    </label>
                    <label className="mc-field">
                        <span className="mc-field-label">Ubicación (piso, edificio)</span>
                        <input className="mc-input" value={form.ubicacion ?? ''} onChange={(e) => upd('ubicacion', e.target.value)} placeholder="Ej: Piso 3, Edificio A" />
                    </label>
                </div>

                {/* Modalidad + Fecha */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
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
                        <input type="date" className="mc-input" value={form.fecha_estimada} onChange={(e) => upd('fecha_estimada', e.target.value)} required />
                    </label>
                    <label className="mc-field">
                        <span className="mc-field-label">Hora de inicio</span>
                        <input type="time" className="mc-input" value={form.hora_inicio_est ?? ''} onChange={(e) => upd('hora_inicio_est', e.target.value || null)} />
                    </label>
                </div>

                {/* Duración */}
                <label className="mc-field" style={{ maxWidth: 200 }}>
                    <span className="mc-field-label">Duración estimada (minutos)</span>
                    <input
                        type="number" min={0} className="mc-input"
                        value={form.duracion_est_min ?? ''}
                        onChange={(e) => upd('duracion_est_min', e.target.value ? Number(e.target.value) : null)}
                        placeholder="60"
                    />
                </label>

                {/* Equipos/materiales */}
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

                {/* Observaciones */}
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
        </Modal>
    );
}