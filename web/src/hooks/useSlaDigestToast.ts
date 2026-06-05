/**
 * Toast de resumen SLA al entrar (jefe), una vez por sesión/día.
 * Complementa realtime cuando la app estuvo cerrada.
 */

import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { contarAlertasSla } from '@/api/sla';
import { announcePolitely } from '@/components/a11y/LiveRegion';
import { useResumenSlaJefe } from '@/hooks/useResumenSlaJefe';
import {
  isNotificationEnabled,
  type NotificationPrefs,
} from '@/lib/notificationPrefs';
import { markSlaDigestShownToday, wasSlaDigestShownToday } from '@/lib/slaDigest';
import { planificacionSlaPath } from '@/lib/slaNavigation';
import { useAuthStore } from '@/store/authStore';

function mensajeResumenSla(atrasadas: number): string {
  if (atrasadas <= 0) return '';
  return `${atrasadas} atrasada${atrasadas !== 1 ? 's' : ''} nuevas (24 h)`;
}

export function useSlaDigestToast(prefs: NotificationPrefs | null) {
  const navigate = useNavigate();
  const usuario  = useAuthStore((s) => s.usuario);
  const shownRef = useRef(false);

  const { data, isSuccess } = useResumenSlaJefe({
    enabled: Boolean(usuario?.id && usuario.rol === 'jefe' && prefs),
  });

  useEffect(() => {
    if (!usuario?.id || usuario.rol !== 'jefe' || !prefs || !isSuccess || !data) return;
    if (shownRef.current) return;
    if (!isNotificationEnabled(prefs, 'resumen_sla_diario')) return;
    if (wasSlaDigestShownToday(usuario.id)) return;

    const total = contarAlertasSla(data);
    if (total === 0) return;

    shownRef.current = true;
    markSlaDigestShownToday(usuario.id);

    const desc = mensajeResumenSla(data.atrasadas_nuevas_24h);
    const msg  = `Alertas SLA del equipo: ${desc}`;

    toast.warning(msg, {
      description: 'Revisar en planificación',
      duration: 12_000,
      action: {
        label: 'Ver',
        onClick: () => navigate(planificacionSlaPath()),
      },
    });
    announcePolitely(msg);
  }, [data, isSuccess, navigate, prefs, usuario?.id, usuario?.rol]);
}
