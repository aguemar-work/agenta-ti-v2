import { APP_PAGE_CLASS } from '@/lib/appLayout';

export function Bitacora() {
  return (
    <div className={APP_PAGE_CLASS}>
      <div>
        <h1 className="font-semibold text-[var(--mc-color-text)]" style={{ fontSize: 'var(--mc-text-lg)' }}>
          Bitácora
        </h1>
        <h2 className="mt-2 text-sm font-medium text-[var(--mc-color-text-secondary)]">Registro</h2>
      </div>
    </div>
  );
}
