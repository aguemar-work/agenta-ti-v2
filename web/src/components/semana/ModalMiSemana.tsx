import { useMemo, useState } from 'react';

import { markModalCompleted, Modal } from '@/components/ui/Modal';
import { RecurrenciaForm, type RecurrenciaConfig } from '@/components/semana/RecurrenciaForm';
import { TareaCatalogoSelects } from '@/components/semana/TareaCatalogoSelects';
import {
  crearRecurrenciaEvento,
  RecurrenciaValidationError,
} from '@/api/recurrencia';
import { toast } from 'sonner';
import { CancelButton } from '@/components/ui/Button';
import { useDraftForm } from '@/hooks/useDraftForm';
import { fechaLocalDdMmYyyy, parseYmdLocal } from '@/lib/fecha';
import type { Cliente } from '@/api/clientes';
import type { Proyecto } from '@/api/proyectos';
import type { Area } from '@/api/areas';
import type { Objetivo, Tarea, TipoEvento, Usuario } from '@/types';

type ModoOrigen = 'dia';

type MiSemanaDraft = {
  tab: 'tarea' | 'evento';
  titulo: string;
  prioridad: Tarea['prioridad'];
  descripcion: string;
  objetivoId: string;
  asignadoId: string;
  clienteId: string;
  proyectoId: string;
  areaId: string;
  tipoEv: TipoEvento;
  horaIni: string;
  horaFin: string;
  recurrente: boolean;
};

type Props = {
  open: boolean;
  modoOrigen: ModoOrigen;
  fechaDia?: string;
  objetivos: Pick<Objetivo, 'id' | 'titulo'>[];
  usuariosAsignables: Pick<Usuario, 'id' | 'nombre'>[];
  /** Responsable por defecto (p. ej. dueño de la semana vista). */
  asignadoPorDefectoId: string;
  clientes: Pick<Cliente, 'id' | 'nombre'>[];
  proyectos: Pick<Proyecto, 'id' | 'nombre' | 'cliente_id'>[];
  areas: Pick<Area, 'id' | 'nombre'>[];
  moduloClientes: boolean;
  moduloProyectos: boolean;
  moduloAreas: boolean;
  onClose: () => void;
  onCrearTarea: (input: {
    titulo: string;
    prioridad: Tarea['prioridad'];
    descripcion: string;
    objetivo_id?: string | null;
    asignado_a?: string | null;
    cliente_id?: string | null;
    proyecto_id?: string | null;
    area_id?: string | null;
  }) => Promise<void>;
  onCrearEvento: (input: {
    titulo: string;
    tipo: TipoEvento;
    hora_inicio: string;
    hora_fin: string;
    es_recurrente: boolean;
  }) => Promise<void>;
};

function draftInicial(asignadoPorDefectoId: string): MiSemanaDraft {
  return {
    tab: 'tarea',
    titulo: '',
    prioridad: 'media',
    descripcion: '',
    objetivoId: '',
    asignadoId: asignadoPorDefectoId,
    clienteId: '',
    proyectoId: '',
    areaId: '',
    tipoEv: 'reunion',
    horaIni: '09:00',
    horaFin: '10:00',
    recurrente: false,
  };
}

