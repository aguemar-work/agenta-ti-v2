import { Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';

type Props = {
  subtitulo: string;
  esJefe: boolean;
  onNuevaOT: () => void;
  onTiposTrabajo?: () => void;
};

export function OTHeader({ subtitulo, esJefe, onNuevaOT, onTiposTrabajo }: Props) {
  return (
    <header className="mc-misemana-header">
      <div className="mc-misemana-header__left">
        <h1 className="mc-misemana-header__title">Órdenes de trabajo</h1>
        <p className="m-0 text-sm text-[var(--mc-color-text-secondary)]">{subtitulo}</p>
      </div>
      <div className="mc-misemana-header__actions">
        {esJefe && onTiposTrabajo && (
          <Button variant="secondary" size="sm" onClick={onTiposTrabajo}>
            <Settings2 size={14} aria-hidden />
            Tipos
          </Button>
        )}
        <Button variant="primary" size="sm" onClick={onNuevaOT}>
          + Nueva OT
        </Button>
      </div>
    </header>
  );
}
