import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PlanificacionActividadReciente } from '@/components/planificacion/PlanificacionActividadReciente';
import { PlanificacionAnalisisGrid } from '@/components/planificacion/PlanificacionAnalisisGrid';
import { PlanificacionToolbar } from '@/components/planificacion/PlanificacionToolbar';
import { PlanificacionCeldaMobile } from '@/components/planificacion/PlanificacionCeldaMobile';
import { PlanificacionCeldaSidebar } from '@/components/planificacion/PlanificacionCeldaSidebar';
import { PlanificacionHeader } from '@/components/planificacion/PlanificacionHeader';
import { PlanificacionHistorialCompleto } from '@/components/planificacion/PlanificacionHistorialCompleto';
import { PlanificacionIncidenciasLista } from '@/components/planificacion/PlanificacionIncidenciasLista';
import { PlanificacionJustificaciones } from '@/components/planificacion/PlanificacionJustificaciones';
import { usePlanificacionPage } from '@/hooks/usePlanificacionPage';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useResumenSlaJefe } from '@/hooks/useResumenSlaJefe';
import { APP_PAGE_CLASS } from '@/lib/appLayout';
import { fechaLocalYmd } from '@/lib/fecha';
import { PLANIFICACION_SLA_VISTA } from '@/lib/slaNavigation';
import { agregarDias, inicioSemanaIso } from '@/lib/semanas';

function defaultPeriodoDesde() {
  const d = new Date();
  d.setDate(d.getDate() - 28);
  return fechaLocalYmd(d);
}

