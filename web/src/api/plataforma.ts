import { z } from 'zod';

import { getInsforge } from '@/lib/insforge';
import { queryClient } from '@/lib/queryClient';
import { useAuthStore } from '@/store/authStore';

const ES_OWNER_STALE_MS = 5 * 60_000;

/** Query key compartida con useEsPlataformaOwner (bootstrap + hook). */
export function plataformaEsOwnerQueryKey(usuarioId: string | undefined) {
  return ['plataforma', 'esOwner', usuarioId] as const;
}

const BoolSchema = z.boolean();

const OrgMembresiaSchema = z.object({
  organizacion_id:     z.string().uuid(),
  organizacion_nombre: z.string(),
  workspace_id:        z.string().uuid(),
  rol:                 z.enum(['jefe', 'miembro']),
});

const UsuarioPlataformaSchema = z.object({
  usuario_id: z.string().uuid(),
  nombre:     z.string(),
  email:      z.string(),
  activo:     z.boolean(),
  created_at: z.string(),
  orgs:       z.array(OrgMembresiaSchema),
});

export type OrgMembresiaUsuario = z.infer<typeof OrgMembresiaSchema>;
export type UsuarioPlataforma = z.infer<typeof UsuarioPlataformaSchema>;

const AsignarResultSchema = z.object({
  usuario_id:      z.string().uuid(),
  organizacion_id: z.string().uuid(),
  workspace_id:    z.string().uuid(),
  rol:             z.enum(['jefe', 'miembro']),
});

export type AsignarUsuarioResult = z.infer<typeof AsignarResultSchema>;

const ModuloEstadoSchema = z.object({
  modulo: z.string(),
  activo: z.boolean(),
});

export type ModuloEstado = z.infer<typeof ModuloEstadoSchema>;

const SetModuloResultSchema = z.object({
  organizacion_id: z.string().uuid(),
  workspace_id:    z.string().uuid(),
  modulo:          z.string(),
  activo:          z.boolean(),
});

export type SetModuloResult = z.infer<typeof SetModuloResultSchema>;

function normalizarOrgs(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw) as unknown;
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function parseUsuarioPlataforma(row: unknown): UsuarioPlataforma | null {
  if (!row || typeof row !== 'object') return null;
  const record = row as Record<string, unknown>;
  const normalizado = {
    ...record,
    orgs: normalizarOrgs(record.orgs),
  };
  const parsed = UsuarioPlataformaSchema.safeParse(normalizado);
  return parsed.success ? parsed.data : null;
}

/** true si el usuario actual puede crear organizaciones (dueño de plataforma). */
export async function fetchEsPlataformaOwner(): Promise<boolean> {
  const { data, error } = await getInsforge().database.rpc('sgtd_es_plataforma_owner');
  if (error) throw error;
  const parsed = BoolSchema.safeParse(data);
  return parsed.success ? parsed.data : false;
}

/**
 * Misma RPC vía TanStack Query — deduplica llamadas en bootstrap, workspace y hook.
 * Sin usuario en sesión devuelve false (no lanza).
 */
export async function fetchEsPlataformaOwnerCached(): Promise<boolean> {
  const usuarioId = useAuthStore.getState().usuario?.id;
  if (!usuarioId) return false;
  return queryClient.fetchQuery({
    queryKey: plataformaEsOwnerQueryKey(usuarioId),
    queryFn: fetchEsPlataformaOwner,
    staleTime: ES_OWNER_STALE_MS,
  });
}

/** Lista todos los usuarios activos del sistema con sus orgs (solo dueño). */
export async function fetchUsuariosPlataforma(): Promise<UsuarioPlataforma[]> {
  const { data, error } = await getInsforge().database.rpc('sgtd_listar_usuarios_plataforma');
  if (error) throw error;
  if (!Array.isArray(data)) return [];
  return data.flatMap((row) => {
    const parsed = parseUsuarioPlataforma(row);
    return parsed ? [parsed] : [];
  });
}

