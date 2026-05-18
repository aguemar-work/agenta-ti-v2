import { Button } from '@/components/ui/Button';

type Props = {
  esJefe: boolean;
  onNuevoObjetivo: () => void;
};

export function ObjetivosHeader({ esJefe, onNuevoObjetivo }: Props) {
  return (
    <header className="mc-misemana-header">
      <div className="mc-misemana-header__left">
        <h1 className="mc-misemana-header__title">Objetivos</h1>
        <p className="m-0 text-sm text-[var(--mc-color-text-secondary)]">
          Progreso estratégico del equipo
        </p>
      </div>
      {esJefe && (
        <div className="mc-misemana-header__actions">
          <Button variant="primary" size="sm" onClick={onNuevoObjetivo}>
            + Nuevo objetivo
          </Button>
        </div>
      )}
    </header>
  );
}
