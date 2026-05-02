import {
  BarChart2,
  Calendar,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  FileText,
  LayoutGrid,
  LogOut,
  MoreHorizontal,
  NotebookPen,
  Target,
} from 'lucide-react';
import { useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';

import { AppBrandIcon, AppLogo } from '@/components/brand/AppLogo';
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
  { to: '/planificacion',   label: 'Planificación', icon: ClipboardList, roles: ['jefe'] },
  { to: '/tablero',         label: 'Tablero',       icon: LayoutGrid,    roles: ['jefe', 'miembro'] },
  { to: '/objetivos',       label: 'Objetivos',     icon: Target,        roles: ['jefe', 'miembro'] },
  { to: '/bitacora',        label: 'Bitácora',      icon: NotebookPen,   roles: ['jefe', 'miembro'] },
  { to: '/metricas',        label: 'Métricas',      icon: BarChart2,     roles: ['jefe', 'miembro'] },
  { to: '/ordenes-trabajo', label: 'OT',            icon: FileText,      roles: ['jefe', 'miembro'] },
] as const;

const BOTTOM_NAV_JEFE    = ['/semana', '/planificacion', '/metricas', '/bitacora']    as const;
const BOTTOM_NAV_MIEMBRO = ['/semana', '/tablero',       '/objetivos', '/bitacora']  as const;

