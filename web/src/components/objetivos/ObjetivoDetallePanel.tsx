import { ObjetivoDetalleContenido } from '@/components/objetivos/ObjetivoDetalleContenido';
import { ObjetivoBadgeRiesgo, ObjetivoBarraProgreso } from '@/components/objetivos/ObjetivoProgreso';
import type { ObjetivoConProgreso } from '@/api/objetivosMetricas';
import type { Tarea } from '@/types';

type OtRow = { id: string; numero: string; estado: string; descripcion: string };

type Props = {
  open: boolean;
  objetivo: ObjetivoConProgreso | null;
  tareasVinc: Tarea[];
  loadTareas: boolean;
  otsVinc: OtRow[];
  loadOTs: boolean;
  esJefe: boolean;
  puedeCompletar: boolean;
  puedeEliminar: boolean;
  onClose: () => void;
  onCompletar: () => void;
  onEliminar: () => void;
  onAnadirTarea: () => void;
  onTareaClick: (t: Tarea) => void;
};

/** Vista móvil a pantalla completa al seleccionar un objetivo. */
export function ObjetivoDetallePanel({ open, objetivo, onClose, ...content }: Props) {
  if (!open || !objetivo) return null;

  return (
    <div className="mc-objetivo-detalle-mobile" role="dialog" aria-modal="true" aria-label="Detalle del objetivo">
      <header className="mc-objetivo-detalle-mobile__header">
        <button type="button" className="mc-btn-ghost mc-btn-sm" onClick={onClose}>
          ← Volver
        </button>
        <h2 className="mc-objetivo-detalle-mobile__title">Objetivo</h2>
      </header>
      <div className="mc-objetivo-detalle-mobile__body">
        <ObjetivoDetalleContenido
          objetivo={objetivo}
          BarraProgreso={ObjetivoBarraProgreso}
          BadgeRiesgo={ObjetivoBadgeRiesgo}
          {...content}
        />
      </div>
    </div>
  );
}

