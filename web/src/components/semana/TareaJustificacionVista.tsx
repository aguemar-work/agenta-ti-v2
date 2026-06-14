import { JustificacionField } from '@/components/ui/JustificacionField';
import { MIN_JUSTIFICACION_CHARS } from '@/lib/constants';

type Props = {
  hintId:      string;
  descripcion: string;
  label:       string;
  placeholder: string;
  value:       string;
  onChange:    (v: string) => void;
  disabled:    boolean;
};

export function TareaJustificacionVista({ hintId, descripcion, label, placeholder, value, onChange, disabled }: Props) {
  return (
    <div className="flex flex-col gap-4">
      <p id={hintId} className="text-sm text-[var(--mc-color-text-secondary)]">
        {descripcion}{' '}
        Mínimo {MIN_JUSTIFICACION_CHARS} caracteres.
      </p>
      <JustificacionField
        label={label}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        autoFocus
      />
    </div>
  );
}
