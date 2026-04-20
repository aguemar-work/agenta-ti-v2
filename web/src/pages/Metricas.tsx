import { useKpisUsuario } from '@/hooks/useObjetivosMetricas';
import { APP_PAGE_CLASS } from '@/lib/appLayout';
import { useAuthStore } from '@/store/authStore';

export function Metricas() {
  const usuario = useAuthStore((s) => s.usuario);
  const { data: kpis, isLoading } = useKpisUsuario(usuario?.id);

  if (!usuario) return null;

  return (
    <div className={APP_PAGE_CLASS}>
      <div>
        <h1 className="font-semibold text-[var(--mc-color-text)]" style={{ fontSize: 'var(--mc-text-lg)' }}>
          Métricas
        </h1>
        <h2 className="mt-2 text-sm font-medium text-[var(--mc-color-text-secondary)]">Indicadores</h2>
      </div>
      <div className="mc-kpi-grid">
        {(['activas', 'completadas7d', 'objetivosActivos', 'atrasadas'] as const).map((key) => (
          <div key={key} className="mc-kpi-card">
            {isLoading ? (
              <div className="mc-kpi-value text-[var(--mc-color-text-secondary)]">—</div>
            ) : (
              <div className="mc-kpi-value">
                {key === 'activas'
                  ? kpis?.activas ?? 0
                  : key === 'completadas7d'
                    ? kpis?.completadas7d ?? 0
                    : key === 'objetivosActivos'
                      ? kpis?.objetivosActivos ?? 0
                      : kpis?.atrasadas ?? 0}
              </div>
            )}
            <div className="mc-kpi-label">
              {key === 'activas'
                ? 'Tareas activas'
                : key === 'completadas7d'
                  ? 'Completadas (7 días)'
                  : key === 'objetivosActivos'
                    ? 'Objetivos activos'
                    : 'Tareas atrasadas'}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
