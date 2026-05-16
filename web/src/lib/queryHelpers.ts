import type { QueryClient } from '@tanstack/react-query';

type QueryGroup = 'semana' | 'tablero' | 'tareas-hoy' | 'planificacion' | 'objetivos' | 'bitacora' | 'ot';

const QUERY_KEY_MAP: Record<QueryGroup, { queryKey: unknown[]; exact?: boolean }> = {
  semana:        { queryKey: ['semana'],        exact: false },
  tablero:       { queryKey: ['tablero'],       exact: false },
  'tareas-hoy':  { queryKey: ['tareas-hoy']                  },
  planificacion: { queryKey: ['planificacion']               },
  objetivos:     { queryKey: ['objetivos'],      exact: false },
  bitacora:      { queryKey: ['bitacora'],       exact: false },
  /** Lista OT en useOrdenesTrabajoPage: queryKey [Q_OT, usuarioId, esJefe] */
  ot:            { queryKey: ['ordenes-trabajo'], exact: false },
};

/**
 * Invalida un grupo de queries relacionadas de forma concurrente.
 */
export async function invalidateRelatedQueries(
  qc: QueryClient,
  groups: QueryGroup[],
): Promise<void> {
  await Promise.all(
    groups.map((g) => qc.invalidateQueries(QUERY_KEY_MAP[g]))
  );
}
