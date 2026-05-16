import { useMediaQuery } from '@/hooks/useMediaQuery';
import type { ReactNode, RefObject } from 'react';

type Props = {
  title: string;
  sectionRef?: RefObject<HTMLElement | null>;
  /** En móvil, sección expandida por defecto (p. ej. heatmap). */
  defaultOpenOnMobile?: boolean;
  children: ReactNode;
};

/**
 * En &lt;768px agrupa bloques largos en &lt;details&gt; para reducir scroll.
 * En desktop el contenido queda siempre visible.
 */
export function PlanificacionSection({
  title,
  sectionRef,
  defaultOpenOnMobile = false,
  children,
}: Props) {
  const isDesktop = useMediaQuery('(min-width: 768px)');

  if (isDesktop) {
    return <section ref={sectionRef}>{children}</section>;
  }

  return (
    <details
      className="mc-planificacion-details"
      open={defaultOpenOnMobile || undefined}
    >
      <summary className="mc-planificacion-details__summary">{title}</summary>
      <div className="mc-planificacion-details__body">
        <section ref={sectionRef}>{children}</section>
      </div>
    </details>
  );
}
