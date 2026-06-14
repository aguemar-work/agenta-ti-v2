import { ChevronLeft, ChevronRight } from 'lucide-react';
import { FilterBar } from '@/components/ui/FilterBar';
import { agregarDias, inicioSemanaIso } from '@/lib/semanas';

const MESES = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'] as const;

function formatRangoSemana(lunes: Date, sabado: Date): string {
  const dL = lunes.getDate();
  const mL = MESES[lunes.getMonth()];
  const dS = sabado.getDate();
  const mS = MESES[sabado.getMonth()];
  const year = sabado.getFullYear();
  return lunes.getMonth() === sabado.getMonth()
    ? `${dL} – ${dS} ${mL} ${year}`
    : `${dL} ${mL} – ${dS} ${mS} ${year}`;
}

type UsuarioOption = { id: string; nombre: string };

type Props = {
  lunes: Date;
  sabado: Date;
  onSemanaAnterior: () => void;
  onSemanaSiguiente: () => void;
  onIrHoy: () => void;
  esJefe?: boolean;
  uid?: string;
  usuariosJefe?: UsuarioOption[];
  onSeleccionarUsuario?: (id: string) => void;
};

export function MiSemanaHeader({
  lunes,
  sabado,
  onSemanaAnterior,
  onSemanaSiguiente,
  onIrHoy,
  esJefe = false,
  uid,
  usuariosJefe,
  onSeleccionarUsuario,
}: Props) {
  const muestraSelectorJefe =
    esJefe && Boolean(uid) && Boolean(usuariosJefe?.length) && Boolean(onSeleccionarUsuario);

  return (
    <div className="mc-misemana-hdr__top">
      <h1 className="mc-misemana-hdr__title">Mi semana</h1>

      <div className="mc-misemana-hdr__nav" role="group" aria-label="Navegación de semana">
        <span className="mc-misemana-hdr__fecha" aria-live="polite">
          {formatRangoSemana(lunes, sabado)}
        </span>
        <button
          type="button"
          className="mc-nav-arrow-btn"
          onClick={onSemanaAnterior}
          aria-label="Semana anterior"
        >
          <ChevronLeft size={15} strokeWidth={2} aria-hidden />
        </button>
        <button
          type="button"
          className="mc-nav-arrow-btn"
          onClick={onSemanaSiguiente}
          aria-label="Semana siguiente"
        >
          <ChevronRight size={15} strokeWidth={2} aria-hidden />
        </button>
        <button
          type="button"
          className="mc-misemana-header__hoy"
          onClick={onIrHoy}
        >
          Hoy
        </button>
        {muestraSelectorJefe && (
          <div className="mc-misemana-header__ver-semana">
            <FilterBar.Select
              id="misemana-ver-semana-de"
              label="Ver semana de"
              hideLabel
              value={uid!}
              onChange={onSeleccionarUsuario!}
              options={usuariosJefe!.map((u) => ({ value: u.id, label: u.nombre }))}
              minWidth={140}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export function lunesSemanaActual(): Date {
  return inicioSemanaIso(new Date());
}

export function navegarSemanaAnterior(lunes: Date): Date {
  return agregarDias(lunes, -7);
}

export function navegarSemanaSiguiente(lunes: Date): Date {
  return agregarDias(lunes, 7);
}
