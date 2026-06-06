import { MIN_JUSTIFICACION_CHARS } from '@/lib/constants';

interface Props {
  id?:          string;
  value:        string;
  onChange:     (v: string) => void;
  label?:       string;
  placeholder?: string;
  minChars?:    number;
  disabled?:    boolean;
  autoFocus?:   boolean;
}

export function JustificacionField({
  id,
  value,
  onChange,
  label       = 'Justificación',
  placeholder = 'Describe el motivo…',
  minChars    = MIN_JUSTIFICACION_CHARS,
  disabled    = false,
  autoFocus   = false,
}: Props) {
  const len = value.trim().length;
  const ok  = len >= minChars;

  return (
    <div className="mc-field">
      <label className="mc-field-label" htmlFor={id}>
        <span className="flex justify-between">
          <span>{label}</span>
          <span aria-live="polite" className={`mc-char-count ${ok ? 'mc-char-count-ok' : ''}`}>
            {len}/{minChars}
          </span>
        </span>
      </label>
      <textarea
        id={id}
        className="mc-input mc-input--tall"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        autoFocus={autoFocus}
        aria-invalid={len > 0 && !ok}
      />
    </div>
  );
}
