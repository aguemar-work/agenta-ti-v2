/**
 * src/api/__tests__/invitacion.api.test.ts
 *
 * Tests de integración de api/invitacion.ts — flujo de invitaciones a workspace.
 * Sensible por seguridad: valida que las respuestas de RPC/edge function tengan
 * la forma esperada antes de confiar en ellas, y que el email se normalice antes
 * de invocar la edge function invite-user.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';

const WS_ID  = 'aaaaaaaa-0000-4000-a000-000000000001';
const ORG_ID = 'aaaaaaaa-0000-4000-a000-000000000002';
const USR_ID = 'aaaaaaaa-0000-4000-a000-000000000003';

const { mockRpc, mockInvoke } = vi.hoisted(() => ({
  mockRpc:    vi.fn(),
  mockInvoke: vi.fn(),
}));

vi.mock('@/lib/insforge', () => ({
  getInsforge: () => ({
    database:  { rpc: mockRpc },
    functions: { invoke: mockInvoke },
  }),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// fetchInvitacionesPendientes
// ---------------------------------------------------------------------------

describe('fetchInvitacionesPendientes', () => {
  it('descarta silenciosamente filas que no cumplen el schema', async () => {
    mockRpc.mockResolvedValue({
      data: [
        {
          workspace_id: WS_ID, workspace_nombre: 'WS', organizacion_id: ORG_ID,
          organizacion_nombre: 'Org', rol: 'miembro', invited_at: '2026-01-01T00:00:00Z',
        },
        { workspace_id: 'no-es-uuid', rol: 'rol_invalido' }, // fila corrupta
      ],
      error: null,
    });
    const { fetchInvitacionesPendientes } = await import('@/api/invitacion');

    const result = await fetchInvitacionesPendientes();

    expect(result).toHaveLength(1);
    expect(result[0].workspace_id).toBe(WS_ID);
  });

  it('respuesta no-array se trata como sin invitaciones', async () => {
    mockRpc.mockResolvedValue({ data: null, error: null });
    const { fetchInvitacionesPendientes } = await import('@/api/invitacion');

    await expect(fetchInvitacionesPendientes()).resolves.toEqual([]);
  });

  it('propaga el error del RPC', async () => {
    const dbError = new Error('no autorizado');
    mockRpc.mockResolvedValue({ data: null, error: dbError });
    const { fetchInvitacionesPendientes } = await import('@/api/invitacion');

    await expect(fetchInvitacionesPendientes()).rejects.toBe(dbError);
  });
});

// ---------------------------------------------------------------------------
// aceptarInvitacion / rechazarInvitacion
// ---------------------------------------------------------------------------

describe('aceptarInvitacion', () => {
  it('con respuesta válida, la devuelve parseada', async () => {
    mockRpc.mockResolvedValue({
      data: { workspace_id: WS_ID, organizacion_id: ORG_ID, estado: 'aceptada' },
      error: null,
    });
    const { aceptarInvitacion } = await import('@/api/invitacion');

    await expect(aceptarInvitacion(WS_ID)).resolves.toEqual({
      workspace_id: WS_ID, organizacion_id: ORG_ID, estado: 'aceptada',
    });
    expect(mockRpc).toHaveBeenCalledWith('sgtd_aceptar_invitacion_workspace', { p_workspace_id: WS_ID });
  });

  it('con respuesta con forma inesperada, lanza error explícito en vez de devolver basura', async () => {
    mockRpc.mockResolvedValue({ data: { algo: 'distinto' }, error: null });
    const { aceptarInvitacion } = await import('@/api/invitacion');

    await expect(aceptarInvitacion(WS_ID)).rejects.toThrow(/respuesta inesperada/i);
  });
});

describe('rechazarInvitacion', () => {
  it('con respuesta con forma inesperada, lanza error explícito', async () => {
    mockRpc.mockResolvedValue({ data: { estado: 'aceptada' /* no es 'rechazada' */ }, error: null });
    const { rechazarInvitacion } = await import('@/api/invitacion');

    await expect(rechazarInvitacion(WS_ID)).rejects.toThrow(/respuesta inesperada/i);
  });
});

// ---------------------------------------------------------------------------
// invitarAWorkspace — normalización de email + validación de respuesta de la edge function
// ---------------------------------------------------------------------------

describe('invitarAWorkspace', () => {
  it('normaliza el email (trim + lowercase) antes de invocar la edge function', async () => {
    mockInvoke.mockResolvedValue({
      data: { data: { usuario_id: USR_ID, workspace_id: WS_ID, rol: 'miembro', estado: 'pendiente' } },
      error: null,
    });
    const { invitarAWorkspace } = await import('@/api/invitacion');

    await invitarAWorkspace({ email: '  Ana@Nufago.COM  ', rol: 'miembro', workspace_id: WS_ID });

    expect(mockInvoke).toHaveBeenCalledWith('invite-user', {
      body: expect.objectContaining({ email: 'ana@nufago.com' }),
    });
  });

  it('propaga el error de transporte de la edge function', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: new Error('function crashed') });
    const { invitarAWorkspace } = await import('@/api/invitacion');

    await expect(
      invitarAWorkspace({ email: 'ana@nufago.com', rol: 'miembro', workspace_id: WS_ID }),
    ).rejects.toThrow('function crashed');
  });

  it('sin error de transporte pero con error de negocio en el body, lo lanza', async () => {
    mockInvoke.mockResolvedValue({ data: { error: 'El email ya tiene una invitación pendiente' }, error: null });
    const { invitarAWorkspace } = await import('@/api/invitacion');

    await expect(
      invitarAWorkspace({ email: 'ana@nufago.com', rol: 'miembro', workspace_id: WS_ID }),
    ).rejects.toThrow('El email ya tiene una invitación pendiente');
  });

  it('con respuesta de forma inesperada, lanza error explícito en vez de devolver basura', async () => {
    mockInvoke.mockResolvedValue({ data: { data: { algo: 'distinto' } }, error: null });
    const { invitarAWorkspace } = await import('@/api/invitacion');

    await expect(
      invitarAWorkspace({ email: 'ana@nufago.com', rol: 'miembro', workspace_id: WS_ID }),
    ).rejects.toThrow(/respuesta inesperada/i);
  });
});
