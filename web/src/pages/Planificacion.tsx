import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PlanificacionActividadReciente } from '@/components/planificacion/PlanificacionActividadReciente';
import { PlanificacionAlertas } from '@/components/planificacion/PlanificacionAlertas';
import { PlanificacionCeldaMobile } from '@/components/planificacion/PlanificacionCeldaMobile';
import { PlanificacionCeldaSidebar } from '@/components/planificacion/PlanificacionCeldaSidebar';
import { PlanificacionHeader } from '@/components/planificacion/PlanificacionHeader';
import { PlanificacionHeatmap } from '@/components/planificacion/PlanificacionHeatmap';
import { PlanificacionHistorialCompleto } from '@/components/planificacion/PlanificacionHistorialCompleto';
import { PlanificacionIncidenciasLista } from '@/components/planificacion/PlanificacionIncidenciasLista';
import { PlanificacionJustificaciones } from '@/components/planificacion/PlanificacionJustificaciones';
import { PlanificacionMobile } from '@/components/planificacion/PlanificacionMobile';
import { PlanificacionRendimiento } from '@/components/planificacion/PlanificacionRendimiento';
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
    bloqueadasSemana,
    resumenAlertas,
    totalDiaEquipo,
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
    conteoEstadosDiaMiembro,
    mutLeerLog,
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
        periodoDesde={periodoDesde}
        periodoHasta={periodoHasta}
        onPeriodoDesde={setPeriodoDesde}
        onPeriodoHasta={setPeriodoHasta}
      />

      {vistaSla && ((resumenSla?.atrasadas_nuevas_24h ?? 0) + (resumenSla?.bloqueadas_criticas ?? 0) > 0) && (
        <p className="mc-plan-sla-hint m-0" role="status">
          Alertas SLA: {(resumenSla?.atrasadas_nuevas_24h ?? 0) > 0 && `${resumenSla!.atrasadas_nuevas_24h} atrasada(s) 24 h`}
          {(resumenSla?.atrasadas_nuevas_24h ?? 0) > 0 && (resumenSla?.bloqueadas_criticas ?? 0) > 0 ? ' · ' : ''}
          {(resumenSla?.bloqueadas_criticas ?? 0) > 0 && `${resumenSla!.bloqueadas_criticas} bloqueada(s) >48 h`}
        </p>
      )}

      <PlanificacionAlertas resumen={resumenAlertas} />

      <div className={['mc-ot-layout', showCeldaSidebar ? 'mc-ot-layout--split' : ''].filter(Boolean).join(' ')}>
        <div className="mc-ot-layout__main">
          {isDesktop ? (
            <PlanificacionHeatmap
              miembros={miembros}
              diasLab={diasLab}
              cuenta={cuenta}
              totalDiaEquipo={totalDiaEquipo}
              onCeldaClick={(usuarioId, fecha, nombre) => setModal({ usuarioId, fecha, nombre })}
            />
          ) : (
            <PlanificacionMobile
              miembros={miembros}
              diasLab={diasLab}
              cuenta={cuenta}
              conteoEstadosDiaMiembro={conteoEstadosDiaMiembro}
              miembroSel={mobileMiembro}
              onSelectMiembro={(m) => setMobileMiembroId(m?.id ?? null)}
              onCeldaClick={(usuarioId, fecha, nombre) => setModal({ usuarioId, fecha, nombre })}
            />
          )}
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

      <div className="mc-plan-dos-columnas">
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
          bloqueadas={bloqueadasSemana}
          loading={loadInc}
          hoyYmd={hoyYmd}
          nombreMiembro={nombreMiembro}
        />
      </div>

      <PlanificacionJustificaciones
        logs={logsPend}
        loading={loadLogs}
        error={errLogs}
        pending={mutLeerLog.isPending}
        nombreMiembro={nombreMiembro}
        titulosTarea={titulosTarea}
        onMarcarLeido={(id) => mutLeerLog.mutate(id)}
      />

      <PlanificacionRendimiento periodoDesde={periodoDesde} periodoHasta={periodoHasta} />
    </div>
  );
}
