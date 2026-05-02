import { useMemo, useState } from 'react';

import { useKpisComparativa, useKpisPorSemana, useKpisRango } from '@/hooks/useObjetivosMetricas';
import { useUsuariosNombreTablero } from '@/hooks/useTablero';
import { APP_PAGE_CLASS } from '@/lib/appLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { FilterBar } from '@/components/ui/FilterBar';
import { fechaLocalYmd } from '@/lib/fecha';
import { useAuthStore } from '@/store/authStore';

// ── Configuración visual ─────────────────────────────────────────────────────

const COLORES: Record<string, string> = {
  completadas:   '#27500A',
  atrasadas:     '#E24B4A',
  bloqueadas:    '#EF9F27',
  reprogramadas: '#7F77DD',
  en_progreso:   '#185FA5',
  pendientes:    '#B4B2A9',
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

function fmtPct(val: number, total: number) {
  return `${pct(val, total)}%`;
}

// ── Tendencia: compara última semana con la anterior ─────────────────────────
function Tendencia({ porSemana }: { porSemana: { completadas: number; total: number }[] }) {
  if (porSemana.length < 2) return null;
  const ultima   = porSemana[porSemana.length - 1];
  const anterior = porSemana[porSemana.length - 2];
  const tasaUlt  = pct(ultima.completadas,   ultima.total);
  const tasaAnt  = pct(anterior.completadas, anterior.total);
  const diff = tasaUlt - tasaAnt;
  if (diff === 0) return null;
  const sube = diff > 0;
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 500,
        color: sube ? '#27500A' : '#A32D2D',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 3,
        marginLeft: 8,
      }}
    >
      {sube ? '▲' : '▼'} {Math.abs(diff)}pp vs semana anterior
    </span>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────
