import { z } from 'zod';

import { fetchEsPlataformaOwnerCached } from '@/api/plataforma';
import { getInsforge } from '@/lib/insforge';
import type { Organizacion, WorkspaceConRol } from '@/store/workspaceStore';

const OrganizacionSchema = z.object({
  id:      z.string().uuid(),
  nombre:  z.string(),
  slug:    z.string(),
  activa:  z.boolean(),
});

const WorkspaceSchema = z.object({
  id:              z.string().uuid(),
  organizacion_id: z.string().uuid(),
  nombre:          z.string(),
  tipo:            z.enum(['interno', 'agencia']),
  activo:          z.boolean(),
});

const PreferenciaSchema = z.object({
  ultima_org_id:       z.string().uuid().nullable(),
  ultima_workspace_id: z.string().uuid().nullable(),
});

const RolSchema = z.enum(['jefe', 'miembro']);

const ModuloRowSchema = z.object({ modulo: z.string() });

function parseOrganizaciones(rows: unknown): Organizacion[] {
  if (!Array.isArray(rows)) return [];
  return rows.flatMap((row) => {
    const parsed = OrganizacionSchema.safeParse(row);
    return parsed.success ? [parsed.data] : [];
  });
}

/** PostgREST puede devolver el embed como `workspace` o como objeto en `workspace_id`. */
function extraerWorkspaceEmbebido(row: Record<string, unknown>): unknown {
  const ws = row.workspace ?? row.workspace_id;
  if (ws && typeof ws === 'object' && !Array.isArray(ws)) return ws;
  return null;
}

function parseWorkspacesConRol(rows: unknown, orgId: string): WorkspaceConRol[] {
  if (!Array.isArray(rows)) return [];
  return rows.flatMap((row) => {
    if (!row || typeof row !== 'object') return [];
    const record = row as Record<string, unknown>;
    const rolParsed = RolSchema.safeParse(record.rol);
    const wsParsed = WorkspaceSchema.safeParse(extraerWorkspaceEmbebido(record));
    if (!rolParsed.success || !wsParsed.success) return [];
    const workspace = wsParsed.data;
    if (workspace.organizacion_id !== orgId || !workspace.activo) return [];
    return [{ ...workspace, rol: rolParsed.data }];
  });
}

async function requireUserId(): Promise<string> {
  const { data, error } = await getInsforge().auth.getCurrentUser();
  if (error || !data.user?.id) throw new Error('Sin sesión activa');
  return data.user.id;
}

/** Orgs activas a las que el usuario tiene acceso (RLS). */
export async function getOrgsDelUsuario(): Promise<Organizacion[]> {
  await requireUserId();
  const { data, error } = await getInsforge().database
    .from('organizacion')
    .select('id, nombre, slug, activa')
    .eq('activa', true)
    .order('nombre');
  if (error) throw error;
  return parseOrganizaciones(data);
}

/** Workspaces accesibles del usuario en una org, con rol operativo. */
export async function getWorkspacesDelUsuario(orgId: string): Promise<WorkspaceConRol[]> {
  const userId = await requireUserId();
  const { data, error } = await getInsforge().database
    .from('workspace_member')
    .select('rol, workspace:workspace_id(id, nombre, tipo, organizacion_id, activo)')
    .eq('usuario_id', userId)
    .eq('activo', true)
    .not('joined_at', 'is', null);
  if (error) throw error;
  return parseWorkspacesConRol(data, orgId);
}

/** Workspaces de una org leídos directo de la tabla workspace (para dueño superadmin).
 *  Depende de RLS workspace_select (048): el dueño ve todos; un no-dueño solo los suyos. */
export async function getWorkspacesDeOrg(orgId: string): Promise<WorkspaceConRol[]> {
  const { data, error } = await getInsforge().database
    .from('workspace')
    .select('id, nombre, tipo, organizacion_id, activo')
    .eq('organizacion_id', orgId)
    .eq('activo', true)
    .order('nombre');
  if (error) throw error;
  if (!Array.isArray(data)) return [];
  return data.flatMap((row) => {
    const parsed = WorkspaceSchema.safeParse(row);
    return parsed.success ? [{ ...parsed.data, rol: 'jefe' as const }] : [];
  });
}

/** Workspaces accesibles de una org: por membresía; si no hay y es dueño, todos los de la org. */
export async function getWorkspacesAccesiblesDeOrg(orgId: string): Promise<WorkspaceConRol[]> {
  const propios = await getWorkspacesDelUsuario(orgId);
  if (propios.length > 0) return propios;
  const esOwner = await fetchEsPlataformaOwnerCached();
  if (esOwner) return getWorkspacesDeOrg(orgId);
  return [];
}

/** Preferencia guardada del usuario (null si no existe fila). */
export async function getPreferenciaWorkspace(): Promise<{
  ultima_org_id: string | null;
  ultima_workspace_id: string | null;
} | null> {
  const userId = await requireUserId();
  const { data, error } = await getInsforge().database
    .from('usuario_preferencia')
    .select('ultima_org_id, ultima_workspace_id')
    .eq('usuario_id', userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const parsed = PreferenciaSchema.safeParse(data);
  return parsed.success ? parsed.data : null;
}

/** Claves de módulos activos de un workspace. */
export async function getModulosDelWorkspace(workspaceId: string): Promise<string[]> {
  const { data, error } = await getInsforge().database
    .from('workspace_modulo')
    .select('modulo')
    .eq('workspace_id', workspaceId)
    .eq('activo', true);
  if (error) throw error;
  if (!Array.isArray(data)) return [];
  return data.flatMap((row) => {
    const parsed = ModuloRowSchema.safeParse(row);
    return parsed.success ? [parsed.data.modulo] : [];
  });
}

/** Upsert de último contexto org + workspace. */
export async function guardarPreferenciaWorkspace(
  orgId: string,
  workspaceId: string,
): Promise<void> {
  const userId = await requireUserId();
  const { error } = await getInsforge().database
    .from('usuario_preferencia')
    .upsert([{
      usuario_id:          userId,
      ultima_org_id:       orgId,
      ultima_workspace_id: workspaceId,
      updated_at:          new Date().toISOString(),
    }]);
  if (error) throw error;
}
