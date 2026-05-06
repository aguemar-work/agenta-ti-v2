import { StrictMode, Component, type ReactNode, type ErrorInfo } from 'react';
import { createRoot } from 'react-dom/client';

import App from '@/App.tsx';
import { getInsforgeEnv } from '@/lib/insforge';
import { installInsforgeFetchInterceptor } from '@/lib/insforgeFetchInterceptor';
import { setAppIcons } from '@/lib/setAppIcons';
import { AppProviders } from '@/providers/AppProviders';
import '@/index.css';
/** Animaciones, skeletons y estilos de urgencia — debe ir tras index.css para no perder contra Tailwind. */
import '@/styles/animations.css';

setAppIcons();

if (getInsforgeEnv()) {
  installInsforgeFetchInterceptor();
}

// ---------------------------------------------------------------------------
// Error Boundary — captura errores de render no manejados.
// En producción muestra una pantalla amigable; en dev re-lanza para ver el
// stack completo en la consola.
// ---------------------------------------------------------------------------
interface EBState { hasError: boolean; message: string }

class AppErrorBoundary extends Component<{ children: ReactNode }, EBState> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: unknown): EBState {
    const message = error instanceof Error ? error.message : String(error);
    return { hasError: true, message };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // En producción conecta aquí tu servicio de monitoreo (Sentry, etc.)
    console.error('[AppErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            gap: '16px',
            fontFamily: 'var(--mc-font, system-ui, sans-serif)',
            color: 'var(--mc-color-text)',
          }}
        >
          <h1 style={{ fontSize: '18px', fontWeight: 600, margin: 0 }}>
            Algo salió mal
          </h1>
          <p style={{ fontSize: '14px', color: 'var(--mc-color-text-secondary)', margin: 0, textAlign: 'center' }}>
            Ocurrió un error inesperado. Recarga la página o contacta al administrador.
          </p>
          {import.meta.env.DEV && (
            <pre
              style={{
                fontSize: '12px',
                background: 'var(--mc-color-surface)',
                border: '1px solid var(--mc-color-border)',
                borderRadius: '8px',
                padding: '12px 16px',
                maxWidth: '600px',
                overflowX: 'auto',
                color: 'var(--mc-color-danger, #dc2626)',
              }}
            >
              {this.state.message}
            </pre>
          )}
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              height: '38px',
              padding: '0 20px',
              borderRadius: '8px',
              border: '1px solid var(--mc-color-border)',
              background: 'var(--mc-color-surface)',
              color: 'var(--mc-color-text)',
              fontSize: '14px',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Recargar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ---------------------------------------------------------------------------

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppErrorBoundary>
      <AppProviders>
        <App />
      </AppProviders>
    </AppErrorBoundary>
  </StrictMode>,
);