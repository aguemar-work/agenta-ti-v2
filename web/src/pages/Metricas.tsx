import { useMemo, useState } from 'react';

import { useKpisComparativa, useKpisPorSemana, useKpisRango } from '@/hooks/useObjetivosMetricas';
import { useUsuariosNombreTablero } from '@/hooks/useTablero';
import { APP_PAGE_CLASS } from '@/lib/appLayout';
import { fechaLocalYmd } from '@/lib/fecha';
import { useAuthStore } from '@/store/authStore';

const kpiConfig = [
  { key: 'total', label: 'Total tareas', color: 'text-[var(--mc-color-text)]' },
  { key: 'completadas', label: 'Completadas', color: 'text-[#27500A]' },
  { key: 'en_progreso', label: 'En progreso', color: 'text-[#185FA5]' },
  { key: 'pendientes', label: 'Pendientes', color: 'text-[var(--mc-color-text)]' },
  { key: 'atrasadas', label: 'Atrasadas', color: 'text-[#A32D2D]' },
  { key: 'bloqueadas', label: 'Bloqueadas', color: 'text-[#854F0B]' },
  { key: 'reprogramadas', label: 'Reprogramadas', color: 'text-[#3C3489]' },
  { key: 'incidencias', label: 'Incidencias', color: 'text-[var(--mc-color-text-secondary)]' },
] as const;

const leyendaBar = [
  { key: 'completadas', color: '#27500A', label: 'Completadas' },
  { key: 'atrasadas', color: '#E24B4A', label: 'Atrasadas' },
  { key: 'bloqueadas', color: '#EF9F27', label: 'Bloqueadas' },
  { key: 'reprogramadas', color: '#7F77DD', label: 'Reprogramadas' },
  { key: 'en_progreso', color: '#185FA5', label: 'En progreso' },
  { key: 'pendientes', color: '#B4B2A9', label: 'Pendientes' },
] as const;

function defaultDesde() {
  const d = new Date();
  d.setDate(d.getDate() - 28);
  return fechaLocalYmd(d);
}