export function Metricas() {
  const usuario = useAuthStore((s) => s.usuario);
  const esJefe  = usuario?.rol === 'jefe';

  const [desde,        setDesde]        = useState(defaultDesde);
  const [hasta,        setHasta]        = useState(() => fechaLocalYmd(new Date()));
  const [miembroFiltro, setMiembroFiltro] = useState<string | undefined>(esJefe ? undefined : usuario?.id);

  const { data: nombres = {} } = useUsuariosNombreTablero();
  const uid = esJefe ? miembroFiltro : usuario?.id;

  const { data: kpis,       isLoading: loadK } = useKpisRango(desde, hasta, uid);
  const { data: porSemana = [], isLoading: loadS } = useKpisPorSemana(desde, hasta, uid);
  const { data: comparativa = [], isLoading: loadC } = useKpisComparativa(desde, hasta, esJefe);

  const maxTotal = useMemo(() => Math.max(...porSemana.map((s) => s.total), 1), [porSemana]);

  const cumplimiento = kpis ? pct(kpis.completadas, kpis.total) : null;

  if (!usuario) return null;

  return (
    <div className={APP_PAGE_CLASS}>
      <PageHeader title="Métricas" subtitle="Indicadores de rendimiento" />

      {/* Filtros */}
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

      {/* ── KPIs principales ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">

        {/* Tasa de cumplimiento — destacada como KPI principal */}
        <div className="mc-card !p-4 flex flex-col gap-2 col-span-2 sm:col-span-1">
          {loadK ? (
            <span className="text-3xl font-semibold text-[var(--mc-color-text-secondary)]">—</span>
          ) : (
            <div className="flex items-end gap-2">
              <span className="text-3xl font-semibold" style={{ color: cumplimiento !== null && cumplimiento >= 70 ? '#27500A' : cumplimiento !== null && cumplimiento >= 40 ? '#854F0B' : '#A32D2D' }}>
                {cumplimiento ?? 0}%
              </span>
              <Tendencia porSemana={porSemana} />
            </div>
          )}
          <span className="text-xs font-medium text-[var(--mc-color-text-secondary)]">Tasa de cumplimiento</span>
          {/* Mini barra de progreso */}
          {!loadK && kpis && (
            <div className="h-1.5 w-full rounded-full bg-[var(--mc-color-bg-secondary)] overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${cumplimiento ?? 0}%`,
                  background: (cumplimiento ?? 0) >= 70 ? '#27500A' : (cumplimiento ?? 0) >= 40 ? '#EF9F27' : '#E24B4A',
                }}
              />
            </div>
          )}
        </div>

        {/* KPIs secundarios */}
        {([
          { key: 'total',        label: 'Total tareas',   color: 'var(--mc-color-text)' },
          { key: 'completadas',  label: 'Completadas',    color: '#27500A' },
          { key: 'atrasadas',    label: 'Atrasadas',      color: '#A32D2D' },
          { key: 'en_progreso',  label: 'En progreso',    color: '#185FA5' },
          { key: 'bloqueadas',   label: 'Bloqueadas',     color: '#854F0B' },
          { key: 'reprogramadas',label: 'Reprogramadas',  color: '#3C3489' },
          { key: 'incidencias',  label: 'Incidencias',    color: 'var(--mc-color-text-secondary)' },
        ] as const).map(({ key, label, color }) => (
          <div key={key} className="mc-card !p-3 flex flex-col gap-1">
            {loadK ? (
              <span className="text-2xl font-medium text-[var(--mc-color-text-secondary)]">—</span>
            ) : (
              <span className="text-2xl font-medium" style={{ color }}>{kpis?.[key] ?? 0}</span>
            )}
            <span className="text-xs text-[var(--mc-color-text-secondary)]">{label}</span>
          </div>
        ))}
      </div>

      {/* ── Gráfico semanal ────────────────────────────────────────────────── */}
      <div className="mc-card">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-medium text-[var(--mc-color-text)]">Tareas por semana</p>
          <div className="flex flex-wrap gap-3">
            {LEYENDA.map(({ key, label }) => (
              <div key={key} className="flex items-center gap-1.5 text-[11px] text-[var(--mc-color-text-secondary)]">
                <span className="inline-block h-2 w-2 rounded-sm" style={{ background: COLORES[key] }} />
                {label}
              </div>
            ))}
          </div>
        </div>
        {loadS ? (
          <p className="text-sm text-[var(--mc-color-text-secondary)]">Cargando…</p>
        ) : porSemana.length === 0 ? (
          <p className="text-sm text-[var(--mc-color-text-secondary)]">Sin datos en el rango seleccionado.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {porSemana.map((s) => {
              const tasaSem = pct(s.completadas, s.total);
              return (
                <div key={s.semanaISO} className="flex items-center gap-3">
                  {/* Label semana */}
                  <span className="w-16 shrink-0 text-right text-xs text-[var(--mc-color-text-secondary)]">
                    {s.semana}
                  </span>

                  {/* Barra apilada */}
                  <div className="flex h-6 flex-1 overflow-hidden rounded" role="img" aria-label={`Semana ${s.semana}: ${s.total} tareas`}>
                    {LEYENDA.map(({ key }) => {
                      const val = s[key as keyof typeof s] as number;
                      if (!val) return null;
                      const w = (val / maxTotal) * 100;
                      return (
                        <div
                          key={key}
                          style={{ width: `${w}%`, background: COLORES[key], minWidth: val > 0 ? 2 : 0 }}
                          title={`${val} ${key}`}
                          className="flex items-center justify-center transition-all"
                        >
                          {w > 8 && (
                            <span className="text-[9px] font-semibold text-white/90 select-none">
                              {val}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Total + tasa */}
                  <div className="flex w-20 shrink-0 items-center justify-end gap-1.5">
                    <span className="text-xs font-medium text-[var(--mc-color-text)]">{s.total}</span>
                    <span
                      className="text-[10px] font-medium"
                      style={{ color: tasaSem >= 70 ? '#27500A' : tasaSem >= 40 ? '#854F0B' : '#A32D2D' }}
                    >
                      {tasaSem}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Comparativa por miembro (solo jefe) ───────────────────────────── */}
      {esJefe && (
        <div className="mc-card">
          <p className="mb-3 text-sm font-medium text-[var(--mc-color-text)]">Comparativa por miembro</p>
          {loadC ? (
            <p className="text-sm text-[var(--mc-color-text-secondary)]">Cargando…</p>
          ) : comparativa.length === 0 ? (
            <p className="text-sm text-[var(--mc-color-text-secondary)]">Sin datos.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-[var(--mc-color-border)]">
                    {['Miembro', 'Completadas', 'Atrasadas', 'Bloqueadas', 'Reprog.', 'Cumplim.'].map((h) => (
                      <th key={h} className="p-2 text-left text-[10px] font-medium uppercase tracking-wide text-[var(--mc-color-text-secondary)]">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {comparativa.map((m) => {
                    const totalM = m.completadas + m.atrasadas + m.bloqueadas + m.reprogramadas;
                    const cumplM = pct(m.completadas, totalM);
                    return (
                      <tr key={m.usuarioId} className="border-b border-[var(--mc-color-border)] last:border-b-0 hover:bg-[var(--mc-color-bg-secondary)] transition-colors">
                        <td className="p-2 font-medium text-[var(--mc-color-text)]">{m.nombre}</td>
                        <td className="p-2 font-medium" style={{ color: '#27500A' }}>{m.completadas}</td>
                        <td className="p-2 font-medium" style={{ color: '#A32D2D' }}>{m.atrasadas}</td>
                        <td className="p-2 font-medium" style={{ color: '#854F0B' }}>{m.bloqueadas}</td>
                        <td className="p-2 font-medium" style={{ color: '#3C3489' }}>{m.reprogramadas}</td>
                        <td className="p-2">
                          <div className="flex items-center gap-2">
                            {/* Mini barra */}
                            <div className="h-1.5 w-16 rounded-full bg-[var(--mc-color-bg-secondary)] overflow-hidden">
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${cumplM}%`,
                                  background: cumplM >= 70 ? '#27500A' : cumplM >= 40 ? '#EF9F27' : '#E24B4A',
                                }}
                              />
                            </div>
                            <span
                              className="text-xs font-semibold"
                              style={{ color: cumplM >= 70 ? '#27500A' : cumplM >= 40 ? '#854F0B' : '#A32D2D' }}
                            >
                              {fmtPct(m.completadas, totalM)}
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