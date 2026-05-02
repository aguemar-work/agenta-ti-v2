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

const NAV_ITEMS = [
  { to: '/semana', label: 'Mi semana', icon: Calendar, roles: ['jefe', 'miembro'] },

  { to: '/planificacion', label: 'Planificación', icon: ClipboardList, roles: ['jefe'] },
  { to: '/tablero', label: 'Tablero', icon: LayoutGrid, roles: ['jefe', 'miembro'] },
  { to: '/objetivos', label: 'Objetivos', icon: Target, roles: ['jefe', 'miembro'] },
  { to: '/bitacora', label: 'Bitácora', icon: NotebookPen, roles: ['jefe', 'miembro'] },
  { to: '/metricas', label: 'Métricas', icon: BarChart2, roles: ['jefe', 'miembro'] },
  { to: '/ordenes-trabajo', label: 'OT', icon: FileText, roles: ['jefe', 'miembro'] },
] as const;

// Bottom nav por rol:
//   Jefe    — los módulos que más usa: Semana, Planificación, Métricas, Bitácora
//   Miembro — los módulos operativos del día a día: Semana, Tablero, Objetivos, Bitácora
const BOTTOM_NAV_ITEMS_JEFE    = ['/semana', '/planificacion', '/metricas', '/bitacora'] as const;
const BOTTOM_NAV_ITEMS_MIEMBRO = ['/semana', '/tablero', '/objetivos', '/bitacora'] as const;

function getBottomNavItems(rol: string | undefined): readonly string[] {
  return rol === 'jefe' ? BOTTOM_NAV_ITEMS_JEFE : BOTTOM_NAV_ITEMS_MIEMBRO;
}

