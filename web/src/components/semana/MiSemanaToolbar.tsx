import { CalendarDays, LayoutList, Table2, ListChecks } from 'lucide-react';
import { FilterBar } from '@/components/ui/FilterBar';
import { Button } from '@/components/ui/Button';

export type FiltroRapido = 'sin_iniciar' | 'atrasada' | 'critica';
export type VistaMode = 'semanal' | 'compacta' | 'lista';

const CHIPS: { key: FiltroRapido; label: string }[] = [
  { key: 'sin_iniciar', label: 'Sin iniciar' },
  { key: 'atrasada',    label: 'Atrasadas' },
  { key: 'critica',     label: 'Críticas' },
];

type UsuarioOption = { id: string; nombre: string };

type Props = {
  filtroRapido: FiltroRapido | null;
  onToggleFiltroRapido: (key: FiltroRapido) => void;
  onLimpiarFiltro: () => void;
  // Selector de usuario (solo jefes)
  esJefe?: boolean;
  uid?: string;
  usuariosJefe?: UsuarioOption[];
  onSeleccionarUsuario?: (id: string) => void;
  // Acciones
  onResumen: () => void;
  vista: VistaMode;
  onSetVista: (v: VistaMode) => void;
};

export function MiSemanaToolbar({
  filtroRapido,
  onToggleFiltroRapido,
  onLimpiarFiltro,
  esJefe,
  uid,
  usuariosJefe,
  onSeleccionarUsuario,
  onResumen,
  vista,
  onSetVista,
}: Props) {
  const hayFiltro = Boolean(filtroRapido);
  const muestraSelectorJefe =
    esJefe && Boolean(uid) && Boolean(usuariosJefe?.length) && Boolean(onSeleccionarUsuario);

  return (
    <div className="mc-misemana-toolbar">
      {/* Izquierda: Viendo: [dropdown o etiqueta] */}
      <div className="mc-misemana-toolbar__viendo">
        <span className="mc-misemana-toolbar__viendo-label">Viendo:</span>
        {muestraSelectorJefe ? (
          <FilterBar.Select
            id="misemana-ver-semana-de"
            label="Seleccionar usuario"
            hideLabel
            value={uid!}
            onChange={onSeleccionarUsuario!}
            options={usuariosJefe!.map((u) => ({ value: u.id, label: u.nombre }))}
            minWidth={140}
          />
        ) : (
          <span className="mc-misemana-toolbar__viendo-valor">Mis tareas</span>
        )}
      </div>

      {/* Derecha: chips + [Resumen] + [Vista semanal|Vista compacta] */}
      <div className="mc-misemana-toolbar__right">
        <div className="mc-misemana-toolbar__chips" role="group" aria-label="Filtros rápidos">
          <button
            type="button"
            className={`mc-misemana-chip${!hayFiltro ? ' mc-misemana-chip--active' : ''}`}
            onClick={onLimpiarFiltro}
            aria-pressed={!hayFiltro}
          >
            Todos
          </button>

          {CHIPS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              className={`mc-misemana-chip${filtroRapido === key ? ' mc-misemana-chip--active' : ''}`}
              onClick={() => onToggleFiltroRapido(key)}
              aria-pressed={filtroRapido === key}
            >
              {label}
            </button>
          ))}
        </div>

        <Button variant="secondary" size="sm" onClick={onResumen} title="Ver resumen de la semana">
          <ListChecks size={13} aria-hidden />
          Resumen
        </Button>

        <div className="mc-toggle-pill" role="group" aria-label="Modo de vista">
          <button
            type="button"
            className="mc-toggle-pill-btn"
            aria-pressed={vista === 'semanal'}
            onClick={() => onSetVista('semanal')}
            title="Vista semanal"
          >
            <CalendarDays size={13} aria-hidden />
          </button>
          <button
            type="button"
            className="mc-toggle-pill-btn"
            aria-pressed={vista === 'compacta'}
            onClick={() => onSetVista('compacta')}
            title="Vista compacta"
          >
            <LayoutList size={13} aria-hidden />
          </button>
          <button
            type="button"
            className="mc-toggle-pill-btn"
            aria-pressed={vista === 'lista'}
            onClick={() => onSetVista('lista')}
            title="Vista lista"
          >
            <Table2 size={13} aria-hidden />
          </button>
        </div>
      </div>
    </div>
  );
}