export function ModalMiSemana({
  open,
  modoOrigen,
  fechaDia,
  objetivos,
  usuariosAsignables,
  asignadoPorDefectoId,
  clientes,
  proyectos,
  areas,
  moduloClientes,
  moduloProyectos,
  moduloAreas,
  onClose,
  onCrearTarea,
  onCrearEvento,
}: Props) {
  const initial = useMemo(() => draftInicial(asignadoPorDefectoId), [asignadoPorDefectoId]);
  const { form, setForm, hasChanges, clearDraft } = useDraftForm('misemana-nueva-tarea', initial, { enabled: open });

  const [busy, setBusy] = useState(false);
  const [recConfig, setRecConfig] = useState<RecurrenciaConfig>({
    dias_semana: [],
    fecha_fin: '',
    meses: 3,
  });

  const fechaEvento = modoOrigen === 'dia' ? fechaDia : undefined;
  const fechaLegible =
    modoOrigen === 'dia' && fechaDia ? fechaLocalDdMmYyyy(parseYmdLocal(fechaDia)) : '';
  const tituloModal = form.tab === 'tarea' ? 'Nueva tarea' : 'Nuevo evento';

  function cerrar() {
    clearDraft();
    onClose();
  }

  async function submitTarea() {
    if (!form.titulo.trim()) return;
    setBusy(true);
    try {
      await onCrearTarea({
        titulo: form.titulo.trim(),
        prioridad: form.prioridad,
        descripcion: form.descripcion.trim(),
        objetivo_id: form.objetivoId || null,
        asignado_a: form.asignadoId.trim() || asignadoPorDefectoId,
        cliente_id:  form.clienteId || null,
        proyecto_id: form.proyectoId || null,
        area_id:     form.areaId || null,
      });
      markModalCompleted('modal-mi-semana-nuevo');
      clearDraft();
      onClose();
    } finally {
      setBusy(false);
    }
  }

  async function submitEvento() {
    if (!form.titulo.trim() || !fechaEvento) return;
    // Recurrente: usar RPC de recurrencia en lugar de crear evento único
    if (form.recurrente) {
      setBusy(true);
      try {
        await crearRecurrenciaEvento({
          titulo:       form.titulo.trim(),
          tipo:         form.tipoEv,
          hora_inicio:  form.horaIni,
          hora_fin:     form.horaFin,
          usuario_id:   asignadoPorDefectoId,
          dias_semana:  recConfig.dias_semana,
          fecha_inicio: fechaEvento,
          meses:        recConfig.meses,
          ...(recConfig.fecha_fin ? { fecha_fin: recConfig.fecha_fin } : {}),
        });
        markModalCompleted('modal-mi-semana-nuevo');
        clearDraft();
        onClose();
      } catch (err) {
        const msg = err instanceof RecurrenciaValidationError
          ? err.message
          : 'No se pudo crear la recurrencia.';
        toast.error(msg);
      } finally {
        setBusy(false);
      }
      return;
    }
    // Evento único
    setBusy(true);
    try {
      await onCrearEvento({
        titulo:       form.titulo.trim(),
        tipo:         form.tipoEv,
        hora_inicio:  form.horaIni,
        hora_fin:     form.horaFin,
        es_recurrente: false,
      });
      markModalCompleted('modal-mi-semana-nuevo');
      clearDraft();
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={cerrar}
      title={tituloModal}
      size="md"
      analyticsId="modal-mi-semana-nuevo"
      hasUnsavedChanges={hasChanges}
      bodyClassName="mc-modal-form"
      footerClassName="mc-modal-footer--stack"
      footer={(
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {form.tab === 'tarea' ? (
            <button
              type="button"
              className="mc-btn-modal-primary"
              disabled={busy || !form.titulo.trim()}
              onClick={() => void submitTarea()}
            >
              {busy ? 'Guardando…' : 'Crear tarea'}
            </button>
          ) : (
            <button
              type="button"
              className="mc-btn-modal-primary"
              disabled={
                busy
                || !form.titulo.trim()
                || !fechaEvento
                || (form.recurrente && recConfig.dias_semana.length === 0)
                || (form.recurrente && !!recConfig.fecha_fin && recConfig.fecha_fin < fechaEvento)
                || form.horaFin <= form.horaIni
              }
              onClick={() => void submitEvento()}
            >
              {busy ? 'Guardando…' : 'Crear evento'}
            </button>
          )}
          <CancelButton onClick={cerrar} disabled={busy} />
        </div>
      )}
    >
      <div className="flex flex-col gap-4">
        <div className="mc-modal-form-tabs mc-modal-form-tabs--pill">
          <button
            type="button"
            className={form.tab === 'tarea' ? 'mc-modal-form-tabs__active' : ''}
            onClick={() => setForm((p) => ({ ...p, tab: 'tarea' }))}
          >
            Tarea
          </button>
          <button
            type="button"
            className={form.tab === 'evento' ? 'mc-modal-form-tabs__active' : ''}
            onClick={() => setForm((p) => ({ ...p, tab: 'evento' }))}
            disabled={modoOrigen !== 'dia'}
            title={modoOrigen !== 'dia' ? 'Selecciona un día en la agenda para crear un evento' : undefined}
          >
            Evento
          </button>
        </div>

        {modoOrigen === 'dia' && fechaDia && (
          <div className="mc-field">
            <label className="mc-field-label" htmlFor="new-fecha">Fecha límite</label>
            <input
              id="new-fecha"
              type="text"
              className="mc-input"
              readOnly
              disabled
              value={fechaLegible}
              aria-readonly
              title="Fecha fijada al día seleccionado"
            />
          </div>
        )}

        {form.tab === 'tarea' ? (
          <div className="flex flex-col gap-4">
            <div className="mc-field">
              <label className="mc-field-label" htmlFor="task-title">Título</label>
              <input id="task-title" className="mc-input" value={form.titulo} onChange={(e) => setForm((p) => ({ ...p, titulo: e.target.value }))} autoFocus />
            </div>
            <div className="mc-field">
              <label className="mc-field-label" htmlFor="task-desc">Descripción</label>
              <textarea id="task-desc" className="mc-input" style={{ minHeight: 80, resize: 'vertical' }} value={form.descripcion} onChange={(e) => setForm((p) => ({ ...p, descripcion: e.target.value }))} />
            </div>
            {modoOrigen === 'dia' && (
              <>
                <div className="mc-field">
                  <label className="mc-field-label" htmlFor="task-prioridad">Prioridad</label>
                  <select
                    id="task-prioridad"
                    className="mc-input"
                    value={form.prioridad}
                    onChange={(e) => setForm((p) => ({ ...p, prioridad: e.target.value as Tarea['prioridad'] }))}
                  >
                    <option value="baja">Baja</option>
                    <option value="media">Media</option>
                    <option value="alta">Alta</option>
                    <option value="critica">Crítica</option>
                  </select>
                </div>
                <div className="mc-field">
                  <label className="mc-field-label" htmlFor="task-objetivo">Vincular a objetivo</label>
                  <select id="task-objetivo" className="mc-input" value={form.objetivoId} onChange={(e) => setForm((p) => ({ ...p, objetivoId: e.target.value }))}>
                    <option value="">Sin objetivo</option>
                    {objetivos.map((o) => (
                      <option key={o.id} value={o.id}>{o.titulo}</option>
                    ))}
                  </select>
                </div>
                {usuariosAsignables.length > 0 && (
                  <div className="mc-field">
                    <label className="mc-field-label" htmlFor="task-asignado">Responsable</label>
                    <select id="task-asignado" className="mc-input" value={form.asignadoId} onChange={(e) => setForm((p) => ({ ...p, asignadoId: e.target.value }))}>
                      {usuariosAsignables.map((u) => (
                        <option key={u.id} value={u.id}>{u.nombre}</option>
                      ))}
                    </select>
                  </div>
                )}
                {moduloClientes || moduloProyectos || moduloAreas ? (
                  <TareaCatalogoSelects
                    idPrefix="task"
                    values={{
                      clienteId:  form.clienteId,
                      proyectoId: form.proyectoId,
                      areaId:     form.areaId,
                    }}
                    onChange={(patch) => setForm((p) => ({ ...p, ...patch }))}
                    clientes={clientes}
                    proyectos={proyectos}
                    areas={areas}
                    moduloClientes={moduloClientes}
                    moduloProyectos={moduloProyectos}
                    moduloAreas={moduloAreas}
                  />
                ) : null}
              </>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="mc-field">
              <label className="mc-field-label" htmlFor="ev-title">Título</label>
              <input id="ev-title" className="mc-input" value={form.titulo} onChange={(e) => setForm((p) => ({ ...p, titulo: e.target.value }))} autoFocus />
            </div>
            <div className="mc-field">
              <label className="mc-field-label" htmlFor="ev-tipo">Tipo</label>
              <select id="ev-tipo" className="mc-input" value={form.tipoEv} onChange={(e) => setForm((p) => ({ ...p, tipoEv: e.target.value as TipoEvento }))}>
                <option value="reunion">Reunión</option>
                <option value="entrega">Entrega</option>
                <option value="personal">Personal</option>
                <option value="otro">Otro</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="mc-field">
                <label className="mc-field-label" htmlFor="ev-start">Hora inicio</label>
                <input id="ev-start" type="time" className="mc-input" value={form.horaIni} onChange={(e) => setForm((p) => ({ ...p, horaIni: e.target.value }))} />
              </div>
              <div className="mc-field">
                <label className="mc-field-label" htmlFor="ev-end">Hora fin</label>
                <input id="ev-end" type="time" className="mc-input" value={form.horaFin} onChange={(e) => setForm((p) => ({ ...p, horaFin: e.target.value }))} />
              </div>
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-[var(--mc-color-text-secondary)]">
              <input
                type="checkbox"
                className="mc-checkbox"
                checked={form.recurrente}
                onChange={(e) => {
                  setForm((p) => ({ ...p, recurrente: e.target.checked }));
                  if (!e.target.checked) setRecConfig({ dias_semana: [], fecha_fin: '', meses: 3 });
                }}
              />
              Recurrente (se repite cada semana)
            </label>
            {form.recurrente && (
              <RecurrenciaForm
                value={recConfig}
                onChange={setRecConfig}
                {...(fechaEvento ? { fechaInicio: fechaEvento } : {})}
              />
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}