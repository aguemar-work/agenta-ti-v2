import { useMemo, useState } from 'react';

import { useKpisComparativa, useKpisPorSemana, useKpisRango } from '@/hooks/useObjetivosMetricas';
import { useUsuariosActivos } from '@/hooks/useUsuarios';
import { APP_PAGE_CLASS } from '@/lib/appLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { FilterBar } from '@/components/ui/FilterBar';
import { KpiCard } from '@/components/ui/KpiCard';
import { fechaLocalYmd } from '@/lib/fecha';
import { useAuthStore } from '@/store/authStore';

// ---------------------------------------------------------------------------
// Paleta de colores por estado — vía tokens (lib/estadoConfig + tokens.css)
// ---------------------------------------------------------------------------
const COLORES: Record<string, string> = {
  completadas:   'var(--mc-state-completada-fg)',
  atrasadas:     'var(--mc-state-atrasada-border)',
  bloqueadas:    'var(--mc-color-warning)',
  reprogramadas: 'var(--mc-state-reprogramada-border)',
  en_progreso:   'var(--mc-state-progreso-border)',
  pendientes:    'var(--mc-color-neutral-soft)',
};

const LEYENDA = [
  { key: 'completadas',   label: 'Completadas' },
  { key: 'en_progreso',   label: 'En progreso' },
  { key: 'pendientes',    label: 'Pendientes' },
  { key: 'atrasadas',     label: 'Atrasadas' },
  { key: 'bloqueadas',    label: 'Bloqueadas' },
  { key: 'reprogramadas', label: 'Reprogramadas' },
] as const;

function defaultDesde() {
  const d = new Date();
  d.setDate(d.getDate() - 28);
  return fechaLocalYmd(d);
}

function pct(val: number, total: number) {
  return total > 0 ? Math.round((val / total) * 100) : 0;
}

// ---------------------------------------------------------------------------
// Color semáforo según porcentaje de cumplimiento
// ---------------------------------------------------------------------------
function colorCumplimiento(p: number) {
  if (p >= 70) return 'var(--mc-state-completada-fg)';
  if (p >= 40) return 'var(--mc-state-bloqueada-meta)';
  return 'var(--mc-state-atrasada-meta)';
}

function bgCumplimiento(p: number) {
  if (p >= 70) return 'var(--mc-state-completada-bg-soft)';
  if (p >= 40) return 'var(--mc-state-precaucion-bg-soft)';
  return 'var(--mc-state-atrasada-bg-soft)';
}

// ---------------------------------------------------------------------------
// Tendencia vs semana anterior
// ---------------------------------------------------------------------------
function Tendencia({ porSemana }: { porSemana: { completadas: number; total: number }[] }) {
  if (porSemana.length < 2) return null;
  const ultima   = porSemana[porSemana.length - 1];
  const anterior = porSemana[porSemana.length - 2];
  const diff = pct(ultima.completadas, ultima.total) - pct(anterior.completadas, anterior.total);
  if (diff === 0) return null;
  const sube = diff > 0;
  return (
    <span style={{
      fontSize: 11, fontWeight: 500,
      color: sube ? 'var(--mc-state-completada-fg)' : 'var(--mc-state-atrasada-meta)',
      display: 'inline-flex', alignItems: 'center', gap: 3, marginLeft: 8,
    }}>
      {sube ? '▲' : '▼'} {Math.abs(diff)}pp vs sem. anterior
    </span>
  );
}

