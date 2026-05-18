import { MoreHorizontal } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

type UsuarioOption = { id: string; nombre: string };

type Props = {
  esJefe: boolean;
  uid: string;
  usuariosJefe?: UsuarioOption[] | undefined;
  onSeleccionarUsuario: (id: string) => void;
};

/** Menú secundario: selector «Ver semana de» solo para jefe. */
export function MiSemanaMenuSecundario({
  esJefe,
  uid,
  usuariosJefe,
  onSeleccionarUsuario,
}: Props) {
  const [abierto, setAbierto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!abierto) return;
    function onPointerDown(ev: MouseEvent) {
      if (ref.current && !ref.current.contains(ev.target as Node)) setAbierto(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [abierto]);

  if (!esJefe || !usuariosJefe?.length) return null;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        className="mc-btn-secondary mc-btn-sm inline-flex items-center justify-center"
        aria-label="Más opciones de semana"
        aria-expanded={abierto}
        aria-haspopup="menu"
        onClick={() => setAbierto((v) => !v)}
      >
        <MoreHorizontal size={18} aria-hidden />
      </button>
      {abierto && (
        <div
          role="menu"
          className="absolute right-0 top-full z-20 mt-1 min-w-[220px] rounded-[var(--mc-radius-md)] border border-[var(--mc-color-border)] bg-[var(--mc-color-surface)] py-2 shadow-[var(--mc-shadow-md)]"
        >
          <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--mc-color-text-secondary)]">
            Ver semana de
          </p>
          <select
            aria-label="Ver semana de"
            className="mc-input mx-2 !w-[calc(100%-16px)] text-sm"
            value={uid}
            onChange={(e) => {
              onSeleccionarUsuario(e.target.value);
              setAbierto(false);
            }}
          >
            {usuariosJefe.map((u) => (
              <option key={u.id} value={u.id}>{u.nombre}</option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