export function Planificacion() {
  const isDesktop = useMediaQuery('(min-width: 768px)');
  const [historialAbierto, setHistorialAbierto] = useState(false);
  const [mobileMiembroId, setMobileMiembroId] = useState<string | null>(null);
  const [periodoDesde, setPeriodoDesde] = useState(defaultPeriodoDesde);
  const [periodoHasta, setPeriodoHasta] = useState(() => fechaLocalYmd(new Date()));

  const {
    usuario,
    lunes,
    setLunes,
    sabado,
    diasLab,
    miembros,
    detalle,
    loadDetalleCelda,
    loadInc,
    logsPend,
    loadLogs,
    errLogs,
    incidencias,
    actividad,
    loadActividad,
    resumenAlertas,
    mostrarHistorial,
    setMostrarHistorial,
    histLogs,
    histTotal,
    histTotalPaginas,
    loadHist,
    histPagina,
    setHistPagina,
    histUsuarioId,
    setHistUsuarioId,
    histTipoAccion,
    setHistTipoAccion,
    todosUsuarios,
    resetHistFiltros,
    modal,
    setModal,
    cuenta,
    totalDiaEquipo,
    conteoEstadosDiaMiembro,
    mutAceptarJustificacion,
    mutDevolverJustificacion,
    hoyYmd,
    carga,
  } = usePlanificacionPage();

  const [searchParams] = useSearchParams();
  const vistaSla = searchParams.get('vista') === PLANIFICACION_SLA_VISTA;
  const { data: resumenSla } = useResumenSlaJefe();

  useEffect(() => {
    if (vistaSla) setHistorialAbierto(true);
  }, [vistaSla]);

  useEffect(() => {
    if (!modal) return;
    function onKey(ev: KeyboardEvent) {
      if (ev.key === 'Escape') setModal(null);
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [modal, setModal]);

  const nombreMiembro = useMemo(
    () => Object.fromEntries(miembros.map((m) => [m.id, m.nombre])),
    [miembros],
  );

  const titulosTarea = useMemo(() => {
    const m: Record<string, string> = {};
    for (const t of carga) m[t.id] = t.titulo;
    return m;
  }, [carga]);

  const mobileMiembro = useMemo(
    () => (mobileMiembroId ? miembros.find((m) => m.id === mobileMiembroId) ?? null : null),
    [mobileMiembroId, miembros],
  );

  const showCeldaSidebar = Boolean(modal) && isDesktop;
  const loadDetalle = modal !== null && detalle.length === 0;

  if (!usuario) return null;

  return (
    <div className={`${APP_PAGE_CLASS} mc-plan-page`}>
      <PlanificacionHeader
        lunes={lunes}
        sabado={sabado}
        onSemanaAnterior={() => setLunes((d) => agregarDias(d, -7))}
        onSemanaSiguiente={() => setLunes((d) => agregarDias(d, 7))}
        onIrHoy={() => setLunes(inicioSemanaIso(new Date()))}
      />

      <PlanificacionToolbar
        resumen={resumenAlertas}
        periodoDesde={periodoDesde}
        periodoHasta={periodoHasta}
        onPeriodoDesde={setPeriodoDesde}
        onPeriodoHasta={setPeriodoHasta}
      />

      {vistaSla && (resumenSla?.atrasadas_nuevas_24h ?? 0) > 0 && (
        <p className="mc-plan-sla-hint m-0" role="status">
          Alertas SLA: {resumenSla!.atrasadas_nuevas_24h} atrasada(s) nuevas en 24 h
        </p>
      )}

      <div className={['mc-plan-layout', showCeldaSidebar ? 'mc-plan-layout--split' : ''].filter(Boolean).join(' ')}>
        <div className="mc-plan-layout__main">
          <PlanificacionAnalisisGrid
            isDesktop={isDesktop}
            periodoDesde={periodoDesde}
            periodoHasta={periodoHasta}
            miembros={miembros}
            diasLab={diasLab}
            cuenta={cuenta}
            totalDiaEquipo={totalDiaEquipo}
            conteoEstadosDiaMiembro={conteoEstadosDiaMiembro}
            mobileMiembro={mobileMiembro}
            onSelectMiembro={(m) => setMobileMiembroId(m?.id ?? null)}
            onCeldaClick={(usuarioId, fecha, nombre) => setModal({ usuarioId, fecha, nombre })}
          />

          <div className="mc-plan-grid-operativa">
            <PlanificacionJustificaciones
              logs={logsPend}
              loading={loadLogs}
              error={errLogs}
              busyAceptar={mutAceptarJustificacion.isPending}
              busyDevolver={mutDevolverJustificacion.isPending}
              nombreMiembro={nombreMiembro}
              titulosTarea={titulosTarea}
              onAceptar={(id) => mutAceptarJustificacion.mutate(id)}
              onDevolver={(id, nota) => mutDevolverJustificacion.mutate({ logId: id, nota })}
            />

            {!historialAbierto ? (
              <PlanificacionActividadReciente
                actividad={actividad}
                loading={loadActividad}
                onVerToda={() => {
                  setHistorialAbierto(true);
                  setMostrarHistorial(false);
                  resetHistFiltros();
                }}
              />
            ) : (
              <PlanificacionHistorialCompleto
                open={historialAbierto}
                onClose={() => setHistorialAbierto(false)}
                actividad={actividad}
                loadActividad={loadActividad}
                mostrarHistorial={mostrarHistorial}
                setMostrarHistorial={setMostrarHistorial}
                histLogs={histLogs}
                histTotal={histTotal}
                histTotalPaginas={histTotalPaginas}
                loadHist={loadHist}
                histPagina={histPagina}
                setHistPagina={setHistPagina}
                histUsuarioId={histUsuarioId}
                setHistUsuarioId={setHistUsuarioId}
                histTipoAccion={histTipoAccion}
                setHistTipoAccion={setHistTipoAccion}
                todosUsuarios={todosUsuarios}
                resetHistFiltros={resetHistFiltros}
              />
            )}

            <PlanificacionIncidenciasLista
              incidencias={incidencias}
              loading={loadInc}
              hoyYmd={hoyYmd}
              nombreMiembro={nombreMiembro}
            />
          </div>
        </div>

        {showCeldaSidebar && modal && (
          <PlanificacionCeldaSidebar
            nombre={modal.nombre}
            fecha={modal.fecha}
            tareas={detalle}
            loading={loadDetalleCelda}
            hoyYmd={hoyYmd}
            onClose={() => setModal(null)}
          />
        )}
      </div>

      {!isDesktop && modal && (
        <PlanificacionCeldaMobile
          nombre={modal.nombre}
          fecha={modal.fecha}
          tareas={detalle}
          loading={loadDetalle}
          hoyYmd={hoyYmd}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