// ---------------------------------------------------------------------------
// Página principal
// ---------------------------------------------------------------------------
export function Metricas() {
  const usuario = useAuthStore((s) => s.usuario);
  const esJefe  = usuario?.rol === 'jefe';

  const [desde,         setDesde]         = useState(defaultDesde);
  const [hasta,         setHasta]         = useState(() => fechaLocalYmd(new Date()));
  const [miembroFiltro, setMiembroFiltro] = useState<string | undefined>(esJefe ? undefined : usuario?.id);

  const { data: usuariosLista = [] } = useUsuariosActivos();
  const nombres = Object.fromEntries(usuariosLista.map((u) => [u.id, u.nombre]));
  const uid = esJefe ? miembroFiltro : usuario?.id;

  const { data: kpis,         isLoading: loadK } = useKpisRango(desde, hasta, uid);
  const { data: porSemana = [], isLoading: loadS } = useKpisPorSemana(desde, hasta, uid);
  const { data: comparativa = [], isLoading: loadC } = useKpisComparativa(desde, hasta, esJefe);

  const maxTotal       = useMemo(() => Math.max(...porSemana.map((s) => s.total), 1), [porSemana]);
  const cumplimiento   = kpis ? pct(kpis.completadas, kpis.total) : null;

  // Resumen ejecutivo para el jefe: cuántos miembros están por debajo del 50%
  const miembrosBajoRendimiento = useMemo(() =>
    comparativa.filter((m) => {
      const tot = m.completadas + m.atrasadas + m.bloqueadas + m.reprogramadas;
      return tot > 0 && pct(m.completadas, tot) < 50;
    }).length,
  [comparativa]);

  if (!usuario) return null;

  return (
    <div className={APP_PAGE_CLASS}>
      <PageHeader
        title="Métricas"
        subtitle={
          esJefe && miembrosBajoRendimiento > 0
            ? `${miembrosBajoRendimiento} miembro${miembrosBajoRendimiento > 1 ? 's' : ''} con cumplimiento bajo`
            : 'Indicadores de rendimiento'
        }
      />

      {/* ── Filtros ──────────────────────────────────────────────────────── */}
      <FilterBar>
        <FilterBar.Date id="metricas-desde" label="Desde" value={desde} onChange={setDesde} />
        <FilterBar.Date id="metricas-hasta" label="Hasta" value={hasta} onChange={setHasta} />
        {esJefe && (
          <FilterBar.Select
            id="metricas-miembro"
            label="Miembro"
            value={miembroFiltro ?? ''}
            onChange={(v) => setMiembroFiltro(v || undefined)}
            options={[
              { value: '', label: 'Todos' },
              ...Object.entries(nombres).map(([id, nombre]) => ({ value: id, label: nombre })),
            ]}
            minWidth={180}
          />
        )}
      </FilterBar>

      {/* ── KPI principal: cumplimiento ──────────────────────────────────── */}
      <div style={{
        background:   cumplimiento !== null ? bgCumplimiento(cumplimiento) : 'var(--mc-color-surface)',
        border:       `1px solid ${cumplimiento !== null ? 'transparent' : 'var(--mc-color-border)'}`,
        borderRadius: 'var(--mc-radius-lg)',
        padding:      '16px 20px',
        display:      'flex',
        alignItems:   'center',
        gap:           20,
        flexWrap:     'wrap',
        marginBottom:  4,
      }}>
        <div>
          {loadK ? (
            <span style={{ fontSize: 40, fontWeight: 700, color: 'var(--mc-color-text-secondary)' }}>—</span>
          ) : (
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{ fontSize: 40, fontWeight: 700, color: colorCumplimiento(cumplimiento ?? 0), lineHeight: 1 }}>
                {cumplimiento ?? 0}%
              </span>
              <Tendencia porSemana={porSemana} />
            </div>
          )}
          <p style={{ margin: '4px 0 0', fontSize: 12, fontWeight: 600, color: 'var(--mc-color-text-secondary)' }}>
            Tasa de cumplimiento
          </p>
        </div>

        {/* Barra de progreso principal */}
        {!loadK && kpis && (
          <div style={{ flex: 1, minWidth: 120 }}>
            <div style={{ height: 8, borderRadius: 8, background: 'rgba(0,0,0,0.08)', overflow: 'hidden' }}>
              <div style={{
                height:     '100%',
                width:      `${cumplimiento ?? 0}%`,
                borderRadius: 8,
                background: colorCumplimiento(cumplimiento ?? 0),
                transition: 'width 0.4s ease',
              }} />
            </div>
            <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--mc-color-text-secondary)' }}>
              {kpis.completadas} de {kpis.total} tareas completadas en el período
            </p>
          </div>
        )}
      </div>

      {/* ── Grid de KPIs secundarios ─────────────────────────────────────── */}
      <div style={{
        display:             'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
        gap:                  10,
      }}>
        <KpiCard value={kpis?.total          ?? 0} label="Total tareas"   variant="neutral" loading={loadK} />
        <KpiCard value={kpis?.completadas    ?? 0} label="Completadas"    variant="success" emphasized={(kpis?.completadas    ?? 0) > 0} loading={loadK} />
        <KpiCard value={kpis?.atrasadas      ?? 0} label="Atrasadas"      variant="danger"  emphasized={(kpis?.atrasadas      ?? 0) > 0} loading={loadK} />
        <KpiCard value={kpis?.en_progreso    ?? 0} label="En progreso"    variant="info"    loading={loadK} />
        <KpiCard value={kpis?.bloqueadas     ?? 0} label="Bloqueadas"     variant="warning" emphasized={(kpis?.bloqueadas     ?? 0) > 0} loading={loadK} />
        <KpiCard value={kpis?.reprogramadas  ?? 0} label="Reprogramadas"  variant="neutral" loading={loadK} />
        <KpiCard value={kpis?.incidencias    ?? 0} label="Incidencias"    variant="info"    emphasized={(kpis?.incidencias    ?? 0) > 0} loading={loadK} />
      </div>

      {/* ── Gráfico semanal ──────────────────────────────────────────────── */}
      <div className="mc-card">
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 14 }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--mc-color-text)' }}>Tareas por semana</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            {LEYENDA.map(({ key, label }) => (
              <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--mc-color-text-secondary)' }}>
                <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: COLORES[key], flexShrink: 0 }} />
                {label}
              </div>
            ))}
          </div>
        </div>

        {loadS ? (
          <p style={{ fontSize: 13, color: 'var(--mc-color-text-secondary)' }}>Cargando…</p>
        ) : porSemana.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--mc-color-text-secondary)' }}>Sin datos en el rango seleccionado.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {porSemana.map((s) => {
              const tasaSem = pct(s.completadas, s.total);
              return (
                <div key={s.semanaISO} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ width: 52, textAlign: 'right', fontSize: 11, color: 'var(--mc-color-text-secondary)', flexShrink: 0 }}>
                    {s.semana}
                  </span>

                  {/* Barra apilada */}
                  <div
                    style={{ flex: 1, height: 24, display: 'flex', overflow: 'hidden', borderRadius: 4 }}
                    role="img"
                    aria-label={`Semana ${s.semana}: ${s.total} tareas, ${tasaSem}% cumplimiento`}
                  >
                    {LEYENDA.map(({ key }) => {
                      const val = s[key as keyof typeof s] as number;
                      if (!val) return null;
                      const w = (val / maxTotal) * 100;
                      return (
                        <div
                          key={key}
                          style={{ width: `${w}%`, background: COLORES[key], minWidth: 2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          title={`${val} ${key}`}
                        >
                          {w > 8 && (
                            <span style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.9)', userSelect: 'none' }}>
                              {val}
                            </span>
                          )}
                        </div>
                      );
                    })}
                    {/* Fondo gris para el espacio sobrante */}
                    <div style={{ flex: 1, background: 'var(--mc-color-border)' }} />
                  </div>

                  {/* Total + tasa */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, width: 72, justifyContent: 'flex-end', flexShrink: 0 }}>
                    <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--mc-color-text)' }}>{s.total}</span>
                    <span style={{ fontSize: 11, fontWeight: 600, color: colorCumplimiento(tasaSem) }}>
                      {tasaSem}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Comparativa por miembro (solo jefe) ──────────────────────────── */}
      {esJefe && (
        <div className="mc-card">
          <p style={{ margin: '0 0 14px', fontSize: 13, fontWeight: 600, color: 'var(--mc-color-text)' }}>
            Comparativa por miembro
          </p>
          {loadC ? (
            <p style={{ fontSize: 13, color: 'var(--mc-color-text-secondary)' }}>Cargando…</p>
          ) : comparativa.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--mc-color-text-secondary)' }}>Sin datos.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', minWidth: 520, borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--mc-color-border)' }}>
                    {['Miembro', 'Complet.', 'Atras.', 'Bloq.', 'Reprog.', 'Cumplim.'].map((h) => (
                      <th key={h} style={{
                        padding:       '6px 8px',
                        textAlign:     'left',
                        fontSize:       10,
                        fontWeight:     600,
                        textTransform: 'uppercase',
                        letterSpacing: '.06em',
                        color:         'var(--mc-color-text-secondary)',
                      }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {comparativa.map((m) => {
                    const totalM = m.completadas + m.atrasadas + m.bloqueadas + m.reprogramadas;
                    const cumplM = pct(m.completadas, totalM);
                    const esBajo = totalM > 0 && cumplM < 50;

                    return (
                      <tr
                        key={m.usuarioId}
                        style={{
                          borderBottom: '1px solid var(--mc-color-border)',
                          background:   esBajo ? 'var(--mc-state-row-danger-soft)' : undefined,
                        }}
                      >
                        <td style={{ padding: '8px', fontWeight: 500, color: 'var(--mc-color-text)' }}>
                          {m.nombre}
                          {esBajo && (
                            <span style={{ marginLeft: 6, fontSize: 10, color: 'var(--mc-state-atrasada-meta)', fontWeight: 400 }}>
                              bajo rendimiento
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '8px', fontWeight: 600, color: 'var(--mc-state-completada-fg)' }}>{m.completadas}</td>
                        <td style={{ padding: '8px', fontWeight: 600, color: m.atrasadas > 0 ? 'var(--mc-state-atrasada-meta)' : 'var(--mc-color-text-secondary)' }}>{m.atrasadas}</td>
                        <td style={{ padding: '8px', fontWeight: 600, color: m.bloqueadas > 0 ? 'var(--mc-state-bloqueada-meta)' : 'var(--mc-color-text-secondary)' }}>{m.bloqueadas}</td>
                        <td style={{ padding: '8px', fontWeight: 600, color: 'var(--mc-state-reprogramada-fg)' }}>{m.reprogramadas}</td>
                        <td style={{ padding: '8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ height: 6, width: 80, borderRadius: 6, background: 'var(--mc-color-border)', overflow: 'hidden', flexShrink: 0 }}>
                              <div style={{
                                height:     '100%',
                                width:      `${cumplM}%`,
                                borderRadius: 6,
                                background: colorCumplimiento(cumplM),
                                transition: 'width 0.4s ease',
                              }} />
                            </div>
                            <span style={{ fontSize: 12, fontWeight: 700, color: colorCumplimiento(cumplM), minWidth: 34 }}>
                              {cumplM}%
                            </span>
                            <span style={{ fontSize: 11, color: 'var(--mc-color-text-secondary)', whiteSpace: 'nowrap' }}>
                              {m.completadas}/{totalM} tareas
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}