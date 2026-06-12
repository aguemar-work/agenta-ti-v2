/**
 * Menú de cuenta: usuario, cambio de org, crear org, prefs y logout.
 * Se abre desde el avatar del usuario (no desde el chip de org del sidebar).
 */

import { Bell, Check, LayoutDashboard, LogOut, Moon, Plus, Sun } from 'lucide-react';
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import {
  cambiarAOrganizacion,
  refrescarOrgs,
  type CrearOrgResult,
} from '@/api/organizacion';
import { ModalCrearOrganizacion } from '@/components/organizacion/ModalCrearOrganizacion';
import { OrgAvatar } from '@/components/organizacion/OrgAvatar';
import { useEsPlataformaOwner } from '@/hooks/useEsPlataformaOwner';
import { useTheme } from '@/hooks/useTheme';
import { useAuthStore } from '@/store/authStore';
import { useWorkspaceStore } from '@/store/workspaceStore';

const MENU_GAP = 6;
const MENU_MIN_W = 260;

type Coords = {
  top: number;
  left: number;
  placement: 'above' | 'below';
};

type Props = {
  open: boolean;
  onClose: () => void;
  /** Elemento ancla (botón avatar) para posicionar el menú. */
  anchorEl: HTMLElement | null;
  onOpenPrefs: () => void;
  onRequestLogout: () => void;
};

function mensajeError(err: unknown): string {
  if (err instanceof Error && err.message.trim()) return err.message;
  const msg = (err as { message?: string })?.message;
  if (typeof msg === 'string' && msg.trim()) return msg;
  return 'No se pudo completar la acción.';
}

