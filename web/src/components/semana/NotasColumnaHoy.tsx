import { useState } from 'react';
import { NotebookPen, Send } from 'lucide-react';

import type { NotaBitacora } from '@/types';

type Props = {
  notas: NotaBitacora[];
  notaRapida: string;
  onNotaRapidaChange: (v: string) => void;
  onGuardar: () => void | Promise<void>;
  onVerTodas: () => void;
  onConvertir?: (nota: NotaBitacora) => void;
};

const MAX_PREVIEW = 2;

export function NotasColumnaHoy({
  notas,
  notaRapida,
  onNotaRapidaChange,
  onGuardar,
  onVerTodas,
  onConvertir,
}: Props) {
  const [guardando, setGuardando] = useState(false);

  const notasActivas = notas.filter((n) => !n.convertida_en);
  const preview      = notasActivas.slice(0, MAX_PREVIEW);
  const totalActivas = notasActivas.length;

  async function handleGuardar() {
    if (!notaRapida.trim() || guardando) return;
    setGuardando(true);
    try { await onGuardar(); } finally { setGuardando(false); }
  }

  return (
    <div className="shrink-0 border-t border-[var(--mc-color-border)] bg-[var(--mc-color-surface)] px-2 py-2">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="flex items-center gap-1 text-[11px] font-medium text-[var(--mc-color-text-secondary)]">
          <NotebookPen size={11} aria-hidden />
          Notas
        </span>
        {totalActivas > 0 && (
          <button
            type="button"
            onClick={onVerTodas}
            className="text-[11px] text-[var(--mc-color-accent)] hover:underline"
          >
            Ver todas ({totalActivas})
          </button>
        )}
      </div>

      {preview.length > 0 && (
        <ul className="mb-1.5 flex flex-col gap-0.5">
          {preview.map((nota) => (
            <li key={nota.id} className="group flex items-start gap-1">
              <span
                className="min-w-0 flex-1 cursor-default truncate text-[11px] text-[var(--mc-color-text-secondary)]"
                title={nota.contenido}
              >
                {nota.contenido}
              </span>
              {onConvertir && (
                <button
                  type="button"
                  onClick={() => onConvertir(nota)}
                  title="Convertir en tarea o evento"
                  className="hidden shrink-0 text-[10px] text-[var(--mc-color-accent)] group-hover:block"
                >
                  →
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-center gap-1">
        <input
          type="text"
          className="min-w-0 flex-1 rounded-[var(--mc-radius-sm)] border border-[var(--mc-color-border)] bg-[var(--mc-color-bg)] px-2 py-1 text-[11px] placeholder:text-[var(--mc-color-text-secondary)] focus:border-[var(--mc-color-accent)] focus:outline-none"
          placeholder="Nueva nota…"
          value={notaRapida}
          onChange={(e) => onNotaRapidaChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); void handleGuardar(); }
          }}
          aria-label="Escribir nota rápida"
        />
        <button
          type="button"
          disabled={!notaRapida.trim() || guardando}
          onClick={() => void handleGuardar()}
          className="shrink-0 rounded-[var(--mc-radius-sm)] p-1 text-[var(--mc-color-accent)] hover:bg-[var(--mc-color-bg-secondary)] disabled:opacity-40"
          aria-label="Guardar nota"
        >
          <Send size={12} aria-hidden />
        </button>
      </div>
    </div>
  );
}
