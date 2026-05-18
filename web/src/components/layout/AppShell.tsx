import {
  Bell,
  CalendarDays,
  ClipboardList,
  FileText,
  LogOut,
  MoreHorizontal,
  Target,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';

import { AppBrandIcon } from '@/components/brand/AppLogo';
import { ModalPreferenciasNotificaciones } from '@/components/layout/ModalPreferenciasNotificaciones';
import { OnboardingWelcome } from '@/components/onboarding/OnboardingWelcome';
import { ModalConfirmar } from '@/components/ui/ModalConfirmar';
import { SectionErrorBoundary } from '@/components/ui/SectionErrorBoundary';
import { useRealtimeNotificaciones } from '@/hooks/useRealtimeNotificaciones';
import { useSlaAlertCount } from '@/hooks/useResumenSlaJefe';
import { useSlaDigestToast } from '@/hooks/useSlaDigestToast';
import { getInsforge } from '@/lib/insforge';
import { loadNotificationPrefs, type NotificationPrefs } from '@/lib/notificationPrefs';
import { useAuthStore } from '@/store/authStore';

// ---------------------------------------------------------------------------
// Nav config (grupos + íconos Lucide)
// ---------------------------------------------------------------------------
const NAV_WORKSPACE = [
  { to: '/semana',          label: 'Mi semana',     icon: CalendarDays,  roles: ['jefe', 'miembro'] as const },
  { to: '/objetivos',       label: 'Objetivos',     icon: Target,        roles: ['jefe', 'miembro'] as const },
  { to: '/ordenes-trabajo', label: 'Órdenes',       icon: FileText,      roles: ['jefe', 'miembro'] as const },
] as const;

const NAV_GESTION = [
  { to: '/planificacion', label: 'Planificación', icon: ClipboardList, roles: ['jefe'] as const },
] as const;

const ICON_NAV = { size: 18, strokeWidth: 1.75, 'aria-hidden': true as const };
const ICON_NAV_MOBILE = { size: 20, strokeWidth: 1.75, 'aria-hidden': true as const };

const NAV_ALL = [...NAV_WORKSPACE, ...NAV_GESTION] as const;

/**
 * Barra inferior móvil (máx. 4 ítems + "Más").
 * Miembro (3 rutas): las tres en barra — sin drawer "Más".
 * Jefe (4 rutas): semana, planificación, órdenes y objetivos en barra — sin drawer "Más".
 */
const BOTTOM_NAV_JEFE    = ['/semana', '/planificacion', '/ordenes-trabajo', '/objetivos'] as const;
const BOTTOM_NAV_MIEMBRO = ['/semana', '/ordenes-trabajo', '/objetivos']                    as const;

function getBottomItems(rol: string | undefined): readonly string[] {
  return rol === 'jefe' ? BOTTOM_NAV_JEFE : BOTTOM_NAV_MIEMBRO;
}

function filterNav<T extends { to: string; roles: readonly string[] }>(items: readonly T[], rol: string | undefined): T[] {
  return items.filter((item) => !rol || (item.roles as readonly string[]).includes(rol));
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function getInitials(nombre?: string): string {
  if (!nombre) return '?';
  const parts = nombre.trim().split(' ').filter(Boolean);
  const first = parts[0];
  if (!first) return '?';
  if (parts.length === 1) return first[0]!.toUpperCase();
  const last = parts[parts.length - 1];
  return ((first[0] ?? '') + (last?.[0] ?? '')).toUpperCase() || '?';
}

// ---------------------------------------------------------------------------
// Indicador realtime
// ---------------------------------------------------------------------------
function NavSlaBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  const label = count > 9 ? '9+' : String(count);
  return (
    <span
      className="mc-filter-pill-badge"
      aria-label={`${count} alerta${count !== 1 ? 's' : ''} SLA`}
      style={{ marginLeft: 'auto' }}
    >
      {label}
    </span>
  );
}

function RealtimeIndicator({ conectado }: { conectado: boolean }) {
  return (
    <span
      title={conectado
        ? 'Notificaciones en tiempo real activas'
        : 'Sin conexión en tiempo real — las notificaciones pueden tardar'}
      aria-label={conectado ? 'Notificaciones activas' : 'Sin notificaciones en tiempo real'}
      style={{
        display:      'inline-block',
        width:         8,
        height:        8,
        borderRadius: '50%',
        flexShrink:    0,
        background:    conectado ? 'var(--mc-color-success)' : 'var(--mc-color-border)',
        boxShadow:     conectado ? '0 0 0 2px color-mix(in srgb, var(--mc-color-success) 25%, transparent)' : 'none',
        transition:   'background 0.4s ease, box-shadow 0.4s ease',
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// AppShell
// ---------------------------------------------------------------------------
export function AppShell() {
  const navigate  = useNavigate();
  const usuario   = useAuthStore((s) => s.usuario);
  const clear     = useAuthStore((s) => s.clear);
  const [notifPrefs, setNotifPrefs] = useState<NotificationPrefs | null>(null);
  const { conectado } = useRealtimeNotificaciones(notifPrefs ?? undefined);
  const slaAlertCount = useSlaAlertCount();
  useSlaDigestToast(notifPrefs);
  const [masDrawerOpen, setMasDrawerOpen] = useState(false);
  const [confirmandoLogout, setConfirmandoLogout] = useState(false);
  const [logoutPending, setLogoutPending] = useState(false);
  const [prefsModalOpen, setPrefsModalOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    if (usuario?.id) setNotifPrefs(loadNotificationPrefs(usuario.id));
  }, [usuario?.id]);

  const rol = usuario?.rol;
  const navWorkspace = filterNav(NAV_WORKSPACE, rol);
  const navGestion   = filterNav(NAV_GESTION, rol);
  const visibleNav   = filterNav(NAV_ALL, rol);
  const bottomItems  = getBottomItems(rol);
  const bottomNav    = visibleNav.filter((item) => bottomItems.includes(item.to));
  const masNav       = visibleNav.filter((item) => !bottomItems.includes(item.to));
  const paginaActual = NAV_ALL.find((item) => location.pathname.startsWith(item.to))?.label ?? '';
  const initials     = getInitials(usuario?.nombre);

  async function handleLogout() {
    setLogoutPending(true);
    try {
      await getInsforge().auth.signOut();
      clear();
      navigate('/login', { replace: true });
    } finally {
      setLogoutPending(false);
      setConfirmandoLogout(false);
    }
  }

  return (
    <>
      <div className="mc-app-root">

        {/* ── Sidebar desktop ──────────────────────────────────────────── */}
        <SectionErrorBoundary label="Sidebar">
          <nav
            id="mc-sidebar-nav"
            className="mc-sidebar"
            aria-label="Navegación principal"
          >
            <div className="mc-sidebar-brand">
              <AppBrandIcon size={26} />
              <span className="mc-sidebar-brand-name">Nexora</span>
              <span className="mc-sidebar-brand-spacer" aria-hidden />
              <div className="mc-sidebar-avatar" title={usuario?.nombre ?? 'Usuario'} aria-hidden>
                {initials}
              </div>
            </div>

            <div className="mc-sidebar-scroll">
              <p className="mc-sidebar-section-label">Trabajo</p>
              {navWorkspace.map(({ to, label, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  end
                  className="mc-sidebar-nav-link"
                >
                  <Icon {...ICON_NAV} />
                  <span className="mc-sidebar-nav-label">{label}</span>
                </NavLink>
              ))}

              {navGestion.length > 0 && (
                <>
                  <p className="mc-sidebar-section-label">Gestión</p>
                  {navGestion.map(({ to, label, icon: Icon }) => (
                    <NavLink
                      key={to}
                      to={to}
                      end
                      className="mc-sidebar-nav-link"
                      style={{ display: 'flex', alignItems: 'center', gap: 'var(--mc-space-2)' }}
                    >
                      <Icon {...ICON_NAV} />
                      <span className="mc-sidebar-nav-label">{label}</span>
                      {to === '/planificacion' && <NavSlaBadge count={slaAlertCount} />}
                    </NavLink>
                  ))}
                </>
              )}
            </div>

            <div className="mc-sidebar-footer">
              <RealtimeIndicator conectado={conectado} />
              <button
                type="button"
                className="mc-sidebar-logout"
                onClick={() => setPrefsModalOpen(true)}
                aria-label="Preferencias de notificaciones"
                title="Notificaciones"
              >
                <Bell {...ICON_NAV} />
              </button>
              <button
                type="button"
                className="mc-sidebar-logout"
                onClick={() => setConfirmandoLogout(true)}
                aria-label="Cerrar sesión"
              >
                <LogOut {...ICON_NAV} />
              </button>
            </div>
          </nav>
        </SectionErrorBoundary>

        {/* ── Columna principal ────────────────────────────────────────── */}
        <SectionErrorBoundary label="Contenido Principal">
          <div className="mc-app-column">

            {/* Topbar mobile */}
            <div className="mc-mobile-topbar">
              <AppBrandIcon size={26} />
              {paginaActual && (
                <span className="mc-topbar-page-name">{paginaActual}</span>
              )}
              <RealtimeIndicator conectado={conectado} />
              <button
                type="button"
                className="mc-sidebar-logout"
                onClick={() => setPrefsModalOpen(true)}
                aria-label="Preferencias de notificaciones"
                title="Notificaciones"
              >
                <Bell {...ICON_NAV_MOBILE} />
              </button>
              <button
                type="button"
                className="mc-sidebar-logout"
                onClick={() => setConfirmandoLogout(true)}
                aria-label="Cerrar sesión"
              >
                <LogOut {...ICON_NAV_MOBILE} />
              </button>
            </div>

            <main className="mc-main" id="main-content" tabIndex={-1}>
              <Outlet />
            </main>
          </div>
        </SectionErrorBoundary>

        {/* ── Bottom nav + drawer "Más" ────────────────────────────────── */}
        <SectionErrorBoundary label="Bottom Nav">

          {masDrawerOpen && (
            <div
              className="mc-mas-overlay"
              onClick={() => setMasDrawerOpen(false)}
              aria-hidden
            />
          )}

          <div
            className={`mc-mas-drawer ${masDrawerOpen ? 'mc-mas-drawer--open' : 'mc-mas-drawer--closed'}`}
            role="dialog"
            aria-label="Más módulos"
            aria-modal="true"
          >
            {masNav.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                end
                onClick={() => setMasDrawerOpen(false)}
                className="mc-sidebar-nav-link"
              >
                  <Icon {...ICON_NAV_MOBILE} />
                <span className="mc-sidebar-nav-label">{label}</span>
              </NavLink>
            ))}
          </div>

          <nav className="mc-bottom-nav" aria-label="Navegación inferior">
            <div className="mc-bottom-nav-inner">
              {bottomNav.map(({ to, label, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  end
                  className={({ isActive }) =>
                    `mc-bottom-nav-link${isActive ? ' mc-bottom-nav-link--active' : ''}`
                  }
                  style={{ position: 'relative' }}
                >
                  {({ isActive }) => (
                    <>
                        <Icon {...ICON_NAV_MOBILE} />
                      <span>{label}</span>
                      {to === '/planificacion' && slaAlertCount > 0 && (
                        <span
                          className="mc-filter-pill-badge"
                          style={{
                            position: 'absolute',
                            top: 2,
                            right: 'calc(50% - 22px)',
                            minWidth: 16,
                            padding: '0 4px',
                            fontSize: 9,
                          }}
                          aria-hidden
                        >
                          {slaAlertCount > 9 ? '9+' : slaAlertCount}
                        </span>
                      )}
                      {isActive && <span className="sr-only">(página actual)</span>}
                    </>
                  )}
                </NavLink>
              ))}

              {masNav.length > 0 && (
                <button
                  type="button"
                  className={`mc-bottom-nav-link${masDrawerOpen ? ' mc-bottom-nav-link--active' : ''}`}
                  onClick={() => setMasDrawerOpen((v) => !v)}
                  aria-expanded={masDrawerOpen}
                  aria-label="Más módulos"
                  style={{ flex: '1 1 0' }}
                >
                  <MoreHorizontal {...ICON_NAV_MOBILE} />
                  <span>Más</span>
                </button>
              )}
            </div>
          </nav>
        </SectionErrorBoundary>

      </div>

      {usuario && (
        <OnboardingWelcome userId={usuario.id} rol={usuario.rol} />
      )}

      {usuario && (
        <ModalPreferenciasNotificaciones
          open={prefsModalOpen}
          onClose={() => setPrefsModalOpen(false)}
          userId={usuario.id}
          rol={usuario.rol}
          onSaved={setNotifPrefs}
        />
      )}

      <ModalConfirmar
        open={confirmandoLogout}
        analyticsId="modal-logout"
        titulo="Cerrar sesión"
        mensaje="¿Seguro que quieres cerrar sesión?"
        labelConfirmar="Cerrar sesión"
        variantConfirmar="danger"
        cargando={logoutPending}
        onConfirmar={() => void handleLogout()}
        onCancelar={() => setConfirmandoLogout(false)}
      />
    </>
  );
}
