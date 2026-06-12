/**
 * pages/PanelPrincipal.tsx
 * Dashboard del dueño de plataforma: listar orgs, crear y entrar a una.
 */

import { Building2, LayoutGrid, Plus, Trash2, RotateCcw, Clock } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import {
  cambiarAOrganizacion,
  refrescarOrgs,
  type CrearOrgResult,
} from '@/api/organizacion';
import { getOrgsDelUsuario } from '@/api/workspace';
import { PageHeader } from '@/components/layout/PageHeader';
import { useEsPlataformaOwner } from '@/hooks/useEsPlataformaOwner';
import { ModalGestionarModulos } from '@/components/panel/ModalGestionarModulos';
import { ModalConfirmarDesactivarOrg } from '@/components/panel/ModalConfirmarDesactivarOrg';
import { ModalCrearOrganizacion } from '@/components/organizacion/ModalCrearOrganizacion';
import { OrgAvatar } from '@/components/organizacion/OrgAvatar';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { APP_PAGE_CLASS } from '@/lib/appLayout';
import { useWorkspaceStore, type Organizacion } from '@/store/workspaceStore';
import { useOrgsDesactivadas, useReactivarOrg } from '@/hooks/useOrgsDesactivadas';

function diasRestantes(purga_en: string): number {
  const ms = new Date(purga_en).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / 86_400_000));
}

function mensajeError(err: unknown): string {
  if (err instanceof Error && err.message.trim()) return err.message;
  const msg = (err as { message?: string })?.message;
  if (typeof msg === 'string' && msg.trim()) return msg;
  return 'No se pudo completar la acción.';
}

export function PanelPrincipal() {
  const navigate = useNavigate();
  const orgs = useWorkspaceStore((s) => s.orgs);
  const setOrgs = useWorkspaceStore((s) => s.setOrgs);
  const { data: esOwner } = useEsPlataformaOwner();
  const mostrarAccionesOwner = esOwner === true;

  const [cargando, setCargando] = useState(false);
  const [errorCarga, setErrorCarga] = useState(false);
  const [intentosCarga, setIntentosCarga] = useState(0);
  const [entrandoId, setEntrandoId] = useState<string | null>(null);
  const [modalCrearOpen, setModalCrearOpen] = useState(false);
  const [orgModulos, setOrgModulos] = useState<Organizacion | null>(null);
  const [modalModulosOpen, setModalModulosOpen] = useState(false);
  const [orgADesactivar, setOrgADesactivar] = useState<Organizacion | null>(null);
  const [modalDesactivarOpen, setModalDesactivarOpen] = useState(false);

  const { data: orgsDesactivadas = [] } = useOrgsDesactivadas(mostrarAccionesOwner);
  const { mutate: reactivar, isPending: reactivando } = useReactivarOrg();

  useEffect(() => {
    if (orgs.length > 0) return;

    let cancelled = false;
    setCargando(true);
    setErrorCarga(false);

    void (async () => {
      try {
        const lista = await getOrgsDelUsuario();
        if (!cancelled) setOrgs(lista);
      } catch (err) {
        console.error('[PanelPrincipal.loadOrgs]', err);
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
      console.error('[PanelPrincipal.entrar]', err);
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
      console.error('[PanelPrincipal.onCreada]', err);
      toast.error(mensajeError(err));
    }
  }

  const botonCrear = mostrarAccionesOwner ? (
    <Button variant="primary" size="sm" onClick={() => setModalCrearOpen(true)}>
      <Plus size={16} aria-hidden />
      Crear organización
    </Button>
  ) : undefined;

  return (
    <div className={APP_PAGE_CLASS}>
      <PageHeader title="Organizaciones" actions={botonCrear} />

      {cargando ? (
        <p className="m-0 text-[13px] text-[var(--mc-color-text-secondary)]">Cargando…</p>
      ) : errorCarga && orgs.length === 0 ? (
        <div className="flex flex-col items-start gap-3">
          <p className="m-0 text-[13px] text-[var(--mc-color-danger)]" role="alert">
            No se pudieron cargar las organizaciones.
          </p>
          <Button variant="secondary" size="sm" onClick={() => setIntentosCarga((n) => n + 1)}>
            Reintentar
          </Button>
        </div>
      ) : orgs.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="Aún no tienes organizaciones"
          desc="Crea la primera para empezar a operar."
          cta={botonCrear}
        />
      ) : (
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {orgs.map((org) => {
            const busy = entrandoId === org.id;
            return (
              <li key={org.id} className="mc-card flex items-center gap-4">
                <OrgAvatar nombre={org.nombre} size={36} />
                <div className="min-w-0 flex-1">
                  <p className="m-0 truncate text-[14px] font-medium text-[var(--mc-color-text-primary)]">
                    {org.nombre}
                  </p>
                  <p className="m-0 truncate text-[12px] text-[var(--mc-color-text-secondary)]">
                    {org.slug}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  {mostrarAccionesOwner ? (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={Boolean(entrandoId)}
                        onClick={() => abrirModulos(org)}
                      >
                        <LayoutGrid size={16} aria-hidden />
                        Módulos
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={Boolean(entrandoId)}
                        onClick={() => abrirDesactivar(org)}
                        aria-label={`Mover ${org.nombre} a la papelera`}
                      >
                        <Trash2 size={16} aria-hidden className="text-[var(--mc-color-danger)]" />
                      </Button>
                    </>
                  ) : null}
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={Boolean(entrandoId)}
                    loading={busy}
                    onClick={() => void handleEntrar(org.id)}
                  >
                    Entrar
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {mostrarAccionesOwner && orgsDesactivadas.length > 0 ? (
        <section className="mt-8">
          <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-[var(--mc-color-text-secondary)]">
            Papelera
          </h2>
          <ul className="m-0 flex list-none flex-col gap-3 p-0">
            {orgsDesactivadas.map((org) => {
              const dias = diasRestantes(org.purga_en);
              const urgente = dias <= 14;
              return (
                <li key={org.id} className="mc-card flex items-center gap-4 opacity-70">
                  <OrgAvatar nombre={org.nombre} size={36} />
                  <div className="min-w-0 flex-1">
                    <p className="m-0 truncate text-[14px] font-medium text-[var(--mc-color-text-primary)] line-through">
                      {org.nombre}
                    </p>
                    <p
                      className={`m-0 flex items-center gap-1 text-[12px] ${
                        urgente
                          ? 'text-[var(--mc-color-danger)]'
                          : 'text-[var(--mc-color-text-secondary)]'
                      }`}
                    >
                      <Clock size={11} aria-hidden />
                      {dias === 0
                        ? 'Se elimina hoy'
                        : `Se elimina en ${dias} día${dias !== 1 ? 's' : ''}`}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={reactivando}
                    onClick={() => reactivar(org.id)}
                    aria-label={`Reactivar ${org.nombre}`}
                  >
                    <RotateCcw size={14} aria-hidden />
                    Reactivar
                  </Button>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <ModalCrearOrganizacion
        open={modalCrearOpen}
        onClose={() => setModalCrearOpen(false)}
        onCreada={(r) => void handleOrgCreada(r)}
      />

      <ModalGestionarModulos
        open={modalModulosOpen}
        onClose={cerrarModulos}
        org={orgModulos}
      />

      <ModalConfirmarDesactivarOrg
        open={modalDesactivarOpen}
        onClose={cerrarDesactivar}
        org={orgADesactivar}
      />
    </div>
  );
}