function useSidebarCollapsed() {
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try { return localStorage.getItem('mc-sidebar-collapsed') === 'true'; }
    catch { return false; }
  });
  function toggle() {
    setCollapsed((v) => {
      const next = !v;
      try { localStorage.setItem('mc-sidebar-collapsed', String(next)); } catch { }
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

/** Punto de estado de conexión realtime. Verde = activo, gris = sin conexión. */
function RealtimeIndicator({ conectado }: { conectado: boolean }) {
  return (
    <span
      title={conectado ? 'Notificaciones en tiempo real activas' : 'Sin conexión en tiempo real — las notificaciones pueden tardar'}
      aria-label={conectado ? 'Notificaciones activas' : 'Sin notificaciones en tiempo real'}
      style={{
        display: 'inline-block',
        width: 8,
        height: 8,
        borderRadius: '50%',
        flexShrink: 0,
        background: conectado ? 'var(--mc-color-success, #4ade80)' : 'var(--mc-color-text-tertiary, #9ca3af)',
        transition: 'background 0.4s ease',
      }}
    />
  );
}

export function AppShell() {
  const navigate = useNavigate();
  const usuario = useAuthStore((s) => s.usuario);
  const clear = useAuthStore((s) => s.clear);
  const { collapsed, toggle } = useSidebarCollapsed();
  const { conectado } = useRealtimeNotificaciones();
  const [masDrawerOpen, setMasDrawerOpen] = useState(false);
  const [confirmandoLogout, setConfirmandoLogout] = useState(false);
  const [logoutPending, setLogoutPending] = useState(false);
  const location = useLocation();

  const visibleNav = NAV_ITEMS.filter((item) =>
    !usuario?.rol || (item.roles as readonly string[]).includes(usuario.rol),
  );
  const bottomNavItems = getBottomNavItems(usuario?.rol);
  const bottomNav = visibleNav.filter((item) =>
    bottomNavItems.includes(item.to),
  );

  // Modules not in bottom nav — shown in "Más" drawer
  const masNav = visibleNav.filter((item) =>
    !bottomNavItems.includes(item.to),
  );

  // Current page title for mobile topbar
  const paginaActual = NAV_ITEMS.find((item) =>
    location.pathname.startsWith(item.to),
  )?.label ?? '';

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

  const initials = getInitials(usuario?.nombre);

  const CSS = `
    :root {
      --mc-sidebar-w: 220px;
      --mc-sidebar-w-collapsed: 56px;
      --mc-bottom-nav-h: 60px;
      --mc-scroll-pad-bottom: calc(var(--mc-bottom-nav-h) + 8px);
    }
    .mc-app-root { display:flex; height:100%; overflow-y:hidden; overflow-x:clip; }
    .mc-sidebar {
      width:var(--mc-sidebar-w); flex-shrink:0;
      display:flex; flex-direction:column;
      border-right:1px solid var(--mc-color-border);
      background:var(--mc-color-surface);
      transition:width 0.2s ease; overflow-x:visible; overflow-y:hidden;
    }
    .mc-sidebar.collapsed { width:var(--mc-sidebar-w-collapsed); }
    .mc-sidebar-link {
      display:flex; align-items:center; gap:10px;
      padding:9px 12px; border-radius:var(--mc-radius-md);
      color:var(--mc-color-text-secondary); text-decoration:none;
      font-size:var(--mc-text-sm); font-weight:500;
      white-space:nowrap; transition:background 0.13s,color 0.13s; min-width:0;
    }
    .mc-sidebar-link:hover { background:var(--mc-color-surface-hover); color:var(--mc-color-text); }
    .mc-sidebar-link--active {
      background:color-mix(in srgb, var(--mc-color-accent) 10%, transparent);
      color:var(--mc-color-accent);
    }
    .mc-sidebar-link .link-label {
      overflow:hidden; opacity:1;
      transition:opacity 0.15s, max-width 0.2s; max-width:160px;
    }
    .mc-sidebar.collapsed .link-label { opacity:0; max-width:0; }
    .mc-tip { position:relative; }
    .mc-tip::after {
      content:attr(data-tip);
      position:absolute; left:calc(100% + 8px); top:50%;
      transform:translateY(-50%);
      background:var(--mc-color-text); color:var(--mc-color-surface);
      font-size:12px; font-weight:500; white-space:nowrap;
      padding:4px 10px; border-radius:var(--mc-radius-sm);
      pointer-events:none; opacity:0; transition:opacity 0.1s ease; z-index:200;
    }
    .mc-sidebar.collapsed .mc-tip:hover::after { opacity:1; }
    .mc-sidebar-profile {
      display:flex; align-items:center; gap:10px;
      padding:10px 12px; min-width:0; overflow:hidden;
    }
    .mc-sidebar-avatar {
      width:32px; height:32px; border-radius:50%;
      background:color-mix(in srgb, var(--mc-color-accent) 12%, transparent);
      color:var(--mc-color-accent);
      display:flex; align-items:center; justify-content:center;
      font-size:12px; font-weight:600; flex-shrink:0; user-select:none;
    }
    .mc-sidebar-profile-info {
      flex:1; min-width:0; overflow:hidden;
      opacity:1; max-width:140px;
      transition:opacity 0.15s, max-width 0.2s;
    }
    .mc-sidebar.collapsed .mc-sidebar-profile-info { opacity:0; max-width:0; }
    .mc-sidebar-profile-name {
      font-size:13px; font-weight:500; color:var(--mc-color-text);
      white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin:0;
    }
    .mc-sidebar-profile-role {
      font-size:11px; color:var(--mc-color-text-secondary); white-space:nowrap; margin:0;
    }
    .mc-sidebar-logout {
      display:flex; align-items:center; justify-content:center;
      width:30px; height:30px; border-radius:var(--mc-radius-md);
      border:none; background:none; cursor:pointer;
      color:var(--mc-color-text-secondary); flex-shrink:0;
      transition:background 0.13s, color 0.13s;
    }
    .mc-sidebar-logout:hover { background:var(--mc-color-surface-hover); color:var(--mc-color-danger); }
    .mc-app-column { flex:1; min-width:0; display:flex; flex-direction:column; overflow:hidden; }
    .mc-main { flex:1; min-height:0; overflow-y:auto; width:100%; padding:var(--mc-space-6); box-sizing:border-box; }
    .mc-module { width:100%; max-width:100%; min-width:0; box-sizing:border-box; }
    .mc-mobile-topbar {
      display:none; height:var(--mc-topbar-h,56px); flex-shrink:0;
      align-items:center; padding:0 16px;
      border-bottom:1px solid var(--mc-color-border);
      background:var(--mc-color-surface); gap:8px;
    }
    .mc-bottom-nav {
      display:none; position:fixed; bottom:0; left:0; right:0;
      height:var(--mc-bottom-nav-h);
      background:var(--mc-color-surface);
      border-top:1px solid var(--mc-color-border); z-index:40;
    }
    .mc-bottom-nav-inner { display:flex; align-items:stretch; height:100%; }
    .mc-bottom-nav-link {
      flex:1; display:flex; flex-direction:column;
      align-items:center; justify-content:center;
      gap:3px; text-decoration:none;
      color:var(--mc-color-text-secondary);
      font-size:10px; font-weight:500;
      transition:color 0.13s; padding:6px 4px 8px;
    }
    .mc-bottom-nav-link.active,
    .mc-bottom-nav-link--active { color:var(--mc-color-accent); }
    @media (max-width:767px) {
      .mc-sidebar       { display:none; }
      .mc-bottom-nav    { display:block; }
      .mc-mobile-topbar { display:flex; }
      .mc-main          { padding-bottom:var(--mc-scroll-pad-bottom) !important; }
    }
  `;

  return (
    <>
      <style>{CSS}</style>
      <div className="mc-app-root">

        <SectionErrorBoundary label="Sidebar">
          <nav id="mc-sidebar-nav" className={`mc-sidebar${collapsed ? ' collapsed' : ''}`} aria-label="Navegacion principal">
            <div style={{ height: 'var(--mc-topbar-h,56px)', display: 'flex', alignItems: 'center', padding: '0 12px', borderBottom: '1px solid var(--mc-color-border)', flexShrink: 0, overflow: 'hidden' }}>
              {collapsed ? <AppBrandIcon size={28} /> : <AppLogo height={28} className="shrink-0" />}
            </div>

            <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '8px', display: 'flex', flexDirection: 'column', gap: 2 }}>
              {visibleNav.map(({ to, label, icon: Icon }) => (
                <div key={to} className="mc-tip" data-tip={label}>
                  <NavLink to={to} end className={({ isActive }) => `mc-sidebar-link${isActive ? ' mc-sidebar-link--active' : ''}`}>
                    {({ isActive }) => (
                      <>
                        <Icon size={18} aria-hidden style={{ flexShrink: 0 }} />
                        <span className="link-label" aria-hidden={collapsed}>{label}</span>
                        {isActive && <span className="sr-only">(pagina actual)</span>}
                      </>
                    )}
                  </NavLink>
                </div>
              ))}
            </div>

            <div style={{ borderTop: '1px solid var(--mc-color-border)', flexShrink: 0 }}>
              <div className="mc-sidebar-profile mc-tip" data-tip={collapsed ? usuario?.nombre : undefined}>
                <div className="mc-sidebar-avatar" aria-hidden>{initials}</div>
                <div className="mc-sidebar-profile-info">
                  <p className="mc-sidebar-profile-name">{usuario?.nombre}</p>
                  <p className="mc-sidebar-profile-role">{usuario?.rol === 'jefe' ? 'Jefe' : 'Miembro'}</p>
                </div>
                <RealtimeIndicator conectado={conectado} />
                <button type="button" className="mc-sidebar-logout" onClick={() => setConfirmandoLogout(true)} aria-label="Cerrar sesion">
                  <LogOut size={16} aria-hidden />
                </button>
              </div>

              <div style={{ padding: '0 8px 8px' }}>
                <button type="button" onClick={toggle} aria-expanded={!collapsed} aria-controls="mc-sidebar-nav"
                  aria-label={collapsed ? 'Expandir menu lateral' : 'Colapsar menu lateral'}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'flex-end', gap: 8, padding: '7px 10px', borderRadius: 'var(--mc-radius-md)', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--mc-color-text-secondary)', fontSize: '12px', fontWeight: 500, transition: 'background 0.13s' }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--mc-color-surface-hover)'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'none'; }}
                >
                  {collapsed ? <ChevronRight size={16} aria-hidden /> : <><span>Colapsar</span><ChevronLeft size={16} aria-hidden /></>}
                </button>
              </div>
            </div>
          </nav>
        </SectionErrorBoundary>

        <SectionErrorBoundary label="Contenido Principal">
          <div className="mc-app-column">
            <div className="mc-mobile-topbar">
              <AppBrandIcon size={28} />
              {paginaActual && (
                <span className="mc-topbar-page-name">{paginaActual}</span>
              )}
              <div style={{ flex: 1 }} />
              <RealtimeIndicator conectado={conectado} />
              <button type="button" className="mc-sidebar-logout" onClick={() => setConfirmandoLogout(true)} aria-label="Cerrar sesion">
                <LogOut size={18} aria-hidden />
              </button>
            </div>
            <main className="mc-main" id="main-content" tabIndex={-1}>
              <Outlet />
            </main>
          </div>
        </SectionErrorBoundary>

        <SectionErrorBoundary label="Bottom Nav">
          {/* ── Drawer "Más" ────────────────────────────────────────── */}
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

          <nav className="mc-bottom-nav" aria-label="Navegacion inferior">
            <div className="mc-bottom-nav-inner">
              {bottomNav.map(({ to, label, icon: Icon }) => (
                <NavLink key={to} to={to} end className={({ isActive }) => `mc-bottom-nav-link${isActive ? ' mc-bottom-nav-link--active' : ''}`}>
                  {({ isActive }) => (
                    <>
                      <Icon size={20} aria-hidden />
                      <span>{label}</span>
                      {isActive && <span className="sr-only">(pagina actual)</span>}
                    </>
                  )}
                </NavLink>
              ))}
              {masNav.length > 0 && (
                <button
                  type="button"
                  onClick={() => setMasDrawerOpen((v) => !v)}
                  className={`mc-bottom-nav-link${masDrawerOpen ? ' mc-bottom-nav-link--active' : ''}`}
                  aria-expanded={masDrawerOpen}
                  aria-label="Más módulos"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', flex: '1 1 0' }}
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