import type { QueryClient } from '@tanstack/react-query';

import { qkWsId } from '@/lib/queryKeys';
import { getWorkspaceId } from '@/store/workspaceStore';

type QueryGroup = 'semana' | 'tablero' | 'tareas-hoy' | 'planificacion' | 'objetivos' | 'bitacora' | 'ot';

const QUERY_KEY_MAP: Record<QueryGroup, { root: string; suffix?: unknown[]; exact?: boolean }> = {
  semana:        { root: 'semana',        exact: false },
  tablero:       { root: 'tablero',       exact: false },
  'tareas-hoy':  { root: 'tareas-hoy' },
  planificacion: { root: 'planificacion' },
  objetivos:     { root: 'objetivos',     exact: false },
  bitacora:      { root: 'bitacora',      exact: false },
  /** Lista OT en useOrdenesTrabajoPage: queryKey [Q_OT, wsId, usuarioId, esJefe] */
  ot:            { root: 'ordenes-trabajo', exact: false },
};

/**
 * Invalida un grupo de queries relacionadas de forma concurrente (scope workspace activo).
 */
export async function invalidateRelatedQueries(
  qc: QueryClient,
  groups: QueryGroup[],
): Promise<void> {
  const wsId = getWorkspaceId();
  await Promise.all(
    groups.map((g) => {
      const { root, suffix = [], exact } = QUERY_KEY_MAP[g];
      const filters = {
        queryKey: qkWsId(wsId, root, ...suffix),
        ...(exact !== undefined ? { exact } : {}),
      };
      return qc.invalidateQueries(filters);
    }),
  );
}
