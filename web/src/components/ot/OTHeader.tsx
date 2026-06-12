import { Settings2 } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';

type Props = {
  subtitulo: string;
  esJefe: boolean;
  onNuevaOT: () => void;
  onTiposTrabajo?: () => void;
};

export function OTHeader({ subtitulo, esJefe, onNuevaOT, onTiposTrabajo }: Props) {
  return (
    <PageHeader
      title="Órdenes de trabajo"
      subtitle={subtitulo}
      actions={
        <>
          {esJefe && onTiposTrabajo && (
            <Button variant="secondary" size="sm" onClick={onTiposTrabajo}>
              <Settings2 size={14} aria-hidden />
              Tipos
            </Button>
          )}
          <Button variant="primary" size="sm" onClick={onNuevaOT}>
            + Nueva OT
          </Button>
        </>
      }
    />
  );
}
