/**
 * components/ui/SectionErrorBoundary.tsx
 * Error Boundary ligero para envolver secciones/módulos grandes.
 *
 * Resuelve hallazgo 5.2: un error en una sección no debe tumbar toda la app.
 * El boundary global en main.tsx es la red de último recurso;
 * estos boundaries por sección permiten que el resto de la UI siga funcionando.
 *
 * Uso:
 *   <SectionErrorBoundary label="Tablero">
 *     <Tablero />
 *   </SectionErrorBoundary>
 *
 * Con reset al navegar (recomendado en rutas):
 *   const location = useLocation();
 *   <SectionErrorBoundary label="Hoy" resetKey={location.pathname}>
 *     <Hoy />
 *   </SectionErrorBoundary>
 */

import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
    children: ReactNode;
    /** Nombre del módulo — aparece en el mensaje de error en DEV */
    label?: string;
    /** Cambia este valor para resetear el boundary (ej: route pathname) */
    resetKey?: string;
    /** Componente alternativo personalizado */
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
        const message = error instanceof Error ? error.message : String(error);
        return { hasError: true, message };
    }

    componentDidCatch(error: Error, info: ErrorInfo) {
        const label = this.props.label ?? 'Sección';
        console.error(`[SectionErrorBoundary:${label}]`, error, info.componentStack);
    }

    // Resetear cuando cambia resetKey (ej: al navegar a otra ruta)
    componentDidUpdate(prevProps: Props) {
        if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
            this.setState({ hasError: false, message: '' });
        }
    }

    render() {
        if (this.state.hasError) {
            if (this.props.fallback) return this.props.fallback;

            return (
                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '32px 24px',
                        gap: 12,
                        borderRadius: 'var(--mc-radius-lg)',
                        border: '1px solid var(--mc-color-border)',
                        background: 'var(--mc-color-surface)',
                        color: 'var(--mc-color-text)',
                        fontFamily: 'var(--mc-font-sans, system-ui, sans-serif)',
                    }}
                    role="alert"
                >
                    <p style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>
                        {this.props.label ? `Error en ${this.props.label}` : 'Algo salió mal'}
                    </p>
                    <p style={{ margin: 0, fontSize: '13px', color: 'var(--mc-color-text-secondary)', textAlign: 'center' }}>
                        Esta sección no pudo cargarse. El resto de la app sigue funcionando.
                    </p>
                    {import.meta.env.DEV && (
                        <pre style={{
                            fontSize: '11px',
                            background: 'var(--mc-color-bg)',
                            border: '1px solid var(--mc-color-border)',
                            borderRadius: 6,
                            padding: '8px 12px',
                            maxWidth: 480,
                            overflowX: 'auto',
                            color: 'var(--mc-color-danger, #dc2626)',
                            margin: 0,
                        }}>
                            {this.state.message}
                        </pre>
                    )}
                    <button
                        type="button"
                        onClick={() => this.setState({ hasError: false, message: '' })}
                        style={{
                            height: 34,
                            padding: '0 16px',
                            borderRadius: 8,
                            border: '1px solid var(--mc-color-border)',
                            background: 'var(--mc-color-surface)',
                            color: 'var(--mc-color-text)',
                            fontSize: '13px',
                            fontWeight: 500,
                            cursor: 'pointer',
                        }}
                    >
                        Reintentar
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}