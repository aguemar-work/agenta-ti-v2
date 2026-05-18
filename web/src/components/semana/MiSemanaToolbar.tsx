import { MiSemanaLeyendaEstados } from '@/components/semana/MiSemanaLeyendaEstados';
import { MiSemanaMenuSecundario } from '@/components/semana/MiSemanaMenuSecundario';
import { MiSemanaStatsInline } from '@/components/semana/MiSemanaStatsInline';

type StatItem = {
  key: string;
  label: string;
  value: number;
  active?: boolean;
  disabled?: boolean;
  onClick?: (() => void) | undefined;
};

type Props = {
  statsItems: StatItem[];
  ocultarCompletadas: boolean;
  onToggleCompletadas: () => void;
  filtroActivoLabel: string | null;
  onLimpiarFiltro: () => void;
  esJefe: boolean;
  uid: string;
  usuariosJefe: { id: string; nombre: string }[];
  onSeleccionarUsuario: (id: string) => void;
};

export function MiSemanaToolbar({
  statsItems,
  ocultarCompletadas,
  onToggleCompletadas,
  filtroActivoLabel,
  onLimpiarFiltro,
  esJefe,
  uid,
  usuariosJefe,
  onSeleccionarUsuario,
}: Props) {
  return (
    <div className="mc-misemana-toolbar">
      <div className="mc-misemana-toolbar__left">
        <MiSemanaStatsInline items={statsItems} />
        {filtroActivoLabel && (
          <div className="mc-misemana-toolbar__filtro" role="status" aria-live="polite">
            <span className="text-xs text-[var(--mc-color-text-secondary)]">
              Filtro: <strong className="text-[var(--mc-color-text)]">{filtroActivoLabel}</strong>
            </span>
            <button type="button" className="mc-btn-ghost mc-btn-xs" onClick={onLimpiarFiltro}>
              Limpiar
            </button>
          </div>
        )}
      </div>

      <div className="mc-misemana-toolbar__right">
        <MiSemanaLeyendaEstados compact className="mc-misemana-toolbar__leyenda" />
        <label className="mc-misemana-toggle-completadas">
          <input
            type="checkbox"
            className="mc-misemana-toggle-completadas__input"
            checked={!ocultarCompletadas}
            onChange={onToggleCompletadas}
          />
          <span className="mc-misemana-toggle-completadas__track" aria-hidden />
          <span className="mc-misemana-toggle-completadas__label">Mostrar completadas</span>
        </label>
        {esJefe && (
          <MiSemanaMenuSecundario
            esJefe={esJefe}
            uid={uid}
            usuariosJefe={usuariosJefe}
            onSeleccionarUsuario={onSeleccionarUsuario}
          />
        )}
      </div>
    </div>
  );
}
