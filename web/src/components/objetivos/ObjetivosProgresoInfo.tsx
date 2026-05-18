import { Info } from 'lucide-react';
import { FORMULA_PROGRESO_OBJETIVO } from '@/lib/objetivoProgreso';

/** Icono ⓘ junto al encabezado «Progreso» con tooltip de la fórmula. */
export function ObjetivosProgresoInfo() {
  return (
    <span className="mc-objetivos-progreso-info">
      <span>Progreso</span>
      <button
        type="button"
        className="mc-objetivos-progreso-info__btn"
        aria-label="Cómo se calcula el progreso"
        title={FORMULA_PROGRESO_OBJETIVO}
      >
        <Info size={12} aria-hidden />
      </button>
    </span>
  );
}
