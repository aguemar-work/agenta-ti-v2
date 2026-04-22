import { AppLogo } from '@/components/brand/AppLogo';

export function InsforgeConfigMissing() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[var(--mc-color-bg)] px-6 text-center">
      <AppLogo height={44} />
      <h1 className="text-xl font-semibold text-[var(--mc-color-text)]">Configuración de InsForge</h1>
      <p className="max-w-md text-sm text-[var(--mc-color-text-secondary)]">
        Crea el archivo <code className="rounded bg-[var(--mc-color-surface-hover)] px-1">web/.env</code> a partir de{' '}
        <code className="rounded bg-[var(--mc-color-surface-hover)] px-1">web/.env.example</code> y define{' '}
        <code className="rounded bg-[var(--mc-color-surface-hover)] px-1">VITE_INSFORGE_URL</code> y{' '}
        <code className="rounded bg-[var(--mc-color-surface-hover)] px-1">VITE_INSFORGE_ANON_KEY</code>. Reinicia{' '}
        <code className="rounded bg-[var(--mc-color-surface-hover)] px-1">npm run dev</code> tras guardar.
      </p>
    </div>
  );
}
