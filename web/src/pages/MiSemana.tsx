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
import { useIsMobile } from '@/hooks/useIsMobile';
import { useSwipeDiaSemana } from '@/hooks/useSwipeDiaSemana';
import {
  ModalDetalleTareaSemana,
  type DetalleTareaVistaInicial,
} from '@/components/semana/ModalDetalleTareaSemana';
import { ModalMiSemana } from '@/components/semana/ModalMiSemana';
import { ModalConvertirNota } from '@/components/semana/ModalConvertirNota';
import { NotasDrawer } from '@/components/semana/NotasDrawer';
import { Modal } from '@/components/ui/Modal';
import { SkeletonSemanaGrilla } from '@/components/ui/Skeletons';
import { ESTADO_OT_LABEL } from '@/lib/otConfig';
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

const MiSemanaGrilla = lazy(() =>
  import('@/components/semana/MiSemanaGrilla').then((m) => ({ default: m.MiSemanaGrilla })),
);

const DIAS_CORTO = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

const CONTEO_CONFIG = [
  { key: 'pendiente', label: 'pendientes' },
  { key: 'en_progreso', label: 'en progreso' },
  { key: 'atrasada', label: 'atrasadas' },
  { key: 'reprogramada', label: 'reprogramadas' },
  { key: 'completada', label: 'completadas' },
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
    nombresPorId,
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
    clientesCatalogo,
    proyectosActivos,
    areasCatalogo,
    areasPorId,
    moduloClientes,
    moduloProyectos,
    moduloAreas,
    tareaDetalle,
    tareaCompletar,
    modal,
    setModal,
    detalleTareaId,
    setDetalleTareaId,
    completarTareaId,
    setCompletarTareaId,
    reprDetalleTarea,
    setReprDetalleTarea,
    puedeGestionar,
    confirmarReprDetalle,
    confirmarCompletar,
    crearTareaDesdeModal,
    crearEventoDesdeModal,
    guardarDetalle,
    eliminarDesdeDetalle,
    cancelarDesdeDetalle,
    iniciarDesdeDetalle,
    generarOtDesdeTarea,
    incidenciasSemana,
    completarPendingId,
    iniciarPendingId,
  } = useMiSemanaPage();

  const [filtroEstado, setFiltroEstado] = useState<FiltroEstado | null>(null);
  const [notasDrawerOpen, setNotasDrawerOpen] = useState(false);
  const [otViendo, setOtViendo] = useState<OrdenTrabajo | null>(null);
  const [diaMobileYmd, setDiaMobileYmd] = useState(hoyYmd);
  const [incidenciaFecha, setIncidenciaFecha] = useState<string | null>(null);
  const [detalleVistaInicial, setDetalleVistaInicial] = useState<DetalleTareaVistaInicial | null>(
    null,
  );

  useEffect(() => {
    const ids = diasSemana.map((d) => fechaLocalYmd(d));
    if (ids.includes(hoyYmd)) setDiaMobileYmd(hoyYmd);
    else setDiaMobileYmd(ids[0] ?? hoyYmd);
  }, [lunes, hoyYmd, diasSemana]);

  const diasYmd = useMemo(() => diasSemana.map((d) => fechaLocalYmd(d)), [diasSemana]);

  useSwipeDiaSemana(diasYmd, diaMobileYmd, setDiaMobileYmd);
  const isMobile = useIsMobile();

  function toggleFiltro(key: FiltroEstado) {
    setFiltroEstado((prev) => (prev === key ? null : key));
  }

  const statsItems = useMemo(
    () =>
      CONTEO_CONFIG.map(({ key, label }) => {
        const n = conteos[key] ?? 0;
        const active = filtroEstado === key;
        const visible = n > 0 || active;
        if (!visible) return null;
        return {
          key,
          label,
          value: n,
          active,
          disabled: false,
          onClick: () => toggleFiltro(key),
        };
      }).filter((item): item is NonNullable<typeof item> => item !== null),
    [conteos, filtroEstado],
  );

  const filtroActivoLabel = filtroEstado
    ? (CONTEO_CONFIG.find((c) => c.key === filtroEstado)?.label.toLowerCase() ?? null)
    : null;

  if (!usuario) return null;
  if (!uid) return <p className="text-sm text-[var(--mc-color-text-secondary)]">Preparando vista…</p>;

  return (
    <div className={`${APP_PAGE_CLASS} mc-misemana-page`}>
      <div className="flex flex-col gap-3">
        <MiSemanaHeader
          lunes={lunes}
          sabado={sabado}
          onSemanaAnterior={() => setLunes((d) => navegarSemanaAnterior(d))}
          onSemanaSiguiente={() => setLunes((d) => navegarSemanaSiguiente(d))}
          onIrHoy={() => setLunes(lunesSemanaActual())}
          onNuevaTarea={() => setModal({ fecha: isMobile ? diaMobileYmd : hoyYmd })}
          nuevaTareaLabel={isMobile ? '+ Tarea' : '+ Nueva tarea'}
          onNotas={() => setNotasDrawerOpen(true)}
          notasOpen={notasDrawerOpen}
          esJefe={esJefe}
          uid={uid}
          usuariosJefe={usuariosJefe ?? []}
          onSeleccionarUsuario={setSeleccionId}
        />
        {isMobile && (
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
        )}
      </div>

      <MiSemanaToolbar
        statsItems={statsItems}
        filtroActivoLabel={filtroActivoLabel}
        onLimpiarFiltro={() => setFiltroEstado(null)}
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
        fallback={<SkeletonSemanaGrilla />}
      >
        <MiSemanaGrilla
          diasSemana={diasSemana}
          hoyYmd={hoyYmd}
          diaMobileYmd={diaMobileYmd}
          tareasPlan={tareasPlan}
          eventos={eventos}
          filtroEstado={filtroEstado}
          incidenciasSemana={incidenciasSemana}
          ordenesPorTarea={ordenesPorTarea}
          nombresPorId={nombresPorId}
          areasPorId={areasPorId}
          puedeGestionar={puedeGestionar}
          onAbrirModalDia={(fecha) => setModal({ fecha })}
          onAbrirDetalle={setDetalleTareaId}
          onRegistrarIncidencia={(fecha) => {
            setIncidenciaFecha(fecha);
            setModalInc(true);
          }}
          onOtClick={setOtViendo}
          completarPendingId={completarPendingId}
          iniciarPendingId={iniciarPendingId}
          onIniciarTarea={(t) => void iniciarDesdeDetalle(t)}
          onCompletarTarea={(t) => setCompletarTareaId(t.id)}
          onReprogramarTarea={(t) => setReprDetalleTarea(t)}
          onCancelarTarea={(t) => {
            setDetalleVistaInicial('cancelar');
            setDetalleTareaId(t.id);
          }}
          onEliminarTarea={(t) => {
            setDetalleVistaInicial('eliminar');
            setDetalleTareaId(t.id);
          }}
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
        clientes={clientesCatalogo}
        proyectos={proyectosActivos}
        areas={areasCatalogo}
        moduloClientes={moduloClientes}
        moduloProyectos={moduloProyectos}
        moduloAreas={moduloAreas}
        onClose={() => setModal(null)}
        onCrearTarea={crearTareaDesdeModal}
        onCrearEvento={crearEventoDesdeModal}
      />
      <ModalNuevaTarea
        open={modalInc}
        modo="incidencia"
        fechaReferencia={incidenciaFecha ?? hoyYmd}
        usuarioActualId={uid ?? ''}
        usuariosAsignables={usuariosAsignables}
        objetivos={objetivosActivos}
        onClose={() => {
          setModalInc(false);
          setIncidenciaFecha(null);
        }}
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
        clientes={clientesCatalogo}
        proyectos={proyectosActivos}
        areas={areasCatalogo}
        moduloClientes={moduloClientes}
        moduloProyectos={moduloProyectos}
        moduloAreas={moduloAreas}
        ot={tareaDetalle ? ordenesPorTarea.get(tareaDetalle.id) ?? null : null}
        readOnly={Boolean(tareaDetalle && !esJefe && tareaDetalle.asignado_a !== usuario.id)}
        {...(detalleVistaInicial ? { vistaInicial: detalleVistaInicial } : {})}
        onClose={() => {
          setDetalleTareaId(null);
          setDetalleVistaInicial(null);
        }}
        onGuardar={guardarDetalle}
        onEliminar={eliminarDesdeDetalle}
        onCancelar={cancelarDesdeDetalle}
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
      />
    </div>
  );
}
