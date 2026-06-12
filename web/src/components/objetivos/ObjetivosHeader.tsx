import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';

type Props = {
  esJefe: boolean;
  onNuevoObjetivo: () => void;
};

export function ObjetivosHeader({ esJefe, onNuevoObjetivo }: Props) {
  return (
    <PageHeader
      title="Objetivos"
      subtitle="Progreso estratégico del equipo"
      actions={
        esJefe ? (
          <Button variant="primary" size="sm" onClick={onNuevoObjetivo}>
            + Nuevo objetivo
          </Button>
        ) : undefined
      }
    />
  );
}
