import { X } from 'lucide-react';

import { ObjetivoDetalleContenido } from '@/components/objetivos/ObjetivoDetalleContenido';
import { ObjetivoBadgeRiesgo, ObjetivoBarraProgreso } from '@/components/objetivos/ObjetivoProgreso';
import type { ObjetivoConProgreso } from '@/api/objetivosMetricas';
import type { Tarea } from '@/types';

type OtRow = { id: string; numero: string; estado: string; descripcion: string };

type Props = {
  objetivo: ObjetivoConProgreso;
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

export function ObjetivoDetalleSidebar(props: Props) {
  const { objetivo, onClose, ...content } = props;

  return (
    <aside className="mc-ot-sidebar" role="complementary" aria-label="Detalle del objetivo">
      <header className="mc-ot-sidebar__header">
        <div className="min-w-0 flex-1">
          <p className="mc-ot-sidebar__numero">Objetivo</p>
          <p className="mc-ot-sidebar__titulo">{objetivo.titulo}</p>
        </div>
        <button type="button" className="mc-modal-close" onClick={onClose} aria-label="Cerrar panel">
          <X size={16} aria-hidden />
        </button>
      </header>
      <div className="mc-ot-sidebar__body">
        <ObjetivoDetalleContenido
          objetivo={objetivo}
          BarraProgreso={ObjetivoBarraProgreso}
          BadgeRiesgo={ObjetivoBadgeRiesgo}
          {...content}
        />
      </div>
    </aside>
  );
}
