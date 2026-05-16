/**
 * components/ui/SectionErrorBoundary.tsx
 *
 * Error boundary por sección: un fallo no tumba toda la app.
 * Opcional: `resetKey` (p. ej. `location.pathname`) para limpiar al navegar.
 */

import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

import { Button } from '@/components/ui/Button';
import { captureSentryException } from '@/lib/sentry';

interface Props {
  children: ReactNode;
  label?: string;
  resetKey?: string;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
}

export class SectionErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: unknown): State {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : String(error),
    };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    const label = this.props.label ?? 'Sección';
    console.error(`[SectionErrorBoundary:${label}]`, error, info.componentStack);
    captureSentryException(error, {
      label,
      ...(info.componentStack ? { componentStack: info.componentStack } : {}),
    });
  }

  override componentDidUpdate(prevProps: Props) {
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false, message: '' });
    }
  }

  override render() {
    if (!this.state.hasError) return this.props.children;
    if (this.props.fallback) return this.props.fallback;

    return (
      <div className="mc-error-boundary" role="alert" aria-live="polite">
        <AlertTriangle size={28} className="mc-error-boundary-icon" aria-hidden />
        <p className="mc-error-boundary-title">
          {this.props.label ? `Error en ${this.props.label}` : 'Algo salió mal'}
        </p>
        <p className="mc-error-boundary-desc">
          Esta sección no pudo cargarse. El resto de la app sigue funcionando.
        </p>
        {import.meta.env.DEV && (
          <pre className="mc-error-boundary-pre">{this.state.message}</pre>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => this.setState({ hasError: false, message: '' })}
        >
          Reintentar
        </Button>
      </div>
    );
  }
}