export function OrgMenu({
  open,
  onClose,
  anchorEl,
  onOpenPrefs,
  onRequestLogout,
}: Props) {
  const menuId = useId();
  const navigate = useNavigate();
  const usuario = useAuthStore((s) => s.usuario);
  const orgs = useWorkspaceStore((s) => s.orgs);
  const orgActiva = useWorkspaceStore((s) => s.orgActiva);
  const modoContexto = useWorkspaceStore((s) => s.modoContexto);
  const entrarModoPanel = useWorkspaceStore((s) => s.entrarModoPanel);
  const { data: esOwner, isLoading: cargandoOwner } = useEsPlataformaOwner();
  const { theme, toggleTheme } = useTheme();
  const mostrarAccionesOwner = esOwner === true;

  const [coords, setCoords] = useState<Coords>({ top: 0, left: 0, placement: 'below' });
  const [cambiandoId, setCambiandoId] = useState<string | null>(null);
  const [modalCrearOpen, setModalCrearOpen] = useState(false);

  const calcularPosicion = useCallback(() => {
    if (!anchorEl) return;
    const rect = anchorEl.getBoundingClientRect();
    const menuEstH = 320;
    const spaceBelow = window.innerHeight - rect.bottom;
    const abrirArriba = spaceBelow < menuEstH + MENU_GAP && rect.top > menuEstH;
    const left = Math.max(8, Math.min(rect.right - MENU_MIN_W, window.innerWidth - MENU_MIN_W - 8));
    setCoords({
      top: abrirArriba ? rect.top - MENU_GAP : rect.bottom + MENU_GAP,
      left,
      placement: abrirArriba ? 'above' : 'below',
    });
  }, [anchorEl]);

  useLayoutEffect(() => {
    if (!open || !anchorEl) return;
    calcularPosicion();
    window.addEventListener('resize', calcularPosicion);
    window.addEventListener('scroll', calcularPosicion, true);
    return () => {
      window.removeEventListener('resize', calcularPosicion);
      window.removeEventListener('scroll', calcularPosicion, true);
    };
  }, [open, anchorEl, calcularPosicion]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      const t = e.target as Node;
      if (anchorEl?.contains(t)) return;
      const menu = document.getElementById(menuId);
      if (menu?.contains(t)) return;
      onClose();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, menuId, anchorEl, onClose]);

  function handleIrAPanel() {
    if (modoContexto === 'panel') {
      onClose();
      return;
    }
    entrarModoPanel();
    navigate('/panel');
    onClose();
  }

  async function handleCambiarOrg(orgId: string) {
    if (modoContexto === 'operativo' && orgId === orgActiva?.id) return;
    if (cambiandoId) return;
    setCambiandoId(orgId);
    try {
      await cambiarAOrganizacion(orgId);
      toast.success('Organización cambiada');
      onClose();
    } catch (err) {
      console.error('[OrgMenu.cambiarOrg]', err);
      toast.error(mensajeError(err));
    } finally {
      setCambiandoId(null);
    }
  }

  async function handleOrgCreada(result: CrearOrgResult) {
    try {
      await refrescarOrgs();
      await cambiarAOrganizacion(result.organizacion_id);
      onClose();
    } catch (err) {
      console.error('[OrgMenu.onCreada]', err);
      toast.error(mensajeError(err));
    }
  }

  if (!open || !anchorEl) {
    return (
      <ModalCrearOrganizacion
        open={modalCrearOpen}
        onClose={() => setModalCrearOpen(false)}
        onCreada={(r) => void handleOrgCreada(r)}
      />
    );
  }

  return (
    <>
      {createPortal(
        <div
          id={menuId}
          role="menu"
          aria-label="Cuenta y organización"
          className="mc-dropdown-menu mc-dropdown-menu--portal mc-org-menu"
          style={{
            top: coords.top,
            left: coords.left,
            minWidth: MENU_MIN_W,
            transform: coords.placement === 'above' ? 'translateY(-100%)' : undefined,
            transformOrigin: coords.placement === 'above' ? 'bottom right' : 'top right',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mc-org-menu__header">
            <p className="mc-org-menu__user-name">{usuario?.nombre ?? 'Usuario'}</p>
            {usuario?.email && (
              <p className="mc-org-menu__user-email">{usuario.email}</p>
            )}
          </div>

          {(mostrarAccionesOwner || cargandoOwner) && (
            <>
              <p className="mc-org-menu__section-label">Vista</p>
              <ul className="mc-org-menu__list" role="none">
                {mostrarAccionesOwner ? (
                  <li role="none">
                    <button
                      type="button"
                      role="menuitemradio"
                      aria-checked={modoContexto === 'panel'}
                      className={[
                        'mc-org-menu__org-item',
                        modoContexto === 'panel' ? 'mc-org-menu__org-item--active' : '',
                      ].filter(Boolean).join(' ')}
                      onClick={handleIrAPanel}
                    >
                      <LayoutDashboard size={22} aria-hidden className="shrink-0" />
                      <span className="mc-org-menu__org-name">Principal</span>
                      {modoContexto === 'panel' && (
                        <Check size={16} aria-hidden className="mc-org-menu__check" />
                      )}
                    </button>
                  </li>
                ) : cargandoOwner ? (
                  <li role="none" className="mc-org-menu__org-item" aria-busy="true">
                    <span className="mc-org-menu__org-name text-[var(--mc-color-text-secondary)]">
                      Cargando…
                    </span>
                  </li>
                ) : null}
              </ul>
            </>
          )}

          <p className="mc-org-menu__section-label">Organización</p>
          <ul className="mc-org-menu__list" role="none">
            {orgs.map((org) => {
              const activa =
                modoContexto === 'operativo' && org.id === orgActiva?.id;
              const busy = cambiandoId === org.id;
              const disabled = Boolean(cambiandoId);
              return (
                <li key={org.id} role="none">
                  <button
                    type="button"
                    role="menuitemradio"
                    aria-checked={activa}
                    disabled={disabled}
                    className={[
                      'mc-org-menu__org-item',
                      activa ? 'mc-org-menu__org-item--active' : '',
                    ].filter(Boolean).join(' ')}
                    onClick={() => void handleCambiarOrg(org.id)}
                  >
                    <OrgAvatar nombre={org.nombre} size={22} />
                    <span className="mc-org-menu__org-name">{org.nombre}</span>
                    {activa && (
                      <Check size={16} aria-hidden className="mc-org-menu__check" />
                    )}
                    {busy && (
                      <span className="mc-org-menu__busy" aria-live="polite">
                        …
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>

          {mostrarAccionesOwner && (
            <button
              type="button"
              role="menuitem"
              className="mc-dropdown-item mc-dropdown-item--with-icon"
              disabled={Boolean(cambiandoId)}
              onClick={() => {
                setModalCrearOpen(true);
                onClose();
              }}
            >
              <Plus size={14} aria-hidden className="mc-dropdown-item__icon" />
              <span>Crear organización</span>
            </button>
          )}

          <div className="mc-org-menu__divider" role="separator" />

          <button
            type="button"
            role="menuitem"
            className="mc-dropdown-item mc-dropdown-item--with-icon"
            onClick={() => {
              onClose();
              onOpenPrefs();
            }}
          >
            <Bell size={14} aria-hidden className="mc-dropdown-item__icon" />
            <span>Preferencias de notificaciones</span>
          </button>

          <button
            type="button"
            role="menuitem"
            className="mc-dropdown-item mc-dropdown-item--with-icon"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
          >
            {theme === 'dark'
              ? <Sun size={14} aria-hidden className="mc-dropdown-item__icon" />
              : <Moon size={14} aria-hidden className="mc-dropdown-item__icon" />}
            <span>{theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}</span>
          </button>

          <button
            type="button"
            role="menuitem"
            className="mc-dropdown-item mc-dropdown-item--with-icon mc-dropdown-item--danger"
            onClick={() => {
              onClose();
              onRequestLogout();
            }}
          >
            <LogOut size={14} aria-hidden className="mc-dropdown-item__icon" />
            <span>Cerrar sesión</span>
          </button>
        </div>,
        document.body,
      )}

      <ModalCrearOrganizacion
        open={modalCrearOpen}
        onClose={() => setModalCrearOpen(false)}
        onCreada={(r) => void handleOrgCreada(r)}
      />
    </>
  );
}
