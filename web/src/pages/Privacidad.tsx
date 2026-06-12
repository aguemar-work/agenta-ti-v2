import { Link } from 'react-router-dom';

import { AppLogo } from '@/components/brand/AppLogo';

/**
 * Aviso informativo de tratamiento de datos (Ley 29733 — Perú).
 */
export function Privacidad() {
  return (
    <div className="mc-auth-page">
      <div className="mc-auth-card">
        <div className="mc-auth-brand">
          <AppLogo height={40} />
        </div>
        <h1 className="mc-auth-title">Tratamiento de datos personales</h1>
        <div className="mc-auth-body text-[var(--mc-color-text-secondary)]">
          <p>
            <strong>Materen</strong> es una herramienta interna de gestión de tareas del equipo de TI.
            Los datos que tratamos incluyen nombre, correo, rol, justificaciones de cambios en tareas
            y, al cerrar órdenes de trabajo, nombre y DNI del receptor.
          </p>
          <p>
            La finalidad es la planificación, ejecución y trazabilidad operativa del equipo.
            El acceso está restringido por rol y políticas de seguridad en base de datos.
          </p>
          <p>
            Para ejercer tus derechos de acceso, rectificación, cancelación u oposición (ARCO),
            escribe al responsable de protección de datos de tu organización (área de TI o Legal).
          </p>
        </div>
        <p className="mc-auth-footer">
          <Link to="/login" className="mc-link">
            Volver al inicio de sesión
          </Link>
        </p>
      </div>
    </div>
  );
}
