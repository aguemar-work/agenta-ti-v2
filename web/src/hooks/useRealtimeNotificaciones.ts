/**
 * hooks/useRealtimeNotificaciones.ts
 *
 * Escucha eventos en tiempo real y dispara toasts según el rol del usuario.
 * Incluye retry con exponential backoff y estado de conexión observable.
 *
 * Canales:
 *   usuario:{id}   — eventos dirigidos a un usuario específico
 *   equipo:{id}    — eventos del equipo (solo jefes)
 *
 * Eventos:
 *   tarea_completada      → { tareaId, titulo, usuarioNombre }
 *   tarea_asignada        → { tareaId, titulo, asignadoPor }
 *   ot_enviada            → { otId, numero, usuarioNombre }
 *   ot_aprobada           → { otId, numero }
 *   ot_rechazada          → { otId, numero, motivo }
 *   incidencia_registrada → { titulo, usuarioNombre }
 *   tarea_atrasada          → { tareaId, titulo, diasAtraso, usuarioNombre }
 *   tarea_bloqueada_critica → { tareaId, titulo, horasBloqueada, usuarioNombre }
 *   resumen_sla_diario      → { nuevasAtrasadas, bloqueadasCriticas, fecha }
 *
 * Uso:
 *   const { conectado } = useRealtimeNotificaciones();
 *   // conectado: true = realtime activo, false = sin conexión
 */

import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { announcePolitely } from '@/components/a11y/LiveRegion';

import { Q_INC_HOY } from '@/hooks/useHoyColumnas';
import { Q_SLA_RESUMEN } from '@/hooks/useResumenSlaJefe';
import { getInsforge } from '@/lib/insforge';
import { planificacionSlaPath } from '@/lib/slaNavigation';
import {
  getDefaultNotificationPrefs,
  isNotificationEnabled,
  type NotificationEventKey,
  type NotificationPrefs,
} from '@/lib/notificationPrefs';
import { useAuthStore } from '@/store/authStore';

type EventPayload = Record<string, unknown>;

// Configuración de retry
const RETRY_DELAYS_MS = [2_000, 4_000, 8_000]; // 3 intentos: 2s, 4s, 8s
const MAX_RETRIES = RETRY_DELAYS_MS.length;

function notifyIfEnabled(
  prefs: NotificationPrefs,
  event: NotificationEventKey,
  show: () => void,
) {
  if (isNotificationEnabled(prefs, event)) show();
}

function invalidatePlanificacionYsla(qc: ReturnType<typeof useQueryClient>) {
  void Promise.all([
    qc.invalidateQueries({ queryKey: ['planificacion'], exact: false }),
    qc.invalidateQueries({ queryKey: [...Q_SLA_RESUMEN], exact: false }),
    qc.invalidateQueries({ queryKey: ['semana'], exact: false }),
  ]);
}

