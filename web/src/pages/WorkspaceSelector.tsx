/**
 * pages/WorkspaceSelector.tsx
 * Pantalla de selección de organización y workspace (solo cuando hay >1 opción).
 */

import { ArrowRight } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import {
  getModulosDelWorkspace,
  getWorkspacesAccesiblesDeOrg,
  guardarPreferenciaWorkspace,
} from '@/api/workspace';
import { AppLogo } from '@/components/brand/AppLogo';
import { Button } from '@/components/ui/Button';
import type { Organizacion, WorkspaceConRol } from '@/store/workspaceStore';
import { useWorkspaceStore } from '@/store/workspaceStore';

function labelTipoWorkspace(tipo: WorkspaceConRol['tipo']): string {
  return tipo === 'agencia' ? 'Agencia' : 'Interno';
}

function badgeTipoClass(tipo: WorkspaceConRol['tipo']): string {
  return tipo === 'agencia' ? 'mc-badge mc-badge-accent' : 'mc-badge mc-badge-neutral';
}

export function WorkspaceSelector() {
  const orgs = useWorkspaceStore((s) => s.orgs);
  const workspacesStore = useWorkspaceStore((s) => s.workspaces);
  const setOrgActiva = useWorkspaceStore((s) => s.setOrgActiva);
  const setWorkspaceActivo = useWorkspaceStore((s) => s.setWorkspaceActivo);
  const setWorkspaces = useWorkspaceStore((s) => s.setWorkspaces);
  const setInicializado = useWorkspaceStore((s) => s.setInicializado);

  const orgUnica = orgs.length === 1;
  const orgInicial = orgUnica ? orgs[0]!.id : (orgs[0]?.id ?? '');

  const [orgId, setOrgId] = useState(orgInicial);
  const [workspaceId, setWorkspaceId] = useState('');
  const [workspaces, setWorkspacesLocal] = useState<WorkspaceConRol[]>(
    orgUnica ? workspacesStore : [],
  );
  const [cargandoWs, setCargandoWs] = useState(false);
  const [confirmando, setConfirmando] = useState(false);

  const orgSeleccionada = useMemo(
    () => orgs.find((o) => o.id === orgId) ?? null,
    [orgs, orgId],
  );

  useEffect(() => {
    if (!orgId) {
      setWorkspacesLocal([]);
      setWorkspaceId('');
      return;
    }

    if (orgUnica && workspacesStore.length > 0) {
      setWorkspacesLocal(workspacesStore);
      setWorkspaceId(workspacesStore[0]?.id ?? '');
      return;
    }

    let cancelled = false;
    setCargandoWs(true);

    void (async () => {
      try {
        const lista = await getWorkspacesAccesiblesDeOrg(orgId);
        if (cancelled) return;
        setWorkspacesLocal(lista);
        setWorkspaces(lista);
        setWorkspaceId(lista[0]?.id ?? '');
      } catch (err) {
        console.error('[WorkspaceSelector]', err);
        toast.error('No se pudieron cargar los espacios de trabajo.');
      } finally {
        if (!cancelled) setCargandoWs(false);
      }
    })();

    return () => { cancelled = true; };
  }, [orgId, orgUnica, setWorkspaces, workspacesStore]);

  const workspaceSeleccionado = workspaces.find((w) => w.id === workspaceId) ?? null;
  const puedeConfirmar = Boolean(orgSeleccionada && workspaceSeleccionado && !cargandoWs);

  async function confirmar() {
    if (!orgSeleccionada || !workspaceSeleccionado) return;
    setConfirmando(true);
    try {
      await guardarPreferenciaWorkspace(orgSeleccionada.id, workspaceSeleccionado.id);
      setOrgActiva(orgSeleccionada);
      setWorkspaceActivo(workspaceSeleccionado, workspaceSeleccionado.rol);
      try {
        const modulos = await getModulosDelWorkspace(workspaceSeleccionado.id);
        useWorkspaceStore.getState().setModulos(modulos);
      } catch (err) {
        console.error('[WorkspaceSelector] módulos', err);
        useWorkspaceStore.getState().setModulos([]);
      }
      setInicializado(true);
    } catch (err) {
      console.error('[WorkspaceSelector.confirmar]', err);
      toast.error('No se pudo guardar tu selección.');
    } finally {
      setConfirmando(false);
    }
  }

  return (
    <div className="mc-auth-page">
      <div className="mc-auth-container">
        <div className="mc-auth-card">
          <header className="mc-auth-card-header">
            <div className="mc-auth-brand">
              <AppLogo height={32} className="max-w-[min(200px,70vw)]" />
            </div>
            <h1 className="mc-auth-title">Selecciona tu espacio</h1>
            <p className="mc-auth-subtitle">
              Elige la organización y el espacio de trabajo con el que operarás.
            </p>
          </header>

          <div className="mc-auth-form">
            {!orgUnica && (
              <div className="mc-field">
                <label className="mc-field-label" htmlFor="ws-org">
                  Organización
                </label>
                <select
                  id="ws-org"
                  className="mc-input"
                  value={orgId}
                  onChange={(e) => setOrgId(e.target.value)}
                >
                  {orgs.map((org: Organizacion) => (
                    <option key={org.id} value={org.id}>
                      {org.nombre}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="mc-field">
              <label className="mc-field-label" htmlFor="ws-space">
                Espacio de trabajo
              </label>
              <select
                id="ws-space"
                className="mc-input"
                value={workspaceId}
                disabled={cargandoWs || workspaces.length === 0}
                onChange={(e) => setWorkspaceId(e.target.value)}
              >
                {workspaces.length === 0 ? (
                  <option value="">
                    {cargandoWs ? 'Cargando…' : 'Sin espacios disponibles'}
                  </option>
                ) : (
                  workspaces.map((ws) => (
                    <option key={ws.id} value={ws.id}>
                      {ws.nombre} ({labelTipoWorkspace(ws.tipo)})
                    </option>
                  ))
                )}
              </select>
              {workspaceSeleccionado && (
                <div className="flex pt-2">
                  <span className={badgeTipoClass(workspaceSeleccionado.tipo)}>
                    {labelTipoWorkspace(workspaceSeleccionado.tipo)}
                  </span>
                </div>
              )}
            </div>

            <Button
              type="button"
              variant="primary"
              fullWidth
              loading={confirmando}
              disabled={!puedeConfirmar || confirmando}
              onClick={() => void confirmar()}
            >
              Entrar
              <ArrowRight size={16} aria-hidden className="ml-1 inline" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
