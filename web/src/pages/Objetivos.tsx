import { useEffect, useMemo, useState } from 'react';
import { ObjetivoDetallePanel } from '@/components/objetivos/ObjetivoDetallePanel';
import { ObjetivoDetalleSidebar } from '@/components/objetivos/ObjetivoDetalleSidebar';
import { ObjetivosHeader } from '@/components/objetivos/ObjetivosHeader';
import { ObjetivosToolbar } from '@/components/objetivos/ObjetivosToolbar';
import { ObjetivoTablaFila } from '@/components/objetivos/ObjetivoTablaFila';
import { ObjetivosLeyendaRiesgos } from '@/components/objetivos/ObjetivosLeyendaRiesgos';
import { ObjetivosProgresoInfo } from '@/components/objetivos/ObjetivosProgresoInfo';
import { Modal } from '@/components/ui/Modal';
import { Button, CancelButton } from '@/components/ui/Button';
import { JustificacionField } from '@/components/ui/JustificacionField';
import { ModalNuevaTarea } from '@/components/tareas/ModalNuevaTarea';
import { ModalDetalleTareaSemana } from '@/components/semana/ModalDetalleTareaSemana';
import { useIsMobile } from '@/hooks/useIsMobile';
import { useObjetivosPage } from '@/hooks/useObjetivosPage';
import { APP_PAGE_CLASS } from '@/lib/appLayout';
import { nivelRiesgoObjetivo } from '@/lib/tareaUrgencia';
import type { Tarea, Usuario } from '@/types';
import { EmptyState } from '@/components/ui/EmptyState';

const PAGE_SIZE = 15;

type FiltroObjetivo = 'todos' | 'activo' | 'critico' | 'completado';

const FILTRO_LABELS: Record<FiltroObjetivo, string> = {
  todos: 'todos',
  activo: 'activos',
  critico: 'críticos',
  completado: 'completados',
};

