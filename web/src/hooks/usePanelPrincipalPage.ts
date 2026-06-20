/**
 * hooks/usePanelPrincipalPage.ts
 * Orquestador de la vista Panel Principal (dashboard del dueño de plataforma).
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { cambiarAOrganizacion, refrescarOrgs, type CrearOrgResult } from '@/api/organizacion';
import { getOrgsDelUsuario } from '@/api/workspace';
import { useEsPlataformaOwner } from '@/hooks/useEsPlataformaOwner';
import { useOrgsDesactivadas, useReactivarOrg } from '@/hooks/useOrgsDesactivadas';
import { useWorkspaceStore, type Organizacion } from '@/store/workspaceStore';

function mensajeError(err: unknown): string {
  if (err instanceof Error && err.message.trim()) return err.message;
  const msg = (err as { message?: string })?.message;
  if (typeof msg === 'string' && msg.trim()) return msg;
  return 'No se pudo completar la acción.';
}

export function usePanelPrincipalPage() {
  const navigate = useNavigate();
  const orgs = useWorkspaceStore((s) => s.orgs);
  const setOrgs = useWorkspaceStore((s) => s.setOrgs);
  const { data: esOwner } = useEsPlataformaOwner();
  const mostrarAccionesOwner = esOwner === true;

  const [cargando,           setCargando]           = useState(false);
  const [errorCarga,         setErrorCarga]         = useState(false);
  const [intentosCarga,      setIntentosCarga]      = useState(0);
  const [entrandoId,         setEntrandoId]         = useState<string | null>(null);
  const [modalCrearOpen,     setModalCrearOpen]     = useState(false);
  const [orgModulos,         setOrgModulos]         = useState<Organizacion | null>(null);
  const [modalModulosOpen,   setModalModulosOpen]   = useState(false);
  const [orgADesactivar,     setOrgADesactivar]     = useState<Organizacion | null>(null);
  const [modalDesactivarOpen,setModalDesactivarOpen] = useState(false);

  const { data: orgsDesactivadas = [] } = useOrgsDesactivadas(mostrarAccionesOwner);
  const { mutate: reactivar, isPending: reactivando } = useReactivarOrg();

  useEffect(() => {
    if (orgs.length > 0) return;

    let cancelled = false;
    setCargando(true); // eslint-disable-line react-hooks/set-state-in-effect -- flags síncronos antes del fetch async; cancelled garantiza no-op en desmonte
    setErrorCarga(false);

    void (async () => {
      try {
        const lista = await getOrgsDelUsuario();
        if (!cancelled) setOrgs(lista);
      } catch (err) {
        console.error('[usePanelPrincipalPage.loadOrgs]', err);
        if (!cancelled) {
          setErrorCarga(true);
          toast.error('No se pudieron cargar las organizaciones.');
        }
      } finally {
        if (!cancelled) setCargando(false);
      }
    })();

    return () => { cancelled = true; };
  }, [orgs.length, setOrgs, intentosCarga]);

  async function handleEntrar(orgId: string) {
    if (entrandoId) return;
    setEntrandoId(orgId);
    try {
      await cambiarAOrganizacion(orgId);
      navigate('/semana');
    } catch (err) {
      console.error('[usePanelPrincipalPage.entrar]', err);
      toast.error(mensajeError(err));
    } finally {
      setEntrandoId(null);
    }
  }

  function abrirModulos(org: Organizacion) {
    if (!mostrarAccionesOwner) return;
    setOrgModulos(org);
    setModalModulosOpen(true);
  }

  function cerrarModulos() {
    setModalModulosOpen(false);
    setOrgModulos(null);
  }

  function abrirDesactivar(org: Organizacion) {
    if (!mostrarAccionesOwner) return;
    setOrgADesactivar(org);
    setModalDesactivarOpen(true);
  }

  function cerrarDesactivar() {
    setModalDesactivarOpen(false);
    setOrgADesactivar(null);
  }

  async function handleOrgCreada(result: CrearOrgResult) {
    try {
      await refrescarOrgs();
      await cambiarAOrganizacion(result.organizacion_id);
      navigate('/semana');
    } catch (err) {
      console.error('[usePanelPrincipalPage.onCreada]', err);
      toast.error(mensajeError(err));
    }
  }

  return {
    orgs,
    orgsDesactivadas,
    cargando,
    errorCarga,
    entrandoId,
    mostrarAccionesOwner,
    reactivando,
    reactivar,
    modalCrearOpen,
    setModalCrearOpen,
    orgModulos,
    modalModulosOpen,
    orgADesactivar,
    modalDesactivarOpen,
    handleEntrar,
    abrirModulos,
    cerrarModulos,
    abrirDesactivar,
    cerrarDesactivar,
    handleOrgCreada,
    reintentar: () => setIntentosCarga((n) => n + 1),
  };
}