export function useRealtimeNotificaciones(prefs: NotificationPrefs = getDefaultNotificationPrefs()) {
  const usuario = useAuthStore((s) => s.usuario);
  const qc      = useQueryClient();
  const navigate = useNavigate();

  const [conectado, setConectado] = useState(false);

  const cancelledRef  = useRef(false);
  const retryCountRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!usuario?.id) return;

    cancelledRef.current  = false;
    retryCountRef.current = 0;

    const rt          = getInsforge().realtime;
    const esJefe      = usuario.rol === 'jefe';
    const canalUser   = `usuario:${usuario.id}`;
    const canalEquipo = `equipo:${usuario.id}`;

    async function connect() {
      if (cancelledRef.current) return;

      try {
        await rt.connect();
        if (cancelledRef.current) return;

        // Conexión exitosa — resetear contador de retries
        retryCountRef.current = 0;
        setConectado(true);

        // ── Canal personal ─────────────────────────────────────────────
        await rt.subscribe(canalUser);

        rt.on('tarea_asignada', (payload: EventPayload) => {
          if (cancelledRef.current) return;
          void qc.invalidateQueries({ queryKey: ['semana'], exact: false });
          notifyIfEnabled(prefs, 'tarea_asignada', () => {
            const quien = payload.asignadoPor ? ` (${payload.asignadoPor})` : '';
            const msg = `Nueva tarea asignada${quien}: ${payload.titulo ?? ''}`;
            toast.info(msg);
            announcePolitely(msg);
          });
        });

        rt.on('ot_aprobada', (payload: EventPayload) => {
          if (cancelledRef.current) return;
          notifyIfEnabled(prefs, 'ot_aprobada', () => {
            const msg = `OT ${payload.numero ?? ''} aprobada`;
            toast.success(`${msg} ✓`);
            announcePolitely(msg);
          });
        });

        rt.on('ot_rechazada', (payload: EventPayload) => {
          if (cancelledRef.current) return;
          notifyIfEnabled(prefs, 'ot_rechazada', () => {
            const msg = `OT ${payload.numero ?? ''} rechazada${payload.motivo ? `: ${payload.motivo}` : ''}`;
            toast.error(msg);
            announcePolitely(msg);
          });
        });

        // ── Canal del equipo (solo Jefe) ───────────────────────────────
        if (esJefe) {
          await rt.subscribe(canalEquipo);

          rt.on('tarea_completada', (payload: EventPayload) => {
            if (cancelledRef.current) return;
            void Promise.all([
              qc.invalidateQueries({ queryKey: ['tablero'],      exact: false }),
              qc.invalidateQueries({ queryKey: ['semana'],       exact: false }),
              qc.invalidateQueries({ queryKey: ['tareas-hoy'],   exact: false }),
              qc.invalidateQueries({ queryKey: ['planificacion'], exact: false }),
            ]);
            notifyIfEnabled(prefs, 'tarea_completada', () => {
              const msg = `${payload.usuarioNombre ?? 'Miembro'} completó "${payload.titulo ?? ''}"`;
              toast.success(msg, {
                description: payload.resumen ? String(payload.resumen).slice(0, 120) : undefined,
              });
              announcePolitely(msg);
            });
          });

          rt.on('ot_enviada', (payload: EventPayload) => {
            if (cancelledRef.current) return;
            notifyIfEnabled(prefs, 'ot_enviada', () => {
              const msg = `Nueva OT de ${payload.usuarioNombre ?? 'Miembro'}, ${payload.numero ?? ''}, pendiente de aprobación`;
              toast.info(`Nueva OT de ${payload.usuarioNombre ?? 'Miembro'}`, {
                description: `${payload.numero ?? ''} — pendiente de aprobación`,
              });
              announcePolitely(msg);
            });
          });

          rt.on('incidencia_registrada', (payload: EventPayload) => {
            if (cancelledRef.current) return;
            void Promise.all([
              qc.invalidateQueries({ queryKey: [Q_INC_HOY],      exact: false }),
              qc.invalidateQueries({ queryKey: ['tablero'],       exact: false }),
              qc.invalidateQueries({ queryKey: ['planificacion'], exact: false }),
            ]);
            notifyIfEnabled(prefs, 'incidencia_registrada', () => {
              const msg = `Incidencia registrada: ${payload.titulo ?? ''}, por ${payload.usuarioNombre ?? ''}`;
              toast.warning(`Incidencia: ${payload.titulo ?? ''}`, {
                description: `Registrada por ${payload.usuarioNombre ?? ''}`,
              });
              announcePolitely(msg);
            });
          });

          rt.on('tarea_atrasada', (payload: EventPayload) => {
            if (cancelledRef.current) return;
            invalidatePlanificacionYsla(qc);
            notifyIfEnabled(prefs, 'tarea_atrasada', () => {
              const dias = Number(payload.diasAtraso ?? 1);
              const quien = payload.usuarioNombre ? ` (${payload.usuarioNombre})` : '';
              const msg = `Tarea atrasada${quien}: "${payload.titulo ?? ''}" — ${dias} día${dias !== 1 ? 's' : ''}`;
              toast.warning(msg, {
                description: 'Ir a planificación',
                duration: 8_000,
                action: {
                  label: 'Ver',
                  onClick: () => navigate(planificacionSlaPath()),
                },
              });
              announcePolitely(msg);
            });
          });

          rt.on('tarea_bloqueada_critica', (payload: EventPayload) => {
            if (cancelledRef.current) return;
            invalidatePlanificacionYsla(qc);
            notifyIfEnabled(prefs, 'tarea_bloqueada_critica', () => {
              const horas = Number(payload.horasBloqueada ?? 48);
              const quien = payload.usuarioNombre ? ` (${payload.usuarioNombre})` : '';
              const msg = `Tarea bloqueada ${horas}h${quien}: "${payload.titulo ?? ''}"`;
              toast.error(msg, {
                description: 'Sin resolver hace más de 48 horas',
                duration: 10_000,
                action: {
                  label: 'Ver',
                  onClick: () => navigate(planificacionSlaPath()),
                },
              });
              announcePolitely(msg);
            });
          });

          rt.on('resumen_sla_diario', (payload: EventPayload) => {
            if (cancelledRef.current) return;
            invalidatePlanificacionYsla(qc);
            notifyIfEnabled(prefs, 'resumen_sla_diario', () => {
              const n = Number(payload.nuevasAtrasadas ?? 0);
              const b = Number(payload.bloqueadasCriticas ?? 0);
              if (n === 0 && b === 0) return;
              const partes: string[] = [];
              if (n > 0) partes.push(`${n} atrasada${n !== 1 ? 's' : ''} nuevas`);
              if (b > 0) partes.push(`${b} bloqueada${b !== 1 ? 's' : ''} >48 h`);
              const msg = `Resumen SLA: ${partes.join(', ')}`;
              toast.warning(msg, {
                description: 'Revisar en planificación',
                duration: 12_000,
                action: {
                  label: 'Ver',
                  onClick: () => navigate(planificacionSlaPath()),
                },
              });
              announcePolitely(msg);
            });
          });
        }
      } catch (err) {
        if (cancelledRef.current) return;

        setConectado(false);
        // Solo logear en dev; en producción el indicador gris es suficiente feedback
        if (import.meta.env.DEV) {
          console.warn('[useRealtimeNotificaciones] connect error:', err);
        }

        // Retry con exponential backoff si quedan intentos
        if (retryCountRef.current < MAX_RETRIES) {
          const delay = RETRY_DELAYS_MS[retryCountRef.current] ?? 8_000;
          retryCountRef.current += 1;
          retryTimerRef.current = setTimeout(() => {
            if (!cancelledRef.current) void connect();
          }, delay);
        }
        // Después de MAX_RETRIES la app sigue funcionando sin realtime (indicador gris)
      }
    }

    void connect();

    return () => {
      cancelledRef.current = true;

      // Cancelar retry pendiente si existe
      if (retryTimerRef.current !== null) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }

      setConectado(false);

      try {
        rt.unsubscribe(canalUser);
        if (esJefe) rt.unsubscribe(canalEquipo);
        rt.disconnect();
      } catch {
        // ignorar errores de cleanup
      }
    };
  }, [navigate, qc, usuario?.id, usuario?.rol, prefs]);

  return { conectado };
}