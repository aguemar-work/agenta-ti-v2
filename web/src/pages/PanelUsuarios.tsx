/**
 * pages/PanelUsuarios.tsx
 * Gestión de usuarios del panel del dueño: invitar, listar, asignar y eliminar.
 */

import { Trash2, UserPlus, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { getOrgsDelUsuario } from '@/api/workspace';
import type { UsuarioPlataforma } from '@/api/plataforma';
import { PageHeader } from '@/components/layout/PageHeader';
import { ModalAsignarUsuario } from '@/components/panel/ModalAsignarUsuario';
import { ModalInvitarUsuario } from '@/components/panel/ModalInvitarUsuario';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ModalConfirmar } from '@/components/ui/ModalConfirmar';
import { useEsPlataformaOwner } from '@/hooks/useEsPlataformaOwner';
import { useEliminarUsuario, useUsuariosPlataforma } from '@/hooks/useUsuariosPlataforma';
import { APP_PAGE_CLASS } from '@/lib/appLayout';
import { useAuthStore } from '@/store/authStore';
import { useWorkspaceStore } from '@/store/workspaceStore';

function OrgChip({ nombre, rol }: { nombre: string; rol: string }) {
  return (
    <span className="mc-badge mc-badge-neutral">
      {nombre} · {rol}
    </span>
  );
}

export function PanelUsuarios() {
  const orgs    = useWorkspaceStore((s) => s.orgs);
  const setOrgs = useWorkspaceStore((s) => s.setOrgs);
  const usuarioActualId = useAuthStore((s) => s.usuario?.id);

  const { data: esOwner } = useEsPlataformaOwner();
  const { data: usuarios, isLoading, isError, error } = useUsuariosPlataforma();

  const [cargandoOrgs, setCargandoOrgs] = useState(false);

  const [modalInvitar, setModalInvitar]         = useState(false);
  const [usuarioAsignar, setUsuarioAsignar]     = useState<UsuarioPlataforma | null>(null);
  const [modalAsignar, setModalAsignar]         = useState(false);
  const [usuarioEliminar, setUsuarioEliminar]   = useState<UsuarioPlataforma | null>(null);
  const [modalEliminar, setModalEliminar]       = useState(false);

  const { mutate: eliminar, isPending: eliminando } = useEliminarUsuario(() => {
    toast.success(`Usuario ${usuarioEliminar?.nombre ?? ''} eliminado.`);
    setModalEliminar(false);
    setUsuarioEliminar(null);
  });

  useEffect(() => {
    if (orgs.length > 0) return;

    let cancelled = false;
    setCargandoOrgs(true);

    void (async () => {
      try {
        const lista = await getOrgsDelUsuario();
        if (!cancelled) setOrgs(lista);
      } catch (err) {
        console.error('[PanelUsuarios.loadOrgs]', err);
        if (!cancelled) toast.error('No se pudieron cargar las organizaciones.');
      } finally {
        if (!cancelled) setCargandoOrgs(false);
      }
    })();

    return () => { cancelled = true; };
  }, [orgs.length, setOrgs]);

  useEffect(() => {
    if (isError && error) console.error('[PanelUsuarios.usuarios]', error);
  }, [isError, error]);

  function abrirAsignar(usuario: UsuarioPlataforma) {
    if (!esOwner) return;
    setUsuarioAsignar(usuario);
    setModalAsignar(true);
  }

  function abrirEliminar(usuario: UsuarioPlataforma) {
    if (!esOwner) return;
    setUsuarioEliminar(usuario);
    setModalEliminar(true);
  }

  function confirmarEliminar() {
    if (!usuarioEliminar) return;
    eliminar(usuarioEliminar.usuario_id, {
      onError: (err) => {
        console.error('[PanelUsuarios.eliminar]', err);
        const msg = (err as { message?: string })?.message ?? 'No se pudo eliminar el usuario.';
        toast.error(msg);
      },
    });
  }

  const lista = usuarios ?? [];

  return (
    <div className={APP_PAGE_CLASS}>
      <PageHeader
        title="Usuarios"
        detail="Usuarios registrados en la plataforma y sus organizaciones."
        actions={
          esOwner ? (
            <Button variant="primary" size="sm" onClick={() => setModalInvitar(true)}>
              <UserPlus size={16} aria-hidden />
              Invitar usuario
            </Button>
          ) : null
        }
      />

      {isLoading ? (
        <p className="m-0 text-[13px] text-[var(--mc-color-text-secondary)]">Cargando usuarios…</p>
      ) : isError ? (
        <p className="m-0 text-[13px] text-[var(--mc-color-danger)]" role="alert">
          No se pudieron cargar los usuarios.
        </p>
      ) : lista.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No hay usuarios"
          desc="Invita al primer usuario con el botón de arriba."
        />
      ) : (
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {lista.map((usuario) => (
            <li key={usuario.usuario_id} className="mc-card flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="flex min-w-0 flex-1 items-start gap-3">
                <Avatar nombre={usuario.nombre} size="md" />
                <div className="min-w-0 flex-1">
                  <p className="m-0 truncate text-[14px] font-medium text-[var(--mc-color-text-primary)]">
                    {usuario.nombre}
                  </p>
                  <p className="m-0 truncate text-[12px] text-[var(--mc-color-text-secondary)]">
                    {usuario.email}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {usuario.orgs.length === 0 ? (
                      <span className="text-[12px] text-[var(--mc-color-text-secondary)]">
                        Sin organización
                      </span>
                    ) : (
                      usuario.orgs.map((org) => (
                        <OrgChip
                          key={`${org.organizacion_id}-${org.workspace_id}`}
                          nombre={org.organizacion_nombre}
                          rol={org.rol}
                        />
                      ))
                    )}
                  </div>
                </div>
              </div>

              {esOwner ? (
                <div className="flex shrink-0 gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => abrirAsignar(usuario)}
                    disabled={cargandoOrgs && orgs.length === 0}
                  >
                    <UserPlus size={16} aria-hidden />
                    Asignar
                  </Button>
                  {usuario.usuario_id !== usuarioActualId ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => abrirEliminar(usuario)}
                      aria-label={`Eliminar a ${usuario.nombre}`}
                    >
                      <Trash2 size={16} aria-hidden />
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <ModalInvitarUsuario
        open={modalInvitar}
        onClose={() => setModalInvitar(false)}
      />

      <ModalAsignarUsuario
        open={modalAsignar}
        onClose={() => { setModalAsignar(false); setUsuarioAsignar(null); }}
        usuario={usuarioAsignar}
        orgs={orgs}
      />

      <ModalConfirmar
        open={modalEliminar}
        titulo="Eliminar usuario"
        mensaje={`¿Eliminar a ${usuarioEliminar?.nombre ?? 'este usuario'} (${usuarioEliminar?.email ?? ''})? Se revocará su acceso y se borrarán sus datos de la plataforma. Esta acción no se puede deshacer.`}
        labelConfirmar="Eliminar"
        variantConfirmar="danger"
        cargando={eliminando}
        analyticsId="modal-eliminar-usuario"
        onConfirmar={confirmarEliminar}
        onCancelar={() => { setModalEliminar(false); setUsuarioEliminar(null); }}
      />
    </div>
  );
}