function getBottomItems(rol: string | undefined): readonly string[] {
  return rol === 'jefe' ? BOTTOM_NAV_JEFE : BOTTOM_NAV_MIEMBRO;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function useSidebarCollapsed() {
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try { return localStorage.getItem('mc-sidebar-collapsed') === 'true'; }
    catch { return false; }
  });
  function toggle() {
    setCollapsed((v) => {
      const next = !v;
      try { localStorage.setItem('mc-sidebar-collapsed', String(next)); } catch { /**/ }
      return next;
    });
  }
  return { collapsed, toggle };
}

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
        display:    'inline-block',
        width:       8,
        height:      8,
        borderRadius:'50%',
        flexShrink:  0,
        background:  conectado ? '#31A24C' : '#CED2D9',
        boxShadow:   conectado ? '0 0 0 2px rgba(49,162,76,0.2)' : 'none',
        transition: 'background 0.4s ease, box-shadow 0.4s ease',
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// CSS global del shell
// ---------------------------------------------------------------------------
const SHELL_CSS = `
  :root {
    --mc-sidebar-w:           220px;
    --mc-sidebar-w-collapsed: 56px;
    --mc-bottom-nav-h:        60px;
    --mc-topbar-h:            52px;
  }

  /* ── Layout raíz ── */
  .mc-app-root {
    display: flex; height: 100%; overflow-y: hidden; overflow-x: clip;
  }

  /* ── Sidebar ── */
  .mc-sidebar {
    width: var(--mc-sidebar-w); flex-shrink: 0;
    display: flex; flex-direction: column;
    background: var(--mc-color-surface);
    border-right: 1px solid var(--mc-color-border);
    transition: width 0.2s ease;
    overflow-x: visible; overflow-y: hidden;
  }
  .mc-sidebar.collapsed { width: var(--mc-sidebar-w-collapsed); }

  /* Cabecera del sidebar */
  .mc-sidebar-head {
    height: var(--mc-topbar-h);
    display: flex; align-items: center;
    padding: 0 14px;
    border-bottom: 1px solid var(--mc-color-border);
    flex-shrink: 0; overflow: hidden; gap: 10px;
  }

  /* Links de nav */
  .mc-sidebar-link {
    display: flex; align-items: center; gap: 10px;
    padding: 8px 10px; border-radius: var(--mc-radius-md);
    color: var(--mc-color-text-secondary); text-decoration: none;
    font-size: 13px; font-weight: 500;
    white-space: nowrap; transition: background 0.12s, color 0.12s;
    min-width: 0; position: relative;
  }
  .mc-sidebar-link:hover {
    background: var(--mc-color-surface-hover);
    color: var(--mc-color-text);
  }
  .mc-sidebar-link--active {
    background: color-mix(in srgb, var(--mc-color-accent) 10%, transparent);
    color: var(--mc-color-accent);
    font-weight: 600;
  }
  .mc-sidebar-link--active::before {
    content: '';
    position: absolute; left: 0; top: 20%; bottom: 20%;
    width: 3px; border-radius: 0 3px 3px 0;
    background: var(--mc-color-accent);
  }

  /* Etiqueta del link (oculta en collapsed) */
  .mc-sidebar-link .link-label {
    overflow: hidden; opacity: 1;
    transition: opacity 0.15s, max-width 0.2s;
    max-width: 160px;
  }
  .mc-sidebar.collapsed .link-label { opacity: 0; max-width: 0; }

  /* Tooltip en collapsed */
  .mc-tip { position: relative; }
  .mc-tip::after {
    content: attr(data-tip);
    position: absolute; left: calc(100% + 10px); top: 50%;
    transform: translateY(-50%);
    background: var(--mc-color-text); color: #fff;
    font-size: 12px; font-weight: 500; white-space: nowrap;
    padding: 4px 10px; border-radius: var(--mc-radius-sm);
    pointer-events: none; opacity: 0;
    transition: opacity 0.1s ease; z-index: 200;
  }
  .mc-sidebar.collapsed .mc-tip:hover::after { opacity: 1; }

  /* Perfil de usuario */
  .mc-sidebar-profile {
    display: flex; align-items: center; gap: 10px;
    padding: 10px 12px; min-width: 0; overflow: hidden;
  }
  .mc-sidebar-avatar {
    width: 32px; height: 32px; border-radius: 50%; flex-shrink: 0;
    background: color-mix(in srgb, var(--mc-color-accent) 12%, transparent);
    color: var(--mc-color-accent);
    display: flex; align-items: center; justify-content: center;
    font-size: 12px; font-weight: 700; user-select: none;
  }
  .mc-sidebar-profile-info {
    flex: 1; min-width: 0; overflow: hidden;
    opacity: 1; max-width: 140px;
    transition: opacity 0.15s, max-width 0.2s;
  }
  .mc-sidebar.collapsed .mc-sidebar-profile-info { opacity: 0; max-width: 0; }
  .mc-sidebar-profile-name {
    font-size: 13px; font-weight: 600; color: var(--mc-color-text);
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin: 0;
  }
  .mc-sidebar-profile-role {
    font-size: 11px; color: var(--mc-color-text-secondary);
    white-space: nowrap; margin: 0;
  }

  /* Botón logout */
  .mc-sidebar-logout {
    display: flex; align-items: center; justify-content: center;
    width: 30px; height: 30px; border-radius: var(--mc-radius-md);
    border: none; background: none; cursor: pointer; flex-shrink: 0;
    color: var(--mc-color-text-secondary);
    transition: background 0.12s, color 0.12s;
  }
  .mc-sidebar-logout:hover {
    background: color-mix(in srgb, var(--mc-color-danger) 10%, transparent);
    color: var(--mc-color-danger);
  }

  /* ── Columna principal ── */
  .mc-app-column {
    flex: 1; min-width: 0; display: flex; flex-direction: column; overflow: hidden;
  }
  .mc-main {
    flex: 1; min-height: 0; overflow-y: auto; width: 100%;
    padding: var(--mc-space-6, 24px); box-sizing: border-box;
  }

  /* ── Topbar mobile ── */
  .mc-mobile-topbar {
    display: none;
    height: var(--mc-topbar-h);
    flex-shrink: 0;
    align-items: center;
    padding: 0 16px;
    border-bottom: 1px solid var(--mc-color-border);
    background: var(--mc-color-surface);
    gap: 10px;
  }
  .mc-topbar-page-name {
    font-size: 15px; font-weight: 600; color: var(--mc-color-text);
    flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }

  /* ── Bottom nav ── */
  .mc-bottom-nav {
    display: none; position: fixed; bottom: 0; left: 0; right: 0;
    height: var(--mc-bottom-nav-h);
    background: var(--mc-color-surface);
    border-top: 1px solid var(--mc-color-border); z-index: 40;
  }
  .mc-bottom-nav-inner {
    display: flex; align-items: stretch; height: 100%;
  }
  .mc-bottom-nav-link {
    flex: 1; display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    gap: 3px; text-decoration: none;
    color: var(--mc-color-text-secondary);
    font-size: 10px; font-weight: 500;
    transition: color 0.13s; padding: 6px 4px 8px;
    border: none; background: none; cursor: pointer;
  }
  .mc-bottom-nav-link.active,
  .mc-bottom-nav-link--active { color: var(--mc-color-accent); font-weight: 600; }

  /* ── Drawer "Más" ── */
  .mc-mas-overlay {
    position: fixed; inset: 0; background: rgba(0,0,0,0.2);
    z-index: 45; animation: mc-fade-in 0.15s ease;
  }
  .mc-mas-drawer {
    position: fixed; bottom: var(--mc-bottom-nav-h); left: 0; right: 0;
    background: var(--mc-color-surface);
    border-top: 1px solid var(--mc-color-border);
    border-radius: 16px 16px 0 0;
    z-index: 46; padding: 8px;
    display: flex; flex-direction: column; gap: 2px;
    transition: transform 0.22s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.18s ease;
  }
  .mc-mas-drawer--open  { transform: translateY(0);    opacity: 1; }
  .mc-mas-drawer--closed{ transform: translateY(100%); opacity: 0; pointer-events: none; }
  .mc-mas-drawer-item {
    padding: 11px 14px !important; font-size: 14px !important;
    border-radius: var(--mc-radius-md) !important;
  }
  .mc-mas-drawer::before {
    content: '';
    display: block;
    width: 36px; height: 4px;
    border-radius: 2px;
    background: var(--mc-color-border-strong);
    margin: 0 auto 8px;
    flex-shrink: 0;
  }

  /* ── Responsive ── */
  @media (max-width: 767px) {
    .mc-sidebar       { display: none; }
    .mc-bottom-nav    { display: block; }
    .mc-mobile-topbar { display: flex; }
    .mc-main          { padding-bottom: calc(var(--mc-bottom-nav-h) + 16px) !important; }
  }
`;

