import { ClipboardList, FileText, Target } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { Button, CancelButton } from '@/components/ui/Button';
import { markModalCompleted, Modal } from '@/components/ui/Modal';
import { trackFeatureDiscovery, trackOnboarding } from '@/lib/analytics';
import { isOnboardingCompleted, markOnboardingCompleted } from '@/lib/onboarding';
import type { RolUsuario } from '@/types';

type Props = {
  userId: string;
  rol: RolUsuario;
};

type Step = {
  title: string;
  body: string;
  icon: typeof Target;
  cta?: { label: string; to: string; feature: string };
};

function stepsForRol(rol: RolUsuario): Step[] {
  const objetivos: Step = {
    title: 'Objetivos estratégicos',
    body: 'Vincula tareas y OTs a metas del equipo. Nexora conecta el trabajo diario con resultados medibles — el diferenciador frente a tableros genéricos.',
    icon: Target,
    cta: { label: 'Ir a Objetivos', to: '/objetivos', feature: 'objetivos' },
  };
  const ot: Step = {
    title: 'Órdenes de trabajo formales',
    body: 'Flujo de aprobación, rechazo con motivo e impresión para mantenimiento y proyectos. Ideal para equipos que necesitan trazabilidad B2B.',
    icon: FileText,
    cta: { label: 'Ver órdenes', to: '/ordenes-trabajo', feature: 'ordenes_trabajo' },
  };
  const planificacion: Step = {
    title: 'Planificación del equipo',
    body: 'Carga semanal, alertas operativas y rendimiento del período en una vista de solo lectura para supervisar al equipo.',
    icon: ClipboardList,
    cta: { label: 'Abrir planificación', to: '/planificacion', feature: 'planificacion' },
  };

  if (rol === 'jefe') return [objetivos, planificacion, ot];
  return [objetivos, ot];
}

export function OnboardingWelcome({ userId, rol }: Props) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const steps = stepsForRol(rol);
  const current = steps[step];

  useEffect(() => {
    if (!isOnboardingCompleted(userId)) {
      setOpen(true);
      trackOnboarding('shown');
    }
  }, [userId]);

  function finish(dismissed: boolean) {
    markOnboardingCompleted(userId);
    trackOnboarding(dismissed ? 'dismissed' : 'completed', step + 1);
    if (!dismissed) markModalCompleted('onboarding-welcome');
    setOpen(false);
  }

  function next() {
    if (step < steps.length - 1) {
      trackOnboarding('step', step + 1);
      setStep((s) => s + 1);
    } else {
      finish(false);
    }
  }

  if (!open || !current) return null;

  const Icon = current.icon;

  return (
    <Modal
      open={open}
      onClose={() => finish(true)}
      title="Bienvenido a Nexora"
      size="md"
      analyticsId="onboarding-welcome"
      footer={(
        <>
          <CancelButton type="button" onClick={() => finish(true)}>
            Omitir tour
          </CancelButton>
          <Button type="button" variant="primary" onClick={next}>
            {step < steps.length - 1 ? 'Siguiente' : 'Empezar en Mi semana'}
          </Button>
        </>
      )}
    >
      <div className="mc-onboarding-step">
        <div className="mc-onboarding-icon" aria-hidden>
          <Icon size={28} strokeWidth={1.75} />
        </div>
        <p className="mc-onboarding-step-label">
          Paso {step + 1} de {steps.length}
        </p>
        <h3 className="mc-onboarding-step-title">{current.title}</h3>
        <p className="mc-onboarding-step-body">{current.body}</p>
        {current.cta && (
          <Link
            to={current.cta.to}
            className="mc-onboarding-cta-link"
            onClick={() => {
              trackFeatureDiscovery(current.cta!.feature, 'onboarding');
              finish(false);
            }}
          >
            {current.cta.label}
          </Link>
        )}
      </div>
    </Modal>
  );
}
