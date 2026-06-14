import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import { getAreas, Q_AREAS } from '@/api/areas';
import { getClientes, Q_CLIENTES } from '@/api/clientes';
import { getProyectos, Q_PROYECTOS } from '@/api/proyectos';
import { useWorkspaceId } from '@/hooks/useWorkspaceId';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { qkWsId } from '@/lib/queryKeys';

/**
 * Catálogos opcionales de Mi Semana: clientes, proyectos y áreas.
 * Solo se cargan si el workspace tiene el módulo habilitado.
 */
export function useMiSemanaCatalogos() {
  const workspaceId = useWorkspaceId();
  const tieneModulo = useWorkspaceStore((s) => s.tieneModulo);

  const moduloClientes  = tieneModulo('clientes');
  const moduloProyectos = tieneModulo('proyectos');
  const moduloAreas     = tieneModulo('areas');

  const { data: clientesCatalogo = [] } = useQuery({
    queryKey: qkWsId(workspaceId, Q_CLIENTES),
    enabled: Boolean(workspaceId) && moduloClientes,
    queryFn: getClientes,
  });

  const { data: proyectosCatalogo = [] } = useQuery({
    queryKey: qkWsId(workspaceId, Q_PROYECTOS),
    enabled: Boolean(workspaceId) && moduloProyectos,
    queryFn: getProyectos,
  });

  const { data: areasCatalogo = [] } = useQuery({
    queryKey: qkWsId(workspaceId, Q_AREAS),
    enabled: Boolean(workspaceId) && moduloAreas,
    queryFn: getAreas,
  });

  const proyectosActivos = useMemo(
    () => proyectosCatalogo.filter((p) => p.estado === 'activo'),
    [proyectosCatalogo],
  );

  const areasPorId = useMemo(() => {
    const m = new Map<string, string>();
    for (const a of areasCatalogo) m.set(a.id, a.nombre);
    return m;
  }, [areasCatalogo]);

  return {
    clientesCatalogo,
    proyectosActivos,
    areasCatalogo,
    areasPorId,
    moduloClientes,
    moduloProyectos,
    moduloAreas,
  };
}
