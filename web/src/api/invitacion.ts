import { z } from 'zod';

import { getInsforge } from '@/lib/insforge';

const InvitacionPendienteSchema = z.object({
  workspace_id:        z.string().uuid(),
  workspace_nombre:    z.string(),
  organizacion_id:     z.string().uuid(),
  organizacion_nombre: z.string(),
  rol:                 z.enum(['jefe', 'miembro']),
  invited_at:          z.string(),
});

export type InvitacionPendiente = z.infer<typeof InvitacionPendienteSchema>;

const InvitarResultSchema = z.object({
  usuario_id:   z.string().uuid(),
  workspace_id: z.string().uuid(),
  rol:          z.enum(['jefe', 'miembro']),
  estado:       z.literal('pendiente'),
});

export type InvitarResult = z.infer<typeof InvitarResultSchema>;

const AceptarResultSchema = z.object({
  workspace_id:    z.string().uuid(),
  organizacion_id: z.string().uuid(),
  estado:          z.literal('aceptada'),
});

export type AceptarInvitacionResult = z.infer<typeof AceptarResultSchema>;

const RechazarResultSchema = z.object({
  workspace_id: z.string().uuid(),
  estado:       z.literal('rechazada'),
});

export type RechazarInvitacionResult = z.infer<typeof RechazarResultSchema>;

export type InvitarAWorkspaceInput = {
  email: string;
  rol: 'jefe' | 'miembro';
  workspace_id: string;
  nombre?: string;
};

/** Invitaciones pendientes del usuario autenticado (joined_at IS NULL). */
export async function fetchInvitacionesPendientes(): Promise<InvitacionPendiente[]> {
  const { data, error } = await getInsforge().database.rpc('sgtd_listar_invitaciones_pendientes');
  if (error) throw error;
  if (!Array.isArray(data)) return [];
  return data.flatMap((row) => {
    const parsed = InvitacionPendienteSchema.safeParse(row);
    return parsed.success ? [parsed.data] : [];
  });
}

/** Acepta una invitación pendiente; setea joined_at y usuario_preferencia. */
export async function aceptarInvitacion(workspaceId: string): Promise<AceptarInvitacionResult> {
  const { data, error } = await getInsforge().database.rpc('sgtd_aceptar_invitacion_workspace', {
    p_workspace_id: workspaceId,
  });
  if (error) throw error;
  const parsed = AceptarResultSchema.safeParse(data);
  if (!parsed.success) throw new Error('Respuesta inesperada al aceptar la invitación.');
  return parsed.data;
}

/** Declina una invitación pendiente (activo=false). */
export async function rechazarInvitacion(workspaceId: string): Promise<RechazarInvitacionResult> {
  const { data, error } = await getInsforge().database.rpc('sgtd_rechazar_invitacion_workspace', {
    p_workspace_id: workspaceId,
  });
  if (error) throw error;
  const parsed = RechazarResultSchema.safeParse(data);
  if (!parsed.success) throw new Error('Respuesta inesperada al rechazar la invitación.');
  return parsed.data;
}

/**
 * Invita a un usuario a un workspace (edge invite-user → sgtd_invitar_a_workspace).
 * Dueño: pasar workspace_id en body. Jefe: header x-workspace-id del store.
 */
export async function invitarAWorkspace(input: InvitarAWorkspaceInput): Promise<InvitarResult> {
  const { data, error } = await getInsforge().functions.invoke<{ data: unknown; error?: string }>(
    'invite-user',
    {
      body: {
        email:        input.email.trim().toLowerCase(),
        rol:          input.rol,
        workspace_id: input.workspace_id,
        nombre:       input.nombre?.trim() || undefined,
      },
    },
  );
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  const parsed = InvitarResultSchema.safeParse(data?.data);
  if (!parsed.success) throw new Error('Respuesta inesperada al invitar usuario.');
  return parsed.data;
}
