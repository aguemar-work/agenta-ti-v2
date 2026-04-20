import { TaskItem } from '@/components/tareas/TaskItem';
import type { Tarea } from '@/types';

type Props = {
  tarea: Tarea;
  canEdit: boolean;
  onReprogramar?: (t: Tarea) => void;
  onCompletar?: (t: Tarea) => void;
};

/** Vista tarjeta HOY — delega en `TaskItem` variante card. */
export function TarjetaTarea({ tarea, canEdit, onReprogramar, onCompletar }: Props) {
  return (
    <TaskItem
      variant="card"
      tarea={tarea}
      readOnly={!canEdit}
      onReprogramar={canEdit ? onReprogramar : undefined}
      onCompletar={canEdit ? onCompletar : undefined}
    />
  );
}
