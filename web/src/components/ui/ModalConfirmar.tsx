/**
 * components/ui/ModalConfirmar.tsx
 *
 * Modal de confirmación reutilizable — reemplaza window.confirm en toda la app.
 *
 * Uso básico (logout):
 *   <ModalConfirmar
 *     open={confirmandoLogout}
 *     titulo="Cerrar sesión"
 *     mensaje="¿Seguro que quieres cerrar sesión?"
 *     labelConfirmar="Cerrar sesión"
 *     variantConfirmar="danger"
 *     onConfirmar={handleLogout}
 *     onCancelar={() => setConfirmandoLogout(false)}
 *   />
 *
 * Uso con acción destructiva personalizada:
 *   <ModalConfirmar
 *     open={open}
 *     titulo="Eliminar registro"
 *     mensaje="Esta acción no se puede deshacer."
 *     labelConfirmar="Eliminar"
 *     variantConfirmar="danger"
 *     cargando={isPending}
 *     onConfirmar={handleEliminar}
 *     onCancelar={onClose}
 *   />
 */

import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';

interface ModalConfirmarProps {
  open:              boolean;
  titulo:            string;
  mensaje:           string;
  /** Texto del botón de confirmación. Por defecto: "Confirmar" */
  labelConfirmar?:   string;
  /** Variante visual del botón de confirmación. Por defecto: "danger" */
  variantConfirmar?: 'primary' | 'danger';
  /** Texto del botón de cancelar. Por defecto: "Cancelar" */
  labelCancelar?:    string;
  /** Muestra estado de carga en el botón confirmar */
  cargando?:         boolean;
  onConfirmar:       () => void;
  onCancelar:        () => void;
}

export function ModalConfirmar({
  open,
  titulo,
  mensaje,
  labelConfirmar  = 'Confirmar',
  variantConfirmar = 'danger',
  labelCancelar   = 'Cancelar',
  cargando        = false,
  onConfirmar,
  onCancelar,
}: ModalConfirmarProps) {
  return (
    <Modal
      open={open}
      onClose={onCancelar}
      title={titulo}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onCancelar} disabled={cargando}>
            {labelCancelar}
          </Button>
          <Button
            variant={variantConfirmar}
            onClick={onConfirmar}
            disabled={cargando}
          >
            {cargando ? 'Cargando…' : labelConfirmar}
          </Button>
        </>
      }
    >
      <p style={{
        margin: 0,
        fontSize: '14px',
        color: 'var(--mc-color-text-secondary)',
        lineHeight: 1.55,
      }}>
        {mensaje}
      </p>
    </Modal>
  );
}