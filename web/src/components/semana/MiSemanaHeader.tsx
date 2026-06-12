import { ChevronLeft, ChevronRight } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { FilterBar } from '@/components/ui/FilterBar';
import { fechaLocalDdMmYyyy } from '@/lib/fecha';
import { agregarDias, inicioSemanaIso } from '@/lib/semanas';

type UsuarioOption = { id: string; nombre: string };

type Props = {
  lunes: Date;
  sabado: Date;
  onSemanaAnterior: () => void;
  onSemanaSiguiente: () => void;
  onIrHoy: () => void;
  onNuevaTarea: () => void;
  nuevaTareaLabel?: string;
  onNotas: () => void;
  notasOpen: boolean;
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
  onNuevaTarea,
  nuevaTareaLabel = '+ Nueva tarea',
  onNotas,
  notasOpen,
  esJefe = false,
  uid,
  usuariosJefe,
  onSeleccionarUsuario,
}: Props) {
  const muestraSelectorJefe =
    esJefe && Boolean(uid) && Boolean(usuariosJefe?.length) && Boolean(onSeleccionarUsuario);

  return (
    <PageHeader
      title="Mi semana"
      subtitle={`${fechaLocalDdMmYyyy(lunes)} – ${fechaLocalDdMmYyyy(sabado)}`}
      left={
        <div className="mc-misemana-header__nav" role="group" aria-label="Navegación de semana">
          <button type="button" className="mc-nav-arrow-btn" onClick={onSemanaAnterior} aria-label="Semana anterior">
            <ChevronLeft size={18} strokeWidth={2} aria-hidden />
          </button>
          <button type="button" className="mc-misemana-header__hoy" onClick={onIrHoy}>
            Hoy
          </button>
          <button type="button" className="mc-nav-arrow-btn" onClick={onSemanaSiguiente} aria-label="Semana siguiente">
            <ChevronRight size={18} strokeWidth={2} aria-hidden />
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
      }
      actions={
        <>
          <Button variant="primary" size="sm" onClick={onNuevaTarea}>
            {nuevaTareaLabel}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={onNotas}
            aria-expanded={notasOpen}
            aria-controls="mc-misemana-notas-drawer"
          >
            Notas
          </Button>
        </>
      }
    />
  );
}

/** Ir al lunes de la semana que contiene hoy. */
export function lunesSemanaActual(): Date {
  return inicioSemanaIso(new Date());
}

export function navegarSemanaAnterior(lunes: Date): Date {
  return agregarDias(lunes, -7);
}

export function navegarSemanaSiguiente(lunes: Date): Date {
  return agregarDias(lunes, 7);
}
