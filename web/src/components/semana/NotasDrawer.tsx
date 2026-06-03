import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { etiquetaConvertidaEn } from '@/lib/notaBitacora';
import type { NotaBitacora } from '@/types';

type Props = {
  open: boolean;
  notas: NotaBitacora[];
  notaRapida: string;
  usuarioId: string;
  onClose: () => void;
  onNotaRapidaChange: (value: string) => void;
  onGuardarNota: () => void;
  onConvertir: (nota: NotaBitacora) => void;
};

export function NotasDrawer({
  open,
  notas,
  notaRapida,
  usuarioId,
  onClose,
  onNotaRapidaChange,
  onGuardarNota,
  onConvertir,
}: Props) {
  if (!open) return null;

  const activas = notas.filter((n) => !n.convertida_en);
  const convertidas = notas.filter((n) => n.convertida_en);

  return (
    <>
      <div
        className="mc-drawer-overlay"
        onClick={onClose}
        aria-hidden
      />
      <aside
        id="mc-misemana-notas-drawer"
        className="mc-drawer-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Notas del día"
      >
        <div className="mc-drawer-panel-header">
          <h2 className="mc-drawer-panel-title">Notas</h2>
          <button
            type="button"
            className="mc-modal-close"
            onClick={onClose}
            aria-label="Cerrar panel de notas"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div className="mc-drawer-panel-body">
          {notas.length === 0 ? (
            <EmptyState compact title="Sin notas" />
          ) : (
            <div className="flex flex-col gap-3">
              {activas.length > 0 && (
                <div className="flex flex-col gap-1">
                  {activas.map((n) => (
                    <NotaBitacoraFila
                      key={n.id}
                      nota={n}
                      puedeConvertir={n.usuario_id === usuarioId}
                      onConvertir={() => onConvertir(n)}
                    />
                  ))}
                </div>
              )}
              {convertidas.length > 0 && (
                <div className="flex flex-col gap-1">
                  {activas.length > 0 && (
                    <p className="m-0 text-[10px] uppercase tracking-[0.06em] text-[var(--mc-color-text-secondary)]">
                      Convertidas
                    </p>
                  )}
                  {convertidas.map((n) => (
                    <NotaBitacoraFila key={n.id} nota={n} convertida />
                  ))}
                </div>
              )}
            </div>
          )}
          <textarea
            rows={3}
            className="mc-input resize-none text-xs"
            placeholder="Nota rápida…"
            value={notaRapida}
            onChange={(e) => onNotaRapidaChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) onGuardarNota();
            }}
          />
          <Button
            variant="secondary"
            size="sm"
            onClick={onGuardarNota}
            disabled={!notaRapida.trim()}
          >
            Guardar nota
          </Button>
        </div>
      </aside>
    </>
  );
}

function NotaBitacoraFila({
  nota,
  convertida = false,
  puedeConvertir = false,
  onConvertir,
}: {
  nota: NotaBitacora;
  convertida?: boolean;
  puedeConvertir?: boolean;
  onConvertir?: () => void;
}) {
  const texto = nota.contenido.length > 200
    ? `${nota.contenido.slice(0, 200)}…`
    : nota.contenido;

  return (
    <div
      className={[
        'mc-nota-bitacora',
        convertida ? 'mc-nota-bitacora--convertida' : '',
      ].filter(Boolean).join(' ')}
    >
      <p className="mc-nota-bitacora__texto">{texto}</p>
      {convertida && nota.convertida_en && (
        <span className="mc-nota-bitacora__badge">
          {etiquetaConvertidaEn(nota.convertida_en)}
        </span>
      )}
      {puedeConvertir && onConvertir && (
        <Button variant="ghost" size="sm" onClick={onConvertir}>
          Convertir…
        </Button>
      )}
    </div>
  );
}
