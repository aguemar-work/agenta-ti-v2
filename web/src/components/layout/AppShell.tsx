import {
  BarChart2,
  Calendar,
  ClipboardList,
  FileText,
  LogOut,
  MoreHorizontal,
  Target,
} from 'lucide-react';
import { useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';

import { AppBrandIcon } from '@/components/brand/AppLogo';
import { ModalConfirmar } from '@/components/ui/ModalConfirmar';
import { SectionErrorBoundary } from '@/components/ui/SectionErrorBoundary';
import { getInsforge } from '@/lib/insforge';
import { useAuthStore } from '@/store/authStore';
import { useRealtimeNotificaciones } from '@/hooks/useRealtimeNotificaciones';

// ---------------------------------------------------------------------------
// Nav config
// ---------------------------------------------------------------------------
const NAV_ITEMS = [
  { to: '/semana',          label: 'Mi semana',     icon: Calendar,      roles: ['jefe', 'miembro'] },
  { to: '/objetivos',       label: 'Objetivos',     icon: Target,        roles: ['jefe', 'miembro'] },
  { to: '/ordenes-trabajo', label: 'OT',            icon: FileText,      roles: ['jefe', 'miembro'] },
  { to: '/planificacion',   label: 'Planificación', icon: ClipboardList, roles: ['jefe'] },
  { to: '/metricas',        label: 'Métricas',      icon: BarChart2,     roles: ['jefe'] },
] as const;

const BOTTOM_NAV_JEFE    = ['/semana', '/planificacion', '/metricas', '/ordenes-trabajo'] as const;
const BOTTOM_NAV_MIEMBRO = ['/semana', '/ordenes-trabajo', '/objetivos']                  as const;

function getBottomItems(rol: string | undefined): readonly string[] {
  return rol === 'jefe' ? BOTTOM_NAV_JEFE : BOTTOM_NAV_MIEMBRO;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function getInitials(nombre?: string): string {
  if (!nombre) return '?';
  const parts = nombre.trim().split(' ').filter(Boolean);
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// ---------------------------------------------------------------------------
// Indicador realtime
// ---------------------------------------------------------------------------
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
        background:    conectado ? '#31A24C' : '#CED2D9',
        boxShadow:     conectado ? '0 0 0 2px rgba(49,162,76,0.2)' : 'none',
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
  const { conectado }          = useRealtimeNotificaciones();
  const [masDrawerOpen,     setMasDrawerOpen]     = useState(false);
  const [confirmandoLogout, setConfirmandoLogout] = useState(false);
  const [logoutPending,     setLogoutPending]     = useState(false);
  const location = useLocation();

  const visibleNav   = NAV_ITEMS.filter((item) =>
    !usuario?.rol || (item.roles as readonly string[]).includes(usuario.rol),
  );
  const bottomItems  = getBottomItems(usuario?.rol);
  const bottomNav    = visibleNav.filter((item) => bottomItems.includes(item.to));
  const masNav       = visibleNav.filter((item) => !bottomItems.includes(item.to));
  const paginaActual = NAV_ITEMS.find((item) => location.pathname.startsWith(item.to))?.label ?? '';
  const initials     = getInitials(usuario?.nombre);
  const esJefe       = usuario?.rol === 'jefe';
  const perfilTip    = usuario?.nombre
    ? `${usuario.nombre} · ${esJefe ? 'Jefe de área' : 'Miembro del equipo'}`
    : 'Perfil';

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
            <div className="mc-sidebar-head">
              <AppBrandIcon size={26} />
            </div>

            <div
              style={{
                flex:          1,
                overflowY:     'auto',
                overflowX:     'hidden',
                padding:       '6px 6px',
                display:       'flex',
                flexDirection: 'column',
                gap:            2,
              }}
            >
              {visibleNav.map(({ to, label, icon: Icon }) => (
                <div key={to} className="mc-tip" data-tip={label}>
                  <NavLink
                    to={to}
                    end
                    aria-label={label}
                    className={({ isActive }) =>
                      `mc-sidebar-link${isActive ? ' mc-sidebar-link--active' : ''}`
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <Icon size={18} aria-hidden style={{ flexShrink: 0 }} />
                        {isActive && <span className="sr-only">(página actual)</span>}
                      </>
                    )}
                  </NavLink>
                </div>
              ))}
            </div>

            <div style={{ borderTop: '1px solid var(--mc-color-border)', flexShrink: 0 }}>
              <div className="mc-sidebar-profile">
                <div className="mc-tip" data-tip={perfilTip}>
                  <div className="mc-sidebar-avatar" aria-hidden>{initials}</div>
                </div>
                <div className="mc-sidebar-profile-info" aria-live="polite">
                  <p className="mc-sidebar-profile-name">{usuario?.nombre}</p>
                  <p className="mc-sidebar-profile-role">
                    {esJefe ? 'Jefe de área' : 'Miembro del equipo'}
                  </p>
                </div>
                <RealtimeIndicator conectado={conectado} />
                <div className="mc-tip" data-tip="Cerrar sesión">
                  <button
                    type="button"
                    className="mc-sidebar-logout"
                    onClick={() => setConfirmandoLogout(true)}
                    aria-label="Cerrar sesión"
                  >
                    <LogOut size={15} aria-hidden />
                  </button>
                </div>
              </div>
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
                onClick={() => setConfirmandoLogout(true)}
                aria-label="Cerrar sesión"
              >
                <LogOut size={17} aria-hidden />
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
                className={({ isActive }) =>
                  `mc-sidebar-link mc-mas-drawer-item${isActive ? ' mc-sidebar-link--active' : ''}`
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon size={20} aria-hidden style={{ flexShrink: 0 }} />
                    <span>{label}</span>
                    {isActive && <span className="sr-only">(página actual)</span>}
                  </>
                )}
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
                >
                  {({ isActive }) => (
                    <>
                      <Icon size={20} aria-hidden />
                      <span>{label}</span>
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
                  <MoreHorizontal size={20} aria-hidden />
                  <span>Más</span>
                </button>
              )}
            </div>
          </nav>
        </SectionErrorBoundary>

      </div>

      <ModalConfirmar
        open={confirmandoLogout}
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