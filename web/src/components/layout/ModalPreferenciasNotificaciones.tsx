import { useEffect, useState } from 'react';

import { Button, CancelButton } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import {
  eventosDisponiblesPorRol,
  loadNotificationPrefs,
  NOTIFICATION_EVENT_LABELS,
  saveNotificationPrefs,
  type NotificationPrefs,
} from '@/lib/notificationPrefs';
import type { RolUsuario } from '@/types';

type Props = {
  open: boolean;
  onClose: () => void;
  userId: string;
  rol: RolUsuario;
  onSaved?: (prefs: NotificationPrefs) => void;
};

export function ModalPreferenciasNotificaciones({ open, onClose, userId, rol, onSaved }: Props) {
  const [prefs, setPrefs] = useState<NotificationPrefs>(() => loadNotificationPrefs(userId));
  const eventos = eventosDisponiblesPorRol(rol);

  useEffect(() => {
    if (open) setPrefs(loadNotificationPrefs(userId));
  }, [open, userId]);

  function toggle(key: keyof NotificationPrefs) {
    setPrefs((p) => ({ ...p, [key]: !p[key] }));
  }

  function guardar() {
    saveNotificationPrefs(userId, prefs);
    onSaved?.(prefs);
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Notificaciones"
      size="sm"
      analyticsId="modal-preferencias-notificaciones"
      description="Elige qué avisos en tiempo real quieres ver. Reduce el ruido sin perder lo crítico."
      footer={(
        <>
          <CancelButton type="button" onClick={onClose}>Cancelar</CancelButton>
          <Button type="button" variant="primary" onClick={guardar}>Guardar</Button>
        </>
      )}
    >
      <ul className="mc-notif-prefs-list">
        {eventos.map((key) => (
          <li key={key} className="mc-notif-prefs-item">
            <label className="mc-notif-prefs-label">
              <input
                type="checkbox"
                checked={prefs[key]}
                onChange={() => toggle(key)}
              />
              <span>{NOTIFICATION_EVENT_LABELS[key]}</span>
            </label>
          </li>
        ))}
      </ul>
    </Modal>
  );
}
