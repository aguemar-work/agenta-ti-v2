import { NavLink } from 'react-router-dom';

const LINK_CLASS = ({ isActive }: { isActive: boolean }) =>
  ['mc-filter-pill', isActive ? 'mc-filter-pill--active' : ''].filter(Boolean).join(' ');

/** Sub-navegación del panel del dueño: organizaciones vs usuarios. */
export function PanelNav() {
  return (
    <nav className="mc-filter-pills" aria-label="Secciones del panel">
      <NavLink to="/panel" end className={LINK_CLASS}>
        Organizaciones
      </NavLink>
      <NavLink to="/panel/usuarios" className={LINK_CLASS}>
        Usuarios
      </NavLink>
    </nav>
  );
}
