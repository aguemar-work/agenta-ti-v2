import { AppLogo } from '@/components/brand/AppLogo';

export function InsforgeConfigMissing() {
  return (
    <div className="mc-auth-page">
      <div className="mc-auth-container">
        <div className="mc-auth-logo">
          <AppLogo height={44} />
        </div>

        <div className="mc-auth-card">
          <div className="mc-auth-card-header">
            <h1 className="mc-auth-title">Configuración de InsForge</h1>
            <p className="mc-auth-subtitle">
              Crea el archivo{' '}
              <code className="mc-inline-code">web/.env</code>
              {' '}a partir de{' '}
              <code className="mc-inline-code">web/.env.example</code>
              {' '}y define{' '}
              <code className="mc-inline-code">VITE_INSFORGE_URL</code>
              {' '}y{' '}
              <code className="mc-inline-code">VITE_INSFORGE_ANON_KEY</code>.
              {' '}Reinicia{' '}
              <code className="mc-inline-code">npm run dev</code>
              {' '}tras guardar.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