// ---------------------------------------------------------------------------
// AppShell
// ---------------------------------------------------------------------------
export function AppShell() {
  const navigate   = useNavigate();
  const usuario    = useAuthStore((s) => s.usuario);
  const clear      = useAuthStore((s) => s.clear);
  const { collapsed, toggle } = useSidebarCollapsed();
  const { conectado }         = useRealtimeNotificaciones();
  const [masDrawerOpen,    setMasDrawerOpen]    = useState(false);
  const [confirmandoLogout, setConfirmandoLogout] = useState(false);
  const [logoutPending,    setLogoutPending]    = useState(false);
  const location = useLocation();

  const visibleNav    = NAV_ITEMS.filter((item) =>
    !usuario?.rol || (item.roles as readonly string[]).includes(usuario.rol),
  );
  const bottomItems   = getBottomItems(usuario?.rol);
  const bottomNav     = visibleNav.filter((item) => bottomItems.includes(item.to));
  const masNav        = visibleNav.filter((item) => !bottomItems.includes(item.to));
  const paginaActual  = NAV_ITEMS.find((item) => location.pathname.startsWith(item.to))?.label ?? '';
  const initials      = getInitials(usuario?.nombre);
  const esJefe        = usuario?.rol === 'jefe';

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
      <style>{SHELL_CSS}</style>
      <div className="mc-app-root">

        {/* ── Sidebar desktop ─────────────────────────────────────────── */}
        <SectionErrorBoundary label="Sidebar">
          <nav
            id="mc-sidebar-nav"
            className={`mc-sidebar${collapsed ? ' collapsed' : ''}`}
            aria-label="Navegación principal"
          >
            {/* Logo */}
            <div className="mc-sidebar-head">
              {collapsed
                ? <AppBrandIcon size={26} />
                : <AppLogo height={26} className="shrink-0" />
              }
            </div>

            {/* Nav links */}
            <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '6px 8px', display: 'flex', flexDirection: 'column', gap: 2 }}>
              {visibleNav.map(({ to, label, icon: Icon }) => (
                <div key={to} className="mc-tip" data-tip={label}>
                  <NavLink
                    to={to}
                    end
                    className={({ isActive }) =>
                      `mc-sidebar-link${isActive ? ' mc-sidebar-link--active' : ''}`
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <Icon size={17} aria-hidden style={{ flexShrink: 0 }} />
                        <span className="link-label" aria-hidden={collapsed}>{label}</span>
                        {isActive && <span className="sr-only">(página actual)</span>}
                      </>
                    )}
                  </NavLink>
                </div>
              ))}
            </div>

            {/* Perfil + acciones */}
            <div style={{ borderTop: '1px solid var(--mc-color-border)', flexShrink: 0 }}>
              <div
                className="mc-sidebar-profile mc-tip"
                data-tip={collapsed ? usuario?.nombre : undefined}
              >
                <div className="mc-sidebar-avatar" aria-hidden>{initials}</div>
                <div className="mc-sidebar-profile-info">
                  <p className="mc-sidebar-profile-name">{usuario?.nombre}</p>
                  <p className="mc-sidebar-profile-role">
                    {esJefe ? 'Jefe de área' : 'Miembro del equipo'}
                  </p>
                </div>
                <RealtimeIndicator conectado={conectado} />
                <button
                  type="button"
                  className="mc-sidebar-logout"
                  onClick={() => setConfirmandoLogout(true)}
                  aria-label="Cerrar sesión"
                >
                  <LogOut size={15} aria-hidden />
                </button>
              </div>

              {/* Toggle colapsar — solo desktop */}
              <div style={{ padding: '0 8px 8px' }}>
                <button
                  type="button"
                  onClick={toggle}
                  aria-expanded={!collapsed}
                  aria-controls="mc-sidebar-nav"
                  aria-label={collapsed ? 'Expandir menú lateral' : 'Colapsar menú lateral'}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center',
                    justifyContent: collapsed ? 'center' : 'flex-end',
                    gap: 6, padding: '6px 10px',
                    borderRadius: 'var(--mc-radius-md)', border: 'none',
                    background: 'none', cursor: 'pointer',
                    color: 'var(--mc-color-text-secondary)',
                    fontSize: 12, fontWeight: 500,
                    transition: 'background 0.12s',
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--mc-color-surface-hover)'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'none'; }}
                >
                  {collapsed
                    ? <ChevronRight size={15} aria-hidden />
                    : <><span>Colapsar</span><ChevronLeft size={15} aria-hidden /></>
                  }
                </button>
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

          {/* Overlay drawer */}
          {masDrawerOpen && (
            <div
              className="mc-mas-overlay"
              onClick={() => setMasDrawerOpen(false)}
              aria-hidden
            />
          )}

          {/* Drawer "Más" */}
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

          {/* Bottom nav */}
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