export function Objetivos() {
  const {
    usuario,
    esJefe,
    objetivos,
    loadO,
    isError,
    tareasVinc,
    loadTareas,
    otsVinc,
    loadOTs,
    usuariosActivos,
    objetivoSel,
    objetivoEliminar,
    seleccionId,
    setSeleccionId,
    tareaDetalle,
    setTareaDetalle,
    modalNuevo,
    nuevoObjetivoForm,
    setNuevoObjetivoForm,
    nuevoObjetivoHasChanges,
    cerrarModalNuevoObjetivo,
    creandoObj,
    modalTarea,
    tareaObjetivoForm,
    cerrarModalTareaObjetivo,
    eliminarObjId,
    motivoEliminar,
    setMotivoEliminar,
    motivoOk,
    eliminandoObj,
    modalCompletar,
    completandoObj,
    puedeEliminar,
    puedeCompletar,
    submitNuevoObjetivo,
    addTareaVinculada,
    confirmarEliminar,
    confirmarCompletar,
    cerrarCompletar,
    abrirCompletar,
    abrirModalNuevo,
    cerrarEliminar,
    setEliminarObjId,
    setModalTarea,
  } = useObjetivosPage();

  const [pagina, setPagina] = useState(0);
  const isMobile = useIsMobile();
  const [filtro, setFiltro] = useState<FiltroObjetivo | null>(null);

  const nombreResponsablePorId = useMemo(() => {
    const m = new Map<string, string>();
    for (const u of usuariosActivos) m.set(u.id, u.nombre);
    if (usuario) m.set(usuario.id, usuario.nombre);
    return m;
  }, [usuariosActivos, usuario]);

  useEffect(() => {
    if (!seleccionId) return;
    function onKey(ev: KeyboardEvent) {
      if (ev.key === 'Escape') setSeleccionId(null);
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [seleccionId, setSeleccionId]);

  const resumen = useMemo(() => {
    let activos = 0;
    let criticos = 0;
    let completados = 0;
    for (const o of objetivos) {
      if (o.estado === 'activo') activos++;
      if (o.estado === 'completado') completados++;
      if (o.estado === 'activo' && nivelRiesgoObjetivo(o.pct, o.fecha_limite, o.total_tareas) === 'critico') {
        criticos++;
      }
    }
    return { activos, criticos, completados, total: objetivos.length };
  }, [objetivos]);

  const objetivosFiltrados = useMemo(() => {
    if (!filtro || filtro === 'todos') return objetivos;
    return objetivos.filter((o) => {
      if (filtro === 'activo') return o.estado === 'activo';
      if (filtro === 'completado') return o.estado === 'completado';
      if (filtro === 'critico') {
        return o.estado === 'activo' && nivelRiesgoObjetivo(o.pct, o.fecha_limite, o.total_tareas) === 'critico';
      }
      return true;
    });
  }, [objetivos, filtro]);

  useEffect(() => {
    const maxPag = Math.max(0, Math.ceil(objetivosFiltrados.length / PAGE_SIZE) - 1);
    if (pagina > maxPag) setPagina(maxPag);
  }, [objetivosFiltrados.length, pagina]);

  const objetivosPagina = useMemo(() => {
    const start = pagina * PAGE_SIZE;
    return objetivosFiltrados.slice(start, start + PAGE_SIZE);
  }, [objetivosFiltrados, pagina]);

  function toggleFiltro(key: FiltroObjetivo) {
    setFiltro((prev) => (prev === key ? null : key));
    setPagina(0);
  }

  const statsItems = useMemo(() => {
    const defs: { key: FiltroObjetivo; label: string; value: number }[] = [
      { key: 'todos', label: 'Total', value: resumen.total },
      { key: 'activo', label: 'Activos', value: resumen.activos },
      { key: 'critico', label: 'Críticos', value: resumen.criticos },
      { key: 'completado', label: 'Completados', value: resumen.completados },
    ];
    return defs.map(({ key, label, value }) => {
      const disabled = value === 0 && filtro !== key;
      const active = filtro === key;
      return {
        key,
        label,
        value,
        active,
        disabled,
        onClick: disabled ? undefined : () => toggleFiltro(key),
      };
    });
  }, [resumen, filtro]);

  const filtroActivoLabel = filtro ? FILTRO_LABELS[filtro] : null;

  if (!usuario) return null;

  const canSubmitNuevo =
    !creandoObj && nuevoObjetivoForm.titulo.trim().length > 0 && nuevoObjetivoForm.responsableId.trim().length > 0;

  const totalPaginas = Math.max(1, Math.ceil(objetivosFiltrados.length / PAGE_SIZE));
  const showSidebar = Boolean(objetivoSel) && !isMobile;

  const detalleProps = objetivoSel
    ? {
        objetivo: objetivoSel,
        tareasVinc,
        loadTareas,
        otsVinc,
        loadOTs,
        esJefe,
        puedeCompletar: puedeCompletar(objetivoSel.id),
        puedeEliminar: puedeEliminar(objetivoSel.id),
        onClose: () => setSeleccionId(null),
        onCompletar: () => abrirCompletar(objetivoSel.id),
        onEliminar: () => setEliminarObjId(objetivoSel.id),
        onAnadirTarea: () => setModalTarea(true),
        onTareaClick: setTareaDetalle,
      }
    : null;

  return (
    <div className={`${APP_PAGE_CLASS} mc-objetivos-page`}>
      <ObjetivosHeader esJefe={esJefe} onNuevoObjetivo={abrirModalNuevo} />

      <ObjetivosToolbar
        statsItems={statsItems}
        filtroActivoLabel={filtroActivoLabel}
        onLimpiarFiltro={() => {
          setFiltro(null);
          setPagina(0);
        }}
      />

      {isError && (
        <p className="m-0 text-[13px] text-[var(--mc-color-danger)]">No se pudieron cargar los objetivos.</p>
      )}

      <div className={['mc-ot-layout', showSidebar ? 'mc-ot-layout--split' : ''].filter(Boolean).join(' ')}>
        <div className="mc-ot-layout__main">
          <div className="mc-card !p-0 overflow-hidden">
            {!isMobile && (
              <div className="mc-objetivos-table-head mc-objetivos-table-grid">
                <span className="mc-objetivos-table-head__cell">Objetivo</span>
                <span className="mc-objetivos-table-head__cell">Responsable</span>
                <span className="mc-objetivos-table-head__cell">Estado</span>
                <span className="mc-objetivos-table-head__cell">
                  <ObjetivosProgresoInfo />
                </span>
                <span className="mc-objetivos-table-head__cell">Límite</span>
              </div>
            )}

            {loadO ? (
              <p className="p-4 text-[13px] text-[var(--mc-color-text-secondary)]">Cargando…</p>
            ) : objetivosFiltrados.length === 0 ? (
              <EmptyState
                title={filtro ? 'Sin resultados' : 'Sin objetivos'}
                desc={
                  filtro
                    ? 'Prueba otro filtro o limpia la selección.'
                    : esJefe
                      ? 'Crea el primer objetivo estratégico del equipo.'
                      : 'Tu jefe aún no ha creado objetivos para el equipo.'
                }
                cta={
                  !filtro && esJefe ? (
                    <Button variant="primary" size="sm" onClick={abrirModalNuevo}>
                      Crear objetivo
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              <>
                {objetivosPagina.map((o) => (
                  <ObjetivoTablaFila
                    key={o.id}
                    objetivo={o}
                    responsableNombre={o.responsable_id ? (nombreResponsablePorId.get(o.responsable_id) ?? null) : null}
                    selected={seleccionId === o.id}
                    onSelect={() => setSeleccionId(seleccionId === o.id ? null : o.id)}
                  />
                ))}
                {objetivosFiltrados.length > PAGE_SIZE && (
                  <div className="mc-objetivos-paginacion">
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={pagina === 0}
                      onClick={() => setPagina((p) => p - 1)}
                      aria-label="Página anterior"
                    >
                      Anterior
                    </Button>
                    <span className="mc-objetivos-paginacion__info" role="status">
                      Página {pagina + 1} de {totalPaginas}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={pagina >= totalPaginas - 1}
                      onClick={() => setPagina((p) => p + 1)}
                      aria-label="Página siguiente"
                    >
                      Siguiente
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {showSidebar && detalleProps && <ObjetivoDetalleSidebar {...detalleProps} />}
      </div>

      <ObjetivosLeyendaRiesgos />

      {isMobile && detalleProps && <ObjetivoDetallePanel open={Boolean(objetivoSel)} {...detalleProps} />}

      <Modal
        open={modalNuevo}
        onClose={cerrarModalNuevoObjetivo}
        title="Nuevo objetivo"
        analyticsId="modal-nuevo-objetivo"
        size="sm"
        hasUnsavedChanges={nuevoObjetivoHasChanges}
        bodyClassName="mc-modal-form"
        footerClassName="mc-modal-footer--stack"
        footer={
          <>
            <Button
              variant="primary"
              size="lg"
              fullWidth
              loading={creandoObj}
              disabled={!canSubmitNuevo}
              onClick={() => void submitNuevoObjetivo()}
            >
              Crear objetivo
            </Button>
            <CancelButton onClick={cerrarModalNuevoObjetivo} disabled={creandoObj} />
          </>
        }
      >
        <div className="flex flex-col gap-[14px]">
          <div className="mc-field">
            <label className="mc-field-label" htmlFor="obj-titulo">
              Título
            </label>
            <input
              id="obj-titulo"
              className="mc-input"
              value={nuevoObjetivoForm.titulo}
              onChange={(e) => setNuevoObjetivoForm((p) => ({ ...p, titulo: e.target.value }))}
              autoFocus
              required
            />
          </div>
          <div className="mc-field">
            <label className="mc-field-label" htmlFor="obj-desc">
              Descripción (opcional)
            </label>
            <textarea
              id="obj-desc"
              className="mc-input"
              style={{ minHeight: 72 }}
              value={nuevoObjetivoForm.descripcion}
              onChange={(e) => setNuevoObjetivoForm((p) => ({ ...p, descripcion: e.target.value }))}
            />
          </div>
          <div className="mc-field">
            <label className="mc-field-label" htmlFor="obj-limite">
              Fecha límite (opcional)
            </label>
            <input
              id="obj-limite"
              type="date"
              className="mc-input"
              value={nuevoObjetivoForm.limite}
              onChange={(e) => setNuevoObjetivoForm((p) => ({ ...p, limite: e.target.value }))}
            />
          </div>
          <div className="mc-field">
            <label className="mc-field-label" htmlFor="obj-resp">
              Responsable
            </label>
            <select
              id="obj-resp"
              className="mc-input"
              value={nuevoObjetivoForm.responsableId}
              onChange={(e) => setNuevoObjetivoForm((p) => ({ ...p, responsableId: e.target.value }))}
            >
              <option value="">Selecciona…</option>
              {usuariosActivos.map((u: Pick<Usuario, 'id' | 'nombre' | 'email'>) => (
                <option key={u.id} value={u.id}>
                  {u.nombre}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Modal>

      <Modal
        open={modalCompletar}
        onClose={cerrarCompletar}
        title={esJefe ? 'Cerrar objetivo' : 'Marcar como completado'}
        analyticsId="modal-completar-objetivo"
        descriptionElementId="modal-completar-objetivo-desc"
        size="sm"
        footer={
          <>
            <Button variant="primary" size="lg" fullWidth loading={completandoObj} onClick={() => void confirmarCompletar()}>
              {esJefe ? 'Cerrar objetivo' : 'Completar objetivo'}
            </Button>
            <CancelButton onClick={cerrarCompletar} disabled={completandoObj} />
          </>
        }
      >
        <p id="modal-completar-objetivo-desc" className="m-0 text-[13px] text-[var(--mc-color-text-secondary)]">
          {esJefe
            ? 'El objetivo se marcará como completado independientemente del progreso actual.'
            : 'Todas las tareas están completadas. ¿Confirmas que el objetivo ha sido cumplido?'}
        </p>
      </Modal>

      <ModalNuevaTarea
        modo="dia"
        fechaDia={tareaObjetivoForm.fecha}
        fechaReferencia={tareaObjetivoForm.fecha}
        open={modalTarea && Boolean(seleccionId)}
        objetivos={[]}
        usuarioActualId={usuario.id}
        usuariosAsignables={usuariosActivos}
        onClose={cerrarModalTareaObjetivo}
        onSubmit={async (input) => {
          addTareaVinculada(input);
        }}
      />

      <Modal
        open={Boolean(eliminarObjId)}
        onClose={cerrarEliminar}
        title="Eliminar objetivo"
        analyticsId="modal-eliminar-objetivo"
        descriptionElementId="modal-eliminar-objetivo-desc"
        size="sm"
        footer={
          <>
            <Button
              variant="danger"
              size="lg"
              fullWidth
              onClick={() => void confirmarEliminar()}
              disabled={eliminandoObj || !motivoOk}
            >
              {eliminandoObj ? 'Eliminando…' : 'Eliminar objetivo'}
            </Button>
            <CancelButton onClick={cerrarEliminar} disabled={eliminandoObj} />
          </>
        }
      >
        <div className="flex flex-col gap-[14px]">
          {objetivoEliminar && (
            <p id="modal-eliminar-objetivo-desc" className="m-0 text-[13px] text-[var(--mc-color-text-secondary)]">
              <strong>{objetivoEliminar.titulo}</strong> · Esta acción no se puede deshacer.
            </p>
          )}
          <JustificacionField
            label="Motivo de eliminación"
            value={motivoEliminar}
            onChange={setMotivoEliminar}
            placeholder="Indica el motivo de la eliminación…"
            disabled={eliminandoObj}
            autoFocus
          />
        </div>
      </Modal>

      <ModalDetalleTareaSemana
        open={tareaDetalle !== null}
        tarea={tareaDetalle}
        objetivos={[]}
        usuariosAsignables={usuariosActivos}
        readOnly={!esJefe && tareaDetalle?.asignado_a !== usuario.id}
        onClose={() => setTareaDetalle(null)}
        onGuardar={async () => {
          setTareaDetalle(null);
        }}
        onIniciar={async (t: Tarea) => {
          void t;
          setTareaDetalle(null);
        }}
        onCompletar={(t: Tarea) => {
          void t;
          setTareaDetalle(null);
        }}
        onReprogramar={(t: Tarea) => {
          void t;
          setTareaDetalle(null);
        }}
        onEliminar={async () => {
          setTareaDetalle(null);
        }}
      />
    </div>
  );
}