/** Asigna un usuario a una org con rol operativo jefe/miembro (solo dueño). */
export async function asignarUsuarioAOrg(
  usuarioId: string,
  orgId: string,
  rol: 'jefe' | 'miembro',
): Promise<AsignarUsuarioResult> {
  const { data, error } = await getInsforge().database.rpc('sgtd_asignar_usuario_a_organizacion', {
    p_usuario_id:      usuarioId,
    p_organizacion_id: orgId,
    p_rol:             rol,
  });
  if (error) throw error;
  const parsed = AsignarResultSchema.safeParse(data);
  if (!parsed.success) throw new Error('Respuesta inesperada al asignar usuario.');
  return parsed.data;
}

/** Estado de todos los módulos del catálogo para una org (solo dueño). */
export async function fetchModulosOrg(orgId: string): Promise<ModuloEstado[]> {
  const { data, error } = await getInsforge().database.rpc('sgtd_listar_modulos_organizacion', {
    p_organizacion_id: orgId,
  });
  if (error) throw error;
  if (!Array.isArray(data)) return [];
  return data.flatMap((row) => {
    const parsed = ModuloEstadoSchema.safeParse(row);
    return parsed.success ? [parsed.data] : [];
  });
}

// ---------------------------------------------------------------------------
// Soft-delete de organización (054)
// ---------------------------------------------------------------------------

const OrgDesactivadaSchema = z.object({
  id:             z.string().uuid(),
  nombre:         z.string(),
  slug:           z.string(),
  desactivada_en: z.string(),
  purga_en:       z.string(),
});

export type OrgDesactivada = z.infer<typeof OrgDesactivadaSchema>;

const DesactivarResultSchema = z.object({
  organizacion_id: z.string().uuid(),
  nombre:          z.string(),
  desactivada_en:  z.string(),
  purga_en:        z.string(),
});

const ReactivarResultSchema = z.object({
  organizacion_id: z.string().uuid(),
  nombre:          z.string(),
});

/** Lista orgs en la papelera (soft-deleted). Solo dueño. */
export async function fetchOrgsDesactivadas(): Promise<OrgDesactivada[]> {
  const { data, error } = await getInsforge().database.rpc('sgtd_listar_orgs_desactivadas');
  if (error) throw error;
  if (!Array.isArray(data)) return [];
  return data.flatMap((row) => {
    const parsed = OrgDesactivadaSchema.safeParse(row);
    return parsed.success ? [parsed.data] : [];
  });
}

/** Soft-delete de una org. Solo dueño. */
export async function desactivarOrg(orgId: string): Promise<z.infer<typeof DesactivarResultSchema>> {
  const { data, error } = await getInsforge().database.rpc('sgtd_desactivar_organizacion', {
    p_organizacion_id: orgId,
  });
  if (error) throw error;
  const parsed = DesactivarResultSchema.safeParse(data);
  if (!parsed.success) throw new Error('Respuesta inesperada al desactivar la organización.');
  return parsed.data;
}

/** Cancela soft-delete de una org. Solo dueño. */
export async function reactivarOrg(orgId: string): Promise<z.infer<typeof ReactivarResultSchema>> {
  const { data, error } = await getInsforge().database.rpc('sgtd_reactivar_organizacion', {
    p_organizacion_id: orgId,
  });
  if (error) throw error;
  const parsed = ReactivarResultSchema.safeParse(data);
  if (!parsed.success) throw new Error('Respuesta inesperada al reactivar la organización.');
  return parsed.data;
}

/** Activa/desactiva un módulo de una org (solo dueño). */
export async function setModuloOrg(
  orgId: string,
  modulo: string,
  activo: boolean,
): Promise<SetModuloResult> {
  const { data, error } = await getInsforge().database.rpc('sgtd_set_modulo_organizacion', {
    p_organizacion_id: orgId,
    p_modulo:          modulo,
    p_activo:          activo,
  });
  if (error) throw error;
  const parsed = SetModuloResultSchema.safeParse(data);
  if (!parsed.success) throw new Error('Respuesta inesperada al actualizar el módulo.');
  return parsed.data;
}
