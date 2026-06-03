import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import type { OrdenTrabajo } from '@/api/ordenTrabajo';
import {
  lunesSemanaActual,
  MiSemanaHeader,
  navegarSemanaAnterior,
  navegarSemanaSiguiente,
} from '@/components/semana/MiSemanaHeader';
import { MiSemanaToolbar } from '@/components/semana/MiSemanaToolbar';
import { useSwipeDiaSemana } from '@/hooks/useSwipeDiaSemana';
import { ModalDetalleTareaSemana } from '@/components/semana/ModalDetalleTareaSemana';
import { ModalMiSemana } from '@/components/semana/ModalMiSemana';
import { ModalConvertirNota } from '@/components/semana/ModalConvertirNota';
import { NotasDrawer } from '@/components/semana/NotasDrawer';
import { Modal } from '@/components/ui/Modal';
import { ESTADO_OT_LABEL } from '@/lib/otConfig';
import { ModalBloquear } from '@/components/tareas/ModalBloquear';
import { ModalCompletarTarea } from '@/components/tareas/ModalCompletarTarea';
import { ModalReprogramar } from '@/components/tareas/ModalReprogramar';
import { Button } from '@/components/ui/Button';
import { ModalNuevaTarea } from '@/components/tareas/ModalNuevaTarea';
import { useMiSemanaPage } from '@/hooks/useMiSemanaPage';
import { fechaLocalYmd } from '@/lib/fecha';
import { APP_PAGE_CLASS } from '@/lib/appLayout';
import { Calendar } from 'lucide-react';
import { agregarDias } from '@/lib/semanas';
import type { Tarea } from '@/types';

const MiSemanaGrillaDnD = lazy(() =>
  import('@/components/semana/MiSemanaGrillaDnD').then((m) => ({ default: m.MiSemanaGrillaDnD })),
);

const DIAS_CORTO = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

const CONTEO_CONFIG = [
  { key: 'pendiente', label: 'Pendientes' },
  { key: 'en_progreso', label: 'En progreso' },
  { key: 'atrasada', label: 'Atrasadas' },
  { key: 'reprogramada', label: 'Reprogramadas' },
  { key: 'completada', label: 'Completadas' },
] as const;

type FiltroEstado = (typeof CONTEO_CONFIG)[number]['key'];

