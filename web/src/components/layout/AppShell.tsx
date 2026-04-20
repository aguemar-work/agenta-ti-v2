import {
  BarChart2,
  Calendar,
  CalendarRange,
  ClipboardList,
  LayoutGrid,
  LogOut,
  NotebookPen,
  Target,
} from 'lucide-react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';

import { Button } from '@/components/ui/Button';
import { getInsforge } from '@/lib/insforge';
import { useAuthStore } from '@/store/authStore';

export function AppShell() {
  const navigate = useNavigate();
  const usuario = useAuthStore((s) => s.usuario);
  const clear = useAuthStore((s) => s.clear);

  async function handleLogout() {
    const insforge = getInsforge();
    await insforge.auth.signOut();
    clear();
    navigate('/login', { replace: true });
  }

  return (
    <div className="mc-app-root">
      <aside className="mc-sidebar mc-sidebar-floating">
        <nav className="mc-sidebar-inner" aria-label="Módulos">
          <NavLink
            to="/hoy"
            className={({ isActive }) =>
              `mc-sidebar-link ${isActive ? 'mc-sidebar-link--active' : ''}`.trim()
            }
            title="Hoy"
          >
            <span className="mc-sidebar-icon">
              <Calendar size={20} strokeWidth={1.75} aria-hidden />
            </span>
            <span className="mc-sidebar-link-text">Hoy</span>
          </NavLink>
          <NavLink
            to="/semana"
            className={({ isActive }) =>
              `mc-sidebar-link ${isActive ? 'mc-sidebar-link--active' : ''}`.trim()
            }
            title="Mi semana"
          >
            <span className="mc-sidebar-icon">
              <CalendarRange size={20} strokeWidth={1.75} aria-hidden />
            </span>
            <span className="mc-sidebar-link-text">Mi semana</span>
          </NavLink>
          {usuario?.rol === 'jefe' ? (
            <NavLink
              to="/planificacion"
              className={({ isActive }) =>
                `mc-sidebar-link ${isActive ? 'mc-sidebar-link--active' : ''}`.trim()
              }
              title="Planificación"
            >
              <span className="mc-sidebar-icon">
                <ClipboardList size={20} strokeWidth={1.75} aria-hidden />
              </span>
              <span className="mc-sidebar-link-text">Planificación</span>
            </NavLink>
          ) : null}
          <NavLink
            to="/tablero"
            className={({ isActive }) =>
              `mc-sidebar-link ${isActive ? 'mc-sidebar-link--active' : ''}`.trim()
            }
            title="Tablero"
          >
            <span className="mc-sidebar-icon">
              <LayoutGrid size={20} strokeWidth={1.75} aria-hidden />
            </span>
            <span className="mc-sidebar-link-text">Tablero</span>
          </NavLink>
          <NavLink
            to="/objetivos"
            className={({ isActive }) =>
              `mc-sidebar-link ${isActive ? 'mc-sidebar-link--active' : ''}`.trim()
            }
            title="Objetivos"
          >
            <span className="mc-sidebar-icon">
              <Target size={20} strokeWidth={1.75} aria-hidden />
            </span>
            <span className="mc-sidebar-link-text">Objetivos</span>
          </NavLink>
          <NavLink
            to="/bitacora"
            className={({ isActive }) =>
              `mc-sidebar-link ${isActive ? 'mc-sidebar-link--active' : ''}`.trim()
            }
            title="Bitácora"
          >
            <span className="mc-sidebar-icon">
              <NotebookPen size={20} strokeWidth={1.75} aria-hidden />
            </span>
            <span className="mc-sidebar-link-text">Bitácora</span>
          </NavLink>
          <NavLink
            to="/metricas"
            className={({ isActive }) =>
              `mc-sidebar-link ${isActive ? 'mc-sidebar-link--active' : ''}`.trim()
            }
            title="Métricas"
          >
            <span className="mc-sidebar-icon">
              <BarChart2 size={20} strokeWidth={1.75} aria-hidden />
            </span>
            <span className="mc-sidebar-link-text">Métricas</span>
          </NavLink>
        </nav>
      </aside>

      <div className="mc-app-column">
        <header className="flex h-[var(--mc-topbar-h)] shrink-0 items-center gap-4 border-b border-[var(--mc-color-border)] bg-[var(--mc-color-surface)] px-4">
          <span className="font-semibold text-[var(--mc-color-text)]" style={{ fontSize: 'var(--mc-text-md)' }}>
            SGTD
          </span>
          <div className="flex-1" />
          <span
            className="hidden text-[var(--mc-color-text-secondary)] sm:inline"
            style={{ fontSize: 'var(--mc-text-sm)' }}
          >
            {usuario?.nombre}
          </span>
          <Button variant="ghost" className="!p-2" onClick={() => void handleLogout()} title="Cerrar sesión">
            <LogOut size={18} aria-hidden />
          </Button>
        </header>
        <main className="mc-main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