export function Metricas() {
  const usuario = useAuthStore((s) => s.usuario);
  const esJefe = usuario?.rol === 'jefe';

  const [desde, setDesde] = useState(defaultDesde);
  const [hasta, setHasta] = useState(() => fechaLocalYmd(new Date()));
  const [miembroFiltro, setMiembroFiltro] = useState<string | undefined>(esJefe ? undefined : usuario?.id);

  const { data: nombres = {} } = useUsuariosNombreTablero();

  const uid = esJefe ? miembroFiltro : usuario?.id;

  const { data: kpis, isLoading: loadK } = useKpisRango(desde, hasta, uid);
  const { data: porSemana = [], isLoading: loadS } = useKpisPorSemana(desde, hasta, uid);
  const { data: comparativa = [], isLoading: loadC } = useKpisComparativa(desde, hasta, esJefe);

  const maxTotal = useMemo(() => Math.max(...porSemana.map((s) => s.total), 1), [porSemana]);

  if (!usuario) return null;

  return (
    <div className={APP_PAGE_CLASS}>
      <div className="mb-4">
        <h1 className="font-semibold text-[var(--mc-color-text)]" style={{ fontSize: 'var(--mc-text-lg)' }}>
          Métricas
        </h1>
        <h2 className="mt-2 text-sm font-medium text-[var(--mc-color-text-secondary)]">Indicadores de rendimiento</h2>
      </div>

      <div className="mc-card mb-4 flex flex-wrap items-end gap-4">
        <label className="flex flex-col gap-1 text-xs text-[var(--mc-color-text-secondary)]">
          Desde
          <input type="date" className="mc-input !w-auto !py-1.5 text-sm" value={desde} onChange={(e) => setDesde(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-[var(--mc-color-text-secondary)]">
          Hasta
          <input type="date" className="mc-input !w-auto !py-1.5 text-sm" value={hasta} onChange={(e) => setHasta(e.target.value)} />
        </label>
        {esJefe ? (
          <label className="flex flex-col gap-1 text-xs text-[var(--mc-color-text-secondary)]">
            Miembro
            <select
              className="mc-input !w-auto min-w-[180px] !py-1.5 text-sm"
              value={miembroFiltro ?? ''}
              onChange={(e) => setMiembroFiltro(e.target.value || undefined)}
            >
              <option value="">Todos</option>
              {Object.entries(nombres).map(([id, nombre]) => (
                <option key={id} value={id}>
                  {nombre}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
        {kpiConfig.map(({ key, label, color }) => (
          <div key={key} className="mc-card flex flex-col gap-1 !p-3">
            {loadK ? (
              <span className="text-2xl font-medium text-[var(--mc-color-text-secondary)]">—</span>
            ) : (
              <span className={`text-2xl font-medium ${color}`}>{kpis?.[key] ?? 0}</span>
            )}
            <span className="text-xs text-[var(--mc-color-text-secondary)]">{label}</span>
          </div>
        ))}
      </div>

      <div className="mc-card mb-4">
        <p className="mb-3 text-sm font-medium text-[var(--mc-color-text)]">Tareas por semana</p>
        <div className="mb-3 flex flex-wrap gap-3">
          {leyendaBar.map(({ key, color, label }) => (
            <div key={key} className="flex items-center gap-1.5 text-xs text-[var(--mc-color-text-secondary)]">
              <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: color }} />
              {label}
            </div>
          ))}
        </div>
        {loadS ? (
          <p className="text-sm text-[var(--mc-color-text-secondary)]">Cargando…</p>
        ) : porSemana.length === 0 ? (
          <p className="text-sm text-[var(--mc-color-text-secondary)]">Sin datos en el rango seleccionado.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {porSemana.map((s) => (
              <div key={s.semanaISO} className="flex items-center gap-3">
                <span className="w-14 shrink-0 text-right text-xs text-[var(--mc-color-text-secondary)]">{s.semana}</span>
                <div className="flex h-5 flex-1 overflow-hidden rounded">
                  {leyendaBar.map(({ key, color }) => {
                    const val = s[key as keyof typeof s] as number;
                    if (!val) return null;
                    const pct = (val / maxTotal) * 100;
                    return <div key={key} style={{ width: `${pct}%`, background: color }} title={`${val} ${key}`} />;
                  })}
                </div>
                <span className="w-7 shrink-0 text-right text-xs text-[var(--mc-color-text-secondary)]">{s.total}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {esJefe ? (
        <div className="mc-card">
          <p className="mb-3 text-sm font-medium text-[var(--mc-color-text)]">Comparativa por miembro</p>
          {loadC ? (
            <p className="text-sm text-[var(--mc-color-text-secondary)]">Cargando…</p>
          ) : comparativa.length === 0 ? (
            <p className="text-sm text-[var(--mc-color-text-secondary)]">Sin datos.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[400px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-[var(--mc-color-border)]">
                    {['Miembro', 'Completadas', 'Atrasadas', 'Bloqueadas', 'Reprogramadas'].map((h) => (
                      <th key={h} className="p-2 text-left text-[10px] font-medium uppercase tracking-wide text-[var(--mc-color-text-secondary)]">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {comparativa.map((m) => (
                    <tr key={m.usuarioId} className="border-b border-[var(--mc-color-border)] last:border-b-0">
                      <td className="p-2 font-medium text-[var(--mc-color-text)]">{m.nombre}</td>
                      <td className="p-2 font-medium text-[#27500A]">{m.completadas}</td>
                      <td className="p-2 font-medium text-[#A32D2D]">{m.atrasadas}</td>
                      <td className="p-2 font-medium text-[#854F0B]">{m.bloqueadas}</td>
                      <td className="p-2 font-medium text-[#3C3489]">{m.reprogramadas}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