export function MiSemana() {
  const navigate = useNavigate();
  const {
    usuario,
    esJefe,
    lunes,
    setLunes,
    sabado,
    diasSemana,
    uid,
    setSeleccionId,
    usuariosJefe,
    tareasPlan,
    eventos,
    isError,
    hoyYmd,
    conteos,
    esBannerViernes,
    notasHoy,
    ordenesPorTarea,
    ocultarCompletadas,
    toggleOcultarCompletadas,
    modalInc,
    setModalInc,
    notaRapida,
    setNotaRapida,
    notaConvertir,
    setNotaConvertir,
    crearIncidenciaHoy,
    guardarNotaRapida,
    confirmarConvertirNotaTarea,
    confirmarConvertirNotaEvento,
    objetivosActivos,
    usuariosAsignables,
    tareaDetalle,
    tareaCompletar,
    activeTareaDrag,
    activeDragId,
    setActiveDragId,
    overId,
    onDragOver,
    onDragEnd,
    modal,
    setModal,
    detalleTareaId,
    setDetalleTareaId,
    completarTareaId,
    setCompletarTareaId,
    bloquearTareaState,
    setBloquearTareaState,
    reprDetalleTarea,
    setReprDetalleTarea,
    reprDragTarea,
    setReprDragTarea,
    puedeGestionar,
    confirmarReprDrag,
    confirmarReprDetalle,
    confirmarBloqueo,
    confirmarCompletar,
    crearTareaDesdeModal,
    crearEventoDesdeModal,
    guardarDetalle,
    eliminarDesdeDetalle,
    iniciarDesdeDetalle,
    generarOtDesdeTarea,
    incidenciasSemana,
  } = useMiSemanaPage();

  const [filtroEstado, setFiltroEstado] = useState<FiltroEstado | null>(null);
  const [notasDrawerOpen, setNotasDrawerOpen] = useState(false);
  const [otViendo, setOtViendo] = useState<OrdenTrabajo | null>(null);
  const [diaMobileYmd, setDiaMobileYmd] = useState(hoyYmd);

  useEffect(() => {
    const ids = diasSemana.map((d) => fechaLocalYmd(d));
    if (ids.includes(hoyYmd)) setDiaMobileYmd(hoyYmd);
    else setDiaMobileYmd(ids[0] ?? hoyYmd);
  }, [lunes, hoyYmd, diasSemana]);

  const diasYmd = useMemo(() => diasSemana.map((d) => fechaLocalYmd(d)), [diasSemana]);

  useSwipeDiaSemana(diasYmd, diaMobileYmd, setDiaMobileYmd);

  function toggleFiltro(key: FiltroEstado) {
    setFiltroEstado((prev) => (prev === key ? null : key));
  }

  const statsItems = useMemo(
    () =>
      CONTEO_CONFIG.map(({ key, label }) => {
        const n = conteos[key] ?? 0;
        const disabled = n === 0 && filtroEstado !== key;
        const active = filtroEstado === key;
        return {
          key,
          label,
          value: n,
          active,
          disabled,
          onClick: disabled ? undefined : () => toggleFiltro(key),
        };
      }),
    [conteos, filtroEstado],
  );

  const filtroActivoLabel = filtroEstado
    ? (CONTEO_CONFIG.find((c) => c.key === filtroEstado)?.label.toLowerCase() ?? null)
    : null;

  if (!usuario) return null;
  if (!uid) return <p className="text-sm text-[var(--mc-color-text-secondary)]">Preparando vista…</p>;

  return (
    <div className={`${APP_PAGE_CLASS} mc-misemana-page`}>
      {/* Móvil: cabecera compacta + pills de día */}
      <div className="flex flex-col gap-3 md:hidden">
        <MiSemanaHeader
          lunes={lunes}
          sabado={sabado}
          onSemanaAnterior={() => setLunes((d) => navegarSemanaAnterior(d))}
          onSemanaSiguiente={() => setLunes((d) => navegarSemanaSiguiente(d))}
          onIrHoy={() => setLunes(lunesSemanaActual())}
          onNuevaTarea={() => setModal({ fecha: hoyYmd })}
          onNotas={() => setNotasDrawerOpen(true)}
          notasOpen={notasDrawerOpen}
        />
        <div
          className="flex touch-pan-x gap-1 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          role="group"
          aria-label="Elegir día de la semana"
        >
          {diasSemana.map((d, i) => {
            const ymd = fechaLocalYmd(d);
            const esHoy = ymd === hoyYmd;
            const esActivo = ymd === diaMobileYmd;
            return (
              <button
                key={ymd}
                type="button"
                aria-pressed={esActivo}
                onClick={() => setDiaMobileYmd(ymd)}
                className={[
                  'shrink-0 rounded-[var(--mc-radius-md)] px-3 py-1.5 text-xs font-medium transition-colors',
                  esActivo
                    ? 'bg-[var(--mc-color-accent)] text-white'
                    : 'bg-[var(--mc-color-bg-secondary)] text-[var(--mc-color-text-secondary)]',
                  esHoy && !esActivo
                    ? 'ring-1 ring-[var(--mc-color-accent)] ring-offset-1 ring-offset-[var(--mc-color-bg)]'
                    : '',
                ].join(' ')}
              >
                {DIAS_CORTO[i]}
                {esHoy ? <span className="ml-1 text-[9px] opacity-80">· hoy</span> : null}
              </button>
            );
          })}
        </div>
      </div>

      {/* Desktop: cabecera en dos columnas */}
      <div className="hidden md:block">
        <MiSemanaHeader
          lunes={lunes}
          sabado={sabado}
          onSemanaAnterior={() => setLunes((d) => navegarSemanaAnterior(d))}
          onSemanaSiguiente={() => setLunes((d) => navegarSemanaSiguiente(d))}
          onIrHoy={() => setLunes(lunesSemanaActual())}
          onNuevaTarea={() => setModal({ fecha: hoyYmd })}
          onNotas={() => setNotasDrawerOpen(true)}
          notasOpen={notasDrawerOpen}
        />
      </div>

      <MiSemanaToolbar
        statsItems={statsItems}
        ocultarCompletadas={ocultarCompletadas}
        onToggleCompletadas={toggleOcultarCompletadas}
        filtroActivoLabel={filtroActivoLabel}
        onLimpiarFiltro={() => setFiltroEstado(null)}
        esJefe={esJefe}
        uid={uid}
        usuariosJefe={usuariosJefe ?? []}
        onSeleccionarUsuario={setSeleccionId}
      />

      {esBannerViernes && (
        <div className="flex shrink-0 items-center gap-3 rounded-lg border border-[var(--mc-color-accent)] bg-[color-mix(in_srgb,var(--mc-color-accent)_8%,transparent)] px-4 py-3">
          <Calendar size={18} aria-hidden className="flex-shrink-0 text-[var(--mc-color-accent)]" />
          <p className="text-sm font-medium text-[var(--mc-color-accent)]">
            ¡Es viernes! Buen momento para planificar la próxima semana.
          </p>
          <Button
            variant="secondary"
            size="sm"
            className="ml-auto"
            onClick={() => setLunes((d) => agregarDias(d, 7))}
          >
            Ver próxima semana
          </Button>
        </div>
      )}

      {isError && (
        <p className="shrink-0 text-sm text-[var(--mc-color-danger)]">Error al cargar datos.</p>
      )}

      <Suspense
        fallback={
          <div className="mc-page-loading min-h-[220px] flex-1" role="status">
            Cargando agenda…
          </div>
        }
      >
        <MiSemanaGrillaDnD
          diasSemana={diasSemana}
          hoyYmd={hoyYmd}
          diaMobileYmd={diaMobileYmd}
          tareasPlan={tareasPlan}
          eventos={eventos}
          filtroEstado={filtroEstado}
          incidenciasSemana={incidenciasSemana}
          ordenesPorTarea={ordenesPorTarea}
          ocultarCompletadas={ocultarCompletadas}
          activeDragId={activeDragId}
          setActiveDragId={setActiveDragId}
          overId={overId}
          onDragOver={onDragOver}
          onDragEnd={onDragEnd}
          activeTareaDrag={activeTareaDrag}
          puedeGestionar={puedeGestionar}
          onAbrirModalDia={(fecha) => setModal({ fecha })}
          onAbrirDetalle={setDetalleTareaId}
          onRegistrarIncidencia={() => setModalInc(true)}
          onOtClick={setOtViendo}
        />
      </Suspense>

      <NotasDrawer
        open={notasDrawerOpen}
        notas={notasHoy}
        notaRapida={notaRapida}
        usuarioId={uid}
        onClose={() => setNotasDrawerOpen(false)}
        onNotaRapidaChange={setNotaRapida}
        onGuardarNota={guardarNotaRapida}
        onConvertir={setNotaConvertir}
      />

      <ModalConvertirNota
        open={notaConvertir !== null}
        nota={notaConvertir}
        hoyYmd={hoyYmd}
        usuariosAsignables={usuariosAsignables}
        asignadoPorDefectoId={uid}
        onClose={() => setNotaConvertir(null)}
        onConvertirTarea={confirmarConvertirNotaTarea}
        onConvertirEvento={confirmarConvertirNotaEvento}
      />

      <ModalMiSemana
        open={modal !== null}
        modoOrigen="dia"
        {...(modal?.fecha ? { fechaDia: modal.fecha } : {})}
        objetivos={objetivosActivos}
        usuariosAsignables={usuariosAsignables}
        asignadoPorDefectoId={uid}
        onClose={() => setModal(null)}
        onCrearTarea={crearTareaDesdeModal}
        onCrearEvento={crearEventoDesdeModal}
      />
      <ModalNuevaTarea
        open={modalInc}
        modo="incidencia"
        fechaReferencia={hoyYmd}
        usuarioActualId={uid ?? ''}
        usuariosAsignables={usuariosAsignables}
        objetivos={objetivosActivos}
        onClose={() => setModalInc(false)}
        onSubmit={async (input) => {
          await crearIncidenciaHoy({
            titulo: input.titulo,
            prioridad: input.prioridad,
            descripcion: input.descripcion || null,
            asignado_a: input.asignado_a,
            fecha_planificada: input.fecha_planificada ?? hoyYmd,
            ya_resuelta: true,
          });
        }}
      />
      <ModalCompletarTarea
        open={completarTareaId !== null}
        tarea={tareaCompletar}
        onClose={() => setCompletarTareaId(null)}
        onConfirm={confirmarCompletar}
      />
      <ModalBloquear
        tarea={bloquearTareaState}
        onClose={() => setBloquearTareaState(null)}
        onConfirm={confirmarBloqueo}
      />
      <ModalReprogramar
        tarea={reprDragTarea?.tarea ?? null}
        {...(reprDragTarea?.fecha ? { fechaFija: reprDragTarea.fecha } : {})}
        onClose={() => setReprDragTarea(null)}
        onConfirm={confirmarReprDrag}
      />
      <ModalReprogramar
        tarea={reprDetalleTarea}
        onClose={() => setReprDetalleTarea(null)}
        onConfirm={confirmarReprDetalle}
      />
      <Modal
        open={otViendo !== null}
        onClose={() => setOtViendo(null)}
        title={otViendo ? `OT ${otViendo.numero}` : ''}
        analyticsId="modal-ot-resumen-semana"
        size="sm"
        footer={<Button variant="ghost" onClick={() => setOtViendo(null)}>Cerrar</Button>}
      >
        {otViendo && (
          <p className="text-sm text-[var(--mc-color-text)]">
            Estado: <strong>{ESTADO_OT_LABEL[otViendo.estado]}</strong>
          </p>
        )}
      </Modal>

      <ModalDetalleTareaSemana
        open={detalleTareaId !== null}
        tarea={tareaDetalle}
        objetivos={objetivosActivos}
        usuariosAsignables={usuariosAsignables}
        ot={tareaDetalle ? ordenesPorTarea.get(tareaDetalle.id) ?? null : null}
        readOnly={Boolean(tareaDetalle && !esJefe && tareaDetalle.asignado_a !== usuario.id)}
        onClose={() => setDetalleTareaId(null)}
        onGuardar={guardarDetalle}
        onEliminar={eliminarDesdeDetalle}
        onIniciar={iniciarDesdeDetalle}
        {...(tareaDetalle && puedeGestionar(tareaDetalle)
          ? { onGenerarOt: (t: Tarea) => { void generarOtDesdeTarea(t); } }
          : {})}
        onOtClick={(ot) => {
          setDetalleTareaId(null);
          navigate('/ordenes-trabajo', { state: { abrirOtId: ot.id } });
        }}
        onCompletar={(t) => {
          setCompletarTareaId(t.id);
          setDetalleTareaId(null);
        }}
        onReprogramar={(t) => {
          setReprDetalleTarea(t);
          setDetalleTareaId(null);
        }}
        onBloquear={(t) => {
          setBloquearTareaState(t);
          setDetalleTareaId(null);
        }}
      />
    </div>
  );
}
