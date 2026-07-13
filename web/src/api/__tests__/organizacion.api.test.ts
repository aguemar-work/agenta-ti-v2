/**
 * src/api/__tests__/organizacion.api.test.ts
 *
 * Tests de integración de api/organizacion.ts — creación y cambio de contexto
 * organizacional. cambiarAOrganizacion es la pieza más riesgosa: orquesta 3
 * llamadas a api/workspace.ts y debe degradar con gracia si getModulosDelWorkspace
 * falla (no debe bloquear el cambio de organización por un fallo secundario).
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { useWorkspaceStore } from '@/store/workspaceStore';

const ORG_ID = 'aaaaaaaa-0000-4000-a000-000000000001';
const WS_ID  = 'aaaaaaaa-0000-4000-a000-000000000002';

const mockRpc = vi.fn();
const mockGetWorkspacesAccesiblesDeOrg = vi.fn();
const mockGuardarPreferenciaWorkspace = vi.fn().mockResolvedValue(undefined);
const mockGetModulosDelWorkspace = vi.fn();
const mockGetOrgsDelUsuario = vi.fn();

vi.mock('@/lib/insforge', () => ({
  getInsforge: () => ({ database: { rpc: mockRpc } }),
}));

vi.mock('@/api/workspace', () => ({
  getOrgsDelUsuario:            mockGetOrgsDelUsuario,
  getWorkspacesAccesiblesDeOrg: mockGetWorkspacesAccesiblesDeOrg,
  guardarPreferenciaWorkspace:  mockGuardarPreferenciaWorkspace,
  getModulosDelWorkspace:       mockGetModulosDelWorkspace,
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockGuardarPreferenciaWorkspace.mockResolvedValue(undefined);
  useWorkspaceStore.getState().reset();
});

// ---------------------------------------------------------------------------
// crearOrganizacion
// ---------------------------------------------------------------------------

describe('crearOrganizacion', () => {
  it('recorta nombre y slug antes de invocar el RPC', async () => {
    mockRpc.mockResolvedValue({ data: { organizacion_id: ORG_ID, workspace_id: WS_ID, modulos: ['areas'] }, error: null });
    const { crearOrganizacion } = await import('@/api/organizacion');

    await crearOrganizacion({ nombre: '  Nufago  ', slug: '  nufago  ', modulos: ['areas'] });

    expect(mockRpc).toHaveBeenCalledWith('sgtd_crear_organizacion', {
      p_nombre: 'Nufago', p_slug: 'nufago', p_modulos: ['areas'],
    });
  });

  it('con respuesta de forma inesperada, lanza error explícito', async () => {
    mockRpc.mockResolvedValue({ data: { algo: 'distinto' }, error: null });
    const { crearOrganizacion } = await import('@/api/organizacion');

    await expect(
      crearOrganizacion({ nombre: 'Nufago', slug: 'nufago', modulos: [] }),
    ).rejects.toThrow(/respuesta inesperada/i);
  });
});

// ---------------------------------------------------------------------------
// refrescarOrgs
// ---------------------------------------------------------------------------

describe('refrescarOrgs', () => {
  it('carga las orgs del usuario y las guarda en el store', async () => {
    const orgs = [{ id: ORG_ID, nombre: 'Nufago', slug: 'nufago', activa: true }];
    mockGetOrgsDelUsuario.mockResolvedValue(orgs);
    const { refrescarOrgs } = await import('@/api/organizacion');

    await refrescarOrgs();

    expect(useWorkspaceStore.getState().orgs).toEqual(orgs);
  });
});

// ---------------------------------------------------------------------------
// cambiarAOrganizacion
// ---------------------------------------------------------------------------

describe('cambiarAOrganizacion', () => {
  const ORG = { id: ORG_ID, nombre: 'Nufago', slug: 'nufago', activa: true };
  const WS  = { id: WS_ID, organizacion_id: ORG_ID, nombre: 'WS', activo: true, rol: 'jefe' as const };

  it('org no encontrada en el store, rechaza sin llamar a workspace.ts', async () => {
    useWorkspaceStore.setState({ orgs: [] });
    const { cambiarAOrganizacion } = await import('@/api/organizacion');

    await expect(cambiarAOrganizacion(ORG_ID)).rejects.toThrow('Organización no encontrada');
    expect(mockGetWorkspacesAccesiblesDeOrg).not.toHaveBeenCalled();
  });

  it('sin workspace accesible, rechaza con mensaje explícito', async () => {
    useWorkspaceStore.setState({ orgs: [ORG] });
    mockGetWorkspacesAccesiblesDeOrg.mockResolvedValue([]);
    const { cambiarAOrganizacion } = await import('@/api/organizacion');

    await expect(cambiarAOrganizacion(ORG_ID)).rejects.toThrow('espacio accesible');
  });

  it('caso feliz: aplica org+workspace+módulos al store y guarda la preferencia', async () => {
    useWorkspaceStore.setState({ orgs: [ORG] });
    mockGetWorkspacesAccesiblesDeOrg.mockResolvedValue([WS]);
    mockGetModulosDelWorkspace.mockResolvedValue(['areas', 'clientes']);
    const { cambiarAOrganizacion } = await import('@/api/organizacion');

    await cambiarAOrganizacion(ORG_ID);

    const state = useWorkspaceStore.getState();
    expect(state.orgActiva).toEqual(ORG);
    expect(state.workspaceActivo).toEqual(WS);
    expect(state.rolActivo).toBe('jefe');
    expect(state.modulos).toEqual(['areas', 'clientes']);
    expect(mockGuardarPreferenciaWorkspace).toHaveBeenCalledWith(ORG_ID, WS_ID);
  });

  it('si getModulosDelWorkspace falla, degrada a módulos=[] en vez de bloquear el cambio de org', async () => {
    useWorkspaceStore.setState({ orgs: [ORG] });
    mockGetWorkspacesAccesiblesDeOrg.mockResolvedValue([WS]);
    mockGetModulosDelWorkspace.mockRejectedValue(new Error('timeout'));
    const { cambiarAOrganizacion } = await import('@/api/organizacion');

    await expect(cambiarAOrganizacion(ORG_ID)).resolves.toBeUndefined();

    expect(useWorkspaceStore.getState().modulos).toEqual([]);
    expect(useWorkspaceStore.getState().orgActiva).toEqual(ORG);
  });
});
