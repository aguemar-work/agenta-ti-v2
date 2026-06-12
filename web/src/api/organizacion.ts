import { z } from 'zod';

import {
  getModulosDelWorkspace,
  getOrgsDelUsuario,
  getWorkspacesAccesiblesDeOrg,
  guardarPreferenciaWorkspace,
} from '@/api/workspace';
import { getInsforge } from '@/lib/insforge';
import { useWorkspaceStore } from '@/store/workspaceStore';

const CrearOrgResultSchema = z.object({
  organizacion_id: z.string().uuid(),
  workspace_id:    z.string().uuid(),
  modulos:         z.array(z.string()),
});

export type CrearOrgResult = z.infer<typeof CrearOrgResultSchema>;

export interface CrearOrgInput {
  nombre: string;
  slug: string;
  tipo: 'interno' | 'agencia';
  modulos: string[];
}

export async function crearOrganizacion(input: CrearOrgInput): Promise<CrearOrgResult> {
  const { data, error } = await getInsforge().database.rpc('sgtd_crear_organizacion', {
    p_nombre:         input.nombre.trim(),
    p_slug:           input.slug.trim(),
    p_tipo_workspace: input.tipo,
    p_modulos:        input.modulos,
  });
  if (error) throw error;
  const parsed = CrearOrgResultSchema.safeParse(data);
  if (!parsed.success) throw new Error('Respuesta inesperada al crear la organización.');
  return parsed.data;
}

/** Refresca la lista de orgs del store (tras crear una nueva). */
export async function refrescarOrgs(): Promise<void> {
  const orgs = await getOrgsDelUsuario();
  useWorkspaceStore.getState().setOrgs(orgs);
}

/** Cambia el contexto activo a otra organización + su workspace principal, sin recargar la página. */
export async function cambiarAOrganizacion(orgId: string): Promise<void> {
  const store = useWorkspaceStore.getState();
  const org = store.orgs.find((o) => o.id === orgId);
  if (!org) throw new Error('Organización no encontrada.');
  const workspaces = await getWorkspacesAccesiblesDeOrg(orgId);
  const ws = workspaces[0];
  if (!ws) throw new Error('La organización no tiene un espacio accesible.');
  await guardarPreferenciaWorkspace(org.id, ws.id);
  let modulos: string[] = [];
  try {
    modulos = await getModulosDelWorkspace(ws.id);
  } catch {
    modulos = [];
  }
  store.aplicarContextoOperativo(org, ws, ws.rol, modulos);
}
